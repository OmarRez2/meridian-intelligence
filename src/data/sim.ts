import type { SupplyChainDataset, StockItem, ItemSales } from './types';
import { sum, div } from './measures';
import { stockCapital } from './lab';

/**
 * Meridian Decision Simulator: deterministic scenario arithmetic on the recorded baseline.
 *
 * A scenario answers "if these levers moved, and everything else stayed as recorded, what would the
 * arithmetic give?". It is not a prediction (nothing says the levers will move, or projects a future
 * level) and not a causal estimate (the volume response to price is an assumption the user sets; the
 * data holds no price variation to measure it).
 *
 * Four ledgers are kept apart and never added together:
 *  - gross profit (revenue − cost of sales), the only ledger the profit bridge moves;
 *  - purchase spend (purchase orders), which in this sample does not reconcile with cost of sales;
 *  - inventory capital (stock at cost), a snapshot that does not reconcile with stock movements;
 *  - holding cost (capital × a carrying rate), disabled unless the user sets a rate.
 *
 * Baseline: each item's recorded revenue and cost of sales (cost of sales = units × cost price for every
 * item in this export). With every lever at rest the result equals the recorded baseline exactly.
 */

export type Scope = { kind: 'all' } | { kind: 'family'; c: number } | { kind: 'structural' };
export type Scenario = {
  v: 1;
  /** price change as a fraction (0.05 = +5%), applied to items in scope */
  price: { scope: Scope; change: number };
  /** assumed constant price elasticity of volume (0 = volume unchanged; −1.5 = a 1% price rise loses about 1.5% of units) */
  elasticity: number;
  /** a supplier's cost change (fraction) and the share of it passed on to customers in price (0–1) */
  supplier: { s: number | null; shock: number; passThrough: number };
  /** share (0–1) of never-picked units that would be fulfilled */
  recovery: { scope: Scope; share: number };
  /** cover policy in months (null = off) and annual carrying rate (null = disabled) */
  inventory: { cover: number | null; carryRate: number | null };
};

export const BASELINE: Scenario = {
  v: 1,
  price: { scope: { kind: 'all' }, change: 0 },
  elasticity: 0,
  supplier: { s: null, shock: 0, passThrough: 0 },
  recovery: { scope: { kind: 'all' }, share: 0 },
  inventory: { cover: null, carryRate: null },
};
export const LIMITS = { price: [-0.3, 0.5], elasticity: [-3, 0], shock: [-0.2, 0.3], share: [0, 1], cover: [1, 60], carry: [0, 0.25] } as const;

/** What a step rests on. `decision`: a lever applied to recorded volumes. `external`: a supposed outside change,
 * applied by arithmetic. `assumed`: depends on a behavioural premise the data cannot check. */
export type Basis = 'decision' | 'external' | 'assumed';
export type StepKey = 'price' | 'volume' | 'cost' | 'recovery';
export const STEP_BASIS: Record<StepKey, Basis> = { price: 'decision', volume: 'assumed', cost: 'external', recovery: 'assumed' };

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));

const NO_SALES: ItemSales = { revenue: 0, profit: 0, units: 0, lossLines: 0, loss: 0, ordered: 0, unmet: 0 };
/** an item without a sales record sold nothing */
const sales = (i: StockItem) => i.sales ?? NO_SALES;

/** Items with a whole-life negative recorded profit (the Lab's "structural" loss pattern). */
const isStructural = (i: StockItem) => sales(i).profit < 0;
export function inScope(scope: Scope, i: StockItem) {
  return scope.kind === 'all' ? true : scope.kind === 'family' ? i.c === scope.c : isStructural(i);
}

export type Totals = { revenue: number; cogs: number; profit: number; margin: number };
const totals = (revenue: number, cogs: number): Totals => ({ revenue, cogs, profit: revenue - cogs, margin: div(revenue - cogs, revenue) });

/** The recorded baseline, from item sales (equal to the sales facts; a test checks the reconciliation). */
export function baseline(ds: SupplyChainDataset): Totals {
  const revenue = sum(ds.items, (i) => sales(i).revenue), profit = sum(ds.items, (i) => sales(i).profit);
  return { revenue, cogs: revenue - profit, profit, margin: div(profit, revenue) };
}

/**
 * Run one scenario. Per item (R revenue, K cost of sales, p price change, f = (1+p)^e volume factor, k cost change):
 *   price step     +R·p                       (recorded volume at the new price)
 *   volume step    (f−1)·(R(1+p) − K)         (the assumed volume response, at the new price and old cost)
 *   cost step      −f·K·k                     (the supplier change on the volume that remains)
 *   recovery step  X·(P(1+p) − C(1+k)), X = share·unmet·f  (unpicked units, at the scenario price and cost)
 * The steps are taken in this fixed order, so each is counted once and they sum exactly to the change in
 * gross profit; a different order would split the interaction terms differently (see `method`).
 */
function profitLedger(ds: SupplyChainDataset, raw: Scenario) {
  const sc = normalise(raw);
  const base = baseline(ds);
  const step: Record<StepKey, number> = { price: 0, volume: 0, cost: 0, recovery: 0 };
  let revenue = 0, cogs = 0, touched = 0, recoveredUnits = 0, passThroughPrice = 0;
  for (const i of ds.items) {
    const s = sales(i), R = s.revenue, K = s.revenue - s.profit, U = s.units;
    const supplied = sc.supplier.s !== null && i.s === sc.supplier.s;
    const k = supplied ? sc.supplier.shock : 0;
    // unit price and cost: realised from sales where the item sold, else the item master
    const P = U > 0 ? R / U : i.unitPrice ?? 0, C = U > 0 ? K / U : i.unitCost;
    const pass = supplied && P > 0 ? (sc.supplier.passThrough * k * C) / P : 0;
    const p = (inScope(sc.price.scope, i) ? sc.price.change : 0) + pass;
    const f = p === 0 || sc.elasticity === 0 ? 1 : Math.pow(1 + p, sc.elasticity);
    const X = inScope(sc.recovery.scope, i) ? sc.recovery.share * s.unmet * f : 0;
    if (p !== 0 || k !== 0 || X !== 0) touched++;
    step.price += R * p;
    passThroughPrice += R * pass;
    step.volume += (f - 1) * (R * (1 + p) - K);
    step.cost -= f * K * k;
    step.recovery += X * (P * (1 + p) - C * (1 + k));
    revenue += f * R * (1 + p) + X * P * (1 + p);
    cogs += f * K * (1 + k) + X * C * (1 + k);
    recoveredUnits += X;
  }
  // at rest, return the recorded totals untouched (no floating-point drift)
  const atRest = touched === 0;
  const result = atRest ? { ...base } : totals(revenue, cogs);
  const steps = (Object.keys(step) as StepKey[]).map((key) => ({ key, basis: STEP_BASIS[key], delta: atRest ? 0 : step[key] }));
  return { sc, base, result, steps, touched, recoveredUnits, passThroughPrice: atRest ? 0 : passThroughPrice };
}

/** Scenario gross profit only, without the separate ledgers: what sensitivity sweeps need, ~40 times per redraw. */
export const scenarioProfit = (ds: SupplyChainDataset, sc: Scenario) => profitLedger(ds, sc).result.profit;

/**
 * Run one scenario: the gross-profit bridge plus the separate ledgers (purchase spend, inventory capital, holding
 * cost) and the price break-even. The ledgers are reported beside gross profit, never added to it.
 */
export function simulate(ds: SupplyChainDataset, raw: Scenario = BASELINE) {
  const { sc, base, result, steps, touched, recoveredUnits, passThroughPrice } = profitLedger(ds, raw);
  return {
    scenario: sc, baseline: base, result, delta: result.profit - base.profit, steps, touched, recoveredUnits,
    /** the part of the price step that comes from passing on a supplier cost change (a share of steps[price], not extra) */
    passThroughPrice,
    /** stock on hand at cost, recorded: the inventory ledger before any policy */
    stock: sum(ds.items, (i) => i.onHand * i.unitCost),
    load: assumptionLoad(steps),
    spend: spendLedger(ds, sc), inventory: inventoryLedger(ds, sc),
    breakEven: breakEven(ds, sc.price.scope, sc.price.change),
  };
}

/**
 * Assumption load = Σ|assumed steps| ÷ Σ|all steps|: the share of the bridge's total movement that rests on a
 * behavioural premise (the volume response; the premise that unpicked units would have sold). 0 means the
 * result is arithmetic on recorded volumes; 1 means all of it rests on premises. It is not a confidence level.
 */
export function assumptionLoad(steps: { basis: Basis; delta: number }[]) {
  const total = sum(steps, (s) => Math.abs(s.delta));
  const by = (b: Basis) => sum(steps.filter((s) => s.basis === b), (s) => Math.abs(s.delta));
  return { total, assumed: by('assumed'), decision: by('decision'), external: by('external'), share: div(by('assumed'), total) };
}

/**
 * Break-even for the price lever alone. A uniform price change p on a scope with recorded revenue R and gross profit M,
 * with every unit's volume scaled by f = 1 + v, gives scenario profit f·A where A = M + p·R (the scope's profit at the new
 * price on recorded volume). Profit matches the recorded M where f = M / A, so the signs of A and M decide the reading:
 *  - floor   (A > 0, M > 0): profit holds while v ≥ M/A − 1. Negative: volume may fall that far. Positive: it must rise.
 *  - ceiling (A < 0, M < 0): every unit still sells below cost, so fewer units lose less. Profit holds while v ≤ M/A − 1.
 *            Positive: volume may rise that far (the loss per unit shrank). Negative: it must fall at least that far.
 *  - always  (A ≥ 0, M ≤ 0): the scope stops losing money, so profit is at or above recorded at any volume.
 *  - never   (A ≤ 0, M ≥ 0, not both 0): the scope now loses (or earns nothing), so no volume keeps the recorded profit.
 * The elasticity at the threshold is ln(1+v) / ln(1+p) where defined.
 */
export type BreakEvenKind = 'none' | 'floor' | 'ceiling' | 'always' | 'never';
export type BreakEven = { kind: BreakEvenKind; revenue: number; profit: number; margin: number; profitAtPrice: number; volumeChange: number; elasticity: number | null };
export function breakEven(ds: SupplyChainDataset, scope: Scope, p: number): BreakEven {
  const items = ds.items.filter((i) => inScope(scope, i) && sales(i).units > 0);
  const R = sum(items, (i) => sales(i).revenue), M = sum(items, (i) => sales(i).profit), A = M + p * R;
  const base = { revenue: R, profit: M, margin: div(M, R), profitAtPrice: A, volumeChange: 0, elasticity: null as number | null };
  if (!p || !R) return { ...base, kind: 'none' };
  if (A >= 0 && M <= 0) return { ...base, kind: 'always' };
  if (A <= 0 && M >= 0) return { ...base, kind: 'never' };
  const v = M / A - 1;
  const e = 1 + v > 0 && 1 + p > 0 ? Math.log(1 + v) / Math.log(1 + p) : null;
  return { ...base, kind: A > 0 ? 'floor' : 'ceiling', volumeChange: v, elasticity: e };
}

/** The price change that brings a scope's recorded gross profit to exactly zero (−m; for a loss-making scope, a rise). */
export function priceToBreakEven(ds: SupplyChainDataset, scope: Scope) {
  const items = ds.items.filter((i) => inScope(scope, i) && sales(i).units > 0);
  return div(-sum(items, (i) => sales(i).profit), sum(items, (i) => sales(i).revenue));
}

/** Purchase-spend ledger: the supplier change applied to its recorded purchase orders. Never added to gross profit. */
function spendLedger(ds: SupplyChainDataset, sc: Scenario) {
  const total = sum(ds.purchaseOrders, (p) => p.spend);
  const supplier = sc.supplier.s === null ? 0 : sum(ds.purchaseOrders.filter((p) => p.s === sc.supplier.s), (p) => p.spend);
  return { total, supplier, delta: supplier * sc.supplier.shock };
}

/** Inventory-capital ledger (and the optional holding cost). Never added to gross profit. */
function inventoryLedger(ds: SupplyChainDataset, sc: Scenario) {
  if (sc.inventory.cover === null) return null;
  const r = stockCapital(ds, sc.inventory.cover);
  const rate = sc.inventory.carryRate;
  return {
    cover: sc.inventory.cover, capital: r.value, released: r.excess, share: r.excessShare, kept: r.value - r.excess,
    /** annual, at the chosen carrying rate; null when the rate is disabled */
    holdingNow: rate === null ? null : r.value * rate, holdingAvoided: rate === null ? null : r.excess * rate,
    /** recorded gross profit per year, for scale only: holding cost is never subtracted from it here */
    annualProfit: div(baseline(ds).profit, ds.months.length) * 12,
  };
}

/** The assumptions the sensitivity view can sweep, with their full lever ranges. */
export type SensKey = 'elasticity' | 'share' | 'shock' | 'passThrough';
export const SENS_RANGE: Record<SensKey, readonly [number, number]> = { elasticity: LIMITS.elasticity, share: LIMITS.share, shock: LIMITS.shock, passThrough: [0, 1] };
export const valueOf = (sc: Scenario, key: SensKey) => (key === 'elasticity' ? sc.elasticity : key === 'share' ? sc.recovery.share : key === 'shock' ? sc.supplier.shock : sc.supplier.passThrough);
export function withValue(sc: Scenario, key: SensKey, v: number): Scenario {
  if (key === 'elasticity') return { ...sc, elasticity: v };
  if (key === 'share') return { ...sc, recovery: { ...sc.recovery, share: v } };
  return { ...sc, supplier: { ...sc.supplier, [key]: v } };
}
/** Which assumptions can move this scenario's gross profit at all (a sweep of the others would be flat). */
export function sensitiveKeys(sc: Scenario): SensKey[] {
  const supplier = sc.supplier.s !== null;
  const priced = sc.price.change !== 0 || (supplier && sc.supplier.shock !== 0 && sc.supplier.passThrough > 0);
  return (['elasticity', 'share', 'shock', 'passThrough'] as SensKey[]).filter((k) =>
    k === 'elasticity' ? priced : k === 'share' ? true : k === 'shock' ? supplier : supplier && sc.supplier.shock !== 0);
}

/** Profit across a range of values of one assumption: sensitivity to that assumption, not a prediction interval. */
export function sensitivity(ds: SupplyChainDataset, sc: Scenario, key: SensKey, values: number[]) {
  return values.map((value) => ({ value, profit: scenarioProfit(ds, withValue(sc, key, value)) }));
}

/**
 * One-at-a-time sweep of each relevant assumption across its full range, the others held at their current values.
 * The bars show how far each assumption alone can move the result; they are not combined, and the spread is not a
 * probability range.
 */
export function tornado(ds: SupplyChainDataset, sc: Scenario) {
  const now = scenarioProfit(ds, sc);
  return sensitiveKeys(sc).map((key) => {
    const [lo, hi] = SENS_RANGE[key];
    const [pLo, pHi] = sensitivity(ds, sc, key, [lo, hi]).map((x) => x.profit);
    return { key, lo, hi, now, profitAtLo: pLo, profitAtHi: pHi, min: Math.min(pLo, pHi, now), max: Math.max(pLo, pHi, now), swing: Math.abs(pHi - pLo) };
  }).sort((a, b) => b.swing - a.swing);
}

/**
 * Premises behind a scenario, whatever its assumption load. The list is never empty: even at rest the result assumes
 * the recorded period as it was. A load of 0 means none of the movement depends on a behavioural premise; it does
 * not mean the scenario has no assumptions or that its result is certain.
 */
export type Premise = 'recorded' | 'volume' | 'recovery' | 'shock' | 'passThrough' | 'cover' | 'carry';
export function premises(sc: Scenario): Premise[] {
  const out: Premise[] = ['recorded'];
  const supplier = sc.supplier.s !== null && sc.supplier.shock !== 0;
  if (sc.price.change !== 0 || (supplier && sc.supplier.passThrough > 0)) out.push('volume');
  if (sc.recovery.share > 0) out.push('recovery');
  if (supplier) out.push('shock');
  if (supplier && sc.supplier.passThrough > 0) out.push('passThrough');
  if (sc.inventory.cover !== null) out.push('cover');
  if (sc.inventory.cover !== null && sc.inventory.carryRate !== null) out.push('carry');
  return out;
}

/** Each supplier's footprint in the two ledgers a cost shock touches: cost of sales on its items, and purchase orders. */
export function supplierExposure(ds: SupplyChainDataset) {
  return ds.suppliers.map((sp) => {
    const items = ds.items.filter((i) => i.s === sp.id);
    return {
      s: sp.id, label: sp.label, items: items.length,
      cogs: sum(items, (i) => sales(i).revenue - sales(i).profit), revenue: sum(items, (i) => sales(i).revenue),
      spend: sum(ds.purchaseOrders.filter((p) => p.s === sp.id), (p) => p.spend),
    };
  });
}

/** Clamp every lever to its range, so a hand-edited URL cannot produce a nonsense scenario. */
export function normalise(sc: Scenario): Scenario {
  const scope = (s: Scope | undefined): Scope => (s && (s.kind === 'all' || s.kind === 'structural' || (s.kind === 'family' && Number.isInteger(s.c))) ? s : { kind: 'all' });
  return {
    v: 1,
    price: { scope: scope(sc.price?.scope), change: clamp(sc.price?.change ?? 0, LIMITS.price) },
    elasticity: clamp(sc.elasticity ?? 0, LIMITS.elasticity),
    supplier: { s: Number.isInteger(sc.supplier?.s) ? (sc.supplier.s as number) : null, shock: clamp(sc.supplier?.shock ?? 0, LIMITS.shock), passThrough: clamp(sc.supplier?.passThrough ?? 0, [0, 1]) },
    recovery: { scope: scope(sc.recovery?.scope), share: clamp(sc.recovery?.share ?? 0, LIMITS.share) },
    inventory: { cover: sc.inventory?.cover == null ? null : clamp(sc.inventory.cover, LIMITS.cover), carryRate: sc.inventory?.carryRate == null ? null : clamp(sc.inventory.carryRate, LIMITS.carry) },
  };
}

/**
 * Fit a (possibly hand-edited) scenario to the dataset: an unknown supplier, or one with no items, is dropped with
 * its shock; a family index that does not exist falls back to every item. Ranges are already clamped by normalise.
 */
export function fitTo(ds: SupplyChainDataset, raw: Scenario): Scenario {
  const sc = normalise(raw);
  const scope = (x: Scope): Scope => (x.kind === 'family' && !(x.c >= 0 && x.c < ds.categories.length) ? { kind: 'all' } : x);
  const known = sc.supplier.s !== null && ds.items.some((i) => i.s === sc.supplier.s);
  return { ...sc, price: { ...sc.price, scope: scope(sc.price.scope) }, recovery: { ...sc.recovery, scope: scope(sc.recovery.scope) }, supplier: known ? sc.supplier : { s: null, shock: 0, passThrough: 0 } };
}

/* ---------------------------------------------------------------- URL state (shareable, nothing stored) */
const scopeOut = (s: Scope) => (s.kind === 'family' ? `f${s.c}` : s.kind === 'structural' ? 's' : 'a');
const scopeIn = (v: string | null): Scope => (v === 's' ? { kind: 'structural' } : v && /^f\d{1,3}$/.test(v) ? { kind: 'family', c: Number(v.slice(1)) } : { kind: 'all' });
/** a finite number, or null for anything else ('', 'abc', 'Infinity'), so garbage falls back to the baseline lever */
const num = (v: string | null) => { if (v === null || v.trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

/** Encode only the levers that differ from the baseline. A prefix keeps a second scenario (A in an A/B comparison) apart. */
export function toParams(sc: Scenario, prefix = ''): Record<string, string> {
  const o: Record<string, string> = {};
  if (sc.price.change) { o.p = String(+sc.price.change.toFixed(4)); o.ps = scopeOut(sc.price.scope); }
  if (sc.elasticity) o.e = String(+sc.elasticity.toFixed(2));
  if (sc.recovery.share) { o.r = String(+sc.recovery.share.toFixed(3)); o.rs = scopeOut(sc.recovery.scope); }
  if (sc.supplier.s !== null && sc.supplier.shock) { o.s = String(sc.supplier.s); o.k = String(+sc.supplier.shock.toFixed(4)); if (sc.supplier.passThrough) o.pt = String(+sc.supplier.passThrough.toFixed(3)); }
  if (sc.inventory.cover !== null) o.cv = String(sc.inventory.cover);
  if (sc.inventory.carryRate !== null) o.cr = String(+sc.inventory.carryRate.toFixed(3));
  return prefix ? Object.fromEntries(Object.entries(o).map(([k, v]) => [prefix + k, v])) : o;
}
export function fromParams(raw: (k: string) => string | null, prefix = ''): Scenario {
  const get = (k: string) => raw(prefix + k);
  return normalise({
    v: 1,
    price: { scope: scopeIn(get('ps')), change: num(get('p')) ?? 0 },
    elasticity: num(get('e')) ?? 0,
    supplier: { s: num(get('s')), shock: num(get('k')) ?? 0, passThrough: num(get('pt')) ?? 0 },
    recovery: { scope: scopeIn(get('rs')), share: num(get('r')) ?? 0 },
    inventory: { cover: num(get('cv')), carryRate: num(get('cr')) },
  });
}
