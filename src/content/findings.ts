import type { Bi } from '../data/types';
import type { Analysis } from '../data/analysis';

/**
 * The team's decision brief: eight findings ranked by decision value, quoted from the original project's
 * 08_Power_BI/Documentation/INSIGHTS_CATALOG.md (read-only). They are the team's work, reconciled by the
 * team in SQL; formal approval is still pending, so they are labelled that way.
 *
 * `recheck` recomputes the headline from the website's own dataset as an independent cross-check. It
 * returns null when the dataset cannot carry the figure (for example ledgers or postal territories, which the
 * website does not load). The quoted figure is never replaced by the recomputed one.
 */
export type TeamFinding = {
  id: string;
  rank: number;
  confidence: Bi;
  domain: Bi;
  question: Bi;
  finding: Bi;
  interpretation: Bi;
  treatment: Bi;
  recheck: (a: Analysis) => { expected: number; got: number; unit: 'money' | 'count' | 'pct' } | null;
};

export const TEAM_FINDINGS: TeamFinding[] = [
  {
    id: 'loss', rank: 1, confidence: { en: 'High', ar: 'عالية' }, domain: { en: 'Sales', ar: 'المبيعات' },
    question: { en: 'Where are loss lines concentrated?', ar: 'أين تتركز الأسطر الخاسرة؟' },
    finding: { en: 'Four light-brown Halloween zombie mask sizes account for 274,500 of 320,493.55 in negative recorded profit (85.6%), and 4,114 of the 4,626 negative lines across 18 products.', ar: 'أربعة مقاسات من قناع الزومبي البني الفاتح للهالوين مسؤولة عن 274,500 من أصل 320,493.55 من الربح المسجَّل السالب (85.6٪)، وعن 4,114 من 4,626 سطرًا سالبًا موزعة على 18 منتجًا.' },
    interpretation: { en: 'Review prices and costs on these four items. Loss-line totals exclude profitable sales of the same products and cannot establish the cause.', ar: 'مراجعة أسعار هذه الأصناف الأربعة وتكاليفها. مجاميع الأسطر الخاسرة لا تشمل المبيعات المربحة للمنتجات نفسها، ولا تثبت السبب.' },
    treatment: { en: 'Sales page: loss by item; executive benchmark.', ar: 'صفحة المبيعات: الخسارة حسب الصنف؛ معيار تنفيذي.' },
    recheck: (a) => ({ expected: 274500, got: a.loss.groupLoss, unit: 'money' }),
  },
  {
    id: 'unmet', rank: 2, confidence: { en: 'High', ar: 'عالية' }, domain: { en: 'Orders', ar: 'الطلبات' },
    question: { en: 'How concentrated is unmet demand?', ar: 'ما مدى تركّز الطلب غير الملبّى؟' },
    finding: { en: '360,276 of 9,310,904 ordered units were never picked (3.87%). Only 3,147 of 231,412 order lines had unpicked units (1.36%).', ar: '360,276 وحدة من أصل 9,310,904 وحدة مطلوبة لم تُجهَّز (3.87٪). ولم يكن في سوى 3,147 سطرًا من 231,412 سطر طلب وحدات غير مجهَّزة (1.36٪).' },
    interpretation: { en: 'Investigate the short lines by product before changing replenishment rules. Picking is a warehouse event; delivery performance needs delivery evidence.', ar: 'فحص الأسطر الناقصة حسب المنتج قبل تغيير قواعد إعادة التموين. التجهيز حدث في المستودع، أما أداء التسليم فيحتاج إلى أدلة التسليم.' },
    treatment: { en: 'Orders page: unmet units by product and order month.', ar: 'صفحة الطلبات: الوحدات غير الملبّاة حسب المنتج وشهر الطلب.' },
    recheck: (a) => ({ expected: 360276, got: a.demand.unmet, unit: 'count' }),
  },
  {
    id: 'gap', rank: 3, confidence: { en: 'High counts, interpretation pending', ar: 'أعداد عالية الثقة، والتفسير معلّق' }, domain: { en: 'Purchasing', ar: 'المشتريات' },
    question: { en: 'Which suppliers account for the receiving gap?', ar: 'أي الموردين مسؤولون عن فجوة الاستلام؟' },
    finding: { en: 'Fabrikam ordered 7,595,794 outers and delivered 7,577,583 (a gap of 18,211). Litware ordered 2,710,170 and delivered 2,702,432 (7,738). Together they account for all 25,949 outstanding outers.', ar: 'طلبت الشركة من Fabrikam ‏7,595,794 عبوة خارجية واستلمت 7,577,583 (بفجوة 18,211). ومن Litware ‏2,710,170 واستلمت 2,702,432 (7,738). ويفسّر الموردان معًا كل العبوات المعلّقة البالغة 25,949.' },
    interpretation: { en: 'Review open lines with purchasing. Outer packs vary by product, and an open quantity alone does not prove late delivery.', ar: 'مراجعة الأسطر المفتوحة مع المشتريات. حجم العبوة الخارجية يختلف حسب المنتج، والكمية المفتوحة وحدها لا تثبت تأخر التسليم.' },
    treatment: { en: 'Purchasing page: gap by supplier, receipts by receipt date.', ar: 'صفحة المشتريات: الفجوة حسب المورد، والاستلام حسب تاريخه.' },
    recheck: (a) => ({ expected: 25949, got: a.purchasing.unreceived, unit: 'count' }),
  },
  {
    id: 'reorder', rank: 4, confidence: { en: 'High for the recorded snapshot', ar: 'عالية للّقطة المسجَّلة' }, domain: { en: 'Inventory', ar: 'المخزون' },
    question: { en: 'What needs inventory review now?', ar: 'ما الذي يحتاج إلى مراجعة المخزون الآن؟' },
    finding: { en: '2 of 227 items are at or below their reorder level: the white 5XL “The Gu” t-shirt (3 against 5) and the 305 mm brown shipping carton (38 against 50).', ar: 'صنفان من 227 عند حد إعادة الطلب أو دونه: قميص “The Gu” الأبيض مقاس 5XL ‏(3 مقابل 5)، وكرتونة الشحن البنية 305 مم (38 مقابل 50).' },
    interpretation: { en: 'Check availability and open orders for these items. The snapshot has no business date, and the 227 historical balance discrepancies remain open.', ar: 'التحقق من التوافر والطلبات المفتوحة لهذين الصنفين. اللقطة بلا تاريخ عمل، ولا تزال فروق الأرصدة التاريخية الـ227 مفتوحة.' },
    treatment: { en: 'Inventory page: reorder alerts, kept apart from dated movements.', ar: 'صفحة المخزون: تنبيهات إعادة الطلب، منفصلة عن الحركات المؤرخة.' },
    recheck: (a) => ({ expected: 2, got: a.inventory.atReorder, unit: 'count' }),
  },
  {
    id: 'growth', rank: 5, confidence: { en: 'High', ar: 'عالية' }, domain: { en: 'Sales', ar: 'المبيعات' },
    question: { en: 'Did profit keep pace with sales?', ar: 'هل واكب الربحُ المبيعات؟' },
    finding: { en: 'From 2014 to 2015 net revenue rose from 49,929,487.20 to 53,991,490.45 (+8.14%), and recorded profit from 24,828,462.45 to 26,957,600.65 (+8.58%). Margin moved from 49.73% to 49.93%.', ar: 'من 2014 إلى 2015 ارتفع صافي الإيرادات من 49,929,487.20 إلى 53,991,490.45 (+8.14٪)، والربح المسجَّل من 24,828,462.45 إلى 26,957,600.65 (+8.58٪). وانتقل الهامش من 49.73٪ إلى 49.93٪.' },
    interpretation: { en: 'Growth came with a modest margin improvement. Review the product mix before attributing it to price. Compare complete years only: the last invoice is 31 May 2016.', ar: 'جاء النمو مع تحسن طفيف في الهامش. ينبغي مراجعة مزيج المنتجات قبل نسبته إلى السعر. وتُقارن السنوات الكاملة فقط: آخر فاتورة في 31 مايو 2016.' },
    treatment: { en: 'Executive page: monthly net and profit, complete-year comparison.', ar: 'الصفحة التنفيذية: الصافي والربح شهريًا، ومقارنة السنوات الكاملة.' },
    recheck: (a) => (a.growth ? { expected: 0.0814, got: a.growth.revenue, unit: 'pct' } : null),
  },
  {
    id: 'products', rank: 6, confidence: { en: 'High', ar: 'عالية' }, domain: { en: 'Products', ar: 'المنتجات' },
    question: { en: 'Does the unit leader also earn the most?', ar: 'هل الصنف الأعلى مبيعًا بالوحدات هو الأعلى إيرادًا؟' },
    finding: { en: 'The blue air cushion machine led revenue with 11,107,251 on 5,849 units, against 767,098.80 on 207,324 units for the leading fragile despatch tape.', ar: 'تصدّرت آلة الوسائد الهوائية الزرقاء الإيرادات بـ 11,107,251 من 5,849 وحدة، مقابل 767,098.80 من 207,324 وحدة لشريط الشحن الأعلى مبيعًا.' },
    interpretation: { en: 'Plan revenue exposure and unit handling separately. Unit counts do not measure physical volume or warehouse labour.', ar: 'تخطيط التعرض للإيرادات ومناولة الوحدات كلٌّ على حدة. عدد الوحدات لا يقيس الحجم الفعلي ولا جهد العمل في المستودع.' },
    treatment: { en: 'Products page: revenue and quantity ranked independently.', ar: 'صفحة المنتجات: ترتيب الإيرادات والكميات كلٌّ على حدة.' },
    recheck: (a) => (a.products.revenueLeader ? { expected: 11107251, got: a.products.revenueLeader.revenue, unit: 'money' } : null),
  },
  {
    id: 'concentration', rank: 7, confidence: { en: 'High', ar: 'عالية' }, domain: { en: 'Customers', ar: 'العملاء' },
    question: { en: 'Is exposure concentrated in a few buyers or a market?', ar: 'هل يتركّز التعرض في عدد قليل من المشترين أو في سوق واحدة؟' },
    finding: { en: 'The ten largest buyers contributed 3,634,066.95 of 172,261,341.20 (2.11%), and all 663 customers bought in the period. Novelty shops contributed 71.53% of revenue.', ar: 'أسهم أكبر عشرة مشترين بـ 3,634,066.95 من 172,261,341.20 (2.11٪)، واشترى كل العملاء الـ663 خلال الفترة. وأسهمت متاجر الهدايا الطريفة بـ 71.53٪ من الإيرادات.' },
    interpretation: { en: 'Account risk is low; segment exposure is high. Monitor both together. The customer category describes the master record, not why the segment buys more.', ar: 'خطر الحسابات منخفض، أما التعرض للشريحة فمرتفع؛ ويُراقبان معًا. فئة العميل تصف سجله الرئيسي، لا سبب زيادة مشتريات الشريحة.' },
    treatment: { en: 'Customers page: segment breakdown and customer drill-through.', ar: 'صفحة العملاء: التوزيع حسب الشريحة والتعمق في العميل.' },
    recheck: (a) => ({ expected: 0.0211, got: a.customers.top10, unit: 'pct' }),
  },
  {
    id: 'ledgers', rank: 8, confidence: { en: 'High for postings', ar: 'عالية للقيود' }, domain: { en: 'Finance', ar: 'المالية' },
    question: { en: 'How different are the ledger posting classes?', ar: 'ما مدى اختلاف فئات القيود في الدفاتر؟' },
    finding: { en: '70,510 customer invoice entries total +198,043,439.45 and 26,637 customer payments −197,776,428.01. Supplier invoices total +1,085,993,513.06 on 2,072 entries; 366 payments total −1,083,271,834.85.', ar: 'بلغ مجموع 70,510 قيد فاتورة للعملاء ‎+198,043,439.45، ومجموع 26,637 دفعة من العملاء ‎−197,776,428.01. وبلغت فواتير الموردين ‎+1,085,993,513.06 في 2,072 قيدًا، ومجموع 366 دفعة ‎−1,083,271,834.85.' },
    interpretation: { en: 'Investigate within each ledger and posting type. Signed totals cannot establish opening balances, liquidity or settlement.', ar: 'الفحص داخل كل دفتر ونوع قيد. المجاميع ذات الإشارة لا تثبت الأرصدة الافتتاحية ولا السيولة ولا التسوية.' },
    treatment: { en: 'Finance page: customer and supplier ledgers by type and date.', ar: 'صفحة المالية: دفاتر العملاء والموردين حسب النوع والتاريخ.' },
    recheck: () => null,
  },
];
