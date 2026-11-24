// Data-layer tests: the export validator, the metric registry and measures, and two architecture
// guards (no page bypasses the adapter; no team number anywhere in the prototype).
// Usage: node scripts/test-data.mjs      (or npm.cmd test). Needs no dev server and writes nothing.
import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

register('./ts-hooks.mjs', import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => pathToFileURL(join(ROOT, 'src', p)).href;
const { validateDataset, validateRegistry, parseIsoDate, monthLabel } = await import(src('data/validate.ts'));
const { syntheticDataset } = await import(src('data/synthetic.ts'));
const { computeMetric, MEASURES } = await import(src('data/measures.ts'));
const { ALL_METRICS } = await import(src('data/metrics.ts'));
const { monthlyRevenue, territoryShare, skyFromDataset } = await import(src('data/derive.ts'));

const NOW = new Date('2026-11-23T12:00:00Z');
const ALL = { scope: { year: null, territory: null, category: null } };
const clone = (x) => JSON.parse(JSON.stringify(x));
const codes = (issues) => issues.map((i) => i.code);
const check = (ds, opts = {}) => validateDataset(ds, { now: NOW, ...opts });
const expectError = (ds, code, opts) => { const r = check(ds, opts); assert.equal(r.ok, false, `expected rejection (${code})`); assert.ok(codes(r.errors).includes(code), `expected error ${code}, got ${JSON.stringify(codes(r.errors))}`); return r; };
const expectOk = (ds, opts) => { const r = check(ds, opts); assert.equal(r.ok, true, `expected acceptance, got errors ${JSON.stringify(r.errors.slice(0, 3))}`); return r; };

/** A verified-shaped TEST FIXTURE: synthetic values with a reconciled status and passing benchmarks. Never shipped. */
function fixture({ benchmarks = true } = {}) {
  const ds = clone(syntheticDataset);
  ds.provenance = { ...ds.provenance, datasetId: 'test-fixture', label: 'TEST FIXTURE: synthetic values, not project data', status: 'reconciled', source: 'Test fixture built from the synthetic generator.', producedAt: '2026-11-01' };
  if (benchmarks) {
    const terr = ds.territories[2];
    const b = (metric, scope) => {
      const s = { year: scope?.year ?? null, territory: scope?.territory ? ds.territories.indexOf(scope.territory) : null, category: scope?.category ? ds.categories.indexOf(scope.category) : null };
      const def = ALL_METRICS.find((m) => m.id === metric);
      return { metric, unit: def.unit, ...(scope ? { scope } : {}), value: computeMetric(ds, metric, s), source: 'test: recomputed' };
    };
    ds.benchmarks = [b('revenue'), b('gross_margin', { year: 2015 }), b('backorder_rate', { territory: terr }), b('purchase_spend', { year: 2014 }), b('items_below_reorder'), b('active_customers', { year: 2015 })];
  }
  return ds;
}

/** A tiny dataset for edge cases (n months, one of everything). */
function minimal(n = 3, startY = 2020) {
  const months = Array.from({ length: n }, (_, i) => { const y = startY + Math.floor(i / 12), m = i % 12; return { i, y, m, label: monthLabel(y, m) }; });
  const last = months[n - 1];
  const lastDay = new Date(Date.UTC(last.y, last.m + 1, 0)).getUTCDate();
  return {
    provenance: { datasetId: 'min', label: 'Minimal test', status: 'approved', source: 'test', coverage: { from: `${startY}-01-01`, to: `${last.y}-${String(last.m + 1).padStart(2, '0')}-${lastDay}` }, producedAt: '2026-01-01', currency: 'USD', notes: [] },
    months, years: [...new Set(months.map((m) => m.y))], territories: ['North'], categories: ['Mugs'],
    facts: months.map((m) => ({ mi: m.i, t: 0, c: 0, revenue: 100, profit: 40, units: 10, lossLines: 0, loss: 0, ordered: 10, unmet: 0 })),
    orderFacts: months.map((m) => ({ mi: m.i, t: 0, orders: 2, backorders: 0, deliveries: 2, onTime: 2 })),
    purchaseOrders: [{ id: 1, mi: 0, s: 0, spend: 50, lines: 2, leadDays: 5, expectedDays: 7, onTime: true }],
    suppliers: [{ id: 0, label: 'S', group: 'Mugs', promise: 7 }], items: [{ id: 1, label: 'I', c: 0, reorder: 5, onHand: 9, monthlyUse: 3, unitCost: 2 }],
    customers: [{ id: 7, label: 'C', t: 0 }], customerFacts: months.map((m) => ({ mi: m.i, cu: 7, revenue: 100, orders: 2 })),
    benchmarks: [{ metric: 'revenue', unit: 'currency', value: 100 * n, source: 'test' }], missing: [],
  };
}

/* ------------------------------------------------------------------ registry and measures */
test('metric registry is internally consistent and every metric has one measure', () => {
  assert.deepEqual(validateRegistry(), []);
  assert.equal(Object.keys(MEASURES).length, ALL_METRICS.length);
});
test('measures agree with direct sums over the synthetic data', () => {
  const total = syntheticDataset.facts.reduce((s, x) => s + x.revenue, 0);
  assert.equal(computeMetric(syntheticDataset, 'revenue', ALL.scope), total);
  assert.ok(Math.abs(monthlyRevenue(syntheticDataset).reduce((a, b) => a + b, 0) - total) < 1e-6);
  assert.ok(Math.abs(territoryShare(syntheticDataset).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  const sky = skyFromDataset(syntheticDataset);
  assert.equal(sky.kind, 'data'); assert.equal(sky.dial.length, 41); assert.equal(sky.startYear, 2013);
});
test('ISO dates are parsed strictly', () => {
  assert.notEqual(parseIsoDate('2016-02-29'), null);
  assert.equal(parseIsoDate('2015-02-29'), null);
  assert.equal(parseIsoDate('2016-13-01'), null);
  assert.equal(parseIsoDate('01/02/2016'), null);
});

/* ------------------------------------------------------------------ whole datasets */
test('the synthetic dataset satisfies the contract (apart from its status) with no warnings', () => {
  const r = check(syntheticDataset, { allowedStatuses: ['synthetic'] });
  assert.equal(r.ok, true, JSON.stringify(r.errors.slice(0, 3)));
  assert.deepEqual(r.warnings, []);
});
test('the verified slot rejects synthetic data by status', () => expectError(syntheticDataset, 'status-not-allowed'));
test('a reconciled fixture with matching benchmarks is accepted, also after a JSON round trip', () => {
  const r = expectOk(fixture());
  assert.deepEqual(r.warnings, []);
  assert.equal(r.counts.benchmarks, 6);
  expectOk(JSON.parse(JSON.stringify(fixture())));
});
test('a minimal approved dataset is accepted', () => expectOk(minimal()));
test('non-objects are rejected', () => { for (const v of [null, [], 'x', 42]) expectError(v, 'not-an-object'); });

/* ------------------------------------------------------------------ required fields and types */
test('a missing required array is rejected', () => { const d = fixture(); delete d.facts; expectError(d, 'missing-array'); });
test('missing provenance is rejected', () => { const d = fixture(); delete d.provenance; expectError(d, 'missing-provenance'); });
test('empty provenance text fields are rejected', () => { const d = fixture(); d.provenance.source = '  '; expectError(d, 'provenance-field'); });
test('an unknown status is rejected', () => { const d = fixture(); d.provenance.status = 'final'; expectError(d, 'status-invalid'); });
test('a non-numeric amount is rejected (NaN becomes null in JSON)', () => { const d = fixture({ benchmarks: false }); d.facts[3].revenue = null; expectError(d, 'type'); });
test('a string amount is rejected', () => { const d = fixture({ benchmarks: false }); d.purchaseOrders[0].spend = '120.5'; expectError(d, 'type'); });
test('onTime must be a boolean', () => { const d = fixture({ benchmarks: false }); d.purchaseOrders[0].onTime = 'yes'; expectError(d, 'type'); });
test('an unknown top-level field is a warning, not an error', () => { const d = fixture(); d.extra = 1; const r = expectOk(d); assert.ok(codes(r.warnings).includes('unknown-field')); });

/* ------------------------------------------------------------------ numeric ranges */
test('counts must be non-negative integers', () => {
  const a = fixture({ benchmarks: false }); a.orderFacts[0].orders = -1; expectError(a, 'count');
  const b = fixture({ benchmarks: false }); b.facts[0].lossLines = 2.5; expectError(b, 'count');
  const c = fixture({ benchmarks: false }); c.purchaseOrders[0].lines = -3; expectError(c, 'count');
  const e = fixture({ benchmarks: false }); e.customerFacts[0].orders = -1; expectError(e, 'count');
});
test('backorders cannot exceed orders (a subset by definition)', () => { const d = fixture({ benchmarks: false }); d.orderFacts[0].backorders = d.orderFacts[0].orders + 1; expectError(d, 'backorders-exceed-orders'); });
test('negative revenue, profit, spend, units and stock are legitimate and accepted', () => {
  const d = fixture({ benchmarks: false });
  d.facts[0].revenue = -250; d.facts[0].profit = -40; d.facts[1].units = -3; d.purchaseOrders[0].spend = -90; d.items[0].onHand = -2;
  const r = expectOk(d);
  assert.ok(!codes(r.errors).length);
});
test('a negative duration is a warning, not an error', () => {
  const d = fixture({ benchmarks: false }); d.facts[0].pickHours = -1; d.purchaseOrders[0].leadDays = -2;
  const r = expectOk(d); assert.ok(codes(r.warnings).includes('negative-duration'));
});
test('negative reorder level is a warning', () => { const d = fixture({ benchmarks: false }); d.items[0].reorder = -5; const r = expectOk(d); assert.ok(codes(r.warnings).includes('negative-level')); });
test('onTime that contradicts the lead times is a warning', () => {
  const d = fixture({ benchmarks: false }); const p = d.purchaseOrders.find((x) => x.onTime); p.leadDays = p.expectedDays + 3;
  const r = expectOk(d); assert.ok(codes(r.warnings).includes('on-time-inconsistent'));
});

/* ------------------------------------------------------------------ referential integrity */
test('facts must reference existing months, territories and stock groups', () => {
  for (const [k, v] of [['mi', 999], ['t', 8], ['c', -1], ['t', 1.5]]) { const d = fixture({ benchmarks: false }); d.facts[0][k] = v; expectError(d, 'reference'); }
});
test('purchase orders must reference a supplier', () => { const d = fixture({ benchmarks: false }); d.purchaseOrders[0].s = 10; expectError(d, 'reference'); });
test('supplier group must name a category', () => { const d = fixture({ benchmarks: false }); d.suppliers[0].group = ''; expectError(d, 'type'); });
test('supplier ids must equal their position', () => { const d = fixture({ benchmarks: false }); d.suppliers[3].id = 30; expectError(d, 'supplier-id'); });
test('items must reference a stock group', () => { const d = fixture({ benchmarks: false }); d.items[0].c = 99; expectError(d, 'reference'); });
test('customers must reference a territory', () => { const d = fixture({ benchmarks: false }); d.customers[0].t = 42; expectError(d, 'reference'); });
test('customer facts must reference a customer id', () => { const d = fixture({ benchmarks: false }); d.customerFacts[0].cu = 999999; expectError(d, 'reference'); });
test('customer revenue that does not reconcile with sales is a warning', () => {
  const d = fixture({ benchmarks: false }); d.customerFacts[0].revenue *= 1.5;
  const r = expectOk(d); assert.ok(codes(r.warnings).includes('customer-revenue-unreconciled'));
});

/* ------------------------------------------------------------------ duplicates */
test('duplicate dimension names are rejected (case-insensitive)', () => { const d = fixture({ benchmarks: false }); d.categories[1] = d.categories[0].toUpperCase(); expectError(d, 'duplicate'); });
test('duplicate fact grain is rejected', () => { const d = fixture({ benchmarks: false }); d.facts[1] = { ...d.facts[1], mi: d.facts[0].mi, t: d.facts[0].t, c: d.facts[0].c }; expectError(d, 'duplicate'); });
test('duplicate purchase order ids are rejected', () => { const d = fixture({ benchmarks: false }); d.purchaseOrders[1].id = d.purchaseOrders[0].id; expectError(d, 'duplicate'); });
test('duplicate item and customer ids are rejected', () => {
  const a = fixture({ benchmarks: false }); a.items[1].id = a.items[0].id; expectError(a, 'duplicate');
  const b = fixture({ benchmarks: false }); b.customers[1].id = b.customers[0].id; expectError(b, 'duplicate');
});
test('duplicate customer-month rows are rejected', () => { const d = fixture({ benchmarks: false }); d.customerFacts.push({ ...d.customerFacts[0] }); expectError(d, 'duplicate'); });
test('duplicate supplier labels are a warning', () => { const d = fixture({ benchmarks: false }); d.suppliers[1].label = d.suppliers[0].label; const r = expectOk(d); assert.ok(codes(r.warnings).includes('duplicate-label')); });

/* ------------------------------------------------------------------ dates and coverage */
test('impossible dates are rejected', () => { const d = fixture(); d.provenance.coverage.to = '2016-05-32'; expectError(d, 'date-invalid'); });
test('coverage must run forwards', () => { const d = fixture(); d.provenance.coverage = { from: '2016-05-31', to: '2013-01-01' }; expectError(d, 'coverage-order'); });
test('coverage must match the first and last month', () => { const d = fixture(); d.provenance.coverage.from = '2012-12-01'; expectError(d, 'coverage-mismatch'); });
test('a reconciled export must state producedAt, and not in the future', () => {
  const a = fixture(); a.provenance.producedAt = null; expectError(a, 'produced-missing');
  const b = fixture(); b.provenance.producedAt = '2027-01-01'; expectError(b, 'produced-future');
  const c = fixture(); c.provenance.producedAt = 'last week'; expectError(c, 'date-invalid');
  const e = fixture(); e.provenance.producedAt = '2026-11-01T09:30:00Z'; expectOk(e);
});
test('an export dated before its coverage ends is a warning', () => { const d = fixture(); d.provenance.producedAt = '2016-01-01'; const r = expectOk(d); assert.ok(codes(r.warnings).includes('produced-before-coverage-end')); });
test('months must be indexed by position, consecutive, in range and labelled', () => {
  const a = fixture({ benchmarks: false }); a.months[5].i = 6; expectError(a, 'month-index');
  const b = fixture({ benchmarks: false }); b.months[5].m = 12; expectError(b, 'month-range');
  const c = fixture({ benchmarks: false }); c.months[5] = { ...c.months[5], m: c.months[5].m + 1, label: monthLabel(c.months[5].y, c.months[5].m + 1) }; expectError(c, 'month-sequence');
  const e = fixture({ benchmarks: false }); e.months[0].label = 'January 2013'; expectError(e, 'month-label');
  const f = fixture({ benchmarks: false }); f.months[0].label = '<img src=x onerror=alert(1)>'; expectError(f, 'month-label');
});
test('years must list the calendar years of the months', () => { const d = fixture(); d.years = [2013, 2014, 2015]; expectError(d, 'years-mismatch'); });
test('more than 48 months is accepted with a dial warning', () => { const r = expectOk(minimal(50)); assert.ok(codes(r.warnings).includes('dial-capacity')); });

/* ------------------------------------------------------------------ metric definitions, units, provenance */
test('only US dollars are accepted; an unstated currency is a warning', () => {
  const a = fixture(); a.provenance.currency = 'EUR'; expectError(a, 'currency');
  const b = fixture(); delete b.provenance.currency; const r = expectOk(b); assert.ok(codes(r.warnings).includes('currency-unstated'));
});
test('benchmarks must name a registry metric in its unit', () => {
  const a = fixture(); a.benchmarks[0].metric = 'net_sales'; expectError(a, 'benchmark-metric');
  const b = fixture(); b.benchmarks[1].unit = 'decimal'; expectError(b, 'benchmark-unit');
  const c = fixture(); c.benchmarks[0].source = ''; expectError(c, 'type');
});
test('benchmark scopes must exist and apply to the metric', () => {
  const a = fixture(); a.benchmarks[2].scope = { territory: 'Atlantis' }; expectError(a, 'benchmark-scope');
  const b = fixture(); b.benchmarks[3].scope = { territory: b.territories[0] }; expectError(b, 'benchmark-scope'); // purchasing has no territory
  const c = fixture(); c.benchmarks[1].scope = { year: 2019 }; expectError(c, 'benchmark-scope');
  const e = fixture(); e.benchmarks[1].scope = { quarter: 2 }; expectError(e, 'benchmark-scope');
});
test('a benchmark that does not reconcile rejects the export', () => {
  const d = fixture(); d.benchmarks[0].value *= 1.01;
  const r = expectError(d, 'benchmark-mismatch');
  assert.match(r.errors.find((e) => e.code === 'benchmark-mismatch').message, /tolerance/);
});
test('a benchmark within tolerance is accepted; tolerance can be set per benchmark', () => {
  const a = fixture(); a.benchmarks[0].value *= 1.0005; expectOk(a);
  const b = fixture(); b.benchmarks[0].value *= 1.004; b.benchmarks[0].tolerance = 0.005; expectOk(b);
  const c = fixture(); c.benchmarks[0].tolerance = -1; expectError(c, 'type');
});
test('a reconciled export without benchmarks is a warning', () => { const r = expectOk(fixture({ benchmarks: false })); assert.ok(codes(r.warnings).includes('no-benchmarks')); });

/* ------------------------------------------------------------------ reporting */
test('repeated issues are capped with a summary line', () => {
  const d = fixture({ benchmarks: false });
  for (let i = 0; i < 40; i++) d.facts[i].t = 99;
  const r = check(d);
  const refs = r.errors.filter((e) => e.code === 'reference');
  assert.equal(refs.length, 6); // 5 kept + 1 summary
  assert.match(refs[5].message, /35 more/);
});

/* ------------------------------------------------------------------ architecture guards */
const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
test('only the adapter imports the synthetic or verified modules', () => {
  const offenders = walk(join(ROOT, 'src')).filter((p) => /\.ts$/.test(p)).filter((p) => {
    const rel = relative(join(ROOT, 'src'), p).replace(/\\/g, '/');
    if (rel === 'data/adapter.ts') return false;
    return /from\s+['"][^'"]*\/(synthetic|verified)['"]|import\(\s*['"][^'"]*\/(synthetic|verified)['"]/.test(readFileSync(p, 'utf8'));
  });
  assert.deepEqual(offenders, []);
});
test('the synthetic module exposes only the dataset', async () => {
  assert.deepEqual(Object.keys(await import(src('data/synthetic.ts'))), ['syntheticDataset']);
});
test('no team number appears anywhere in the prototype', () => {
  const files = [
    ...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'scripts')), ...walk(join(ROOT, 'docs')).filter((p) => p.endsWith('.md')),
    ...walk(join(ROOT, 'public')).filter((p) => /\.(svg|html|txt|json|webmanifest)$/.test(p)),
    join(ROOT, 'index.html'), join(ROOT, 'README.md'), join(ROOT, 'CLAUDE.md'), join(ROOT, 'package.json'),
  ];
  // "team" followed by a number, numeral word or "#n"; built so this file does not match itself
  const pattern = new RegExp(['team', '[\\s_-]*(no\\.?|number|#)?[\\s_-]*', '(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\b'].join(''), 'i');
  const hits = files.filter((p) => pattern.test(readFileSync(p, 'utf8'))).map((p) => relative(ROOT, p));
  assert.deepEqual(hits, []);
});
