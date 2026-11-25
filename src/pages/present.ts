import '../styles/hub.css';
import '../styles/present.css';
import { gsap } from 'gsap';
import type { Page } from '../lib/router';
import type { Rig } from '../scene/Sky';
import { stage, direct } from '../scene/stage';
import { motion } from '../lib/motion';
import { getDataset, type DataResult } from '../data/adapter';
import { analyse, type Analysis } from '../data/analysis';
import type { SupplyChainDataset } from '../data/types';
import { revenue, grossProfit } from '../data/measures';
import { STAGES } from '../content/journey';
import { MEMBERS } from '../content/site';
import { TEAM_FINDINGS } from '../content/findings';
import { statusBadge } from '../components/shell';
import { dataBadge, dataStatePanel } from '../components/datastate';
import { Trend, BarList, tip } from '../charts/kit';
import { PulseStrip, supplierRing, BacktestChart } from '../charts/lab';
import { abcMatrix, lossAnatomy, leakage, supplierDependence, stockCapital, forecastCheck, HHI_HIGH } from '../data/lab';
import { simulate, breakEven, BASELINE } from '../data/sim';
import { ProfitBridge } from '../charts/sim';
import '../styles/sim.css';
import '../styles/lab.css';
import { esc } from '../lib/format';
import { i18n, L, tr, segName, famName, pct, money, int, monthLabel, fmtDate } from '../i18n';

/**
 * Presentation Mode: the graduation discussion as a keyboard-driven sequence over the persistent sky.
 * It reuses the site's data layer, analysis, charts and content; nothing is duplicated as static text
 * where the data can say it. Keys: → / Space / Page Down next, ← / Page Up back (mirrored in Arabic),
 * Home / End, F fullscreen, Esc leaves. The slide number is kept in the URL (`#/present?s=4`).
 */
type Slide = { id: string; kicker: () => string; rig: Partial<Rig>; html: () => string; after?: (el: HTMLElement) => void };

const BASE = import.meta.env.BASE_URL;
const side = () => (i18n.rtl ? -1 : 1);
const R = (r: Partial<Rig>): Partial<Rig> => ({ draw: 1, lines: 1, warp: 0, fade: 1, shiftY: 0, stars: 1, focus: 0, ...r, plateX: (r.plateX ?? 0) * side() });

function slides(result: DataResult, ds: SupplyChainDataset | null, a: Analysis | null, ready: string, charts: { destroy(): void }[]): Slide[] {
  const leader = MEMBERS.find((m) => m.leader)!;
  const kpi = (v: string, label: string, note = '') => `<div class="pk"><p class="pk-v num">${v}</p><p class="pk-l">${label}</p>${note ? `<p class="pk-n">${note}</p>` : ''}</div>`;
  const needData = (body: () => string) => () => (ds && a ? body() : ready);
  return [
    {
      id: 'title', kicker: () => L('DEPI Graduation Project', 'مشروع تخرج DEPI'), rig: R({ p: 0, dist: 25, elev: 0.42, azim: 0, lookY: 1.2, plateX: 6.2 }),
      html: () => `
        <h1 class="display ps-title" dir="ltr">WWI Supply Chain<br/><em>Intelligence</em></h1>
        <p class="ps-lede">${L('Reconciling the sales, purchasing and inventory records of a wholesale business into one analytical model, a Power BI report and evidence-backed recommendations.', 'توحيد سجلات المبيعات والمشتريات والمخزون لشركة جملة في نموذج تحليلي واحد، وتقرير Power BI، وتوصيات مدعومة بالأدلة.')}</p>
        <p class="ps-meta">${L('Professional Data Analyst track', 'مسار محلل البيانات المحترف')} · ${L('Team leader', 'قائد الفريق')}: ${esc(tr(leader.name))}</p>`,
    },
    {
      id: 'problem', kicker: () => L('The business problem', 'مشكلة العمل'), rig: R({ p: 0, dist: 21.5, elev: 0.3, azim: -0.22, lookY: 4.2, plateX: 8.6 }),
      html: () => `
        <h2 class="display ps-h">${L('One company, three ledgers that do not line up.', 'شركة واحدة، وثلاثة سجلات لا تتطابق.')}</h2>
        <ul class="ps-points">
          <li><b>${L('Different grains', 'مستويات تفصيل مختلفة')}</b> ${L('order line, invoice line, purchase-order line, stock transaction', 'سطر الطلب، وسطر الفاتورة، وسطر أمر الشراء، ومعاملة المخزون')}</li>
          <li><b>${L('Different units', 'وحدات مختلفة')}</b> ${L('single items for sales, outer packs for purchasing', 'قطع مفردة للمبيعات، وعبوات خارجية للمشتريات')}</li>
          <li><b>${L('Different dates', 'تواريخ مختلفة')}</b> ${L('ordered, invoiced, expected, received', 'الطلب، والفوترة، والتوقع، والاستلام')}</li>
        </ul>
        <p class="ps-lede">${L('Management could not follow demand from order to pick to invoice, or see the products, suppliers and stock behind the results.', 'لم تستطع الإدارة تتبّع الطلب من الطلبية إلى التجهيز إلى الفاتورة، ولا رؤية المنتجات والموردين والمخزون وراء النتائج.')}</p>`,
    },
    {
      id: 'data', kicker: () => L('The data', 'البيانات'), rig: R({ p: 1, dist: 23.5, elev: 0.8, azim: -0.42, lookY: 0.4, plateX: 7.2 }),
      html: needData(() => `
        <h2 class="display ps-h">${L(`${ds!.months.length} months of a wholesale business.`, `${ds!.months.length} شهرًا من عمل شركة جملة.`)}</h2>
        <div class="pk-grid">
          ${kpi(int(a!.totals.customers), L('customers in five segments', 'عميلًا في خمس شرائح'))}
          ${kpi(int(a!.totals.items), L('stock items', 'صنفًا في المخزون'))}
          ${kpi(int(a!.totals.orders), L('customer orders', 'طلبًا من العملاء'))}
          ${kpi(int(ds!.purchaseOrders.length), L('purchase orders', 'أمر شراء'))}
        </div>
        <p class="ps-note">${dataBadge(result)} ${fmtDate(ds!.provenance.coverage.from)} – ${fmtDate(ds!.provenance.coverage.to)}</p>`),
    },
    {
      id: 'method', kicker: () => L('Method', 'المنهجية'), rig: R({ p: 2, dist: 27, elev: 0.1, azim: 0.18, lookY: 3.6, plateX: 7.4 }),
      html: () => `
        <h2 class="display ps-h">${L('Seven stages, source to recommendation.', 'سبع مراحل، من المصدر إلى التوصية.')}</h2>
        <ol class="ps-stages">${STAGES.map((s, i) => `<li><span class="num">${i + 1}</span><b>${tr(s.title)}</b>${statusBadge(s.state)}</li>`).join('')}</ol>`,
    },
    {
      id: 'engineering', kicker: () => L('Engineering', 'الهندسة'), rig: R({ p: 2, dist: 17, elev: 1.2, azim: 0.4, lookY: 8.4, plateX: 7.4, focus: 1 }),
      html: () => `
        <h2 class="display ps-h">${L('Layers, a star schema, and proof.', 'طبقات، ومخطط نجمي، وإثبات.')}</h2>
        <ol class="ps-layers">
          <li><span class="num">48</span>${L('Bronze tables', 'جدولًا برونزيًا')}</li>
          <li><span class="num">31</span>${L('Silver tables, 14 Python cleaners', 'جدولًا فضيًا، 14 مكوّن تنظيف')}</li>
          <li><span class="num">18</span>${L('Gold views', 'عرضًا ذهبيًا')}</li>
          <li><span class="num">14</span>${L('model tables, 42 DAX measures', 'جدولًا في النموذج، 42 مقياس DAX')}</li>
        </ol>
        <div class="pk-grid pk-tests">
          ${kpi('22/22', L('KPIs: SQL = DAX', 'مؤشرًا: SQL = DAX'))}
          ${kpi('81/81', L('visual queries', 'استعلامًا مرئيًا'))}
          ${kpi('4/4', L('integrity tests', 'اختبارات سلامة'))}
          ${kpi('12', L('source reconciliations', 'مطابقة مع المصدر'))}
        </div>
        <p class="ps-note">${statusBadge('pending', L('From project files; team approval pending', 'من ملفات المشروع؛ الاعتماد بانتظار الفريق'))}</p>`,
    },
    {
      id: 'kpis', kicker: () => L('The numbers', 'الأرقام'), rig: R({ p: 3, dist: 26, elev: 0.55, azim: 0.55, lookY: 2, plateX: 7.4 }),
      html: needData(() => `
        <h2 class="display ps-h">${L('Reconciled to the cent.', 'مطابقة حتى آخر سنت.')}</h2>
        <div class="pk-grid">
          ${kpi(money(a!.totals.revenue), L('net revenue', 'صافي الإيرادات'))}
          ${kpi(pct(a!.totals.margin), L('recorded gross margin', 'الهامش الإجمالي المسجَّل'))}
          ${kpi(pct(a!.totals.fill, 2), L('unit fill rate', 'معدل تلبية الوحدات'))}
          ${kpi(pct(a!.totals.onTime, 2), L('on-time delivery', 'التسليم في الموعد'))}
        </div>
        <div class="ps-chart" data-chart="rev"></div>
        <p class="ps-note">${L('Every figure is recomputed from the source exports and matches the team’s 13 SQL benchmarks exactly.', 'كل رقم مُعاد حسابه من مستخرجات المصدر ومطابق تمامًا لمعايير الفريق الثلاثة عشر المحسوبة بـ SQL.')}</p>`),
      after: (el) => {
        const box = el.querySelector<HTMLElement>('[data-chart=rev]');
        if (!box || !ds) return;
        const t = new Trend(box); charts.push(t);
        const D = ds; const by = (k: (r: SupplyChainDataset["facts"]) => number) => D.months.map((m) => k(D.facts.filter((x) => x.mi === m.i)));
        t.update({ labels: ds.months.map((m) => monthLabel(m.y, m.m)), ticks: ds.months.filter((m) => m.m === 0).map((m) => ({ i: m.i, text: String(m.y) })), format: money, series: [
          { key: 'r', name: L('Net revenue', 'صافي الإيرادات'), color: 'var(--glacier)', fill: true, values: by(revenue) },
          { key: 'p', name: L('Recorded gross profit', 'الربح الإجمالي المسجَّل'), color: 'var(--brass)', values: by(grossProfit) },
        ] });
      },
    },
    {
      id: 'explore', kicker: () => L('Live analytics', 'تحليلات حية'), rig: R({ p: 3, dist: 38, elev: 1.02, azim: 0.9, lookY: 0, plateX: 7, lines: 0.45 }),
      html: needData(() => `
        <h2 class="display ps-h">${L('Ask the data directly.', 'اسأل البيانات مباشرة.')}</h2>
        <p class="ps-lede">${L('Select a segment to redraw its monthly revenue. The same engine drives the Observatory.', 'اختر شريحة لإعادة رسم إيراداتها الشهرية. وهو المحرك نفسه الذي يشغّل المرصد.')}</p>
        <div class="ps-explore"><div class="ps-bars"></div><div class="ps-chart" data-chart="seg"></div></div>`),
      after: (el) => {
        if (!ds || !a) return;
        const box = el.querySelector<HTMLElement>('[data-chart=seg]')!, bars = el.querySelector<HTMLElement>('.ps-bars')!;
        const t = new Trend(box); charts.push(t);
        let pick: number | null = null;
        const ticks = ds.months.filter((m) => m.m === 0).map((m) => ({ i: m.i, text: String(m.y) }));
        const draw = () => {
          const rows = ds.facts.filter((x) => pick === null || x.t === pick);
          t.update({ labels: ds.months.map((m) => monthLabel(m.y, m.m)), ticks, format: money, series: [{ key: 's', name: pick === null ? L('All segments', 'كل الشرائح') : segName(ds.territories[pick]), color: 'var(--glacier)', fill: true, values: ds.months.map((m) => revenue(rows.filter((x) => x.mi === m.i))) }] });
          list.update(a.segments.map((s) => ({ key: s.t, label: segName(s.label), value: s.revenue })), pick);
        };
        const list = new BarList(bars, { color: 'var(--glacier)', format: money, onPick: (k) => { pick = pick === k ? null : k; draw(); } });
        draw();
      },
    },
    {
      id: 'team-findings', kicker: () => L('The team’s findings', 'نتائج الفريق'), rig: R({ p: 3, dist: 26, elev: 0.55, azim: 0.2, lookY: 2, plateX: 7.4 }),
      html: () => `
        <h2 class="display ps-h">${L('Four decisions the data supports.', 'أربعة قرارات تدعمها البيانات.')}</h2>
        <ol class="ps-findings">${TEAM_FINDINGS.slice(0, 4).map((f) => {
          const r = a && ds?.provenance.status !== 'synthetic' ? f.recheck(a) : null;
          const ok = r ? Math.abs(r.got - r.expected) <= (r.unit === 'pct' ? 5e-5 : r.unit === 'money' ? 0.005 : 0) : null;
          return `<li><span class="num">${f.rank}</span><div><b>${tr(f.question)}</b><p>${tr(f.finding)}</p>${ok === null ? '' : `<span class="tf-check ${ok ? 'is-ok' : 'is-off'}">${ok ? '✓' : '≠'} ${ok ? L('Website recheck matches', 'إعادة التحقق في الموقع مطابقة') : L('Website recheck differs', 'إعادة التحقق في الموقع مختلفة')}</span>`}</div></li>`;
        }).join('')}</ol>
        <p class="ps-note">${statusBadge('pending', L('Team finding · approval pending', 'نتيجة الفريق · بانتظار الاعتماد'))}</p>`,
    },
    {
      id: 'web-findings', kicker: () => L('Beyond the brief', 'أبعد من الموجز'), rig: R({ p: 1, dist: 30, elev: 0.9, azim: -0.3, lookY: 0.4, plateX: 7.2 }),
      html: needData(() => {
        const d = a!.demand, inv = a!.inventory, pu = a!.purchasing;
        const f0 = d.families[0], f1 = d.families[1];
        return `
        <h2 class="display ps-h">${L('Stock sits where demand is already met.', 'المخزون يتكدس حيث يُلبّى الطلب أصلًا.')}</h2>
        <div class="pk-grid">
          ${f0 ? kpi(pct(f0.share + (f1?.share ?? 0), 0), L(`of unpicked units are in ${famName(ds!.categories[f0.c])}${f1 ? ` and ${famName(ds!.categories[f1.c])}` : ''}`, `من الوحدات غير المجهَّزة في ${famName(ds!.categories[f0.c])}${f1 ? ` و${famName(ds!.categories[f1.c])}` : ''}`)) : ''}
          ${inv.shortest ? kpi(L(`${int(inv.shortest.cover)} mo`, `${int(inv.shortest.cover)} شهرًا`), L(`median cover in ${famName(ds!.categories[inv.shortest.c])}, the family that runs short`, `وسيط التغطية في ${famName(ds!.categories[inv.shortest.c])}، العائلة التي تعاني النقص`)) : ''}
          ${inv.longest ? kpi(L(`${int(inv.longest.cover)} mo`, `${int(inv.longest.cover)} شهرًا`), L(`median cover in ${famName(ds!.categories[inv.longest.c])}`, `وسيط التغطية في ${famName(ds!.categories[inv.longest.c])}`)) : ''}
          ${pu.growth ? kpi(`${pu.growth.toFixed(1)}×`, L(`growth in purchase-order value, ${pu.years[0].year}–${pu.years[pu.years.length - 1].year}`, `نمو قيمة أوامر الشراء، ${pu.years[0].year}–${pu.years[pu.years.length - 1].year}`)) : ''}
        </div>
        <p class="ps-note">${ds!.provenance.status === 'synthetic' ? statusBadge('synthetic') : statusBadge('unverified', L('Website analysis · not reviewed by the team', 'تحليل الموقع · لم يراجعه الفريق'))}</p>`;
      }),
    },
    {
      id: 'lab-profit', kicker: () => L('Analytics Lab · Profit', 'مختبر التحليلات · الربحية'), rig: R({ p: 3, dist: 40, elev: 1.1, azim: -0.6, lookY: 1.4, plateX: 7.2, lines: 0.5 }),
      html: needData(() => {
        const abc = abcMatrix(ds!, 'revenue'), lo = lossAnatomy(ds!), [st] = lo.patterns;
        const aLow = abc.rows.filter((x) => x.cls === 'A' && !x.highMargin).length, aAll = abc.rows.filter((x) => x.cls === 'A').length;
        return `
        <h2 class="display ps-h">${L('Profit is concentrated, and the losses are not random.', 'الربح متركّز، والخسائر ليست عشوائية.')}</h2>
        <div class="pk-grid">
          ${kpi(pct(abc.pareto.share), L(`of revenue from the top 20% of items (${int(abc.pareto.items)} of ${int(abc.rows.length)})`, `من الإيرادات من أعلى 20٪ من الأصناف (${int(abc.pareto.items)} من ${int(abc.rows.length)})`))}
          ${kpi(`${int(aLow)}/${int(aAll)}`, L('class-A items earn below the median margin', 'من أصناف الفئة A هامشها دون الوسيط'))}
          ${kpi(pct(st.lineShare), L(`of the ${int(lo.total.lines)} loss-making lines are on ${int(st.items)} items priced below cost`, `من ${int(lo.total.lines)} سطرًا خاسرًا تقع على ${int(st.items)} أصناف سعرها دون التكلفة`), lo.k80Structural ? L(`They are also the fewest items that pass 80% of loss lines.`, 'وهي أيضًا أقل عدد من الأصناف يتجاوز 80٪ من الأسطر الخاسرة.') : '')}
          ${kpi(`${int(lo.activeMonths)}/${int(lo.months)}`, L('months with loss-making lines', 'شهرًا فيها أسطر خاسرة'))}
        </div>
        <div class="ps-lab-chart" data-chart="pulse"></div>
        <p class="ps-note">${statusBadge('unverified', L('Website analysis · not reviewed by the team', 'تحليل الموقع · لم يراجعه الفريق'))} <a class="text-link" href="#/lab">${L('Open the Analytics Lab', 'افتح مختبر التحليلات')}</a></p>`;
      }),
      after: (el) => {
        if (!ds) return;
        const lo = lossAnatomy(ds);
        const p = new PulseStrip(el.querySelector<HTMLElement>('[data-chart=pulse]')!, money); charts.push(p);
        p.update(lo.byMonth.map((x) => ({ y: ds.months[x.mi].y, m: ds.months[x.mi].m, lines: x.lines, loss: x.loss })));
      },
    },
    {
      id: 'lab-supply', kicker: () => L('Analytics Lab · Supply and stock', 'مختبر التحليلات · التوريد والمخزون'), rig: R({ p: 0, dist: 40, elev: 0.95, azim: -0.5, lookY: 3, plateX: 7, lines: 0.5 }),
      html: needData(() => {
        const su = supplierDependence(ds!), lk = leakage(ds!), sc = stockCapital(ds!, 12);
        return `
        <h2 class="display ps-h">${L('Manage dependence and stock, not punctuality.', 'أدِر الاعتماد والمخزون، لا الالتزام بالمواعيد.')}</h2>
        <div class="ps-explore">
          <div class="ps-lab-ring" data-chart="ring"></div>
          <div class="pk-grid ps-lab-k">
            ${kpi(`${int(su.singleSourced.length)}/${int(su.families.length)}`, L('product families with a single supplier', 'عائلات منتجات لها مورد واحد'))}
            ${kpi(su.hhi.spend.toFixed(2), L('spend concentration (HHI), descriptive only', 'تركّز الإنفاق (HHI)، وصفي فقط'), L(`Lead times ${int(su.lead.min)}–${int(su.lead.max)} days, all on time: nothing to rank.`, `مدد التوريد ${int(su.lead.min)}–${int(su.lead.max)} أيام، وكلها في موعدها: لا شيء للترتيب.`))}
            ${kpi(pct(lk.rate), L('of ordered units never picked, rising each complete year', 'من الوحدات المطلوبة لم تُجهَّز، وتزداد كل سنة كاملة'))}
            ${kpi(L(`${int(sc.cover.median)} mo`, `${int(sc.cover.median)} شهرًا`), L('median stock cover per item', 'وسيط تغطية المخزون للصنف'), L(`${pct(sc.excessShare)} of stock value sits beyond 12 months.`, `${pct(sc.excessShare)} من قيمة المخزون تتجاوز 12 شهرًا.`))}
          </div>
        </div>
        <p class="ps-note">${statusBadge('unverified', L('Website analysis · not reviewed by the team', 'تحليل الموقع · لم يراجعه الفريق'))} <a class="text-link" href="#/lab">${L('Open the Analytics Lab', 'افتح مختبر التحليلات')}</a></p>`;
      }),
      after: (el) => {
        if (!ds) return;
        const su = supplierDependence(ds);
        supplierRing(el.querySelector<HTMLElement>('[data-chart=ring]')!, su.rows.filter((x) => x.spend > 0).map((x) => ({ label: x.label, share: x.spendShare, pos: x.pos, group: x.group })), su.hhi.spend, HHI_HIGH);
      },
    },
    {
      id: 'lab-forecast', kicker: () => L('Analytics Lab · Forecast check', 'مختبر التحليلات · فحص التوقّع'), rig: R({ p: 3, dist: 44, elev: 1.15, azim: 0.2, lookY: 1, plateX: 7, lines: 0.4 }),
      html: needData(() => {
        const f = forecastCheck(ds!), [h1, h3] = f.horizons;
        if (!h1.n || !h1.best) return ready;
        const naive = (h: typeof h1) => h.models.find((m) => m.model === 'naive')!;
        return `
        <h2 class="display ps-h">${f.skilful ? L('One simple rule beat “last month” at every horizon.', 'قاعدة بسيطة واحدة تفوّقت على «الشهر السابق» في كل أفق.') : L('No simple rule beat “last month” at every horizon.', 'لم تتفوّق أي قاعدة بسيطة على «الشهر السابق» في كل أفق.')}</h2>
        <div class="pk-grid">
          ${kpi(pct(h1.best.mape), L(`average miss one month ahead (best rule), against ${pct(naive(h1).mape)} for “last month”`, `متوسط الفارق لشهر واحد (أفضل قاعدة)، مقابل ${pct(naive(h1).mape)} لـ«الشهر السابق»`))}
          ${kpi(pct((h3.best ?? naive(h3)).mape), h3.beatsNaive ? L('average miss three months ahead (best rule)', 'متوسط الفارق لثلاثة أشهر (أفضل قاعدة)') : L('average miss three months ahead; nothing beat “last month”', 'متوسط الفارق لثلاثة أشهر؛ لم يتفوّق شيء على «الشهر السابق»'))}
          ${kpi(`<bdi dir="ltr">${int(h3.n)}–${int(h1.n)}</bdi>`, L('past months scored, each forecast from earlier data only', 'شهرًا سابقًا مُقيَّمًا، كل توقّع من بيانات أسبق فقط'))}
          ${kpi(L('None', 'لا يوجد'), L('forward forecast published', 'توقّع مستقبلي منشور'), L('A historical miss is not a prediction interval.', 'الفارق التاريخي ليس فترة تنبؤ.'))}
        </div>
        <div class="ps-lab-chart" data-chart="backtest"></div>
        <p class="ps-note">${statusBadge('unverified', L('Methodology demo · historical backtest, not a forecast', 'عرض منهجي · اختبار رجعي تاريخي، لا توقّع'))} <a class="text-link" href="#/lab">${L('Open the Analytics Lab', 'افتح مختبر التحليلات')}</a></p>`;
      }),
      after: (el) => {
        if (!ds) return;
        const f = forecastCheck(ds), best = f.horizons[0].best, host = el.querySelector<HTMLElement>('[data-chart=backtest]');
        if (!host || !best) return;
        const names = { naive: L('Last month', 'الشهر السابق'), seasonal: L('Same month last year', 'الشهر نفسه من العام السابق'), avg3: L('3-month average', 'متوسط 3 أشهر'), avg12: L('12-month average', 'متوسط 12 شهرًا') };
        const c = new BacktestChart(host, true); charts.push(c);
        c.update({ months: ds.months, actual: f.series.map((x) => x.value), warmup: f.warmup, points: best.points, model: names[best.model], h: 1, fmt: money });
      },
    },
    {
      id: 'sim-price', kicker: () => L('Decision Simulator · Price', 'محاكي القرار · السعر'), rig: R({ p: 3, dist: 38, elev: 0.85, azim: -1.4, lookY: 1.5, plateX: 7, lines: 0.5 }),
      html: needData(() => {
        const p = 0.05, scope = { kind: 'all' } as const;
        const be = breakEven(ds!, scope, p);
        if (be.kind !== 'floor') return ready;
        const r0 = simulate(ds!, { ...BASELINE, price: { scope, change: p } });
        const opts = [0, -1, -2, -3];
        return `
        <h2 class="display ps-h">${L(`A ${pct(p, 0)} price rise pays, unless volume falls by more than ${pct(-be.volumeChange)}.`, `رفع الأسعار ${pct(p, 0)} مُجدٍ، ما لم تنخفض الكمية بأكثر من ${pct(-be.volumeChange)}.`)}</h2>
        <div class="pk-grid">
          ${kpi(`+${money(r0.delta)}`, L('gross profit at recorded volume: arithmetic, no assumption', 'إجمالي الربح عند الكمية المسجّلة: حساب بلا افتراض'))}
          ${kpi(pct(-be.volumeChange), L('volume it could lose before profit falls below recorded', 'الكمية التي يمكن فقدها قبل أن ينخفض الربح عن المسجَّل'))}
          ${kpi(`<bdi dir="ltr">${(be.elasticity ?? 0).toFixed(2).replace('-', '−')}</bdi>`, L('break-even elasticity: customers would have to be more price-sensitive than this', 'مرونة التعادل: يجب أن يكون العملاء أشد حساسية للسعر من ذلك'))}
          <div class="pk ps-sim-pick">
            <p class="pk-l" id="ps-sim-lab">${L('Assume a volume response', 'افترض استجابة للكمية')}</p>
            <div class="ps-sim-opts" role="radiogroup" aria-labelledby="ps-sim-lab">
              ${opts.map((e) => `<label><input type="radio" name="ps-sim-e" value="${e}"${e === 0 ? ' checked' : ''}><span class="num" dir="ltr">${e === 0 ? '0' : `−${-e}`}</span></label>`).join('')}
            </div>
            <p class="pk-n" data-ps-sim-out aria-live="polite"></p>
          </div>
        </div>
        <div class="ps-lab-chart ps-sim-bridge" data-chart="bridge"></div>
        <p class="ps-note">${statusBadge('unverified', L('Scenario arithmetic · not a forecast, not a causal estimate', 'حساب سيناريو · لا توقّع ولا تقدير سببي'))} <a class="text-link" href="#/simulator?p=0.05&amp;ps=a" data-ps-sim-link>${L('Open this scenario in the Simulator', 'افتح هذا السيناريو في المحاكي')}</a></p>`;
      }),
      after: (el) => {
        if (!ds) return;
        const host = el.querySelector<HTMLElement>('[data-chart=bridge]');
        if (!host) return;
        const bridge = new ProfitBridge(host); charts.push(bridge);
        const draw = (e: number) => {
          const r = simulate(ds, { ...BASELINE, price: { scope: { kind: 'all' }, change: 0.05 }, elasticity: e });
          const st = (k: string) => r.steps.find((s) => s.key === k)!.delta;
          bridge.update(r.baseline.profit, [
            { key: 'price', label: L('Price +5%', 'السعر ‎+5%'), short: L('Price', 'السعر'), basis: 'decision', delta: st('price') },
            { key: 'volume', label: L('Volume response', 'استجابة الكمية'), short: L('Volume', 'الكمية'), basis: 'assumed', delta: st('volume') },
            { key: 'end', label: L('Scenario', 'السيناريو'), basis: 'total', delta: 0 },
          ]);
          const out = el.querySelector<HTMLElement>('[data-ps-sim-out]')!;
          const d = r.delta, sign = d >= 0 ? '+' : '−\u2060';
          const ev = `<bdi dir="ltr">−${-e}</bdi>`, mv = `<bdi>${esc(sign + money(Math.abs(d)))}</bdi>`;
          out.innerHTML = e === 0
            ? L(`Volume unchanged (an assumption): ${mv}. Nothing here says customers would behave this way.`, `الكمية ثابتة (افتراض): ${mv}. ولا شيء هنا يقول إن العملاء سيتصرفون هكذا.`)
            : L(`At an assumed elasticity of ${ev}: ${mv} vs recorded; ${pct(r.load.share, 0)} of the movement rests on the assumption.`, `عند مرونة مفترضة ${ev}: ${mv} مقابل المسجَّل؛ و${pct(r.load.share, 0)} من الحركة يستند إلى الافتراض.`);
          el.querySelector<HTMLAnchorElement>('[data-ps-sim-link]')!.href = `#/simulator?p=0.05&ps=a${e ? `&e=${e}` : ''}`;
        };
        el.querySelector('.ps-sim-opts')!.addEventListener('change', (ev) => draw(Number((ev.target as HTMLInputElement).value)));
        draw(0);
      },
    },
    {
      id: 'recs', kicker: () => L('Recommendations', 'التوصيات'), rig: R({ p: 0, dist: 30, elev: 0.5, azim: 0.4, lookY: 3, plateX: 7 }),
      html: () => `
        <h2 class="display ps-h">${L('What to do on Monday.', 'ما يجب فعله صباح الاثنين.')}</h2>
        <ol class="ps-recs">
          <li><b>${L('Sales', 'المبيعات')}</b> ${L('Verify cost and price on the four loss-making zombie-mask sizes; reprice or delist.', 'التحقق من تكلفة وسعر مقاسات قناع الزومبي الأربعة الخاسرة؛ ثم إعادة التسعير أو السحب.')}</li>
          <li><b>${L('Inventory', 'المخزون')}</b> ${L('Review replenishment for the short apparel sizes and packaging consumables first.', 'مراجعة إعادة التموين لمقاسات الملابس الناقصة ومستهلكات التغليف أولًا.')}</li>
          <li><b>${L('Purchasing', 'المشتريات')}</b> ${L('Reconcile purchase-order value with supplier invoices, and close the 25,949 open outers with Fabrikam and Litware.', 'مطابقة قيمة أوامر الشراء مع فواتير الموردين، وإغلاق 25,949 عبوة مفتوحة مع Fabrikam وLitware.')}</li>
          <li><b>${L('Operations', 'العمليات')}</b> ${L('Track the backorder rate monthly as a service KPI.', 'متابعة معدل التأجيل شهريًا مؤشرًا للخدمة.')}</li>
        </ol>
        <p class="ps-note">${statusBadge('pending', L('For the team’s review', 'لمراجعة الفريق'))}</p>`,
    },
    {
      id: 'team', kicker: () => L('The team', 'الفريق'), rig: R({ p: 0, dist: 34, elev: 0.75, azim: 0.6, lookY: 4, plateX: 6 }),
      html: () => `
        <h2 class="display ps-h">${L('Six people, one instrument.', 'ستة أشخاص، آلة واحدة.')}</h2>
        <ul class="ps-team">${MEMBERS.map((m) => `<li class="${m.leader ? 'is-lead' : ''}">${m.portrait ? `<img src="${BASE}team/${m.portrait}.webp" alt="" width="96" height="96" loading="lazy">` : `<span class="ps-mono" aria-hidden="true">${esc(tr(m.name).split(/\s+/).slice(0, 2).map((w) => [...w][0]).join(L('', ' ')))}</span>`}<b>${esc(tr(m.name))}</b><span>${m.leader ? `${L('Team leader', 'قائد الفريق')} · ` : ''}${tr(m.role)}</span></li>`).join('')}</ul>`,
    },
    {
      id: 'close', kicker: () => L('Thank you', 'شكرًا لكم'), rig: R({ p: 0, dist: 44, elev: 1.05, azim: 0.3, lookY: 0, plateX: 0, stars: 1 }),
      html: () => `
        <h2 class="display ps-title ps-close">${L('Questions?', 'أسئلتكم؟')}</h2>
        <div class="ps-status">
          <p>${statusBadge('completed')} ${L('Warehouse, model, report and reconciliation built and tested.', 'المستودع والنموذج والتقرير والمطابقة: بُنيت واختُبرت.')}</p>
          <p>${statusBadge('progress')} ${L('Slicer and drill-through testing; team approval of scope and model.', 'اختبار المقطّعات والتعمق؛ واعتماد الفريق للنطاق والنموذج.')}</p>
        </div>
        <p class="ps-meta">WWI Supply Chain Intelligence · ${L('DEPI Graduation Project', 'مشروع تخرج DEPI')}</p>`,
    },
  ];
}

const page: Page & { cleanup: (() => void)[] } = {
  cleanup: [],
  async mount(root) {
    const result = await getDataset();
    const ds = result.state === 'ready' ? result.dataset : null;
    const a = ds ? analyse(ds) : null;
    const charts: { destroy(): void }[] = [];
    const missing = result.state === 'ready' ? '' : dataStatePanel(result, '/present', { compact: true, headingId: 'ps-ds' });
    const S = slides(result, ds, a, missing, charts);
    const qs = new URLSearchParams(location.hash.split('?')[1] ?? '');
    let index = Math.min(S.length - 1, Math.max(0, Number(qs.get('s') ?? 1) - 1 || 0));
    document.body.classList.add('presenting');

    root.innerHTML = `
    <div class="present" role="region" aria-roledescription="${L('presentation', 'عرض تقديمي')}" aria-label="${L('Presentation mode', 'وضع العرض التقديمي')}">
      <div class="ps-stage">
        <section class="ps-slide" aria-roledescription="${L('slide', 'شريحة')}" aria-live="polite"></section>
      </div>
      <nav class="ps-bar" aria-label="${L('Presentation controls', 'أدوات التحكم في العرض')}">
        <a class="ps-exit" href="#/">${L('Exit', 'خروج')}</a>
        <div class="ps-progress" aria-hidden="true"><span></span></div>
        <p class="ps-count num" aria-live="off"></p>
        <button class="ps-btn ps-prev" type="button">${L('Previous', 'السابق')}</button>
        <button class="ps-btn ps-next" type="button">${L('Next', 'التالي')}</button>
        <button class="ps-btn ps-lang" type="button" lang="${i18n.rtl ? 'en' : 'ar'}">${i18n.rtl ? 'English' : 'العربية'}</button>
        <button class="ps-btn ps-full" type="button" aria-pressed="false">${L('Full screen', 'ملء الشاشة')}</button>
      </nav>
      <p class="sr-only">${L('Use the arrow keys or Space to move between slides, F for full screen, and Escape to leave.', 'استخدم مفاتيح الأسهم أو المسافة للتنقل بين الشرائح، وF لملء الشاشة، وEscape للخروج.')}</p>
    </div>`;

    const slideEl = root.querySelector<HTMLElement>('.ps-slide')!;
    const count = root.querySelector<HTMLElement>('.ps-count')!;
    const bar = root.querySelector<HTMLElement>('.ps-progress span')!;
    const prevBtn = root.querySelector<HTMLButtonElement>('.ps-prev')!, nextBtn = root.querySelector<HTMLButtonElement>('.ps-next')!;
    const still = () => motion.still;

    const render = (i: number) => {
      charts.splice(0).forEach((c) => c.destroy()); tip(null);
      const s = S[i];
      slideEl.dataset.slide = s.id;
      slideEl.setAttribute('aria-label', L(`Slide ${i + 1} of ${S.length}: ${s.kicker()}`, `الشريحة ${i + 1} من ${S.length}: ${s.kicker()}`));
      slideEl.innerHTML = `<p class="ps-kicker"><span class="num">${String(i + 1).padStart(2, '0')}</span> ${s.kicker()}</p>${s.html()}`;
      s.after?.(slideEl);
      count.textContent = `${i + 1} / ${S.length}`;
      bar.style.transform = `scaleX(${(i + 1) / S.length})`;
      prevBtn.disabled = i === 0; nextBtn.disabled = i === S.length - 1;
      history.replaceState(null, '', `#/present?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] ?? '')), s: String(i + 1) }).toString()}`);
    };
    const go = async (i: number, first = false) => {
      i = Math.max(0, Math.min(S.length - 1, i));
      if (i === index && !first) return;
      const dir = i > index ? 1 : -1;
      index = i;
      const sky = stage.sky;
      if (sky) { sky.ambient = false; direct(S[i].rig, first || still()); }
      if (first || still()) { render(i); return; }
      await gsap.to(slideEl, { opacity: 0, x: -24 * dir * side(), duration: 0.28, ease: 'power2.in' });
      render(i);
      gsap.fromTo(slideEl, { opacity: 0, x: 24 * dir * side() }, { opacity: 1, x: 0, duration: 0.6, ease: 'expo.out', clearProps: 'transform' });
      gsap.fromTo(slideEl.querySelectorAll('.ps-h, .ps-title, .pk, .ps-points li, .ps-stages li, .ps-layers li, .ps-findings li, .ps-recs li, .ps-team li'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.05, ease: 'expo.out', delay: 0.1, clearProps: 'transform' });
    };

    const fwd = () => (i18n.rtl ? 'ArrowLeft' : 'ArrowRight'), back = () => (i18n.rtl ? 'ArrowRight' : 'ArrowLeft');
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, select, textarea, .barlist, svg.trend, .bridge-svg')) return; // charts keep their own arrow keys
      if (e.key === fwd() || e.key === 'PageDown' || (e.key === ' ' && t.tagName !== 'BUTTON' && t.tagName !== 'A')) { e.preventDefault(); go(index + 1); }
      else if (e.key === back() || e.key === 'PageUp') { e.preventDefault(); go(index - 1); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(S.length - 1); }
      else if (e.key === 'f' || e.key === 'F') { toggleFull(); }
      else if (e.key === 'Escape' && !document.fullscreenElement) { location.hash = '#/'; }
    };
    const fullBtn = root.querySelector<HTMLButtonElement>('.ps-full')!;
    const toggleFull = () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
      else document.documentElement.requestFullscreen?.().catch(() => undefined);
    };
    const onFull = () => fullBtn.setAttribute('aria-pressed', String(!!document.fullscreenElement));
    // the router does not remount for a new ?s= on the same route (back/forward, an edited URL): follow it here
    const onHash = () => {
      const s = Number(new URLSearchParams(location.hash.split('?')[1] ?? '').get('s'));
      if (s >= 1 && s - 1 !== index) go(s - 1);
    };
    window.addEventListener('hashchange', onHash);
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFull);
    prevBtn.addEventListener('click', () => go(index - 1));
    nextBtn.addEventListener('click', () => go(index + 1));
    fullBtn.addEventListener('click', toggleFull);
    // the site-wide language switch remounts this page; the slide number survives in the URL
    root.querySelector<HTMLButtonElement>('.ps-lang')!.addEventListener('click', () => document.querySelector<HTMLButtonElement>('.lang-toggle')?.click());
    // clicking the stage (not a control) advances, as a clicker would
    slideEl.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('a, button, input, label, select, svg, .barlist, .ps-chart, .ps-sim-pick')) go(index + 1); });

    // the router directs the ambient rig after mount; the first slide's camera is set on the next frame
    requestAnimationFrame(() => go(index, true));
    this.cleanup.push(() => {
      window.removeEventListener('hashchange', onHash);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFull);
      document.body.classList.remove('presenting');
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
      charts.forEach((c) => c.destroy()); tip(null);
      if (stage.sky) stage.sky.ambient = true;
    });
  },
  unmount() { this.cleanup.forEach((f) => f()); this.cleanup = []; },
};
export default page;
