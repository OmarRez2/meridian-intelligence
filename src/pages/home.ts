import '../styles/home.css';
import { gsap } from 'gsap';
import type { Page } from '../lib/router';
import type { Rig } from '../scene/Sky';
import { stage, direct, transitionFlags } from '../scene/stage';
import { isCoarse } from '../lib/env';
import { motion } from '../lib/motion';
import { MEMBERS } from '../content/site';
import { STAGES } from '../content/journey';
import { spark } from '../charts/spark';
import { getDataset, type DataResult } from '../data/adapter';
import { domainPreviews } from '../data/derive';
import { analyse, type Analysis } from '../data/analysis';
import { siteFooter } from '../components/shell';
import { dataBadge, dataStatePanel } from '../components/datastate';
import { esc } from '../lib/format';
import { i18n, L, tr, segName, famName, pct, money, int, monthLong } from '../i18n';

const DOMAIN_TEXT: Record<string, { label: () => string; q: () => string }> = {
  sales: { label: () => L('Sales', 'المبيعات'), q: () => L('Revenue, recorded profit and losses by segment and family', 'الإيرادات والربح المسجَّل والخسائر حسب الشريحة والعائلة') },
  orders: { label: () => L('Orders', 'الطلبات'), q: () => L('Fill rate, backorders and unpicked demand', 'معدل التلبية والطلبات المؤجلة والطلب غير المجهَّز') },
  purchasing: { label: () => L('Purchasing', 'المشتريات'), q: () => L('Purchase-order value and the receiving gap', 'قيمة أوامر الشراء وفجوة الاستلام') },
  inventory: { label: () => L('Inventory', 'المخزون'), q: () => L('Reorder alerts and months of cover', 'تنبيهات إعادة الطلب وأشهر التغطية') },
  suppliers: { label: () => L('Suppliers', 'الموردون'), q: () => L('Concentration and lead times', 'التركّز ومدد التوريد') },
  customers: { label: () => L('Customers', 'العملاء'), q: () => L('663 accounts and revenue concentration', '663 حسابًا وتركّز الإيرادات') },
};

/** The wording that depends on the data the instrument encodes, computed from that data. */
function storyCopy(r: DataResult, a: Analysis | null) {
  if (r.state !== 'ready' || !a) {
    return {
      badge: `<span class="hero-demo">${dataBadge(r)}</span>`,
      segTitle: L('Demand comes from five customer segments.', 'يأتي الطلب من خمس شرائح من العملاء.'),
      segLede: L('Each constellation is a customer segment. No project data is loaded, so every constellation is drawn at the same size.', 'كل كوكبة تمثل شريحة من العملاء. لم تُحمَّل بيانات المشروع، فرُسمت الكوكبات كلها بالحجم نفسه.'),
      dialTitle: L('The calendar, read around the rim.', 'التقويم، يُقرأ حول الحافة.'),
      dialLede: L('With project data, each column on the rim would be one month of revenue. None is loaded, so the rim stays empty.', 'مع بيانات المشروع، يمثل كل عمود على الحافة شهرًا من الإيرادات. ولم يُحمَّل شيء، فتبقى الحافة فارغة.'),
      shareSuffix: '',
    };
  }
  const ds = r.dataset, demo = ds.provenance.status === 'synthetic';
  const lead = a.segments.slice().sort((x, y) => y.share - x.share)[0];
  const leadCustomers = ds.customers.filter((c) => c.t === lead.t).length;
  const first = ds.months[0], last = ds.months[ds.months.length - 1];
  const pill = demo ? ` <span class="demo-pill">${L('Synthetic values', 'قيم مولَّدة')}</span>` : '';
  return {
    badge: demo ? `<span class="demo-pill hero-demo">${L('Viewing synthetic demo data', 'تعرض الآن بيانات تجريبية مولَّدة')}</span>` : `<span class="hero-demo">${dataBadge(r)}</span>`,
    segTitle: L(`Demand comes from ${a.segments.length} customer segments, one of them dominant.`, `يأتي الطلب من ${a.segments.length} شرائح من العملاء، تهيمن إحداها.`),
    segLede: L(`Each constellation is a customer segment, sized by its share of revenue. ${segName(ds.territories[lead.t])} — ${int(leadCustomers)} of ${int(ds.customers.length)} customers — bring in ${pct(lead.share)} of revenue.${pill}`, `كل كوكبة شريحة من العملاء، وحجمها بحسب حصتها من الإيرادات. ${segName(ds.territories[lead.t])} — ${int(leadCustomers)} من ${int(ds.customers.length)} عميلًا — تجلب ${pct(lead.share)} من الإيرادات.${pill}`),
    dialTitle: L(`${ds.months.length} months, read around the rim.`, `${ds.months.length} شهرًا، تُقرأ حول الحافة.`),
    dialLede: L(`The lattice unwinds onto the calendar rim. Each column is one month of net revenue, ${monthLong(first.m)} ${first.y} to ${monthLong(last.m)} ${last.y}: ${money(a.totals.revenue)} in all, at a ${pct(a.totals.margin)} recorded margin.${pill}`, `تنفك الشبكة على حافة التقويم. كل عمود شهر من صافي الإيرادات، من ${monthLong(first.m)} ${first.y} إلى ${monthLong(last.m)} ${last.y}: ${money(a.totals.revenue)} إجمالًا، بهامش مسجَّل ${pct(a.totals.margin)}.${pill}`),
    shareSuffix: L('of revenue', 'من الإيرادات'),
  };
}

/** Four headline findings, computed from the data in view and linked to their full treatment. */
function headlines(r: DataResult, a: Analysis | null) {
  if (r.state !== 'ready' || !a) return '';
  const ds = r.dataset;
  const lo = a.loss, d = a.demand, pu = a.purchasing, inv = a.inventory;
  const items = [
    lo.family !== null && { tone: 'ember', area: L('Sales', 'المبيعات'), v: pct(lo.groupShare, 0), t: L(`of recorded losses come from just ${int(lo.group.length)} items in ${famName(ds.categories[lo.family])}.`, `من الخسائر المسجَّلة مصدرها ${int(lo.group.length)} أصناف من ${famName(ds.categories[lo.family])}.`) },
    d.families[0] && { tone: 'glacier', area: L('Orders', 'الطلبات'), v: int(d.unmet), t: L(`ordered units were never picked, ${pct(d.families[0].share + (d.families[1]?.share ?? 0), 0)} of them in two product families.`, `وحدة مطلوبة لم تُجهَّز أبدًا، ${pct(d.families[0].share + (d.families[1]?.share ?? 0), 0)} منها في عائلتين فقط.`) },
    pu.growth && { tone: 'brass', area: L('Purchasing', 'المشتريات'), v: `${pu.growth.toFixed(1)}×`, t: L(`growth in purchase-order value over ${pu.years[0].year}–${pu.years[pu.years.length - 1].year}, while sales grew ${pct((pu.salesGrowth ?? 1) - 1, 0)}.`, `نمو في قيمة أوامر الشراء خلال ${pu.years[0].year}–${pu.years[pu.years.length - 1].year}، بينما نمت المبيعات ${pct((pu.salesGrowth ?? 1) - 1, 0)}.`) },
    inv.shortest && inv.longest && { tone: 'ember', area: L('Inventory', 'المخزون'), v: L(`${int(inv.shortest.cover)} vs ${int(inv.longest.cover)}`, `${int(inv.shortest.cover)} مقابل ${int(inv.longest.cover)}`), t: L(`months of stock cover: the family that runs short holds the least.`, `شهرًا من تغطية المخزون: العائلة التي تعاني النقص تحتفظ بالأقل.`) },
  ].filter(Boolean) as { tone: string; area: string; v: string; t: string }[];
  return items.map((x) => `<li class="q tone-${x.tone}"><span class="q-area">${x.area}</span><p class="q-v num">${x.v}</p><p class="q-text">${x.t}</p></li>`).join('');
}

function splitLetters(text: string) {
  return text.split(' ').map((w) => `<span class="w">${[...w].map((c) => `<span class="l"><span>${c}</span></span>`).join('')}</span>`).join(' ');
}

/**
 * Camera script, one keyframe per chapter. Desktop keeps the instrument opposite the copy (plateX: right in
 * English, left in Arabic); mobile lifts the instrument into the top half (shiftY) and the copy sits below.
 */
function keyframes(coarse: boolean): Rig[] {
  const base = { draw: 1, lines: 1, warp: 0, fade: 1, stars: 1, focus: 0 };
  if (coarse) {
    return [
      { ...base, p: 0, dist: 36, elev: 0.52, azim: 0, lookY: 4.2, plateX: 0, shiftY: 0.16 },
      { ...base, p: 0, dist: 29, elev: 0.34, azim: -0.4, lookY: 4.8, plateX: 0, shiftY: 0.22 },
      { ...base, p: 1, dist: 33, elev: 0.98, azim: -0.4, lookY: 2.2, plateX: 0, shiftY: 0.22 },
      { ...base, p: 2, dist: 34, elev: 0.12, azim: 0.2, lookY: 4, plateX: 0, shiftY: 0.2 },
      { ...base, p: 2, dist: 22, elev: 1.2, azim: 0.4, lookY: 8.4, plateX: 0, shiftY: 0.2, focus: 1 },
      { ...base, p: 3, dist: 64, elev: 0.7, azim: 0.55, lookY: 2.4, plateX: 0, shiftY: 0.25 },
      { ...base, p: 3, dist: 48, elev: 1.05, azim: 0.9, lookY: 0, plateX: 0, shiftY: 0.08, lines: 0.45 },
    ];
  }
  const side = i18n.rtl ? -1 : 1;
  return [
    { ...base, p: 0, dist: 25, elev: 0.42, azim: 0, lookY: 1.2, plateX: 6.2, shiftY: 0 },
    { ...base, p: 0, dist: 21.5, elev: 0.3, azim: -0.22, lookY: 4.2, plateX: 8.6, shiftY: 0 },
    { ...base, p: 1, dist: 23.5, elev: 0.8, azim: -0.42, lookY: 0.4, plateX: 7.2, shiftY: 0 },
    { ...base, p: 2, dist: 27, elev: 0.1, azim: 0.18, lookY: 3.6, plateX: 7.4, shiftY: 0 },
    { ...base, p: 2, dist: 17, elev: 1.2, azim: 0.4, lookY: 8.4, plateX: 7.4, shiftY: 0, focus: 1 },
    { ...base, p: 3, dist: 26, elev: 0.55, azim: 0.55, lookY: 2.0, plateX: 7.4, shiftY: 0 },
    { ...base, p: 3, dist: 38, elev: 1.02, azim: 0.9, lookY: 0, plateX: 7, shiftY: 0, lines: 0.45 },
  ].map((k) => ({ ...k, plateX: k.plateX * side }));
}
const lerpRig = (a: Rig, b: Rig, t: number): Rig => {
  const out = { ...a } as Record<string, number>;
  for (const k in a) out[k] = (a as Record<string, number>)[k] + ((b as Record<string, number>)[k] - (a as Record<string, number>)[k]) * t;
  return out as Rig;
};
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** Six stars for six members, in a gentle arc. */
const AST: [number, number][] = [[60, 210], [150, 120], [250, 160], [330, 70], [420, 130], [470, 230]];

const page: Page & { cleanup: (() => void)[] } = {
  cleanup: [],
  async mount(root) {
    const reduced = motion.reduced;
    const coarse = isCoarse();
    const rtl = i18n.rtl;
    const result = await getDataset();
    const a = result.state === 'ready' ? analyse(result.dataset) : null;
    const previews = result.state === 'ready' ? domainPreviews(result.dataset) : null;
    const copy = storyCopy(result, a);
    const heads = headlines(result, a);
    root.innerHTML = `
    <div class="home">
      <section class="ch ch-hero" data-ch="0" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="hero-kicker">${L('DEPI Graduation Project', 'مشروع تخرج DEPI')}<br/>${L('Professional Data Analyst track', 'مسار محلل البيانات المحترف')}</p>
          <h1 id="hero-title" class="display hero-title" aria-label="WWI Supply Chain Intelligence" dir="ltr">
            <span class="line" aria-hidden="true">${splitLetters('WWI Supply Chain')}</span>
            <span class="line line-2" aria-hidden="true">${splitLetters('Intelligence')}</span>
          </h1>
          <p class="lede hero-lede">${L('Wide World Importers buys novelty goods from suppliers, holds them in one warehouse and sells them to 663 businesses. Six graduates reconciled 41 months of its records into one model. This site charts that work as a single sky, then reads it like an instrument.', 'تشتري Wide World Importers السلع الطريفة من الموردين، وتحتفظ بها في مستودع واحد، وتبيعها لـ 663 شركة. وحّد ستة خريجين 41 شهرًا من سجلاتها في نموذج واحد. ويرسم هذا الموقع ذلك العمل سماءً واحدة، ثم يقرؤها كما تُقرأ الآلة الفلكية.')}</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#/observatory" data-warp><span class="dial" aria-hidden="true"></span>${L('Open the Observatory', 'افتح المرصد')}</a>
            <a class="btn btn-ghost" href="#chapter-challenge" data-scroll>${L('Begin the story', 'ابدأ القصة')}</a>
          </div>
          ${copy.badge}
        </div>
        <div class="scroll-cue" aria-hidden="true"><span class="cue-dial"></span>${L('Scroll to turn the dial', 'مرّر لتدير القرص')}</div>
      </section>

      <section class="ch ch-text" id="chapter-challenge" data-ch="1" aria-labelledby="h-challenge">
        <div class="ch-inner">
          <p class="ch-index num">${L('I. The market', 'أولًا: السوق')}</p>
          <h2 class="h-section" id="h-challenge">${copy.segTitle}</h2>
          <p class="lede">${L('The records that explain their orders sit apart: sales in one schema, purchasing in another, stock in a third, each at its own grain and in its own units. A simple question such as “which products go unpicked?” needs them joined first.', 'السجلات التي تفسر طلباتهم متفرقة: المبيعات في مخطط، والمشتريات في آخر، والمخزون في ثالث، ولكلٍّ مستوى تفصيله ووحداته. وسؤال بسيط مثل “أي المنتجات لا تُجهَّز؟” يتطلب ربطها أولًا.')}</p>
          <p class="hint">${copy.segLede}</p>
        </div>
      </section>

      <section class="ch ch-text" id="chapter-routes" data-ch="2" aria-labelledby="h-routes">
        <div class="ch-inner">
          <p class="ch-index num">${L('II. The network', 'ثانيًا: الشبكة')}</p>
          <h2 class="h-section" id="h-routes">${L('Every order moves through one warehouse.', 'كل طلب يمر عبر مستودع واحد.')}</h2>
          <p class="lede">${L('The stars fall to the plate and become routes. Purchase orders arrive from seven active suppliers on the outer ring; customer orders leave for the segments they came from. The strain only shows once the records are joined.', 'تهبط النجوم إلى اللوح وتصبح مسارات. تصل أوامر الشراء من سبعة موردين نشطين على الحلقة الخارجية، وتخرج طلبات العملاء إلى الشرائح التي جاءت منها. ولا يظهر الضغط إلا بعد ربط السجلات.')}</p>
          <ul class="legend" aria-label="${L('Map legend', 'مفتاح الخريطة')}">
            <li><span class="key key-brass"></span>${L('Inbound: suppliers and purchasing', 'الوارد: الموردون والمشتريات')}</li>
            <li><span class="key key-glacier"></span>${L('Outbound: customers and sales', 'الصادر: العملاء والمبيعات')}</li>
            <li><span class="key key-hub"></span>${L('The warehouse hub', 'المستودع المركزي')}</li>
          </ul>
          <p class="hint">${coarse ? L('Routes are illustrative.', 'المسارات توضيحية.') : L('Point at a node on the plate to identify it. Routes are illustrative.', 'أشر إلى عقدة على اللوح للتعرف عليها. المسارات توضيحية.')}</p>
        </div>
      </section>

      <section class="ch ch-text" data-ch="3" aria-labelledby="h-prep">
        <div class="ch-inner">
          <p class="ch-index num">${L('III. Preparation', 'ثالثًا: التحضير')}</p>
          <h2 class="h-section" id="h-prep">${L('Raw records settle into layers.', 'تستقر السجلات الخام في طبقات.')}</h2>
          <p class="lede">${L('The same points rise into strata, the way the team’s warehouse does: 48 raw Bronze tables, 31 cleaned Silver tables, 18 Gold views. The red points are records that fail a quality rule, such as the 4,626 lines sold at a loss. They are kept as findings, not silently repaired.', 'ترتفع النقاط نفسها في طبقات، كما في مستودع الفريق: 48 جدولًا برونزيًا خامًا، و31 جدولًا فضيًا منظّفًا، و18 عرضًا ذهبيًا. والنقاط الحمراء سجلات تخالف قاعدة جودة، مثل 4,626 سطرًا بيعت بخسارة، وتُحفظ كملاحظات ولا تُصلح بصمت.')}</p>
          <a class="text-link" href="#/journey">${L('Follow the full data journey', 'تابع رحلة البيانات كاملة')}</a>
        </div>
      </section>

      <section class="ch ch-text" data-ch="4" aria-labelledby="h-structure">
        <div class="ch-inner">
          <p class="ch-index num">${L('IV. Structure', 'رابعًا: البنية')}</p>
          <h2 class="h-section" id="h-structure">${L('Order at the top.', 'النظام في القمة.')}</h2>
          <p class="lede">${L('Each layer is more ordered than the one beneath it. At the top the points lock into a lattice: seven fact tables and six dimensions with shared definitions, so a measure means the same thing on every page — and 22 of 22 KPIs give the same answer in SQL and in DAX.', 'كل طبقة أكثر انتظامًا مما تحتها. وفي القمة تستقر النقاط في شبكة: سبعة جداول حقائق وستة أبعاد بتعريفات مشتركة، فيحمل المقياس المعنى نفسه في كل صفحة — وتعطي 22 من 22 مؤشرًا الإجابة نفسها في SQL وDAX.')}</p>
          <ol class="strata">
            <li><span class="num">1</span><b>${L('Source', 'المصدر')}</b></li>
            <li><span class="num">2</span><b>${L('Bronze', 'البرونزي')}</b></li>
            <li><span class="num">3</span><b>${L('Silver', 'الفضي')}</b></li>
            <li><span class="num">4</span><b>${L('Gold', 'الذهبي')}</b></li>
            <li><span class="num">5</span><b>${L('Model', 'النموذج')}</b></li>
          </ol>
          <a class="text-link" href="#/engineering">${L('Read the engineering case study', 'اقرأ دراسة الحالة الهندسية')}</a>
        </div>
      </section>

      <section class="ch ch-text" data-ch="5" aria-labelledby="h-dial">
        <div class="ch-inner">
          <p class="ch-index num">${L('V. Intelligence', 'خامسًا: الذكاء')}</p>
          <h2 class="h-section" id="h-dial">${copy.dialTitle}</h2>
          <p class="lede">${copy.dialLede}</p>
          <a class="btn btn-ghost" href="#/observatory" data-warp><span class="dial" aria-hidden="true"></span>${L('Explore it in the Observatory', 'استكشفه في المرصد')}</a>
        </div>
      </section>

      <section class="after" data-ch="6" aria-label="${L('About the project', 'عن المشروع')}">
        <div class="after-inner">
          <div class="about">
            <h2 class="h-section">${L('A supply chain, read end to end.', 'سلسلة إمداد، تُقرأ من أولها إلى آخرها.')}</h2>
            <dl class="facts">
              <div><dt>${L('Programme', 'البرنامج')}</dt><dd>${L('Digital Egypt Pioneers Initiative (DEPI)', 'مبادرة رواد مصر الرقمية (DEPI)')}</dd></div>
              <div><dt>${L('Track', 'المسار')}</dt><dd>${L('Professional Data Analyst', 'محلل البيانات المحترف')}</dd></div>
              <div><dt>${L('Data', 'البيانات')}</dt><dd>${L('Wide World Importers, Jan 2013 – May 2016', 'Wide World Importers، يناير 2013 – مايو 2016')}</dd></div>
              <div><dt>${L('Delivered as', 'المُخرَج')}</dt><dd>${L('A Power BI report on a SQL Server warehouse, cleaned in Python', 'تقرير Power BI على مستودع SQL Server، نُظّفت بياناته بلغة Python')}</dd></div>
            </dl>
            <a class="text-link" href="#/overview">${L('Read the project overview', 'اقرأ نظرة على المشروع')}</a>
          </div>

          <div class="preview preview-obs">
            <div class="pv-head">
              <h2 class="h-section">${L('Six domains, one workspace.', 'ستة مجالات، مساحة عمل واحدة.')}</h2>
              <p class="lede">${L('The Observatory puts every part of the supply chain under one set of filters. Choose a domain to open it.', 'يضع المرصد كل أجزاء سلسلة الإمداد تحت مجموعة واحدة من المرشحات. اختر مجالًا لفتحه.')}</p>
              ${dataBadge(result)}
            </div>
            ${previews ? `<ul class="readout">
              ${previews.map((d) => `<li><a href="#/observatory?d=${d.id}" style="--tone:${d.tone}"><span class="ro-name">${DOMAIN_TEXT[d.id].label()}</span><span class="ro-q">${DOMAIN_TEXT[d.id].q()}</span><span class="ro-spark" dir="ltr">${d.v.length ? spark(d.v, d.tone) : `<span class="ro-snap">${L('Snapshot, no trend', 'لقطة، بلا اتجاه')}</span>`}</span></a></li>`).join('')}
            </ul>` : result.state !== 'ready' ? dataStatePanel(result, '/', { compact: true, headingId: 'h-preview-state' }) : ''}
          </div>

          <div class="preview preview-journey">
            <div class="pv-head">
              <h2 class="h-section">${L('From table to decision in seven stages.', 'من الجدول إلى القرار في سبع مراحل.')}</h2>
              <a class="text-link" href="#/journey">${L('Open the data journey', 'افتح رحلة البيانات')}</a>
            </div>
            <ol class="stations">
              ${STAGES.map((s, i) => `<li style="--i:${i}"><span class="st-dot" aria-hidden="true"></span><span class="st-n num">${i + 1}</span><b>${tr(s.title)}</b><span>${tr(s.line)}</span></li>`).join('')}
            </ol>
          </div>

          ${heads ? `
          <div class="questions">
            <h2 class="h-section" id="h-questions">${L('What the data says', 'ما تقوله البيانات')}</h2>
            <p class="lede">${L('Four headlines, computed live from the data in view. Each is developed on the Insights page with its evidence and limits, next to the team’s own decision brief.', 'أربعة عناوين محسوبة لحظيًا من البيانات المعروضة. وتُعرض كلٌّ منها في صفحة الرؤى مع دليله وحدوده، بجانب موجز القرارات الخاص بالفريق.')}</p>
            <a class="text-link q-link" href="#/insights">${L('Read the insights', 'اقرأ الرؤى')}</a>
            <ol class="q-list">${heads}</ol>
          </div>` : ''}

          <div class="team" aria-labelledby="h-team">
            <div class="team-copy">
              <h2 class="h-section" id="h-team">${L('Six people, one instrument', 'ستة أشخاص، آلة واحدة')}</h2>
              <p class="lede">${L('Data engineering, data quality, warehouse design, Power BI, business analysis, and the integration that holds them together.', 'هندسة البيانات، وجودة البيانات، وتصميم المستودع، وPower BI، وتحليل الأعمال، والتكامل الذي يجمعها معًا.')}</p>
              <a class="text-link" href="#/team">${L('Meet the team', 'تعرّف على الفريق')}</a>
            </div>
            <svg class="asterism" viewBox="0 0 520 300" role="img" aria-label="${L('The six team members drawn as an asterism of six stars', 'أعضاء الفريق الستة مرسومون كمجموعة من ست نجوم')}">
              <g class="ast-lines" fill="none" style="stroke:var(--haze)" stroke-opacity=".45">
                <path d="M${AST.map(([x, y]) => `${x} ${y}`).join(' L')}"/>
              </g>
              ${AST.map(([x, y], i) => `<g class="ast-star" transform="translate(${x} ${y})"><circle r="16" fill="none" style="stroke:var(--brass)" stroke-opacity="${MEMBERS[i]?.leader ? 1 : 0.5}"/><circle r="4" style="fill:var(--chalk)"/><text y="38" text-anchor="middle">${esc(MEMBERS[i] ? tr(MEMBERS[i].first) : '')}</text></g>`).join('')}
            </svg>
          </div>

          <div class="cta">
            <h2 class="display cta-title">${L('Step inside the instrument.', 'ادخل إلى الآلة.')}</h2>
            <div class="hero-actions">
              <a class="btn btn-primary" href="#/observatory" data-warp><span class="dial" aria-hidden="true"></span>${L('Open the Observatory', 'افتح المرصد')}</a>
              <a class="btn btn-ghost" href="#/present">${L('Start the presentation', 'ابدأ العرض التقديمي')}</a>
            </div>
          </div>
          ${siteFooter()}
        </div>
      </section>

      <div class="sky-labels" aria-hidden="true">
        ${(stage.sky?.rimYears ?? []).map((ry) => `<span class="yr num" data-y="${ry.year}">${ry.year}</span>`).join('')}
        ${(stage.sky?.territories ?? []).map((t) => `<span class="ter"><b>${esc(segName(t.label))}</b>${t.share === null ? '' : `<span class="num">${pct(t.share, 0)} ${copy.shareSuffix}</span>`}</span>`).join('')}
        <div class="node-tip" role="presentation"><b></b><span></span></div>
      </div>
    </div>`;


    const sky = stage.sky;
    const homeEl = root.querySelector<HTMLElement>('.home')!;
    const frames = keyframes(coarse);
    const sections = [...root.querySelectorAll<HTMLElement>('[data-ch]')];

    /* ---------- scroll → rig ---------- */
    let centers: number[] = [];
    const measure = () => {
      centers = sections.map((s) => {
        const r = s.getBoundingClientRect();
        if (s.dataset.ch === '6') return r.top + window.scrollY + window.innerHeight * 0.25; // reached once its top quarter is in view
        if (coarse && s.dataset.ch !== '0') {
          // on phones the copy sits low; the keyframe lands when the copy's centre is 70% down the screen
          const inner = s.querySelector<HTMLElement>('.ch-inner')!.getBoundingClientRect();
          return inner.top + window.scrollY + inner.height / 2 - window.innerHeight * 0.2;
        }
        return r.top + window.scrollY + r.height / 2;
      });
    };
    let activeCh = -1;
    const onScroll = () => {
      const s = window.scrollY + window.innerHeight / 2;
      let i = 0;
      while (i < centers.length - 2 && s > centers[i + 1]) i++;
      const t = smooth(0.18, 0.82, (s - centers[i]) / (centers[i + 1] - centers[i]));
      const rig = lerpRig(frames[i], frames[i + 1], Math.max(0, Math.min(1, t)));
      if (!introRunning) direct(rig);
      const ch = t > 0.5 ? i + 1 : i;
      if (ch !== activeCh) {
        activeCh = ch;
        homeEl.dataset.ch = String(ch);
        sections.forEach((el) => el.classList.toggle('is-active', Number(el.dataset.ch) === ch));
      }
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    const onResize = () => { measure(); onScroll(); };
    window.addEventListener('resize', onResize);
    // fonts change line heights after first paint; re-measure once they settle
    document.fonts?.ready.then(onResize);
    this.cleanup.push(() => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); });

    /* ---------- intro: one orchestrated moment ---------- */
    let introRunning = false;
    const letters = root.querySelectorAll<HTMLElement>('.hero-title .l > span');
    const fadeIns = root.querySelectorAll<HTMLElement>('.hero-kicker, .hero-lede, .hero-actions, .hero-demo, .scroll-cue');
    const returning = !!sky && sky.rig.fade > 0.5 && sky.rig.draw > 0.9 && document.body.dataset.prev !== undefined;
    if (reduced || !sky || returning) {
      if (sky) sky.ambient = false;
      if (reduced || !sky) direct(frames[0], true);
      sections[0].classList.add('is-active');
      homeEl.dataset.ch = '0';
      onScroll();
      if (returning && !reduced) gsap.fromTo(fadeIns, { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.05 });
    } else {
      introRunning = true;
      // start: the network is still folded into the hub, the instrument not yet engraved
      Object.assign(sky.rig, { ...frames[0], dist: 36, elev: 0.95, azim: -0.6, warp: 1, draw: 0, fade: 0 });
      Object.assign(sky.target, { ...frames[0], warp: 1, draw: 0, fade: 1, dist: 36, elev: 0.95, azim: -0.6 });
      const proxy = { draw: 0, warp: 1 };
      const tl = gsap.timeline({ onComplete: () => { introRunning = false; onScroll(); } });
      tl.to(sky.target, { dist: frames[0].dist, elev: frames[0].elev, azim: frames[0].azim, duration: 3.2, ease: 'expo.out' }, 0)
        .to(proxy, { draw: 1, duration: 2.4, ease: 'power2.inOut', onUpdate: () => { sky.target.draw = proxy.draw; sky.rig.draw = proxy.draw; } }, 0.1)
        .to(proxy, { warp: 0, duration: 2.6, ease: 'power3.out', onUpdate: () => { sky.target.warp = proxy.warp; } }, 0.55)
        .fromTo(letters, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.028 }, 0.35)
        .fromTo(fadeIns, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out', stagger: 0.09, clearProps: 'transform' }, 1.0)
        .add(() => { sections[0].classList.add('is-active'); homeEl.dataset.ch = '0'; }, 0.8);
      // never hold the visitor: any intent to move on completes the intro instantly
      const skip = () => { if (tl.isActive()) tl.progress(1); };
      const skipKeys = (e: KeyboardEvent) => { if (['ArrowDown', 'PageDown', ' ', 'Tab', 'End'].includes(e.key)) skip(); };
      window.addEventListener('wheel', skip, { passive: true, once: true });
      window.addEventListener('touchmove', skip, { passive: true, once: true });
      window.addEventListener('keydown', skipKeys);
      this.cleanup.push(() => { tl.kill(); window.removeEventListener('wheel', skip); window.removeEventListener('touchmove', skip); window.removeEventListener('keydown', skipKeys); });
    }
    document.body.dataset.prev = 'home';

    /* ---------- overlays: rim years, territory names, node identification ---------- */
    const yrs = [...root.querySelectorAll<HTMLElement>('.yr')];
    const ters = [...root.querySelectorAll<HTMLElement>('.ter')];
    const terOrder = (sky?.territories ?? []).map((t, i) => ({ i, s: t.share ?? 0 })).sort((a, b) => b.s - a.s).map((x) => x.i);
    // label sizes are measured once (and after fonts or the viewport change), never per frame
    let terSize = ters.map(() => ({ w: 120, h: 36 }));
    const measureLabels = () => { terSize = ters.map((el) => ({ w: el.offsetWidth, h: el.offsetHeight })); sky?.invalidate(); };
    measureLabels();
    document.fonts?.ready.then(measureLabels);
    window.addEventListener('resize', measureLabels);
    this.cleanup.push(() => window.removeEventListener('resize', measureLabels));
    const tip = root.querySelector<HTMLElement>('.node-tip')!;
    let mouse = { x: -999, y: -999 };
    const onMove = (e: PointerEvent) => { if (e.pointerType === 'mouse') { mouse = { x: e.clientX, y: e.clientY }; sky?.invalidate(); } };
    window.addEventListener('pointermove', onMove, { passive: true });
    this.cleanup.push(() => window.removeEventListener('pointermove', onMove));
    if (sky) {
      // overlay writes are cached: a label that is hidden, or has not moved, costs no style work
      const shown = new WeakMap<HTMLElement, { tf: string; op: string }>();
      const put = (el: HTMLElement, x: number, y: number, op: number) => {
        const last = shown.get(el) ?? { tf: '', op: '' };
        const o = op < 0.005 ? '0' : op.toFixed(3);
        if (o !== last.op) { el.style.opacity = o; last.op = o; }
        if (o !== '0') {
          const tf = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
          if (tf !== last.tf) { el.style.transform = tf; last.tf = tf; }
        }
        shown.set(el, last);
      };
      const hideAll = (els: HTMLElement[]) => els.forEach((el) => put(el, 0, 0, 0));
      sky.onFrame = () => {
        const p = sky.rig.p;
        const yrA = Math.max(0, Math.min(1, (p - 2.55) * 2.5)) * (1 - Math.max(0, (sky.rig.dist - 26) / 10));
        if (yrA <= 0) hideAll(yrs);
        else sky.rimYears.forEach((ry, i) => {
          const s = sky.project(ry.pos);
          put(yrs[i], s.x, s.y, s.behind ? 0 : yrA);
        });
        // territory names belong to chapter I only. Largest territories are placed first; a label that
        // would collide with one already placed, or fall over the copy column, is skipped this frame.
        const terA = activeCh === 1 ? sky.constellationVisibility() : 0;
        const placed: { l: number; t: number; r: number; b: number }[] = [];
        // the copy column owns one side of the screen (left in English, right in Arabic); labels avoid it
        const minX = coarse || rtl ? 8 : window.innerWidth * 0.42;
        const maxX = !coarse && rtl ? window.innerWidth * 0.58 : window.innerWidth - 8;
        if (terA < 0.02) hideAll(ters);
        else terOrder.forEach((i) => {
          const el = ters[i];
          const s = sky.project(sky.territories[i].labelPos);
          const { w, h } = terSize[i];
          const box = { l: s.x - w / 2 - 6, t: s.y - h - 4, r: s.x + w / 2 + 6, b: s.y + 4 };
          const clash = s.behind || box.l < minX || box.r > maxX || box.t < 70 || placed.some((p) => box.l < p.r && box.r > p.l && box.t < p.b && box.b > p.t);
          put(el, s.x, s.y, clash ? 0 : terA);
          if (!clash) placed.push(box);
        });
        // nearest node to the pointer, only while the network is legible
        let best = -1, bd = 26 * 26;
        if (sky.nodeVisibility() > 0.55 && !coarse) {
          sky.nodes.forEach((n, i) => {
            const s = sky.project(n.pos);
            const d = (s.x - mouse.x) ** 2 + (s.y - mouse.y) ** 2;
            if (d < bd) { bd = d; best = i; }
          });
        }
        sky.setHover(best);
        if (best >= 0) {
          const n = sky.nodes[best];
          const s = sky.project(n.pos);
          if (tip.dataset.node !== String(best)) {
            tip.dataset.node = String(best);
            tip.querySelector('b')!.textContent = n.label;
            tip.querySelector('span')!.textContent = n.detail;
            tip.dataset.kind = n.kind;
          }
          tip.style.transform = `translate(${rtl ? Math.max(8, s.x - 258) : Math.min(s.x + 18, window.innerWidth - 260)}px, ${s.y - 14}px)`;
          tip.classList.add('on');
          document.body.style.cursor = 'crosshair';
        } else if (tip.classList.contains('on')) {
          tip.classList.remove('on');
          delete tip.dataset.node;
          document.body.style.cursor = '';
        }
      };
      sky.invalidate();
      this.cleanup.push(() => { sky.onFrame = undefined; sky.setHover(-1); document.body.style.cursor = ''; });
    }

    /* ---------- one-time reveals for the post-dial previews ---------- */
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } }), { threshold: 0.3 });
    root.querySelectorAll('.team, .stations').forEach((el) => io.observe(el));
    this.cleanup.push(() => io.disconnect());

    /* ---------- in-page scroll + the dive into the Observatory ---------- */
    root.querySelectorAll<HTMLAnchorElement>('[data-scroll]').forEach((a) =>
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector<HTMLElement>(a.getAttribute('href')!);
        target?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
        target?.querySelector<HTMLElement>('h2')?.setAttribute('tabindex', '-1');
        target?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
      }),
    );
    root.querySelectorAll<HTMLAnchorElement>('[data-warp]').forEach((a) =>
      a.addEventListener('click', (e) => {
        if (reduced || !sky) return; // plain navigation
        e.preventDefault();
        transitionFlags.warped = true;
        const veil = document.getElementById('veil')!;
        introRunning = true;
        gsap.timeline()
          .add(() => direct({ p: Math.min(1, sky.rig.p), warp: 1, dist: 9, elev: 1.25, lookY: 0, plateX: 0, lines: 0, shiftY: 0 }))
          .to(homeEl, { opacity: 0, y: -20, duration: 0.5, ease: 'power2.in' }, 0)
          .to(veil, { opacity: 1, duration: 0.55, ease: 'power3.in' }, 0.5)
          .add(() => { location.hash = a.getAttribute('href')!; }, 1.05);
      }),
    );
  },
  unmount() {
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
  },
};

export default page;
