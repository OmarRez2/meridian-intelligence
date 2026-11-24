// Builds the website's verified dataset (one JSON file) from the CSV export described in
// docs/export-contract.md, then runs the same validator the website runs. Writes the JSON only if it passes.
//
//   node scripts/build-verified-dataset.mjs <csv-folder> <output.json>
//   node scripts/build-verified-dataset.mjs --check <dataset.json>      (validate an existing JSON file)
//
// It reads only the files you name and writes only the output path you give. It never connects to a
// database. Do not point it at src/data/verified/ until the team has approved the export.
import { register } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

register('./ts-hooks.mjs', import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { validateDataset, VERIFIED_STATUSES, monthLabel } = await import(pathToFileURL(join(ROOT, 'src/data/validate.ts')).href);

const args = process.argv.slice(2);
const usage = () => { console.error('Usage:\n  node scripts/build-verified-dataset.mjs <csv-folder> <output.json>\n  node scripts/build-verified-dataset.mjs --check <dataset.json>'); process.exit(2); };

function report(r, label) {
  const line = (i) => `  ${i.path ? `${i.path}: ` : ''}${i.message}`;
  if (r.errors.length) console.error(`\n${r.errors.length} error(s):\n${r.errors.map(line).join('\n')}`);
  if (r.warnings.length) console.warn(`\n${r.warnings.length} warning(s):\n${r.warnings.map(line).join('\n')}`);
  console.log(`\n${label}: ${r.ok ? 'PASSED' : 'REJECTED'}. Rows: ${Object.entries(r.counts).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}

/* ------------------------------------------------------------------ --check */
if (args[0] === '--check') {
  if (!args[1]) usage();
  let data;
  try { data = JSON.parse(readFileSync(resolve(args[1]), 'utf8')); } catch (e) { console.error(`Could not read JSON: ${e.message}`); process.exit(1); }
  const r = validateDataset(data, { allowedStatuses: VERIFIED_STATUSES });
  report(r, 'Validation');
  process.exit(r.ok ? 0 : 1);
}
if (args.length !== 2) usage();
const [inDir, outPath] = args.map((p) => resolve(p));

/* ------------------------------------------------------------------ CSV (RFC 4180) */
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!nonEmpty.length) return [];
  const head = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r, n) => Object.fromEntries([...head.map((h, k) => [h, (r[k] ?? '').trim()]), ['__line', n + 2]]));
}
const problems = [];
function table(name, required, columns) {
  const p = join(inDir, name);
  if (!existsSync(p)) { if (required) problems.push(`${name}: file is missing`); return []; }
  const rows = parseCsv(readFileSync(p, 'utf8'));
  if (rows.length) for (const c of columns) if (!(c in rows[0])) problems.push(`${name}: missing column "${c}"`);
  return rows;
}
/** numbers: empty or non-numeric cells become null, which the validator reports with the field name */
const num = (v) => (v === '' || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const bool = (v) => (/^(true|1|yes)$/i.test(v) ? true : /^(false|0|no)$/i.test(v) ? false : null);
const ref = (map, key, file, line, what) => { if (map.has(key)) return map.get(key); problems.push(`${file} line ${line}: unknown ${what} "${key}"`); return -1; };

/* ------------------------------------------------------------------ build */
let provenance;
try { provenance = JSON.parse(readFileSync(join(inDir, 'provenance.json'), 'utf8')); } catch (e) { console.error(`provenance.json: ${e.message}`); process.exit(1); }

const months = [];
{
  const [fy, fm] = String(provenance?.coverage?.from ?? '').split('-').map(Number);
  const [ty, tm] = String(provenance?.coverage?.to ?? '').split('-').map(Number);
  if ([fy, fm, ty, tm].some((x) => !Number.isInteger(x))) problems.push('provenance.json: coverage.from and coverage.to are needed to build the month list');
  else for (let k = fy * 12 + fm - 1, i = 0; k <= ty * 12 + tm - 1 && i < 600; k++, i++) months.push({ i, y: Math.floor(k / 12), m: k % 12, label: monthLabel(Math.floor(k / 12), k % 12) });
}
const monthIx = new Map(months.map((m) => [`${m.y}-${String(m.m + 1).padStart(2, '0')}`, m.i]));

const territories = table('territories.csv', true, ['territory']).map((r) => r.territory);
const categories = table('stock_groups.csv', true, ['stock_group']).map((r) => r.stock_group);
const terrIx = new Map(territories.map((t, i) => [t, i]));
const catIx = new Map(categories.map((c, i) => [c, i]));

const facts = table('sales_facts.csv', true, ['month', 'territory', 'stock_group', 'revenue', 'profit', 'units', 'orders', 'backorders', 'pick_hours']).map((r) => ({
  mi: ref(monthIx, r.month, 'sales_facts.csv', r.__line, 'month (inside coverage, as YYYY-MM)'), t: ref(terrIx, r.territory, 'sales_facts.csv', r.__line, 'territory'), c: ref(catIx, r.stock_group, 'sales_facts.csv', r.__line, 'stock group'),
  revenue: num(r.revenue), profit: num(r.profit), units: num(r.units), orders: num(r.orders), backorders: num(r.backorders), pickHours: num(r.pick_hours),
}));
const supRows = table('suppliers.csv', true, ['supplier_id', 'supplier', 'stock_group', 'standard_lead_days']);
const supIx = new Map(supRows.map((r, i) => [r.supplier_id, i]));
const suppliers = supRows.map((r, i) => ({ id: i, label: r.supplier, group: r.stock_group, promise: num(r.standard_lead_days) }));
const purchaseOrders = table('purchase_orders.csv', true, ['purchase_order_id', 'month', 'supplier_id', 'spend', 'lines', 'lead_days', 'expected_days', 'on_time']).map((r) => ({
  id: num(r.purchase_order_id), mi: ref(monthIx, r.month, 'purchase_orders.csv', r.__line, 'month (inside coverage, as YYYY-MM)'), s: ref(supIx, r.supplier_id, 'purchase_orders.csv', r.__line, 'supplier_id'),
  spend: num(r.spend), lines: num(r.lines), leadDays: num(r.lead_days), expectedDays: num(r.expected_days), onTime: bool(r.on_time),
}));
const items = table('stock_items.csv', true, ['item_id', 'item', 'stock_group', 'reorder_level', 'on_hand', 'monthly_use', 'unit_cost']).map((r) => ({
  id: num(r.item_id), label: r.item, c: ref(catIx, r.stock_group, 'stock_items.csv', r.__line, 'stock group'), reorder: num(r.reorder_level), onHand: num(r.on_hand), monthlyUse: num(r.monthly_use), unitCost: num(r.unit_cost),
}));
const customers = table('customers.csv', true, ['customer_id', 'customer', 'territory']).map((r) => ({ id: num(r.customer_id), label: r.customer, t: ref(terrIx, r.territory, 'customers.csv', r.__line, 'territory') }));
const customerFacts = table('customer_facts.csv', true, ['month', 'customer_id', 'revenue', 'orders']).map((r) => ({
  mi: ref(monthIx, r.month, 'customer_facts.csv', r.__line, 'month (inside coverage, as YYYY-MM)'), cu: num(r.customer_id), revenue: num(r.revenue), orders: num(r.orders),
}));
const benchmarks = table('benchmarks.csv', false, ['metric', 'unit', 'value', 'source']).map((r) => {
  const scope = {};
  if (r.year) scope.year = num(r.year);
  if (r.territory) scope.territory = r.territory;
  if (r.stock_group) scope.category = r.stock_group;
  return { metric: r.metric, unit: r.unit, ...(Object.keys(scope).length ? { scope } : {}), value: num(r.value), ...(r.tolerance ? { tolerance: num(r.tolerance) } : {}), source: r.source };
});
const missing = table('missing.csv', false, ['field', 'count', 'note']).map((r) => ({ field: r.field, count: num(r.count), note: r.note }));

if (problems.length) {
  console.error(`The CSV export could not be converted (${problems.length} problem(s)):\n${problems.slice(0, 40).map((p) => `  ${p}`).join('\n')}${problems.length > 40 ? `\n  …and ${problems.length - 40} more` : ''}`);
  process.exit(1);
}
const dataset = { provenance, months, years: [...new Set(months.map((m) => m.y))], territories, categories, facts, purchaseOrders, suppliers, items, customers, customerFacts, ...(benchmarks.length ? { benchmarks } : {}), missing };
const r = validateDataset(dataset, { allowedStatuses: VERIFIED_STATUSES });
report(r, 'Validation');
if (!r.ok) { console.error('\nNothing was written.'); process.exit(1); }
writeFileSync(outPath, JSON.stringify(dataset));
console.log(`Wrote ${outPath}`);
