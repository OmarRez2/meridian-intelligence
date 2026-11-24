import type { SupplyChainDataset, StockItem } from './types';
import { sum, div, median, cover, revenue, grossProfit, grossMargin, fillRate, orderedUnits, unmetUnits, spend, backorderRate, onTimeDelivery, topCustomerShare, topQuintileShare, unreceivedOuters, belowReorder } from './measures';

/**
 * The website's own analysis of a validated dataset. Every finding on the Insights page and in the
 * presentation is computed here, from the same rows the Observatory shows, so the narrative can never drift
 * from the data. Pure functions, no DOM: `scripts/test-data.mjs` checks the headline values.
 *
 * Complete calendar years only for annual comparisons (the coverage ends in May 2016).
 */
export type Analysis = ReturnType<typeof analyse>;

const completeYears = (ds: SupplyChainDataset) => ds.years.filter((y) => ds.months.filter((m) => m.y === y).length === 12);

export function analyse(ds: SupplyChainDataset) {
  const years = completeYears(ds);
  const last = years[years.length - 1], prev = years[years.length - 2];
  const inYear = (y: number) => (mi: number) => ds.months[mi]?.y === y;
  const factsIn = (y: number) => ds.facts.filter((x) => inYear(y)(x.mi));

  /* ---- headline */
  const totals = {
    revenue: revenue(ds.facts), profit: grossProfit(ds.facts), margin: grossMargin(ds.facts), units: sum(ds.facts, (x) => x.units),
    fill: fillRate(ds.facts), ordered: orderedUnits(ds.facts), unmet: unmetUnits(ds.facts), onTime: onTimeDelivery(ds.orderFacts),
    orders: sum(ds.orderFacts, (x) => x.orders), backorder: backorderRate(ds.orderFacts), customers: new Set(ds.customerFacts.map((x) => x.cu)).size,
    items: ds.items.length, suppliers: new Set(ds.purchaseOrders.map((p) => p.s)).size, months: ds.months.length,
    lossLines: sum(ds.facts, (x) => x.lossLines), loss: sum(ds.facts, (x) => x.loss),
  };

  /* ---- annual growth, complete years */
  const annual = years.map((y) => { const f = factsIn(y); return { year: y, revenue: revenue(f), profit: grossProfit(f), margin: grossMargin(f) }; });
  const yoy = (a: number, b: number) => div(a - b, b);
  const growth = prev !== undefined ? { from: prev, to: last, revenue: yoy(revenue(factsIn(last)), revenue(factsIn(prev))), profit: yoy(grossProfit(factsIn(last)), grossProfit(factsIn(prev))), marginFrom: grossMargin(factsIn(prev)), marginTo: grossMargin(factsIn(last)) } : null;

  /* ---- segments: share and growth (last complete year on the one before) */
  const segments = ds.territories.map((label, t) => {
    const all = ds.facts.filter((x) => x.t === t);
    const a = revenue(factsIn(last).filter((x) => x.t === t)), b = prev !== undefined ? revenue(factsIn(prev).filter((x) => x.t === t)) : 0;
    return { t, label, revenue: revenue(all), share: div(revenue(all), totals.revenue), growth: b ? yoy(a, b) : null, margin: grossMargin(all) };
  });

  /* ---- families: share, margin, growth, fulfilment, cover */
  const families = ds.categories.map((label, c) => {
    const all = ds.facts.filter((x) => x.c === c);
    const a = revenue(factsIn(last).filter((x) => x.c === c)), b = prev !== undefined ? revenue(factsIn(prev).filter((x) => x.c === c)) : 0;
    const items = ds.items.filter((i) => i.c === c);
    const firstMonth = all.filter((x) => x.revenue > 0).reduce((m, x) => Math.min(m, x.mi), Infinity);
    return {
      c, label, revenue: revenue(all), share: div(revenue(all), totals.revenue), margin: grossMargin(all), growth: b ? yoy(a, b) : null,
      ordered: orderedUnits(all), unmet: unmetUnits(all), unmetRate: div(unmetUnits(all), orderedUnits(all)),
      cover: median(items.map(cover).filter(Number.isFinite)), stockValue: sum(items, (i) => i.onHand * i.unitCost), items: items.length,
      firstMonth: Number.isFinite(firstMonth) ? firstMonth : null, loss: sum(all, (x) => x.loss),
    };
  });

  /* ---- loss concentration: which items carry the negative-profit lines */
  const withSales = ds.items.filter((i): i is StockItem & { sales: NonNullable<StockItem['sales']> } => !!i.sales);
  const byLoss = withSales.filter((i) => i.sales.loss > 0).sort((a, b) => b.sales.loss - a.sales.loss);
  // the leading group: items that share the top item's family and lose on most of their lines
  const lead = byLoss[0];
  const leadGroup = lead ? byLoss.filter((i) => i.c === lead.c && i.sales.profit < 0) : [];
  const siblings = lead ? withSales.filter((i) => i.c === lead.c && !leadGroup.includes(i)) : [];
  const loss = {
    total: totals.loss, lines: totals.lossLines, items: byLoss.length,
    group: leadGroup.map((i) => ({ id: i.id, label: i.label, loss: i.sales.loss, lines: i.sales.lossLines, revenue: i.sales.revenue, margin: div(i.sales.profit, i.sales.revenue), price: i.unitPrice ?? null })),
    groupLoss: sum(leadGroup, (i) => i.sales.loss), groupLines: sum(leadGroup, (i) => i.sales.lossLines),
    groupShare: div(sum(leadGroup, (i) => i.sales.loss), totals.loss), groupLineShare: div(sum(leadGroup, (i) => i.sales.lossLines), totals.lossLines),
    groupMargin: div(sum(leadGroup, (i) => i.sales.profit), sum(leadGroup, (i) => i.sales.revenue)),
    siblingMargin: div(sum(siblings, (i) => i.sales.profit), sum(siblings, (i) => i.sales.revenue)),
    siblingPrice: siblings[0]?.unitPrice ?? null, family: lead ? lead.c : null,
    top: byLoss.slice(0, 8).map((i) => ({ id: i.id, label: i.label, loss: i.sales.loss, c: i.c })),
  };

  /* ---- unpicked demand */
  const unmetByMonth = ds.months.map((m) => sum(ds.facts.filter((x) => x.mi === m.i), (x) => x.unmet));
  const unmetItems = withSales.filter((i) => i.sales.unmet > 0).sort((a, b) => b.sales.unmet - a.sales.unmet);
  const shortFamilies = families.filter((f) => f.unmet > 0).sort((a, b) => b.unmet - a.unmet);
  const half = Math.floor(ds.months.length / 2);
  const demand = {
    ordered: totals.ordered, unmet: totals.unmet, rate: div(totals.unmet, totals.ordered), fill: totals.fill,
    families: shortFamilies.map((f) => ({ c: f.c, label: f.label, unmet: f.unmet, rate: f.unmetRate, share: div(f.unmet, totals.unmet) })),
    familiesWithShortfall: shortFamilies.length,
    topItems: unmetItems.slice(0, 8).map((i) => ({ id: i.id, label: i.label, unmet: i.sales.unmet, rate: div(i.sales.unmet, i.sales.ordered), c: i.c, onHand: i.onHand, reorder: i.reorder })),
    itemsWithShortfall: unmetItems.length,
    byMonth: unmetByMonth,
    firstHalf: sum(unmetByMonth.slice(0, half), (v) => v) / half, secondHalf: sum(unmetByMonth.slice(half), (v) => v) / (ds.months.length - half),
  };

  /* ---- inventory: where the stock sits vs where demand goes unmet */
  const fam = families.filter((f) => f.items > 0 && f.cover > 0);
  const inventory = {
    value: sum(ds.items, (i) => i.onHand * i.unitCost), medianCover: median(ds.items.map(cover).filter(Number.isFinite)),
    atReorder: belowReorder(ds.items), reorderItems: ds.items.filter((i) => i.onHand <= i.reorder).map((i) => ({ id: i.id, label: i.label, onHand: i.onHand, reorder: i.reorder, c: i.c })),
    shortest: fam.slice().sort((a, b) => a.cover - b.cover)[0] ?? null, longest: fam.slice().sort((a, b) => b.cover - a.cover)[0] ?? null,
    families: fam.map((f) => ({ c: f.c, label: f.label, cover: f.cover, unmetRate: f.unmetRate, value: f.stockValue })),
  };

  /* ---- purchasing against sales, complete years */
  const buying = years.map((y) => {
    const po = ds.purchaseOrders.filter((p) => inYear(y)(p.mi));
    return { year: y, purchases: spend(po), revenue: revenue(factsIn(y)), ratio: div(spend(po), revenue(factsIn(y))) };
  });
  const supplierShare = (() => {
    const by = new Map<number, number>();
    ds.purchaseOrders.forEach((p) => by.set(p.s, (by.get(p.s) ?? 0) + p.spend));
    const tot = sum([...by.values()], (v) => v);
    return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([s, v]) => ({ s, label: ds.suppliers[s]?.label ?? String(s), value: v, share: div(v, tot), unreceived: unreceivedOuters(ds.purchaseOrders.filter((p) => p.s === s)) }));
  })();
  const received = ds.purchaseOrders.filter((p) => p.leadDays !== null);
  const purchasing = {
    years: buying, growth: buying.length > 1 ? div(buying[buying.length - 1].purchases, buying[0].purchases) : null,
    salesGrowth: buying.length > 1 ? div(buying[buying.length - 1].revenue, buying[0].revenue) : null,
    suppliers: supplierShare, unreceived: unreceivedOuters(ds.purchaseOrders),
    leadMedian: median(received.map((p) => p.leadDays as number)), expectedMedian: median(ds.purchaseOrders.map((p) => p.expectedDays)),
    pending: ds.purchaseOrders.length - received.length,
  };

  /* ---- products: revenue leader against unit leader */
  const byRev = withSales.slice().sort((x, y) => y.sales.revenue - x.sales.revenue);
  const byUnits = withSales.slice().sort((x, y) => y.sales.units - x.sales.units);
  const products = {
    revenueLeader: byRev[0] ? { id: byRev[0].id, label: byRev[0].label, revenue: byRev[0].sales.revenue, units: byRev[0].sales.units } : null,
    unitLeader: byUnits[0] ? { id: byUnits[0].id, label: byUnits[0].label, revenue: byUnits[0].sales.revenue, units: byUnits[0].sales.units } : null,
    top10Share: div(sum(byRev.slice(0, 10), (i) => i.sales.revenue), totals.revenue),
  };

  /* ---- customers */
  const customers = { count: totals.customers, top10: topCustomerShare(ds.customerFacts, 10), topQuintile: topQuintileShare(ds.customerFacts) };

  /* ---- service: backorders and delivery punctuality by complete year */
  const service = years.map((y) => { const o = ds.orderFacts.filter((x) => inYear(y)(x.mi)); return { year: y, backorder: backorderRate(o), onTime: onTimeDelivery(o) }; });

  /* ---- new lines: families with no sales before a given month */
  const launches = families.filter((f) => f.firstMonth !== null && f.firstMonth > 0).map((f) => ({ c: f.c, label: f.label, month: f.firstMonth as number, revenue: f.revenue }));

  return { totals, annual, growth, products, segments, families, loss, demand, inventory, purchasing, customers, service, launches, years: { first: years[0], last, prev } };
}
