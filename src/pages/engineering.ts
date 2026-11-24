import '../styles/engineering.css';
import type { Page } from '../lib/router';
import type { Bi } from '../data/types';
import { pageHeader, nextChapter, siteFooter, statusBadge } from '../components/shell';
import { wireTabs, wireDisclosures, revealOnScroll } from '../components/tabs';
import { codeBlock, type Lang } from '../components/code';
import { motion } from '../lib/motion';
import { L, tr } from '../i18n';

const B = (en: string, ar: string): Bi => ({ en, ar });

/* ------------------------------------------------------------------ architecture (project record) */
type ArchNode = { id: string; label: Bi; sub: Bi; col: number; row: number; tone: 'brass' | 'chalk' | 'glacier' | 'haze'; role: Bi };
const ARCH: ArchNode[] = [
  { id: 'src', label: B('Source database', 'قاعدة المصدر'), sub: B('Operational sample', 'عيّنة تشغيلية'), col: 1, row: 1, tone: 'brass', role: B('The operational Wide World Importers database on SQL Server. It is read, never written to.', 'قاعدة بيانات Wide World Importers التشغيلية على SQL Server. يُقرأ منها فقط، ولا يُكتب فيها أبدًا.') },
  { id: 'raw', label: B('Raw layer', 'الطبقة الخام'), sub: B('Bronze', 'البرونزية'), col: 2, row: 1, tone: 'haze', role: B('A faithful copy of the source tables, so later steps never need to touch the source again.', 'نسخة أمينة من جداول المصدر، فلا تحتاج المراحل اللاحقة إلى الرجوع إلى المصدر مرة أخرى.') },
  { id: 'clean', label: B('Cleaned layer', 'الطبقة المنظَّفة'), sub: B('Silver', 'الفضية'), col: 3, row: 1, tone: 'chalk', role: B('Types, keys and joins made consistent. Quality rules run here, and failing records are flagged for review.', 'تُوحَّد فيها الأنواع والمفاتيح والروابط. وتُطبَّق هنا قواعد الجودة، وتُعلَّم السجلات المخالفة للمراجعة.') },
  { id: 'gold', label: B('Analytical layer', 'الطبقة التحليلية'), sub: B('Gold views', 'العروض الذهبية'), col: 4, row: 1, tone: 'glacier', role: B('Views shaped for analysis: facts and dimensions ready for the semantic model.', 'عروض مهيّأة للتحليل: حقائق وأبعاد جاهزة للنموذج الدلالي.') },
  { id: 'model', label: B('Semantic model', 'النموذج الدلالي'), sub: B('Power BI', 'Power BI'), col: 5, row: 1, tone: 'glacier', role: B('Imports the analytical layer and defines relationships and DAX measures once, for every page.', 'يستورد الطبقة التحليلية ويعرّف العلاقات ومقاييس DAX مرة واحدة لكل الصفحات.') },
  { id: 'report', label: B('Report', 'التقرير'), sub: B('Power BI pages', 'صفحات Power BI'), col: 6, row: 1, tone: 'glacier', role: B('Pages for each domain, with filters and drill-through. Desktop runtime checks are still to be done.', 'صفحة لكل مجال، مع المرشحات والتعمق في التفاصيل. ولا تزال فحوص التشغيل في Power BI Desktop قيد الإنجاز.') },
  { id: 'csv', label: B('CSV exports', 'مستخرجات CSV'), sub: B('Independent copy', 'نسخة مستقلة'), col: 2, row: 2, tone: 'haze', role: B('Exports of the source tables used by a separate, script-based cleaning process.', 'مستخرجات من جداول المصدر تستخدمها عملية تنظيف منفصلة قائمة على السكربتات.') },
  { id: 'py', label: B('Cleaning cross-check', 'تنظيف للمقارنة'), sub: B('Python and pandas', 'Python وpandas'), col: 3, row: 2, tone: 'chalk', role: B('An independent cleaning of the exports. Its results are compared with the cleaned layer to catch errors in either.', 'تنظيف مستقل للمستخرجات، تُقارن نتائجه بالطبقة المنظَّفة لاكتشاف الأخطاء في أيٍّ منهما.') },
];
const EDGES: [string, string, boolean?][] = [['src', 'raw'], ['raw', 'clean'], ['clean', 'gold'], ['gold', 'model'], ['model', 'report'], ['src', 'csv'], ['csv', 'py'], ['py', 'clean', true]];

/* ------------------------------------------------------------------ public sample schema */
const SCHEMAS: Record<string, { note: Bi; tables: [string, Bi][] }> = {
  Sales: { note: B('Customers, their orders and invoices.', 'العملاء وطلباتهم وفواتيرهم.'), tables: [
    ['Customers', B('One row per customer, with category, buying group and delivery city', 'صف لكل عميل، مع فئته ومجموعة الشراء ومدينة التسليم')],
    ['Orders', B('One row per customer order, with order and expected delivery dates', 'صف لكل طلب عميل، مع تاريخ الطلب وتاريخ التسليم المتوقع')],
    ['OrderLines', B('One row per item ordered; quantities and picked quantities', 'صف لكل صنف مطلوب؛ الكميات المطلوبة والمجهَّزة')],
    ['Invoices', B('One row per invoice raised against an order', 'صف لكل فاتورة صادرة على طلب')],
    ['InvoiceLines', B('One row per invoiced item, with price and line profit', 'صف لكل صنف مفوتر، مع السعر وربح السطر')],
    ['CustomerTransactions', B('Invoices, payments and adjustments on customer accounts', 'الفواتير والمدفوعات والتسويات على حسابات العملاء')]] },
  Purchasing: { note: B('Suppliers and what is bought from them.', 'الموردون وما يُشترى منهم.'), tables: [
    ['Suppliers', B('One row per supplier, with category and payment terms', 'صف لكل مورد، مع فئته وشروط الدفع')],
    ['PurchaseOrders', B('One row per purchase order, with expected delivery date', 'صف لكل أمر شراء، مع تاريخ التسليم المتوقع')],
    ['PurchaseOrderLines', B('One row per item ordered; quantities ordered and received', 'صف لكل صنف مطلوب؛ الكميات المطلوبة والمستلمة')],
    ['SupplierTransactions', B('Supplier invoices, payments and adjustments', 'فواتير الموردين ومدفوعاتهم وتسوياتهم')]] },
  Warehouse: { note: B('Stock items and every movement of stock.', 'أصناف المخزون وكل حركة عليه.'), tables: [
    ['StockItems', B('One row per product, with supplier, unit price and lead time', 'صف لكل منتج، مع المورد وسعر الوحدة ومدة التوريد')],
    ['StockItemHoldings', B('Current quantity on hand, reorder level and target level per item', 'الكمية المتاحة حاليًا، وحد إعادة الطلب، والمستوى المستهدف لكل صنف')],
    ['StockItemTransactions', B('Every receipt, sale and adjustment of stock', 'كل استلام وبيع وتسوية للمخزون')],
    ['StockGroups', B('Product groupings such as Novelty Items or Mugs', 'مجموعات المنتجات مثل السلع الطريفة أو الأكواب')]] },
  Application: { note: B('Shared reference data: people, places and methods.', 'بيانات مرجعية مشتركة: الأشخاص والأماكن والطرق.'), tables: [
    ['People', B('Staff and contacts. Includes personal fields the analysis excludes', 'الموظفون وجهات الاتصال. ويتضمن حقولًا شخصية يستبعدها التحليل')],
    ['Cities', B('Cities with their state', 'المدن مع ولاياتها')],
    ['StateProvinces', B('States with their sales territory', 'الولايات مع مناطق مبيعاتها')],
    ['DeliveryMethods', B('How goods are delivered', 'طرق تسليم البضائع')]] },
};

/* ------------------------------------------------------------------ quality dimensions (illustrative rules) */
const QUALITY = [
  { t: B('Completeness', 'الاكتمال'), q: B('Is every required value present?', 'هل كل قيمة مطلوبة موجودة؟'), ex: B('An order line without a stock item cannot be analysed by product.', 'سطر الطلب الذي لا يحمل صنفًا لا يمكن تحليله حسب المنتج.') },
  { t: B('Validity', 'الصلاحية'), q: B('Is each value in its allowed range and type?', 'هل كل قيمة ضمن نطاقها ونوعها المسموحين؟'), ex: B('A quantity of zero or less on an order line is flagged.', 'تُعلَّم الكمية التي تساوي صفرًا أو أقل في سطر الطلب.') },
  { t: B('Consistency', 'الاتساق'), q: B('Do related records agree?', 'هل تتفق السجلات المترابطة؟'), ex: B('An invoiced quantity higher than the ordered quantity is flagged.', 'تُعلَّم الكمية المفوترة إذا زادت على الكمية المطلوبة.') },
  { t: B('Uniqueness', 'التفرّد'), q: B('Is each entity recorded once?', 'هل يُسجَّل كل كيان مرة واحدة؟'), ex: B('Two customer rows with the same name and address are reviewed.', 'يُراجَع صفّا عميل يحملان الاسم والعنوان نفسيهما.') },
  { t: B('Referential integrity', 'سلامة المراجع'), q: B('Does every reference point to something real?', 'هل يشير كل مرجع إلى شيء موجود فعلًا؟'), ex: B('An order that names a customer who does not exist is held.', 'يُعلَّق الطلب الذي يذكر عميلًا غير موجود.') },
  { t: B('Timeliness', 'التسلسل الزمني'), q: B('Do the dates make sense in order?', 'هل تتسلسل التواريخ تسلسلًا منطقيًا؟'), ex: B('A delivery recorded before its order date is flagged.', 'يُعلَّم التسليم المسجَّل قبل تاريخ طلبه.') },
];

/* ------------------------------------------------------------------ illustrative star schema */
type Ent = { id: string; label: Bi; kind: 'fact' | 'dim'; x: number; y: number; grain: Bi };
const ENTS: Ent[] = [
  { id: 'fsales', label: B('Sales', 'المبيعات'), kind: 'fact', x: 300, y: 165, grain: B('One row per invoiced line', 'صف لكل سطر مفوتر') },
  { id: 'fpurch', label: B('Purchases', 'المشتريات'), kind: 'fact', x: 560, y: 245, grain: B('One row per purchase order line', 'صف لكل سطر في أمر شراء') },
  { id: 'date', label: B('Date', 'التاريخ'), kind: 'dim', x: 430, y: 60, grain: B('One row per calendar day', 'صف لكل يوم في التقويم') },
  { id: 'cust', label: B('Customer', 'العميل'), kind: 'dim', x: 110, y: 70, grain: B('One row per customer', 'صف لكل عميل') },
  { id: 'city', label: B('City and territory', 'المدينة والمنطقة'), kind: 'dim', x: 90, y: 250, grain: B('One row per city, with its sales territory', 'صف لكل مدينة، مع منطقة مبيعاتها') },
  { id: 'item', label: B('Stock item', 'صنف المخزون'), kind: 'dim', x: 430, y: 330, grain: B('One row per product, with its stock group', 'صف لكل منتج، مع مجموعته') },
  { id: 'emp', label: B('Salesperson', 'مندوب المبيعات'), kind: 'dim', x: 250, y: 345, grain: B('One row per employee', 'صف لكل موظف') },
  { id: 'supp', label: B('Supplier', 'المورد'), kind: 'dim', x: 700, y: 130, grain: B('One row per supplier', 'صف لكل مورد') },
];
const RELS: [string, string][] = [['fsales', 'date'], ['fsales', 'cust'], ['fsales', 'city'], ['fsales', 'item'], ['fsales', 'emp'], ['fpurch', 'date'], ['fpurch', 'item'], ['fpurch', 'supp']];

/* ------------------------------------------------------------------ illustrative code (code and its comments stay in English) */
const SNIPPETS: { id: string; tab: Bi; lang: Lang; label: Bi; why: Bi; code: string }[] = [
  { id: 'profile', tab: B('Profiling', 'التحليل الوصفي'), lang: 'sql', label: B('Profile a source table', 'تحليل وصفي لجدول من المصدر'), why: B('Before changing anything, establish size, date range and how many orders are still unpicked.', 'قبل أي تغيير، حدّد الحجم ونطاق التواريخ وعدد الطلبات التي لم تُجهَّز بعد.'), code: `-- Profile a source table before transforming it
SELECT
    COUNT(*)                        AS row_count,
    COUNT(DISTINCT o.CustomerID)    AS customers,
    MIN(o.OrderDate)                AS first_order,
    MAX(o.OrderDate)                AS last_order,
    SUM(CASE WHEN o.PickingCompletedWhen IS NULL
             THEN 1 ELSE 0 END)     AS not_yet_picked
FROM Sales.Orders AS o;` },
  { id: 'rule', tab: B('Quality rule', 'قاعدة جودة'), lang: 'sql', label: B('Referential integrity check', 'فحص سلامة المراجع'), why: B('Rows returned are held for review. They are not deleted or repaired by the check.', 'الصفوف التي يعيدها الفحص تُعلَّق للمراجعة، ولا يحذفها الفحص ولا يصلحها.'), code: `-- Order lines must reference an existing stock item
SELECT ol.OrderLineID,
       ol.StockItemID
FROM Sales.OrderLines AS ol
LEFT JOIN Warehouse.StockItems AS si
       ON si.StockItemID = ol.StockItemID
WHERE si.StockItemID IS NULL;  -- held for review, not deleted` },
  { id: 'margin', tab: B('Measure', 'مقياس'), lang: 'dax', label: B('Gross margin measure', 'مقياس الهامش الإجمالي'), why: B('DIVIDE returns blank instead of an error when revenue is zero, so empty filters stay empty.', 'تعيد الدالة DIVIDE قيمة فارغة بدل الخطأ عندما تكون الإيرادات صفرًا، فتبقى المرشحات الفارغة فارغة.'), code: `Gross Margin % =
DIVIDE ( [Gross Profit], [Revenue] )  // blank when revenue is zero` },
  { id: 'lfl', tab: B('Comparison', 'مقارنة'), lang: 'dax', label: B('Like-for-like change', 'التغيّر على أساس مماثل'), why: B('The sample ends in May 2016, so a partial year must be compared with the same months of the year before.', 'تنتهي العيّنة في مايو 2016، لذا تُقارن السنة الجزئية بالأشهر نفسها من السنة السابقة.'), code: `Revenue Change vs Same Months LY =
VAR CurrentRevenue = [Revenue]
VAR PriorRevenue =
    CALCULATE ( [Revenue], SAMEPERIODLASTYEAR ( 'Date'[Date] ) )
RETURN
    DIVIDE ( CurrentRevenue - PriorRevenue, PriorRevenue )` },
];

/* ------------------------------------------------------------------ decisions (project record) */
const RULE = B('Project rule', 'قاعدة في المشروع'), RECORD = B('Project record', 'من سجل المشروع');
const DECISIONS = [
  { t: B('The source is read only', 'المصدر للقراءة فقط'), why: B('All transformation happens in separate layers, so the shared source database stays exactly as delivered.', 'تجري التحويلات كلها في طبقات منفصلة، فتبقى قاعدة المصدر المشتركة كما سُلّمت تمامًا.'), status: RULE },
  { t: B('Findings are preserved, not silently fixed', 'الملاحظات تُحفظ ولا تُصلح بصمت'), why: B('A data problem is evidence. It is recorded and left for the team to decide on, rather than corrected out of sight.', 'مشكلة البيانات دليل؛ تُسجَّل ويُترك القرار فيها للفريق، بدل تصحيحها بعيدًا عن الأنظار.'), status: RULE },
  { t: B('An independent cleaning cross-check', 'تنظيف مستقل للمقارنة'), why: B('A second, script-based cleaning of exported data gives a reference to compare the SQL layers against.', 'تنظيف ثانٍ للبيانات المستخرجة بالسكربتات يوفّر مرجعًا تُقارن به طبقات SQL.'), status: RECORD },
  { t: B('One report project', 'مشروع تقرير واحد'), why: B('The team keeps a single Power BI project as the deliverable, so there is one place where measures are defined.', 'يعتمد الفريق مشروع Power BI واحدًا مُخرَجًا للمشروع، فيكون للمقاييس مكان تعريف واحد.'), status: RECORD },
];
const CHALLENGES = [
  { t: B('Agreeing on one number', 'الاتفاق على رقم واحد'), d: B('The same measure has to agree in SQL, in the model and in the written documentation before it can be published.', 'يجب أن يتطابق المقياس نفسه في SQL وفي النموذج وفي التوثيق المكتوب قبل نشره.') },
  { t: B('A partial final year', 'سنة أخيرة جزئية'), d: B('The sample ends in May 2016, so year-on-year comparisons must use the same months of each year.', 'تنتهي العيّنة في مايو 2016، لذا يجب أن تقارن المقارنات السنوية الأشهر نفسها من كل سنة.') },
  { t: B('Runtime checks still to come', 'فحوص التشغيل لم تكتمل بعد'), d: B('Refresh, rendering, navigation and drill-through in Power BI Desktop have not been verified yet.', 'لم يُتحقق بعد من التحديث والعرض والتنقل والتعمق في التفاصيل داخل Power BI Desktop.') },
];

const page: Page & { cleanup: (() => void)[] } = {
  cleanup: [],
  mount(root) {
    const pending = L('Project record, pending team review', 'من سجل المشروع، بانتظار مراجعة الفريق');
    root.innerHTML = `
    <div class="engineering page-pad">
      ${pageHeader('engineering', L('How the numbers are made.', 'كيف تُصنع الأرقام.'), L('The data engineering behind the project: where the data comes from, how it is checked, how it is modelled and how a measure is confirmed before anyone relies on it.', 'هندسة البيانات وراء المشروع: من أين تأتي البيانات، وكيف تُفحص، وكيف تُنمذج، وكيف يُثبَّت المقياس قبل أن يعتمد عليه أحد.'))}

      <section class="section" aria-labelledby="en-arch">
        <div class="en-head">
          <h2 class="sec-title" id="en-arch">${L('Architecture', 'البنية')}</h2>
          <p class="sec-note">${L('Select a component to see its role.', 'اختر مكوّنًا لترى دوره.')} ${statusBadge('unverified', pending)}</p>
        </div>
        <div class="arch panel-frame" data-reveal>
          <div class="arch-grid" role="tablist" aria-label="${L('Architecture components', 'مكوّنات البنية')}">
            <svg class="arch-wires" aria-hidden="true"></svg>
            ${ARCH.map((n) => `<button role="tab" data-tab="${n.id}" id="arch-${n.id}" aria-controls="arch-panel" class="arch-node tone-${n.tone}" style="grid-column:${n.col};grid-row:${n.row}"><b>${tr(n.label)}</b><span>${tr(n.sub)}</span></button>`).join('')}
          </div>
          <div class="arch-panel" id="arch-panel" role="tabpanel"></div>
        </div>
      </section>

      <section class="section" aria-labelledby="en-schema">
        <div class="en-head">
          <h2 class="sec-title" id="en-schema">${L('Understanding the source', 'فهم المصدر')}</h2>
          <p class="sec-note">${L('The main schemas of the public sample database and the tables the analysis leans on.', 'المخططات الرئيسية في قاعدة البيانات النموذجية العامة، والجداول التي يعتمد عليها التحليل.')} ${statusBadge('illustrative', L('Public sample schema', 'مخطط العيّنة العامة'))}</p>
        </div>
        <div class="schema" data-reveal>
          <div class="tablist schema-tabs" role="tablist" aria-label="${L('Source schemas', 'مخططات المصدر')}">
            ${Object.keys(SCHEMAS).map((s) => `<button role="tab" data-tab="${s}" id="sch-${s}" aria-controls="schema-panel" dir="ltr">${s}</button>`).join('')}
          </div>
          <div class="schema-panel" id="schema-panel" role="tabpanel"></div>
        </div>
      </section>

      <section class="section sec-grid" aria-labelledby="en-quality">
        <div class="sec-aside">
          <h2 class="sec-title" id="en-quality">${L('Data quality', 'جودة البيانات')}</h2>
          <p class="sec-note">${L('Six questions every table is asked. The examples show the kind of rule used; they are written for this page.', 'ستة أسئلة يُسأل عنها كل جدول. والأمثلة توضّح نوع القواعد المستخدمة، وقد كُتبت لهذه الصفحة.')} ${statusBadge('illustrative')}</p>
        </div>
        <ul class="quality" data-reveal>
          ${QUALITY.map((q, i) => `<li><button type="button" aria-expanded="false" aria-controls="q-${i}"><span class="q-t">${tr(q.t)}</span><span class="q-q">${tr(q.q)}</span></button><p id="q-${i}" hidden>${tr(q.ex)}</p></li>`).join('')}
        </ul>
      </section>

      <section class="section" aria-labelledby="en-model">
        <div class="en-head">
          <h2 class="sec-title" id="en-model">${L('Dimensional model', 'النموذج البُعدي')}</h2>
          <p class="sec-note">${L('A star schema: facts in the centre, the dimensions that describe them around the edge. Point at or focus a table to trace its relationships.', 'مخطط نجمي: الحقائق في الوسط، والأبعاد التي تصفها حولها. أشر إلى جدول أو ركّز عليه لتتبّع علاقاته.')} ${statusBadge('illustrative', L('Illustrative model', 'نموذج توضيحي'))}</p>
        </div>
        <div class="star panel-frame" data-reveal>
          <svg class="star-svg" viewBox="0 0 800 400" role="group" aria-label="${L('Illustrative star schema', 'مخطط نجمي توضيحي')}">
            <g class="rels">${RELS.map(([a, b]) => { const A = ENTS.find((e) => e.id === a)!, Bn = ENTS.find((e) => e.id === b)!; return `<line data-a="${a}" data-b="${b}" x1="${A.x}" y1="${A.y}" x2="${Bn.x}" y2="${Bn.y}"/><text data-a="${a}" data-b="${b}" class="card" x="${A.x + (Bn.x - A.x) * 0.78}" y="${A.y + (Bn.y - A.y) * 0.78 - 5}">1</text><text data-a="${a}" data-b="${b}" class="card" x="${A.x + (Bn.x - A.x) * 0.2}" y="${A.y + (Bn.y - A.y) * 0.2 - 5}">*</text>`; }).join('')}</g>
            ${ENTS.map((e) => `<g class="ent ent-${e.kind}" data-id="${e.id}" tabindex="0" role="button" aria-label="${tr(e.label)}${L(', ', '، ')}${e.kind === 'fact' ? L('fact table', 'جدول حقائق') : L('dimension', 'بُعد')}. ${tr(e.grain)}" transform="translate(${e.x} ${e.y})"><rect x="${e.kind === 'fact' ? -62 : -70}" y="-19" width="${e.kind === 'fact' ? 124 : 140}" height="38" rx="${e.kind === 'fact' ? 3 : 19}"/><text text-anchor="middle" y="5">${tr(e.label)}</text></g>`).join('')}
          </svg>
          <div class="star-info" aria-live="polite"><p class="si-t">${L('Two facts, six dimensions', 'جدولا حقائق وستة أبعاد')}</p><p class="si-d">${L('Sales and purchases share the Date and Stock item dimensions, so both can be filtered by the same calendar and products.', 'تشترك المبيعات والمشتريات في بُعدي التاريخ وصنف المخزون، فيمكن تصفيتهما بالتقويم نفسه والمنتجات نفسها.')}</p></div>
        </div>
      </section>

      <section class="section" aria-labelledby="en-code">
        <div class="en-head">
          <h2 class="sec-title" id="en-code">${L('SQL and DAX', 'SQL وDAX')}</h2>
          <p class="sec-note">${L('Examples of the kind of query and measure the project uses.', 'أمثلة على نوع الاستعلامات والمقاييس التي يستخدمها المشروع.')} ${statusBadge('illustrative', L('Illustrative, not project code', 'توضيحي، وليس من شيفرة المشروع'))}</p>
        </div>
        <div class="codeview" data-reveal>
          <div class="tablist" role="tablist" aria-label="${L('Code examples', 'أمثلة الشيفرة')}">
            ${SNIPPETS.map((s) => `<button role="tab" data-tab="${s.id}" id="code-${s.id}" aria-controls="code-panel">${tr(s.tab)}</button>`).join('')}
          </div>
          <div class="code-panel" id="code-panel" role="tabpanel"></div>
        </div>
      </section>

      <section class="section sec-grid" aria-labelledby="en-valid">
        <div class="sec-aside">
          <h2 class="sec-title" id="en-valid">${L('Validation', 'التحقق')}</h2>
          <p class="sec-note">${L('A measure is trusted only when three independent sources agree on it.', 'لا يُعتمد المقياس إلا إذا اتفقت عليه ثلاثة مصادر مستقلة.')}</p>
        </div>
        <div class="recon" data-reveal>
          <svg class="recon-svg" viewBox="0 0 420 300" role="img" aria-label="${L('Reconciliation triangle: SQL query, Power BI model and documentation must agree', 'مثلث المطابقة: يجب أن يتفق استعلام SQL ونموذج Power BI والتوثيق')}">
            <path class="recon-tri" d="M210 40 L370 255 L50 255 Z"/>
            <circle class="recon-core" cx="210" cy="183" r="7"/>
            <g class="recon-pt" transform="translate(210 40)"><circle r="9"/><text y="-18" text-anchor="middle">${L('SQL query', 'استعلام SQL')}</text></g>
            <g class="recon-pt" transform="translate(370 255)"><circle r="9"/><text y="34" text-anchor="middle">${L('Power BI model', 'نموذج Power BI')}</text></g>
            <g class="recon-pt" transform="translate(50 255)"><circle r="9"/><text y="34" text-anchor="middle">${L('Documentation', 'التوثيق')}</text></g>
          </svg>
          <ol class="recon-steps">
            <li>${L('Each measure is written down with its definition before it is built.', 'يُكتب كل مقياس مع تعريفه قبل بنائه.')}</li>
            <li>${L('The same figure is computed by a SQL query against the analytical layer.', 'يُحسب الرقم نفسه باستعلام SQL على الطبقة التحليلية.')}</li>
            <li>${L('The model’s DAX measure is evaluated with the same filters.', 'يُقيَّم مقياس DAX في النموذج بالمرشحات نفسها.')}</li>
            <li>${L('The figures are compared. A difference is investigated, never averaged away.', 'تُقارن الأرقام. وأي فرق يُتحرّى عنه، ولا يُخفى بالمتوسطات أبدًا.')}</li>
          </ol>
          <a class="text-link" href="#/insights">${L('How findings are marked as they are verified', 'كيف تُعلَّم النتائج كلما جرى التحقق منها')}</a>
        </div>
      </section>

      <section class="section" aria-labelledby="en-dec">
        <div class="en-head">
          <h2 class="sec-title" id="en-dec">${L('Decisions and challenges', 'القرارات والتحديات')}</h2>
          <p class="sec-note">${statusBadge('unverified', pending)}</p>
        </div>
        <div class="decisions" data-reveal>
          <ul class="dec-list">
            ${DECISIONS.map((d) => `<li><h3>${tr(d.t)}</h3><p>${tr(d.why)}</p><span class="dec-s">${tr(d.status)}</span></li>`).join('')}
          </ul>
          <div class="challenges">
            <h3 class="ch-h">${L('Open challenges', 'تحديات قائمة')}</h3>
            <ul>${CHALLENGES.map((c) => `<li><b>${tr(c.t)}</b><p>${tr(c.d)}</p></li>`).join('')}</ul>
          </div>
        </div>
      </section>

      ${nextChapter('engineering', L('The people behind the project and the resources it produced.', 'الأشخاص وراء المشروع والمخرجات التي أنتجها.'))}
      ${siteFooter()}
    </div>`;

    /* architecture: wires are drawn from the live positions of the nodes */
    const grid = root.querySelector<HTMLElement>('.arch-grid')!;
    const wires = root.querySelector<SVGSVGElement>('.arch-wires')!;
    const drawWires = () => {
      const g = grid.getBoundingClientRect();
      wires.setAttribute('viewBox', `0 0 ${g.width} ${g.height}`);
      const box = (id: string) => { const r = grid.querySelector(`[data-tab="${id}"]`)!.getBoundingClientRect(); return { l: r.left - g.left, r: r.right - g.left, t: r.top - g.top, b: r.bottom - g.top, cx: r.left - g.left + r.width / 2, cy: r.top - g.top + r.height / 2 }; };
      wires.innerHTML = EDGES.map(([a, b, back], i) => {
        const A = box(a), Bx = box(b);
        // in Arabic the grid runs right to left, so a forward wire leaves the node's left edge
        const rtl = Bx.cx < A.cx;
        let d: string;
        if (Math.abs(A.cy - Bx.cy) < 4) d = rtl ? `M${A.l} ${A.cy} L${Bx.r} ${Bx.cy}` : `M${A.r} ${A.cy} L${Bx.l} ${Bx.cy}`;
        else if (back) d = `M${A.cx} ${A.t} L${Bx.cx} ${Bx.b}`;
        else d = rtl ? `M${A.cx} ${A.b} C${A.cx} ${(A.b + Bx.cy) / 2} ${Bx.r + 40} ${Bx.cy} ${Bx.r} ${Bx.cy}` : `M${A.cx} ${A.b} C${A.cx} ${(A.b + Bx.cy) / 2} ${Bx.l - 40} ${Bx.cy} ${Bx.l} ${Bx.cy}`;
        return `<path class="wire${back ? ' wire-back' : ''}" data-a="${a}" data-b="${b}" d="${d}" style="--i:${i}"/>`;
      }).join('');
    };
    const ro = new ResizeObserver(drawWires);
    ro.observe(grid);
    this.cleanup.push(() => ro.disconnect());
    const archPanel = root.querySelector<HTMLElement>('.arch-panel')!;
    wireTabs(grid, (id) => {
      const n = ARCH.find((x) => x.id === id)!;
      archPanel.setAttribute('aria-labelledby', `arch-${id}`);
      archPanel.innerHTML = `<h3 class="display">${tr(n.label)}</h3><p>${tr(n.role)}</p>`;
      wires.querySelectorAll('.wire').forEach((w) => w.classList.toggle('lit', w.getAttribute('data-a') === id || w.getAttribute('data-b') === id));
    });

    /* schema explorer */
    const sp = root.querySelector<HTMLElement>('.schema-panel')!;
    wireTabs(root.querySelector<HTMLElement>('.schema-tabs')!, (s) => {
      const S = SCHEMAS[s];
      sp.setAttribute('aria-labelledby', `sch-${s}`);
      sp.innerHTML = `<p class="sp-note">${tr(S.note)}</p><table class="sp-table"><caption class="sr-only">${L(`Main tables in the ${s} schema`, `الجداول الرئيسية في مخطط ${s}`)}</caption><thead><tr><th scope="col">${L('Table', 'الجدول')}</th><th scope="col">${L('What one row holds', 'ما يحمله الصف الواحد')}</th></tr></thead><tbody>${S.tables.map(([t, d]) => `<tr><th scope="row" class="num" dir="ltr">${s}.${t}</th><td>${tr(d)}</td></tr>`).join('')}</tbody></table>`;
    }, 0);

    /* star schema: highlight a table's relationships */
    const svg = root.querySelector<SVGSVGElement>('.star-svg')!;
    const info = root.querySelector<HTMLElement>('.star-info')!;
    const defaultInfo = info.innerHTML;
    const focusEnt = (id: string | null) => {
      svg.classList.toggle('focusing', !!id);
      svg.querySelectorAll<SVGElement>('[data-a]').forEach((el) => el.classList.toggle('lit', !!id && (el.dataset.a === id || el.dataset.b === id)));
      svg.querySelectorAll<SVGGElement>('.ent').forEach((g) => {
        const linked = !!id && (g.dataset.id === id || RELS.some(([a, b]) => (a === id && b === g.dataset.id) || (b === id && a === g.dataset.id)));
        g.classList.toggle('lit', linked);
      });
      if (!id) { info.innerHTML = defaultInfo; return; }
      const e = ENTS.find((x) => x.id === id)!;
      const links = RELS.filter(([a, b]) => a === id || b === id).map(([a, b]) => tr(ENTS.find((x) => x.id === (a === id ? b : a))!.label));
      info.innerHTML = `<p class="si-t">${tr(e.label)} <span>${e.kind === 'fact' ? L('fact', 'حقائق') : L('dimension', 'بُعد')}</span></p><p class="si-d">${tr(e.grain)}. ${e.kind === 'fact' ? L('Filtered by', 'يُصفّى حسب') : L('Filters', 'يصفّي')} ${links.join(L(', ', '، '))}.</p>`;
    };
    svg.querySelectorAll<SVGGElement>('.ent').forEach((g) => {
      g.addEventListener('pointerenter', () => focusEnt(g.dataset.id!));
      g.addEventListener('focus', () => focusEnt(g.dataset.id!));
      g.addEventListener('pointerleave', () => focusEnt(null));
      g.addEventListener('blur', () => focusEnt(null));
    });

    /* code viewer */
    const cp = root.querySelector<HTMLElement>('.code-panel')!;
    const copyLabel = L('Copy example', 'نسخ المثال');
    wireTabs(root.querySelector<HTMLElement>('.codeview [role=tablist]')!, (id) => {
      const s = SNIPPETS.find((x) => x.id === id)!;
      cp.setAttribute('aria-labelledby', `code-${id}`);
      cp.innerHTML = `${codeBlock(s.code, s.lang, tr(s.label))}<div class="code-why"><p>${tr(s.why)}</p><button class="text-btn copy" type="button">${copyLabel}</button></div>`;
      cp.querySelector('.copy')!.addEventListener('click', async (e) => {
        const b = e.currentTarget as HTMLButtonElement;
        try { await navigator.clipboard.writeText(s.code); b.textContent = L('Copied', 'نُسخ'); } catch { b.textContent = L('Copy not available', 'النسخ غير متاح'); }
        setTimeout(() => (b.textContent = copyLabel), 1800);
      });
    });

    wireDisclosures(root);
    root.querySelector('.engineering')!.classList.toggle('still', motion.still);
    this.cleanup.push(revealOnScroll(root), motion.subscribe(() => root.querySelector('.engineering')?.classList.toggle('still', motion.still)));
  },
  unmount() { this.cleanup.forEach((f) => f()); this.cleanup = []; },
};
export default page;
