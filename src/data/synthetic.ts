/**
 * SYNTHETIC DEMO DATA — generated in the browser from a fixed seed.
 *
 * Nothing in this file is derived from the project's databases, CSV exports or Power BI model.
 * Segment and family *names* match the real dataset so both views read the same way; every number
 * here is invented. Do not quote any figure from this module
 * as a project result.
 *
 * Only `syntheticDataset` is exported, and only `adapter.ts` imports it. Pages, the scene and
 * charts receive data from the adapter, so a verified view can never pick up these values.
 * The dataset follows the same contract as a verified export (`docs/export-contract.md`) and passes
 * the same validator, apart from its `synthetic` status.
 */
import { rng, gauss } from '../lib/rng';
import type { Customer, CustomerFact, Month, OrderFact, PurchaseOrder, SalesFact, StockItem, Supplier, SupplyChainDataset } from './types';

const START_YEAR = 2013;
/** The demo window mirrors the public sample (Jan 2013 to May 2016). */
const DATA_MONTHS = 41;
const SEED = 20130101;

const MONTHS: Month[] = Array.from({ length: DATA_MONTHS }, (_, i) => {
  const y = START_YEAR + Math.floor(i / 12);
  const m = i % 12;
  return { i, y, m, label: new Date(Date.UTC(y, m, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) + ' ' + y };
});
const YEARS = [2013, 2014, 2015, 2016];

/** customer segments (axis t) and product families (axis c), the same names as the real dataset */
const TERRITORIES = ['Novelty Shop', 'Supermarket', 'Gift Store', 'Computer Store', 'Corporate'];
const TERR_W = [1.0, 0.62, 0.55, 0.5, 0.46];

const CATEGORIES = ['USB & desk novelties', 'Joke mugs', 'Toys', 'Novelty footwear', 'Halloween masks', 'Apparel', 'Confectionery', 'Packaging & shipping'];
const CAT_W = [0.6, 0.42, 0.7, 0.5, 0.45, 0.9, 0.3, 1.0];
const CAT_MARGIN = [0.52, 0.56, 0.38, 0.61, 0.33, 0.44, 0.47, 0.31];
const CAT_PRICE = [26, 11, 24, 19, 18, 32, 9, 14];

const r = rng(SEED);
const season = (m: number) => 1 + 0.16 * Math.sin(((m - 2) / 12) * Math.PI * 2) + (m === 10 ? 0.12 : 0) + (m === 11 ? 0.22 : 0);
const trend = (mi: number) => 1 + mi * 0.0105;

const FACTS: SalesFact[] = [];
for (const mo of MONTHS) {
  for (let t = 0; t < TERRITORIES.length; t++) {
    for (let c = 0; c < CATEGORIES.length; c++) {
      const noise = Math.max(0.55, 1 + gauss(r) * 0.11);
      const revenue = 41000 * TERR_W[t] * CAT_W[c] * season(mo.m) * trend(mo.i) * noise;
      const margin = Math.min(0.68, Math.max(0.12, CAT_MARGIN[c] + gauss(r) * 0.035));
      const units = Math.round(revenue / (CAT_PRICE[c] * (0.92 + r() * 0.16)));
      const short = 0.01 + r() * 0.05;
      const lossLines = Math.floor(r() * 6);
      const ordered = Math.round(units * (1 + short));
      FACTS.push({ mi: mo.i, t, c, revenue, profit: revenue * margin, units, lossLines, loss: lossLines * (40 + r() * 160), ordered, unmet: ordered - units });
    }
  }
}

const ORDER_FACTS: OrderFact[] = [];
{
  const ro = rng(6060);
  for (const mo of MONTHS) for (let t = 0; t < TERRITORIES.length; t++) {
    const units = FACTS.filter((x) => x.mi === mo.i && x.t === t).reduce((a, x) => a + x.units, 0);
    const orders = Math.max(1, Math.round(units / (24 + ro() * 10)));
    const boRate = 0.035 + 0.03 * Math.max(0, Math.sin(mo.i / 6.5)) + (mo.m === 11 ? 0.025 : 0) + ro() * 0.012;
    const deliveries = Math.round(orders * (0.94 + ro() * 0.05));
    ORDER_FACTS.push({ mi: mo.i, t, orders, backorders: Math.round(orders * boRate), deliveries, onTime: Math.round(deliveries * (0.82 + ro() * 0.14)) });
  }
}

/* Suppliers. Reliability and spend weight drive the generator only; they are not part of the contract. */
const SUPPLIER_GEN = Array.from({ length: 10 }, (_, i) => {
  const rr = rng(700 + i);
  const promise = [7, 10, 14, 14, 21, 10, 7, 28, 14, 21][i];
  return { promise, reliability: 0.62 + rr() * 0.34, weight: 0.4 + rr() * 1.1 };
});
const SUPPLIERS: Supplier[] = SUPPLIER_GEN.map((g, i) => ({ id: i, label: `Supplier ${String(i + 1).padStart(2, '0')}`, group: 'Demo supplier', promise: g.promise }));

const POS: PurchaseOrder[] = [];
{
  const rp = rng(9090);
  for (const mo of MONTHS) {
    for (const s of SUPPLIERS) {
      const g = SUPPLIER_GEN[s.id];
      const n = 2 + Math.floor(rp() * 3);
      for (let k = 0; k < n; k++) {
        const late = rp() > g.reliability;
        const raw = Math.max(2, Math.round(g.promise * (late ? 1.15 + rp() * 0.7 : 0.7 + rp() * 0.32)));
        // an on-time order arrives on or before its expected day, by the on-time receipt definition
        const leadDays = late ? raw : Math.min(g.promise, raw);
        const outers = 20 + Math.floor(rp() * 400);
        POS.push({ id: POS.length + 1, mi: mo.i, s: s.id, spend: 9000 * g.weight * season(mo.m) * (0.6 + rp() * 0.8), lines: 3 + Math.floor(rp() * 14), leadDays, expectedDays: g.promise, onTime: !late, outers, received: mo.i > DATA_MONTHS - 2 ? Math.floor(outers * rp()) : outers });
      }
    }
  }
}

const ITEMS: StockItem[] = Array.from({ length: 64 }, (_, i) => {
  const ri = rng(4400 + i);
  const c = Math.floor(ri() * CATEGORIES.length);
  const reorder = Math.round(40 + ri() * 360);
  const ratio = Math.exp(gauss(ri) * 0.55 + 0.35);
  const onHand = Math.max(0, Math.round(reorder * ratio));
  const monthlyUse = Math.round(reorder * (0.35 + ri() * 0.6));
  return { id: 1000 + i * 7, label: `Item ${1000 + i * 7}`, c, reorder, onHand, monthlyUse, unitCost: CAT_PRICE[c] * (0.45 + ri() * 0.2) };
});

/* Customers. Each territory's monthly revenue is shared among the customers who bought that month,
 * so customer revenue reconciles exactly with the sales facts, as a real export must. */
const N_CUSTOMERS = 240;
const CUSTOMER_GEN = Array.from({ length: N_CUSTOMERS }, (_, i) => {
  const rc = rng(31000 + i);
  const t = i < TERRITORIES.length ? i : Math.floor(rc() * TERRITORIES.length);
  return { t, weight: Math.pow(rc(), 2.4) + 0.02, activity: rc() > 0.22 ? 0.55 + rc() * 0.4 : 0.06 + rc() * 0.08 };
});
const CUSTOMERS: Customer[] = CUSTOMER_GEN.map((g, i) => ({ id: 100 + i * 13, label: `Customer ${String(100 + i * 13).padStart(4, '0')}`, t: g.t }));

const CUSTOMER_FACTS: CustomerFact[] = [];
{
  const ra = rng(52000);
  const terrMonth = new Map<string, { revenue: number; orders: number }>();
  for (const x of FACTS) {
    const k = `${x.mi}:${x.t}`;
    const a = terrMonth.get(k) ?? { revenue: 0, orders: 0 };
    a.revenue += x.revenue; a.orders += Math.max(1, Math.round(x.units / 30));
    terrMonth.set(k, a);
  }
  const byTerr = TERRITORIES.map((_, t) => CUSTOMER_GEN.map((g, i) => ({ g, i })).filter((x) => x.g.t === t));
  for (const mo of MONTHS) {
    byTerr.forEach((members, t) => {
      const tot = terrMonth.get(`${mo.i}:${t}`);
      if (!tot || !members.length) return;
      let active = members.filter((x) => ra() < x.g.activity);
      if (!active.length) active = [members.reduce((a, b) => (b.g.weight > a.g.weight ? b : a))];
      const w = active.map((x) => x.g.weight * (0.7 + ra() * 0.6));
      const wSum = w.reduce((s, v) => s + v, 0);
      active.forEach((x, k) => {
        const share = w[k] / wSum;
        CUSTOMER_FACTS.push({ mi: mo.i, cu: CUSTOMERS[x.i].id, revenue: tot.revenue * share, orders: Math.max(1, Math.round(tot.orders * share)) });
      });
    });
  }
}

export const syntheticDataset: SupplyChainDataset = {
  provenance: {
    datasetId: `synthetic-seed-${SEED}`,
    label: 'Synthetic demo dataset',
    status: 'synthetic',
    source: 'Generated in the browser from a fixed seed. Not derived from project data.',
    coverage: { from: '2013-01-01', to: '2016-05-31' },
    producedAt: null,
    currency: 'USD',
    notes: [
      'Segment and family names match the real dataset; all values are invented.',
      'Customer and supplier names are placeholders.',
      'Inventory is a single snapshot, not a time series.',
    ],
  },
  months: MONTHS,
  years: YEARS,
  territories: TERRITORIES,
  categories: CATEGORIES,
  facts: FACTS,
  orderFacts: ORDER_FACTS,
  purchaseOrders: POS,
  suppliers: SUPPLIERS,
  items: ITEMS,
  customers: CUSTOMERS,
  customerFacts: CUSTOMER_FACTS,
  missing: [],
};
