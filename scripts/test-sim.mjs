// Decision Simulator engine tests (src/data/sim.ts).
//  1. The recorded baseline is reproduced exactly when no lever moves, and reconciles to the sales facts.
//  2. Each step's arithmetic on a hand-built dataset, step sums, break-even, assumption load.
//  3. Ledger separation: purchase spend and inventory capital never move gross profit.
//  4. Robustness: synthetic and empty datasets, clamped levers, URL round trip.
// Usage: node scripts/test-sim.mjs   Needs no dev server and writes nothing.
import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

register('./ts-hooks.mjs', import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => pathToFileURL(join(ROOT, 'src', p)).href;
const S = await import(src('data/sim.ts'));
const M = await import(src('data/measures.ts'));
const { syntheticDataset } = await import(src('data/synthetic.ts'));
const real = JSON.parse(readFileSync(join(ROOT, 'src/data/verified/dataset.json'), 'utf8'));
const close = (a, b, tol = 1e-9, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg ?? ''} expected ${b}, got ${a}`);
function noNaN(x, path = 'result') {
  if (typeof x === 'number') assert.ok(!Number.isNaN(x), `NaN at ${path}`);
  else if (Array.isArray(x)) x.forEach((v, i) => noNaN(v, `${path}[${i}]`));
  else if (x && typeof x === 'object') Object.entries(x).forEach(([k, v]) => noNaN(v, `${path}.${k}`));
}
const sc = (o = {}) => ({ ...structuredClone(S.BASELINE), ...o });

/** Two items: A (family 0, supplier 0) sells 100 units at 10, cost 6; B (family 1, supplier 1) sells 10 at 5, cost 6 (a loss). */
function tiny() {
  const item = (id, c, s, units, price, cost, unmet) => ({
    id, label: `I${id}`, c, s, reorder: 0, onHand: 120, monthlyUse: units / 12, unitCost: cost, unitPrice: price,
    sales: { revenue: units * price, profit: units * (price - cost), units, lossLines: 0, loss: 0, ordered: units + unmet, unmet },
  });
  return {
    months: Array.from({ length: 12 }, (_, i) => ({ i, y: 2020, m: i, label: `m${i}` })), years: [2020], territories: ['T'], categories: ['F0', 'F1'],
    facts: [], orderFacts: [], customers: [], customerFacts: [], missing: [],
    purchaseOrders: [{ id: 1, mi: 0, s: 0, spend: 1000 }, { id: 2, mi: 0, s: 1, spend: 300 }],
    suppliers: [{ id: 0, label: 'S0', group: 'g', promise: 1 }, { id: 1, label: 'S1', group: 'g', promise: 1 }],
    items: [item(1, 0, 0, 100, 10, 6, 20), item(2, 1, 1, 10, 5, 6, 0)],
  };
}

test('baseline: exact at rest, and reconciles to the sales facts', () => {
  const r = S.simulate(real, S.BASELINE);
  assert.deepEqual(r.result, r.baseline);                                   // bit-for-bit, not just close
  assert.ok(r.steps.every((s) => s.delta === 0)); assert.equal(r.delta, 0); assert.equal(r.load.share, 0);
  close(r.baseline.revenue, M.revenue(real.facts), 1e-12, 'revenue vs facts');
  close(r.baseline.profit, M.grossProfit(real.facts), 1e-12, 'profit vs facts');
  // a lever on an empty scope also leaves the baseline untouched
  const none = S.simulate(real, sc({ price: { scope: { kind: 'family', c: 999 }, change: 0.1 } }));
  assert.deepEqual(none.result, none.baseline);
});

test('price and volume steps: hand-checked arithmetic, steps sum to the change', () => {
  const ds = tiny();
  const r = S.simulate(ds, sc({ price: { scope: { kind: 'all' }, change: 0.1 }, elasticity: -2 }));
  const f = 1.1 ** -2;
  close(r.steps[0].delta, 0.1 * (1000 + 50));                               // +R·p on recorded volume
  close(r.steps[1].delta, (f - 1) * ((1000 * 1.1 - 600) + (50 * 1.1 - 60)));  // assumed volume response
  close(r.result.profit, f * (1100 - 600) + f * (55 - 60));
  close(r.steps.reduce((s, x) => s + x.delta, 0), r.delta);                  // no double counting
  assert.equal(r.steps[0].basis, 'decision'); assert.equal(r.steps[1].basis, 'assumed');
});

test('supplier step and pass-through; purchase spend stays in its own ledger', () => {
  const ds = tiny();
  const r = S.simulate(ds, sc({ supplier: { s: 0, shock: 0.1, passThrough: 0 } }));
  close(r.steps[2].delta, -600 * 0.1);                                       // −K·k for supplier 0 only
  close(r.delta, -60);
  close(r.spend.delta, 100); close(r.spend.supplier, 1000);                  // 10% of supplier 0's purchase orders
  close(r.result.profit, r.baseline.profit - 60);                            // spend never enters gross profit
  // full pass-through at elasticity 0 recovers the cost exactly
  const p = S.simulate(ds, sc({ supplier: { s: 0, shock: 0.1, passThrough: 1 } }));
  close(p.delta, 0, 1e-9);
});

test('recovery step: unmet units at the scenario price and cost, scoped, assumed', () => {
  const ds = tiny();
  const r = S.simulate(ds, sc({ recovery: { scope: { kind: 'family', c: 0 }, share: 0.5 } }));
  close(r.steps[3].delta, 0.5 * 20 * (10 - 6)); close(r.recoveredUnits, 10);
  close(r.load.share, 1);                                                    // all of it rests on a premise
  const both = S.simulate(ds, sc({ price: { scope: { kind: 'all' }, change: 0.1 }, recovery: { scope: { kind: 'all' }, share: 0.5 } }));
  close(both.steps[3].delta, 0.5 * 20 * (11 - 6));                           // recovered at the new price, counted once
  close(both.load.share, both.steps[3].delta / (both.steps[0].delta + both.steps[3].delta));
});

/** scope profit when every unit's volume is scaled by f at price change p (the quantity break-even reasons about) */
const scopeProfit = (ds, scope, p, f) => ds.items.filter((i) => S.inScope(scope, i) && i.sales.units > 0)
  .reduce((s, i) => s + f * (i.sales.revenue * (1 + p) - (i.sales.revenue - i.sales.profit)), 0);
/** brute force: the reported kind and threshold agree with the profit formula on both sides of the threshold */
function checkBreakEven(ds, scope, p) {
  const b = S.breakEven(ds, scope, p), M = scopeProfit(ds, scope, 0, 1), at = (v) => scopeProfit(ds, scope, p, 1 + v);
  const eps = 1e-6 * Math.max(1, Math.abs(M));
  if (b.kind === 'none') return b;
  if (b.kind === 'always') for (const v of [-0.9, -0.3, 0, 0.5, 2]) assert.ok(at(v) >= M - eps, `always fails at v=${v}`);
  if (b.kind === 'never') for (const v of [-0.9, -0.3, 0, 0.5, 2]) assert.ok(at(v) < M + eps, `never fails at v=${v}`);
  if (b.kind === 'floor' || b.kind === 'ceiling') {
    close(at(b.volumeChange), M, 1e-9, `threshold ${b.kind}`);
    const ok = (v) => at(v) >= M - eps;
    const d = 0.01 * Math.max(0.05, Math.abs(b.volumeChange));
    if (b.kind === 'floor') { assert.ok(ok(b.volumeChange + d) && !ok(b.volumeChange - d), 'floor direction'); }
    else { assert.ok(ok(b.volumeChange - d) && !ok(b.volumeChange + d), 'ceiling direction'); }
    if (b.elasticity !== null) close((1 + p) ** b.elasticity - 1, b.volumeChange, 1e-9, 'elasticity maps to the threshold');
  }
  return b;
}

test('break-even: every sign case, including negative-margin scopes, agrees with the profit formula', () => {
  const ds = tiny();
  // A: margin 40%. +5% may lose 11.1% of volume; −5% must gain 14.3%
  const up = checkBreakEven(ds, { kind: 'family', c: 0 }, 0.05);
  assert.equal(up.kind, 'floor'); close(up.volumeChange, -0.05 / (0.4 + 0.05));
  const down = checkBreakEven(ds, { kind: 'family', c: 0 }, -0.05);
  assert.equal(down.kind, 'floor'); assert.ok(down.volumeChange > 0);
  // B sells at 5 against cost 6 (margin −20%)
  assert.equal(checkBreakEven(ds, { kind: 'structural' }, 0.5).kind, 'always');   // lifted above cost
  assert.equal(checkBreakEven(ds, { kind: 'structural' }, 0.2).kind, 'always');   // exactly at cost
  const part = checkBreakEven(ds, { kind: 'structural' }, 0.1);                    // still below cost, loss per unit halves
  assert.equal(part.kind, 'ceiling'); close(part.volumeChange, 1);                 // profit holds unless volume more than doubles
  const cut = checkBreakEven(ds, { kind: 'structural' }, -0.1);                    // deeper loss per unit
  assert.equal(cut.kind, 'ceiling'); assert.ok(cut.volumeChange < 0);              // profit holds only if volume falls enough
  assert.equal(checkBreakEven(ds, { kind: 'family', c: 0 }, -0.4).kind, 'never');  // price cut to cost: no volume keeps profit
  assert.equal(checkBreakEven(ds, { kind: 'family', c: 0 }, -0.5).kind, 'never');
  assert.equal(S.breakEven(ds, { kind: 'all' }, 0).kind, 'none');
  assert.equal(S.breakEven(ds, { kind: 'family', c: 9 }, 0.1).kind, 'none');      // empty scope
  // break-even through the simulator too, where the elasticity is in the lever's range
  const r = S.simulate(ds, sc({ price: { scope: { kind: 'family', c: 0 }, change: 0.05 }, elasticity: up.elasticity }));
  close(r.delta, 0, 1e-9);
  close(S.priceToBreakEven(ds, { kind: 'structural' }), 0.2);
  // real data: every scope over a grid of price changes, and the four loss-making masks in particular
  const scopes = [{ kind: 'all' }, { kind: 'structural' }, ...real.categories.map((_, c) => ({ kind: 'family', c }))];
  for (const scope of scopes) for (const p of [-0.3, -0.1, -0.02, 0.01, 0.03, 0.05, 0.2, 0.5]) checkBreakEven(real, scope, p);
  const p0 = S.priceToBreakEven(real, { kind: 'structural' });
  assert.ok(p0 > 0.05 && p0 < 0.07, String(p0));
  assert.equal(S.breakEven(real, { kind: 'structural' }, 0.03).kind, 'ceiling');   // the masks still sell below cost at +3%
  assert.ok(S.breakEven(real, { kind: 'structural' }, 0.03).volumeChange > 0);     // so their profit rises at recorded volume
  assert.equal(S.breakEven(real, { kind: 'structural' }, p0 + 0.001).kind, 'always');
  close(S.simulate(real, sc({ price: { scope: { kind: 'structural' }, change: p0 } })).result.profit - S.baseline(real).profit, -real.items.filter((i) => i.sales.profit < 0).reduce((s, i) => s + i.sales.profit, 0), 1e-9);
});

test('premises: never empty, and a zero assumption load still lists what is assumed', () => {
  assert.deepEqual(S.premises(S.BASELINE), ['recorded']);
  const p = sc({ price: { scope: { kind: 'all' }, change: 0.05 } });           // elasticity 0: load 0, yet volume is assumed
  const r = S.simulate(real, p);
  assert.equal(r.load.share, 0); assert.ok(r.load.total > 0);
  assert.ok(S.premises(p).includes('volume'));
  assert.ok(S.premises(sc({ supplier: { s: 2, shock: 0.1, passThrough: 0.5 } })).includes('passThrough'));
  assert.deepEqual(S.premises(sc({ inventory: { cover: 6, carryRate: 0.1 } })), ['recorded', 'cover', 'carry']);
});

test('supplier shock: cost-of-sales step and purchase-spend ledger stay apart; exposure reconciles', () => {
  const x = S.supplierExposure(real);
  close(x.reduce((s, e) => s + e.cogs, 0), S.baseline(real).cogs, 1e-9, 'exposure covers all cost of sales');
  close(x.reduce((s, e) => s + e.spend, 0), real.purchaseOrders.reduce((s, p) => s + p.spend, 0), 1e-12);
  const fab = x.find((e) => e.label.startsWith('Fabrikam'));
  const r = S.simulate(real, sc({ supplier: { s: fab.s, shock: 0.1, passThrough: 0 } }));
  close(r.steps.find((s) => s.key === 'cost').delta, -0.1 * fab.cogs, 1e-9);
  close(r.delta, -0.1 * fab.cogs, 1e-9);
  close(r.spend.delta, 0.1 * fab.spend, 1e-12);
  assert.equal(r.steps.find((s) => s.key === 'cost').basis, 'external');
  // pass-through raises the supplier's prices (a decision step); spend is unchanged by it
  const pt = S.simulate(real, sc({ supplier: { s: fab.s, shock: 0.1, passThrough: 1 } }));
  close(pt.delta, 0, 1e-6); close(pt.spend.delta, r.spend.delta, 1e-12);
});

test('inventory: capital released and annual holding cost never enter gross profit', () => {
  const h = S.simulate(real, sc({ inventory: { cover: 12, carryRate: 0.2 } }));
  assert.equal(h.delta, 0); assert.deepEqual(h.result, h.baseline);
  close(h.inventory.kept + h.inventory.released, h.inventory.capital, 1e-12);
  close(h.inventory.holdingNow, h.inventory.capital * 0.2); close(h.inventory.holdingAvoided, h.inventory.released * 0.2);
  close(h.inventory.annualProfit, S.baseline(real).profit / real.months.length * 12);
  const off = S.simulate(real, sc({ inventory: { cover: 12, carryRate: null } }));
  assert.equal(off.inventory.holdingNow, null); assert.equal(off.inventory.holdingAvoided, null);
  // a longer cover keeps more stock, so less is released
  assert.ok(S.simulate(real, sc({ inventory: { cover: 24, carryRate: null } })).inventory.released < off.inventory.released);
});

test('sensitivity and tornado: sweeps one assumption at a time, flat keys left out', () => {
  assert.deepEqual(S.sensitiveKeys(S.BASELINE), ['share']);
  const x = sc({ price: { scope: { kind: 'all' }, change: 0.05 }, supplier: { s: 2, shock: 0.1, passThrough: 0.5 } });
  assert.deepEqual(S.sensitiveKeys(x).sort(), ['elasticity', 'passThrough', 'share', 'shock']);
  const t = S.tornado(real, x);
  for (const row of t) {
    const pts = S.sensitivity(real, x, row.key, [row.lo, row.hi]);
    close(pts[0].profit, row.profitAtLo, 1e-12); close(pts[1].profit, row.profitAtHi, 1e-12);
    assert.ok(row.min <= row.now && row.now <= row.max);
  }
  for (let i = 1; i < t.length; i++) assert.ok(t[i - 1].swing >= t[i].swing);
  // the current value reproduces the scenario
  for (const k of S.sensitiveKeys(x)) close(S.sensitivity(real, x, k, [S.valueOf(x, k)])[0].profit, S.simulate(real, x).result.profit, 1e-12);
});

test('A/B URL state: a prefixed scenario round-trips beside the live one', () => {
  const a = sc({ price: { scope: { kind: 'structural' }, change: 0.056 }, inventory: { cover: 9, carryRate: 0.12 } });
  const b = sc({ recovery: { scope: { kind: 'family', c: 2 }, share: 0.3 }, supplier: { s: 4, shock: -0.05, passThrough: 0 } });
  const q = { ...S.toParams(b), ...S.toParams(a, 'a.') };
  assert.deepEqual(S.fromParams((k) => q[k] ?? null), b);
  assert.deepEqual(S.fromParams((k) => q[k] ?? null, 'a.'), a);
});

test('inventory ledger and holding cost are separate and off by default', () => {
  const r0 = S.simulate(real, S.BASELINE);
  assert.equal(r0.inventory, null);
  const r = S.simulate(real, sc({ inventory: { cover: 12, carryRate: null } }));
  assert.equal(r.delta, 0); assert.ok(r.inventory.released > 0); assert.equal(r.inventory.holdingAvoided, null);
  const h = S.simulate(real, sc({ inventory: { cover: 12, carryRate: 0.2 } }));
  close(h.inventory.holdingAvoided, h.inventory.released * 0.2); assert.equal(h.delta, 0);
});

test('sensitivity, clamping, URL round trip, robustness', () => {
  const ds = tiny();
  const s = S.sensitivity(ds, sc({ price: { scope: { kind: 'all' }, change: 0.1 } }), 'elasticity', [-3, -1, 0]);
  assert.ok(s[0].profit < s[1].profit && s[1].profit < s[2].profit);         // a price rise loses more as volume reacts more
  const wild = S.normalise({ v: 1, price: { scope: { kind: 'nope' }, change: 9 }, elasticity: 5, supplier: { s: 'x', shock: NaN }, recovery: { share: -1 }, inventory: {} });
  assert.deepEqual(wild.price, { scope: { kind: 'all' }, change: 0.5 }); assert.equal(wild.elasticity, 0);
  assert.equal(wild.supplier.s, null); assert.equal(wild.recovery.share, 0); assert.equal(wild.inventory.cover, null);
  const x = sc({ price: { scope: { kind: 'family', c: 3 }, change: 0.05 }, elasticity: -1.2, recovery: { scope: { kind: 'structural' }, share: 0.4 }, supplier: { s: 1, shock: 0.08, passThrough: 0.5 }, inventory: { cover: 12, carryRate: 0.15 } });
  const q = S.toParams(x);
  assert.deepEqual(S.fromParams((k) => q[k] ?? null), x);
  assert.deepEqual(S.toParams(S.BASELINE), {});
  for (const d of [syntheticDataset, { ...tiny(), items: [], purchaseOrders: [] }]) noNaN(S.simulate(d, x));
});

test('sim.ts stays pure: imports only types, measures and the Lab', () => {
  const code = readFileSync(join(ROOT, 'src/data/sim.ts'), 'utf8');
  const imports = [...code.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ['./lab', './measures', './types']);
});

test('invalid URL parameters fall back safely and fit the dataset', () => {
  const q = { p: 'abc', ps: 'f-1', e: 'Infinity', r: '9', rs: 'f999', s: '99', k: '0.1', pt: 'x', cv: '-5', cr: '', 'a.p': '999', 'a.ps': 'fzz', 'a.e': '-7', 'a.s': '2.5', 'a.cv': '1e9', 'a.cr': 'NaN' };
  const get = (k) => q[k] ?? null;
  const b = S.fitTo(real, S.fromParams(get));
  assert.equal(b.price.change, 0); assert.deepEqual(b.price.scope, { kind: 'all' });   // 'abc' and 'f-1' fall back
  assert.equal(b.elasticity, 0);                                                     // Infinity is not a number here
  assert.equal(b.recovery.share, 1); assert.deepEqual(b.recovery.scope, { kind: 'all' }); // clamped; family 999 does not exist
  assert.deepEqual(b.supplier, { s: null, shock: 0, passThrough: 0 });               // supplier 99 does not exist
  assert.equal(b.inventory.cover, 1); assert.equal(b.inventory.carryRate, null);
  const a = S.fitTo(real, S.fromParams(get, 'a.'));
  assert.equal(a.price.change, 0.5); assert.deepEqual(a.price.scope, { kind: 'all' }); assert.equal(a.elasticity, -3);
  assert.equal(a.supplier.s, null); assert.equal(a.inventory.cover, 60); assert.equal(a.inventory.carryRate, null);
  for (const x of [a, b]) { noNaN(S.simulate(real, x)); assert.deepEqual(S.fitTo(real, S.fromParams((k) => S.toParams(x)[k] ?? null)), x); }
  // a valid hand-written link survives unchanged
  const ok = S.fromParams((k) => ({ p: '0.05', ps: 'f2', s: '2', k: '0.1' })[k] ?? null);
  assert.deepEqual(S.fitTo(real, ok), ok);
});
