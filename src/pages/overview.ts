import '../styles/overview.css';
import type { Page } from '../lib/router';
import { pageHeader, nextChapter, siteFooter, statusBadge } from '../components/shell';
import { wireTabs, wireDisclosures, revealOnScroll } from '../components/tabs';
import { STAGES } from '../content/journey';
import { RESOURCES, SITE } from '../content/site';
import { L, tr } from '../i18n';
import type { Bi } from '../data/types';

/**
 * Project overview. Sources (read-only): the original project's technical documentation §1 (business
 * problem, users, analytical questions), PROJECT_STATUS (delivery state) and the final presentation.
 */

/** The flow of goods through the company, with the source schema that records each step. */
const FLOW: { id: string; label: Bi; tone: string; schema: string; what: Bi; tables: string[] }[] = [
  { id: 'suppliers', label: { en: 'Suppliers', ar: 'الموردون' }, tone: 'brass', schema: 'Purchasing', what: { en: 'Thirteen suppliers are on record; seven of them received purchase orders in the period. Each has its own category, such as novelty goods, toys or packaging.', ar: 'في السجلات ثلاثة عشر موردًا، تلقّى سبعة منهم أوامر شراء خلال الفترة. ولكل مورد فئته، مثل السلع الطريفة أو الألعاب أو مواد التغليف.' }, tables: ['Suppliers', 'SupplierCategories', 'SupplierTransactions'] },
  { id: 'purchasing', label: { en: 'Purchasing', ar: 'المشتريات' }, tone: 'brass', schema: 'Purchasing', what: { en: 'Purchase orders are counted in outer packs, not single units. Each line records what was ordered, what has been received so far, and the expected delivery date.', ar: 'تُحسب أوامر الشراء بالعبوات الخارجية لا بالوحدات المفردة. ويسجل كل سطر الكمية المطلوبة، وما استُلم منها حتى الآن، وتاريخ التسليم المتوقع.' }, tables: ['PurchaseOrders', 'PurchaseOrderLines'] },
  { id: 'warehouse', label: { en: 'Warehouse', ar: 'المستودع' }, tone: 'chalk', schema: 'Warehouse', what: { en: 'One warehouse holds 227 stock items. Each item carries a reorder level and a current quantity; every movement is logged as a stock transaction.', ar: 'يحتفظ مستودع واحد بـ 227 صنفًا. لكل صنف حد لإعادة الطلب وكمية حالية، وتُسجَّل كل حركة كمعاملة مخزون.' }, tables: ['StockItems', 'StockItemHoldings', 'StockItemTransactions'] },
  { id: 'sales', label: { en: 'Orders and sales', ar: 'الطلبات والمبيعات' }, tone: 'glacier', schema: 'Sales', what: { en: 'Customers place orders; lines are picked, invoiced and delivered. Ordered quantities that are not picked are unmet demand, and an order that cannot ship complete becomes a backorder.', ar: 'يقدّم العملاء الطلبات، فتُجهَّز أسطرها وتُفوتر وتُسلَّم. الكميات المطلوبة التي لا تُجهَّز تمثل طلبًا غير ملبّى، والطلب الذي لا يُشحن كاملًا يصبح طلبًا مؤجلًا.' }, tables: ['Orders', 'OrderLines', 'Invoices', 'InvoiceLines', 'CustomerTransactions'] },
  { id: 'customers', label: { en: 'Customers', ar: 'العملاء' }, tone: 'glacier', schema: 'Sales', what: { en: '663 customers in five segments: novelty shops (459 of them), supermarkets, gift stores, computer stores and corporate buyers.', ar: '663 عميلًا في خمس شرائح: متاجر الهدايا الطريفة (459 منها)، والسوبر ماركت، ومتاجر الهدايا، ومتاجر الحاسوب، والعملاء من الشركات.' }, tables: ['Customers', 'CustomerCategories'] },
];

const QUESTIONS: Bi[] = [
  { en: 'How do revenue and recorded profit develop, and which products and customers drive them?', ar: 'كيف تتطور الإيرادات والربح المسجَّل، وأي المنتجات والعملاء يقودونهما؟' },
  { en: 'Where does profit leak through lines sold at a loss?', ar: 'أين يتسرّب الربح عبر الأسطر المبيعة بخسارة؟' },
  { en: 'How much ordered demand is never picked?', ar: 'ما حجم الطلب الذي لا يُجهَّز أبدًا؟' },
  { en: 'Which suppliers have ordered but unreceived quantities?', ar: 'أي الموردين لديهم كميات مطلوبة لم تُستلم؟' },
  { en: 'What is the current stock position, and which items are at their reorder level?', ar: 'ما وضع المخزون الحالي، وأي الأصناف بلغت حد إعادة الطلب؟' },
  { en: 'How do the customer and supplier ledgers break down?', ar: 'كيف تتوزع دفاتر حسابات العملاء والموردين؟' },
];

const OBJECTIVES: { t: Bi; d: Bi }[] = [
  { t: { en: 'Reconcile three grains into one model', ar: 'توحيد ثلاثة مستويات تفصيل في نموذج واحد' }, d: { en: 'Sales, purchasing and stock are recorded at different grains, in different units (eaches and outer packs) and on different dates. Join them so a question about one can be answered with the others.', ar: 'تُسجَّل المبيعات والمشتريات والمخزون بمستويات تفصيل مختلفة، وبوحدات مختلفة (قطع وعبوات خارجية)، وبتواريخ مختلفة. والهدف ربطها لتُجاب أسئلة أحدها بأدلة الآخرين.' } },
  { t: { en: 'Define each measure once', ar: 'تعريف كل مقياس مرة واحدة' }, d: { en: 'A measure such as net revenue has one definition, used identically in SQL, in DAX and on every report page, and reconciled between them.', ar: 'لمقياس مثل صافي الإيرادات تعريف واحد، يُستخدم بالطريقة نفسها في SQL وDAX وفي كل صفحة تقرير، ويُطابق بينها.' } },
  { t: { en: 'Keep data quality honest', ar: 'الأمانة في جودة البيانات' }, d: { en: 'Data problems are recorded as findings for the team to decide on. Loss-making lines, stock discrepancies and missing dates are preserved, never silently repaired.', ar: 'تُسجَّل مشكلات البيانات كملاحظات يقرر فيها الفريق. وتُحفظ الأسطر الخاسرة وفروق المخزون والتواريخ المفقودة دون إصلاح صامت.' } },
  { t: { en: 'Turn measures into decisions', ar: 'تحويل المقاييس إلى قرارات' }, d: { en: 'Present each result with its evidence, its limits and a practical recommendation for sales, purchasing and inventory managers.', ar: 'عرض كل نتيجة مع دليلها وحدودها وتوصية عملية لمديري المبيعات والمشتريات والمخزون.' } },
];

const page: Page & { cleanup: (() => void)[] } = {
  cleanup: [],
  mount(root) {
    root.innerHTML = `
    <div class="overview page-pad">
      ${pageHeader('overview', L('A supply chain, read end to end.', 'سلسلة إمداد، تُقرأ من أولها إلى آخرها.'), L(`${SITE.programme}, Professional Data Analyst track. The project reconciles how goods, orders and money move through a wholesale business into one analytical model and a Power BI report, built on Microsoft’s Wide World Importers sample database.`, 'مشروع تخرج مبادرة رواد مصر الرقمية (DEPI)، مسار محلل البيانات المحترف. يوحّد المشروع حركة البضائع والطلبات والأموال في شركة جملة ضمن نموذج تحليلي واحد وتقرير Power BI، اعتمادًا على قاعدة بيانات Wide World Importers النموذجية من Microsoft.'))}

      <section class="section sec-grid" aria-labelledby="ov-problem">
        <div class="sec-aside">
          <h2 class="sec-title" id="ov-problem">${L('The business problem', 'مشكلة العمل')}</h2>
          <p class="sec-note">${L('Wide World Importers is a sample company created by Microsoft. Its records are realistic, but they describe no real business.', 'Wide World Importers شركة نموذجية أنشأتها Microsoft. سجلاتها واقعية، لكنها لا تصف شركة حقيقية.')}</p>
        </div>
        <div class="prose-lg" data-reveal>
          <p>${L('Wide World Importers is a wholesale distributor of novelty goods: joke mugs, toys, novelty slippers, Halloween masks, branded apparel and the packaging that ships them.', 'Wide World Importers موزع جملة للسلع الطريفة: أكواب النكات، والألعاب، والنعال الطريفة، وأقنعة الهالوين، والملابس المطبوعة، ومواد التغليف التي تُشحن بها.')}</p>
          <p>${L('Its sales, purchasing and warehouse operations are recorded in one operational database, but at different grains (order line, invoice line, purchase-order line, stock transaction), in different units and against different dates. Management cannot easily follow demand from order to pick to invoice, through the products, suppliers and stock movements behind the financial results.', 'تُسجَّل عمليات المبيعات والمشتريات والمستودع في قاعدة بيانات تشغيلية واحدة، لكن بمستويات تفصيل مختلفة (سطر الطلب، وسطر الفاتورة، وسطر أمر الشراء، ومعاملة المخزون)، وبوحدات مختلفة، ومقابل تواريخ مختلفة. لذلك يصعب على الإدارة تتبّع الطلب من الطلبية إلى التجهيز إلى الفاتورة، عبر المنتجات والموردين وحركات المخزون التي تقف وراء النتائج المالية.')}</p>
          <p>${L('The project reconciles these sources into one model that sales, purchasing and inventory analysts, operations managers and the evaluators can trust.', 'يوحّد المشروع هذه المصادر في نموذج واحد يثق به محللو المبيعات والمشتريات والمخزون ومديرو العمليات والمقيّمون.')}</p>
        </div>
      </section>

      <section class="section flow-section" aria-labelledby="ov-flow">
        <div class="flow-head">
          <h2 class="sec-title" id="ov-flow">${L('How goods move', 'كيف تتحرك البضائع')}</h2>
          <p class="sec-note">${L('Select a step to see what happens there and where the source database records it.', 'اختر خطوة لترى ما يحدث فيها وأين تسجّله قاعدة بيانات المصدر.')}</p>
        </div>
        <div class="flow panel-frame" data-reveal>
          <div class="flow-track" role="tablist" aria-label="${L('Steps in the flow of goods', 'خطوات حركة البضائع')}">
            ${FLOW.map((f, i) => `<button role="tab" data-tab="${f.id}" id="flow-${f.id}" aria-controls="flow-panel" class="tone-${f.tone}" style="--i:${i}"><span class="ft-node" aria-hidden="true"></span><span class="ft-label">${tr(f.label)}</span></button>`).join('')}
          </div>
          <div class="flow-panel" id="flow-panel" role="tabpanel" aria-live="polite"></div>
        </div>
      </section>

      <section class="section sec-grid" aria-labelledby="ov-q">
        <div class="sec-aside">
          <h2 class="sec-title" id="ov-q">${L('Six analytical questions', 'ستة أسئلة تحليلية')}</h2>
          <p class="sec-note">${L('As written in the project’s technical documentation. Every page of the report answers one or more of them.', 'كما وردت في التوثيق الفني للمشروع. تجيب كل صفحة من التقرير عن سؤال منها أو أكثر.')}</p>
        </div>
        <ol class="questions-list" data-reveal>
          ${QUESTIONS.map((q, i) => `<li><span class="num">${i + 1}</span><p>${tr(q)}</p></li>`).join('')}
        </ol>
      </section>

      <section class="section" aria-labelledby="ov-obj">
        <h2 class="sec-title" id="ov-obj">${L('Objectives', 'الأهداف')}</h2>
        <ul class="objectives">
          ${OBJECTIVES.map((o) => `<li data-reveal><h3>${tr(o.t)}</h3><p>${tr(o.d)}</p></li>`).join('')}
        </ul>
      </section>

      <section class="section sec-grid" aria-labelledby="ov-scope">
        <div class="sec-aside">
          <h2 class="sec-title" id="ov-scope">${L('Scope', 'النطاق')}</h2>
          <p class="sec-note">${L('What the analysis covers, and what it deliberately leaves out.', 'ما يغطيه التحليل، وما يستبعده عن قصد.')}</p>
        </div>
        <div class="scope-cols" data-reveal>
          <div>
            <h3>${L('Included', 'مشمول')}</h3>
            <ul>
              <li>${L('The Wide World Importers operational database, read only', 'قاعدة بيانات Wide World Importers التشغيلية، للقراءة فقط')}</li>
              <li>${L('Sales, orders, purchasing, inventory, customer and supplier ledgers', 'المبيعات، والطلبات، والمشتريات، والمخزون، ودفاتر العملاء والموردين')}</li>
              <li>${L('41 months, from January 2013 to May 2016', '41 شهرًا، من يناير 2013 إلى مايو 2016')}</li>
              <li>${L('A Power BI report as the main deliverable, with SQL and Python behind it', 'تقرير Power BI بوصفه المخرج الرئيسي، تدعمه أعمال SQL وPython')}</li>
            </ul>
          </div>
          <div>
            <h3>${L('Left out', 'مستبعد')}</h3>
            <ul>
              <li>${L('Microsoft’s separate data-warehouse sample: the team built its own model', 'نموذج مستودع البيانات المنفصل من Microsoft: بنى الفريق نموذجه الخاص')}</li>
              <li>${L('Personal fields the analysis does not need, such as logins, phone numbers and photos', 'الحقول الشخصية التي لا يحتاجها التحليل، مثل بيانات الدخول وأرقام الهواتف والصور')}</li>
              <li>${L('Forecasting: the project describes what happened, it does not predict', 'التنبؤ: يصف المشروع ما حدث ولا يتنبأ')}</li>
            </ul>
          </div>
        </div>
      </section>

      <section class="section" aria-labelledby="ov-method">
        <div class="method-head">
          <h2 class="sec-title" id="ov-method">${L('Method', 'المنهجية')}</h2>
          <p class="sec-note">${L('Seven stages, from the source tables to a recommendation. Each states the method, what the project did, and whether it is complete.', 'سبع مراحل من جداول المصدر إلى التوصية. تذكر كل مرحلة المنهجية، وما أنجزه المشروع، وهل اكتملت.')}</p>
        </div>
        <ol class="method">
          ${STAGES.map((s, i) => `
          <li data-reveal>
            <span class="m-n num">${i + 1}</span>
            <div class="m-body">
              <h3>${tr(s.title)} ${statusBadge(s.state)}</h3>
              <p>${tr(s.method)}</p>
              <button class="text-btn" type="button" aria-expanded="false" aria-controls="m-proj-${s.id}">${L('What the project did', 'ما أنجزه المشروع')}</button>
              <div class="m-proj" id="m-proj-${s.id}" hidden><p>${tr(s.project)}</p><p class="j-evidence"><span>${L('Evidence', 'الدليل')}</span> ${tr(s.evidence)}</p></div>
            </div>
          </li>`).join('')}
        </ol>
      </section>

      <section class="section sec-grid" aria-labelledby="ov-deliv">
        <div class="sec-aside">
          <h2 class="sec-title" id="ov-deliv">${L('Deliverables', 'المخرجات')}</h2>
          <p class="sec-note">${L('“Completed” means built and tested. Scope, cleaning rules and the semantic model still await formal team approval.', '“مكتمل” يعني أنه بُني واختُبر. أما النطاق وقواعد التنظيف والنموذج الدلالي فلا تزال بانتظار الاعتماد الرسمي من الفريق.')}</p>
        </div>
        <ul class="deliverables" data-reveal>
          ${RESOURCES.map((d) => `<li><div><h3>${tr(d.label)}</h3><p>${tr(d.note)}</p></div>${statusBadge(d.status)}</li>`).join('')}
          <li><div><h3>${L('This website', 'هذا الموقع')}</h3><p>${L('An interactive, bilingual showcase of the project. Its own analysis is labelled as website analysis.', 'عرض تفاعلي ثنائي اللغة للمشروع. ويُميَّز تحليله الخاص بوصفه تحليلًا من الموقع.')}</p></div>${statusBadge('progress')}</li>
        </ul>
      </section>

      <section class="section" aria-labelledby="ov-tech">
        <h2 class="sec-title" id="ov-tech">${L('Technical overview', 'نظرة فنية')}</h2>
        <ol class="pipeline" data-reveal aria-label="${L('Technical pipeline', 'المسار الفني')}">
          <li><b>SQL Server</b><span>${L('Operational source, read only; 16 tables exported to CSV', 'المصدر التشغيلي للقراءة فقط؛ 16 جدولًا مستخرجًا إلى CSV')}</span></li>
          <li><b>${L('Bronze · Silver · Gold', 'برونزي · فضي · ذهبي')}</b><span>${L('48 raw tables, 31 cleaned tables, 18 analytical views', '48 جدولًا خامًا، و31 جدولًا منظّفًا، و18 عرضًا تحليليًا')}</span></li>
          <li><b>${L('Semantic model', 'النموذج الدلالي')}</b><span>${L('7 facts, 6 dimensions, 42 DAX measures', '7 حقائق، و6 أبعاد، و42 مقياس DAX')}</span></li>
          <li><b>${L('Report', 'التقرير')}</b><span>${L('11 pages, 229 visuals, 22/22 KPIs reconciled', '11 صفحة، و229 عنصرًا مرئيًا، و22 من 22 مؤشرًا مطابقًا')}</span></li>
        </ol>
        <p class="sec-note pipeline-note">${statusBadge('pending', L('Counts from project files; team approval pending', 'الأرقام من ملفات المشروع؛ الاعتماد بانتظار الفريق'))} <a class="text-link" href="#/engineering">${L('Read the engineering case study', 'اقرأ دراسة الحالة الهندسية')}</a></p>
      </section>

      ${nextChapter('overview', L('Explore 41 months of reconciled data across six domains, with cross-filters and drill-down.', 'استكشف 41 شهرًا من البيانات المطابقة عبر ستة مجالات، مع مرشحات متقاطعة وتعمّق.'))}
      ${siteFooter()}
    </div>`;

    const panel = root.querySelector<HTMLElement>('.flow-panel')!;
    const track = root.querySelector<HTMLElement>('.flow-track')!;
    wireTabs(track, (id, i) => {
      const f = FLOW.find((x) => x.id === id)!;
      track.style.setProperty('--sel', String(i));
      panel.setAttribute('aria-labelledby', `flow-${id}`);
      panel.innerHTML = `
        <div class="fp-main">
          <p class="fp-step num">${L(`Step ${i + 1} of ${FLOW.length}`, `الخطوة ${i + 1} من ${FLOW.length}`)}</p>
          <h3 class="display">${tr(f.label)}</h3>
          <p>${tr(f.what)}</p>
        </div>
        <div class="fp-schema">
          <p class="fp-label">${L(`Recorded in the <b>${f.schema}</b> schema`, `مُسجَّل في مخطط <b>${f.schema}</b>`)}</p>
          <ul dir="ltr">${f.tables.map((t) => `<li class="num">${f.schema}.${t}</li>`).join('')}</ul>
        </div>`;
    });
    wireDisclosures(root);
    this.cleanup.push(revealOnScroll(root));
  },
  unmount() { this.cleanup.forEach((f) => f()); this.cleanup = []; },
};
export default page;
