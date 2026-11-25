import '../styles/hub.css';
import '../styles/lab.css';
import '../styles/sim.css';
import type { Page } from '../lib/router';
import { pageHeader, nextChapter, siteFooter, statusBadge } from '../components/shell';
import { revealOnScroll } from '../components/tabs';
import { getDataset } from '../data/adapter';
import { hashParams } from '../data/mode';
import { fitTo, simulate, sensitivity, tornado, premises, supplierExposure, sensitiveKeys, valueOf, withValue, priceToBreakEven, toParams, fromParams, normalise, BASELINE, LIMITS, SENS_RANGE, type Scenario, type Scope, type SensKey, type Premise } from '../data/sim';
import type { SupplyChainDataset } from '../data/types';
import { esc } from '../lib/format';
import { motion } from '../lib/motion';
import { ProfitBridge, loadGauge, sensitivityCurve, tornadoChart, type BridgeBar } from '../charts/sim';
import { dataStatePanel, loadingState } from '../components/datastate';
import { direct, ROUTE_RIGS } from '../scene/stage';
import { L, famName, pct, money, int } from '../i18n';

/**
 * Meridian Decision Simulator (#/simulator), Milestone 2: price, the volume assumption and fulfilment recovery.
 * Every number is computed by src/data/sim.ts at render time from the validated dataset. The page keeps four
 * things apart: a scenario (arithmetic under stated levers), sensitivity (how a result moves with one
 * assumption), a prediction (not offered), and a causal estimate (not offered).
 * Statement kinds reuse the Lab's marks: recorded (solid), calculation (diamond), assumption (dashed).
 */
type Kind = 'finding' | 'calc' | 'hypothesis';
const KIND = (): Record<Kind, string> => ({ finding: L('Recorded', 'مسجَّل'), calc: L('Calculation', 'حساب'), hypothesis: L('Assumption', 'افتراض') });
const claim = (k: Kind, html: string) => `<li class="claim claim-${k}"><p class="claim-kind"><span aria-hidden="true" class="claim-mark"></span>${KIND()[k]}</p><p class="claim-text">${html}</p></li>`;
const b = (s: string) => `<b class="num">${s}</b>`;
const sgn = (v: number, f: (x: number) => string) => (v > 0 ? `+${f(v)}` : v < 0 ? f(v).replace(/^-/, '−\u2060') : f(0));
const sp = (v: number, d = 1) => sgn(v, (x) => pct(x, d));
const ef = (v: number) => v.toFixed(2).replace('-', '−');
const sm = (v: number) => (Math.abs(v) < 0.5 ? money(0) : sgn(v, money));
const STEP_NAME = () => ({ price: L('Price', 'السعر'), volume: L('Volume response', 'استجابة الكمية'), cost: L('Supplier cost', 'تكلفة المورد'), recovery: L('Recovered orders', 'طلبات مستعادة') });
const STEP_SHORT = () => ({ price: L('Price', 'السعر'), volume: L('Volume', 'الكمية'), cost: L('Cost', 'التكلفة'), recovery: L('Recovery', 'الاستعادة') });

type Preset = { id: string; title: string; note: string; sc: (ds: SupplyChainDataset) => Scenario };
const PRESETS = (): Preset[] => [
  { id: 'masks', title: L('Price the masks to cover cost', 'تسعير الأقنعة لتغطية التكلفة'), note: L('The four zombie masks sell below cost (Lab 02). The smallest price change that clears it.', 'أقنعة الزومبي الأربعة تُباع بأقل من تكلفتها (المختبر 02). أصغر تغيير سعري يعالج ذلك.'),
    sc: (ds) => ({ ...BASELINE, price: { scope: { kind: 'structural' }, change: Math.ceil(priceToBreakEven(ds, { kind: 'structural' }) * 1000) / 1000 } }) },
  { id: 'lift', title: L('Lift every price 5%', 'رفع كل الأسعار 5%'), note: L('Volume held as recorded. The break-even readout shows how much volume it could lose.', 'الكمية ثابتة كما سُجّلت. ويبيّن مؤشر التعادل كم يمكن أن تفقد من الكمية.'),
    sc: () => ({ ...BASELINE, price: { scope: { kind: 'all' }, change: 0.05 } }) },
  { id: 'recover', title: L('Fulfil half of the unpicked units', 'تنفيذ نصف الوحدات غير المنتقاة'), note: L('The never-picked lines from Lab 03, half of them sold at list price. An upper bound.', 'الأسطر التي لم تُنتقَ قط من المختبر 03، يُباع نصفها بسعر القائمة. حدّ أعلى.'),
    sc: () => ({ ...BASELINE, recovery: { scope: { kind: 'all' }, share: 0.5 } }) },
  { id: 'shock', title: L('Largest supplier raises costs 10%', 'أكبر مورد يرفع تكاليفه 10%'), note: L('The supplier behind the most cost of sales (Lab 04), none of it passed on. Purchase spend is shown apart.', 'المورد صاحب أكبر تكلفة مبيعات (المختبر 04)، دون تمرير أي جزء منها. ويُعرض إنفاق الشراء منفصلًا.'),
    sc: (ds) => ({ ...BASELINE, supplier: { s: [...supplierExposure(ds)].sort((x, y) => y.cogs - x.cogs)[0]?.s ?? null, shock: 0.1, passThrough: 0 } }) },
  { id: 'stock', title: L('Hold a year of cover', 'الاحتفاظ بتغطية عام'), note: L('Stock above 12 months of recorded use, at cost. Capital only: gross profit does not move.', 'المخزون الزائد عن 12 شهرًا من الاستخدام المسجَّل، بالتكلفة. رأس مال فقط: لا يتحرك إجمالي الربح.'),
    sc: () => ({ ...BASELINE, inventory: { cover: 12, carryRate: null } }) },
  { id: 'base', title: L('Recorded baseline', 'الأساس المسجَّل'), note: L('Every lever at rest. The result equals the recorded gross profit exactly.', 'كل الروافع في وضع السكون. والنتيجة تساوي إجمالي الربح المسجَّل تمامًا.'), sc: () => structuredClone(BASELINE) },
];
const same = (a: Scenario, b2: Scenario) => JSON.stringify(toParams(normalise(a))) === JSON.stringify(toParams(normalise(b2)));

/* ------------------------------------------------------------------------------------------- markup */
function scopeControl(name: string, legend: string, ds: SupplyChainDataset, structural: boolean) {
  const opt = (v: string, label: string) => `<label class="sc-opt"><input type="radio" name="${name}" value="${v}"><span>${label}</span></label>`;
  return `
    <fieldset class="sim-scope" data-scope="${name}">
      <legend class="sr-only">${legend}</legend>
      ${opt('a', L('All items', 'كل الأصناف'))}
      <span class="sc-fam">${opt('f', L('One family', 'عائلة واحدة'))}
        <select name="${name}-fam" aria-label="${esc(L('Family', 'العائلة'))}">${ds.categories.map((c, i) => `<option value="${i}">${esc(famName(c))}</option>`).join('')}</select></span>
      ${structural ? opt('s', L('The four loss-making masks', 'الأقنعة الأربعة الخاسرة')) : ''}
    </fieldset>`;
}

const lever = (id: string, label: string, kind: 'decision' | 'assumed' | 'external', min: number, max: number, step: number, help: string) => `
    <div class="lever lever-${kind}">
      <div class="lv-head">
        <label for="${id}">${label}</label>
        <span class="lv-tag">${kind === 'assumed' ? L('Your assumption', 'افتراضك') : kind === 'external' ? L('Supposed outside change', 'تغيّر خارجي مفترض') : L('Your decision', 'قرارك')}</span>
        <output class="lv-out num" dir="ltr" for="${id}" id="${id}-out"></output>
      </div>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" aria-describedby="${id}-help">
      <p class="lv-help" id="${id}-help">${help}</p>
    </div>`;

function consoleMarkup(ds: SupplyChainDataset) {
  return `
  <section class="section sim-console" aria-labelledby="sim-console-h">
    <h2 class="sr-only" id="sim-console-h">${L('The console', 'لوحة التحكم')}</h2>
    <div class="sim-presets" role="group" aria-label="${esc(L('Starting points', 'نقاط البدء'))}">
      ${PRESETS().map((p, i) => `<button type="button" class="preset" data-preset="${p.id}" aria-pressed="false"><span class="pr-num num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="pr-title">${p.title}</span><span class="pr-note">${p.note}</span></button>`).join('')}
    </div>
    <div class="console-grid">
      <form class="levers" aria-label="${esc(L('Levers', 'الروافع'))}">
        <fieldset class="lv-group">
          <legend><span class="lg-num num">A</span>${L('Price', 'السعر')}</legend>
          ${scopeControl('price-scope', L('Price change applies to', 'يطبَّق تغيير السعر على'), ds, true)}
          ${lever('lv-price', L('Price change', 'تغيير السعر'), 'decision', LIMITS.price[0] * 100, LIMITS.price[1] * 100, 0.5, L('Applied to the realised price of every item in scope.', 'يُطبَّق على السعر المحقَّق لكل صنف ضمن النطاق.'))}
          ${lever('lv-e', L('Volume response to price (elasticity)', 'استجابة الكمية للسعر (المرونة)'), 'assumed', LIMITS.elasticity[0], LIMITS.elasticity[1], 0.05, L('0 assumes volume stays as recorded. −1.5 means a 1% price rise loses about 1.5% of units. The data holds no price variation to estimate it.', 'الصفر يفترض أن الكمية تبقى كما سُجّلت. و‎−1.5 تعني أن رفع السعر 1% يُفقد نحو 1.5% من الوحدات. ولا تحوي البيانات أي تغيّر سعري لتقديرها.'))}
        </fieldset>
        <fieldset class="lv-group">
          <legend><span class="lg-num num">B</span>${L('Fulfilment', 'التنفيذ')}</legend>
          ${scopeControl('rec-scope', L('Recovery applies to', 'تطبَّق الاستعادة على'), ds, false)}
          ${lever('lv-rec', L('Share of unpicked units fulfilled', 'نسبة الوحدات غير المنتقاة التي تُنفَّذ'), 'assumed', 0, 100, 5, L('Assumes these units would have sold at the scenario price. Nothing in the data shows the customers would have waited.', 'يفترض أن هذه الوحدات كانت ستُباع بسعر السيناريو. ولا شيء في البيانات يُظهر أن العملاء كانوا سينتظرون.'))}
        </fieldset>
        <fieldset class="lv-group">
          <legend><span class="lg-num num">C</span>${L('Supplier cost', 'تكلفة المورد')}</legend>
          <label class="lv-select"><span>${L('Supplier', 'المورد')}</span>
            <select id="lv-sup"><option value="">${L('No supplier change', 'لا تغيير لدى المورّدين')}</option>${supplierExposure(ds).filter((x) => x.items > 0).map((x) => `<option value="${x.s}">${esc(x.label)}</option>`).join('')}</select></label>
          <p class="lv-exp" data-ro="supExp"></p>
          ${lever('lv-shock', L('Change in its cost prices', 'التغيّر في أسعار تكلفته'), 'external', LIMITS.shock[0] * 100, LIMITS.shock[1] * 100, 0.5, L('Applied to the cost of every unit sold from this supplier, and separately to its purchase orders.', 'يُطبَّق على تكلفة كل وحدة مبيعة من هذا المورد، وبشكل منفصل على أوامر الشراء منه.'))}
          ${lever('lv-pt', L('Share passed on in price', 'النسبة الممرَّرة إلى السعر'), 'decision', 0, 100, 5, L('Raises the price of this supplier’s items to recover that share of the cost change. Its volume effect follows your elasticity.', 'يرفع سعر أصناف هذا المورد لاسترداد تلك النسبة من تغيّر التكلفة. ويتبع أثرها على الكمية المرونةَ التي حدّدتها.'))}
        </fieldset>
        <fieldset class="lv-group">
          <legend><span class="lg-num num">D</span>${L('Inventory capital', 'رأس مال المخزون')}</legend>
          <label class="lv-check"><input type="checkbox" id="lv-cover-on"><span>${L('Apply a stock-cover policy', 'تطبيق سياسة تغطية للمخزون')}</span></label>
          ${lever('lv-cover', L('Months of recorded use to keep', 'أشهر الاستخدام المسجَّل المراد الاحتفاظ بها'), 'decision', LIMITS.cover[0], LIMITS.cover[1], 1, L('Stock above this cover, at cost, is capital that could be released. It moves inventory capital only, never gross profit; see the limits under the ledgers.', 'المخزون الزائد عن هذه التغطية، بالتكلفة، رأس مال يمكن تحريره. ويحرّك رأس مال المخزون فقط، لا إجمالي الربح أبدًا؛ انظر الحدود أسفل الدفاتر.'))}
          <label class="lv-check"><input type="checkbox" id="lv-carry-on"><span>${L('Set an annual carrying rate', 'تحديد معدل احتفاظ سنوي')}</span></label>
          ${lever('lv-carry', L('Carrying cost, % of stock value per year', 'تكلفة الاحتفاظ، % من قيمة المخزون سنويًا'), 'assumed', LIMITS.carry[0] * 100, LIMITS.carry[1] * 100, 0.5, L('Storage, insurance, obsolescence and the cost of capital. Not in the data; off by default.', 'التخزين والتأمين والتقادم وتكلفة رأس المال. غير موجودة في البيانات؛ ومعطّلة افتراضيًا.'))}
        </fieldset>
      </form>
      <div class="readout" aria-labelledby="ro-h">
        <div class="ro-top">
          <div class="ro-main">
            <p class="ro-kicker" id="ro-h">${L('Scenario gross profit', 'إجمالي ربح السيناريو')}</p>
            <p class="ro-value display num" data-ro="profit"></p>
            <p class="ro-delta num" data-ro="delta"></p>
          </div>
          <dl class="ro-side">
            <div><dt>${L('Recorded', 'المسجَّل')}</dt><dd class="num" data-ro="base"></dd></div>
            <div><dt>${L('Margin', 'الهامش')}</dt><dd class="num" data-ro="margin"></dd></div>
            <div><dt>${L('Revenue', 'الإيراد')}</dt><dd class="num" data-ro="revenue"></dd></div>
          </dl>
        </div>
        <div class="bridge" data-bridge></div>
        <div class="ro-load">
          <div class="rl-head"><p class="ro-kicker">${L('Assumption load', 'حمولة الافتراض')}</p><p class="rl-value num" data-ro="load"></p></div>
          <div data-load></div>
          <p class="rl-formula" data-ro="loadText"></p>
          <p class="ro-kicker rl-prem-h">${L('Assumptions in force', 'الافتراضات السارية')}</p>
          <ul class="premises" data-premises></ul>
        </div>
        <p class="sim-live sr-only" aria-live="polite" data-live></p>
      </div>
    </div>
  </section>`;
}

function framesMarkup() {
  const cell = (cls: string, t: string, d: string, shown: boolean) => `<li class="frame ${cls}"><p class="fr-state">${shown ? L('On this page', 'في هذه الصفحة') : L('Not offered', 'غير مقدَّم')}</p><p class="fr-title">${t}</p><p class="fr-text">${d}</p></li>`;
  return `
  <section class="section sim-frames" aria-labelledby="sim-frames-h" data-reveal>
    <h2 class="sec-title" id="sim-frames-h">${L('What the console can and cannot tell you', 'ما تستطيع لوحة التحكم قوله وما لا تستطيع')}</h2>
    <ul class="frames">
      ${cell('fr-on', L('Scenario', 'سيناريو'), L('If these levers moved and everything else stayed as recorded, the arithmetic gives this result.', 'لو تحرّكت هذه الروافع وبقي كل شيء آخر كما سُجّل، فهذه نتيجة الحساب.'), true)}
      ${cell('fr-on', L('Sensitivity', 'تحليل الحساسية'), L('How the result moves across a range of one assumption. A spread of what-ifs, not a range of likely outcomes.', 'كيف تتحرك النتيجة عبر مدى من قيم افتراض واحد. مجموعة احتمالات افتراضية، لا مدى للنتائج المرجّحة.'), true)}
      ${cell('fr-off', L('Prediction', 'تنبّؤ'), L('Nothing here says a lever will move or projects a future month. The Lab’s forecast check found no rule reliable enough.', 'لا شيء هنا يقول إن رافعة ستتحرك أو يتوقع شهرًا قادمًا. ولم يجد فحص التوقّع في المختبر قاعدة موثوقة بما يكفي.'), false)}
      ${cell('fr-off', L('Causal claim', 'ادعاء سببي'), L('The volume response is your assumption. The data has no price variation, so it cannot measure how customers react.', 'استجابة الكمية افتراض منك. فالبيانات لا تحوي تغيّرًا في الأسعار، فلا يمكنها قياس تفاعل العملاء.'), false)}
    </ul>
  </section>`;
}

function sensMarkup() {
  return `
  <section class="section sim-sens" aria-labelledby="sim-sens-h" data-reveal>
    <div class="sens-head">
      <div>
        <p class="inst-kicker">${L('Sensitivity analysis', 'تحليل الحساسية')}</p>
        <h2 class="sec-title" id="sim-sens-h">${L('How much of the answer is the assumption?', 'كم من الإجابة هو الافتراض؟')}</h2>
      </div>
      <p class="sec-note">${L('Each bar sweeps one assumption across its whole range with your other levers fixed. Choose one to trace it below. A spread of what-ifs, not a prediction interval: nothing here says how likely any value is.', 'كل عمود يمسح افتراضًا واحدًا عبر مداه كاملًا مع تثبيت بقية الروافع. اختر واحدًا لتتبّعه أدناه. مجموعة احتمالات افتراضية، لا فاصل تنبّؤ: لا شيء هنا يقول ما مدى ترجيح أي قيمة.')}</p>
    </div>
    <div class="sens-grid">
      <div class="sens-left">
        <div data-tornado></div>
        <div class="sens-chart" data-sens tabindex="0" role="slider" aria-valuemin="0" aria-valuemax="30"></div>
        <div class="sens-read"><p class="num" data-sens-read aria-live="polite"></p><button type="button" class="btn btn-ghost sens-use" data-sens-use>${L('Use this value', 'استخدم هذه القيمة')}</button></div>
      </div>
      <ul class="claims" data-claims aria-label="${esc(L('What this scenario says', 'ما يقوله هذا السيناريو'))}"></ul>
    </div>
  </section>`;
}

function compareMarkup() {
  return `
  <section class="section sim-compare" aria-labelledby="sim-compare-h" data-reveal>
    <div class="sens-head">
      <div>
        <p class="inst-kicker">${L('A/B comparison', 'مقارنة أ/ب')}</p>
        <h2 class="sec-title" id="sim-compare-h">${L('Two scenarios, side by side', 'سيناريوهان جنبًا إلى جنب')}</h2>
      </div>
      <p class="sec-note">${L('Pin the current scenario as A, then change the levers: the console becomes B. Each row is one measure in one ledger; differences are taken row by row and never added across rows.', 'ثبّت السيناريو الحالي بوصفه (أ)، ثم غيّر الروافع: تصبح اللوحة (ب). كل صف مقياس واحد في دفتر واحد؛ وتُحسب الفروق صفًا بصف ولا تُجمع عبر الصفوف أبدًا.')}</p>
    </div>
    <div class="cmp-actions">
      <button type="button" class="btn btn-ghost" data-pin>${L('Pin the current scenario as A', 'تثبيت السيناريو الحالي بوصفه (أ)')}</button>
      <button type="button" class="btn btn-ghost" data-swap hidden>${L('Swap A and B', 'تبديل (أ) و(ب)')}</button>
      <button type="button" class="btn btn-ghost" data-unpin hidden>${L('Clear A', 'إلغاء (أ)')}</button>
      <span class="share-note" data-cmp-note aria-live="polite"></span>
    </div>
    <div data-compare></div>
  </section>`;
}

/** What the inventory and carrying-cost scenarios cannot say, with the scale check computed from the data. */
function inventoryLimits(ds: SupplyChainDataset) {
  const base = simulate(ds, BASELINE), annualCogs = (base.baseline.cogs / ds.months.length) * 12;
  const years = base.stock / annualCogs, spend = base.spend.total;
  const items: [string, string][] = [
    [L('One snapshot', 'لقطة واحدة'), L(`Stock on hand is a single export snapshot. It does not reconcile with ${ds.months.length} months of sales, nor with purchase orders (${money(spend)} against ${money(base.baseline.cogs)} cost of sales).`, `المخزون المتاح لقطة تصدير واحدة. ولا يتطابق مع ${ds.months.length} شهرًا من المبيعات، ولا مع أوامر الشراء (${money(spend)} مقابل ${money(base.baseline.cogs)} تكلفة مبيعات).`)],
    [L('Implausible scale', 'حجم غير معقول'), L(`At recorded sales, today’s stock is about ${b(years.toFixed(1))} years of cost of sales. That reflects the sample database, not a real distributor, so capital and holding-cost figures are illustrations of the method.`, `بحسب المبيعات المسجّلة، يعادل مخزون اليوم نحو ${b(years.toFixed(1))} سنة من تكلفة المبيعات. وهذا يعكس قاعدة البيانات النموذجية لا موزّعًا حقيقيًا، فأرقام رأس المال وتكلفة الاحتفاظ إيضاح للمنهج.`)],
    [L('Released is not cash', 'المحرَّر ليس نقدًا'), L('“Released” values surplus stock at cost. It ignores markdowns, write-downs, disposal or return costs, and the risk of running short.', '«المحرَّر» يقيّم المخزون الفائض بالتكلفة. ويتجاهل التخفيضات والشطب وتكاليف التصريف أو الإرجاع، وخطر النفاد.')],
    [L('Cover is backward-looking', 'التغطية تنظر إلى الماضي'), L('Months of cover use average recorded monthly use, with no seasonality or demand forecast (the Lab’s forecast check found no reliable rule).', 'أشهر التغطية تستخدم متوسط الاستخدام الشهري المسجَّل، دون موسمية ولا توقّع للطلب (لم يجد فحص التوقّع في المختبر قاعدة موثوقة).')],
    [L('Carrying cost is yours', 'تكلفة الاحتفاظ من وضعك'), L('No carrying rate exists in the data. The holding cost is your rate × capital, compared with annual gross profit for scale and never subtracted from it: it is not a line of the profit bridge.', 'لا يوجد معدل احتفاظ في البيانات. وتكلفة الاحتفاظ = معدلك × رأس المال، وتُقارن بإجمالي الربح السنوي للإيضاح ولا تُطرح منه أبدًا: فهي ليست خطًا في جسر الربح.')],
  ];
  return `<aside class="sim-limits" aria-labelledby="sim-limits-h">
      <p class="sl-kicker" id="sim-limits-h">${L('Limits of the inventory and carrying-cost scenarios', 'حدود سيناريوهات المخزون وتكلفة الاحتفاظ')}</p>
      <dl>${items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    </aside>`;
}

function ledgersMarkup(ds: SupplyChainDataset) {
  return `
  <section class="section sim-ledgers" aria-labelledby="sim-ledgers-h" data-reveal>
    <h2 class="sec-title" id="sim-ledgers-h">${L('Four ledgers, never added together', 'أربعة دفاتر لا تُجمع أبدًا')}</h2>
    <p class="sec-note">${L('In this sample, purchasing and stock do not reconcile with sales, so each is reported in its own terms and units. A supplier shock appears twice, once per ledger, and is never counted twice in one.', 'في هذه العيّنة لا تتطابق المشتريات والمخزون مع المبيعات، لذا يُعرض كلٌّ منها بمقياسه ووحدته. وتظهر صدمة المورد مرتين، مرة في كل دفتر، ولا تُحسب مرتين في دفتر واحد أبدًا.')}</p>
    <ul class="ledgers">
      <li class="ledger" data-ledger="profit"></li>
      <li class="ledger" data-ledger="spend"></li>
      <li class="ledger" data-ledger="capital"></li>
      <li class="ledger" data-ledger="holding"></li>
    </ul>
    ${inventoryLimits(ds)}
  </section>`;
}

function methodMarkup() {
  const rows: [string, string][] = [
    [L('Baseline', 'الأساس'), L('Each item’s recorded revenue and cost of sales. In this export cost of sales equals units × cost price for every item, so cost changes reconcile exactly. With every lever at rest the result is the recorded total, untouched.', 'الإيراد وتكلفة المبيعات المسجّلان لكل صنف. وفي هذا التصدير تساوي تكلفة المبيعات الوحدات × سعر التكلفة لكل صنف، لذا تتطابق تغييرات التكلفة تمامًا. ومع سكون كل الروافع تكون النتيجة هي الإجمالي المسجَّل دون تعديل.')],
    [L('Steps', 'الخطوات'), L('Per item, with revenue R, cost of sales K, price change p and volume factor f = (1+p)^e: price +R·p; volume (f−1)·(R(1+p)−K); recovery share × unpicked units × f × (scenario price − cost). Taken in this fixed order, each effect is counted once and the steps add up exactly to the change in gross profit. Another order would split the small interaction terms differently.', 'لكل صنف، بإيراد R وتكلفة مبيعات K وتغيير سعر p ومعامل كمية f = (1+p)^e: السعر ‎+R·p؛ الكمية ‎(f−1)·(R(1+p)−K)؛ الاستعادة = النسبة × الوحدات غير المنتقاة × f × (سعر السيناريو − التكلفة). وبهذا الترتيب الثابت يُحسب كل أثر مرة واحدة وتساوي الخطوات مجتمعةً التغيّر في إجمالي الربح تمامًا. وترتيب آخر يوزّع حدود التفاعل الصغيرة بشكل مختلف.')],
    [L('Break-even', 'التعادل'), L('For the price lever alone on a scope with recorded profit M and revenue R, profit at the new price on recorded volume is A = M + p·R, and the scenario keeps the recorded profit where volume × A = M. With a positive margin that is a floor (volume may fall by up to p ÷ (m + p)). When the scope still sells below cost it is a ceiling: fewer units lose less, so profit holds unless volume rises past the threshold. If the change lifts a loss-making scope to cost or above, profit holds at any volume; if it pushes a profitable scope to cost or below, no volume keeps it. No assumption is needed for these thresholds.', 'لرافعة السعر وحدها على نطاق ربحه المسجَّل M وإيراده R، يكون الربح بالسعر الجديد على الكمية المسجّلة A = M + p·R، ويحافظ السيناريو على الربح المسجَّل حيث الكمية × A = M. ومع هامش موجب يكون ذلك حدًّا أدنى (يمكن أن تنخفض الكمية حتى p ÷ (m + p)). وحين يظل النطاق يُباع بأقل من التكلفة يكون حدًّا أعلى: الوحدات الأقل تخسر أقل، فيصمد الربح ما لم ترتفع الكمية فوق الحد. وإن رفع التغيير نطاقًا خاسرًا إلى التكلفة أو أعلى صمد الربح عند أي كمية؛ وإن دفع نطاقًا رابحًا إلى التكلفة أو أدنى فلا كمية تحافظ عليه. ولا تحتاج هذه الحدود إلى أي افتراض.')],
    [L('Supplier cost', 'تكلفة المورد'), L('A cost change k on one supplier moves cost of sales on its items by −k × units × cost (an outside change, brass on the bridge) and, separately, its recorded purchase orders by k × spend. The two ledgers do not reconcile in this sample, so both are shown and neither is added to the other. Pass-through raises those items’ prices by the passed share of the cost change; it is a decision step, and its volume effect uses your elasticity.', 'تغيّر التكلفة k لدى مورد واحد يحرّك تكلفة مبيعات أصنافه بمقدار ‎−k × الوحدات × التكلفة (تغيّر خارجي، نحاسي على الجسر)، وبشكل منفصل أوامر الشراء المسجّلة منه بمقدار k × الإنفاق. ولا يتطابق الدفتران في هذه العيّنة، فيُعرض كلاهما ولا يُضاف أحدهما إلى الآخر. والتمرير يرفع أسعار تلك الأصناف بالنسبة الممرَّرة من تغيّر التكلفة؛ وهو خطوة قرار، ويستخدم أثرها على الكمية مرونتك.')],
    [L('Inventory capital', 'رأس مال المخزون'), L('Capital released = stock on hand above the chosen months of recorded use, at cost (the Lab’s instrument 05). With a carrying rate set, the annual holding cost is capital × rate. It is compared with annualised recorded gross profit for scale only; it is never subtracted from it, because the stock snapshot does not reconcile with the sales period.', 'رأس المال المحرَّر = المخزون المتاح الزائد عن أشهر الاستخدام المسجَّل المختارة، بالتكلفة (الأداة 05 في المختبر). ومع تحديد معدل احتفاظ تكون تكلفة الاحتفاظ السنوية = رأس المال × المعدل. وتُقارن بإجمالي الربح المسجَّل السنوي للإيضاح فقط؛ ولا تُطرح منه أبدًا، لأن لقطة المخزون لا تطابق فترة المبيعات.')],
    [L('Sensitivity', 'الحساسية'), L('One assumption at a time across its full lever range, everything else held at your settings. The bars are not combined and the spread is not a probability range.', 'افتراض واحد في كل مرة عبر مدى رافعته كاملًا، مع تثبيت كل ما عداه على إعداداتك. ولا تُجمع الأعمدة، والمدى ليس مدى احتمالات.')],
    [L('Assumption load', 'حمولة الافتراض'), L('Σ|assumed steps| ÷ Σ|all steps|: the share of the bridge’s total movement that rests on a premise the data cannot check (the volume response; that unpicked units would have sold). 0% means none of the movement depends on such a premise. It does not mean the scenario has no assumptions (the list beside it never empties) or that the result is certain. It is not a confidence level or a probability.', 'Σ|الخطوات المفترضة| ÷ Σ|كل الخطوات|: نصيب إجمالي حركة الجسر الذي يستند إلى مقدّمة لا تستطيع البيانات التحقق منها (استجابة الكمية؛ وأن الوحدات غير المنتقاة كانت ستُباع). و0% تعني أن أي جزء من الحركة لا يعتمد على مقدّمة كهذه. ولا تعني أن السيناريو بلا افتراضات (فالقائمة المجاورة لا تفرغ أبدًا) ولا أن النتيجة مؤكدة. وهي ليست مستوى ثقة ولا احتمالًا.')],
    [L('Limits', 'الحدود'), L('One constant elasticity for every item in scope; no competitor response or switching between items; no cost to serve recovered orders; no price history. Results are what-ifs on the recorded period, not forecasts.', 'مرونة ثابتة واحدة لكل صنف ضمن النطاق؛ لا استجابة من المنافسين ولا انتقال بين الأصناف؛ لا تكلفة لخدمة الطلبات المستعادة؛ لا سجل للأسعار. والنتائج احتمالات افتراضية على الفترة المسجّلة، لا توقعات.')],
  ];
  return `
  <section class="section sim-method-sec" data-reveal>
    <details class="lab-method">
      <summary>${L('Method, formulas and limits', 'المنهجية والمعادلات والحدود')}</summary>
      <dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    </details>
    <div class="sim-share">
      <button type="button" class="btn btn-ghost" data-copy>${L('Copy a link to this scenario', 'نسخ رابط هذا السيناريو')}</button>
      <span class="share-note" data-copied aria-live="polite"></span>
    </div>
  </section>`;
}

/* -------------------------------------------------------------------------------------- statements */
type Result = ReturnType<typeof simulate>;
const scopeName = (ds: SupplyChainDataset, s: Scope) => (s.kind === 'all' ? L('every item', 'كل الأصناف') : s.kind === 'structural' ? L('the four loss-making masks', 'الأقنعة الأربعة الخاسرة') : famName(ds.categories[s.c] ?? ''));
const supplierName = (ds: SupplyChainDataset, s: number | null) => ds.suppliers.find((x) => x.id === s)?.label ?? '';

/** The break-even statement for the price lever, one wording per case (see breakEven in src/data/sim.ts). */
function breakEvenText(r: Result) {
  const be = r.breakEven, v = be.volumeChange, e = be.elasticity !== null ? ` (${L('break-even elasticity', 'مرونة التعادل')} ${b(ef(be.elasticity))})` : '';
  switch (be.kind) {
    case 'floor': return v < 0
      ? L(`Profit stays at or above the recorded level unless volume falls by more than ${b(pct(-v))}${e}.`, `يبقى الربح عند المستوى المسجَّل أو أعلى ما لم تنخفض الكمية بأكثر من ${b(pct(-v))}${e}.`)
      : L(`Volume must rise by more than ${b(pct(v))} for profit to reach the recorded level${e}.`, `يجب أن ترتفع الكمية بأكثر من ${b(pct(v))} ليبلغ الربح المستوى المسجَّل${e}.`);
    case 'ceiling': return v >= 0
      ? L(`The items in scope still sell below cost, so every unit loses money, but less than before. Profit stays at or above the recorded level unless volume rises by more than ${b(pct(v))}; any fall in volume helps.`, `ما تزال الأصناف ضمن النطاق تُباع بأقل من التكلفة، فكل وحدة تخسر، لكن أقل من قبل. ويبقى الربح عند المستوى المسجَّل أو أعلى ما لم ترتفع الكمية بأكثر من ${b(pct(v))}؛ وأي انخفاض في الكمية يفيد.`)
      : L(`The items in scope sell further below cost, so each unit loses more. Profit reaches the recorded level only if volume falls by at least ${b(pct(-v))}.`, `تُباع الأصناف ضمن النطاق بأقل من التكلفة بفارق أكبر، فتخسر كل وحدة أكثر. ولا يبلغ الربح المستوى المسجَّل إلا إذا انخفضت الكمية بنسبة ${b(pct(-v))} على الأقل.`);
    case 'always': return be.profit < 0
      ? L('The items in scope lose money at recorded prices; this change lifts them to cost or above, so profit is at or above the recorded level at any volume.', 'الأصناف ضمن النطاق تخسر بالأسعار المسجّلة؛ وهذا التغيير يرفعها إلى التكلفة أو أعلى، فيكون الربح عند المستوى المسجَّل أو أعلى أيًّا كانت الكمية.')
      : L('The items in scope earned nothing at recorded prices; any volume at this price keeps profit at or above the recorded level.', 'لم تحقق الأصناف ضمن النطاق ربحًا بالأسعار المسجّلة؛ وأي كمية بهذا السعر تُبقي الربح عند المستوى المسجَّل أو أعلى.');
    case 'never': return L('This price takes the items in scope to cost or below, so no volume keeps their recorded profit.', 'هذا السعر يهبط بالأصناف ضمن النطاق إلى التكلفة أو أدنى، فلا كمية تحافظ على ربحها المسجَّل.');
    default: return '';
  }
}

function statements(ds: SupplyChainDataset, r: Result) {
  const sc = r.scenario, st = Object.fromEntries(r.steps.map((s) => [s.key, s.delta])) as Record<string, number>;
  const out: [Kind, string][] = [];
  if (!r.touched) out.push(['finding', L(`No lever moves gross profit, so the result is the recorded gross profit, ${b(money(r.baseline.profit))}, exactly.`, `لا رافعة تحرّك إجمالي الربح، فالنتيجة هي إجمالي الربح المسجَّل ${b(money(r.baseline.profit))} تمامًا.`)]);
  if (sc.price.change) {
    out.push(['calc', L(`At recorded volumes, a ${b(sp(sc.price.change))} price change on ${esc(scopeName(ds, sc.price.scope))} moves gross profit by ${b(sm(st.price - (r.passThroughPrice ?? 0)))}.`, `عند الكميات المسجّلة، يغيّر تعديل السعر ${b(sp(sc.price.change))} على ${esc(scopeName(ds, sc.price.scope))} إجمالي الربح بمقدار ${b(sm(st.price - (r.passThroughPrice ?? 0)))}.`)]);
    out.push(['calc', breakEvenText(r)]);
  }
  if (sc.supplier.s !== null && sc.supplier.shock) {
    const who = esc(supplierName(ds, sc.supplier.s));
    out.push(['calc', L(`A ${b(sp(sc.supplier.shock))} change in ${who}’s cost prices moves cost of sales on its items by ${b(sm(-st.cost))}, and its recorded purchase orders by ${b(sm(r.spend.delta))}. Two ledgers, shown apart.`, `تغيّر ${b(sp(sc.supplier.shock))} في أسعار تكلفة ${who} يحرّك تكلفة مبيعات أصنافه بمقدار ${b(sm(-st.cost))}، وأوامر الشراء المسجّلة منه بمقدار ${b(sm(r.spend.delta))}. دفتران يُعرضان منفصلين.`)]);
    if (sc.supplier.passThrough) out.push(['calc', L(`Passing on ${b(pct(sc.supplier.passThrough, 0))} of it raises those items’ prices, adding ${b(sm(r.passThroughPrice ?? 0))} at recorded volume.`, `تمرير ${b(pct(sc.supplier.passThrough, 0))} منه يرفع أسعار تلك الأصناف، فيضيف ${b(sm(r.passThroughPrice ?? 0))} عند الكمية المسجّلة.`)]);
  }
  if (premises(sc).includes('volume')) out.push(['hypothesis', sc.elasticity === 0
    ? L('Volume is assumed to stay as recorded (elasticity 0). That is an assumption, not a finding: it moves nothing on the bridge, so the assumption load cannot show it. The sensitivity view shows what other responses would give.', 'يُفترض أن الكمية تبقى كما سُجّلت (مرونة 0). وهذا افتراض لا نتيجة: فهو لا يحرّك شيئًا على الجسر، فلا تستطيع حمولة الافتراض إظهاره. ويبيّن عرض الحساسية ما تعطيه استجابات أخرى.')
    : L(`With an assumed elasticity of ${b(ef(sc.elasticity))}, the volume response moves profit by ${b(sm(st.volume))}. The data cannot estimate this response.`, `مع مرونة مفترضة قدرها ${b(ef(sc.elasticity))}، تغيّر استجابة الكمية الربح بمقدار ${b(sm(st.volume))}. ولا تستطيع البيانات تقدير هذه الاستجابة.`)]);
  if (sc.recovery.share) out.push(['hypothesis', L(`Fulfilling ${b(pct(sc.recovery.share, 0))} of the unpicked units in ${esc(scopeName(ds, sc.recovery.scope))} (${b(int(r.recoveredUnits))} units) adds ${b(sm(st.recovery))}. An upper bound: it assumes the customers would have waited and paid.`, `تنفيذ ${b(pct(sc.recovery.share, 0))} من الوحدات غير المنتقاة في ${esc(scopeName(ds, sc.recovery.scope))} (${b(int(r.recoveredUnits))} وحدة) يضيف ${b(sm(st.recovery))}. حدّ أعلى: يفترض أن العملاء كانوا سينتظرون ويدفعون.`)]);
  const inv = r.inventory;
  if (inv) {
    out.push(['calc', L(`Holding ${b(int(inv.cover))} months of recorded use would release ${b(money(inv.released))} of the ${b(money(inv.capital))} in stock (${b(pct(inv.share))}). Capital, not profit.`, `الاحتفاظ بـ${b(int(inv.cover))} شهرًا من الاستخدام المسجَّل يحرّر ${b(money(inv.released))} من ${b(money(inv.capital))} في المخزون (${b(pct(inv.share))}). رأس مال لا ربح.`)]);
    if (inv.holdingNow !== null) out.push(['hypothesis', L(`At an assumed ${b(pct(sc.inventory.carryRate ?? 0))} a year, holding today’s stock would cost ${b(money(inv.holdingNow))} a year, ${b(pct(inv.holdingNow / inv.annualProfit, 0))} of recorded annual gross profit. That ratio reflects the sample’s unrealistic stock, not a business case.`, `بمعدل مفترض ${b(pct(sc.inventory.carryRate ?? 0))} سنويًا، يكلّف الاحتفاظ بمخزون اليوم ${b(money(inv.holdingNow))} سنويًا، أي ${b(pct(inv.holdingNow / inv.annualProfit, 0))} من إجمالي الربح السنوي المسجَّل. وتعكس هذه النسبة مخزون العيّنة غير الواقعي، لا حالة أعمال.`)]);
  }
  if (!out.length || (out.length === 1 && !r.touched)) out.push(['calc', L('Move a lever: every effect on gross profit becomes a step on the bridge, labelled as a decision, an outside change or an assumption.', 'حرّك رافعة: يصبح كل أثر على إجمالي الربح خطوةً على الجسر، موسومة بأنها قرار أو تغيّر خارجي أو افتراض.')]);
  return out;
}

const PREMISE = (ds: SupplyChainDataset, sc: Scenario): Record<Premise, string> => ({
  recorded: L('Everything not moved stays as recorded: other prices, costs, customers and the 41-month period itself.', 'كل ما لم يتحرك يبقى كما سُجّل: بقية الأسعار والتكاليف والعملاء والفترة ذاتها.').replace('41', String(ds.months.length)),
  volume: sc.elasticity === 0 ? L('Volume does not react to price (elasticity 0).', 'الكمية لا تتأثر بالسعر (مرونة 0).') : L(`Volume reacts to price with one elasticity, ${ef(sc.elasticity)}, for every item in scope.`, `تتأثر الكمية بالسعر بمرونة واحدة، ${ef(sc.elasticity)}، لكل صنف ضمن النطاق.`),
  recovery: L('Unpicked units would have sold at the scenario price, with no extra cost to serve.', 'الوحدات غير المنتقاة كانت ستُباع بسعر السيناريو، دون تكلفة خدمة إضافية.'),
  shock: L('The supplier’s cost change applies equally to all of its items.', 'تغيّر تكلفة المورد يسري بالتساوي على كل أصنافه.'),
  passThrough: L('Customers accept the passed-on price rise as any other price change.', 'يتقبّل العملاء رفع السعر الممرَّر كأي تغيير سعري آخر.'),
  cover: L('Stock above the cover can be released at cost: no write-down, no disposal cost.', 'المخزون الزائد عن التغطية يمكن تحريره بالتكلفة: دون شطب ولا تكلفة تصريف.'),
  carry: L(`The carrying rate, ${pct(sc.inventory.carryRate ?? 0)} a year, is yours; the data holds none.`, `معدل الاحتفاظ، ${pct(sc.inventory.carryRate ?? 0)} سنويًا، من وضعك؛ والبيانات لا تحوي أيًّا منه.`),
});

const SENS_NAME = (): Record<SensKey, string> => ({ elasticity: L('Volume response (elasticity)', 'استجابة الكمية (المرونة)'), share: L('Recovered share', 'النسبة المستعادة'), shock: L('Supplier cost change', 'تغيّر تكلفة المورد'), passThrough: L('Share passed on', 'النسبة الممرَّرة') });
const SENS_FMT: Record<SensKey, (v: number) => string> = { elasticity: (v) => ef(v), share: (v) => pct(v, 0), shock: (v) => sp(v, 0), passThrough: (v) => pct(v, 0) };

/** A/B table: one measure per row, each in its own ledger; B − A is taken row by row and never summed. */
function compareTable(ds: SupplyChainDataset, a: Result, bR: Result) {
  const st = (r: Result, k: string) => r.steps.find((s) => s.key === k)!.delta;
  type Row = { group: string; name: string; a: number | null; b: number | null; f: (v: number) => string; good?: 1 | -1 };
  const holding = (r: Result) => (r.inventory && r.inventory.holdingNow !== null ? r.inventory.holdingNow - (r.inventory.holdingAvoided ?? 0) : null);
  const rows: Row[] = [
    { group: L('Gross profit', 'إجمالي الربح'), name: L('Scenario gross profit', 'إجمالي ربح السيناريو'), a: a.result.profit, b: bR.result.profit, f: money, good: 1 },
    { group: '', name: L('Margin', 'الهامش'), a: a.result.margin, b: bR.result.margin, f: (v) => pct(v), good: 1 },
    { group: '', name: STEP_NAME().price, a: st(a, 'price'), b: st(bR, 'price'), f: sm },
    { group: '', name: STEP_NAME().volume, a: st(a, 'volume'), b: st(bR, 'volume'), f: sm },
    { group: '', name: STEP_NAME().cost, a: st(a, 'cost'), b: st(bR, 'cost'), f: sm },
    { group: '', name: STEP_NAME().recovery, a: st(a, 'recovery'), b: st(bR, 'recovery'), f: sm },
    { group: '', name: L('Assumption load', 'حمولة الافتراض'), a: a.load.total ? a.load.share : null, b: bR.load.total ? bR.load.share : null, f: (v) => pct(v, 0) },
    { group: L('Purchase spend', 'إنفاق الشراء'), name: L('Change on purchase orders', 'التغيّر في أوامر الشراء'), a: a.spend.delta, b: bR.spend.delta, f: sm, good: -1 },
    { group: L('Inventory capital', 'رأس مال المخزون'), name: L('Capital released', 'رأس المال المحرَّر'), a: a.inventory?.released ?? null, b: bR.inventory?.released ?? null, f: money, good: 1 },
    { group: L('Holding cost', 'تكلفة الاحتفاظ'), name: L('Annual holding cost after the policy', 'تكلفة الاحتفاظ السنوية بعد السياسة'), a: holding(a), b: holding(bR), f: money, good: -1 },
  ];
  const cell = (v: number | null, f: (x: number) => string) => (v === null ? `<span class="cmp-na">${L('off', 'معطّل')}</span>` : esc(f(v)));
  const diff = (r: Row) => {
    if (r.a === null || r.b === null) return `<span class="cmp-na">—</span>`;
    const d = r.b - r.a;
    const dir = Math.abs(d) < 1e-9 * Math.max(1, Math.abs(r.a)) ? 'flat' : r.good ? (d * r.good > 0 ? 'up' : 'down') : 'flat';
    const txt = r.f === money || r.f === sm ? sm(d) : r.name === L('Margin', 'الهامش') ? `${sgn(d * 100, (x) => x.toFixed(2))} ${L('pts', 'نقطة')}` : sgn(d * 100, (x) => x.toFixed(0)) + L(' pts', ' نقطة');
    return `<span class="cmp-d" data-dir="${dir}">${esc(txt)}</span>`;
  };
  const da = a.result.profit - bR.result.profit;
  return `
    <div class="cmp-face" aria-hidden="true">
      <div class="cmp-side"><span class="cmp-tag">${L('A', 'أ')}</span><span class="display num">${esc(money(a.result.profit))}</span></div>
      <div class="cmp-mid"><span class="num">${esc(sm(-da))}</span><span>${L('B − A, gross profit', '(ب) − (أ)، إجمالي الربح')}</span></div>
      <div class="cmp-side"><span class="cmp-tag cmp-b">${L('B', 'ب')}</span><span class="display num">${esc(money(bR.result.profit))}</span></div>
    </div>
    <div class="cmp-scroll" tabindex="0" role="region" aria-label="${esc(L('Comparison table', 'جدول المقارنة'))}">
    <table class="cmp-table">
      <caption class="sr-only">${L('Scenario A against scenario B, one measure per row; differences are per row and never added across ledgers', 'السيناريو (أ) مقابل (ب)، مقياس واحد لكل صف؛ والفروق لكل صف ولا تُجمع عبر الدفاتر')}</caption>
      <thead><tr><th scope="col">${L('Ledger', 'الدفتر')}</th><th scope="col">${L('Measure', 'المقياس')}</th><th scope="col" class="num">${L('A', 'أ')}</th><th scope="col" class="num">${L('B', 'ب')}</th><th scope="col" class="num">${L('B − A', 'ب − أ')}</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr${r.group ? ' class="cmp-group"' : ''}><th scope="row">${r.group || `<span class="sr-only">${rows.slice(0, i).reverse().find((x) => x.group)?.group ?? ''}</span>`}</th><td>${r.name}</td><td class="num">${cell(r.a, r.f)}</td><td class="num">${cell(r.b, r.f)}</td><td class="num">${diff(r)}</td></tr>`).join('')}</tbody>
    </table></div>
    <p class="cmp-foot">${L(`A: ${esc(describe(ds, a.scenario))}. B: ${esc(describe(ds, bR.scenario))}.`, `(أ): ${esc(describe(ds, a.scenario))}. (ب): ${esc(describe(ds, bR.scenario))}.`)}</p>`;
}

/** One-line description of a scenario's levers, for the comparison footnote. */
function describe(ds: SupplyChainDataset, sc: Scenario) {
  const parts: string[] = [];
  if (sc.price.change) parts.push(L(`price ${sp(sc.price.change)} on ${scopeName(ds, sc.price.scope)}`, `السعر ${sp(sc.price.change)} على ${scopeName(ds, sc.price.scope)}`));
  if (premises(sc).includes('volume')) parts.push(L(`elasticity ${ef(sc.elasticity)}`, `المرونة ${ef(sc.elasticity)}`));
  if (sc.supplier.s !== null && sc.supplier.shock) parts.push(L(`${supplierName(ds, sc.supplier.s)} costs ${sp(sc.supplier.shock)}, ${pct(sc.supplier.passThrough, 0)} passed on`, `تكاليف ${supplierName(ds, sc.supplier.s)} ${sp(sc.supplier.shock)}، مع تمرير ${pct(sc.supplier.passThrough, 0)}`));
  if (sc.recovery.share) parts.push(L(`${pct(sc.recovery.share, 0)} of unpicked units`, `${pct(sc.recovery.share, 0)} من الوحدات غير المنتقاة`));
  if (sc.inventory.cover !== null) parts.push(L(`${sc.inventory.cover}-month cover`, `تغطية ${sc.inventory.cover} شهرًا`));
  if (sc.inventory.carryRate !== null) parts.push(L(`carrying ${pct(sc.inventory.carryRate)}`, `احتفاظ ${pct(sc.inventory.carryRate)}`));
  return parts.length ? parts.join('; ') : L('recorded baseline', 'الأساس المسجَّل');
}

/* ------------------------------------------------------------------------------------------- wiring */
function wire(root: HTMLElement, ds: SupplyChainDataset, cleanup: (() => void)[]) {
  const q = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const ro = (k: string) => root.querySelectorAll<HTMLElement>(`[data-ro="${k}"]`);
  const set = (k: string, v: string) => ro(k).forEach((e) => { e.innerHTML = v; });
  const bridge = new ProfitBridge(q('[data-bridge]'));
  cleanup.push(() => bridge.destroy());
  const params = hashParams();
  let sc = fitTo(ds, fromParams((k) => params.get(k)));
  let pinned: Scenario | null = params.has('ab') ? fitTo(ds, fromParams((k) => params.get(k), 'a.')) : null;
  let sensKey: SensKey | null = null, cursor: number | null = null;
  let shown = 0, tween = 0, liveT = 0, urlT = 0, claimT = 0;
  cleanup.push(() => { cancelAnimationFrame(tween); clearTimeout(liveT); clearTimeout(urlT); clearTimeout(claimT); });
  const rig = ROUTE_RIGS.sim ?? {};
  const exposure = supplierExposure(ds);
  // preset scenarios depend only on the dataset: encode them once, compare by their URL form on every render
  const presetKeys = new Map(PRESETS().map((p) => [p.id, JSON.stringify(toParams(normalise(p.sc(ds))))]));
  const presetBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-preset]')];

  const inputs = {
    price: q<HTMLInputElement>('#lv-price'), e: q<HTMLInputElement>('#lv-e'), rec: q<HTMLInputElement>('#lv-rec'),
    sup: q<HTMLSelectElement>('#lv-sup'), shock: q<HTMLInputElement>('#lv-shock'), pt: q<HTMLInputElement>('#lv-pt'),
    coverOn: q<HTMLInputElement>('#lv-cover-on'), cover: q<HTMLInputElement>('#lv-cover'), carryOn: q<HTMLInputElement>('#lv-carry-on'), carry: q<HTMLInputElement>('#lv-carry'),
  };
  const scopeGet = (name: string): Scope => {
    const v = root.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
    return v === 's' ? { kind: 'structural' } : v === 'f' ? { kind: 'family', c: Number(q<HTMLSelectElement>(`select[name="${name}-fam"]`).value) } : { kind: 'all' };
  };
  const scopeSet = (name: string, s: Scope) => {
    const v = s.kind === 'structural' ? 's' : s.kind === 'family' ? 'f' : 'a';
    root.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((i) => { i.checked = i.value === v; });
    const sel = q<HTMLSelectElement>(`select[name="${name}-fam"]`);
    if (s.kind === 'family') sel.value = String(s.c);
    sel.disabled = s.kind !== 'family';
  };
  /** disabled levers stay visible (so the console's shape is stable) but leave the tab order */
  const enable = () => {
    const sup = inputs.sup.value !== '';
    inputs.shock.disabled = !sup; inputs.pt.disabled = !sup;
    inputs.cover.disabled = !inputs.coverOn.checked;
    inputs.carryOn.disabled = !inputs.coverOn.checked;
    inputs.carry.disabled = !inputs.coverOn.checked || !inputs.carryOn.checked;
    root.querySelectorAll<HTMLElement>('.lever').forEach((l) => l.classList.toggle('is-off', !!l.querySelector<HTMLInputElement>('input[type=range]')?.disabled));
  };
  const toControls = () => {
    inputs.price.value = String(+(sc.price.change * 100).toFixed(1));
    inputs.e.value = String(sc.elasticity);
    inputs.rec.value = String(Math.round(sc.recovery.share * 100));
    scopeSet('price-scope', sc.price.scope);
    scopeSet('rec-scope', sc.recovery.scope);
    inputs.sup.value = sc.supplier.s === null ? '' : String(sc.supplier.s);
    inputs.shock.value = String(+(sc.supplier.shock * 100).toFixed(1));
    inputs.pt.value = String(Math.round(sc.supplier.passThrough * 100));
    inputs.coverOn.checked = sc.inventory.cover !== null;
    inputs.cover.value = String(sc.inventory.cover ?? 12);
    inputs.carryOn.checked = sc.inventory.carryRate !== null;
    inputs.carry.value = String(+((sc.inventory.carryRate ?? 0.15) * 100).toFixed(1));
    enable();
  };
  const fromControls = () => {
    enable();
    const s = inputs.sup.value === '' ? null : Number(inputs.sup.value);
    sc = normalise({
      v: 1,
      price: { scope: scopeGet('price-scope'), change: Number(inputs.price.value) / 100 }, elasticity: Number(inputs.e.value),
      recovery: { scope: scopeGet('rec-scope'), share: Number(inputs.rec.value) / 100 },
      supplier: { s, shock: s === null ? 0 : Number(inputs.shock.value) / 100, passThrough: s === null ? 0 : Number(inputs.pt.value) / 100 },
      inventory: { cover: inputs.coverOn.checked ? Number(inputs.cover.value) : null, carryRate: inputs.coverOn.checked && inputs.carryOn.checked ? Number(inputs.carry.value) / 100 : null },
    });
    root.querySelectorAll<HTMLSelectElement>('.sim-scope select').forEach((x) => { x.disabled = !root.querySelector<HTMLInputElement>(`input[name="${x.name.replace(/-fam$/, '')}"][value="f"]`)?.checked; });
  };

  const countTo = (el: NodeListOf<HTMLElement>, to: number) => {
    cancelAnimationFrame(tween);
    const from = shown;
    if (motion.still || from === to) { shown = to; el.forEach((e) => { e.textContent = money(to); }); return; }
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 480), v = from + (to - from) * (1 - Math.pow(1 - t, 3));
      shown = v; el.forEach((e) => { e.textContent = money(v); });
      if (t < 1) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
  };

  const ledger = (key: string, on: boolean, name: string, val: string, note: string, sub = '') => {
    const el = q(`[data-ledger="${key}"]`);
    el.classList.toggle('lg-on', on); el.classList.toggle('lg-off', !on && key === 'holding' && val === L('Disabled', 'معطّلة'));
    el.innerHTML = `<p class="lg-name">${name}</p><p class="lg-val num">${val}</p>${sub ? `<p class="lg-sub num">${sub}</p>` : ''}<p class="lg-note">${note}</p>`;
  };
  const renderLedgers = (r: Result) => {
    ledger('profit', r.touched > 0, L('Gross profit', 'إجمالي الربح'), money(r.result.profit), L('Revenue less cost of sales. The only ledger the bridge moves.', 'الإيراد ناقص تكلفة المبيعات. الدفتر الوحيد الذي يحرّكه الجسر.'), r.touched ? `${sm(r.delta)} ${L('vs recorded', 'مقابل المسجَّل')}` : '');
    const sup = sc.supplier.s !== null && sc.supplier.shock !== 0;
    ledger('spend', sup, L('Purchase spend', 'إنفاق الشراء'), money(r.spend.total + r.spend.delta),
      L(`Recorded purchase orders. Not cost of sales (${money(r.baseline.cogs)}); the two do not reconcile in this sample.`, `أوامر الشراء المسجّلة. وليست تكلفة المبيعات (${money(r.baseline.cogs)})؛ ولا يتطابقان في هذه العيّنة.`),
      sup ? L(`${sm(r.spend.delta)} on ${esc(supplierName(ds, sc.supplier.s))}’s ${money(r.spend.supplier)}`, `${sm(r.spend.delta)} على ${money(r.spend.supplier)} لدى ${esc(supplierName(ds, sc.supplier.s))}`) : '');
    const inv = r.inventory;
    ledger('capital', !!inv, L('Inventory capital', 'رأس مال المخزون'), money(inv ? inv.capital : r.stock),
      L('Stock on hand at cost: one snapshot, not reconciled with stock movements.', 'المخزون المتاح بالتكلفة: لقطة واحدة غير مطابقة لحركات المخزون.'),
      inv ? L(`${money(inv.released)} above ${inv.cover} months of cover (${pct(inv.share, 0)})`, `${money(inv.released)} فوق تغطية ${inv.cover} شهرًا (${pct(inv.share, 0)})`) : '');
    if (inv && inv.holdingNow !== null) {
      ledger('holding', true, L('Annual holding cost', 'تكلفة الاحتفاظ السنوية'), money(inv.holdingNow),
        L(`At your ${pct(sc.inventory.carryRate ?? 0)} a year. Compared with recorded annual gross profit (${money(inv.annualProfit)}) for scale only, never subtracted from it.`, `بمعدلك ${pct(sc.inventory.carryRate ?? 0)} سنويًا. ويُقارن بإجمالي الربح السنوي المسجَّل (${money(inv.annualProfit)}) للإيضاح فقط، ولا يُطرح منه أبدًا.`),
        L(`${money(inv.holdingAvoided ?? 0)} a year avoided by the policy`, `${money(inv.holdingAvoided ?? 0)} سنويًا تتجنّبها السياسة`));
    } else ledger('holding', false, L('Holding cost', 'تكلفة الاحتفاظ'), L('Disabled', 'معطّلة'), L('No carrying rate is set. Off by default because the sample’s stock levels are not realistic.', 'لم يُحدَّد معدل احتفاظ. معطّلة افتراضيًا لأن مستويات المخزون في العيّنة غير واقعية.'));
  };

  /** sensitivity: tornado (one bar per relevant assumption) and the curve of the chosen one, with a keyboard cursor */
  const renderSens = (r: Result) => {
    const keys = sensitiveKeys(sc);
    if (!sensKey || !keys.includes(sensKey)) { sensKey = keys.includes('elasticity') ? 'elasticity' : keys[0]; cursor = null; }
    const names = SENS_NAME();
    q('[data-tornado]').innerHTML = tornadoChart(tornado(ds, sc).map((t) => ({ ...t, name: names[t.key], lo: SENS_FMT[t.key](t.lo), hi: SENS_FMT[t.key](t.hi) })), r.baseline.profit, sensKey);
    const key = sensKey, [lo, hi] = SENS_RANGE[key];
    const pts = sensitivity(ds, sc, key, Array.from({ length: 31 }, (_, i) => lo + ((hi - lo) * i) / 30));
    const el = q('[data-sens]');
    const be = key === 'elasticity' && (r.breakEven.kind === 'floor' || r.breakEven.kind === 'ceiling') ? r.breakEven.elasticity : null;
    sensitivityCurve(el, pts, { base: r.baseline.profit, current: valueOf(sc, key), breakEven: be, cursor, fmt: SENS_FMT[key], breakLabel: L('price break-even', 'تعادل السعر') });
    const i = cursor ?? pts.reduce((best, p, j) => (Math.abs(p.value - valueOf(sc, key)) < Math.abs(pts[best].value - valueOf(sc, key)) ? j : best), 0);
    const p = pts[i];
    el.setAttribute('aria-label', L(`${names[key]}: scenario gross profit across ${SENS_FMT[key](lo)} to ${SENS_FMT[key](hi)}. Arrow keys move the probe; Enter uses its value.`, `${names[key]}: إجمالي ربح السيناريو عبر ${SENS_FMT[key](lo)} إلى ${SENS_FMT[key](hi)}. مفاتيح الأسهم تحرّك المؤشر؛ وEnter يستخدم قيمته.`));
    el.setAttribute('aria-valuenow', String(i));
    el.setAttribute('aria-valuetext', `${SENS_FMT[key](p.value)}: ${money(p.profit)}`);
    q('[data-sens-read]').innerHTML = `${esc(names[key])} <b>${esc(SENS_FMT[key](p.value))}</b> → <b>${esc(money(p.profit))}</b> <span>(${esc(sm(p.profit - r.baseline.profit))} ${L('vs recorded', 'مقابل المسجَّل')})</span>`;
    q<HTMLButtonElement>('[data-sens-use]').disabled = cursor === null;
    return pts;
  };
  let sensPts: { value: number; profit: number }[] = [];

  const renderCompare = (r: Result) => {
    q('[data-swap]').hidden = !pinned; q('[data-unpin]').hidden = !pinned;
    q('[data-pin]').textContent = pinned ? L('Pin the current scenario as A again', 'تثبيت السيناريو الحالي بوصفه (أ) مجددًا') : L('Pin the current scenario as A', 'تثبيت السيناريو الحالي بوصفه (أ)');
    q('[data-compare]').innerHTML = pinned ? compareTable(ds, simulate(ds, pinned), r)
      : `<p class="cmp-empty">${L('Nothing pinned yet. Pin a scenario, change the levers, and the two appear here measure by measure.', 'لم يُثبَّت شيء بعد. ثبّت سيناريو، وغيّر الروافع، فيظهر الاثنان هنا مقياسًا بمقياس.')}</p>`;
  };

  const writeUrl = () => {
    const qs = new URLSearchParams({ ...toParams(sc), ...(pinned ? { ab: '1', ...toParams(pinned, 'a.') } : {}) }).toString();
    const next = `#/simulator${qs ? `?${qs}` : ''}`;
    if (location.hash !== next) history.replaceState(null, '', next);
  };

  const render = (urgent = false) => {
    const r = simulate(ds, sc);
    const name = STEP_NAME();
    const bars: BridgeBar[] = r.steps.filter((s) => s.key !== 'cost' || sc.supplier.s !== null).map((s) => ({ key: s.key, label: name[s.key], short: STEP_SHORT()[s.key], basis: s.basis, delta: s.delta }));
    bars.push({ key: 'end', label: L('Scenario', 'السيناريو'), basis: 'total', delta: 0 });
    bridge.update(r.baseline.profit, bars);
    countTo(ro('profit'), r.result.profit);
    const d = r.delta;
    set('delta', r.touched ? `${sm(d)} <span>${L('vs recorded', 'مقابل المسجَّل')}</span> <span class="num">(${sp(d / r.baseline.profit, 2)})</span>` : L('Equals the recorded result', 'يساوي النتيجة المسجّلة'));
    q('[data-ro="delta"]').dataset.dir = !r.touched || Math.abs(d) < 0.5 ? 'flat' : d > 0 ? 'up' : 'down';
    set('base', money(r.baseline.profit));
    set('margin', `${pct(r.result.margin)} <small>${r.touched ? sgn((r.result.margin - r.baseline.margin) * 100, (x) => x.toFixed(2)) + L(' pts', ' نقطة') : ''}</small>`);
    set('revenue', money(r.result.revenue));
    // assumption load, and the premises that hold whatever the load
    q('[data-load]').innerHTML = loadGauge(r.load);
    set('load', r.load.total ? pct(r.load.share, 0) : '—');
    set('loadText', !r.load.total
      ? L('No movement on the bridge, so there is no share to measure. That is not the same as having no assumptions: see the list below.', 'لا حركة على الجسر، فلا نصيب يُقاس. وهذا لا يعني انعدام الافتراضات: انظر القائمة أدناه.')
      : r.load.assumed === 0
        ? L(`0% of ${b(money(r.load.total))} total movement rests on a behavioural premise. That does not make the result certain or assumption-free: the premises below still hold.`, `0% من إجمالي حركة قدره ${b(money(r.load.total))} يستند إلى مقدّمة سلوكية. وهذا لا يجعل النتيجة مؤكدة ولا خالية من الافتراضات: فالمقدّمات أدناه ما تزال قائمة.`)
        : L(`${b(money(r.load.assumed))} of ${b(money(r.load.total))} total movement rests on an assumption (Σ|assumed| ÷ Σ|all steps|). A share of the arithmetic, not a confidence level.`, `${b(money(r.load.assumed))} من إجمالي حركة قدره ${b(money(r.load.total))} يستند إلى افتراض (Σ|المفترَض| ÷ Σ|كل الخطوات|). نصيب من الحساب، لا مستوى ثقة.`));
    const pm = PREMISE(ds, sc);
    q('[data-premises]').innerHTML = premises(sc).map((k) => `<li data-premise="${k}">${esc(pm[k])}</li>`).join('');
    // value readouts
    q('#lv-price-out').textContent = sp(sc.price.change);
    q('#lv-e-out').innerHTML = sc.elasticity === 0 ? `0 <span>${L('volume unchanged', 'الكمية ثابتة')}</span>` : ef(sc.elasticity);
    q('#lv-rec-out').textContent = pct(sc.recovery.share, 0);
    q('#lv-shock-out').textContent = sc.supplier.s === null ? '—' : sp(sc.supplier.shock);
    q('#lv-pt-out').textContent = sc.supplier.s === null ? '—' : pct(sc.supplier.passThrough, 0);
    q('#lv-cover-out').innerHTML = sc.inventory.cover === null ? '—' : `${sc.inventory.cover} <span>${L('months', 'شهرًا')}</span>`;
    q('#lv-carry-out').textContent = sc.inventory.carryRate === null ? '—' : pct(sc.inventory.carryRate);
    const ex = exposure.find((x) => x.s === sc.supplier.s);
    set('supExp', ex ? L(`${ex.items} items · cost of sales ${money(ex.cogs)} (${pct(ex.cogs / r.baseline.cogs)} of all) · purchase orders ${money(ex.spend)}`, `${ex.items} صنفًا · تكلفة مبيعات ${money(ex.cogs)} (${pct(ex.cogs / r.baseline.cogs)} من الكل) · أوامر شراء ${money(ex.spend)}`) : L('Choose a supplier to move its costs.', 'اختر موردًا لتحريك تكاليفه.'));
    const now = JSON.stringify(toParams(sc));
    presetBtns.forEach((p) => p.setAttribute('aria-pressed', String(presetKeys.get(p.dataset.preset!) === now)));
    renderLedgers(r);
    // sensitivity, comparison and statements settle after the drag, so the slider stays light
    clearTimeout(claimT);
    const slow = () => {
      sensPts = renderSens(r);
      renderCompare(r);
      q('[data-claims]').innerHTML = statements(ds, r).map(([k, h]) => claim(k, h)).join('');
    };
    if (urgent) slow(); else claimT = window.setTimeout(slow, 220);
    clearTimeout(liveT);
    liveT = window.setTimeout(() => { q('[data-live]').textContent = L(`Scenario gross profit ${money(r.result.profit)}, ${r.touched ? `${sm(d)} versus recorded` : 'equal to recorded'}. Assumption load ${r.load.total ? pct(r.load.share, 0) : 'not applicable'}.`, `إجمالي ربح السيناريو ${money(r.result.profit)}، ${r.touched ? `${sm(d)} مقابل المسجَّل` : 'يساوي المسجَّل'}. حمولة الافتراض ${r.load.total ? pct(r.load.share, 0) : 'لا تنطبق'}.`); }, 700);
    clearTimeout(urlT);
    urlT = window.setTimeout(writeUrl, 250);
    // the instrument turns a little with the result: up to ±0.35 rad for a ±10% profit change
    if (!motion.still && typeof rig.azim === 'number') direct({ azim: rig.azim + Math.max(-0.35, Math.min(0.35, (d / r.baseline.profit) * 3.5)) });
  };

  toControls();
  shown = simulate(ds, sc).result.profit;
  render(true);
  const levers = q('.levers');
  levers.addEventListener('submit', (e) => e.preventDefault());
  levers.addEventListener('input', () => { fromControls(); render(); });
  // ranges already render on input; change covers radios, selects and checkboxes
  levers.addEventListener('change', (e) => { if ((e.target as HTMLInputElement).type === 'range') return; fromControls(); render(); });
  q('.sim-presets').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-preset]');
    if (!btn) return;
    sc = normalise(PRESETS().find((p) => p.id === btn.dataset.preset)!.sc(ds));
    toControls(); render(true);
  });
  // sensitivity: choose an assumption on the tornado (radio pattern), probe the curve, apply a value
  q('[data-tornado]').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.tn-row');
    if (!btn || btn.dataset.key === sensKey) return;
    sensKey = btn.dataset.key as SensKey; cursor = null;
    sensPts = renderSens(simulate(ds, sc));
    q<HTMLButtonElement>(`.tn-row[data-key="${sensKey}"]`).focus();
  });
  q('[data-tornado]').addEventListener('keydown', (e) => {
    const rows = [...root.querySelectorAll<HTMLButtonElement>('.tn-row')];
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const j = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? (i + 1) % rows.length : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? (i - 1 + rows.length) % rows.length : -1;
    if (j < 0) return;
    e.preventDefault();
    rows[j].click();
  });
  const sens = q('[data-sens]');
  const probe = (i: number) => { cursor = Math.max(0, Math.min(sensPts.length - 1, i)); sensPts = renderSens(simulate(ds, sc)); };
  sens.addEventListener('keydown', (e) => {
    const n = sensPts.length - 1, at = cursor ?? Math.round(n * ((valueOf(sc, sensKey!) - SENS_RANGE[sensKey!][0]) / (SENS_RANGE[sensKey!][1] - SENS_RANGE[sensKey!][0])));
    const map: Record<string, number> = { ArrowRight: at + 1, ArrowUp: at + 1, ArrowLeft: at - 1, ArrowDown: at - 1, Home: 0, End: n, PageUp: at + 5, PageDown: at - 5 };
    if (e.key in map) { e.preventDefault(); probe(map[e.key]); }
    else if (e.key === 'Enter' && cursor !== null) { e.preventDefault(); q<HTMLButtonElement>('[data-sens-use]').click(); }
  });
  sens.addEventListener('pointermove', (e) => {
    const box = sens.getBoundingClientRect(), t = (e.clientX - box.left - 30) / Math.max(1, box.width - 60);
    probe(Math.round(Math.max(0, Math.min(1, t)) * (sensPts.length - 1)));
  });
  q('[data-sens-use]').addEventListener('click', () => {
    if (cursor === null || !sensKey) return;
    const v = sensPts[cursor].value;
    sc = normalise(withValue(sc, sensKey, sensKey === 'elasticity' ? Math.round(v * 20) / 20 : Math.round(v * 200) / 200));
    cursor = null; toControls(); render(true);
  });
  // A/B
  q('[data-pin]').addEventListener('click', () => { pinned = structuredClone(sc); q('[data-cmp-note]').textContent = L('Pinned as A. The console is now B.', 'ثُبّت بوصفه (أ). واللوحة الآن (ب).'); render(true); });
  q('[data-swap]').addEventListener('click', () => { if (!pinned) return; [pinned, sc] = [sc, pinned]; toControls(); render(true); q('[data-cmp-note]').textContent = L('Swapped: the console now holds the former A.', 'تم التبديل: تحمل اللوحة الآن (أ) السابق.'); });
  q('[data-unpin]').addEventListener('click', () => { pinned = null; q('[data-cmp-note]').textContent = L('A cleared.', 'أُلغي (أ).'); render(true); q<HTMLButtonElement>('[data-pin]').focus(); });
  // a hand-edited hash on the same route re-reads both scenarios (the router does not remount on query changes)
  const onHash = () => {
    if (!location.hash.startsWith('#/simulator')) return;
    const h = hashParams(), next = fitTo(ds, fromParams((k) => h.get(k))), nextA = h.has('ab') ? fitTo(ds, fromParams((k) => h.get(k), 'a.')) : null;
    const changed = !same(next, sc) || (nextA === null) !== (pinned === null) || (nextA && pinned && !same(nextA, pinned));
    if (changed) { sc = next; pinned = nextA; toControls(); render(true); }
  };
  window.addEventListener('hashchange', onHash);
  cleanup.push(() => window.removeEventListener('hashchange', onHash));
  q('[data-copy]').addEventListener('click', async () => {
    writeUrl();
    const note = q('[data-copied]');
    try { await navigator.clipboard.writeText(location.href); note.textContent = L('Link copied. It holds only the levers (and A, if pinned), nothing else.', 'نُسخ الرابط. ويحمل الروافع فقط (و(أ) إن ثُبّت)، لا شيء غيرها.'); }
    catch { note.textContent = L('Copy the address bar: it holds this scenario.', 'انسخ شريط العنوان: فهو يحمل هذا السيناريو.'); }
  });
}

const page: Page & { cleanup: (() => void)[] } = {
  cleanup: [],
  async mount(root) {
    root.innerHTML = `<div class="sim page-pad">${loadingState()}</div>`;
    const result = await getDataset();
    const ds = result.state === 'ready' ? result.dataset : null;
    const intro = pageHeader('sim', L('Decision Simulator', 'محاكي القرار'),
      L('Move a lever and watch the recorded gross profit re-balance. Every result is a scenario: arithmetic on what was recorded, under assumptions you can see and change.', 'حرّك رافعة وشاهد إجمالي الربح المسجَّل يعيد توازنه. كل نتيجة هنا سيناريو: حساب على ما سُجّل، بافتراضات تراها وتغيّرها.'),
      `<div class="lab-key" aria-label="${L('How to read the statements', 'كيف تُقرأ العبارات')}">
        ${(['finding', 'calc', 'hypothesis'] as Kind[]).map((k) => `<span class="key key-${k}"><span aria-hidden="true" class="claim-mark"></span>${KIND()[k]}</span>`).join('')}
        <span class="key-status">${statusBadge('unverified', L('Scenario tool · not reviewed by the team', 'أداة سيناريوهات · لم يراجعها الفريق'))}</span>
      </div>`);
    root.innerHTML = `
    <div class="sim page-pad">
      ${intro}
      ${ds ? `${consoleMarkup(ds)}${ledgersMarkup(ds)}${sensMarkup()}${compareMarkup()}${framesMarkup()}${methodMarkup()}` : result.state !== 'ready' ? `<div class="section">${dataStatePanel(result, '/simulator')}</div>` : ''}
      ${nextChapter('sim', L('How the data was profiled, cleaned, modelled and reconciled.', 'كيف حُلّلت البيانات ونُظّفت ونُمذجت وطوبقت.'))}
      ${siteFooter()}
    </div>`;
    const sim = root.querySelector<HTMLElement>('.sim')!;
    this.cleanup.push(revealOnScroll(root));
    if (!ds) return;
    wire(root, ds, this.cleanup);
    sim.classList.toggle('still', motion.still);
    this.cleanup.push(motion.subscribe(() => sim.classList.toggle('still', motion.still)));
  },
  unmount() { this.cleanup.splice(0).forEach((f) => f()); },
};
export default page;
