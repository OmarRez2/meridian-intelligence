import type { MetricDefinition, Unit } from './types';

/**
 * Metric registry (phase 5 review of the 23 prototype metrics against the real source).
 *
 * origin 'team':    the same definition as a measure in the team's Power BI model or a KPI in its decision brief
 *                   (Net Revenue, Recorded Gross Profit, Unmet Units, Loss on Negative Lines, Items at Reorder,
 *                   fill rate, on-time delivery, Unreceived Outer Packs, Current Stock Value at Cost, ...).
 * origin 'website': added by the website's own analysis of the same source.
 * status:           every definition stays 'proposed' until the team approves its semantic model.
 *
 * Removed after the review: pick wait (median 0 days with multi-year outliers in the source), units per order
 * (mixed invoice and order grains), average days late (0 for every received purchase order) and repeat
 * customers (every one of the 663 customers bought in more than one month, so it does not discriminate).
 */
type Def = [id: string, unit: Unit, better: MetricDefinition['better'], origin: MetricDefinition['origin'], en: string, ar: string, defEn: string, defAr: string, formula: string];

const rows: Def[] = [
  // sales
  ['revenue', 'currency', 'up', 'team', 'Net revenue', 'صافي الإيرادات',
    'Value of invoiced sales in the period, excluding tax.', 'قيمة المبيعات المُفوترة في الفترة، دون الضريبة.',
    'SUM(Quantity × UnitPrice) over invoice lines'],
  ['gross_profit', 'currency', 'up', 'team', 'Recorded gross profit', 'إجمالي الربح المسجَّل',
    'Profit recorded on every invoice line, including the lines sold at a loss.', 'الربح المسجَّل على كل سطر فاتورة، بما في ذلك الأسطر التي بيعت بخسارة.',
    'SUM(LineProfit) over invoice lines'],
  ['gross_margin', 'ratio', 'up', 'team', 'Gross margin', 'هامش الربح الإجمالي',
    'Share of net revenue kept as recorded gross profit.', 'النسبة التي تبقى من صافي الإيرادات ربحًا إجماليًا مسجَّلًا.',
    'Recorded gross profit ÷ Net revenue'],
  ['units_sold', 'units', 'up', 'team', 'Units sold', 'الوحدات المبيعة',
    'Quantity invoiced across all lines.', 'إجمالي الكميات المُفوترة في جميع الأسطر.',
    'SUM(Quantity) over invoice lines'],
  ['loss_value', 'currency', 'down', 'team', 'Loss on negative lines', 'خسارة الأسطر السالبة',
    'Absolute value of the negative recorded profit on lines sold at a loss.', 'القيمة المطلقة للربح السالب في الأسطر التي بيعت بخسارة.',
    '−SUM(LineProfit) WHERE LineProfit < 0'],
  // orders and fulfilment
  ['orders', 'count', 'neutral', 'website', 'Orders', 'الطلبات',
    'Customer orders placed in the period, by order date.', 'طلبات العملاء المسجَّلة في الفترة، حسب تاريخ الطلب.',
    'COUNT(orders)'],
  ['fill_rate', 'ratio', 'up', 'team', 'Fill rate', 'معدل التلبية',
    'Share of ordered units that were picked.', 'نسبة الوحدات المطلوبة التي جُهِّزت فعلًا.',
    '1 − Unpicked units ÷ Ordered units'],
  ['unmet_units', 'units', 'down', 'team', 'Unpicked units', 'الوحدات غير المجهَّزة',
    'Units ordered but not picked, from order lines.', 'الوحدات التي طُلبت ولم تُجهَّز، من أسطر الطلبات.',
    'SUM(Quantity − PickedQuantity) over order lines'],
  ['backorder_rate', 'ratio', 'down', 'website', 'Backorder rate', 'معدل الطلبات المؤجَّلة',
    'Share of orders that spawned a backorder for items that could not be picked.', 'نسبة الطلبات التي تولَّد عنها طلب مؤجَّل لأصناف تعذَّر تجهيزها.',
    'Orders with a BackorderOrderID ÷ Orders'],
  ['on_time_delivery', 'ratio', 'up', 'team', 'On-time delivery', 'التسليم في الموعد',
    'Share of confirmed deliveries made on or before the order’s expected delivery date.', 'نسبة التسليمات المؤكَّدة التي تمت في تاريخ التسليم المتوقع للطلب أو قبله.',
    'Invoices WHERE confirmed delivery date ≤ expected delivery date ÷ invoices with a confirmed delivery'],
  // purchasing
  ['purchase_spend', 'currency', 'neutral', 'website', 'Purchase order value', 'قيمة أوامر الشراء',
    'Expected value of purchase order lines raised in the period. Not supplier invoices.', 'القيمة المتوقعة لأسطر أوامر الشراء الصادرة في الفترة، وليست فواتير الموردين.',
    'SUM(OrderedOuters × ExpectedUnitPricePerOuter)'],
  ['purchase_orders', 'count', 'neutral', 'website', 'Purchase orders', 'أوامر الشراء',
    'Purchase orders raised in the period.', 'أوامر الشراء الصادرة في الفترة.',
    'COUNT(purchase orders)'],
  ['avg_lead_time', 'days', 'down', 'website', 'Average lead time', 'متوسط مهلة التوريد',
    'Days from ordering to final receipt, over fully received purchase orders.', 'عدد الأيام من إصدار أمر الشراء حتى آخر استلام، للأوامر المستلَمة بالكامل.',
    'AVG(last receipt date − order date)'],
  ['unreceived_outers', 'units', 'down', 'team', 'Outers not yet received', 'عبوات لم تُستلَم بعد',
    'Outer packs ordered but not yet received. Outer packs vary by product.', 'العبوات الخارجية المطلوبة التي لم تُستلَم بعد. يختلف حجم العبوة من منتج لآخر.',
    'SUM(OrderedOuters − ReceivedOuters)'],
  ['received_share', 'ratio', 'up', 'website', 'Received share', 'نسبة المستلَم',
    'Outer packs received as a share of outer packs ordered.', 'العبوات الخارجية المستلَمة منسوبةً إلى العبوات المطلوبة.',
    'SUM(ReceivedOuters) ÷ SUM(OrderedOuters)'],
  // suppliers
  ['on_time_receipt', 'ratio', 'up', 'website', 'On-time receipt', 'الاستلام في الموعد',
    'Share of fully received purchase orders received on or before their expected delivery date.', 'نسبة أوامر الشراء المستلَمة بالكامل التي وصلت في تاريخها المتوقع أو قبله.',
    'Orders with last receipt ≤ expected date ÷ fully received orders'],
  ['top3_spend_share', 'ratio', 'neutral', 'website', 'Top-three share', 'حصة أكبر ثلاثة موردين',
    'Share of purchase order value placed with the three largest suppliers. A concentration measure, not a target.', 'حصة أكبر ثلاثة موردين من قيمة أوامر الشراء. مقياس للتركُّز، وليس هدفًا.',
    'Value with top 3 suppliers ÷ Purchase order value'],
  ['active_suppliers', 'count', 'neutral', 'website', 'Active suppliers', 'الموردون النشطون',
    'Suppliers with at least one purchase order in the period.', 'الموردون الذين صدر لهم أمر شراء واحد على الأقل في الفترة.',
    'COUNT(DISTINCT supplier)'],
  // inventory
  ['items_below_reorder', 'count', 'down', 'team', 'Items at reorder level', 'أصناف عند حد إعادة الطلب',
    'Stock items whose quantity on hand is at or below their reorder level.', 'الأصناف التي تساوي كميتها المتاحة حدَّ إعادة الطلب أو تقل عنه.',
    'COUNT(items WHERE QuantityOnHand ≤ ReorderLevel)'],
  ['stock_value', 'currency', 'neutral', 'team', 'Stock value at cost', 'قيمة المخزون بالتكلفة',
    'Quantity on hand valued at the last cost price.', 'الكمية المتاحة مُقيَّمة بآخر سعر تكلفة.',
    'SUM(QuantityOnHand × LastCostPrice)'],
  ['months_cover', 'months', 'neutral', 'website', 'Median months of cover', 'وسيط أشهر التغطية',
    'How many months current stock would last at the last twelve months’ average sales; the median across items.', 'عدد الأشهر التي يكفيها المخزون الحالي بمتوسط مبيعات آخر اثني عشر شهرًا؛ الوسيط عبر الأصناف.',
    'MEDIAN(QuantityOnHand ÷ average monthly units sold)'],
  ['items_tracked', 'count', 'neutral', 'website', 'Items tracked', 'الأصناف المتابَعة',
    'Stock items in scope for the selected family.', 'الأصناف المشمولة ضمن العائلة المختارة.',
    'COUNT(stock items)'],
  // customers
  ['active_customers', 'count', 'up', 'team', 'Active customers', 'العملاء النشطون',
    'Customers with at least one invoice in the period.', 'العملاء الذين لديهم فاتورة واحدة على الأقل في الفترة.',
    'COUNT(DISTINCT invoiced customer)'],
  ['revenue_per_customer', 'currency', 'up', 'website', 'Revenue per customer', 'الإيراد لكل عميل',
    'Net revenue divided by active customers.', 'صافي الإيرادات مقسومًا على عدد العملاء النشطين.',
    'Net revenue ÷ Active customers'],
  ['top10_share', 'ratio', 'neutral', 'team', 'Top-ten share', 'حصة أكبر عشرة عملاء',
    'Share of revenue from the ten largest customers. A concentration measure, not a target.', 'حصة أكبر عشرة عملاء من الإيرادات. مقياس للتركُّز، وليس هدفًا.',
    'Revenue from top 10 customers ÷ Net revenue'],
  ['top_quintile_share', 'ratio', 'neutral', 'website', 'Top-fifth share', 'حصة الخُمس الأعلى',
    'Share of revenue from the largest 20% of customers. An even spread sits near 20%.', 'حصة أكبر 20٪ من العملاء من الإيرادات. التوزيع المتكافئ يقترب من 20٪.',
    'Revenue from the top 20% of customers ÷ Net revenue'],
];

const list: MetricDefinition[] = rows.map(([id, unit, better, origin, en, ar, defEn, defAr, formula]) => ({
  id, unit, better, origin, status: 'proposed', formula, label: { en, ar }, definition: { en: defEn, ar: defAr },
}));

export const METRICS: Record<string, MetricDefinition> = Object.fromEntries(list.map((m) => [m.id, m]));
export const metric = (id: string): MetricDefinition => {
  const m = METRICS[id];
  if (!m) throw new Error(`Unknown metric: ${id}`);
  return m;
};
export const ALL_METRICS = list;
