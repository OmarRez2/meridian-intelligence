import '../styles/hub.css';
import '../styles/lab.css';
import type { Page } from '../lib/router';
import { pageHeader, nextChapter, siteFooter, statusBadge } from '../components/shell';
import { revealOnScroll } from '../components/tabs';
import { getDataset } from '../data/adapter';
import { abcMatrix, leakage, lossAnatomy, supplierDependence, stockCapital, customerSpread, forecastCheck, FORECAST_MODELS, FORECAST_HORIZONS, ABC_THRESHOLDS, HHI_HIGH, type ForecastModel, type AbcBasis, type AbcClass } from '../data/lab';
import type { SupplyChainDataset } from '../data/types';
import { esc } from '../lib/format';
import { motion } from '../lib/motion';
import { BarList, Strip, tip } from '../charts/kit';
import { ProfitMap, DripChart, PulseStrip, CoverHistogram, supplierRing, paretoCurve, BacktestChart, type MapPoint } from '../charts/lab';
import { dataStatePanel, loadingState } from '../components/datastate';
import { L, famName, supplierGroup, pct, money, int, fmtDate, monthShort } from '../i18n';

/**
 * Analytics Lab (#/lab). Each instrument asks one question and answers it in four labelled kinds of statement:
 *   Finding        what the data shows, computed from the selected dataset
 *   Calculation    arithmetic on the finding (an estimate or a sensitivity), with its assumption stated
 *   Hypothesis     a plausible explanation the dataset cannot test
 *   Recommendation an action for the business, pending the team's review
 * Every number comes from src/data/lab.ts at render time; nothing here is hard-coded.
 */
type Kind = 'finding' | 'calc' | 'hypothesis' | 'rec';
const KIND = (): Record<Kind, string> => ({
  finding: L('Finding', 'نتيجة'), calc: L('Calculation', 'حساب'),
  hypothesis: L('Hypothesis', 'فرضية'), rec: L('Recommendation', 'توصية'),
});
const claim = (k: Kind, html: string) => `<li class="claim claim-${k}"><p class="claim-kind"><span aria-hidden="true" class="claim-mark"></span>${KIND()[k]}</p><p class="claim-text">${html}</p></li>`;
const claims = (items: [Kind, string][], label: string) => `<ul class="claims" aria-label="${esc(label)}">${items.map(([k, h]) => claim(k, h)).join('')}</ul>`;
const b = (s: string) => `<b class="num">${s}</b>`;
/** a share that rounds to 100% but is not 100% keeps two decimals, so the page never claims "all" */
const share = (v: number) => (v >= 0.9995 && v < 1 ? pct(v, 2) : pct(v));
/** source names are English; isolate them so punctuation stays put inside Arabic text */
const nm = (s: string) => `<bdi>${esc(s)}</bdi>`;

/* ================================================================== instrument 1: profit map */
function abcClaims(ds: SupplyChainDataset, basis: AbcBasis) {
  const r = abcMatrix(ds, basis);
  const [A] = r.classes;
  const rows = r.rows;
  const totalProfit = rows.reduce((s, x) => s + x.profit, 0);
  const aHigh = rows.filter((x) => x.cls === 'A' && x.highMargin), aLow = rows.filter((x) => x.cls === 'A' && !x.highMargin);
  const cLow = rows.filter((x) => x.cls === 'C' && !x.highMargin);
  const totalRev = rows.reduce((s, x) => s + x.revenue, 0);
  const sum = (a: typeof rows, k: 'revenue' | 'profit') => a.reduce((s, x) => s + x[k], 0);
  const p = r.pareto.share;
  const strength = p >= 0.8 ? L('strong', 'قوي') : p >= 0.6 ? L('moderate', 'متوسط') : L('mild', 'محدود');
  const what = basis === 'revenue' ? L('revenue', 'الإيرادات') : L('recorded profit', 'الربح المسجَّل');
  return claims([
    ['finding', L(
      `${b(int(A.items))} items (${pct(A.itemShare)} of the range) earn ${b(pct(A.valueShare))} of ${what}; the top 20% earn ${b(pct(p))}. That is ${strength} concentration, not an extreme Pareto.`,
      `${b(int(A.items))} صنفًا (${pct(A.itemShare)} من التشكيلة) تحقق ${b(pct(A.valueShare))} من ${what}، وأعلى 20٪ تحقق ${b(pct(p))}. أي تركّز ${strength}، لا باريتو حادّ.`)],
    ['finding', L(
      `${b(int(aLow.length))} of the ${int(A.items)} class-A items earn a margin below the item median of ${pct(r.marginCut)}. The ${int(aHigh.length)} high-margin A items carry ${b(pct(sum(aHigh, 'profit') / (totalProfit || 1)))} of all recorded profit.`,
      `${b(int(aLow.length))} من أصناف الفئة A البالغة ${int(A.items)} هامشها أقل من وسيط الأصناف ${pct(r.marginCut)}. وتحمل أصناف A عالية الهامش (${int(aHigh.length)}) ${b(pct(sum(aHigh, 'profit') / (totalProfit || 1)))} من إجمالي الربح المسجَّل.`)],
    ['calc', L(
      `One percentage point of margin on the low-margin A items is worth ${b(money(sum(aLow, 'revenue') * 0.01))} over the period, assuming the same volume.`,
      `نقطة مئوية واحدة من الهامش على أصناف A منخفضة الهامش تساوي ${b(money(sum(aLow, 'revenue') * 0.01))} خلال الفترة، بافتراض ثبات الكميات.`)],
    ['hypothesis', L(
      'Low-margin A items may be priced for volume or carry higher recorded costs. The dataset holds recorded profit only, so it cannot separate price from cost.',
      'قد تكون أصناف A منخفضة الهامش مسعّرة لتحقيق الحجم، أو تحمل تكاليف مسجّلة أعلى. البيانات تتضمن الربح المسجَّل فقط، فلا يمكنها الفصل بين السعر والتكلفة.')],
    ['rec', L(
      `Protect availability of the high-margin A items; review price and cost on the ${int(aLow.length)} low-margin A items; consider whether the ${int(cLow.length)} low-margin C items (${pct(sum(cLow, 'revenue') / (totalRev || 1))} of revenue) earn their place in the range.`,
      `حماية توافر أصناف A عالية الهامش؛ ومراجعة السعر والتكلفة لأصناف A منخفضة الهامش (${int(aLow.length)})؛ والنظر في جدوى إبقاء أصناف C منخفضة الهامش (${int(cLow.length)}، ${pct(sum(cLow, 'revenue') / (totalRev || 1))} من الإيرادات) في التشكيلة.`)],
  ], L('Profit map statements', 'عبارات خريطة الربحية'));
}

function abcSection(ds: SupplyChainDataset) {
  const cov = `${fmtDate(ds.provenance.coverage.from)} – ${fmtDate(ds.provenance.coverage.to)}`;
  return `
  <section class="section lab-inst" id="lab-abc" aria-labelledby="lab-abc-h">
    <header class="inst-head" data-reveal>
      <p class="inst-num num" aria-hidden="true">01</p>
      <div>
        <p class="inst-kicker">${L('Instrument 01 · Profitability', 'الأداة 01 · الربحية')}</p>
        <h2 class="sec-title" id="lab-abc-h">${L('Which items carry the business?', 'أي الأصناف تحمل النشاط؟')}</h2>
        <p class="sec-note">${L('Every stock item is a star: how much it sells along the horizon, how much of each sale it keeps going up. The bright band is class A.', 'كل صنف نجم: حجم مبيعاته على الأفق، ونسبة ما يحتفظ به من كل بيع صعودًا. الشريط المضيء هو الفئة A.')}</p>
      </div>
      <div class="seg lab-basis" role="radiogroup" aria-label="${L('Rank items by', 'ترتيب الأصناف حسب')}">
        <button type="button" role="radio" data-basis="revenue" aria-checked="true">${L('By revenue', 'حسب الإيرادات')}</button>
        <button type="button" role="radio" data-basis="profit" aria-checked="false" tabindex="-1">${L('By profit', 'حسب الربح')}</button>
      </div>
    </header>
    <div class="inst-body">
      <figure class="inst-figure panel-frame" data-reveal>
        <div class="lab-map-host"></div>
        <figcaption class="inst-legend">
          <span><i class="lg lg-a"></i>A</span><span><i class="lg lg-b"></i>B</span><span><i class="lg lg-c"></i>C</span>
          <span><i class="lg lg-loss"></i>${L('has loss-making lines', 'له أسطر خاسرة')}</span>
        </figcaption>
      </figure>
      <aside class="inst-side" data-reveal>
        <div class="readout-card" aria-live="polite"><p class="rc-empty">${L('Hover or focus a star to read the item.', 'مرّر المؤشر فوق نجم أو انتقل إليه لقراءة الصنف.')}</p></div>
        <div class="quad" role="group" aria-label="${L('Filter the map by class and margin', 'تصفية الخريطة حسب الفئة والهامش')}"></div>
        <div class="pareto-host"></div>
      </aside>
    </div>
    <div class="abc-claims" data-reveal></div>
    <details class="lab-method">
      <summary>${L('Method, thresholds and limits', 'المنهجية والحدود')}</summary>
      <dl>
        <div><dt>${L('Ranking', 'الترتيب')}</dt><dd>${L(`Items ranked by lifetime revenue (invoice lines, net of tax) or recorded profit, ${cov}.`, `تُرتَّب الأصناف حسب إيراداتها الإجمالية (أسطر الفواتير، دون الضريبة) أو الربح المسجَّل، ${cov}.`)}</dd></div>
        <div><dt>${L('Classes', 'الفئات')}</dt><dd>${L(`Running share including the item itself: A up to ${pct(ABC_THRESHOLDS.a, 0)}, B up to ${pct(ABC_THRESHOLDS.b, 0)}, C the rest. On the profit basis, items with zero or negative total profit are always C and sit in the left gutter.`, `الحصة التراكمية شاملةً الصنف نفسه: A حتى ${pct(ABC_THRESHOLDS.a, 0)}، وB حتى ${pct(ABC_THRESHOLDS.b, 0)}، وC الباقي. وعند الترتيب بالربح، تُصنَّف الأصناف ذات الربح الإجمالي الصفري أو السالب ضمن C دائمًا وتظهر في الهامش الأيسر.`)}</dd></div>
        <div><dt>${L('Margin', 'الهامش')}</dt><dd>${L('Recorded profit ÷ revenue per item, split at the median of the items that sold.', 'الربح المسجَّل ÷ الإيرادات لكل صنف، ويُقسَم عند وسيط الأصناف التي بيعت.')}</dd></div>
        <div><dt>${L('Limits', 'الحدود')}</dt><dd>${L('Recorded profit from the source invoices: no freight, handling or landed cost. Lifetime totals hide changes over time. Wide World Importers is a simulated Microsoft sample, so patterns describe the sample.', 'الربح المسجَّل من فواتير المصدر: دون تكاليف الشحن أو المناولة أو التكلفة الكاملة. والإجماليات تخفي التغيرات عبر الزمن. وWide World Importers عيّنة محاكاة من Microsoft، فالأنماط تصف العيّنة.')}</dd></div>
      </dl>
    </details>
  </section>`;
}

function wireAbc(root: HTMLElement, ds: SupplyChainDataset, cleanup: (() => void)[]) {
  const host = root.querySelector<HTMLElement>('.lab-map-host')!;
  const card = root.querySelector<HTMLElement>('.readout-card')!;
  const quad = root.querySelector<HTMLElement>('.quad')!;
  const fam = (c: number) => famName(ds.categories[c] ?? '');
  let basis: AbcBasis = 'revenue';
  let filter: { cls: AbcClass; high: boolean } | null = null;
  const showCard = (p: MapPoint | null) => {
    if (!p) return;
    card.innerHTML = `
      <p class="rc-kicker"><span class="rc-cls cls-${p.cls}">${p.cls}</span> ${esc(p.family)}</p>
      <p class="rc-name">${nm(p.label)}</p>
      <dl class="rc-fields">${p.detail.split(' · ').map((f) => { const [k, ...v] = f.split(': '); return `<div><dt>${esc(k)}</dt><dd class="num">${esc(v.join(': '))}</dd></div>`; }).join('')}</dl>`;
  };
  const map = new ProfitMap(host, showCard);
  cleanup.push(() => map.destroy());

  const render = () => {
    const r = abcMatrix(ds, basis);
    const valueOf = (x: (typeof r.rows)[number]) => Math.max(0, basis === 'revenue' ? x.revenue : x.profit);
    const lastA = [...r.rows].reverse().find((x) => x.cls === 'A' && valueOf(x) > 0);
    const firstB = r.rows.find((x) => x.cls === 'B'), lastB = [...r.rows].reverse().find((x) => x.cls === 'B');
    const firstC = r.rows.find((x) => x.cls === 'C' && valueOf(x) > 0);
    const mid = (a?: (typeof r.rows)[number], c?: (typeof r.rows)[number]) => (a && c ? Math.sqrt(valueOf(a) * Math.max(valueOf(c), 1)) : null);
    const pts: MapPoint[] = r.rows.map((x) => ({
      id: x.id, label: x.label, family: fam(x.c), cls: x.cls, value: valueOf(x), margin: x.margin, highMargin: x.highMargin,
      negative: x.negative, lossLines: x.lossLines,
      detail: [
        `${L('Revenue', 'الإيرادات')}: ${money(x.revenue)}`, `${L('Profit', 'الربح')}: ${money(x.profit)}`,
        `${L('Margin', 'الهامش')}: ${x.margin === null ? '—' : pct(x.margin)}`, `${L('Rank', 'الترتيب')}: ${int(x.rank + 1)}`,
        ...(x.lossLines ? [`${L('Loss-making lines', 'أسطر خاسرة')}: ${int(x.lossLines)}`] : []),
      ].join(' · '),
    }));
    map.update(pts, { ab: mid(lastA, firstB), bc: mid(lastB, firstC), cut: r.marginCut, basis: basis === 'revenue' ? L('Lifetime revenue', 'الإيرادات الإجمالية') : L('Lifetime recorded profit', 'الربح المسجَّل الإجمالي') });
    // class x margin matrix (filters the map)
    const cell = (cls: AbcClass, high: boolean) => {
      const c = r.rows.filter((x) => x.cls === cls && x.highMargin === high);
      const on = filter?.cls === cls && filter.high === high;
      return `<button type="button" class="q-cell${on ? ' on' : ''}" data-cls="${cls}" data-high="${high}" aria-pressed="${on}"><span class="q-n num">${int(c.length)}</span><span class="q-s num">${pct(c.reduce((s, x) => s + valueOf(x), 0) / (r.total || 1), 0)}</span><span class="sr-only">${L(`class ${cls}, ${high ? 'high' : 'low'} margin: ${c.length} items`, `الفئة ${cls}، هامش ${high ? 'مرتفع' : 'منخفض'}: ${int(c.length)} صنف`)}</span></button>`;
    };
    quad.innerHTML = `
      <p class="q-title">${L('Items by class and margin', 'الأصناف حسب الفئة والهامش')} <span>${L('count · share of value', 'العدد · حصة القيمة')}</span></p>
      <div class="q-grid">
        <span></span><span class="q-h">A</span><span class="q-h">B</span><span class="q-h">C</span>
        <span class="q-r">${L('High margin', 'هامش مرتفع')}</span>${cell('A', true)}${cell('B', true)}${cell('C', true)}
        <span class="q-r">${L('Low margin', 'هامش منخفض')}</span>${cell('A', false)}${cell('B', false)}${cell('C', false)}
      </div>`;
    paretoCurve(root.querySelector<HTMLElement>('.pareto-host')!, r.rows.map((x) => x.cum), r.thresholds, r.pareto.share);
    root.querySelector<HTMLElement>('.abc-claims')!.innerHTML = abcClaims(ds, basis);
    map.setFilter(filter);
  };
  render();

  quad.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.q-cell');
    if (!btn) return;
    const next = { cls: btn.dataset.cls as AbcClass, high: btn.dataset.high === 'true' };
    filter = filter && filter.cls === next.cls && filter.high === next.high ? null : next;
    quad.querySelectorAll<HTMLButtonElement>('.q-cell').forEach((c) => { const on = !!filter && c.dataset.cls === filter.cls && c.dataset.high === String(filter.high); c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); });
    map.setFilter(filter);
  });

  // basis radiogroup (arrow keys move and select, as a radio group should)
  const group = root.querySelector<HTMLElement>('.lab-basis')!;
  const radios = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  const select = (btn: HTMLButtonElement, focus = false) => {
    radios.forEach((r) => { const on = r === btn; r.setAttribute('aria-checked', String(on)); r.tabIndex = on ? 0 : -1; });
    if (focus) btn.focus();
    if (btn.dataset.basis !== basis) { basis = btn.dataset.basis as AbcBasis; tip(null); render(); }
  };
  group.addEventListener('click', (e) => { const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[role="radio"]'); if (btn) select(btn); });
  group.addEventListener('keydown', (e) => {
    const i = radios.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0 || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    select(radios[(i + 1) % radios.length], true);
  });
}

/* ================================================================== instrument 3: fulfilment leakage */
function leakSection(ds: SupplyChainDataset) {
  const r = leakage(ds);
  const before = 1 - r.tail.unmetShare;
  const spread = r.tail.ratio <= 1.5 && r.tail.ratio >= 0.67;
  const monthsIn = (y: number) => ds.months.filter((m) => m.y === y);
  const span = (y: number) => { const ms = monthsIn(y); return ms.length === 12 ? '' : ` <span class="partial">${monthShort(ms[0].m)}–${monthShort(ms[ms.length - 1].m)}</span>`; };
  const items = r.items.slice(0, 6);
  // trend across complete years only (a partial year is not comparable)
  const full = r.years.filter((y) => y.complete && y.ordered > 0);
  const rising = full.length >= 2 && full.every((y, i) => i === 0 || y.rate > full[i - 1].rate);
  const trend = rising ? L(
    ` The share rose every complete year, from ${b(pct(full[0].rate))} in ${full[0].year} to ${b(pct(full[full.length - 1].rate))} in ${full[full.length - 1].year}.`,
    ` وارتفعت النسبة في كل سنة كاملة، من ${b(pct(full[0].rate))} في ${full[0].year} إلى ${b(pct(full[full.length - 1].rate))} في ${full[full.length - 1].year}.`) : '';
  return `
  <section class="section lab-inst" id="lab-leak" aria-labelledby="lab-leak-h">
    <header class="inst-head" data-reveal>
      <p class="inst-num num" aria-hidden="true">03</p>
      <div>
        <p class="inst-kicker">${L('Instrument 03 · Fulfilment', 'الأداة 03 · التنفيذ')}</p>
        <h2 class="sec-title" id="lab-leak-h">${L('Where does demand leak away?', 'أين يتسرّب الطلب؟')}</h2>
        <p class="sec-note">${L('Above the line, the stream of units ordered each month. Below it, the share that was never picked, hanging like drips. If the shortfall were only orders still open when the data ends, the drips would gather in the shaded window.', 'فوق الخط، تدفق الوحدات المطلوبة كل شهر. وتحته، نسبة ما لم يُجهَّز معلّقةً كالقطرات. لو كان العجز مجرد طلبات ما زالت مفتوحة عند نهاية البيانات، لتجمّعت القطرات في النافذة المظلَّلة.')}</p>
      </div>
    </header>
    <div class="inst-body">
      <figure class="inst-figure panel-frame" data-reveal><div class="lab-drip-host"></div>
        <figcaption class="inst-legend"><span><i class="lg lg-ordered"></i>${L('Units ordered (upper panel)', 'الوحدات المطلوبة (اللوحة العليا)')}</span><span><i class="lg lg-drip"></i>${L('Share never picked (lower panel)', 'نسبة ما لم يُجهَّز (اللوحة السفلى)')}</span><span><i class="lg lg-tail"></i>${L('Final months of the extract', 'الأشهر الأخيرة من البيانات')}</span></figcaption></figure>
      <aside class="inst-side" data-reveal>
        <div class="leak-total">
          <p class="lt-label">${L('Unpicked demand at list price', 'الطلب غير المُجهَّز بسعر القائمة')}</p>
          <p class="lt-value num">${money(r.unpickedValue)}</p>
          <p class="lt-note">${L(`${int(r.unmet)} units · an estimate of unfilled demand, not confirmed lost revenue`, `${int(r.unmet)} وحدة · تقدير للطلب غير المُلبّى، لا إيراد مفقود مؤكد`)}</p>
        </div>
        <div class="timing">
          <p class="q-title">${L(`The last ${r.tail.months} months hold…`, `الأشهر ${int(r.tail.months)} الأخيرة تضم…`)}</p>
          <div class="tm-row"><span>${L('of all units ordered', 'من كل الوحدات المطلوبة')}</span><span class="tm-bar"><i style="width:${(r.tail.orderedShare * 100).toFixed(1)}%"></i></span><b class="num">${pct(r.tail.orderedShare)}</b></div>
          <div class="tm-row risk"><span>${L('of all units never picked', 'من كل الوحدات غير المُجهَّزة')}</span><span class="tm-bar"><i style="width:${(r.tail.unmetShare * 100).toFixed(1)}%"></i></span><b class="num">${pct(r.tail.unmetShare)}</b></div>
          <p class="tm-ratio">${L(`Ratio ×${r.tail.ratio.toFixed(2)}`, `النسبة ×${r.tail.ratio.toFixed(2)}`)}</p>
        </div>
        <table class="ledger">
          <caption class="sr-only">${L('Shortfall by year', 'العجز حسب السنة')}</caption>
          <thead><tr><th scope="col">${L('Year', 'السنة')}</th><th scope="col">${L('Never picked', 'غير مُجهَّز')}</th><th scope="col">${L('Share', 'النسبة')}</th><th scope="col">${L('Backorders', 'طلبات مؤجلة')}</th></tr></thead>
          <tbody>${r.years.map((y) => `<tr data-year="${y.year}"><th scope="row">${y.year}${span(y.year)}</th><td class="num">${int(y.unmet)}</td><td class="num">${pct(y.rate)}</td><td class="num">${pct(y.backorderRate)}</td></tr>`).join('')}</tbody>
        </table>
      </aside>
    </div>
    <div class="leak-detail" data-reveal>
      <div>
        <h3 class="sub-title">${L('Unpicked value by product family', 'القيمة غير المُجهَّزة حسب عائلة المنتجات')}</h3>
        <div class="leak-fams"></div>
      </div>
      <div>
        <h3 class="sub-title">${L('Items with the most unpicked value', 'الأصناف الأعلى في القيمة غير المُجهَّزة')}</h3>
        <ol class="leak-items">${items.map((i) => `<li><span class="li-name">${nm(i.label)}</span><span class="li-v num">${money(i.value)}</span><span class="li-n num">${L(`${int(i.unmet)} units · ${pct(i.rate)} of ordered`, `${int(i.unmet)} وحدة · ${pct(i.rate)} من المطلوب`)}</span></li>`).join('')}</ol>
      </div>
    </div>
    ${claims([
      ['finding', L(
        `${b(int(r.unmet))} ordered units (${b(pct(r.rate))}) were never picked, and the shortfall appears in ${b(int(r.yearsWithShortfall))} of ${int(r.years.length)} years.${trend} ${int(r.backorders)} of ${int(r.orders)} orders (${pct(r.backorderRate)}) spawned a backorder.`,
        `${b(int(r.unmet))} وحدة مطلوبة (${b(pct(r.rate))}) لم تُجهَّز قط، ويظهر العجز في ${b(int(r.yearsWithShortfall))} من ${int(r.years.length)} سنوات.${trend} و${int(r.backorders)} من ${int(r.orders)} طلبًا (${pct(r.backorderRate)}) نتج عنها طلب مؤجل.`)],
      ['finding', spread
        ? L(`The last ${r.tail.months} months hold ${b(pct(r.tail.unmetShare))} of the shortfall against ${pct(r.tail.orderedShare)} of orders (×${r.tail.ratio.toFixed(2)}). Part of it is orders still open when the data ends, but ${b(pct(before))} is older.`, `تضم الأشهر ${int(r.tail.months)} الأخيرة ${b(pct(r.tail.unmetShare))} من العجز مقابل ${pct(r.tail.orderedShare)} من الطلبات (×${r.tail.ratio.toFixed(2)}). جزء منه طلبات ما زالت مفتوحة عند نهاية البيانات، لكن ${b(pct(before))} أقدم من ذلك.`)
        : L(`The last ${r.tail.months} months hold ${b(pct(r.tail.unmetShare))} of the shortfall against ${pct(r.tail.orderedShare)} of orders (×${r.tail.ratio.toFixed(2)}).`, `تضم الأشهر ${int(r.tail.months)} الأخيرة ${b(pct(r.tail.unmetShare))} من العجز مقابل ${pct(r.tail.orderedShare)} من الطلبات (×${r.tail.ratio.toFixed(2)}).`)],
      ['calc', L(
        `Priced at each item’s list price, the unpicked units are worth ${b(money(r.unpickedValue))}. Whether customers re-ordered, accepted a substitute or went elsewhere is not in the data, so this is not lost revenue.`,
        `بسعر القائمة لكل صنف، تبلغ قيمة الوحدات غير المُجهَّزة ${b(money(r.unpickedValue))}. ولا تبيّن البيانات إن كان العملاء أعادوا الطلب أو قبلوا بديلًا أو اتجهوا إلى مورد آخر، لذا فهي ليست إيرادًا مفقودًا.`)],
      ['hypothesis', L(
        'Old backorder lines that were never picked may be records nobody closed rather than live demand. Telling the two apart needs the order-status history, which the exports do not hold.',
        'قد تكون أسطر الطلبات المؤجلة القديمة التي لم تُجهَّز سجلات لم يُغلقها أحد، لا طلبًا قائمًا. والتمييز بينهما يحتاج إلى سجل حالة الطلبات، وهو غير موجود في المستخرجات.')],
      ['rec', L(
        'Review the oldest unpicked backorder lines with operations: close or re-promise them, and report the fill rate both with and without them so the KPI reflects live demand.',
        'مراجعة أقدم أسطر الطلبات المؤجلة غير المُجهَّزة مع فريق العمليات: إغلاقها أو تحديد موعد جديد لها، وعرض معدل التنفيذ بها ودونها ليعكس المؤشر الطلب القائم.')],
    ], L('Fulfilment leakage statements', 'عبارات تسرّب التنفيذ'))}
    <details class="lab-method">
      <summary>${L('Method, thresholds and limits', 'المنهجية والحدود')}</summary>
      <dl>
        <div><dt>${L('Never picked', 'غير مُجهَّز')}</dt><dd>${L('Units ordered minus units picked, per order line, counted in the order month. Share = never picked ÷ ordered.', 'الوحدات المطلوبة ناقص الوحدات المُجهَّزة لكل سطر طلب، في شهر الطلب. النسبة = غير المُجهَّز ÷ المطلوب.')}</dd></div>
        <div><dt>${L('Timing test', 'اختبار التوقيت')}</dt><dd>${L(`Share of the shortfall in the last ${r.tail.months} months ÷ share of ordered units in the same months. Near 1: spread like demand. Well above 1: an end-of-extract effect.`, `حصة العجز في آخر ${int(r.tail.months)} أشهر ÷ حصة الوحدات المطلوبة في الأشهر نفسها. قرب 1: موزّع كالطلب. أعلى بوضوح من 1: أثر نهاية البيانات.`)}</dd></div>
        <div><dt>${L('Value', 'القيمة')}</dt><dd>${L('Never-picked units × the item’s current list price. An estimate: list price, not the order’s price or discount.', 'الوحدات غير المُجهَّزة × سعر القائمة الحالي للصنف. تقدير: سعر القائمة لا سعر الطلب أو خصمه.')}</dd></div>
        <div><dt>${L('Backorder', 'الطلب المؤجل')}</dt><dd>${L('An order that spawned a follow-up order for what could not be picked.', 'طلب نتج عنه طلب لاحق لما تعذّر تجهيزه.')}</dd></div>
        <div><dt>${L('Limits', 'الحدود')}</dt><dd>${L('No order-status or cancellation history in the exports. The last year is partial. Simulated Microsoft sample data.', 'لا يوجد في المستخرجات سجل لحالة الطلبات أو إلغائها. والسنة الأخيرة جزئية. بيانات عيّنة محاكاة من Microsoft.')}</dd></div>
      </dl>
    </details>
  </section>`;
}

function wireLeak(root: HTMLElement, ds: SupplyChainDataset, cleanup: (() => void)[]) {
  const r = leakage(ds);
  const ledger = root.querySelector<HTMLElement>('.ledger')!;
  const drip = new DripChart(root.querySelector<HTMLElement>('.lab-drip-host')!, (i) => {
    const y = i === null ? null : r.months[i].y;
    ledger.querySelectorAll('tr[data-year]').forEach((tr) => tr.classList.toggle('on', String(y) === (tr as HTMLElement).dataset.year));
  });
  drip.update(r.months, r.tail.months, r.rate);
  cleanup.push(() => drip.destroy());
  const fams = new BarList(root.querySelector<HTMLElement>('.leak-fams')!, { color: 'var(--ember)', format: money, limit: 8 });
  fams.update(r.families.filter((f) => f.value > 0).map((f) => ({ key: f.c, label: famName(f.label), value: f.value, note: `· ${pct(f.rate)}` })), null);
}

/* ================================================================== shared section frame */
const instHead = (n: string, id: string, kicker: string, title: string, note: string, extra = '') => `
    <header class="inst-head" data-reveal>
      <p class="inst-num num" aria-hidden="true">${n}</p>
      <div>
        <p class="inst-kicker">${kicker}</p>
        <h2 class="sec-title" id="${id}-h">${title}</h2>
        <p class="sec-note">${note}</p>
      </div>
      ${extra}
    </header>`;
const method = (rows: [string, string][]) => `
    <details class="lab-method">
      <summary>${L('Method, thresholds and limits', 'المنهجية والحدود')}</summary>
      <dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    </details>`;

/* ================================================================== instrument 2: loss-line anatomy */
function lossSection(ds: SupplyChainDataset) {
  const r = lossAnatomy(ds);
  const [st, sp] = r.patterns;
  const top = Math.max(1, ...r.rows.map((x) => x.lines));
  const pairs = [...new Map(r.rows.filter((x) => x.belowCost).map((x) => [`${x.unitPrice}|${x.unitCost}`, x])).values()];
  const group = (p: typeof st, title: string, note: string) => {
    const rows = r.rows.filter((x) => x.pattern === p.pattern);
    if (!rows.length) return '';
    return `
      <div class="fault fault-${p.pattern}">
        <p class="fault-head"><span class="fault-title">${title}</span><span class="fault-meta num">${L(`${int(p.items)} items · ${pct(p.lineShare)} of the ${int(r.total.lines)} loss lines · margin ${pct(p.margin)}`, `${int(p.items)} أصناف · ${pct(p.lineShare)} من ${int(r.total.lines)} سطرًا خاسرًا · هامش ${pct(p.margin)}`)}</span></p>
        <p class="fault-note">${note}</p>
        <ol class="fault-rows">${rows.map((x) => `
          <li>
            <span class="fr-name">${nm(x.label)}</span>
            <span class="fr-bar" aria-hidden="true"><i style="width:${((x.lines / top) * 100).toFixed(2)}%"></i></span>
            <span class="fr-n num">${L(`${int(x.lines)} lines`, `${int(x.lines)} سطرًا`)}</span>
            <span class="fr-m num${x.margin < 0 ? ' neg' : ''}">${pct(x.margin)}</span>
            ${x.belowCost ? `<span class="fr-flag">${L('price < cost', 'السعر < التكلفة')}</span>` : ''}
          </li>`).join('')}</ol>
      </div>`;
  };
  return `
  <section class="section lab-inst" id="lab-loss" aria-labelledby="lab-loss-h">
    ${instHead('02', 'lab-loss', L('Instrument 02 · Loss lines', 'الأداة 02 · الأسطر الخاسرة'), L('Where is money lost on a sale?', 'أين تُخسَر الأموال في البيع؟'),
      L('Every invoice line with negative recorded profit, traced to its item. Two different patterns appear, and they call for different questions.', 'كل سطر فاتورة بربح مسجَّل سالب، مُتتبَّعًا إلى صنفه. يظهر نمطان مختلفان، ولكل منهما أسئلة مختلفة.'))}
    <div class="inst-body">
      <figure class="inst-figure panel-frame" data-reveal>
        ${group(st, L('Structural: loses money on every sale', 'هيكلي: يخسر في كل بيع'), L('Negative margin over the item’s whole life.', 'هامش سالب على مدى عمر الصنف كله.'))}
        ${group(sp, L('Sporadic: profitable, with occasional losing lines', 'متقطّع: مربح، مع أسطر خاسرة أحيانًا'), L('Healthy margin overall; a few individual lines lost money.', 'هامش جيد إجمالًا؛ وبعض الأسطر المنفردة خسرت.'))}
        <div class="pulse">
          <p class="q-title">${L('Loss-making lines per month', 'الأسطر الخاسرة شهريًا')} <span>${L(`present in ${int(r.activeMonths)} of ${int(r.months)} months`, `موجودة في ${int(r.activeMonths)} من ${int(r.months)} شهرًا`)}</span></p>
          <div class="lab-pulse-host"></div>
        </div>
      </figure>
      <aside class="inst-side" data-reveal>
        <div class="leak-total">
          <p class="lt-label">${L('Recorded loss on losing lines', 'الخسارة المسجّلة على الأسطر الخاسرة')}</p>
          <p class="lt-value num">${money(r.total.loss)}</p>
          <p class="lt-note">${L(`${int(r.total.lines)} lines on ${int(r.total.items)} of ${int(r.total.itemsSold)} items · ${pct(r.total.loss / (r.total.profit || 1), 2)} of recorded profit`, `${int(r.total.lines)} سطرًا على ${int(r.total.items)} من ${int(r.total.itemsSold)} صنفًا · ${pct(r.total.loss / (r.total.profit || 1), 2)} من الربح المسجَّل`)}</p>
        </div>
        <div class="split">
          <p class="q-title">${L('Share of loss-making lines', 'حصة الأسطر الخاسرة')}</p>
          <div class="split-bar" aria-hidden="true"><i class="s-st" style="width:${(st.lineShare * 100).toFixed(1)}%"></i><i class="s-sp" style="width:${(sp.lineShare * 100).toFixed(1)}%"></i></div>
          <p class="split-legend"><span><i class="lg lg-st"></i>${L('Structural', 'هيكلي')} ${pct(st.lineShare)}</span><span><i class="lg lg-sp"></i>${L('Sporadic', 'متقطّع')} ${pct(sp.lineShare)}</span></p>
          <p class="split-k">${L(`The ${int(r.k80)} items with the most loss lines hold ${pct(r.k80Share)} of them: the fewest items needed to pass 80%.${r.k80Structural ? ' They are the structural items.' : ''}`, `الأصناف الـ${int(r.k80)} الأكثر أسطرًا خاسرة تضم ${pct(r.k80Share)} منها: أقل عدد من الأصناف يتجاوز 80٪.${r.k80Structural ? ' وهي الأصناف الهيكلية نفسها.' : ''}`)}</p>
        </div>
        ${pairs.length ? `
        <div class="pricecost">
          <p class="q-title">${L('Item master, as exported', 'بيانات الأصناف كما صُدّرت')}</p>
          ${pairs.map((x) => { const lo = Math.min(x.unitPrice ?? 0, x.unitCost), hi = Math.max(x.unitPrice ?? 0, x.unitCost), span = hi * 1.15; return `
          <div class="pc-scale" aria-hidden="true"><i class="pc-price" style="inset-inline-start:${(((x.unitPrice ?? 0) / span) * 100).toFixed(1)}%"></i><i class="pc-cost" style="inset-inline-start:${((x.unitCost / span) * 100).toFixed(1)}%"></i><b style="inset-inline-start:${((lo / span) * 100).toFixed(1)}%;width:${(((hi - lo) / span) * 100).toFixed(1)}%"></b></div>
          <p class="pc-text">${L(`List price ${b(money(x.unitPrice ?? 0))} against last cost ${b(money(x.unitCost))}`, `سعر القائمة ${b(money(x.unitPrice ?? 0))} مقابل آخر تكلفة ${b(money(x.unitCost))}`)} · ${L(`${int(r.rows.filter((y) => y.unitPrice === x.unitPrice && y.unitCost === x.unitCost && y.belowCost).length)} items`, `${int(r.rows.filter((y) => y.unitPrice === x.unitPrice && y.unitCost === x.unitCost && y.belowCost).length)} أصناف`)}</p>`; }).join('')}
        </div>` : ''}
      </aside>
    </div>
    ${claims([
      ['finding', L(
        `${b(int(r.total.lines))} invoice lines lost money, on ${int(r.total.items)} of ${int(r.total.itemsSold)} items sold; the ${b(int(r.k80))} most affected items hold ${pct(r.k80Share)} of those lines, the fewest needed to pass 80%. Losses appear in ${int(r.activeMonths)} of ${int(r.months)} months, so this is a standing pattern, not a one-off event.`,
        `${b(int(r.total.lines))} سطر فاتورة خسر، على ${int(r.total.items)} من ${int(r.total.itemsSold)} صنفًا مبيعًا؛ وأكثر ${b(int(r.k80))} أصناف تأثرًا تضم ${pct(r.k80Share)} من تلك الأسطر، وهو أقل عدد يتجاوز 80٪. وتظهر الخسائر في ${int(r.activeMonths)} من ${int(r.months)} شهرًا، فهي نمط قائم لا حدث عابر.`)],
      ['finding', L(
        `${b(int(st.items))} items lose money over their whole life (margin ${pct(st.margin)}) and hold ${b(pct(st.lineShare))} of the losing lines. For ${int(st.belowCost)} of them, the exported list price is below the last recorded cost price.`,
        `${b(int(st.items))} أصناف تخسر على مدى عمرها كله (هامش ${pct(st.margin)}) وتضم ${b(pct(st.lineShare))} من الأسطر الخاسرة. ولـ${int(st.belowCost)} منها، سعر القائمة المُصدَّر أقل من آخر سعر تكلفة مسجَّل.`)],
      ['finding', L(
        `${b(int(sp.items))} items are profitable overall (margin ${pct(sp.margin)}) yet lost money on ${int(sp.lines)} individual lines.`,
        `${b(int(sp.items))} صنفًا مربحة إجمالًا (هامش ${pct(sp.margin)})، لكنها خسرت في ${int(sp.lines)} سطرًا منفردًا.`)],
      ['calc', L(
        `The losing lines cost ${b(money(r.total.loss))} in recorded profit, ${pct(r.total.loss / (r.total.profit || 1), 2)} of the total: small in money, but a sign of a pricing control gap.`,
        `كلّفت الأسطر الخاسرة ${b(money(r.total.loss))} من الربح المسجَّل، أي ${pct(r.total.loss / (r.total.profit || 1), 2)} من الإجمالي: مبلغ صغير، لكنه مؤشر على ثغرة في ضبط التسعير.`)],
      ['hypothesis', L(
        'Structural losses most plausibly come from a price or cost setting in the item master; sporadic ones from discounts, special deals or credit lines. The exports hold no price or cost history, so neither cause can be confirmed here.',
        'الأرجح أن الخسائر الهيكلية مصدرها إعداد للسعر أو التكلفة في بيانات الأصناف، والمتقطّعة مصدرها خصومات أو عروض خاصة أو أسطر دائنة. ولا تتضمن المستخرجات سجلًا للأسعار أو التكاليف، فلا يمكن تأكيد أيّ من السببين هنا.')],
      ['rec', L(
        `Have the commercial team check the price and cost records of the ${int(st.items)} structural items before changing any price, and add a below-cost warning at order entry. Watch the sporadic lines; act only if they grow.`,
        `أن يراجع الفريق التجاري سجلات السعر والتكلفة للأصناف الهيكلية (${int(st.items)}) قبل تغيير أي سعر، وإضافة تنبيه عند البيع بأقل من التكلفة عند إدخال الطلب. ومتابعة الأسطر المتقطّعة دون إجراء ما لم تتزايد.`)],
    ], L('Loss-line statements', 'عبارات الأسطر الخاسرة'))}
    ${method([
      [L('Loss line', 'السطر الخاسر'), L('An invoice line whose recorded line profit is below zero; the loss is the absolute value of that profit.', 'سطر فاتورة ربحه المسجَّل أقل من صفر؛ والخسارة هي القيمة المطلقة لذلك الربح.')],
      [L('Patterns', 'الأنماط'), L('Structural: total recorded profit over the coverage below zero. Sporadic: positive total profit with at least one losing line.', 'هيكلي: إجمالي الربح المسجَّل على مدى الفترة أقل من صفر. متقطّع: إجمالي ربح موجب مع سطر خاسر واحد على الأقل.')],
      [L('Price < cost', 'السعر < التكلفة'), L('Current list price below the last cost price in the exported item master: a snapshot, not the price on each sale.', 'سعر القائمة الحالي أقل من آخر سعر تكلفة في بيانات الأصناف المُصدَّرة: لقطة واحدة، لا السعر في كل عملية بيع.')],
      [L('Limits', 'الحدود'), L('Recorded profit only; no freight or landed cost, no price history, no reason codes. Simulated Microsoft sample data.', 'الربح المسجَّل فقط؛ دون تكاليف الشحن أو التكلفة الكاملة أو سجل الأسعار أو رموز الأسباب. بيانات عيّنة محاكاة من Microsoft.')],
    ])}
  </section>`;
}

/* ================================================================== instrument 4: supplier dependence */
function supplierSection(ds: SupplyChainDataset) {
  const r = supplierDependence(ds);
  const act = r.rows.filter((x) => x.pos > 0);
  const cols = [...new Set(r.families.flatMap((f) => f.suppliers))].sort((a, b2) => (r.rows.find((x) => x.s === b2)?.spend ?? 0) - (r.rows.find((x) => x.s === a)?.spend ?? 0));
  const famRev = r.families.reduce((s, f) => s + f.revenue, 0);
  const biggestSingle = r.singleSourced.slice().sort((a, b2) => b2.revenue - a.revenue)[0];
  const ld = r.lead;
  return `
  <section class="section lab-inst" id="lab-supply" aria-labelledby="lab-supply-h">
    ${instHead('04', 'lab-supply', L('Instrument 04 · Purchasing', 'الأداة 04 · المشتريات'), L('How exposed is supply?', 'ما مدى انكشاف التوريد؟'),
      L('Spend by supplier on one ring, drawn at true size, with the concentration index at its centre. Below, who supplies each product family, and how long each delivery really took.', 'الإنفاق حسب المورد على حلقة واحدة بحجمه الحقيقي، ومؤشر التركّز في مركزها. وأسفلها، من يورّد كل عائلة منتجات، وكم استغرق كل توريد فعلًا.'))}
    <div class="inst-body">
      <figure class="inst-figure panel-frame ring-figure" data-reveal><div class="lab-ring-host"></div></figure>
      <aside class="inst-side" data-reveal>
        <table class="ledger sup-table">
          <caption class="q-title">${L('Suppliers with purchase orders', 'الموردون الذين لديهم أوامر شراء')}</caption>
          <thead><tr><th scope="col">${L('Supplier', 'المورد')}</th><th scope="col">${L('POs', 'أوامر')}</th><th scope="col">${L('Spend', 'الإنفاق')}</th></tr></thead>
          <tbody>${act.map((x, i) => `<tr${i < 2 ? ' class="major"' : ''}><th scope="row">${nm(x.label)}<span class="partial">${esc(supplierGroup(x.group))}</span></th><td class="num">${int(x.pos)}</td><td class="num">${pct(x.spendShare, x.spendShare < 0.01 ? 2 : 1)}</td></tr>`).join('')}</tbody>
        </table>
        ${r.listed > r.active ? `<p class="side-note">${L(`${int(r.listed - r.active)} of ${int(r.listed)} listed suppliers have no purchase orders in the data.`, `${int(r.listed - r.active)} من ${int(r.listed)} موردين مُدرجين ليس لهم أوامر شراء في البيانات.`)}</p>` : ''}
      </aside>
    </div>
    <div class="leak-detail supply-detail" data-reveal>
      <div>
        <h3 class="sub-title">${L('Who supplies each product family', 'من يورّد كل عائلة منتجات')}</h3>
        <table class="matrix">
          <thead><tr><th scope="col">${L('Family', 'العائلة')}</th>${cols.map((s) => `<th scope="col"><span>${nm(ds.suppliers[s]?.label ?? String(s))}</span></th>`).join('')}<th scope="col">${L('Revenue', 'الإيرادات')}</th></tr></thead>
          <tbody>${r.families.map((f) => `<tr class="${f.suppliers.length === 1 ? 'single' : ''}"><th scope="row">${esc(famName(f.label))}${f.suppliers.length === 1 ? `<span class="single-tag">${L('single source', 'مصدر وحيد')}</span>` : ''}</th>${cols.map((s) => `<td>${f.suppliers.includes(s) ? `<i class="dot" aria-hidden="true"></i><span class="sr-only">${L('supplies', 'يورّد')}</span>` : ''}</td>`).join('')}<td class="num">${pct(f.revenue / (famRev || 1))}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <div>
        <h3 class="sub-title">${L('Lead time per received order, against the promise', 'مدة التوريد لكل أمر مُستلَم، مقابل الوعد')}</h3>
        <div class="lab-strip-host"></div>
        <p class="side-note">${L('Each dot is one purchase order; the upright tick is the supplier’s usual promised lead time.', 'كل نقطة أمر شراء واحد؛ والعلامة العمودية هي مدة التوريد المعتادة التي يعد بها المورد.')}</p>
      </div>
    </div>
    ${claims([
      ['finding', L(
        `${r.top2.labels.map(nm).join(L(' and ', ' و'))} take ${b(share(r.top2.spendShare))} of purchase spend and ${pct(r.top2.poShare)} of purchase orders. The spend concentration index (HHI) is ${b(r.hhi.spend.toFixed(2))}; it describes how concentrated spend is and is not a risk score.`,
        `يستحوذ ${r.top2.labels.map(nm).join(' و')} على ${b(share(r.top2.spendShare))} من الإنفاق على المشتريات و${pct(r.top2.poShare)} من أوامر الشراء. ومؤشر تركّز الإنفاق (HHI) ${b(r.hhi.spend.toFixed(2))}؛ وهو يصف درجة تركّز الإنفاق وليس مقياسًا للمخاطر.`)],
      ['finding', L(
        `${b(int(r.singleSourced.length))} of ${int(r.families.length)} product families are supplied by a single supplier in the item master; together they earn ${b(pct(r.singleSourcedRevenue))} of revenue.`,
        `${b(int(r.singleSourced.length))} من ${int(r.families.length)} عائلات منتجات يورّدها مورد واحد في بيانات الأصناف؛ وتحقق معًا ${b(pct(r.singleSourcedRevenue))} من الإيرادات.`)],
      ['finding', L(
        `Every received order arrived in ${int(ld.min)}–${int(ld.max)} days (standard deviation ${ld.sd.toFixed(2)} days), a median ${int(ld.earlyMedian)} days before the promised date; ${pct(ld.onTime)} on time. There is no variation to rank suppliers on.`,
        `وصل كل أمر مُستلَم خلال ${int(ld.min)}–${int(ld.max)} أيام (انحراف معياري ${ld.sd.toFixed(2)} يوم)، قبل الموعد الموعود بوسيط ${int(ld.earlyMedian)} يومًا؛ و${pct(ld.onTime)} في الموعد. لا يوجد تباين يسمح بترتيب الموردين.`)],
      ['hypothesis', L(
        'Lead times this short and this uniform are more likely a property of the simulated sample than evidence of excellent suppliers. The risk worth managing is dependence, not punctuality.',
        'مدد توريد بهذا القصر وهذا التجانس هي على الأرجح سمة من سمات العيّنة المحاكاة، لا دليل على تميّز الموردين. والخطر الجدير بالإدارة هو الاعتماد، لا الالتزام بالمواعيد.')],
      ['rec', L(
        `Qualify a second source for the single-sourced families, starting with ${esc(famName(biggestSingle?.label ?? ''))}, and report supplier concentration each quarter instead of an on-time score that cannot move.`,
        `اعتماد مصدر ثانٍ للعائلات وحيدة المصدر، بدءًا بـ${esc(famName(biggestSingle?.label ?? ''))}، ورصد تركّز الموردين كل ربع سنة بدلًا من مؤشر التزام بالمواعيد لا يتغيّر.`)],
    ], L('Supplier statements', 'عبارات الموردين'))}
    ${method([
      [L('Concentration', 'التركّز'), L(`Herfindahl–Hirschman index: the sum of squared spend shares (0 to 1). Used here as a descriptive measure only. The tick at ${HHI_HIGH} is a reference mark borrowed from market-competition analysis, where it conventionally means high concentration; it is not a validated procurement risk threshold, and no risk level is inferred from it.`, `مؤشر هيرفندال-هيرشمان: مجموع مربعات حصص الإنفاق (من 0 إلى 1). ويُستخدم هنا مقياسًا وصفيًا فقط. والعلامة عند ${HHI_HIGH} مرجع مأخوذ من تحليل المنافسة في الأسواق، حيث تعني عادةً تركّزًا مرتفعًا؛ وليست حدًّا مُعتمدًا لمخاطر المشتريات، ولا يُستنتج منها أي مستوى للمخاطر.`)],
      [L('Lead time', 'مدة التوريد'), L('Order date to final receipt, per purchase order; orders not fully received are left out.', 'من تاريخ الأمر إلى آخر استلام، لكل أمر شراء؛ وتُستبعد الأوامر غير المستلمة كليًا.')],
      [L('Families', 'العائلات'), L('Sourcing comes from the supplier named on each item in the item master, not from purchase history.', 'يُحدَّد المصدر من المورد المسمّى لكل صنف في بيانات الأصناف، لا من سجل المشتريات.')],
      [L('Limits', 'الحدود'), L('Spend is ordered value net of tax. No supplier prices, quality or capacity data. Simulated Microsoft sample data.', 'الإنفاق هو قيمة الطلبات دون الضريبة. لا توجد بيانات عن أسعار الموردين أو الجودة أو الطاقة. بيانات عيّنة محاكاة من Microsoft.')],
    ])}
  </section>`;
}

/* ================================================================== instrument 5: capital in stock */
const stockClaims = (ds: SupplyChainDataset, months: number) => {
  const r = stockCapital(ds, months);
  return claims([
    ['finding', L(
      `The median item holds ${b(int(r.cover.median))} months of cover (10th–90th percentile ${int(r.cover.p10)}–${int(r.cover.p90)}). Stock at cost equals ${b(`${r.valueToRevenue.toFixed(1)}×`)} the revenue of all ${int(r.coverageMonths)} months.`,
      `يحتفظ الصنف الوسيط بتغطية ${b(int(r.cover.median))} شهرًا (المئين 10–90: ${int(r.cover.p10)}–${int(r.cover.p90)}). وقيمة المخزون بالتكلفة تعادل ${b(`${r.valueToRevenue.toFixed(1)}×`)} إيرادات الأشهر ${int(r.coverageMonths)} كلها.`)],
    ['finding', L(
      `${b(int(r.atReorder))} of ${int(r.items)} items sit at or below their reorder level.`,
      `${b(int(r.atReorder))} من ${int(r.items)} صنفًا عند حد إعادة الطلب أو دونه.`)],
    ['calc', L(
      `With a ${int(months)}-month cover policy, ${b(money(r.excess))} (${pct(r.excessShare)}) of stock at cost sits beyond it.`,
      `مع سياسة تغطية ${int(months)} شهرًا، تقع ${b(money(r.excess))} (${pct(r.excessShare)}) من المخزون بالتكلفة خارجها.`)],
    ['hypothesis', L(
      'Holdings this large are unlikely to be a real operating position. The project’s audit found that the sample’s holdings do not reconcile with its stock movements, so the snapshot is best read as generated.',
      'من غير المرجح أن تمثّل أرصدة بهذا الحجم وضعًا تشغيليًا حقيقيًا. وقد وجد تدقيق المشروع أن أرصدة العيّنة لا تتطابق مع حركات المخزون، فالأفضل قراءة اللقطة على أنها مولَّدة.')],
    ['rec', L(
      'Present inventory as capital exposure, not stock-out risk: set a target cover per family, review the families with the most capital beyond it first, and do not forecast shortages from this snapshot.',
      'عرض المخزون بوصفه انكشافًا رأسماليًا لا خطر نفاد: تحديد تغطية مستهدفة لكل عائلة، ومراجعة العائلات ذات رأس المال الأكبر خارجها أولًا، وعدم التنبؤ بالنقص من هذه اللقطة.')],
  ], L('Stock statements', 'عبارات المخزون'));
};

function stockSection(ds: SupplyChainDataset) {
  const r = stockCapital(ds, 12);
  return `
  <section class="section lab-inst" id="lab-stock" aria-labelledby="lab-stock-h">
    ${instHead('05', 'lab-stock', L('Instrument 05 · Inventory', 'الأداة 05 · المخزون'), L('How much capital sits on the shelves?', 'كم من رأس المال على الرفوف؟'),
      L('Stock value at cost, sorted by how many months of demand it would last. Move the policy and watch how much capital it would release.', 'قيمة المخزون بالتكلفة مرتّبة حسب عدد أشهر الطلب التي تكفيها. حرّك السياسة وراقب كم من رأس المال ستحرّره.'))}
    <div class="inst-body">
      <figure class="inst-figure panel-frame" data-reveal>
        <div class="policy-ctl">
          <label for="cover-policy">${L('Cover policy', 'سياسة التغطية')}</label>
          <input id="cover-policy" type="range" min="1" max="60" step="1" value="12" aria-valuetext="${L('12 months', '12 شهرًا')}">
          <output for="cover-policy" class="num">${L('12 months', '12 شهرًا')}</output>
        </div>
        <div class="lab-hist-host"></div>
        <figcaption class="inst-legend"><span><i class="lg lg-keep"></i>${L('Within the policy', 'ضمن السياسة')}</span><span><i class="lg lg-excess"></i>${L('Beyond the policy', 'خارج السياسة')}</span><span>${L('Figures above the bars: number of items', 'الأرقام فوق الأعمدة: عدد الأصناف')}</span></figcaption>
      </figure>
      <aside class="inst-side" data-reveal>
        <div class="leak-total stock-total" aria-live="polite">
          <p class="lt-label">${L('Capital beyond the policy', 'رأس المال خارج السياسة')}</p>
          <p class="lt-value num" data-excess>${money(r.excess)}</p>
          <p class="lt-note" data-excess-note>${L(`${pct(r.excessShare)} of ${money(r.value)} at cost`, `${pct(r.excessShare)} من ${money(r.value)} بالتكلفة`)}</p>
        </div>
        <dl class="stock-stats">
          <div><dt>${L('Median cover', 'وسيط التغطية')}</dt><dd class="num">${L(`${int(r.cover.median)} months`, `${int(r.cover.median)} شهرًا`)}</dd></div>
          <div><dt>${L('10th–90th percentile', 'المئين 10–90')}</dt><dd class="num">${int(r.cover.p10)}–${int(r.cover.p90)}</dd></div>
          <div><dt>${L('Stock at cost ÷ all revenue', 'المخزون بالتكلفة ÷ كل الإيرادات')}</dt><dd class="num">${r.valueToRevenue.toFixed(1)}×</dd></div>
          <div><dt>${L('At or below reorder level', 'عند حد إعادة الطلب أو دونه')}</dt><dd class="num">${int(r.atReorder)}</dd></div>
        </dl>
        <div>
          <p class="q-title">${L('Capital beyond the policy, by family', 'رأس المال خارج السياسة حسب العائلة')}</p>
          <div class="stock-fams"></div>
        </div>
      </aside>
    </div>
    <div class="stock-claims">${stockClaims(ds, 12)}</div>
    ${method([
      [L('Cover', 'التغطية'), L('Quantity on hand ÷ average monthly units sold over the coverage. Items with no recorded use have unlimited cover and are counted apart.', 'الكمية المتاحة ÷ متوسط الوحدات المباعة شهريًا على مدى الفترة. والأصناف بلا استخدام مسجَّل تغطيتها غير محدودة وتُحسب منفصلة.')],
      [L('Policy', 'السياسة'), L('Units beyond (policy months × monthly use), valued at the last cost price. A what-if, not a recommendation of a specific number.', 'الوحدات التي تتجاوز (أشهر السياسة × الاستخدام الشهري)، مقوّمة بآخر سعر تكلفة. سيناريو افتراضي، لا توصية برقم محدد.')],
      [L('Limits', 'الحدود'), L('One end-of-period snapshot; no stock history, so no stock-out analysis. The holdings do not reconcile with the movements in the source sample.', 'لقطة واحدة في نهاية الفترة؛ لا سجل للمخزون، فلا تحليل للنفاد. والأرصدة لا تتطابق مع الحركات في عيّنة المصدر.')],
    ])}
  </section>`;
}

/* ================================================================== instrument 6: forecast check (historical backtest) */
const MODEL_NAME: Record<ForecastModel, () => string> = {
  naive: () => L('Last month', 'الشهر السابق'),
  seasonal: () => L('Same month last year', 'الشهر نفسه من العام السابق'),
  avg3: () => L('3-month average', 'متوسط 3 أشهر'),
  avg12: () => L('12-month average', 'متوسط 12 شهرًا'),
};
const horizonName = (h: number) => (h === 1 ? L('1 month ahead', 'شهر واحد مقدمًا') : L(`${h} months ahead`, `${int(h)} أشهر مقدمًا`));

/** Arrow keys move and select inside a radio group (mirrored in Arabic), as the ARIA pattern expects. */
function radioGroup(group: HTMLElement, onSelect: (btn: HTMLButtonElement) => void) {
  const radios = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  const select = (btn: HTMLButtonElement, focus = false) => {
    radios.forEach((r) => { const on = r === btn; r.setAttribute('aria-checked', String(on)); r.tabIndex = on ? 0 : -1; });
    if (focus) btn.focus();
    onSelect(btn);
  };
  group.addEventListener('click', (e) => { const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[role="radio"]'); if (btn) select(btn); });
  group.addEventListener('keydown', (e) => {
    const i = radios.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const rtl = document.documentElement.dir === 'rtl';
    const fwd = e.key === 'ArrowDown' || e.key === (rtl ? 'ArrowLeft' : 'ArrowRight');
    const back = e.key === 'ArrowUp' || e.key === (rtl ? 'ArrowRight' : 'ArrowLeft');
    if (!fwd && !back) return;
    e.preventDefault();
    select(radios[(i + (fwd ? 1 : -1) + radios.length) % radios.length], true);
  });
}

const forecastBoard = (r: ReturnType<typeof forecastCheck>, h: number, model: ForecastModel) => {
  const hz = r.horizons.find((x) => x.h === h)!;
  return `
    <table class="ledger fc-board">
      <caption class="q-title">${L(`Average error, ${int(hz.n)} months scored`, `متوسط الخطأ، ${int(hz.n)} شهرًا مُقيَّمًا`)} · ${horizonName(h)}</caption>
      <thead><tr><th scope="col">${L('Model', 'النموذج')}</th><th scope="col">${L('Error', 'الخطأ')}</th><th scope="col">${L('vs last month', 'مقابل الشهر السابق')}</th></tr></thead>
      <tbody>${hz.models.map((m) => `<tr class="${m.model === model ? 'on' : ''}${hz.ties.includes(m.model) ? ' best' : ''}"><th scope="row">${MODEL_NAME[m.model]()}${hz.ties.includes(m.model) ? `<span class="partial">${L('lowest error', 'أقل خطأ')}</span>` : ''}</th><td class="num">${pct(m.mape)}</td><td class="num">${m.model === 'naive' ? '1.00×' : `${m.rel.toFixed(2)}×`}</td></tr>`).join('')}</tbody>
    </table>`;
};

function forecastClaims(r: ReturnType<typeof forecastCheck>) {
  const [h1, h3] = r.horizons;
  const naive1 = h1.models.find((m) => m.model === 'naive')!, naive3 = h3.models.find((m) => m.model === 'naive')!;
  const y0 = r.years[0], y1 = r.years[r.years.length - 1];
  const avg12 = h1.models.find((m) => m.model === 'avg12')!;
  return claims([
    ['finding', L(
      `Monthly revenue averaged ${b(money(r.level))}, with a typical swing of ${b(pct(r.cv))} around it${y0 && y1 && y0 !== y1 ? `; the average month rose from ${money(y0.avg)} in ${y0.year} to ${money(y1.avg)} in ${y1.year}` : ''}.`,
      `بلغ متوسط الإيرادات الشهرية ${b(money(r.level))}، بتذبذب معتاد ${b(pct(r.cv))} حوله${y0 && y1 && y0 !== y1 ? `؛ وارتفع متوسط الشهر من ${money(y0.avg)} في ${y0.year} إلى ${money(y1.avg)} في ${y1.year}` : ''}.`)],
    ['calc', L(
      `One month ahead, the ${h1.ties.map((m) => MODEL_NAME[m]().toLowerCase()).join(' and the ')} ${h1.ties.length > 1 ? 'were' : 'was'} off by ${b(pct(h1.best!.mape))} on average, against ${pct(naive1.mape)} for "last month" (${h1.best!.rel.toFixed(2)}× its error), over ${int(h1.n)} scored months.`,
      `لشهر واحد مقدمًا، أخطأ ${h1.ties.map((m) => `«${MODEL_NAME[m]()}»`).join(' و')} بمتوسط ${b(pct(h1.best!.mape))}، مقابل ${pct(naive1.mape)} لنموذج «الشهر السابق» (${h1.best!.rel.toFixed(2)}× خطؤه)، على ${int(h1.n)} شهرًا مُقيَّمًا.`)],
    ['finding', h3.beatsNaive ? L(
      `Three months ahead, the ${MODEL_NAME[h3.best!.model]().toLowerCase()} again beat "last month" (${pct(h3.best!.mape)} against ${pct(naive3.mape)}).`,
      `لثلاثة أشهر مقدمًا، تفوّق «${MODEL_NAME[h3.best!.model]()}» مجددًا على «الشهر السابق» (${pct(h3.best!.mape)} مقابل ${pct(naive3.mape)}).`) : L(
      `Three months ahead, ${b('no model beat "last month"')} (${pct(naive3.mape)} average error). The advantage at one month does not hold.`,
      `لثلاثة أشهر مقدمًا، ${b('لم يتفوّق أي نموذج على «الشهر السابق»')} (متوسط خطأ ${pct(naive3.mape)}). فالأفضلية عند شهر واحد لا تصمد.`)],
    ['hypothesis', L(
      `The series behaves like a steady level with noise and mild growth. With <bdi dir="ltr">${int(h3.n)}–${int(h1.n)}</bdi> scored months, differences of a point or two of error could be chance, and no repeatable seasonal pattern shows up that a model could exploit.`,
      `تتصرّف السلسلة كمستوى ثابت مع ضجيج ونمو طفيف. ومع <bdi dir="ltr">${int(h3.n)}–${int(h1.n)}</bdi> شهرًا مُقيَّمًا، قد تكون فروق نقطة أو نقطتين في الخطأ مصادفة، ولا يظهر نمط موسمي متكرّر يمكن لنموذج استغلاله.`)],
    ['rec', r.skilful ? L(
      `Use the ${MODEL_NAME[r.skilful]().toLowerCase()} as a planning baseline, always with its historical error, and re-run this backtest on real operating data before relying on it.`,
      `استخدام «${MODEL_NAME[r.skilful]()}» خطًّا أساسيًا للتخطيط مع خطئه التاريخي دائمًا، وإعادة هذا الاختبار على بيانات تشغيلية حقيقية قبل الاعتماد عليه.`) : L(
      `Do not publish a forward forecast from this data. If a planning baseline is needed, a 12-month average, quoted with its average historical miss (${pct(avg12.mape)}), is as good as anything tested here. That miss describes past forecasts; it is not a prediction interval for a future month; re-run the backtest on real operating data before choosing a model.`,
      `عدم نشر توقّع مستقبلي من هذه البيانات. وإن لزم خط أساسي للتخطيط، فمتوسط 12 شهرًا، مع ذكر متوسط فارقه التاريخي (${pct(avg12.mape)})، جيد كأي نموذج اختُبر هنا. وهذا الفارق يصف توقعات سابقة، وليس فترة تنبؤ لشهر قادم؛ مع إعادة الاختبار على بيانات تشغيلية حقيقية قبل اختيار نموذج.`)],
  ], L('Forecast-check statements', 'عبارات فحص التوقّع'));
}

function forecastSection(ds: SupplyChainDataset) {
  const r = forecastCheck(ds);
  if (!r.horizons[0].n) return '';
  const first = r.horizons[0].best?.model ?? 'naive';
  return `
  <section class="section lab-inst" id="lab-forecast" aria-labelledby="lab-forecast-h">
    ${instHead('06', 'lab-forecast', L('Instrument 06 · Forecast check', 'الأداة 06 · فحص التوقّع'), L('Could the past have predicted the next month?', 'هل كان الماضي سيتنبأ بالشهر التالي؟'),
      L('Four simple forecasting rules, replayed month by month on the real history: each forecast uses only the data available at the time and is scored against what happened. Nothing is projected past the last month.', 'أربع قواعد توقّع بسيطة، أُعيد تشغيلها شهرًا بشهر على التاريخ الحقيقي: كل توقّع يستخدم البيانات المتاحة وقتها فقط ويُقيَّم بما حدث فعلًا. ولا يُسقَط شيء بعد آخر شهر.'),
      `<p class="key-status">${statusBadge('unverified', L('Methodology demo · historical backtest, not a forecast', 'عرض منهجي · اختبار رجعي تاريخي، لا توقّع'))}</p>`)}
    <div class="inst-body">
      <figure class="inst-figure panel-frame" data-reveal>
        <div class="fc-ctl">
          <div class="seg fc-model" role="radiogroup" aria-label="${L('Forecasting rule', 'قاعدة التوقّع')}">
            ${FORECAST_MODELS.map((m) => `<button type="button" role="radio" data-model="${m}" aria-checked="${m === first}"${m === first ? '' : ' tabindex="-1"'}>${MODEL_NAME[m]()}</button>`).join('')}
          </div>
          <div class="seg fc-h" role="radiogroup" aria-label="${L('Horizon', 'الأفق')}">
            ${FORECAST_HORIZONS.map((h, i) => `<button type="button" role="radio" data-h="${h}" aria-checked="${i === 0}"${i === 0 ? '' : ' tabindex="-1"'}>${horizonName(h)}</button>`).join('')}
          </div>
        </div>
        <div class="lab-bt-host"></div>
        <figcaption class="inst-legend"><span><i class="lg lg-actual"></i>${L('Actual monthly revenue', 'الإيرادات الشهرية الفعلية')}</span><span><i class="lg lg-fc"></i>${L('What the rule forecast for that month', 'ما توقّعته القاعدة لذلك الشهر')}</span><span><i class="lg lg-miss"></i>${L('Miss', 'الفارق')}</span></figcaption>
      </figure>
      <aside class="inst-side" data-reveal>
        <div class="fc-board-host" aria-live="polite">${forecastBoard(r, FORECAST_HORIZONS[0], first)}</div>
        <p class="side-note">${L('“vs last month” is the rule’s error divided by the error of simply repeating last month: below 1.00× is better.', '«مقابل الشهر السابق» هو خطأ القاعدة مقسومًا على خطأ تكرار الشهر السابق ببساطة: ما دون 1.00× أفضل.')}</p>
        <p class="side-note"><b>${L('Historical error is not a prediction interval.', 'الخطأ التاريخي ليس فترة تنبؤ.')}</b> ${L('The error is how far past forecasts missed, on average. A prediction interval would give a range for a future month with a stated probability; none is computed or shown.', 'الخطأ هو متوسط ابتعاد التوقعات السابقة عن الواقع. أما فترة التنبؤ فتعطي مدى لشهر قادم باحتمال محدد؛ ولا يُحسب أو يُعرض شيء منها.')}</p>
      </aside>
    </div>
    ${forecastClaims(r)}
    ${method([
      [L('Backtest', 'الاختبار الرجعي'), L(`Rolling origin: from month ${r.warmup + 1} on, each rule forecasts using only earlier months, then the origin moves one month. The first ${r.warmup} months are warm-up so every rule has the same test window.`, `أصل متحرّك: من الشهر ${int(r.warmup + 1)} فصاعدًا، تتوقّع كل قاعدة باستخدام الأشهر السابقة فقط، ثم يتقدّم الأصل شهرًا. وأول ${int(r.warmup)} شهرًا للإحماء كي تتساوى نافذة الاختبار لكل القواعد.`)],
      [L('Rules', 'القواعد'), L('Last month; same month a year earlier; mean of the last 3 months; mean of the last 12 months. No fitted parameters, so nothing is tuned on the test months.', 'الشهر السابق؛ الشهر نفسه قبل عام؛ متوسط آخر 3 أشهر؛ متوسط آخر 12 شهرًا. دون معاملات مُقدَّرة، فلا شيء يُضبط على أشهر الاختبار.')],
      [L('Scores', 'المقاييس'), L(`Error: mean absolute percentage error of the past forecasts. “vs last month”: mean absolute error relative to repeating last month (a relative MAE). Both describe history; neither is a prediction interval, which would need a model of future uncertainty and more data than <bdi dir="ltr">${int(r.horizons[r.horizons.length - 1].n)}–${int(r.horizons[0].n)}</bdi> scored months.`, `الخطأ: متوسط الخطأ المطلق النسبي للتوقعات السابقة. «مقابل الشهر السابق»: متوسط الخطأ المطلق نسبةً إلى تكرار الشهر السابق. وكلاهما يصف الماضي؛ وليس أيٌّ منهما فترة تنبؤ، إذ تحتاج الفترة إلى نموذج لعدم اليقين المستقبلي وبيانات أكثر من <bdi dir="ltr">${int(r.horizons[r.horizons.length - 1].n)}–${int(r.horizons[0].n)}</bdi> شهرًا مُقيَّمًا.`)],
      [L('Limits', 'الحدود'), L(`Net revenue only, ${int(r.series.length)} months, so <bdi dir="ltr">${int(r.horizons[r.horizons.length - 1].n)}–${int(r.horizons[0].n)}</bdi> scored forecasts; no prediction intervals or significance tests at this size. Simulated Microsoft sample data. Not a forecast of future sales.`, `صافي الإيرادات فقط، ${int(r.series.length)} شهرًا، أي <bdi dir="ltr">${int(r.horizons[r.horizons.length - 1].n)}–${int(r.horizons[0].n)}</bdi> توقّعًا مُقيَّمًا؛ دون فترات تنبؤ أو اختبارات دلالة بهذا الحجم. بيانات عيّنة محاكاة من Microsoft. وليس توقّعًا للمبيعات المستقبلية.`)],
    ])}
  </section>`;
}

function wireForecast(root: HTMLElement, ds: SupplyChainDataset, cleanup: (() => void)[]) {
  const r = forecastCheck(ds);
  const host = root.querySelector<HTMLElement>('.lab-bt-host');
  if (!host) return;
  const chart = new BacktestChart(host);
  let model: ForecastModel = r.horizons[0].best?.model ?? 'naive', h = FORECAST_HORIZONS[0];
  const draw = () => {
    const hz = r.horizons.find((x) => x.h === h)!;
    chart.update({ months: ds.months, actual: r.series.map((x) => x.value), warmup: r.warmup, points: hz.models.find((m) => m.model === model)!.points, model: MODEL_NAME[model](), h, fmt: money });
    root.querySelector<HTMLElement>('.fc-board-host')!.innerHTML = forecastBoard(r, h, model);
  };
  radioGroup(root.querySelector<HTMLElement>('.fc-model')!, (btn) => { if (btn.dataset.model !== model) { model = btn.dataset.model as ForecastModel; tip(null); draw(); } });
  radioGroup(root.querySelector<HTMLElement>('.fc-h')!, (btn) => { const v = Number(btn.dataset.h); if (v !== h) { h = v; tip(null); draw(); } });
  draw();
  cleanup.push(() => chart.destroy());
}

/* ================================================================== closing: recommendations */
function closingSection(ds: SupplyChainDataset) {
  const a = abcMatrix(ds, 'revenue'), lo = lossAnatomy(ds), lk = leakage(ds), su = supplierDependence(ds), stc = stockCapital(ds, 12);
  const aLow = a.rows.filter((x) => x.cls === 'A' && !x.highMargin);
  const cs = customerSpread(ds);
  const strength = { strong: L('Strong evidence', 'دليل قوي'), indicative: L('Indicative', 'دليل استرشادي'), limited: L('Limited by the sample', 'محدود بالعيّنة') };
  const recs: { n: string; jump: string; owner: string; s: keyof typeof strength; title: string; why: string; step: string }[] = [
    { n: '01', jump: 'lab-loss', owner: L('Commercial', 'التجاري'), s: 'strong', title: L('Fix the items that lose money on every sale', 'إصلاح الأصناف التي تخسر في كل بيع'),
      why: L(`${int(lo.patterns[0].items)} items lose money over their whole life; their exported list price is below cost.`, `${int(lo.patterns[0].items)} أصناف تخسر على مدى عمرها؛ وسعر قائمتها المُصدَّر أقل من التكلفة.`),
      step: L('Verify the price and cost records, then correct one or the other; add a below-cost warning at order entry.', 'التحقق من سجلات السعر والتكلفة ثم تصحيح أحدهما؛ وإضافة تنبيه البيع بأقل من التكلفة عند إدخال الطلب.') },
    { n: '02', jump: 'lab-supply', owner: L('Purchasing', 'المشتريات'), s: 'strong', title: L('Reduce dependence on single suppliers', 'تقليل الاعتماد على مورد وحيد'),
      why: L(`${int(su.singleSourced.length)} of ${int(su.families.length)} families have one supplier; two suppliers take ${share(su.top2.spendShare)} of spend.`, `${int(su.singleSourced.length)} من ${int(su.families.length)} عائلات لها مورد واحد؛ ومورّدان يستحوذان على ${share(su.top2.spendShare)} من الإنفاق.`),
      step: L('Qualify a second source for the largest single-sourced families; track concentration quarterly.', 'اعتماد مصدر ثانٍ لأكبر العائلات وحيدة المصدر؛ ورصد التركّز كل ربع سنة.') },
    { n: '03', jump: 'lab-leak', owner: L('Operations', 'العمليات'), s: 'indicative', title: L('Clean up unpicked backorders', 'معالجة الطلبات المؤجلة غير المُجهَّزة'),
      why: L(`${pct(lk.rate)} of ordered units were never picked, and the share rose in every complete year.`, `${pct(lk.rate)} من الوحدات المطلوبة لم تُجهَّز، وارتفعت النسبة في كل سنة كاملة.`),
      step: L('Review the oldest open lines with operations; close or re-promise them; report the fill rate with and without them.', 'مراجعة أقدم الأسطر المفتوحة مع العمليات؛ وإغلاقها أو تحديد موعد جديد؛ وعرض معدل التنفيذ بها ودونها.') },
    { n: '04', jump: 'lab-abc', owner: L('Commercial', 'التجاري'), s: 'strong', title: L('Protect the core and review the low-margin volume', 'حماية الأصناف الأساسية ومراجعة أصناف الحجم منخفضة الهامش'),
      why: L(`${int(aLow.length)} class-A items earn below-median margin; one point of margin on them is worth ${money(aLow.reduce((s, x) => s + x.revenue, 0) * 0.01)}.`, `${int(aLow.length)} صنفًا من الفئة A هامشها دون الوسيط؛ ونقطة هامش واحدة عليها تساوي ${money(aLow.reduce((s, x) => s + x.revenue, 0) * 0.01)}.`),
      step: L('Keep the high-margin A items in stock; review price and cost on the low-margin A items.', 'إبقاء أصناف A عالية الهامش متوفرة؛ ومراجعة السعر والتكلفة لأصناف A منخفضة الهامش.') },
    { n: '05', jump: 'lab-stock', owner: L('Inventory', 'المخزون'), s: 'limited', title: L('Treat stock as capital exposure', 'التعامل مع المخزون بوصفه انكشافًا رأسماليًا'),
      why: L(`Median cover is ${int(stc.cover.median)} months; ${pct(stc.excessShare)} of stock value sits beyond 12 months.`, `وسيط التغطية ${int(stc.cover.median)} شهرًا؛ و${pct(stc.excessShare)} من قيمة المخزون تتجاوز 12 شهرًا.`),
      step: L('Set a target cover per family and review the largest excess first. Validate on real stock data before acting.', 'تحديد تغطية مستهدفة لكل عائلة ومراجعة الفائض الأكبر أولًا. والتحقق على بيانات مخزون حقيقية قبل التنفيذ.') },
  ];
  const ld = su.lead;
  return `
  <section class="section lab-close" id="lab-recs" aria-labelledby="lab-recs-h">
    <header class="inst-head" data-reveal>
      <p class="inst-num num" aria-hidden="true">→</p>
      <div>
        <p class="inst-kicker">${L('From instruments to decisions', 'من الأدوات إلى القرارات')}</p>
        <h2 class="sec-title" id="lab-recs-h">${L('What we would do, in order', 'ما نقترح فعله، بالترتيب')}</h2>
        <p class="sec-note">${L('Ranked by the strength of the evidence and the size of the decision. Every one awaits the team’s review before it is presented as a project recommendation.', 'مرتّبة حسب قوة الدليل وحجم القرار. وكلها بانتظار مراجعة الفريق قبل عرضها توصيةً للمشروع.')}</p>
      </div>
    </header>
    <ol class="decisions" data-reveal>
      ${recs.map((x) => `
      <li class="decision">
        <span class="dc-n num" aria-hidden="true">${x.n}</span>
        <div class="dc-body">
          <p class="dc-meta"><span class="dc-owner">${x.owner}</span><span class="dc-strength s-${x.s}">${strength[x.s]}</span></p>
          <h3 class="dc-title">${x.title}</h3>
          <p class="dc-why">${x.why}</p>
          <p class="dc-step"><span>${L('First step', 'الخطوة الأولى')}</span> ${x.step}</p>
          <a class="text-link dc-link" href="#/lab" data-jump="${x.jump}">${L('See the evidence', 'عرض الدليل')}</a>
        </div>
      </li>`).join('')}
    </ol>
    <details class="lab-method not-done">
      <summary>${L('What the Lab deliberately does not do, and why', 'ما يتجنّبه المختبر عمدًا، ولماذا')}</summary>
      <dl>
        <div><dt>${L('RFM segments', 'شرائح RFM')}</dt><dd>${L(`Customer revenue is evenly spread (Gini ${cs.gini.toFixed(2)} across ${int(cs.customers)} customers), so quantile tiers would invent segments that are not there.`, `إيرادات العملاء موزّعة بالتساوي تقريبًا (معامل جيني ${cs.gini.toFixed(2)} عبر ${int(cs.customers)} عميلًا)، فالشرائح المئينية ستختلق فروقًا غير موجودة.`)}</dd></div>
        <div><dt>${L('Supplier scorecards', 'بطاقات أداء الموردين')}</dt><dd>${L(`Lead times span only ${int(ld.min)}–${int(ld.max)} days and all orders are on time; a score would rank noise.`, `تتراوح مدد التوريد بين ${int(ld.min)}–${int(ld.max)} أيام فقط وكل الأوامر في موعدها؛ فأي تقييم سيرتّب الضجيج.`)}</dd></div>
        <div><dt>${L('XYZ demand classes', 'فئات الطلب XYZ')}</dt><dd>${L('The website dataset holds demand by month and family, not by item. The project audit found item demand uniformly stable, which would put every item in one class.', 'تتضمن بيانات الموقع الطلب حسب الشهر والعائلة لا حسب الصنف. ووجد تدقيق المشروع أن طلب الأصناف مستقر بشكل متجانس، ما يضع كل الأصناف في فئة واحدة.')}</dd></div>
        <div><dt>${L('Market-basket analysis', 'تحليل سلة المشتريات')}</dt><dd>${L('Order baskets are not in the website dataset; the audit found item pairs too sparse to be more than noise.', 'سلال الطلبات غير موجودة في بيانات الموقع؛ ووجد التدقيق أن أزواج الأصناف أندر من أن تتجاوز الضجيج.')}</dd></div>
        <div><dt>${L('Machine-learning anomaly detection', 'كشف الشذوذ بتعلّم الآلة')}</dt><dd>${L('The issues worth flagging are rule-based and already shown above: below-cost items, unpicked backorders, concentration. A model would add opacity, not evidence.', 'الحالات الجديرة بالتنبيه قائمة على قواعد وظاهرة أعلاه بالفعل: أصناف دون التكلفة، وطلبات مؤجلة غير مُجهَّزة، وتركّز. والنموذج سيضيف غموضًا لا دليلًا.')}</dd></div>
      </dl>
    </details>
  </section>`;
}

/* ================================================================== wiring for instruments 2, 4 and 5 */
function wireLoss(root: HTMLElement, ds: SupplyChainDataset, cleanup: (() => void)[]) {
  const r = lossAnatomy(ds);
  const p = new PulseStrip(root.querySelector<HTMLElement>('.lab-pulse-host')!, money);
  p.update(r.byMonth.map((x) => ({ y: ds.months[x.mi].y, m: ds.months[x.mi].m, lines: x.lines, loss: x.loss })));
  cleanup.push(() => p.destroy());
}

function wireSupply(root: HTMLElement, ds: SupplyChainDataset, cleanup: (() => void)[]) {
  const r = supplierDependence(ds);
  supplierRing(root.querySelector<HTMLElement>('.lab-ring-host')!, r.rows.filter((x) => x.spend > 0).map((x) => ({ label: x.label, share: x.spendShare, pos: x.pos, group: x.group })), r.hhi.spend, HHI_HIGH);
  const strip = new Strip(root.querySelector<HTMLElement>('.lab-strip-host')!);
  const rows = r.rows.filter((x) => x.received > 0).map((x) => {
    const pos = ds.purchaseOrders.filter((p) => p.s === x.s && p.leadDays !== null);
    return { key: x.s, label: x.label, values: pos.map((p) => p.leadDays as number), late: pos.map((p) => p.onTime === false), promise: x.promise };
  });
  strip.update(rows);
  cleanup.push(() => strip.destroy());
}

function wireStock(root: HTMLElement, ds: SupplyChainDataset, cleanup: (() => void)[]) {
  const hist = new CoverHistogram(root.querySelector<HTMLElement>('.lab-hist-host')!, money);
  const fams = new BarList(root.querySelector<HTMLElement>('.stock-fams')!, { color: 'var(--ember)', format: money, limit: 8 });
  const input = root.querySelector<HTMLInputElement>('#cover-policy')!;
  const out = root.querySelector<HTMLOutputElement>('output[for="cover-policy"]')!;
  const claimsHost = root.querySelector<HTMLElement>('.stock-claims')!;
  let frame = 0, settle = 0;
  const apply = (final: boolean) => {
    const months = Number(input.value);
    const r = stockCapital(ds, months);
    const label = L(`${months} months`, `${int(months)} شهرًا`);
    out.textContent = label;
    input.setAttribute('aria-valuetext', label);
    hist.update(r.bands, months);
    root.querySelector<HTMLElement>('[data-excess]')!.textContent = money(r.excess);
    root.querySelector<HTMLElement>('[data-excess-note]')!.textContent = L(`${pct(r.excessShare)} of ${money(r.value)} at cost`, `${pct(r.excessShare)} من ${money(r.value)} بالتكلفة`);
    if (!final) return;
    fams.update(r.families.filter((f) => f.excess > 0).map((f) => ({ key: f.c, label: famName(f.label), value: f.excess })), null);
    claimsHost.innerHTML = stockClaims(ds, months);
  };
  apply(true);
  input.addEventListener('input', () => {
    cancelAnimationFrame(frame); frame = requestAnimationFrame(() => apply(false));
    clearTimeout(settle); settle = window.setTimeout(() => apply(true), 220);
  });
  cleanup.push(() => { cancelAnimationFrame(frame); clearTimeout(settle); hist.destroy(); });
}

/* ================================================================== page */
const page: Page & { cleanup: (() => void)[] } = {
  cleanup: [],
  async mount(root) {
    root.innerHTML = `<div class="lab page-pad">${loadingState()}</div>`;
    const result = await getDataset();
    const ds = result.state === 'ready' ? result.dataset : null;
    const intro = pageHeader('lab', L('Analytics Lab', 'مختبر التحليلات'),
      L('Instruments for the questions the dashboards cannot answer on their own. Each one separates what the data shows from what it suggests and what we would do about it.', 'أدوات للأسئلة التي لا تجيب عنها لوحات المؤشرات وحدها. وكل أداة تفصل بين ما تُظهره البيانات وما توحي به وما نقترح فعله.'),
      `<div class="lab-key" aria-label="${L('How to read the statements', 'كيف تُقرأ العبارات')}">
        ${(['finding', 'calc', 'hypothesis', 'rec'] as Kind[]).map((k) => `<span class="key key-${k}"><span aria-hidden="true" class="claim-mark"></span>${KIND()[k]}</span>`).join('')}
        <span class="key-status">${statusBadge('unverified', L('Website analysis · not reviewed by the team', 'تحليل الموقع · لم يراجعه الفريق'))}</span>
      </div>`);
    root.innerHTML = `
    <div class="lab page-pad">
      ${intro}
      ${ds ? `
      <nav class="lab-index" aria-label="${L('Instruments', 'الأدوات')}">
        <a href="#/lab" data-jump="lab-abc"><span class="num">01</span>${L('Profit map', 'خريطة الربحية')}</a>
        <a href="#/lab" data-jump="lab-loss"><span class="num">02</span>${L('Loss lines', 'الأسطر الخاسرة')}</a>
        <a href="#/lab" data-jump="lab-leak"><span class="num">03</span>${L('Fulfilment leakage', 'تسرّب التنفيذ')}</a>
        <a href="#/lab" data-jump="lab-supply"><span class="num">04</span>${L('Supplier dependence', 'الاعتماد على الموردين')}</a>
        <a href="#/lab" data-jump="lab-stock"><span class="num">05</span>${L('Capital in stock', 'رأس المال في المخزون')}</a>
        <a href="#/lab" data-jump="lab-forecast"><span class="num">06</span>${L('Forecast check', 'فحص التوقّع')}</a>
        <a href="#/lab" data-jump="lab-recs" class="to-recs"><span class="num" aria-hidden="true">→</span>${L('Recommendations', 'التوصيات')}</a>
      </nav>
      ${abcSection(ds)}
      ${lossSection(ds)}
      ${leakSection(ds)}
      ${supplierSection(ds)}
      ${stockSection(ds)}
      ${forecastSection(ds)}
      ${closingSection(ds)}` : result.state !== 'ready' ? `<div class="section">${dataStatePanel(result, '/lab')}</div>` : ''}
      ${nextChapter('lab', L('How the data was profiled, cleaned, modelled and reconciled.', 'كيف حُلّلت البيانات ونُظّفت ونُمذجت وطوبقت.'))}
      ${siteFooter()}
    </div>`;
    if (!ds) return;
    // draw the profit map on the next frame, so the page text paints first and no single task carries both
    let first = requestAnimationFrame(() => { first = 0; wireAbc(root, ds, this.cleanup); });
    this.cleanup.push(() => cancelAnimationFrame(first));
    // build each instrument's charts as it approaches the viewport: the page opens without drawing ~2,400 SVG marks at once
    const later: [string, (r: HTMLElement, d: SupplyChainDataset, c: (() => void)[]) => void][] = [['#lab-loss', wireLoss], ['#lab-leak', wireLeak], ['#lab-supply', wireSupply], ['#lab-stock', wireStock], ['#lab-forecast', wireForecast]];
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        later.find(([sel]) => e.target.matches(sel))?.[1](root, ds, this.cleanup);
      }), { rootMargin: '1200px 0px' });
      later.forEach(([sel]) => { const el = root.querySelector(sel); if (el) io.observe(el); });
      this.cleanup.push(() => io.disconnect());
    } else later.forEach(([, f]) => f(root, ds, this.cleanup));
    let settleJump = 0;
    this.cleanup.push(() => clearTimeout(settleJump));
    // in-page jumps (index and "See the evidence" links) without touching the hash router
    root.querySelector('.lab')!.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-jump]');
      if (!a) return;
      e.preventDefault();
      const t = root.querySelector<HTMLElement>(`#${a.dataset.jump}`)!;
      t.scrollIntoView({ behavior: motion.still ? 'auto' : 'smooth', block: 'start' });
      // sections not yet rendered (content-visibility) or charted (lazy wiring) use estimated heights, so the first
      // scroll can land short; once it ends, re-align until the heading stays put (a few passes at most)
      clearTimeout(settleJump);
      const settle = (n: number, last: number) => {
        const top = t.getBoundingClientRect().top;
        if (n > 0 && Math.abs(top - last) > 2) { t.scrollIntoView({ block: 'start' }); settleJump = window.setTimeout(() => settle(n - 1, top), 160); }
      };
      settleJump = window.setTimeout(() => { t.scrollIntoView({ block: 'start' }); settleJump = window.setTimeout(() => settle(5, Infinity), 160); }, motion.still ? 60 : 900);
      t.querySelector<HTMLElement>('h2')?.setAttribute('tabindex', '-1');
      t.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    });
    const lab = root.querySelector<HTMLElement>('.lab')!;
    lab.classList.toggle('still', motion.still);
    this.cleanup.push(revealOnScroll(root), motion.subscribe(() => lab.classList.toggle('still', motion.still)));
  },
  unmount() { this.cleanup.splice(0).forEach((f) => f()); tip(null); },
};
export default page;
