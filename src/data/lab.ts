import type { SupplyChainDataset, StockItem, ItemSales } from './types';
import { sum, div, median, cover } from './measures';

/**
 * Analytics Lab: the five instruments' calculations. Pure functions over one validated dataset (real or demo),
 * no DOM, no hard-coded results: every figure on the Lab page is computed here from the selected dataset.
 * `scripts/test-lab.mjs` checks the formulas on hand-built cases and cross-checks the real dataset against the
 * independent audit (docs/dw-integration-audit.md).
 *
 * Each result separates what the data shows (`evidence`) from what it cannot show; wording that interprets a
 * result lives in the Lab content, which labels it as finding, hypothesis or recommendation.
 * Strip-types compatible (Node runs this file directly): no enums, no parameter properties.
 */

/* ------------------------------------------------------------------ helpers */

type Sold = StockItem & { sales: ItemSales };
const sold = (ds: SupplyChainDataset): Sold[] => ds.items.filter((i): i is Sold => !!i.sales);

/** Linear-interpolation quantile (the common "type 7" definition). 0 for an empty list. */
export function quantile(values: number[], q: number): number {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return 0;
  const pos = (s.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** Population standard deviation. */
export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = sum(values, (v) => v) / values.length;
  return Math.sqrt(sum(values, (v) => (v - m) ** 2) / values.length);
}

/** Herfindahl-Hirschman index of a set of shares (0-1 scale; 1 = a single supplier). */
export const hhi = (shares: number[]) => sum(shares, (s) => s * s);

/** Complete calendar years in the coverage (the real coverage ends in May 2016). */
const completeYears = (ds: SupplyChainDataset) => new Set(ds.years.filter((y) => ds.months.filter((m) => m.y === y).length === 12));

/* ------------------------------------------------------------------ 1. ABC x margin */

export type AbcClass = 'A' | 'B' | 'C';
export type AbcBasis = 'revenue' | 'profit';
/** Cumulative-share cut-offs. An item is in A while the running share, including the item itself, is <= a. */
export const ABC_THRESHOLDS = { a: 0.8, b: 0.95 } as const;

/**
 * Pareto (ABC) classes by lifetime revenue or recorded profit, crossed with item margin.
 * Items are ranked descending; ties keep the dataset order (stable sort). On the profit basis, items with
 * zero or negative total profit contribute nothing to the cumulative share and are always C (`negative` marks
 * them). Margin split: above or below the median margin of items that sold (`marginCut`).
 */
export function abcMatrix(ds: SupplyChainDataset, basis: AbcBasis = 'revenue', t: { a: number; b: number } = ABC_THRESHOLDS) {
  const items = sold(ds);
  const value = (i: Sold) => Math.max(0, basis === 'revenue' ? i.sales.revenue : i.sales.profit);
  const total = sum(items, value);
  const ranked = items.slice().sort((x, y) => value(y) - value(x));
  const withRevenue = items.filter((i) => i.sales.revenue > 0);
  const marginCut = median(withRevenue.map((i) => div(i.sales.profit, i.sales.revenue)));
  const eps = 1e-9;
  let run = 0;
  const rows = ranked.map((i, rank) => {
    run += value(i);
    const cum = div(run, total);
    const cls: AbcClass = value(i) <= 0 ? 'C' : cum <= t.a + eps ? 'A' : cum <= t.b + eps ? 'B' : 'C';
    const margin = i.sales.revenue > 0 ? div(i.sales.profit, i.sales.revenue) : null;
    return {
      id: i.id, label: i.label, c: i.c, rank, cls,
      revenue: i.sales.revenue, profit: i.sales.profit, units: i.sales.units,
      share: div(value(i), total), cum, margin,
      highMargin: margin !== null && margin >= marginCut, negative: i.sales.profit <= 0, lossLines: i.sales.lossLines,
    };
  });
  const classes = (['A', 'B', 'C'] as AbcClass[]).map((cls) => {
    const r = rows.filter((x) => x.cls === cls);
    return {
      cls, items: r.length, itemShare: div(r.length, rows.length),
      revenue: sum(r, (x) => x.revenue), profit: sum(r, (x) => x.profit),
      valueShare: div(sum(r, (x) => Math.max(0, basis === 'revenue' ? x.revenue : x.profit)), total),
      margin: div(sum(r, (x) => x.profit), sum(r, (x) => x.revenue)),
      high: r.filter((x) => x.highMargin).length, low: r.filter((x) => !x.highMargin).length,
    };
  });
  const top20 = Math.round(rows.length * 0.2);
  return {
    basis, thresholds: { ...t }, total, marginCut, rows, classes,
    /** share of the basis value earned by the top 20% of items: the classic Pareto check */
    pareto: { items: top20, share: div(sum(rows.slice(0, top20), (x) => Math.max(0, basis === 'revenue' ? x.revenue : x.profit)), total) },
    unsold: ds.items.length - items.length,
  };
}

/* ------------------------------------------------------------------ 2. Loss-line anatomy */

/**
 * Where the negative-profit invoice lines sit. Facts only: which items and families, how concentrated, and
 * when. The dataset holds recorded profit, not the cost or price at the time of each sale, so it cannot say
 * why a line lost money; the Lab presents causes as hypotheses.
 */
export type LossPattern = 'structural' | 'sporadic';
export function lossAnatomy(ds: SupplyChainDataset) {
  const items = sold(ds);
  const loss = sum(items, (i) => i.sales.loss), lines = sum(items, (i) => i.sales.lossLines);
  const losers = items.filter((i) => i.sales.lossLines > 0).sort((a, b) => b.sales.lossLines - a.sales.lossLines || b.sales.loss - a.sales.loss);
  let run = 0;
  const rows = losers.map((i) => {
    run += i.sales.lossLines;
    return {
      id: i.id, label: i.label, c: i.c, lines: i.sales.lossLines, loss: i.sales.loss,
      lineShare: div(i.sales.lossLines, lines), lossShare: div(i.sales.loss, loss), cumLines: div(run, lines),
      revenue: i.sales.revenue, profit: i.sales.profit, margin: div(i.sales.profit, i.sales.revenue),
      /** the item loses money over its whole life, not only on some lines */
      netNegative: i.sales.profit < 0,
      /** structural: the item loses money over its whole life; sporadic: profitable overall, some lines lost */
      pattern: (i.sales.profit < 0 ? 'structural' : 'sporadic') as LossPattern,
      /** master-data snapshot: current list price below the last recorded cost price */
      belowCost: i.unitPrice !== undefined && i.unitPrice < i.unitCost, unitPrice: i.unitPrice ?? null, unitCost: i.unitCost,
    };
  });
  /** fewest items that together hold at least 80% of the loss lines */
  const k80 = rows.findIndex((r) => r.cumLines >= 0.8 - 1e-9) + 1;
  const families = ds.categories.map((label, c) => {
    const r = rows.filter((x) => x.c === c);
    return { c, label, items: r.length, lines: sum(r, (x) => x.lines), loss: sum(r, (x) => x.loss), lineShare: div(sum(r, (x) => x.lines), lines) };
  }).filter((f) => f.items > 0).sort((a, b) => b.lines - a.lines);
  const byMonth = ds.months.map((m) => {
    const f = ds.facts.filter((x) => x.mi === m.i);
    return { mi: m.i, lines: sum(f, (x) => x.lossLines), loss: sum(f, (x) => x.loss) };
  });
  return {
    total: { loss, lines, items: rows.length, itemsSold: items.length, netNegative: rows.filter((r) => r.netNegative).length, profit: sum(items, (i) => i.sales.profit) },
    patterns: (['structural', 'sporadic'] as LossPattern[]).map((p) => { const r = rows.filter((x) => x.pattern === p); return { pattern: p, items: r.length, lines: sum(r, (x) => x.lines), loss: sum(r, (x) => x.loss), lineShare: div(sum(r, (x) => x.lines), lines), belowCost: r.filter((x) => x.belowCost).length, margin: div(sum(r, (x) => x.profit), sum(r, (x) => x.revenue)) }; }),
    rows, k80: rows.length ? k80 : 0,
    /** the share of loss lines those k80 items actually hold: 80% is the cut-off, this is where the count lands */
    k80Share: rows.length && k80 ? rows[k80 - 1].cumLines : 0,
    /** whether the k80 items are exactly the structural ones (so the two shares describe the same items) */
    k80Structural: rows.length > 0 && k80 > 0 && rows.slice(0, k80).every((x) => x.pattern === 'structural') && rows.filter((x) => x.pattern === 'structural').length === k80,
    families, byMonth,
    /** months with at least one loss line: persistent losses point away from a one-off event */
    activeMonths: byMonth.filter((m) => m.lines > 0).length, months: ds.months.length,
  };
}

/* ------------------------------------------------------------------ 3. Fulfilment leakage */

/**
 * Ordered units that were never picked, and backorders. Unmet units are counted in the order month.
 * `unpickedValue` prices each item's unmet units at its current list price: an estimate of the value of
 * demand that was not filled, NOT confirmed lost revenue (the dataset cannot show whether customers re-ordered
 * or cancelled).
 *
 * Timing test: if the shortfall were only orders still open when the extract was taken, it would sit in the
 * final months. `tail` compares the share of unmet units in the last `tailMonths` months with the share of
 * ordered units in the same months (ratio ~1 = spread like demand; >>1 = end-of-extract effect).
 */
export function leakage(ds: SupplyChainDataset, tailMonths = 3) {
  const complete = completeYears(ds);
  const ordered = sum(ds.facts, (x) => x.ordered), unmet = sum(ds.facts, (x) => x.unmet);
  const years = ds.years.map((y) => {
    const f = ds.facts.filter((x) => ds.months[x.mi]?.y === y);
    const o = ds.orderFacts.filter((x) => ds.months[x.mi]?.y === y);
    const u = sum(f, (x) => x.unmet), od = sum(f, (x) => x.ordered);
    return {
      year: y, complete: complete.has(y), ordered: od, unmet: u, rate: div(u, od), share: div(u, unmet),
      orders: sum(o, (x) => x.orders), backorders: sum(o, (x) => x.backorders), backorderRate: div(sum(o, (x) => x.backorders), sum(o, (x) => x.orders)),
    };
  });
  const families = ds.categories.map((label, c) => {
    const f = ds.facts.filter((x) => x.c === c);
    const its = sold(ds).filter((i) => i.c === c && i.sales.unmet > 0);
    const u = sum(f, (x) => x.unmet), od = sum(f, (x) => x.ordered);
    return { c, label, ordered: od, unmet: u, rate: div(u, od), share: div(u, unmet), value: sum(its, (i) => i.sales.unmet * (i.unitPrice ?? 0)) };
  }).filter((f) => f.ordered > 0).sort((a, b) => b.unmet - a.unmet);
  const items = sold(ds).filter((i) => i.sales.unmet > 0).map((i) => ({
    id: i.id, label: i.label, c: i.c, unmet: i.sales.unmet, ordered: i.sales.ordered, rate: div(i.sales.unmet, i.sales.ordered),
    value: i.sales.unmet * (i.unitPrice ?? 0), priced: i.unitPrice !== undefined,
  })).sort((a, b) => b.value - a.value || b.unmet - a.unmet);
  const months = ds.months.map((m) => {
    const f = ds.facts.filter((x) => x.mi === m.i);
    const u = sum(f, (x) => x.unmet), od = sum(f, (x) => x.ordered);
    return { mi: m.i, y: m.y, m: m.m, ordered: od, unmet: u, rate: div(u, od) };
  });
  const n = Math.min(tailMonths, ds.months.length), from = ds.months.length - n;
  const tailF = ds.facts.filter((x) => x.mi >= from);
  const unmetShare = div(sum(tailF, (x) => x.unmet), unmet), orderedShare = div(sum(tailF, (x) => x.ordered), ordered);
  const orders = sum(ds.orderFacts, (x) => x.orders), backorders = sum(ds.orderFacts, (x) => x.backorders);
  return {
    ordered, unmet, rate: div(unmet, ordered), fill: ordered ? 1 - div(unmet, ordered) : 0,
    orders, backorders, backorderRate: div(backorders, orders),
    unpickedValue: sum(items, (i) => i.value), unpricedItems: items.filter((i) => !i.priced).length,
    years, months, yearsWithShortfall: years.filter((y) => y.unmet > 0).length,
    families, items,
    tail: { months: n, unmetShare, orderedShare, ratio: div(unmetShare, orderedShare) },
  };
}

/* ------------------------------------------------------------------ 4. Supplier dependence */

/**
 * Purchasing concentration and lead-time spread. Concentration uses spend and PO count (HHI on 0-1 shares;
 * descriptive only; 0.25 is a market-competition convention shown as a reference mark, not a validated procurement risk threshold). Lead time is order date to final receipt, per
 * purchase order. `flat` flags a lead-time distribution too narrow to rank suppliers on punctuality.
 */
export const HHI_HIGH = 0.25;
export function supplierDependence(ds: SupplyChainDataset) {
  const pos = ds.purchaseOrders;
  const totalSpend = sum(pos, (p) => p.spend), totalPos = pos.length;
  const rows = ds.suppliers.map((s, idx) => {
    const r = pos.filter((p) => p.s === idx);
    const got = r.filter((p) => p.leadDays !== null);
    const leads = got.map((p) => p.leadDays as number);
    return {
      s: idx, label: s.label, group: s.group, promise: s.promise,
      pos: r.length, spend: sum(r, (p) => p.spend), spendShare: div(sum(r, (p) => p.spend), totalSpend), poShare: div(r.length, totalPos),
      received: got.length, leadMedian: leads.length ? median(leads) : null,
      onTime: got.length ? div(got.filter((p) => p.onTime).length, got.length) : null,
    };
  }).sort((a, b) => b.spend - a.spend || b.pos - a.pos);
  const active = rows.filter((r) => r.pos > 0);
  const got = pos.filter((p) => p.leadDays !== null);
  const leads = got.map((p) => p.leadDays as number);
  const gaps = got.map((p) => p.expectedDays - (p.leadDays as number));
  const top2 = active.slice(0, 2);
  // who supplies each product family (the item master names one supplier per item)
  const families = ds.categories.map((label, c) => {
    const its = ds.items.filter((i) => i.c === c);
    const sup = [...new Set(its.map((i) => i.s).filter((v): v is number => v !== null && v !== undefined))].sort((a, b) => a - b);
    return { c, label, items: its.length, suppliers: sup, revenue: sum(ds.facts.filter((x) => x.c === c), (x) => x.revenue) };
  }).filter((f) => f.items > 0);
  const spendHhi = hhi(active.map((r) => r.spendShare)), poHhi = hhi(active.map((r) => r.poShare));
  const lead = {
    n: leads.length, min: leads.length ? Math.min(...leads) : 0, max: leads.length ? Math.max(...leads) : 0,
    p10: quantile(leads, 0.1), median: quantile(leads, 0.5), p90: quantile(leads, 0.9), sd: stdev(leads),
    /** days early against the promised date (expected minus actual), median over received POs */
    earlyMedian: quantile(gaps, 0.5),
    onTime: div(got.filter((p) => p.onTime).length, got.length),
    hist: [...new Set(leads)].sort((a, b) => a - b).map((d) => ({ days: d, pos: leads.filter((v) => v === d).length })),
  };
  return {
    listed: ds.suppliers.length, active: active.length, rows, totalSpend, totalPos, pending: totalPos - got.length,
    families, singleSourced: families.filter((f) => f.suppliers.length === 1),
    singleSourcedRevenue: div(sum(families.filter((f) => f.suppliers.length === 1), (f) => f.revenue), sum(families, (f) => f.revenue)),
    top2: { labels: top2.map((r) => r.label), spendShare: sum(top2, (r) => r.spendShare), poShare: sum(top2, (r) => r.poShare) },
    hhi: { spend: spendHhi, pos: poHhi, high: spendHhi > HHI_HIGH },
    lead, flat: lead.n > 0 && (lead.max - lead.min <= 3 || lead.sd < 1),
  };
}

/* ------------------------------------------------------------------ 5. Capital in stock */

/** Months-of-cover bands for the distribution (log-like steps); the last band is open-ended. */
export const COVER_BANDS = [0, 1, 3, 6, 12, 24, 60, 120, 240, 600] as const;

/**
 * The stock snapshot against recent demand. Cover = on hand / average monthly use (measures.cover); items
 * with no recorded use have unbounded cover and are counted apart. `excess` is the value at cost of units
 * beyond `months` of cover, the capital a visitor-chosen policy would release. Snapshot only: the dataset
 * has no stock history, and the sample's holdings do not reconcile with its movements.
 */
export function stockCapital(ds: SupplyChainDataset, months = 12) {
  const rows = ds.items.map((i) => {
    const cv = cover(i), value = i.onHand * i.unitCost;
    const keep = i.monthlyUse * months;
    const excessUnits = Math.max(0, i.onHand - keep);
    return { id: i.id, label: i.label, c: i.c, cover: cv, value, keep: Math.min(i.onHand, keep) * i.unitCost, excess: excessUnits * i.unitCost, atReorder: i.onHand <= i.reorder, noUse: !(i.monthlyUse > 0) };
  });
  const covers = rows.map((r) => r.cover).filter(Number.isFinite);
  const value = sum(rows, (r) => r.value), excess = sum(rows, (r) => r.excess);
  const bands = COVER_BANDS.map((lo, k) => {
    const hi = k + 1 < COVER_BANDS.length ? COVER_BANDS[k + 1] : Infinity;
    const r = rows.filter((x) => Number.isFinite(x.cover) && x.cover >= lo && x.cover < hi);
    return { from: lo, to: hi, items: r.length, value: sum(r, (x) => x.value), excess: sum(r, (x) => x.excess) };
  });
  const rev = sum(ds.facts, (x) => x.revenue);
  return {
    months, items: rows.length, value, excess, excessShare: div(excess, value),
    families: ds.categories.map((label, c) => { const r = rows.filter((x) => x.c === c); return { c, label, items: r.length, value: sum(r, (x) => x.value), excess: sum(r, (x) => x.excess), cover: quantile(r.map((x) => x.cover).filter(Number.isFinite), 0.5) }; }).filter((f) => f.items > 0),
    cover: { p10: quantile(covers, 0.1), median: quantile(covers, 0.5), p90: quantile(covers, 0.9) },
    noUse: rows.filter((r) => r.noUse).length, atReorder: rows.filter((r) => r.atReorder).length,
    bands, rows: rows.sort((a, b) => b.excess - a.excess),
    /** stock at cost against revenue over the whole coverage: a plausibility check on the snapshot */
    valueToRevenue: div(value, rev), coverageMonths: ds.months.length,
  };
}

/* ------------------------------------------------------------------ what the Lab does not do */

/** Gini coefficient of non-negative values (0 = all equal, 1 = one holds everything). */
export function gini(values: number[]): number {
  const v = values.filter((x) => x >= 0).sort((a, b) => a - b);
  const n = v.length, tot = sum(v, (x) => x);
  if (n < 2 || !tot) return 0;
  return sum(v.map((x, i) => (2 * (i + 1) - n - 1) * x), (x) => x) / (n * tot);
}
/** Customer revenue inequality over the whole coverage: low values mean RFM-style tiers would be arbitrary. */
export function customerSpread(ds: SupplyChainDataset) {
  const by = new Map<number, number>();
  ds.customerFacts.forEach((x) => by.set(x.cu, (by.get(x.cu) ?? 0) + x.revenue));
  const v = [...by.values()];
  return { customers: v.length, gini: gini(v), p90p10: div(quantile(v, 0.9), quantile(v, 0.1)) };
}

/* ------------------------------------------------------------------ all instruments */

export type Lab = ReturnType<typeof lab>;
/* ================================================================== forecast check (historical backtest) */
/**
 * A rolling-origin backtest of four transparent baselines on monthly revenue. It is a methodology demo:
 * every forecast is made from data before its origin and scored against the month that followed.
 * Nothing here projects past the last month in the data.
 * - naive: the last observed month; seasonal: the same month a year earlier;
 * - avg3 / avg12: the mean of the last 3 / 12 observed months.
 * The first `warmup` months only feed the models (24, so every model, including the seasonal one, has
 * the same test window). Scores: MAE, MAPE, and MAE relative to the naive baseline (below 1 = better).
 */
export type ForecastModel = 'naive' | 'seasonal' | 'avg3' | 'avg12';
export const FORECAST_MODELS: ForecastModel[] = ['naive', 'seasonal', 'avg3', 'avg12'];
export const FORECAST_HORIZONS = [1, 3];
export const FORECAST_WARMUP = 24;

export function forecastCheck(ds: SupplyChainDataset, warmup = FORECAST_WARMUP) {
  const y = ds.months.map((m) => sum(ds.facts.filter((f) => f.mi === m.i), (f) => f.revenue));
  const mean = (a: number[]) => div(a.reduce((s, v) => s + v, 0), a.length);
  const predict = (model: ForecastModel, o: number, t: number) =>
    model === 'naive' ? y[o - 1] : model === 'seasonal' ? y[t - 12] : model === 'avg3' ? mean(y.slice(o - 3, o)) : mean(y.slice(o - 12, o));
  const horizons = FORECAST_HORIZONS.map((h) => {
    const models = FORECAST_MODELS.map((model) => {
      const points: { t: number; origin: number; forecast: number; actual: number; error: number }[] = [];
      for (let o = Math.max(warmup, 12); o + h <= y.length; o++) {
        const t = o + h - 1, forecast = predict(model, o, t);
        points.push({ t, origin: o, forecast, actual: y[t], error: forecast - y[t] });
      }
      const abs = points.map((p) => Math.abs(p.error));
      return { model, points, mae: mean(abs), mape: mean(points.map((p) => div(Math.abs(p.error), p.actual))), bias: mean(points.map((p) => p.error)) };
    });
    const naive = models.find((m) => m.model === 'naive')!;
    const scored = models.map((m) => ({ ...m, rel: div(m.mae, naive.mae) }));
    const best = scored.filter((m) => m.points.length).sort((a, b) => a.mae - b.mae)[0] ?? null;
    /** models whose error is level with the best at the precision shown (relative MAE to two decimals) */
    const ties = best ? scored.filter((m) => m.points.length && m.rel.toFixed(2) === best.rel.toFixed(2)).map((m) => m.model) : [];
    return { h, n: naive.points.length, models: scored, best, ties, beatsNaive: !!best && best.model !== 'naive' && best.rel < 1 };
  });
  const level = mean(y), sd = stdev(y);
  // average month per calendar year (complete years only), to show the level and its drift plainly
  const years = [...new Set(ds.months.map((m) => m.y))].map((yr) => {
    const v = y.filter((_, i) => ds.months[i].y === yr);
    return { year: yr, months: v.length, avg: mean(v) };
  }).filter((x) => x.months === 12);
  return {
    series: y.map((value, i) => ({ mi: i, value })), warmup, horizons,
    level, cv: div(sd, level), years,
    /** a model counts as skilful only if it beats "last month" at every horizon tested */
    skilful: horizons.every((h) => h.beatsNaive) ? horizons[0].best!.model : null,
  };
}

export function lab(ds: SupplyChainDataset, opts: { basis?: AbcBasis; coverMonths?: number } = {}) {
  return {
    abc: abcMatrix(ds, opts.basis ?? 'revenue'),
    loss: lossAnatomy(ds),
    leakage: leakage(ds),
    suppliers: supplierDependence(ds),
    stock: stockCapital(ds, opts.coverMonths ?? 12),
    forecast: forecastCheck(ds),
  };
}
