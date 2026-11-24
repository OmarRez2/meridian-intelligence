import type { MetricDefinition, SupplyChainDataset, Unit, ValidationStatus } from './types';
import { ALL_METRICS, METRICS } from './metrics';
import { MEASURES, computeMetric, type Scope } from './measures';
import { DIAL_CAPACITY } from './derive';

/**
 * Validation of a dataset before the site will show it. The rules are listed, with their reasons,
 * in `docs/export-contract.md`. Two severities:
 *  - error:   the dataset is rejected. Structure, types, references, duplicates, dates, provenance,
 *             and benchmarks that do not reconcile.
 *  - warning: shown in the data panel and logged, but the dataset is accepted. Used where a value is
 *             suspicious but a documented rule does not forbid it (for example a negative duration).
 *
 * Signed amounts (revenue, profit, spend, units, quantity on hand, cost) are never rejected for
 * being negative: credit notes, returns and stock adjustments are legitimate, and no approved
 * metric definition rules them out. Counts are non-negative integers because the registry defines
 * them as COUNTs.
 */
export type Severity = 'error' | 'warning';
export type Issue = { severity: Severity; code: string; path: string; message: string };
export type ValidationReport = { ok: boolean; errors: Issue[]; warnings: Issue[]; counts: Record<string, number> };
export type ValidateOptions = {
  /** Statuses the caller accepts. The verified slot accepts only reconciled and approved. */
  allowedStatuses?: ValidationStatus[];
  /** Reference time for "not in the future" checks (tests pass a fixed date). */
  now?: Date;
  /** Issues kept per code; the rest are counted in a summary line. */
  maxPerCode?: number;
};

export const VERIFIED_STATUSES: ValidationStatus[] = ['reconciled', 'approved'];
const STATUSES: ValidationStatus[] = ['synthetic', 'illustrative', 'unverified', 'reconciled', 'approved'];
const UNITS: Unit[] = ['currency', 'count', 'units', 'ratio', 'days', 'hours', 'months', 'decimal'];
const TABLES = ['months', 'years', 'territories', 'categories', 'facts', 'orderFacts', 'purchaseOrders', 'suppliers', 'items', 'customers', 'customerFacts', 'missing'] as const;
const KNOWN_TOP = new Set<string>(['provenance', 'benchmarks', ...TABLES]);
const DEFAULT_TOLERANCE = 0.001;
/** Customer revenue must reconcile with sales revenue per month and territory within 0.5%. */
const CUSTOMER_RECONCILE_TOLERANCE = 0.005;

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The label every month must carry, e.g. "Jan 2013". Chart axes read the month and year from it. */
export const monthLabel = (y: number, m: number) => `${MONTH_NAMES[m]} ${y}`;

/** Parses YYYY-MM-DD strictly (rejects 2016-02-30). Returns a UTC timestamp or null. */
export function parseIsoDate(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = ISO_DATE.exec(v);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? t : null;
}
function parseIsoDateTime(v: unknown): number | null {
  if (typeof v !== 'string' || !ISO_DATETIME.test(v)) return null;
  if (parseIsoDate(v.slice(0, 10)) === null) return null;
  const t = Date.parse(v.length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isNaN(t) ? null : t;
}

class Collector {
  errors: Issue[] = [];
  warnings: Issue[] = [];
  private seen = new Map<string, number>();
  private max: number;
  // no parameter properties: Node's type stripping (used by the tests) does not support them
  constructor(max: number) { this.max = max; }
  add(severity: Severity, code: string, path: string, message: string) {
    const key = `${severity}:${code}`;
    const n = (this.seen.get(key) ?? 0) + 1;
    this.seen.set(key, n);
    if (n <= this.max) (severity === 'error' ? this.errors : this.warnings).push({ severity, code, path, message });
  }
  error(code: string, path: string, message: string) { this.add('error', code, path, message); }
  warn(code: string, path: string, message: string) { this.add('warning', code, path, message); }
  /** appends "and N more" lines for codes that were capped */
  finish() {
    for (const [key, n] of this.seen) {
      if (n <= this.max) continue;
      const [severity, code] = key.split(':') as [Severity, string];
      (severity === 'error' ? this.errors : this.warnings).push({ severity, code, path: '', message: `…and ${n - this.max} more of this kind (${n} in total).` });
    }
  }
}

export function validateDataset(input: unknown, opts: ValidateOptions = {}): ValidationReport {
  const allowed = opts.allowedStatuses ?? VERIFIED_STATUSES;
  const now = (opts.now ?? new Date()).getTime();
  const c = new Collector(opts.maxPerCode ?? 5);
  const counts: Record<string, number> = {};
  const done = (): ValidationReport => { c.finish(); return { ok: c.errors.length === 0, errors: c.errors, warnings: c.warnings, counts }; };

  if (!isObj(input)) { c.error('not-an-object', '', 'The dataset must be a JSON object.'); return done(); }
  const ds = input;

  /* ---------------------------------------------------------------- shape */
  for (const k of Object.keys(ds)) if (!KNOWN_TOP.has(k)) c.warn('unknown-field', k, `Unknown top-level field "${k}" is ignored.`);
  let shapeOk = true;
  for (const k of TABLES) {
    if (!Array.isArray(ds[k])) { c.error('missing-array', k, `Required array "${k}" is missing or not an array.`); shapeOk = false; }
    else counts[k] = (ds[k] as unknown[]).length;
  }
  if (ds.benchmarks !== undefined && !Array.isArray(ds.benchmarks)) { c.error('missing-array', 'benchmarks', '"benchmarks" must be an array when present.'); shapeOk = false; }

  /* ---------------------------------------------------------------- provenance */
  const P = ds.provenance;
  let covFrom: number | null = null, covTo: number | null = null;
  let status: ValidationStatus | null = null;
  if (!isObj(P)) { c.error('missing-provenance', 'provenance', 'Provenance is required.'); }
  else {
    for (const k of ['datasetId', 'label', 'source'] as const) if (!isStr(P[k])) c.error('provenance-field', `provenance.${k}`, `provenance.${k} must be a non-empty string.`);
    if (!STATUSES.includes(P.status as ValidationStatus)) c.error('status-invalid', 'provenance.status', `Unknown status "${String(P.status)}".`);
    else {
      status = P.status as ValidationStatus;
      if (!allowed.includes(status)) c.error('status-not-allowed', 'provenance.status', `Status "${status}" is not accepted here; expected ${allowed.join(' or ')}.`);
    }
    const cov = P.coverage;
    if (!isObj(cov)) c.error('coverage-missing', 'provenance.coverage', 'Coverage dates are required.');
    else {
      covFrom = parseIsoDate(cov.from);
      covTo = parseIsoDate(cov.to);
      if (covFrom === null) c.error('date-invalid', 'provenance.coverage.from', `coverage.from must be a real date in YYYY-MM-DD form (got ${JSON.stringify(cov.from)}).`);
      if (covTo === null) c.error('date-invalid', 'provenance.coverage.to', `coverage.to must be a real date in YYYY-MM-DD form (got ${JSON.stringify(cov.to)}).`);
      if (covFrom !== null && covTo !== null && covFrom > covTo) c.error('coverage-order', 'provenance.coverage', 'coverage.from is after coverage.to.');
    }
    const verifiedStatus = status === 'reconciled' || status === 'approved';
    if (P.producedAt === null || P.producedAt === undefined) {
      if (verifiedStatus) c.error('produced-missing', 'provenance.producedAt', 'A reconciled or approved export must state when it was produced.');
    } else {
      const t = parseIsoDateTime(P.producedAt);
      if (t === null) c.error('date-invalid', 'provenance.producedAt', `producedAt must be an ISO date or date-time (got ${JSON.stringify(P.producedAt)}).`);
      else {
        if (t > now + 86_400_000) c.error('produced-future', 'provenance.producedAt', 'producedAt is in the future.');
        if (covTo !== null && t < covTo) c.warn('produced-before-coverage-end', 'provenance.producedAt', 'The export is dated before the end of its own coverage.');
      }
    }
    if (P.currency !== undefined && P.currency !== 'USD') c.error('currency', 'provenance.currency', `The site formats US dollars only (got ${JSON.stringify(P.currency)}).`);
    if (P.currency === undefined && verifiedStatus) c.warn('currency-unstated', 'provenance.currency', 'Currency is not stated; monetary values are shown as US dollars.');
    if (!Array.isArray(P.notes) || !P.notes.every((n) => typeof n === 'string')) c.error('provenance-field', 'provenance.notes', 'provenance.notes must be an array of strings.');
  }
  if (!shapeOk) return done();

  const D = ds as unknown as SupplyChainDataset;
  const rows = <T = Rec>(k: (typeof TABLES)[number]) => ds[k] as unknown as T[];

  /* ---------------------------------------------------------------- months and years */
  const months = rows('months');
  if (!months.length) c.error('empty-table', 'months', 'At least one month is required.');
  let monthsOk = true;
  let prevKey: number | null = null;
  months.forEach((mo, i) => {
    const p = `months[${i}]`;
    if (!isObj(mo)) { c.error('type', p, 'Each month must be an object.'); monthsOk = false; return; }
    if (mo.i !== i) { c.error('month-index', `${p}.i`, `Month i must equal its position (${i}); got ${JSON.stringify(mo.i)}.`); monthsOk = false; }
    if (!isInt(mo.y)) { c.error('type', `${p}.y`, 'Year must be an integer.'); monthsOk = false; }
    if (!isInt(mo.m) || mo.m < 0 || mo.m > 11) { c.error('month-range', `${p}.m`, 'Month m must be an integer from 0 (January) to 11 (December).'); monthsOk = false; }
    if (isInt(mo.y) && isInt(mo.m) && mo.m >= 0 && mo.m <= 11 && mo.label !== monthLabel(mo.y, mo.m)) c.error('month-label', `${p}.label`, `Month label must be "${monthLabel(mo.y, mo.m)}" (three-letter English month and year); got ${JSON.stringify(mo.label)}.`);
    if (isInt(mo.y) && isInt(mo.m)) {
      const key = mo.y * 12 + mo.m;
      if (prevKey !== null && key !== prevKey + 1) { c.error('month-sequence', p, key <= prevKey ? 'Months repeat or go backwards; they must be in calendar order.' : 'A month is missing from the sequence; months must be consecutive.'); monthsOk = false; }
      prevKey = key;
    }
  });
  if (monthsOk && months.length) {
    const first = months[0] as { y: number; m: number }, last = months[months.length - 1] as { y: number; m: number };
    const inMonth = (t: number, mo: { y: number; m: number }) => { const d = new Date(t); return d.getUTCFullYear() === mo.y && d.getUTCMonth() === mo.m; };
    if (covFrom !== null && !inMonth(covFrom, first)) c.error('coverage-mismatch', 'provenance.coverage.from', 'coverage.from does not fall in the first month of the data.');
    if (covTo !== null && !inMonth(covTo, last)) c.error('coverage-mismatch', 'provenance.coverage.to', 'coverage.to does not fall in the last month of the data.');
    if (months.length > DIAL_CAPACITY) c.warn('dial-capacity', 'months', `The homepage dial shows the first ${DIAL_CAPACITY} of ${months.length} months.`);
  }
  const years = rows<unknown>('years');
  if (!years.every(isInt)) c.error('type', 'years', 'Years must be integers.');
  else if (monthsOk) {
    const expected = [...new Set(months.map((m) => (m as { y: number }).y))];
    if (years.length !== expected.length || years.some((y, i) => y !== expected[i])) c.error('years-mismatch', 'years', `years must list the calendar years present in months, in order: [${expected.join(', ')}].`);
  }

  /* ---------------------------------------------------------------- dimensions */
  const namesList = (k: 'territories' | 'categories') => {
    const a = rows<unknown>(k);
    if (!a.length) c.error('empty-table', k, `At least one entry is required in ${k}.`);
    const seen = new Set<string>();
    a.forEach((v, i) => {
      if (!isStr(v)) { c.error('type', `${k}[${i}]`, 'Must be a non-empty string.'); return; }
      const key = v.trim().toLowerCase();
      if (seen.has(key)) c.error('duplicate', `${k}[${i}]`, `Duplicate name "${v}".`);
      seen.add(key);
    });
    return a.length;
  };
  const nT = namesList('territories');
  const nC = namesList('categories');
  const nM = months.length;
  const ref = (v: unknown, n: number) => isInt(v) && v >= 0 && v < n;
  const finite = (o: Rec, k: string, p: string) => { if (!isNum(o[k])) { c.error('type', `${p}.${k}`, `${k} must be a finite number.`); return false; } return true; };
  const count = (o: Rec, k: string, p: string) => { if (!isInt(o[k]) || (o[k] as number) < 0) { c.error('count', `${p}.${k}`, `${k} is a count and must be a non-negative integer.`); return false; } return true; };
  const label = (o: Rec, p: string) => { if (!isStr(o.label)) c.error('type', `${p}.label`, 'label must be a non-empty string.'); };
  /** a duration measured forward from an order date; negative usually means a date error */
  const duration = (o: Rec, k: string, p: string) => { if (finite(o, k, p) && (o[k] as number) < 0) c.warn('negative-duration', `${p}.${k}`, `${k} is negative (${o[k]}); check the dates it was computed from.`); };

  /* ---------------------------------------------------------------- sales facts */
  const facts = rows('facts');
  if (!facts.length) c.error('empty-table', 'facts', 'Sales facts are required: the homepage dial and the Observatory are built from them.');
  const factKeys = new Set<string>();
  facts.forEach((x, i) => {
    const p = `facts[${i}]`;
    if (!isObj(x)) { c.error('type', p, 'Each fact must be an object.'); return; }
    if (!ref(x.mi, nM)) c.error('reference', `${p}.mi`, `mi must point to a month (0–${nM - 1}).`);
    if (!ref(x.t, nT)) c.error('reference', `${p}.t`, `t must point to a customer segment (0–${nT - 1}).`);
    if (!ref(x.c, nC)) c.error('reference', `${p}.c`, `c must point to a product family (0–${nC - 1}).`);
    finite(x, 'revenue', p); finite(x, 'profit', p); finite(x, 'units', p);
    count(x, 'lossLines', p);
    if (finite(x, 'loss', p) && (x.loss as number) < 0) c.error('loss-negative', `${p}.loss`, 'loss is the absolute value of negative profit, so it cannot be negative.');
    const okOrd = count(x, 'ordered', p);
    if (finite(x, 'unmet', p)) {
      if ((x.unmet as number) < 0) c.warn('unmet-negative', `${p}.unmet`, 'More units were picked than ordered in this cell.');
      if (okOrd && (x.unmet as number) > (x.ordered as number)) c.error('unmet-exceeds-ordered', p, 'unmet units cannot exceed ordered units.');
    }
    const key = `${x.mi}|${x.t}|${x.c}`;
    if (factKeys.has(key)) c.error('duplicate', p, `Duplicate fact for month ${x.mi}, segment ${x.t}, family ${x.c}; the grain is one row per month × segment × family.`);
    factKeys.add(key);
  });

  /* ---------------------------------------------------------------- order facts */
  const ofs = rows('orderFacts');
  if (!ofs.length) c.warn('empty-table', 'orderFacts', 'No order facts: the Orders domain will be empty.');
  const ofKeys = new Set<string>();
  ofs.forEach((x, i) => {
    const p = `orderFacts[${i}]`;
    if (!isObj(x)) { c.error('type', p, 'Each order fact must be an object.'); return; }
    if (!ref(x.mi, nM)) c.error('reference', `${p}.mi`, `mi must point to a month (0–${nM - 1}).`);
    if (!ref(x.t, nT)) c.error('reference', `${p}.t`, `t must point to a customer segment (0–${nT - 1}).`);
    const okO = count(x, 'orders', p), okB = count(x, 'backorders', p), okD = count(x, 'deliveries', p), okT = count(x, 'onTime', p);
    if (okO && okB && (x.backorders as number) > (x.orders as number)) c.error('backorders-exceed-orders', p, 'backorders counts orders with a backorder, so it cannot exceed orders.');
    if (okD && okT && (x.onTime as number) > (x.deliveries as number)) c.error('on-time-exceeds-deliveries', p, 'onTime counts deliveries, so it cannot exceed deliveries.');
    const key = `${x.mi}|${x.t}`;
    if (ofKeys.has(key)) c.error('duplicate', p, `Duplicate order fact for month ${x.mi}, segment ${x.t}; the grain is one row per month × segment.`);
    ofKeys.add(key);
  });

  /* ---------------------------------------------------------------- suppliers and purchase orders */
  const suppliers = rows('suppliers');
  const supLabels = new Set<string>();
  suppliers.forEach((s, i) => {
    const p = `suppliers[${i}]`;
    if (!isObj(s)) { c.error('type', p, 'Each supplier must be an object.'); return; }
    if (s.id !== i) c.error('supplier-id', `${p}.id`, `Supplier id must equal its position (${i}); purchase orders refer to suppliers by position.`);
    label(s, p);
    if (isStr(s.label)) { if (supLabels.has(s.label)) c.warn('duplicate-label', `${p}.label`, `Two suppliers share the label "${s.label}"; charts will not tell them apart.`); supLabels.add(s.label); }
    if (!isStr(s.group)) c.error('type', `${p}.group`, `group must name the supplier category (got ${JSON.stringify(s.group)}).`);
    duration(s, 'promise', p);
  });
  const pos = rows('purchaseOrders');
  if (!pos.length) c.warn('empty-table', 'purchaseOrders', 'No purchase orders: the Purchasing and Suppliers domains will be empty.');
  const poIds = new Set<number>();
  let inconsistent = 0;
  pos.forEach((o, i) => {
    const p = `purchaseOrders[${i}]`;
    if (!isObj(o)) { c.error('type', p, 'Each purchase order must be an object.'); return; }
    if (o.id !== undefined) {
      if (!isInt(o.id)) c.error('type', `${p}.id`, 'id must be an integer when present.');
      else { if (poIds.has(o.id)) c.error('duplicate', `${p}.id`, `Duplicate purchase order id ${o.id}.`); poIds.add(o.id); }
    }
    if (!ref(o.mi, nM)) c.error('reference', `${p}.mi`, `mi must point to a month (0–${nM - 1}).`);
    if (!ref(o.s, suppliers.length)) c.error('reference', `${p}.s`, `s must point to a supplier (0–${suppliers.length - 1}).`);
    finite(o, 'spend', p);
    count(o, 'lines', p);
    duration(o, 'expectedDays', p);
    if (o.leadDays === null) {
      if (o.onTime !== null) c.error('type', `${p}.onTime`, 'onTime must be null while the order is not fully received (leadDays is null).');
    } else {
      duration(o, 'leadDays', p);
      if (typeof o.onTime !== 'boolean') c.error('type', `${p}.onTime`, 'onTime must be true or false for a received order.');
      else if (isNum(o.leadDays) && isNum(o.expectedDays) && o.onTime !== o.leadDays <= o.expectedDays) inconsistent++;
    }
    if (o.outers !== undefined || o.received !== undefined) {
      const okA = count(o, 'outers', p), okR = count(o, 'received', p);
      if (okA && okR && (o.received as number) > (o.outers as number)) c.warn('over-received', p, `More outer packs received (${o.received}) than ordered (${o.outers}).`);
    }
  });
  if (inconsistent) c.warn('on-time-inconsistent', 'purchaseOrders', `${inconsistent} purchase order(s) have onTime that disagrees with leadDays ≤ expectedDays. On-time receipt and days late will not agree for them.`);

  /* ---------------------------------------------------------------- items */
  const items = rows('items');
  if (!items.length) c.warn('empty-table', 'items', 'No stock items: the Inventory domain will be empty.');
  const itemIds = new Set<number>();
  items.forEach((it, i) => {
    const p = `items[${i}]`;
    if (!isObj(it)) { c.error('type', p, 'Each item must be an object.'); return; }
    if (!isInt(it.id)) c.error('type', `${p}.id`, 'id must be an integer.');
    else { if (itemIds.has(it.id)) c.error('duplicate', `${p}.id`, `Duplicate stock item id ${it.id}.`); itemIds.add(it.id); }
    label(it, p);
    if (!ref(it.c, nC)) c.error('reference', `${p}.c`, `c must point to a product family (0–${nC - 1}).`);
    if (it.s !== undefined && it.s !== null && !ref(it.s, suppliers.length)) c.error('reference', `${p}.s`, `s must point to a supplier (0–${suppliers.length - 1}) or be null.`);
    if (it.sales !== undefined) {
      if (!isObj(it.sales)) c.error('type', `${p}.sales`, 'sales must be an object when present.');
      else {
        const sp = `${p}.sales`;
        for (const k of ['revenue', 'profit', 'loss']) finite(it.sales, k, sp);
        for (const k of ['units', 'lossLines', 'ordered']) count(it.sales, k, sp);
        finite(it.sales, 'unmet', sp);
      }
    }
    finite(it, 'onHand', p); finite(it, 'unitCost', p);
    for (const k of ['reorder', 'monthlyUse']) if (finite(it, k, p) && (it[k] as number) < 0) c.warn('negative-level', `${p}.${k}`, `${k} is negative (${it[k]}).`);
  });

  /* ---------------------------------------------------------------- customers */
  const customers = rows('customers');
  if (!customers.length) c.warn('empty-table', 'customers', 'No customers: the Customers domain will be empty.');
  const custTerr = new Map<number, number>();
  customers.forEach((cu, i) => {
    const p = `customers[${i}]`;
    if (!isObj(cu)) { c.error('type', p, 'Each customer must be an object.'); return; }
    if (!isInt(cu.id)) c.error('type', `${p}.id`, 'id must be an integer.');
    else { if (custTerr.has(cu.id)) c.error('duplicate', `${p}.id`, `Duplicate customer id ${cu.id}.`); custTerr.set(cu.id, cu.t as number); }
    label(cu, p);
    if (!ref(cu.t, nT)) c.error('reference', `${p}.t`, `t must point to a customer segment (0–${nT - 1}).`);
  });
  const cfs = rows('customerFacts');
  const cfKeys = new Set<string>();
  cfs.forEach((x, i) => {
    const p = `customerFacts[${i}]`;
    if (!isObj(x)) { c.error('type', p, 'Each customer fact must be an object.'); return; }
    if (!ref(x.mi, nM)) c.error('reference', `${p}.mi`, `mi must point to a month (0–${nM - 1}).`);
    if (!isInt(x.cu) || !custTerr.has(x.cu)) c.error('reference', `${p}.cu`, `cu must be the id of a customer (got ${JSON.stringify(x.cu)}).`);
    finite(x, 'revenue', p);
    count(x, 'orders', p);
    const key = `${x.mi}|${x.cu}`;
    if (cfKeys.has(key)) c.error('duplicate', p, `Duplicate customer fact for month ${x.mi}, customer ${x.cu}; the grain is one row per month × customer.`);
    cfKeys.add(key);
  });

  /* ---------------------------------------------------------------- missing-value notes */
  rows('missing').forEach((n, i) => {
    const p = `missing[${i}]`;
    if (!isObj(n) || !isStr(n.field) || typeof n.note !== 'string' || !isInt(n.count) || n.count < 0) c.error('type', p, 'Each missing-value note needs field (string), count (non-negative integer) and note (string).');
  });

  /* ---------------------------------------------------------------- cross-table reconciliation */
  const structural = c.errors.length === 0;
  if (structural && cfs.length) {
    const sales = new Map<string, number>(), cust = new Map<string, number>();
    D.facts.forEach((x) => { const k = `${x.mi}|${x.t}`; sales.set(k, (sales.get(k) ?? 0) + x.revenue); });
    D.customerFacts.forEach((x) => { const k = `${x.mi}|${custTerr.get(x.cu)}`; cust.set(k, (cust.get(k) ?? 0) + x.revenue); });
    let off = 0, worst = '';
    for (const k of new Set([...sales.keys(), ...cust.keys()])) {
      const a = sales.get(k) ?? 0, b = cust.get(k) ?? 0;
      if (Math.abs(a - b) > Math.max(CUSTOMER_RECONCILE_TOLERANCE * Math.abs(a), 0.01)) { off++; if (!worst) worst = k; }
    }
    if (off) {
      const [mi, t] = worst.split('|').map(Number);
      c.warn('customer-revenue-unreconciled', 'customerFacts', `Customer revenue differs from sales revenue by more than ${CUSTOMER_RECONCILE_TOLERANCE * 100}% in ${off} month × segment cell(s), first in ${D.months[mi]?.label ?? `month ${mi}`}, ${D.territories[t] ?? `segment ${t}`}.`);
    }
  }

  /* ---------------------------------------------------------------- benchmarks */
  const benchmarks = (ds.benchmarks as unknown[] | undefined) ?? [];
  counts.benchmarks = benchmarks.length;
  if ((status === 'reconciled' || status === 'approved') && !benchmarks.length) c.warn('no-benchmarks', 'benchmarks', 'No benchmarks supplied, so the site cannot confirm that this export matches the team KPI benchmark.');
  benchmarks.forEach((b, i) => {
    const p = `benchmarks[${i}]`;
    if (!isObj(b)) { c.error('type', p, 'Each benchmark must be an object.'); return; }
    const def = typeof b.metric === 'string' ? METRICS[b.metric] : undefined;
    if (!def) { c.error('benchmark-metric', `${p}.metric`, `Unknown metric ${JSON.stringify(b.metric)}; it must be an id in the metric registry.`); return; }
    if (b.unit !== def.unit) c.error('benchmark-unit', `${p}.unit`, `${def.id} is measured in ${def.unit}; the benchmark says ${JSON.stringify(b.unit)}.`);
    if (!isNum(b.value)) c.error('type', `${p}.value`, 'value must be a finite number.');
    if (b.tolerance !== undefined && (!isNum(b.tolerance) || b.tolerance < 0)) c.error('type', `${p}.tolerance`, 'tolerance must be a non-negative number.');
    if (!isStr(b.source)) c.error('type', `${p}.source`, 'source must say where the benchmark value comes from.');
    const scope: Scope = { year: null, territory: null, category: null };
    let scopeOk = true;
    if (b.scope !== undefined) {
      if (!isObj(b.scope)) { c.error('type', `${p}.scope`, 'scope must be an object.'); return; }
      const sc = b.scope;
      for (const k of Object.keys(sc)) if (!['year', 'territory', 'category'].includes(k)) { c.error('benchmark-scope', `${p}.scope.${k}`, `Unknown scope key "${k}".`); scopeOk = false; }
      if (sc.year !== undefined) { if (!isInt(sc.year) || !(D.years as unknown[]).includes(sc.year)) { c.error('benchmark-scope', `${p}.scope.year`, `year ${JSON.stringify(sc.year)} is not in the data.`); scopeOk = false; } else scope.year = sc.year; }
      if (sc.territory !== undefined) { const t = D.territories.indexOf(sc.territory as string); if (t < 0) { c.error('benchmark-scope', `${p}.scope.territory`, `Unknown customer segment ${JSON.stringify(sc.territory)}.`); scopeOk = false; } else scope.territory = t; }
      if (sc.category !== undefined) { const k = D.categories.indexOf(sc.category as string); if (k < 0) { c.error('benchmark-scope', `${p}.scope.category`, `Unknown product family ${JSON.stringify(sc.category)}.`); scopeOk = false; } else scope.category = k; }
      const applies = MEASURES[def.id].applies;
      for (const k of ['year', 'territory', 'category'] as const) if (sc[k] !== undefined && !applies.includes(k)) { c.error('benchmark-scope', `${p}.scope.${k}`, `${def.label.en} cannot be filtered by ${k}.`); scopeOk = false; }
    }
    if (!structural || !scopeOk || !isNum(b.value) || b.unit !== def.unit) return;
    const got = computeMetric(D, def.id, scope);
    const tol = isNum(b.tolerance) ? b.tolerance : DEFAULT_TOLERANCE;
    if (Math.abs(got - b.value) > Math.max(tol * Math.abs(b.value), 1e-9)) {
      c.error('benchmark-mismatch', p, `${def.label.en}${describeScope(b.scope as Rec | undefined)}: the export gives ${round(got)}, the benchmark says ${round(b.value)} (tolerance ${tol * 100}%).`);
    }
  });

  return done();
}

const round = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(2) : v.toPrecision(6));
const describeScope = (s?: Rec) => (s && Object.keys(s).length ? ` (${Object.entries(s).map(([k, v]) => `${k} ${v}`).join(', ')})` : '');

/** Checks the metric registry itself: unique ids, known units, wording present, and a measure behind each one. */
export function validateRegistry(list: MetricDefinition[] = ALL_METRICS): Issue[] {
  const out: Issue[] = [];
  const ids = new Set<string>();
  list.forEach((m, i) => {
    const p = `metrics[${i}]`;
    const e = (code: string, message: string) => out.push({ severity: 'error', code, path: p, message });
    if (!/^[a-z][a-z0-9_]*$/.test(m.id)) e('metric-id', `Metric id "${m.id}" must be snake_case.`);
    if (ids.has(m.id)) e('duplicate', `Duplicate metric id "${m.id}".`);
    ids.add(m.id);
    if (!UNITS.includes(m.unit)) e('metric-unit', `${m.id}: unknown unit "${m.unit}".`);
    if (!['up', 'down', 'neutral'].includes(m.better)) e('metric-direction', `${m.id}: better must be up, down or neutral.`);
    if (!['proposed', 'approved'].includes(m.status)) e('metric-status', `${m.id}: status must be proposed or approved.`);
    if (!m.label.en.trim() || !m.label.ar.trim() || !m.definition.en.trim() || !m.definition.ar.trim() || !m.formula.trim()) e('metric-wording', `${m.id}: label and definition (English and Arabic) and formula are required.`);
    if (!['team', 'website'].includes(m.origin)) e('metric-origin', `${m.id}: origin must be team or website.`);
    if (!MEASURES[m.id]) e('metric-measure', `${m.id}: no measure implements this metric.`);
  });
  for (const id of Object.keys(MEASURES)) if (!ids.has(id)) out.push({ severity: 'error', code: 'measure-orphan', path: `measures.${id}`, message: `Measure "${id}" has no registry definition.` });
  return out;
}
