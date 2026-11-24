import '../styles/hub.css';
import { gsap } from 'gsap';
import type { Page } from '../lib/router';
import { prefersReducedMotion } from '../lib/env';
import { getDataset, type DataResult } from '../data/adapter';
import { withParam } from '../data/mode';
import { metric, ALL_METRICS } from '../data/metrics';
import {
  div, median, revenue, grossProfit, grossMargin, lossValue, orderedUnits, unmetUnits, fillRate,
  orderCount, backorderRate, onTimeDelivery, spend, poCount, onTimeRate, avgLead, unreceivedOuters, receivedShare, outersOrdered,
  topSupplierShare, activeSuppliers, belowReorder, stockValue, monthsCover, itemsTracked, cover,
  customerRevenue, activeCustomers, revenuePerCustomer, topCustomerShare, topQuintileShare,
} from '../data/measures';
import { noFilters, type Filters, type SupplyChainDataset, type SalesFact, type OrderFact, type PurchaseOrder, type CustomerFact, type Bi } from '../data/types';
import { formatFor, unitLabel, esc, fmt } from '../lib/format';
import { Trend, BarList, Strip, spark, countTo, tip, type BarItem, type BarReference } from '../charts/kit';
import { dataBadge, dataStatePanel, loadingState, warningList } from '../components/datastate';
import { statusBadge } from '../components/shell';
import { i18n, L, tr, segName, famName, supplierGroup, customerName, statusLabel, monthLabel, monthShort, fmtDate, signedPct, pct, int } from '../i18n';

/** Theme tokens, so every chart follows the light and dark palettes. */
const C = { glacier: 'var(--glacier)', brass: 'var(--brass)', chalk: 'var(--chalk)', ember: 'var(--ember)', haze: 'var(--haze)' };

/* ================================================================== analytics over a dataset
 * Metric arithmetic lives in `data/measures.ts`, shared with the validator's benchmark checks.
 * This page only selects rows (period, filters) and arranges the results. */
let D: SupplyChainDataset;
let custSegment = new Map<number, number>();

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const lastMonthOf = (y: number) => Math.max(...D.months.filter((m) => m.y === y).map((m) => m.m));
/** current period, or the like-for-like prior period (same calendar months of the previous year) */
function inPeriod(mi: number, f: Filters, prev = false) {
  const mo = D.months[mi];
  if (f.year === null) return !prev;
  const y = prev ? f.year - 1 : f.year;
  return mo.y === y && mo.m <= lastMonthOf(f.year);
}
const periodMonths = (f: Filters) => D.months.filter((m) => inPeriod(m.i, f));
const hasPrev = (f: Filters) => f.year !== null && f.year > D.years[0];
const seg = (t: number) => segName(D.territories[t]);
const fam = (c: number) => famName(D.categories[c]);

const salesRows = (f: Filters, prev = false, ignore: { t?: boolean; c?: boolean } = {}) =>
  D.facts.filter((x) => inPeriod(x.mi, f, prev) && (ignore.t || f.territory === null || x.t === f.territory) && (ignore.c || f.category === null || x.c === f.category));
/** Orders are counted per segment; a product family does not apply to a whole order. */
const orderRows = (f: Filters, prev = false, ignoreT = false) =>
  D.orderFacts.filter((x) => inPeriod(x.mi, f, prev) && (ignoreT || f.territory === null || x.t === f.territory));
/** Purchase orders belong to suppliers, not to segments or product families: only the year applies. */
const poRows = (f: Filters, prev = false) => D.purchaseOrders.filter((p) => inPeriod(p.mi, f, prev));
const custRows = (f: Filters, prev = false, ignoreT = false): CustomerFact[] =>
  D.customerFacts.filter((x) => inPeriod(x.mi, f, prev) && (ignoreT || f.territory === null || custSegment.get(x.cu) === f.territory));

const byMonth = <T extends { mi: number }>(rows: T[], f: Filters, k: (x: T[]) => number) => {
  const g = new Map<number, T[]>();
  rows.forEach((r) => { const a = g.get(r.mi); if (a) a.push(r); else g.set(r.mi, [r]); });
  return periodMonths(f).map((m) => k(g.get(m.i) ?? []));
};
const group = <T>(rows: T[], key: (x: T) => number) => {
  const g = new Map<number, T[]>();
  rows.forEach((r) => { const k = key(r); const a = g.get(k); if (a) a.push(r); else g.set(k, [r]); });
  return g;
};
/** Marks each row worse than the average of the rows shown. A comparison, not a business standard. */
function vsAverage(items: BarItem[], better: 'up' | 'down', label = L('the average of the groups shown', 'متوسط المجموعات المعروضة')): { items: BarItem[]; reference: BarReference } {
  const avg = mean(items.map((i) => i.value));
  return { items: items.map((i) => ({ ...i, risk: better === 'up' ? i.value < avg : i.value > avg })), reference: { value: avg, label } };
}

/* ================================================================== domain model */
type Kpi = { m: string; value: number; prev: number | null; spark: number[]; tone: string };
type Table = { cols: string[]; rows: (string | number)[][] };
type PanelCtx = { f: Filters; setFilter: (k: 'territory' | 'category', v: number) => void; openMonth: (mi: number) => void };
type PanelInst = { update: (ctx: PanelCtx) => Table; destroy?: () => void };
type Panel = { id: string; title: string; sub: string; span: number; tall?: boolean; mount: (el: HTMLElement, ctx: PanelCtx) => PanelInst };
type Domain = { id: string; label: Bi; tone: string; scope: Bi; question: Bi; kpis: (f: Filters) => Kpi[]; panels: () => Panel[]; ignores?: ('year' | 'territory' | 'category')[]; partial?: Bi };

/** x-axis ticks: January of each year across the whole period, or alternate months within one year */
const ticksFor = (f: Filters) => {
  const ms = periodMonths(f);
  return f.year === null ? ms.map((m, i) => ({ m, i })).filter(({ m }) => m.m === 0).map(({ m, i }) => ({ i, text: String(m.y) })) : ms.map((m, i) => ({ i, text: monthShort(m.m) })).filter((_, i) => i % 2 === 0);
};

const trendPanel = (id: string, title: string, sub: string, span: number, mid: string, build: (f: Filters) => { series: { key: string; name: string; color: string; values: number[]; fill?: boolean }[]; reference?: boolean }): Panel => ({
  id, title, sub, span,
  mount(el, ctx) {
    let current = ctx;
    let picked: number | null = null;
    const format = formatFor(metric(mid).unit);
    const chart = new Trend(el, (i) => { picked = i; current.openMonth(periodMonths(current.f)[i].i); });
    return {
      update(c) {
        current = c;
        const d = build(c.f);
        const labels = periodMonths(c.f).map((m) => monthLabel(m.y, m.m));
        const reference = d.reference && d.series[0].values.length ? { value: mean(d.series[0].values), label: L('Average for the period', 'متوسط الفترة') } : undefined;
        chart.update({ labels, series: d.series, format, reference, picked, ticks: ticksFor(c.f) });
        return { cols: [L('Month', 'الشهر'), ...d.series.map((s) => s.name)], rows: labels.map((l, i) => [l, ...d.series.map((s) => format(s.values[i]))]) };
      },
      destroy: () => chart.destroy(),
    };
  },
});
const barPanel = (id: string, title: string, sub: string, span: number, color: string, mid: string, build: (f: Filters) => { items: BarItem[]; reference?: BarReference }, filterKey?: 'territory' | 'category', limit?: number, format?: (v: number) => string): Panel => ({
  id, title, sub, span,
  mount(el, ctx) {
    let current = ctx;
    const fmtv = format ?? formatFor(metric(mid).unit);
    const bars = new BarList(el, { color, format: fmtv, limit, onPick: filterKey ? (k) => current.setFilter(filterKey, k) : undefined });
    return {
      update(c) {
        current = c;
        const { items, reference } = build(c.f);
        bars.update(items, filterKey ? c.f[filterKey] : null, reference);
        el.classList.toggle('is-empty', !items.length);
        return { cols: [L('Item', 'البند'), tr(metric(mid).label)], rows: items.slice().sort((a, b) => b.value - a.value).map((i) => [i.label, fmtv(i.value)]) };
      },
    };
  },
});
const stripPanel = (span: number): Panel => ({
  id: 'lead-strip', span,
  title: L('Lead time of every received purchase order', 'مدة توريد كل أمر شراء مُستلَم'),
  sub: L('Each dot is one order. The upright mark is the supplier’s expected lead time; red dots arrived after it.', 'كل نقطة أمر واحد. والعلامة القائمة هي المدة المتوقعة للمورد؛ والنقاط الحمراء وصلت بعدها.'),
  mount(el) {
    const s = new Strip(el);
    return {
      update(c) {
        const g = group(poRows(c.f).filter((p) => p.leadDays !== null), (p) => p.s);
        const rows = D.suppliers.filter((x) => g.has(x.id)).map((x) => { const r = g.get(x.id)!; return { key: x.id, label: x.label, values: r.map((p) => p.leadDays as number), late: r.map((p) => p.onTime === false), promise: x.promise }; });
        s.update(rows);
        el.classList.toggle('is-empty', !rows.length);
        return { cols: [L('Supplier', 'المورد'), L('Received orders', 'الأوامر المستلمة'), L('Expected days', 'الأيام المتوقعة'), L('Median days', 'وسيط الأيام'), L('Late orders', 'الأوامر المتأخرة')], rows: rows.map((r) => [r.label, r.values.length, r.promise, median(r.values), r.late.filter(Boolean).length]) };
      },
      destroy: () => s.destroy(),
    };
  },
});

const DOMAINS: Domain[] = [
  {
    id: 'sales', label: { en: 'Sales', ar: 'المبيعات' }, tone: C.glacier,
    scope: { en: 'Invoice lines, by invoice month', ar: 'أسطر الفواتير، حسب شهر الفاتورة' },
    question: { en: 'Which segments and product families carry revenue, and which carry profit?', ar: 'أي الشرائح وعائلات المنتجات تحمل الإيرادات، وأيها يحمل الربح؟' },
    kpis: (f) => {
      const cur = salesRows(f), prv = hasPrev(f) ? salesRows(f, true) : null;
      return [
        { m: 'revenue', value: revenue(cur), prev: prv && revenue(prv), spark: byMonth(cur, f, revenue), tone: C.glacier },
        { m: 'gross_profit', value: grossProfit(cur), prev: prv && grossProfit(prv), spark: byMonth(cur, f, grossProfit), tone: C.brass },
        { m: 'gross_margin', value: grossMargin(cur), prev: prv && grossMargin(prv), spark: byMonth(cur, f, grossMargin), tone: C.chalk },
        { m: 'loss_value', value: lossValue(cur), prev: prv && lossValue(prv), spark: byMonth(cur, f, lossValue), tone: C.ember },
      ];
    },
    panels: () => [
      trendPanel('s-trend', L('Net revenue and recorded gross profit by month', 'صافي الإيرادات والربح الإجمالي المسجَّل شهريًا'), L('Select a month to open its breakdown', 'اختر شهرًا لفتح تفاصيله'), 8, 'revenue', (f) => {
        const cur = salesRows(f);
        return { series: [
          { key: 'rev', name: tr(metric('revenue').label), color: C.glacier, fill: true, values: byMonth(cur, f, revenue) },
          { key: 'pro', name: tr(metric('gross_profit').label), color: C.brass, values: byMonth(cur, f, grossProfit) },
        ] };
      }),
      barPanel('s-seg', L('Revenue by customer segment', 'الإيرادات حسب شريحة العملاء'), L('Select a segment to filter', 'اختر شريحة للتصفية'), 4, C.glacier, 'revenue', (f) => ({ items: [...group(salesRows(f, false, { t: true }), (x) => x.t)].map(([k, r]) => ({ key: k, label: seg(k), value: revenue(r) })) }), 'territory'),
      barPanel('s-fam', L('Revenue by product family', 'الإيرادات حسب عائلة المنتج'), L('Select a family to filter', 'اختر عائلة للتصفية'), 4, C.glacier, 'revenue', (f) => ({ items: [...group(salesRows(f, false, { c: true }), (x) => x.c)].map(([k, r]) => ({ key: k, label: fam(k), value: revenue(r) })) }), 'category'),
      barPanel('s-margin', L('Gross margin by product family', 'الهامش الإجمالي حسب عائلة المنتج'), L('Red: below the average margin of the families shown', 'بالأحمر: أقل من متوسط هامش العائلات المعروضة'), 4, C.brass, 'gross_margin', (f) => vsAverage([...group(salesRows(f, false, { c: true }), (x) => x.c)].filter(([, r]) => revenue(r) > 0).map(([k, r]) => ({ key: k, label: fam(k), value: grossMargin(r) })), 'up'), 'category'),
      barPanel('s-loss', L('Recorded loss by product family', 'الخسارة المسجَّلة حسب عائلة المنتج'), L('Loss-making lines, kept as recorded', 'الأسطر الخاسرة كما سُجِّلت'), 4, C.ember, 'loss_value', (f) => ({ items: [...group(salesRows(f, false, { c: true }), (x) => x.c)].map(([k, r]) => ({ key: k, label: fam(k), value: lossValue(r) })).filter((i) => i.value > 0) }), 'category'),
    ],
  },
  {
    id: 'orders', label: { en: 'Orders', ar: 'الطلبات' }, tone: C.chalk,
    scope: { en: 'Customer orders by order month; deliveries by invoice', ar: 'طلبات العملاء حسب شهر الطلب، والتسليم حسب الفاتورة' },
    question: { en: 'How much ordered demand is never picked, and how often do orders wait?', ar: 'ما حجم الطلب الذي لا يُجهَّز أبدًا، وكم مرة تنتظر الطلبات؟' },
    partial: { en: 'The product-family filter applies to fill rate and unpicked units only: an order spans families.', ar: 'ينطبق مرشح عائلة المنتج على معدل التلبية والوحدات غير المجهَّزة فقط، لأن الطلب الواحد يشمل عائلات عدة.' },
    kpis: (f) => {
      const cur = orderRows(f), prv = hasPrev(f) ? orderRows(f, true) : null;
      const sc = salesRows(f), sp = hasPrev(f) ? salesRows(f, true) : null;
      return [
        { m: 'orders', value: orderCount(cur), prev: prv && orderCount(prv), spark: byMonth(cur, f, orderCount), tone: C.chalk },
        { m: 'fill_rate', value: fillRate(sc), prev: sp && fillRate(sp), spark: byMonth(sc, f, fillRate), tone: C.glacier },
        { m: 'backorder_rate', value: backorderRate(cur), prev: prv && backorderRate(prv), spark: byMonth(cur, f, backorderRate), tone: C.ember },
        { m: 'on_time_delivery', value: onTimeDelivery(cur), prev: prv && onTimeDelivery(prv), spark: byMonth(cur, f, onTimeDelivery), tone: C.chalk },
      ];
    },
    panels: () => [
      trendPanel('o-trend', L('Orders by month', 'الطلبات شهريًا'), L('Select a month to open its breakdown', 'اختر شهرًا لفتح تفاصيله'), 8, 'orders', (f) => ({ series: [{ key: 'ord', name: tr(metric('orders').label), color: C.chalk, fill: true, values: byMonth(orderRows(f), f, orderCount) }] })),
      barPanel('o-seg', L('Backorder rate by segment', 'معدل التأجيل حسب الشريحة'), L('Red: above the average of the segments shown', 'بالأحمر: أعلى من متوسط الشرائح المعروضة'), 4, C.chalk, 'backorder_rate', (f) => vsAverage([...group(orderRows(f, false, true), (x) => x.t)].map(([k, r]) => ({ key: k, label: seg(k), value: backorderRate(r) })), 'down', L('the average of the segments shown', 'متوسط الشرائح المعروضة')), 'territory'),
      trendPanel('o-unmet', L('Unpicked units by order month', 'الوحدات غير المجهَّزة حسب شهر الطلب'), L('The dashed line is the average for the period shown', 'الخط المتقطع هو متوسط الفترة المعروضة'), 6, 'unmet_units', (f) => ({ reference: true, series: [{ key: 'um', name: tr(metric('unmet_units').label), color: C.ember, fill: true, values: byMonth(salesRows(f), f, unmetUnits) }] })),
      barPanel('o-fam', L('Unpicked share of ordered units, by family', 'نسبة غير المجهَّز من الوحدات المطلوبة حسب العائلة'), L('Select a family to filter', 'اختر عائلة للتصفية'), 6, C.ember, 'fill_rate', (f) => ({ items: [...group(salesRows(f, false, { c: true }), (x) => x.c)].map(([k, r]) => ({ key: k, label: fam(k), value: div(unmetUnits(r), orderedUnits(r)), risk: unmetUnits(r) > 0 })) }), 'category', undefined, (v) => pct(v, 2)),
    ],
  },
  {
    id: 'purchasing', label: { en: 'Purchasing', ar: 'المشتريات' }, tone: C.brass,
    scope: { en: 'Purchase orders by order month, in outer packs', ar: 'أوامر الشراء حسب شهر الطلب، بالعبوات الخارجية' },
    question: { en: 'How much is ordered from whom, and how much of it has arrived?', ar: 'كم يُطلب ومن مَن، وكم وصل منه؟' },
    ignores: ['territory', 'category'],
    kpis: (f) => {
      const cur = poRows(f), prv = hasPrev(f) ? poRows(f, true) : null;
      return [
        { m: 'purchase_spend', value: spend(cur), prev: prv && spend(prv), spark: byMonth(cur, f, spend), tone: C.brass },
        { m: 'purchase_orders', value: poCount(cur), prev: prv && poCount(prv), spark: byMonth(cur, f, poCount), tone: C.chalk },
        { m: 'unreceived_outers', value: unreceivedOuters(cur), prev: prv && unreceivedOuters(prv), spark: byMonth(cur, f, unreceivedOuters), tone: C.ember },
        { m: 'received_share', value: receivedShare(cur), prev: prv && receivedShare(prv), spark: byMonth(cur, f, receivedShare), tone: C.chalk },
      ];
    },
    panels: () => [
      trendPanel('p-trend', L('Purchase-order value by month', 'قيمة أوامر الشراء شهريًا'), L('Select a month to open its breakdown', 'اختر شهرًا لفتح تفاصيله'), 8, 'purchase_spend', (f) => ({ series: [{ key: 'sp', name: tr(metric('purchase_spend').label), color: C.brass, fill: true, values: byMonth(poRows(f), f, spend) }] })),
      barPanel('p-sup', L('Purchase-order value by supplier', 'قيمة أوامر الشراء حسب المورد'), L('Suppliers ranked by value', 'الموردون مرتبون حسب القيمة'), 4, C.brass, 'purchase_spend', (f) => ({ items: [...group(poRows(f), (p) => p.s)].map(([k, r]) => ({ key: k, label: D.suppliers[k].label, value: spend(r) })) })),
      barPanel('p-gap', L('Unreceived outers by supplier', 'العبوات غير المستلمة حسب المورد'), L('Ordered minus received outer packs', 'العبوات المطلوبة ناقص المستلمة'), 6, C.ember, 'unreceived_outers', (f) => ({ items: [...group(poRows(f), (p) => p.s)].map(([k, r]) => ({ key: k, label: D.suppliers[k].label, value: unreceivedOuters(r), risk: unreceivedOuters(r) > 0 })).filter((i) => i.value > 0) })),
      barPanel('p-out', L('Outer packs ordered by supplier', 'العبوات المطلوبة حسب المورد'), L('Volume, not value: pack sizes differ by product', 'الحجم لا القيمة: يختلف حجم العبوة حسب المنتج'), 6, C.brass, 'unreceived_outers', (f) => ({ items: [...group(poRows(f), (p) => p.s)].map(([k, r]) => ({ key: k, label: D.suppliers[k].label, value: outersOrdered(r) })) })),
    ],
  },
  {
    id: 'inventory', label: { en: 'Inventory', ar: 'المخزون' }, tone: C.ember,
    scope: { en: 'Current stock holdings: a single, undated snapshot', ar: 'أرصدة المخزون الحالية: لقطة واحدة بلا تاريخ' },
    question: { en: 'Which items are at their reorder level, and where does stock sit?', ar: 'أي الأصناف بلغت حد إعادة الطلب، وأين يتركز المخزون؟' },
    ignores: ['year', 'territory'],
    kpis: (f) => {
      const items = D.items.filter((i) => f.category === null || i.c === f.category);
      return [
        { m: 'items_below_reorder', value: belowReorder(items), prev: null, spark: [], tone: C.ember },
        { m: 'stock_value', value: stockValue(items), prev: null, spark: [], tone: C.chalk },
        { m: 'months_cover', value: monthsCover(items), prev: null, spark: [], tone: C.chalk },
        { m: 'items_tracked', value: itemsTracked(items), prev: null, spark: [], tone: C.chalk },
      ];
    },
    panels: () => [
      barPanel('i-near', L('Items closest to their reorder level', 'الأصناف الأقرب إلى حد إعادة الطلب'), L('Reorder level as a share of stock on hand. Red: at or below the reorder level (100% or more).', 'حد إعادة الطلب كنسبة من المخزون المتاح. بالأحمر: عند الحد أو دونه (100٪ فأكثر).'), 8, C.chalk, 'items_below_reorder', (f) => ({ items: D.items.filter((i) => (f.category === null || i.c === f.category) && i.reorder > 0 && i.onHand > 0).map((i) => ({ key: i.id, label: i.label, value: i.reorder / i.onHand, risk: i.onHand <= i.reorder, note: L(`· ${int(i.onHand)} on hand, reorder at ${int(i.reorder)}`, `· ${int(i.onHand)} متاح، وإعادة الطلب عند ${int(i.reorder)}`) })) }), undefined, 10, (v) => pct(v, 0)),
      barPanel('i-val', L('Stock value at cost by family', 'قيمة المخزون بالتكلفة حسب العائلة'), L('Select a family to filter', 'اختر عائلة للتصفية'), 4, C.chalk, 'stock_value', () => ({ items: [...group(D.items, (i) => i.c)].map(([k, r]) => ({ key: k, label: fam(k), value: stockValue(r) })) }), 'category'),
      barPanel('i-cover', L('Median months of cover by family', 'وسيط أشهر التغطية حسب العائلة'), L('Red: less cover than the average of the families shown', 'بالأحمر: تغطية أقل من متوسط العائلات المعروضة'), 6, C.chalk, 'months_cover', () => vsAverage([...group(D.items, (i) => i.c)].map(([k, r]) => ({ key: k, label: fam(k), value: monthsCover(r) })), 'up'), 'category'),
      barPanel('i-slow', L('Slowest-moving items', 'الأصناف الأبطأ حركة'), L('Months of cover at the last 12 months’ sales rate', 'أشهر التغطية بمعدل مبيعات آخر 12 شهرًا'), 6, C.brass, 'months_cover', (f) => ({ items: D.items.filter((i) => (f.category === null || i.c === f.category) && Number.isFinite(cover(i))).map((i) => ({ key: i.id, label: i.label, value: cover(i) })) }), undefined, 10),
    ],
  },
  {
    id: 'suppliers', label: { en: 'Suppliers', ar: 'الموردون' }, tone: C.brass,
    scope: { en: 'Received purchase orders, by order month', ar: 'أوامر الشراء المستلمة، حسب شهر الطلب' },
    question: { en: 'How concentrated is purchasing, and do suppliers deliver when expected?', ar: 'ما مدى تركّز المشتريات، وهل يسلّم الموردون في الموعد المتوقع؟' },
    ignores: ['territory', 'category'],
    kpis: (f) => {
      const cur = poRows(f), prv = hasPrev(f) ? poRows(f, true) : null;
      const top3 = (r: PurchaseOrder[]) => topSupplierShare(r, 3);
      return [
        { m: 'top3_spend_share', value: top3(cur), prev: prv && top3(prv), spark: byMonth(cur, f, top3), tone: C.brass },
        { m: 'active_suppliers', value: activeSuppliers(cur), prev: prv && activeSuppliers(prv), spark: [], tone: C.chalk },
        { m: 'on_time_receipt', value: onTimeRate(cur), prev: prv && onTimeRate(prv), spark: byMonth(cur, f, onTimeRate), tone: C.chalk },
        { m: 'avg_lead_time', value: avgLead(cur), prev: prv && avgLead(prv), spark: byMonth(cur, f, avgLead), tone: C.chalk },
      ];
    },
    panels: () => [
      barPanel('su-share', L('Share of purchase-order value by supplier', 'حصة قيمة أوامر الشراء حسب المورد'), L('Each supplier’s share of the period’s value', 'حصة كل مورد من قيمة الفترة'), 6, C.brass, 'top3_spend_share', (f) => { const r = poRows(f), tot = spend(r); return { items: [...group(r, (p) => p.s)].map(([k, x]) => ({ key: k, label: D.suppliers[k].label, value: div(spend(x), tot) })) }; }),
      barPanel('su-group', L('Value by supplier category', 'القيمة حسب فئة المورد'), L('The supplier’s own category in the source', 'فئة المورد كما في المصدر'), 6, C.brass, 'purchase_spend', (f) => { const keys = [...new Set(D.suppliers.map((s) => s.group))]; return { items: keys.map((gname, k) => ({ key: k, label: supplierGroup(gname), value: spend(poRows(f).filter((p) => D.suppliers[p.s].group === gname)) })).filter((i) => i.value > 0) }; }),
      stripPanel(12),
    ],
  },
  {
    id: 'customers', label: { en: 'Customers', ar: 'العملاء' }, tone: C.glacier,
    scope: { en: 'Invoiced revenue per customer, by invoice month', ar: 'الإيرادات المفوترة لكل عميل، حسب شهر الفاتورة' },
    question: { en: 'How concentrated is revenue across customers and segments?', ar: 'ما مدى تركّز الإيرادات عبر العملاء والشرائح؟' },
    ignores: ['category'],
    kpis: (f) => {
      const cur = custRows(f), prv = hasPrev(f) ? custRows(f, true) : null;
      const top10 = (r: CustomerFact[]) => topCustomerShare(r, 10);
      return [
        { m: 'active_customers', value: activeCustomers(cur), prev: prv && activeCustomers(prv), spark: byMonth(cur, f, activeCustomers), tone: C.glacier },
        { m: 'revenue_per_customer', value: revenuePerCustomer(cur), prev: prv && revenuePerCustomer(prv), spark: byMonth(cur, f, revenuePerCustomer), tone: C.chalk },
        { m: 'top10_share', value: top10(cur), prev: prv && top10(prv), spark: [], tone: C.chalk },
        { m: 'top_quintile_share', value: topQuintileShare(cur), prev: prv && topQuintileShare(prv), spark: [], tone: C.chalk },
      ];
    },
    panels: () => [
      barPanel('c-top', L('Largest customers', 'أكبر العملاء'), L('Ranked by revenue in the period; names are not loaded', 'مرتبون حسب إيرادات الفترة؛ الأسماء غير محمّلة'), 6, C.glacier, 'revenue', (f) => ({ items: [...group(custRows(f), (x) => x.cu)].map(([k, r]) => ({ key: k, label: customerName(k), value: customerRevenue(r), note: `· ${seg(custSegment.get(k) ?? 0)}` })) }), undefined, 10),
      barPanel('c-seg', L('Revenue by segment', 'الإيرادات حسب الشريحة'), L('Select a segment to filter', 'اختر شريحة للتصفية'), 6, C.glacier, 'revenue', (f) => ({ items: [...group(custRows(f, false, true), (x) => custSegment.get(x.cu) ?? -1)].filter(([k]) => k >= 0).map(([k, r]) => ({ key: k, label: seg(k), value: customerRevenue(r) })) }), 'territory'),
      trendPanel('c-trend', L('Active customers by month', 'العملاء النشطون شهريًا'), L('Customers with at least one invoice in the month', 'العملاء الذين لديهم فاتورة واحدة على الأقل في الشهر'), 12, 'active_customers', (f) => ({ series: [{ key: 'ac', name: tr(metric('active_customers').label), color: C.glacier, fill: true, values: byMonth(custRows(f), f, activeCustomers) }] })),
    ],
  },
];

/* ================================================================== page
 * Module-level state survives remounts, so a language or theme switch keeps the reader's domain and filters. */
const state = { domain: 'sales', f: noFilters() };

const page: Page & { teardown: (() => void)[] } = {
  teardown: [],
  async mount(root) {
    const reduced = prefersReducedMotion();
    const qs = new URLSearchParams(location.hash.split('?')[1] ?? '');
    if (qs.get('d') && DOMAINS.some((d) => d.id === qs.get('d'))) state.domain = qs.get('d')!;

    root.innerHTML = `<div class="hub page-pad">${loadingState()}</div>`;
    const result = await getDataset();
    if (result.state !== 'ready') { renderUnavailable(root, result); return; }
    D = result.dataset;
    custSegment = new Map(D.customers.map((c) => [c.id, c.t]));
    // a filter that does not exist in this dataset (for example after a data-mode switch) is dropped
    if (state.f.year !== null && !D.years.includes(state.f.year)) state.f = { ...state.f, year: null };
    if (state.f.territory !== null && state.f.territory >= D.territories.length) state.f = { ...state.f, territory: null };
    if (state.f.category !== null && state.f.category >= D.categories.length) state.f = { ...state.f, category: null };
    const P = D.provenance;
    const demoData = P.status === 'synthetic';
    const ready = result;
    const rtl = i18n.rtl;

    root.innerHTML = `
    <div class="hub page-pad">
      <header class="hub-head">
        <div>
          <h1 class="display hub-title">${L('Observatory', 'المرصد')}</h1>
          <p class="hub-sub">${L('One workspace for sales, orders, purchasing, inventory, suppliers and customers. Filters apply across every view.', 'مساحة عمل واحدة للمبيعات والطلبات والمشتريات والمخزون والموردين والعملاء. وتنطبق المرشحات على كل العروض.')}</p>
        </div>
        <aside class="provenance" role="note" aria-label="${L('About this data', 'عن هذه البيانات')}">
          ${dataBadge(result)}
          <p>${demoData ? L('Synthetic demo data, generated in your browser.', 'بيانات تجريبية مولَّدة في متصفحك.') : L(`Read-only exports of the Wide World Importers database, ${fmtDate(P.coverage.from)} – ${fmtDate(P.coverage.to)}. Reconciled with the team’s SQL benchmarks.`, `مستخرجات للقراءة فقط من قاعدة بيانات Wide World Importers، من ${fmtDate(P.coverage.from)} إلى ${fmtDate(P.coverage.to)}. مطابقة لمعايير الفريق المحسوبة بـ SQL.`)}</p>
          <button class="text-btn about-data" type="button">${L('About this data and its metrics', 'عن هذه البيانات ومؤشراتها')}</button>
        </aside>
      </header>

      <div class="domains" role="tablist" aria-label="${L('Analytical domains', 'المجالات التحليلية')}">
        ${DOMAINS.map((d) => `<button role="tab" id="tab-${d.id}" aria-controls="hub-body" data-d="${d.id}" style="--tone:${d.tone}"><span class="dom-mark" aria-hidden="true"></span>${tr(d.label)}</button>`).join('')}
      </div>

      <div class="filters" role="group" aria-label="${L('Filters', 'المرشحات')}">
        <div class="seg" role="radiogroup" aria-label="${L('Year', 'السنة')}">
          ${[null, ...D.years].map((y) => `<button role="radio" data-year="${y ?? ''}"${y === D.years[D.years.length - 1] && D.months.filter((m) => m.y === y).length < 12 ? ` title="${L('January to May', 'من يناير إلى مايو')}"` : ''}>${y ?? L('All years', 'كل السنوات')}</button>`).join('')}
        </div>
        <label class="sel"><span>${L('Segment', 'الشريحة')}</span><select data-k="territory"><option value="">${L('All segments', 'كل الشرائح')}</option>${D.territories.map((_, i) => `<option value="${i}">${esc(seg(i))}</option>`).join('')}</select></label>
        <label class="sel"><span>${L('Product family', 'عائلة المنتج')}</span><select data-k="category"><option value="">${L('All families', 'كل العائلات')}</option>${D.categories.map((_, i) => `<option value="${i}">${esc(fam(i))}</option>`).join('')}</select></label>
        <div class="chips" aria-live="polite"></div>
      </div>
      <p class="scope"></p>

      <section id="hub-body" role="tabpanel">
        <h2 class="domain-question"></h2>
        <div class="kpis"></div>
        <div class="panels"></div>
      </section>

      <aside class="drawer" aria-hidden="true" aria-labelledby="drawer-title" role="dialog" aria-modal="false">
        <div class="drawer-inner">
          <button class="drawer-close" type="button">${L('Close', 'إغلاق')}</button>
          <p class="drawer-kicker"></p>
          <h2 id="drawer-title" class="display"></h2>
          <div class="drawer-body"></div>
        </div>
      </aside>
    </div>`;

    const $ = <T extends Element>(s: string) => root.querySelector(s) as T;
    const kpiEl = $<HTMLElement>('.kpis');
    const panelsEl = $<HTMLElement>('.panels');
    const drawer = $<HTMLElement>('.drawer');
    let mounted: { p: Panel; inst: PanelInst; el: HTMLElement; table: Table | null }[] = [];

    const domain = () => DOMAINS.find((d) => d.id === state.domain)!;
    const ctx = (): PanelCtx => ({ f: state.f, setFilter, openMonth });

    function setFilter(k: 'territory' | 'category', v: number) {
      state.f = { ...state.f, [k]: state.f[k] === v ? null : v };
      syncControls();
      refresh();
    }
    function clearFilter(k: keyof Filters) { state.f = { ...state.f, [k]: null }; syncControls(); refresh(); }

    function syncControls() {
      root.querySelectorAll<HTMLButtonElement>('.seg button').forEach((b) => {
        const on = (b.dataset.year === '' ? null : Number(b.dataset.year)) === state.f.year;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      root.querySelectorAll<HTMLSelectElement>('select').forEach((s) => { const v = state.f[s.dataset.k as 'territory' | 'category']; s.value = v === null ? '' : String(v); });
      const d = domain();
      root.querySelectorAll<HTMLButtonElement>('.domains [role=tab]').forEach((t) => {
        const on = t.dataset.d === d.id;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      $('#hub-body').setAttribute('aria-labelledby', `tab-${d.id}`);
      const ign = d.ignores ?? [];
      $('.seg').classList.toggle('na', ign.includes('year'));
      root.querySelectorAll<HTMLElement>('.sel').forEach((l) => l.classList.toggle('na', ign.includes((l.querySelector('select') as HTMLSelectElement).dataset.k as 'territory')));
      const names: Record<string, string> = { year: L('year', 'السنة'), territory: L('segment', 'الشريحة'), category: L('product family', 'عائلة المنتج') };
      const ignText = ign.length ? ' ' + L(`The ${ign.map((i) => names[i]).join(' and ')} filter${ign.length > 1 ? 's do' : ' does'} not apply here.`, `لا ينطبق هنا مرشح ${ign.map((i) => names[i]).join(' ولا مرشح ')}.`) : '';
      const cmp = state.f.year && hasPrev(state.f) ? ' ' + L(`Changes compare with the same months of ${state.f.year - 1}.`, `تُقارن التغيرات بالأشهر نفسها من ${state.f.year - 1}.`) : '';
      $('.scope').textContent = `${tr(d.scope)}.${ignText}${d.partial ? ' ' + tr(d.partial) : ''}${cmp}`;
      $('.domain-question').textContent = tr(d.question);
      const chips: string[] = [];
      if (state.f.year !== null) chips.push(chip('year', String(state.f.year)));
      if (state.f.territory !== null) chips.push(chip('territory', seg(state.f.territory)));
      if (state.f.category !== null) chips.push(chip('category', fam(state.f.category)));
      $('.chips').innerHTML = chips.length ? chips.join('') + `<button class="text-btn reset" type="button">${L('Clear all', 'مسح الكل')}</button>` : '';
    }
    const chip = (k: string, label: string) => `<button class="chip" type="button" data-clear="${k}" aria-label="${L('Remove filter', 'إزالة المرشح')}: ${esc(label)}">${esc(label)}<span aria-hidden="true">×</span></button>`;
    $('.chips').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      if (b.classList.contains('reset')) { state.f = noFilters(); syncControls(); refresh(); root.querySelector<HTMLButtonElement>('.seg button[aria-checked=true]')?.focus(); }
      else if (b.dataset.clear) { clearFilter(b.dataset.clear as keyof Filters); (root.querySelector('.chips button') as HTMLButtonElement | null ?? root.querySelector<HTMLButtonElement>('.seg button[aria-checked=true]'))?.focus(); }
    });

    /* KPIs */
    const originText = (o: 'team' | 'website') => (o === 'team' ? L('Team KPI', 'مؤشر الفريق') : L('Website metric', 'مؤشر الموقع'));
    function renderKpis(first = false) {
      const ks = domain().kpis(state.f);
      if (first || kpiEl.children.length !== ks.length) {
        kpiEl.innerHTML = ks.map((k, i) => {
          const m = metric(k.m);
          return `
          <article class="kpi${i === 0 ? ' kpi-hero' : ''}" style="--tone:${k.tone}">
            <header><h3>${tr(m.label)}</h3><button class="def-btn" type="button" aria-expanded="false" aria-label="${L('Definition of', 'تعريف')} ${tr(m.label)}">?</button></header>
            <p class="kpi-v num" data-v="0">0</p>
            <p class="kpi-d num"></p>
            <div class="kpi-spark"></div>
            <div class="kpi-def" hidden><p>${tr(m.definition)}</p><p class="kpi-formula" dir="ltr">${esc(m.formula)}</p><p class="kpi-status">${originText(m.origin)} · ${unitLabel(m.unit)}</p></div>
          </article>`;
        }).join('');
        kpiEl.querySelectorAll<HTMLButtonElement>('.def-btn').forEach((b) => b.addEventListener('click', () => {
          const p = b.closest('.kpi')!.querySelector<HTMLElement>('.kpi-def')!;
          const open = p.hidden; p.hidden = !open; b.setAttribute('aria-expanded', String(open));
        }));
      }
      ks.forEach((k, i) => {
        const m = metric(k.m);
        const format = formatFor(m.unit);
        const card = kpiEl.children[i] as HTMLElement;
        countTo(card.querySelector('.kpi-v')!, k.value, format);
        const d = card.querySelector<HTMLElement>('.kpi-d')!;
        if (k.prev !== null && isFinite(k.prev) && k.prev !== 0) {
          const ch = (k.value - k.prev) / Math.abs(k.prev);
          const tone = m.better === 'neutral' || Math.abs(ch) < 0.005 ? '' : (ch >= 0) === (m.better === 'up') ? 'good' : 'bad';
          d.textContent = L(`${signedPct(ch)} on the same months of ${state.f.year! - 1}`, `${signedPct(ch)} مقارنة بالأشهر نفسها من ${state.f.year! - 1}`);
          d.className = `kpi-d num ${tone}`;
        } else {
          d.textContent = state.f.year === D.years[0] ? L('No earlier year to compare', 'لا توجد سنة سابقة للمقارنة') : domain().id === 'inventory' ? L('Current snapshot', 'اللقطة الحالية') : k.prev === null && state.f.year !== null ? L('No comparison for this metric', 'لا مقارنة لهذا المؤشر') : L('Select a year to compare', 'اختر سنة للمقارنة');
          d.className = 'kpi-d num quiet';
        }
        card.querySelector('.kpi-spark')!.innerHTML = spark(k.spark, k.tone);
      });
    }

    /* Panels */
    function buildPanels() {
      mounted.forEach((m) => m.inst.destroy?.());
      panelsEl.innerHTML = '';
      mounted = domain().panels().map((p) => {
        const el = document.createElement('article');
        el.className = `panel span-${p.span}${p.tall ? ' tall' : ''}`;
        el.innerHTML = `<header class="panel-head"><div><h3>${p.title}</h3><p>${p.sub}</p></div><button class="table-btn" type="button" aria-pressed="false">${L('Table', 'جدول')}</button></header><div class="panel-body" data-empty="${L('No records match these filters.', 'لا توجد سجلات تطابق هذه المرشحات.')}"></div><div class="panel-table" hidden></div>`;
        panelsEl.appendChild(el);
        const body = el.querySelector<HTMLElement>('.panel-body')!;
        const inst = p.mount(body, ctx());
        const rec = { p, inst, el, table: null as Table | null };
        el.querySelector<HTMLButtonElement>('.table-btn')!.addEventListener('click', (e) => {
          const b = e.currentTarget as HTMLButtonElement;
          const on = b.getAttribute('aria-pressed') !== 'true';
          b.setAttribute('aria-pressed', String(on));
          b.textContent = on ? L('Chart', 'مخطط') : L('Table', 'جدول');
          body.hidden = on;
          const t = el.querySelector<HTMLElement>('.panel-table')!;
          t.hidden = !on;
          if (on) renderTable(t, rec.table!, p.title);
        });
        return rec;
      });
    }
    function renderTable(el: HTMLElement, t: Table, caption: string) {
      if (!t.rows.length) { el.innerHTML = `<p class="empty-note">${L('No records match these filters.', 'لا توجد سجلات تطابق هذه المرشحات.')}</p>`; return; }
      el.innerHTML = `<table><caption class="sr-only">${esc(caption)}</caption><thead><tr>${t.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(String(c))}</th>` : `<td class="num">${esc(String(c))}</td>`)).join('')}</tr>`).join('')}</tbody></table>`;
    }
    function updatePanels() {
      const c = ctx();
      mounted.forEach((m) => {
        m.table = m.inst.update(c);
        const t = m.el.querySelector<HTMLElement>('.panel-table')!;
        if (!t.hidden) renderTable(t, m.table, m.p.title);
      });
    }
    function refresh() { renderKpis(); updatePanels(); }

    async function switchDomain(id: string, animate = true) {
      if (id === state.domain && mounted.length) return;
      state.domain = id;
      history.replaceState(null, '', withParam(location.hash, 'd', id)); // keeps ?data=…
      syncControls();
      const cards = [...kpiEl.children, ...panelsEl.children];
      if (animate && !reduced && cards.length) await gsap.to(cards, { opacity: 0, y: 6, duration: 0.2, stagger: 0.02, ease: 'power2.in' });
      renderKpis(true);
      buildPanels();
      updatePanels();
      if (animate && !reduced) gsap.fromTo([...kpiEl.children, ...panelsEl.children], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.045, ease: 'expo.out', clearProps: 'transform' });
    }

    /* Drawer (month breakdown and data glossary share one accessible side panel) */
    let lastFocus: HTMLElement | null = null;
    function openDrawer(kicker: string, title: string, fill: (body: HTMLElement) => void) {
      $('.drawer-kicker').textContent = kicker;
      $('#drawer-title').textContent = title;
      const body = $<HTMLElement>('.drawer-body');
      body.innerHTML = '';
      fill(body);
      lastFocus = document.activeElement as HTMLElement;
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
      tip(null);
      drawer.querySelector<HTMLButtonElement>('.drawer-close')!.focus();
    }
    const stat = (k: string, v: string) => `<div><dt>${k}</dt><dd class="num">${v}</dd></div>`;
    function openMonth(mi: number) {
      const mo = D.months[mi];
      const d = domain();
      const f = state.f;
      openDrawer(L('Month breakdown', 'تفاصيل الشهر'), monthLabel(mo.y, mo.m), (body) => {
        if (d.id === 'purchasing' || d.id === 'suppliers') {
          const rows = D.purchaseOrders.filter((p) => p.mi === mi);
          body.innerHTML = `<dl class="drawer-stats">${stat(tr(metric('purchase_spend').label), fmt.money(spend(rows)))}${stat(tr(metric('purchase_orders').label), fmt.int(rows.length))}${stat(tr(metric('unreceived_outers').label), fmt.int(unreceivedOuters(rows)))}</dl><h3>${L('Value by supplier', 'القيمة حسب المورد')}</h3><div class="d-bars"></div>`;
          new BarList(body.querySelector('.d-bars')!, { color: C.brass, format: fmt.money }).update([...group(rows, (p) => p.s)].map(([k, r]) => ({ key: k, label: D.suppliers[k].label, value: spend(r) })), null);
        } else if (d.id === 'orders') {
          const o = D.orderFacts.filter((x: OrderFact) => x.mi === mi && (f.territory === null || x.t === f.territory));
          const s = D.facts.filter((x: SalesFact) => x.mi === mi && (f.territory === null || x.t === f.territory) && (f.category === null || x.c === f.category));
          body.innerHTML = `<dl class="drawer-stats">${stat(tr(metric('orders').label), fmt.int(orderCount(o)))}${stat(tr(metric('backorder_rate').label), pct(backorderRate(o)))}${stat(tr(metric('unmet_units').label), fmt.int(unmetUnits(s)))}</dl><h3>${L('Orders by segment', 'الطلبات حسب الشريحة')}</h3><div class="d-bars d1"></div><h3>${L('Unpicked units by family', 'الوحدات غير المجهَّزة حسب العائلة')}</h3><div class="d-bars d2"></div>`;
          new BarList(body.querySelector('.d1')!, { color: C.chalk, format: fmt.int }).update([...group(o, (x) => x.t)].map(([k, r]) => ({ key: k, label: seg(k), value: orderCount(r) })), null);
          new BarList(body.querySelector('.d2')!, { color: C.ember, format: fmt.int }).update([...group(s, (x) => x.c)].map(([k, r]) => ({ key: k, label: fam(k), value: unmetUnits(r) })).filter((i) => i.value > 0), null);
        } else {
          const match = (x: SalesFact, m: number) => x.mi === m && (f.territory === null || x.t === f.territory) && (f.category === null || x.c === f.category);
          const rows = D.facts.filter((x) => match(x, mi));
          const prevRows = D.facts.filter((x) => match(x, mi - 12));
          const rev = revenue(rows), prev = revenue(prevRows);
          body.innerHTML = `<dl class="drawer-stats">${stat(tr(metric('revenue').label), fmt.money(rev))}${stat(tr(metric('gross_margin').label), pct(grossMargin(rows)))}${stat(L('Same month last year', 'الشهر نفسه من العام السابق'), prev ? signedPct((rev - prev) / prev) : L('Not available', 'غير متاح'))}</dl><h3>${L('Revenue by segment', 'الإيرادات حسب الشريحة')}</h3><div class="d-bars d1"></div><h3>${L('Revenue by product family', 'الإيرادات حسب عائلة المنتج')}</h3><div class="d-bars d2"></div>`;
          new BarList(body.querySelector('.d1')!, { color: C.glacier, format: fmt.money }).update([...group(rows, (x) => x.t)].map(([k, r]) => ({ key: k, label: seg(k), value: revenue(r) })), null);
          new BarList(body.querySelector('.d2')!, { color: C.glacier, format: fmt.money }).update([...group(rows, (x) => x.c)].map(([k, r]) => ({ key: k, label: fam(k), value: revenue(r) })), null);
        }
        body.insertAdjacentHTML('beforeend', `<p class="drawer-foot">${statusLabel(P.status)}. ${demoData ? L('Values are for demonstration only.', 'القيم للتوضيح فقط.') : L('Computed from the source exports.', 'محسوبة من مستخرجات المصدر.')}</p>`);
      });
    }
    function openGlossary() {
      openDrawer(L('About this data', 'عن هذه البيانات'), L('Data and metrics', 'البيانات والمؤشرات'), (body) => {
        const team = ALL_METRICS.filter((m) => m.origin === 'team'), web = ALL_METRICS.filter((m) => m.origin === 'website');
        const list = (ms: typeof ALL_METRICS) => `<dl class="glossary">${ms.map((m) => `<div><dt>${tr(m.label)}</dt><dd>${tr(m.definition)}<span class="formula" dir="ltr">${esc(m.formula)}</span></dd></div>`).join('')}</dl>`;
        body.innerHTML = `
          <dl class="prov-list">
            <div><dt>${L('Dataset', 'مجموعة البيانات')}</dt><dd>${demoData ? L('Synthetic demo dataset', 'بيانات تجريبية مولَّدة') : L('Wide World Importers source exports', 'مستخرجات مصدر Wide World Importers')} <code>${esc(P.datasetId)}</code></dd></div>
            <div><dt>${L('Status', 'الحالة')}</dt><dd>${statusBadge(P.status)}</dd></div>
            <div><dt>${L('Coverage', 'التغطية')}</dt><dd>${fmtDate(P.coverage.from)} – ${fmtDate(P.coverage.to)}</dd></div>
            <div><dt>${L('Produced', 'تاريخ الإنتاج')}</dt><dd>${P.producedAt ? fmtDate(P.producedAt.slice(0, 10)) : L('Generated on page load', 'يُولَّد عند تحميل الصفحة')}</dd></div>
            ${ready.file ? `<div><dt>${L('File', 'الملف')}</dt><dd><code>${esc(ready.file)}</code></dd></div>` : ''}
          </dl>
          ${demoData ? '' : `<p class="drawer-note">${L('Built by a documented script from the 16 CSV exports, which the project records as identical copies of the database. Customer names, contacts and addresses are not loaded. Product families are a website grouping of item names, not a field in the source.', 'بُنيت بنص برمجي موثّق من ملفات CSV الستة عشر التي يسجّلها المشروع نسخًا مطابقة لقاعدة البيانات. ولا تُحمَّل أسماء العملاء ولا بيانات الاتصال ولا العناوين. وعائلات المنتجات تجميع من الموقع لأسماء الأصناف، وليست حقلًا في المصدر.')}</p>`}
          <ul class="prov-notes" dir="ltr" lang="en">${P.notes.map((n) => `<li>${esc(n)}</li>`).join('')}${D.missing.map((m) => `<li>${esc(m.field)}: ${m.count} missing. ${esc(m.note)}</li>`).join('')}</ul>
          ${warningList(ready)}
          <h3>${L('Team KPIs', 'مؤشرات الفريق')}</h3>
          <p class="drawer-note">${L('Defined in the project’s KPI documentation; fill rate and on-time delivery are proposed there but not yet Power BI measures. Computed here from the same source fields.', 'معرّفة في توثيق المؤشرات بالمشروع؛ ومعدل التلبية والتسليم في الموعد مقترحان هناك ولم يُنفَّذا بعد مقاييسَ في Power BI. وتُحسب هنا من حقول المصدر نفسها.')}</p>
          ${list(team)}
          <h3>${L('Website metrics', 'مؤشرات الموقع')}</h3>
          <p class="drawer-note">${L('Added by this website for exploration. Not reviewed or approved by the team.', 'أضافها هذا الموقع للاستكشاف، ولم يراجعها الفريق أو يعتمدها.')}</p>
          ${list(web)}`;
      });
    }
    const closeDrawer = () => { if (!drawer.classList.contains('open')) return; drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); lastFocus?.focus(); };
    drawer.querySelector('.drawer-close')!.addEventListener('click', closeDrawer);
    $('.about-data').addEventListener('click', openGlossary);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', onKey);
    this.teardown.push(() => document.removeEventListener('keydown', onKey));

    /* Controls. Arrow keys follow the reading direction. */
    const next = rtl ? 'ArrowLeft' : 'ArrowRight', back = rtl ? 'ArrowRight' : 'ArrowLeft';
    const tabs = [...root.querySelectorAll<HTMLButtonElement>('.domains [role=tab]')];
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => switchDomain(t.dataset.d!));
      t.addEventListener('keydown', (e) => {
        let n = -1;
        if (e.key === next) n = (i + 1) % tabs.length;
        else if (e.key === back) n = (i + tabs.length - 1) % tabs.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = tabs.length - 1;
        if (n < 0) return;
        e.preventDefault();
        tabs[n].focus(); switchDomain(tabs[n].dataset.d!);
      });
    });
    const yearBtns = [...root.querySelectorAll<HTMLButtonElement>('.seg button')];
    yearBtns.forEach((b, i) => {
      b.addEventListener('click', () => { state.f = { ...state.f, year: b.dataset.year === '' ? null : Number(b.dataset.year) }; syncControls(); refresh(); });
      b.addEventListener('keydown', (e) => {
        if (e.key !== next && e.key !== back) return;
        e.preventDefault();
        const n = yearBtns[(i + (e.key === next ? 1 : yearBtns.length - 1)) % yearBtns.length];
        n.focus(); n.click();
      });
    });
    root.querySelectorAll<HTMLSelectElement>('select').forEach((s) => s.addEventListener('change', () => { state.f = { ...state.f, [s.dataset.k!]: s.value === '' ? null : Number(s.value) }; syncControls(); refresh(); }));

    syncControls();
    renderKpis(true);
    buildPanels();
    updatePanels();
    // arrival: the workspace assembles outward from the centre, the way the network left the hub
    if (!reduced) {
      gsap.fromTo(root.querySelectorAll('.hub-head, .domains, .filters'), { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.07, ease: 'expo.out', delay: 0.25, clearProps: 'transform' });
      gsap.fromTo([...kpiEl.children, ...panelsEl.children], { opacity: 0, scale: 0.975, y: 14 }, { opacity: 1, scale: 1, y: 0, duration: 0.9, stagger: 0.06, ease: 'expo.out', delay: 0.4, clearProps: 'transform' });
    }
    this.teardown.push(() => { mounted.forEach((m) => m.inst.destroy?.()); tip(null); });
  },
  unmount() { this.teardown.forEach((f) => f()); this.teardown = []; },
};

/** Explicit state when the project data is missing or was rejected. Never substitutes demo values. */
function renderUnavailable(root: HTMLElement, r: Exclude<DataResult, { state: 'ready' }>) {
  root.innerHTML = `
  <div class="hub page-pad">
    <header class="hub-head"><div><h1 class="display hub-title">${L('Observatory', 'المرصد')}</h1><p class="hub-sub">${L('Project data view', 'عرض بيانات المشروع')}</p></div><aside class="provenance" role="note" aria-label="${L('About this data', 'عن هذه البيانات')}">${dataBadge(r)}</aside></header>
    ${dataStatePanel(r, '/observatory', { headingId: 'missing-h' })}
  </div>`;
}

export default page;
