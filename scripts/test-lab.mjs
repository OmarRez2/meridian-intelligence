// Analytics Lab calculation tests (src/data/lab.ts).
//  1. Formulas on small hand-built datasets with known answers.
//  2. Robustness: synthetic and minimal datasets, no NaN anywhere, invariants hold.
//  3. Cross-check of the real dataset against the independent audit (docs/dw-integration-audit.md, which
//     recomputed these figures from the OLTP CSV exports with pandas). The Lab itself never hard-codes them.
// Usage: node scripts/test-lab.mjs   Needs no dev server and writes nothing.
import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

register('./ts-hooks.mjs', import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => pathToFileURL(join(ROOT, 'src', p)).href;
const L = await import(src('data/lab.ts'));
const { syntheticDataset } = await import(src('data/synthetic.ts'));
const real = JSON.parse(readFileSync(join(ROOT, 'src/data/verified/dataset.json'), 'utf8'));

const close = (a, b, tol = 1e-9, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg ?? ''} expected ${b}, got ${a}`);
/** every number reachable in the result is finite or an intentional Infinity (unbounded cover) */
function noNaN(x, path = 'result') {
  if (typeof x === 'number') assert.ok(!Number.isNaN(x), `NaN at ${path}`);
  else if (Array.isArray(x)) x.forEach((v, i) => noNaN(v, `${path}[${i}]`));
  else if (x && typeof x === 'object') Object.entries(x).forEach(([k, v]) => noNaN(v, `${path}.${k}`));
}

/** Hand-built dataset: one segment, two families, two years of 12 months + 2 months of a third. */
function mini() {
  const months = Array.from({ length: 26 }, (_, i) => ({ i, y: 2020 + Math.floor(i / 12), m: i % 12, label: `m${i}` }));
  const item = (id, c, revenue, profit, extra = {}) => ({
    id, label: `Item ${id}`, c, reorder: 10, onHand: 100, monthlyUse: 10, unitCost: 2, unitPrice: 5, s: 0,
    sales: { revenue, profit, units: 1, lossLines: 0, loss: 0, ordered: 10, unmet: 0, ...extra },
  });
  return {
    provenance: { datasetId: 'mini', label: 'mini', status: 'approved', source: 't', coverage: { from: '2020-01-01', to: '2022-02-28' }, producedAt: null, notes: [] },
    months, years: [2020, 2021, 2022], territories: ['Seg'], categories: ['Mugs', 'Toys'],
    // ordered 100 every month; unmet 0 except: 10 in month 0, 10 in month 25 (the last month)
    facts: months.map((m) => ({ mi: m.i, t: 0, c: 0, revenue: 1000, profit: 400, units: 100, lossLines: m.i === 5 ? 3 : 0, loss: m.i === 5 ? 30 : 0, ordered: 100, unmet: m.i === 0 || m.i === 25 ? 10 : 0 })),
    orderFacts: months.map((m) => ({ mi: m.i, t: 0, orders: 10, backorders: m.i < 12 ? 1 : 0, deliveries: 10, onTime: 9 })),
    purchaseOrders: [
      { id: 1, mi: 0, s: 0, spend: 600, lines: 1, leadDays: 2, expectedDays: 10, onTime: true },
      { id: 2, mi: 1, s: 0, spend: 200, lines: 1, leadDays: 2, expectedDays: 10, onTime: true },
      { id: 3, mi: 2, s: 1, spend: 200, lines: 1, leadDays: 3, expectedDays: 10, onTime: true },
      { id: 4, mi: 3, s: 1, spend: 0, lines: 1, leadDays: null, expectedDays: 10, onTime: null },
    ],
    suppliers: [{ id: 0, label: 'S0', group: 'g', promise: 10 }, { id: 1, label: 'S1', group: 'g', promise: 10 }, { id: 2, label: 'S2 (no POs)', group: 'g', promise: 10 }],
    // revenue 50/30/10/6/4 = 100; profit 25/-3/5/3/2
    items: [
      item(1, 0, 50, 25),
      item(2, 1, 30, -3, { lossLines: 6, loss: 9, unmet: 4 }),
      item(3, 0, 10, 5, { lossLines: 2, loss: 1 }),
      item(4, 1, 6, 3, { unmet: 2 }),
      { ...item(5, 0, 4, 2), monthlyUse: 0, onHand: 7 },
    ],
    customers: [{ id: 1, label: 'C', t: 0 }], customerFacts: [], missing: [],
  };
}

test('helpers: quantile, stdev, hhi', () => {
  close(L.quantile([1, 2, 3, 4], 0.5), 2.5);
  close(L.quantile([10, 0, 5], 0.1), 1);          // sorted 0,5,10 -> pos 0.2
  assert.equal(L.quantile([], 0.5), 0);
  close(L.stdev([2, 4, 4, 4, 5, 5, 7, 9]), 2);
  assert.equal(L.stdev([3]), 0);
  close(L.hhi([0.5, 0.5]), 0.5);
  close(L.hhi([1]), 1);
});

test('ABC by revenue: inclusive cumulative cut-offs and margin split', () => {
  const r = L.abcMatrix(mini(), 'revenue');
  // cumulative 0.50, 0.80, 0.90, 0.96, 1.00 -> A, A, B, C, C
  assert.deepEqual(r.rows.map((x) => x.cls), ['A', 'A', 'B', 'C', 'C']);
  assert.deepEqual(r.classes.map((c) => c.items), [2, 1, 2]);
  close(r.classes[0].valueShare, 0.8);
  // margins 0.5, -0.1, 0.5, 0.5, 0.5 -> median 0.5; only item 2 is low-margin
  close(r.marginCut, 0.5);
  assert.deepEqual(r.rows.filter((x) => !x.highMargin).map((x) => x.id), [2]);
  assert.equal(r.pareto.items, 1);
  close(r.pareto.share, 0.5);
});

test('ABC by profit: loss-making items are C and add nothing to the share', () => {
  const r = L.abcMatrix(mini(), 'profit');
  close(r.total, 35);                                  // 25 + 5 + 3 + 2, the -3 is excluded
  const two = r.rows.find((x) => x.id === 2);
  assert.equal(two.cls, 'C'); assert.equal(two.negative, true); assert.equal(two.share, 0);
  assert.equal(r.rows[0].id, 1); assert.equal(r.rows[0].cls, 'A'); // 25/35 = 0.714
  assert.equal(r.rows[1].cls, 'B');                    // 30/35 = 0.857
});

test('loss anatomy: concentration, k80, net-negative items, persistence', () => {
  const r = L.lossAnatomy(mini());
  assert.equal(r.total.lines, 8); assert.equal(r.total.loss, 10); assert.equal(r.total.items, 2);
  assert.equal(r.rows[0].id, 2); close(r.rows[0].lineShare, 0.75);
  assert.equal(r.k80, 2);                              // 0.75 < 0.8, so two items are needed
  assert.equal(r.k80Share, r.rows[1].cumLines);           // the share the two items actually hold, not the 80% cut-off
  assert.equal(r.total.netNegative, 1);
  assert.equal(r.activeMonths, 1); assert.equal(r.months, 26);
  assert.equal(r.families[0].label, 'Toys');
  assert.deepEqual(r.patterns.map((p) => [p.pattern, p.items, p.lines]), [['structural', 1, 6], ['sporadic', 1, 2]]);
  assert.equal(r.rows[0].belowCost, false);
});

test('leakage: yearly shortfall, list-price estimate, timing test', () => {
  const r = L.leakage(mini(), 2);
  assert.equal(r.unmet, 20); assert.equal(r.ordered, 2600);
  close(r.unpickedValue, (4 + 2) * 5);                 // item-level unmet x list price
  assert.equal(r.yearsWithShortfall, 2);               // 2020 (month 0) and 2022 (month 25)
  assert.deepEqual(r.years.map((y) => y.complete), [true, true, false]);
  close(r.years[0].backorderRate, 0.1);
  // last 2 months: 10 of 20 unmet (0.5) vs 200 of 2600 ordered -> ratio 6.5
  close(r.tail.unmetShare, 0.5); close(r.tail.ratio, 0.5 / (200 / 2600));
  assert.equal(r.months.length, 26); close(r.months[0].rate, 0.1); close(r.months[1].rate, 0);
});

test('supplier dependence: shares, HHI, flat lead times, inactive suppliers', () => {
  const r = L.supplierDependence(mini());
  assert.equal(r.listed, 3); assert.equal(r.active, 2); assert.equal(r.pending, 1);
  close(r.rows[0].spendShare, 0.8); close(r.hhi.spend, 0.8 ** 2 + 0.2 ** 2);
  assert.equal(r.hhi.high, true);
  assert.equal(r.lead.min, 2); assert.equal(r.lead.max, 3); assert.equal(r.flat, true);
  close(r.lead.earlyMedian, 8);
  assert.deepEqual(r.lead.hist, [{ days: 2, pos: 2 }, { days: 3, pos: 1 }]);
  assert.equal(r.families.length, 2); assert.equal(r.singleSourced.length, 2); close(r.singleSourcedRevenue, 1);
});

test('stock capital: cover, excess above a policy, unbounded cover', () => {
  const r = L.stockCapital(mini(), 6);
  // items 1-4: 100 on hand, 10/month -> cover 10, keep 60, excess 40 units x 2 = 80 each
  close(r.excess, 4 * 80 + 7 * 2);                     // item 5 has no use: all 7 units are excess
  assert.equal(r.noUse, 1);
  close(r.cover.median, 10);
  assert.equal(sum(r.bands.map((b) => b.items)), 4);   // the no-use item is outside every band
  close(r.valueToRevenue, r.value / 26000);
  // a longer policy never releases more capital
  assert.ok(L.stockCapital(mini(), 24).excess <= r.excess);
  close(sum(r.rows.map((x) => x.keep + x.excess)), r.value);              // every unit is either kept or excess
  close(sum(r.families.map((f) => f.excess)), r.excess);
});
const sum = (a) => a.reduce((s, x) => s + x, 0);

test('gini and customer spread', () => {
  close(L.gini([1, 1, 1, 1]), 0); close(L.gini([0, 0, 0, 1]), 0.75); assert.equal(L.gini([]), 0);
  const c = L.customerSpread(real); assert.equal(c.customers, 663); assert.ok(c.gini > 0 && c.gini < 0.3, String(c.gini));
});

test('forecast check: rolling-origin backtest, no look-ahead, honest verdict', () => {
  // a hand-made series: a flat level with a step, so every rule's forecast can be checked by hand
  const ds = mini();
  const r = L.forecastCheck(ds, 24);
  const y = r.series.map((x) => x.value);
  const h1 = r.horizons.find((x) => x.h === 1), h3 = r.horizons.find((x) => x.h === 3);
  assert.equal(h1.n, y.length - 24); assert.equal(h3.n, Math.max(0, y.length - 24 - 2));
  const pick = (h, m) => h.models.find((x) => x.model === m).points;
  for (const p of pick(h1, 'naive')) { assert.equal(p.forecast, y[p.origin - 1]); assert.equal(p.t, p.origin); }
  for (const p of pick(h1, 'seasonal')) assert.equal(p.forecast, y[p.t - 12]);
  for (const p of pick(h1, 'avg3')) close(p.forecast, (y[p.origin - 1] + y[p.origin - 2] + y[p.origin - 3]) / 3);
  // no look-ahead: every forecast is for a month after its origin's data, and never past the last month
  for (const h of r.horizons) for (const m of h.models) for (const p of m.points) { assert.ok(p.t >= p.origin && p.t < y.length); assert.equal(p.t - p.origin, h.h - 1); }
  // a short history scores nothing and claims no skill
  const short = L.forecastCheck({ ...ds, months: ds.months.slice(0, 20) }, 24);
  assert.equal(short.horizons[0].n, 0); assert.equal(short.skilful, null); noNaN(short);
  // real data: the averages help one month ahead, nothing beats "last month" three months ahead
  const f = L.forecastCheck(real);
  const r1 = f.horizons[0], r3 = f.horizons[1];
  assert.equal(r1.n, 17); assert.equal(r3.n, 15);
  assert.equal(r1.best.model, 'avg3'); assert.ok(r1.beatsNaive); assert.deepEqual(r1.ties, ['avg3', 'avg12']);   // level at the two decimals shown
  assert.equal(r3.best.model, 'naive'); assert.equal(r3.beatsNaive, false);
  assert.equal(f.skilful, null);                                            // so the page publishes no forward forecast
  close(r1.models.find((m) => m.model === 'naive').mape, 0.09, 0.005);
  assert.deepEqual(f.years.map((x) => x.year), [2013, 2014, 2015]);
});

test('robustness: synthetic and empty datasets give finite results', () => {
  noNaN(L.lab(syntheticDataset));
  noNaN(L.lab(syntheticDataset, { basis: 'profit', coverMonths: 3 }));
  const empty = { ...mini(), facts: [], orderFacts: [], purchaseOrders: [], items: [], customerFacts: [] };
  const r = L.lab(empty);
  noNaN(r);
  assert.equal(r.abc.rows.length, 0); assert.equal(r.loss.k80, 0); assert.equal(r.suppliers.flat, false);
});

test('invariants on the real dataset', () => {
  for (const basis of ['revenue', 'profit']) {
    const a = L.abcMatrix(real, basis);
    assert.equal(sum(a.classes.map((c) => c.items)), a.rows.length);
    close(sum(a.rows.map((r) => r.share)), 1, 1e-9, `${basis} shares`);
    assert.ok(a.rows.every((r, i) => i === 0 || a.rows[i - 1].cum <= r.cum + 1e-12));
  }
  const s = L.supplierDependence(real);
  close(sum(s.rows.map((r) => r.spendShare)), 1, 1e-9);
  const lk = L.leakage(real);
  close(sum(lk.years.map((y) => y.unmet)), lk.unmet);
  noNaN(L.lab(real));
});

test('real dataset matches the independent CSV audit', () => {
  const r = L.lab(real);
  assert.deepEqual(r.abc.classes.map((c) => c.items), [68, 78, 81]);        // audit §4 ABC
  close(r.abc.pareto.share, 0.638, 0.001);                                  // top 20% -> 63.8%
  assert.equal(r.loss.total.lines, 4626); assert.equal(r.loss.total.items, 18);
  assert.equal(r.leakage.unmet, 360276);
  close(r.leakage.unpickedValue, 5372935.2, 1e-9);                         // = Gold UnmetRevenueNet
  assert.equal(r.leakage.backorders, 7538);
  assert.equal(r.leakage.yearsWithShortfall, 4);                            // every year 2013-2016
  assert.equal(r.suppliers.active, 7);
  assert.equal(Math.round(r.suppliers.top2.poShare * r.suppliers.totalPos), 2040);
  assert.equal(r.suppliers.lead.min, 1); assert.equal(r.suppliers.lead.max, 3); assert.equal(r.suppliers.flat, true);
  assert.equal(r.suppliers.lead.onTime, 1);
  assert.equal(r.stock.atReorder, 2);
  const [st, sp] = r.loss.patterns;                                         // 4 masks lose on every sale; 14 items lose occasionally
  assert.equal(st.items, 4); assert.equal(st.belowCost, 4); assert.equal(sp.items, 14); assert.equal(sp.belowCost, 0);
  assert.equal(r.loss.k80, 4); assert.ok(r.loss.k80Structural); assert.ok(Math.abs(r.loss.k80Share - st.lineShare) < 1e-12); // 80% is the cut-off; 88.9% is where the 4 structural items land
  assert.equal(r.suppliers.families.length, 8); assert.equal(r.suppliers.singleSourced.length, 6);
  close(r.stock.cover.median, 178, 0.01);                                   // "median 178 months"
  close(r.stock.valueToRevenue, 2.8, 0.02);                                 // "2.8x the revenue"
});

test('lab.ts stays pure: imports only types and measures', () => {
  const text = readFileSync(join(ROOT, 'src/data/lab.ts'), 'utf8');
  const imports = [...text.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ['./measures', './types']);
  assert.ok(!/document\.|window\./.test(text), 'no DOM access');
});
