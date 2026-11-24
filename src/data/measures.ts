import type { CustomerFact, OrderFact, PurchaseOrder, SalesFact, StockItem, SupplyChainDataset } from './types';

/**
 * One implementation of every metric in the registry (`metrics.ts`).
 *
 * The Observatory computes its KPIs with these reducers, and the validator uses the same ones to
 * recompute the team's benchmarks, so a reconciled number and a displayed number can never come
 * from two different formulas. Empty inputs return 0 rather than NaN, matching the charts.
 */
export const sum = <T>(a: readonly T[], k: (x: T) => number) => a.reduce((s, x) => s + k(x), 0);
export const div = (a: number, b: number) => (b ? a / b : 0);
export const median = (a: number[]) => {
  const s = a.slice().sort((x, y) => x - y);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

/* ---- sales facts */
export const revenue = (r: SalesFact[]) => sum(r, (x) => x.revenue);
export const grossProfit = (r: SalesFact[]) => sum(r, (x) => x.profit);
export const grossMargin = (r: SalesFact[]) => div(grossProfit(r), revenue(r));
export const unitsSold = (r: SalesFact[]) => sum(r, (x) => x.units);
export const lossValue = (r: SalesFact[]) => sum(r, (x) => x.loss);
export const orderedUnits = (r: SalesFact[]) => sum(r, (x) => x.ordered);
export const unmetUnits = (r: SalesFact[]) => sum(r, (x) => x.unmet);
export const fillRate = (r: SalesFact[]) => (orderedUnits(r) ? 1 - div(unmetUnits(r), orderedUnits(r)) : 0);

/* ---- order facts */
export const orderCount = (r: OrderFact[]) => sum(r, (x) => x.orders);
export const backorderRate = (r: OrderFact[]) => div(sum(r, (x) => x.backorders), orderCount(r));
export const onTimeDelivery = (r: OrderFact[]) => div(sum(r, (x) => x.onTime), sum(r, (x) => x.deliveries));

/* ---- purchase orders */
const receivedPOs = (r: PurchaseOrder[]) => r.filter((p) => p.leadDays !== null);
export const spend = (r: PurchaseOrder[]) => sum(r, (p) => p.spend);
export const poCount = (r: PurchaseOrder[]) => r.length;
export const onTimeRate = (r: PurchaseOrder[]) => { const g = receivedPOs(r); return div(g.filter((p) => p.onTime).length, g.length); };
export const avgLead = (r: PurchaseOrder[]) => { const g = receivedPOs(r); return div(sum(g, (p) => p.leadDays as number), g.length); };
export const outersOrdered = (r: PurchaseOrder[]) => sum(r, (p) => p.outers ?? 0);
export const outersReceived = (r: PurchaseOrder[]) => sum(r, (p) => p.received ?? 0);
export const unreceivedOuters = (r: PurchaseOrder[]) => outersOrdered(r) - outersReceived(r);
export const receivedShare = (r: PurchaseOrder[]) => div(outersReceived(r), outersOrdered(r));
export const topSupplierShare = (r: PurchaseOrder[], n = 3) => {
  const by = new Map<number, number>();
  r.forEach((p) => by.set(p.s, (by.get(p.s) ?? 0) + p.spend));
  const v = [...by.values()].sort((a, b) => b - a);
  return div(sum(v.slice(0, n), (x) => x), sum(v, (x) => x));
};
export const activeSuppliers = (r: PurchaseOrder[]) => new Set(r.map((p) => p.s)).size;

/* ---- stock items (a snapshot) */
export const atReorder = (i: StockItem) => i.onHand <= i.reorder;
export const belowReorder = (r: StockItem[]) => r.filter(atReorder).length;
export const stockValue = (r: StockItem[]) => sum(r, (i) => i.onHand * i.unitCost);
/** months of cover; an item with no recent sales has unbounded cover and is left out of the median */
export const cover = (i: StockItem) => (i.monthlyUse > 0 ? i.onHand / i.monthlyUse : Infinity);
export const monthsCover = (r: StockItem[]) => median(r.map(cover).filter(Number.isFinite));
export const itemsTracked = (r: StockItem[]) => r.length;

/* ---- customer facts */
export const customerRevenue = (r: CustomerFact[]) => sum(r, (x) => x.revenue);
export const activeCustomers = (r: CustomerFact[]) => new Set(r.map((x) => x.cu)).size;
export const revenuePerCustomer = (r: CustomerFact[]) => div(customerRevenue(r), activeCustomers(r));
const customerTotals = (r: CustomerFact[]) => {
  const by = new Map<number, number>();
  r.forEach((x) => by.set(x.cu, (by.get(x.cu) ?? 0) + x.revenue));
  return [...by.values()].sort((a, b) => b - a);
};
export const topCustomerShare = (r: CustomerFact[], n = 10) => { const v = customerTotals(r); return div(sum(v.slice(0, n), (x) => x), sum(v, (x) => x)); };
export const topQuintileShare = (r: CustomerFact[]) => { const v = customerTotals(r); return div(sum(v.slice(0, Math.round(v.length * 0.2)), (x) => x), sum(v, (x) => x)); };

/* ------------------------------------------------------------------ registry binding */
export type ScopeKey = 'year' | 'territory' | 'category';
/** Scope in dataset positions; null means "all". */
export type Scope = { year: number | null; territory: number | null; category: number | null };
export type Table = 'facts' | 'orderFacts' | 'purchaseOrders' | 'items' | 'customerFacts';
type Measure = { table: Table; applies: ScopeKey[]; reduce: (rows: never[]) => number };
const m = <T>(table: Table, applies: ScopeKey[], reduce: (rows: T[]) => number): Measure => ({ table, applies, reduce: reduce as (rows: never[]) => number });
const ALL: ScopeKey[] = ['year', 'territory', 'category'];

/** Every registry metric, the table it is computed from, and the filters that apply to it. */
export const MEASURES: Record<string, Measure> = {
  revenue: m('facts', ALL, revenue),
  gross_profit: m('facts', ALL, grossProfit),
  gross_margin: m('facts', ALL, grossMargin),
  units_sold: m('facts', ALL, unitsSold),
  loss_value: m('facts', ALL, lossValue),
  fill_rate: m('facts', ALL, fillRate),
  unmet_units: m('facts', ALL, unmetUnits),
  orders: m('orderFacts', ['year', 'territory'], orderCount),
  backorder_rate: m('orderFacts', ['year', 'territory'], backorderRate),
  on_time_delivery: m('orderFacts', ['year', 'territory'], onTimeDelivery),
  purchase_spend: m('purchaseOrders', ['year'], spend),
  purchase_orders: m('purchaseOrders', ['year'], poCount),
  avg_lead_time: m('purchaseOrders', ['year'], avgLead),
  unreceived_outers: m('purchaseOrders', ['year'], unreceivedOuters),
  received_share: m('purchaseOrders', ['year'], receivedShare),
  on_time_receipt: m('purchaseOrders', ['year'], onTimeRate),
  top3_spend_share: m('purchaseOrders', ['year'], (r: PurchaseOrder[]) => topSupplierShare(r, 3)),
  active_suppliers: m('purchaseOrders', ['year'], activeSuppliers),
  items_below_reorder: m('items', ['category'], belowReorder),
  stock_value: m('items', ['category'], stockValue),
  months_cover: m('items', ['category'], monthsCover),
  items_tracked: m('items', ['category'], itemsTracked),
  active_customers: m('customerFacts', ['year', 'territory'], activeCustomers),
  revenue_per_customer: m('customerFacts', ['year', 'territory'], revenuePerCustomer),
  top10_share: m('customerFacts', ['year', 'territory'], (r: CustomerFact[]) => topCustomerShare(r, 10)),
  top_quintile_share: m('customerFacts', ['year', 'territory'], topQuintileShare),
};

/** Rows of one table inside a scope. `year` is a whole calendar year. Assumes a validated dataset. */
export function rowsInScope(ds: SupplyChainDataset, table: Table, s: Scope): unknown[] {
  const inYear = (mi: number) => s.year === null || ds.months[mi]?.y === s.year;
  switch (table) {
    case 'facts':
      return ds.facts.filter((x) => inYear(x.mi) && (s.territory === null || x.t === s.territory) && (s.category === null || x.c === s.category));
    case 'orderFacts':
      return ds.orderFacts.filter((x) => inYear(x.mi) && (s.territory === null || x.t === s.territory));
    case 'purchaseOrders':
      return ds.purchaseOrders.filter((p) => inYear(p.mi));
    case 'items':
      return ds.items.filter((i) => s.category === null || i.c === s.category);
    case 'customerFacts': {
      const seg = new Map(ds.customers.map((c) => [c.id, c.t]));
      return ds.customerFacts.filter((x) => inYear(x.mi) && (s.territory === null || seg.get(x.cu) === s.territory));
    }
  }
}

export function computeMetric(ds: SupplyChainDataset, id: string, s: Scope): number {
  const ms = MEASURES[id];
  if (!ms) throw new Error(`No measure for metric ${id}`);
  return ms.reduce(rowsInScope(ds, ms.table, s) as never[]);
}
