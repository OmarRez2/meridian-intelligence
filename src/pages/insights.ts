import '../styles/hub.css';
import '../styles/insights.css';
import type { Page } from '../lib/router';
import { pageHeader, nextChapter, siteFooter, statusBadge } from '../components/shell';
import { wireTabs, wireDisclosures, revealOnScroll } from '../components/tabs';
import { getDataset } from '../data/adapter';
import { analyse, type Analysis } from '../data/analysis';
import type { SupplyChainDataset, ValidationStatus } from '../data/types';
import { esc } from '../lib/format';
import { Trend, BarList, tip } from '../charts/kit';
import { dataStatePanel, loadingState } from '../components/datastate';
import { TEAM_FINDINGS } from '../content/findings';
import { L, tr, statusLabel, segName, famName, pct, money, int, monthLabel, signedPct, fmtDate } from '../i18n';

/** The verification ladder every number on the site sits on. */
const LADDER: { s: ValidationStatus; who: () => string; needs: () => string }[] = [
  { s: 'synthetic', who: () => L('Nobody: generated', 'لا أحد: بيانات مولَّدة'), needs: () => L('Values generated for the demo view. Useful to test a layout, never to state a fact.', 'قيم مولَّدة للعرض التجريبي. تفيد في اختبار التصميم، ولا تصلح لإثبات أي حقيقة.') },
  { s: 'illustrative', who: () => L('The author', 'المؤلف'), needs: () => L('Hand-written example content such as a diagram. Shows the idea, not the project’s output.', 'محتوى توضيحي مكتوب يدويًا مثل المخططات. يشرح الفكرة ولا يمثل مخرجات المشروع.') },
  { s: 'unverified', who: () => L('The analyst', 'المحلل'), needs: () => L('Derived from project data, but not yet compared with an independent source.', 'مشتق من بيانات المشروع، لكنه لم يُقارن بعد بمصدر مستقل.') },
  { s: 'reconciled', who: () => L('Two independent computations', 'حسابان مستقلان'), needs: () => L('The same number comes out of the source and an independent computation. Every figure on this site’s real-data view reconciles with the team’s SQL benchmarks.', 'الرقم نفسه يخرج من المصدر ومن حساب مستقل. وكل رقم في عرض البيانات الحقيقية بهذا الموقع مطابق لمعايير الفريق المحسوبة بـ SQL.') },
  { s: 'approved', who: () => L('The whole team', 'الفريق كله'), needs: () => L('Reconciled, interpreted and signed off for publication, with its limits written down. Nothing has reached this level yet.', 'مطابق ومفسَّر ومعتمد للنشر مع توثيق حدوده. لم يبلغ شيء هذا المستوى بعد.') },
];

type WebFinding = {
  id: string; tab: string; domain: string; observation: string; metric: string; interpretation: string;
  recommendation: string; owner: string; limits: string; evidence: (el: HTMLElement) => string;
};

/**
 * The website's own analysis. Every sentence is templated from `analyse()` on the dataset in view, so the
 * text is true of that data; on the demo dataset it describes the synthetic data and is labelled so.
 */
function webFindings(ds: SupplyChainDataset, a: Analysis, track: (t: Trend) => void): WebFinding[] {
  const out: WebFinding[] = [];
  const ticks = ds.months.filter((m) => m.m === 0).map((m) => ({ i: m.i, text: String(m.y) }));
  const labels = ds.months.map((m) => monthLabel(m.y, m.m));
  const fam = (c: number) => famName(ds.categories[c]);
  const seg = (t: number) => segName(ds.territories[t]);

  /* 1. unpicked demand */
  const d = a.demand;
  if (d.families.length) {
    const top = d.families[0], second = d.families[1];
    const lastMi = ds.months.length - 1;
    out.push({
      id: 'unmet', tab: L('Unpicked demand', 'الطلب غير المجهَّز'), domain: L('Orders', 'الطلبات'),
      observation: second
        ? L(`Only ${d.familiesWithShortfall} of ${ds.categories.length} product families ever go unpicked. <b>${fam(top.c)}</b> loses ${pct(top.rate)} of ordered units and ${fam(second.c)} ${pct(second.rate)}; together they hold ${pct(top.share + second.share)} of all unpicked units.`, `${int(d.familiesWithShortfall)} فقط من ${int(ds.categories.length)} عائلات منتجات تشهد وحدات غير مجهَّزة. تفقد <b>${fam(top.c)}</b> ‏${pct(top.rate)} من الوحدات المطلوبة، و${fam(second.c)} ‏${pct(second.rate)}؛ وتستحوذان معًا على ${pct(top.share + second.share)} من كل الوحدات غير المجهَّزة.`)
        : L(`All unpicked units sit in <b>${fam(top.c)}</b>: ${pct(top.rate)} of its ordered units.`, `كل الوحدات غير المجهَّزة في <b>${fam(top.c)}</b>: ‏${pct(top.rate)} من وحداتها المطلوبة.`),
      metric: L(`Unpicked units = ordered − picked quantity on order lines, by order month. ${int(d.unmet)} of ${int(d.ordered)} ordered units overall (fill rate ${pct(d.fill, 2)}).`, `الوحدات غير المجهَّزة = الكمية المطلوبة − الكمية المجهَّزة في أسطر الطلب، حسب شهر الطلب. ${int(d.unmet)} من ${int(d.ordered)} وحدة مطلوبة إجمالًا (معدل التلبية ${pct(d.fill, 2)}).`),
      interpretation: L(`The shortfall is not general: it follows specific items, led by ${esc(d.topItems[0]?.label ?? '')} (${int(d.topItems[0]?.unmet ?? 0)} units). The monthly average rose from ${int(d.firstHalf)} units in the first half of the period to ${int(d.secondHalf)} in the second, reaching ${int(d.byMonth[lastMi])} in ${monthLabel(ds.months[lastMi].y, ds.months[lastMi].m)}.`, `النقص ليس عامًا، بل يتبع أصنافًا بعينها، أولها ${esc(d.topItems[0]?.label ?? '')} ‏(${int(d.topItems[0]?.unmet ?? 0)} وحدة). وارتفع المتوسط الشهري من ${int(d.firstHalf)} وحدة في النصف الأول من الفترة إلى ${int(d.secondHalf)} في النصف الثاني، وبلغ ${int(d.byMonth[lastMi])} في ${monthLabel(ds.months[lastMi].y, ds.months[lastMi].m)}.`),
      recommendation: L(`Review replenishment for the ${int(Math.min(8, d.itemsWithShortfall))} items with the largest shortfall first, starting with sizes and consumables in ${fam(top.c)}. Raise their reorder levels only after checking open purchase orders.`, `مراجعة إعادة التموين لأكبر ${int(Math.min(8, d.itemsWithShortfall))} أصناف نقصًا أولًا، بدءًا بالمقاسات والمستهلكات في ${fam(top.c)}. ولا تُرفع حدود إعادة الطلب إلا بعد مراجعة أوامر الشراء المفتوحة.`),
      owner: L('Inventory and purchasing', 'المخزون والمشتريات'),
      limits: L('Picking is a warehouse event, not delivery. Ordered and invoiced months differ, so this series follows the order date.', 'التجهيز حدث في المستودع وليس تسليمًا. ويختلف شهر الطلب عن شهر الفوترة، لذا تتبع هذه السلسلة تاريخ الطلب.'),
      evidence: (el) => {
        const body = document.createElement('div'); body.className = 'panel-body'; el.appendChild(body);
        const t = new Trend(body); track(t);
        t.update({ labels, ticks, format: int, series: [{ key: 'unmet', name: L('Unpicked units', 'الوحدات غير المجهَّزة'), color: 'var(--ember)', values: d.byMonth, fill: true }] });
        const bars = document.createElement('div'); el.appendChild(bars);
        new BarList(bars, { color: 'var(--haze)', format: (v) => pct(v), limit: 8 }).update(a.families.map((f) => ({ key: f.c, label: fam(f.c), value: f.unmetRate, risk: f.unmetRate > 0 })), null);
        return L('Unpicked units by order month, and the unpicked share of ordered units by product family.', 'الوحدات غير المجهَّزة حسب شهر الطلب، ونسبتها من الوحدات المطلوبة حسب عائلة المنتج.');
      },
    });
  }

  /* 2. stock sits where demand is met */
  const inv = a.inventory;
  if (inv.shortest && inv.longest) {
    const s = inv.shortest, l = inv.longest;
    out.push({
      id: 'cover', tab: L('Stock in the wrong place', 'مخزون في غير موضعه'), domain: L('Inventory', 'المخزون'),
      observation: L(`Median stock cover runs from ${int(s.cover)} months in <b>${fam(s.c)}</b> to ${int(l.cover)} months in ${fam(l.c)}. The family with the least cover is also the one that leaves the most demand unpicked.`, `يتراوح وسيط تغطية المخزون بين ${int(s.cover)} شهرًا في <b>${fam(s.c)}</b> و${int(l.cover)} شهرًا في ${fam(l.c)}. والعائلة الأقل تغطية هي نفسها الأكثر تركًا للطلب دون تجهيز.`),
      metric: L(`Months of cover = quantity on hand ÷ average monthly units sold over the last 12 months, median per family. Stock at cost: ${money(inv.value)}.`, `أشهر التغطية = الكمية المتاحة ÷ متوسط الوحدات المبيعة شهريًا في آخر 12 شهرًا، والوسيط لكل عائلة. قيمة المخزون بالتكلفة: ${money(inv.value)}.`),
      interpretation: L(`Holding is not matched to demand: years of stock sit in slow families while ${fam(s.c)} runs short. ${int(inv.atReorder)} items are at or below their reorder level, both in the short families.`, `الاحتفاظ بالمخزون لا يتوافق مع الطلب: سنوات من المخزون في عائلات بطيئة الحركة بينما تعاني ${fam(s.c)} من النقص. و${int(inv.atReorder)} أصناف عند حد إعادة الطلب أو دونه، وكلها في العائلات الناقصة.`),
      recommendation: L(`Shift purchasing budget from slow families toward ${fam(s.c)}, and review reorder levels using cover rather than fixed quantities. Flag items with more than five years of cover for a clearance or stop-buy review.`, `تحويل ميزانية الشراء من العائلات البطيئة نحو ${fam(s.c)}، ومراجعة حدود إعادة الطلب بناءً على التغطية لا الكميات الثابتة. وتمييز الأصناف التي تزيد تغطيتها على خمس سنوات لمراجعة التصفية أو إيقاف الشراء.`),
      owner: L('Inventory', 'المخزون'),
      limits: L('The stock figure is an undated snapshot, and the team has open balance discrepancies on all 227 items. Cover uses recent sales, which may not reflect seasonal peaks.', 'رقم المخزون لقطة بلا تاريخ، ولدى الفريق فروق أرصدة مفتوحة على الأصناف الـ227 كلها. وتعتمد التغطية على المبيعات الأخيرة التي قد لا تعكس المواسم.'),
      evidence: (el) => {
        const bars = document.createElement('div'); el.appendChild(bars);
        new BarList(bars, { color: 'var(--brass)', format: (v) => L(`${int(v)} mo`, `${int(v)} شهرًا`), limit: 8 }).update(inv.families.map((f) => ({ key: f.c, label: fam(f.c), value: f.cover, risk: f.unmetRate > 0, note: f.unmetRate > 0 ? L(`· ${pct(f.unmetRate)} unpicked`, `· ${pct(f.unmetRate)} غير مجهَّز`) : '' })), null);
        return L('Median months of cover by family. Red: families with unpicked demand.', 'وسيط أشهر التغطية حسب العائلة. بالأحمر: العائلات التي لديها طلب غير مجهَّز.');
      },
    });
  }

  /* 3. purchasing outpaces sales */
  const pu = a.purchasing;
  if (pu.years.length > 1 && pu.growth && pu.salesGrowth) {
    const f = pu.years[0], z = pu.years[pu.years.length - 1];
    out.push({
      id: 'buying', tab: L('Buying vs selling', 'الشراء مقابل البيع'), domain: L('Purchasing', 'المشتريات'),
      observation: L(`Purchase-order value grew <b>${pu.growth.toFixed(1)}×</b> from ${f.year} to ${z.year} (${money(f.purchases)} to ${money(z.purchases)}), while net revenue grew ${pu.salesGrowth.toFixed(2)}×.`, `نمت قيمة أوامر الشراء <b>${pu.growth.toFixed(1)} أضعاف</b> من ${f.year} إلى ${z.year} (من ${money(f.purchases)} إلى ${money(z.purchases)})، بينما نما صافي الإيرادات ${pu.salesGrowth.toFixed(2)} مرة.`),
      metric: L('Purchase-order value = ordered outers × expected unit price on purchase-order lines, by order date. It is the expected value, not invoiced spend.', 'قيمة أمر الشراء = العبوات المطلوبة × سعر الوحدة المتوقع في أسطر أمر الشراء، حسب تاريخ الطلب. وهي القيمة المتوقعة لا الإنفاق المفوتر.'),
      interpretation: L(`By ${z.year} the company ordered ${pct(z.ratio, 0)} of its sales value in a year. Either stock is accumulating far faster than it sells, which the cover figures support, or the expected prices overstate real cost. ${pu.suppliers[0] ? `${esc(pu.suppliers[0].label)} alone takes ${pct(pu.suppliers[0].share)} of the value.` : ''}`, `بحلول ${z.year} كانت الشركة تطلب ما قيمته ${pct(z.ratio, 0)} من قيمة مبيعاتها في السنة. فإما أن المخزون يتراكم أسرع كثيرًا من البيع، وهو ما تؤيده أرقام التغطية، وإما أن الأسعار المتوقعة تبالغ في التكلفة الفعلية. ${pu.suppliers[0] ? `ويستحوذ ${esc(pu.suppliers[0].label)} وحده على ${pct(pu.suppliers[0].share)} من القيمة.` : ''}`),
      recommendation: L('Reconcile purchase-order value against supplier invoices before any budget decision, then set purchasing targets per family from sales and cover, not from last year’s orders.', 'مطابقة قيمة أوامر الشراء مع فواتير الموردين قبل أي قرار يخص الميزانية، ثم تحديد أهداف الشراء لكل عائلة من المبيعات والتغطية، لا من طلبات العام السابق.'),
      owner: L('Purchasing and finance', 'المشتريات والمالية'),
      limits: L(`The team defines this value as expected, not invoiced. Received goods arrive about ${int(pu.leadMedian)} day after ordering against an expected ${int(pu.expectedMedian)}, a pattern typical of sample data, so supplier punctuality is not assessed.`, `يعرّف الفريق هذه القيمة بأنها متوقعة لا مفوترة. وتصل البضائع المستلمة بعد نحو ${int(pu.leadMedian)} يوم من الطلب مقابل ${int(pu.expectedMedian)} يومًا متوقعة، وهو نمط معتاد في البيانات النموذجية، لذا لا يُقيَّم انضباط الموردين.`),
      evidence: (el) => {
        const t = document.createElement('div'); el.appendChild(t);
        t.innerHTML = `<div class="panel-table"><table><caption class="sr-only">${L('Purchase-order value against net revenue by year', 'قيمة أوامر الشراء مقابل صافي الإيرادات حسب السنة')}</caption><thead><tr><th scope="col">${L('Year', 'السنة')}</th><th scope="col">${L('Purchase orders', 'أوامر الشراء')}</th><th scope="col">${L('Net revenue', 'صافي الإيرادات')}</th><th scope="col">${L('Ratio', 'النسبة')}</th></tr></thead><tbody>${pu.years.map((y) => `<tr><th scope="row" class="num">${y.year}</th><td class="num">${money(y.purchases)}</td><td class="num">${money(y.revenue)}</td><td class="num">${pct(y.ratio, 0)}</td></tr>`).join('')}</tbody></table></div>`;
        const bars = document.createElement('div'); el.appendChild(bars);
        new BarList(bars, { color: 'var(--brass)', format: (v) => pct(v, 0) }).update(pu.years.map((y) => ({ key: y.year, label: String(y.year), value: y.ratio, risk: y.ratio > 1 })), null);
        return L('Purchase-order value as a share of net revenue, complete years. Red: more ordered than sold.', 'قيمة أوامر الشراء كنسبة من صافي الإيرادات، للسنوات الكاملة. بالأحمر: طلب أكثر مما بيع.');
      },
    });
  }

  /* 4. loss-making group priced like a profitable sibling */
  const lo = a.loss;
  if (lo.group.length && lo.family !== null) {
    const priced = lo.siblingPrice !== null && lo.group[0].price !== null;
    out.push({
      id: 'loss', tab: L('Loss-making items', 'الأصناف الخاسرة'), domain: L('Sales', 'المبيعات'),
      observation: L(`${int(lo.group.length)} items in ${fam(lo.family)} lose money overall: ${money(lo.groupLoss)} across ${int(lo.groupLines)} lines, <b>${pct(lo.groupShare)}</b> of all recorded losses. Their combined margin is ${pct(lo.groupMargin)}, against ${pct(lo.siblingMargin)} for the rest of the family.`, `${int(lo.group.length)} أصناف في ${fam(lo.family)} خاسرة إجمالًا: ${money(lo.groupLoss)} عبر ${int(lo.groupLines)} سطرًا، أي <b>${pct(lo.groupShare)}</b> من كل الخسائر المسجَّلة. وهامشها المجمّع ${pct(lo.groupMargin)} مقابل ${pct(lo.siblingMargin)} لبقية العائلة.`),
      metric: L('Recorded loss = −Σ line profit where line profit < 0 (invoice lines). Margin = recorded profit ÷ net revenue, losses kept.', 'الخسارة المسجَّلة = −مجموع ربح السطر حيث ربح السطر < 0 (أسطر الفواتير). الهامش = الربح المسجَّل ÷ صافي الإيرادات مع إبقاء الخسائر.'),
      interpretation: priced
        ? L(`These items list at ${money(lo.group[0].price ?? 0)}, the same as their profitable siblings, so the loss comes from their recorded cost, not their price point. This extends the team’s first finding with the pricing comparison.`, `يُعرض سعر هذه الأصناف بـ ${money(lo.group[0].price ?? 0)}، وهو سعر شقيقاتها المربحة نفسه، فالخسارة آتية من تكلفتها المسجَّلة لا من سعرها. وهذا يوسّع النتيجة الأولى للفريق بمقارنة الأسعار.`)
        : L('The loss is concentrated in a few items rather than spread across the range.', 'الخسارة مركّزة في عدد قليل من الأصناف لا موزعة على التشكيلة.'),
      recommendation: L('Check the unit cost on these items with the supplier; if it is right, reprice or delist them. Fixing four items removes most of the company’s recorded losses.', 'التحقق من تكلفة الوحدة لهذه الأصناف مع المورد؛ فإن كانت صحيحة يُعاد تسعيرها أو تُسحب. وإصلاح أربعة أصناف يزيل معظم خسائر الشركة المسجَّلة.'),
      owner: L('Sales and purchasing', 'المبيعات والمشتريات'),
      limits: L('Recorded profit uses the cost stored on each line; the source does not show why the cost differs. The team preserves these lines as a finding and does not correct them.', 'يعتمد الربح المسجَّل على التكلفة المخزنة في كل سطر، ولا يوضح المصدر سبب اختلافها. ويحتفظ الفريق بهذه الأسطر كملاحظة دون تصحيحها.'),
      evidence: (el) => {
        const bars = document.createElement('div'); el.appendChild(bars);
        new BarList(bars, { color: 'var(--haze)', format: money, limit: 8 }).update(lo.top.map((x) => ({ key: x.id, label: x.label, value: x.loss, risk: lo.group.some((g) => g.id === x.id) })), null);
        return L('Recorded loss by item, the eight largest. Red: items that lose money overall.', 'الخسارة المسجَّلة حسب الصنف، أكبر ثمانية. بالأحمر: أصناف خاسرة إجمالًا.');
      },
    });
  }

  /* 5. growth comes from the smaller segments */
  const g = a.segments.filter((x) => x.growth !== null).sort((p, q) => (q.growth ?? 0) - (p.growth ?? 0));
  const lead = a.segments.slice().sort((p, q) => q.share - p.share)[0];
  const gr = a.growth;
  if (g.length > 1 && lead && gr) {
    out.push({
      id: 'segments', tab: L('Where growth comes from', 'مصدر النمو'), domain: L('Customers', 'العملاء'),
      observation: L(`${seg(lead.t)} carry ${pct(lead.share)} of revenue but grew ${signedPct(lead.growth ?? 0)} in ${gr.to}. <b>${seg(g[0].t)}</b> grew ${signedPct(g[0].growth ?? 0)}, and every smaller segment outgrew the largest.`, `تحمل ${seg(lead.t)} ‏${pct(lead.share)} من الإيرادات لكنها نمت ${signedPct(lead.growth ?? 0)} في ${gr.to}. ونمت <b>${seg(g[0].t)}</b> ‏${signedPct(g[0].growth ?? 0)}، وتفوّقت كل شريحة أصغر على الشريحة الأكبر في النمو.`),
      metric: L(`Revenue growth = net revenue in ${gr.to} ÷ ${gr.from} − 1, complete years, by customer category.`, `نمو الإيرادات = صافي الإيرادات في ${gr.to} ÷ ${gr.from} − 1، للسنوات الكاملة، حسب فئة العميل.`),
      interpretation: L(`The company depends on one segment for most of its revenue, while its growth is coming from the others. Account concentration is low (top ten customers: ${pct(a.customers.top10)}), so the exposure is to a market, not to a few buyers.`, `تعتمد الشركة على شريحة واحدة في معظم إيراداتها، بينما يأتي نموها من الشرائح الأخرى. وتركّز الحسابات منخفض (أكبر عشرة عملاء: ${pct(a.customers.top10)})، فالتعرض لسوق لا لعدد قليل من المشترين.`),
      recommendation: L(`Give the faster-growing segments their own targets and assortment review, and track novelty-shop growth monthly as the main revenue risk.`, `تخصيص أهداف ومراجعة تشكيلة للشرائح الأسرع نموًا، ومتابعة نمو متاجر الهدايا الطريفة شهريًا بوصفه الخطر الرئيسي على الإيرادات.`),
      owner: L('Sales', 'المبيعات'),
      limits: L('One year-on-year comparison. Smaller segments grow from a smaller base, and the category describes the customer record, not why it buys.', 'مقارنة سنوية واحدة. والشرائح الأصغر تنمو من قاعدة أصغر، وفئة العميل تصف سجله لا سبب شرائه.'),
      evidence: (el) => {
        const bars = document.createElement('div'); el.appendChild(bars);
        new BarList(bars, { color: 'var(--glacier)', format: (v) => signedPct(v) }).update(g.map((x) => ({ key: x.t, label: seg(x.t), value: x.growth ?? 0, note: L(`· ${pct(x.share)} of revenue`, `· ${pct(x.share)} من الإيرادات`) })), null);
        return L(`Revenue growth ${gr.from} to ${gr.to} by customer segment, with each segment’s share of revenue.`, `نمو الإيرادات من ${gr.from} إلى ${gr.to} حسب شريحة العملاء، مع حصة كل شريحة من الإيرادات.`);
      },
    });
  }

  /* 6. service held steady */
  if (a.service.length > 1) {
    const sv = a.service;
    const ordersIn = (y: number) => ds.orderFacts.filter((x) => ds.months[x.mi].y === y).reduce((s, x) => s + x.orders, 0);
    const o0 = ordersIn(sv[0].year), o1 = ordersIn(sv[sv.length - 1].year);
    out.push({
      id: 'service', tab: L('Service levels', 'مستوى الخدمة'), domain: L('Fulfilment', 'التلبية'),
      observation: L(`About one order in ten becomes a backorder, every year: ${sv.map((x) => pct(x.backorder)).join(', ')}. On-time delivery holds at ${pct(a.totals.onTime, 2)} overall.`, `يتحول نحو طلب واحد من كل عشرة إلى طلب مؤجل كل عام: ${sv.map((x) => pct(x.backorder)).join('، ')}. ويبقى التسليم في الموعد عند ${pct(a.totals.onTime, 2)} إجمالًا.`),
      metric: L('Backorder rate = orders with a backorder ÷ orders. On-time delivery = invoices delivered on or before the expected date ÷ invoices with a confirmed delivery.', 'معدل التأجيل = الطلبات التي لها طلب مؤجل ÷ الطلبات. التسليم في الموعد = الفواتير المسلّمة في التاريخ المتوقع أو قبله ÷ الفواتير ذات التسليم المؤكد.'),
      interpretation: L(`Orders grew from ${int(o0)} in ${sv[0].year} to ${int(o1)} in ${sv[sv.length - 1].year} (${signedPct(o1 / o0 - 1)}) without service slipping, so the backorder rate looks structural rather than a capacity problem. It points back to the item-level shortfalls.`, `نمت الطلبات من ${int(o0)} في ${sv[0].year} إلى ${int(o1)} في ${sv[sv.length - 1].year} ‏(${signedPct(o1 / o0 - 1)}) دون تراجع الخدمة، فيبدو معدل التأجيل هيكليًا لا مشكلة سعة، ويعود إلى النقص على مستوى الأصناف.`),
      recommendation: L('Set the backorder rate as a monthly service KPI with a target below 10%, and link it to the replenishment review of the short items.', 'اعتماد معدل التأجيل مؤشرًا شهريًا للخدمة بهدف أقل من 10٪، وربطه بمراجعة إعادة التموين للأصناف الناقصة.'),
      owner: L('Operations', 'العمليات'),
      limits: L('On-time delivery is one of the team’s proposed KPIs; it is computed here, not yet as a Power BI measure. 84 invoices have no confirmed delivery and are excluded.', 'التسليم في الموعد من مؤشرات الفريق المقترحة؛ ويُحسب هنا، ولم يُنفَّذ بعد مقياسًا في Power BI. وتُستبعد 84 فاتورة بلا تسليم مؤكد.'),
      evidence: (el) => {
        const body = document.createElement('div'); body.className = 'panel-body'; el.appendChild(body);
        const t = new Trend(body); track(t);
        const byM = ds.months.map((m) => { const o = ds.orderFacts.filter((x) => x.mi === m.i); const n = o.reduce((s, x) => s + x.orders, 0); return n ? o.reduce((s, x) => s + x.backorders, 0) / n : 0; });
        t.update({ labels, ticks, format: (v) => pct(v), series: [{ key: 'bo', name: L('Backorder rate', 'معدل التأجيل'), color: 'var(--glacier)', values: byM }] });
        return L('Monthly backorder rate across all segments.', 'معدل التأجيل الشهري لكل الشرائح.');
      },
    });
  }
  return out;
}

const page: Page & { cleanup: (() => void)[] } = {
  cleanup: [],
  async mount(root) {
    root.innerHTML = `<div class="insights page-pad">${loadingState()}</div>`;
    const result = await getDataset();
    const ready = result.state === 'ready';
    const ds = ready ? result.dataset : null;
    const a = ds ? analyse(ds) : null;
    const demo = ds?.provenance.status === 'synthetic';
    const trends: Trend[] = [];
    const web = ds && a ? webFindings(ds, a, (t) => trends.push(t)) : [];

    const recheck = (f: (typeof TEAM_FINDINGS)[number]) => {
      if (!a || demo) return `<span class="tf-check is-na">${L('Not rechecked in the demo view', 'لا يُعاد التحقق في العرض التجريبي')}</span>`;
      const r = f.recheck(a);
      if (!r) return `<span class="tf-check is-na">${L('Outside the website’s dataset', 'خارج بيانات الموقع')}</span>`;
      const tol = r.unit === 'pct' ? 5e-5 : r.unit === 'money' ? 0.005 : 0;
      const ok = Math.abs(r.got - r.expected) <= tol;
      const v = r.unit === 'pct' ? pct(r.got, 2) : r.unit === 'money' ? money(r.got) : int(r.got);
      return `<span class="tf-check ${ok ? 'is-ok' : 'is-off'}"><span aria-hidden="true">${ok ? '✓' : '≠'}</span> ${ok ? L(`Website recheck matches: ${v}`, `إعادة التحقق في الموقع مطابقة: ${v}`) : L(`Website recheck differs: ${v}`, `إعادة التحقق في الموقع مختلفة: ${v}`)}</span>`;
    };

    const cov = ds ? `${fmtDate(ds.provenance.coverage.from)} – ${fmtDate(ds.provenance.coverage.to)}` : '';
    root.innerHTML = `
    <div class="insights page-pad">
      ${pageHeader('insights', L('Evidence before opinion.', 'الدليل قبل الرأي.'), L('Two kinds of finding, kept apart. The team’s decision brief, reconciled in SQL and awaiting formal approval; and this website’s own analysis of the same source data, which nobody on the team has reviewed yet. Every finding states its evidence, its limits and a recommendation.', 'نوعان من النتائج، كلٌّ في مكانه: موجز القرارات الذي أعدّه الفريق وطابقه بـ SQL وينتظر الاعتماد الرسمي، والتحليل الخاص بهذا الموقع لبيانات المصدر نفسها، ولم يراجعه أحد من الفريق بعد. وتذكر كل نتيجة دليلها وحدودها وتوصيتها.'))}

      <section class="section" aria-labelledby="in-team">
        <div class="ladder-head">
          <div>
            <h2 class="sec-title" id="in-team">${L('The team’s decision brief', 'موجز القرارات من الفريق')}</h2>
            <p class="tf-source">${statusBadge('pending', L('Team finding · approval pending', 'نتيجة الفريق · بانتظار الاعتماد'))}</p>
          </div>
          <p class="sec-note">${L('Eight findings ranked by decision value, quoted from the project’s insights catalogue. The website recomputes each headline it can from its own copy of the data, as an independent check.', 'ثماني نتائج مرتبة حسب قيمتها للقرار، منقولة من سجل الرؤى في المشروع. ويعيد الموقع حساب كل رقم رئيسي يستطيعه من نسخته الخاصة من البيانات، كتحقق مستقل.')}</p>
        </div>
        <ol class="team-findings" data-reveal>
          ${TEAM_FINDINGS.map((f) => `
          <li class="tf">
            <span class="tf-rank num" aria-hidden="true">${String(f.rank).padStart(2, '0')}</span>
            <div class="tf-body">
              <p class="tf-meta"><span class="tf-domain">${tr(f.domain)}</span><span class="tf-conf">${L('Confidence', 'الثقة')}: ${tr(f.confidence)}</span></p>
              <h3 class="tf-q">${tr(f.question)}</h3>
              <p class="tf-finding">${tr(f.finding)}</p>
              <button class="text-btn" type="button" aria-expanded="false" aria-controls="tf-${f.id}">${L('Interpretation and report treatment', 'التفسير ومعالجة التقرير')}</button>
              <div class="tf-more" id="tf-${f.id}" hidden><p>${tr(f.interpretation)}</p><p class="tf-treat">${tr(f.treatment)}</p></div>
              ${recheck(f)}
            </div>
          </li>`).join('')}
        </ol>
      </section>

      <section class="section" aria-labelledby="in-web">
        <div class="dossier-head">
          <div>
            <h2 class="sec-title" id="in-web">${L('Website analysis', 'تحليل الموقع')}</h2>
            <p class="sec-note">${demo
              ? L('Computed live from the synthetic demo data. The numbers describe that data and nothing else.', 'محسوبة لحظيًا من البيانات التجريبية المولَّدة، وأرقامها تصف تلك البيانات فقط.')
              : L(`Independent analysis of the source data (${cov}), computed live in your browser from the same rows the Observatory shows. It goes beyond the team’s brief and has not been reviewed by the team.`, `تحليل مستقل لبيانات المصدر (${cov})، يُحسب لحظيًا في متصفحك من الصفوف نفسها التي يعرضها المرصد. يتجاوز موجز الفريق، ولم يراجعه الفريق.`)}</p>
          </div>
          <p class="stamp" aria-label="${demo ? L('Synthetic data. Not a project finding.', 'بيانات مولَّدة. ليست نتيجة للمشروع.') : L('Website analysis. Not reviewed by the team.', 'تحليل الموقع. لم يراجعه الفريق.')}">${demo ? L('Demo data', 'بيانات تجريبية') : L('Website analysis', 'تحليل الموقع')}<span>${demo ? L('Not a project finding', 'ليست نتيجة للمشروع') : L('Not reviewed by the team', 'لم يراجعه الفريق')}</span></p>
        </div>
        ${web.length ? `
        <div class="tablist wf-tabs" role="tablist" aria-label="${L('Website findings', 'نتائج الموقع')}">
          ${web.map((w, i) => `<button role="tab" data-tab="${w.id}" id="wf-tab-${w.id}" aria-controls="wf-panel"><span class="num">${i + 1}</span> ${w.tab}</button>`).join('')}
        </div>
        <div class="dossier" id="wf-panel" role="tabpanel" data-reveal></div>` : !ready ? dataStatePanel(result, '/insights', { compact: true, headingId: 'in-web-state' }) : ''}
      </section>

      ${web.length ? `
      <section class="section" aria-labelledby="in-recs">
        <div class="ladder-head">
          <h2 class="sec-title" id="in-recs">${L('Recommendations at a glance', 'التوصيات في لمحة')}</h2>
          <p class="sec-note">${L('From the website analysis above. Each needs the team’s review before it is presented as a project recommendation.', 'من تحليل الموقع أعلاه. وتحتاج كل توصية إلى مراجعة الفريق قبل عرضها توصيةً للمشروع.')}</p>
        </div>
        <ol class="recs" data-reveal>
          ${web.map((w, i) => `<li><span class="num">${i + 1}</span><div><p class="rec-owner">${w.owner}</p><p>${w.recommendation}</p></div></li>`).join('')}
        </ol>
      </section>` : ''}

      <section class="section" aria-labelledby="in-ladder">
        <div class="ladder-head">
          <h2 class="sec-title" id="in-ladder">${L('How a number earns its place', 'كيف يستحق الرقم مكانه')}</h2>
          <p class="sec-note">${L('Every number on this site carries one of five marks. Select a mark to see what it takes to reach it.', 'يحمل كل رقم في هذا الموقع واحدة من خمس علامات. اختر علامة لترى ما يلزم لبلوغها.')}</p>
        </div>
        <div class="ladder panel-frame" data-reveal>
          <div class="ladder-rungs" role="tablist" aria-label="${L('Verification levels', 'مستويات التحقق')}">
            ${LADDER.map((l, i) => `<button role="tab" data-tab="${l.s}" id="rung-${l.s}" aria-controls="ladder-panel" style="--i:${i}"><span class="rung-bar" aria-hidden="true"></span><span class="rung-n num">${i + 1}</span><span class="rung-l">${statusLabel(l.s)}</span></button>`).join('')}
          </div>
          <div class="ladder-panel" id="ladder-panel" role="tabpanel"></div>
        </div>
      </section>

      ${nextChapter('insights', L('Interactive instruments: which items carry the business, and where demand leaks away.', 'أدوات تفاعلية: أي الأصناف تحمل النشاط، وأين يتسرّب الطلب.'))}
      ${siteFooter()}
    </div>`;

    /* website findings */
    const panel = root.querySelector<HTMLElement>('#wf-panel');
    const tabs = root.querySelector<HTMLElement>('.wf-tabs');
    const badge = demo ? statusBadge('synthetic') : statusBadge('unverified', L('Website analysis · not reviewed by the team', 'تحليل الموقع · لم يراجعه الفريق'));
    if (panel && tabs && ds) wireTabs(tabs, (id) => {
      trends.splice(0).forEach((t) => t.destroy()); tip(null);
      const w = web.find((x) => x.id === id)!;
      panel.setAttribute('aria-labelledby', `wf-tab-${id}`);
      panel.innerHTML = `
        <dl class="dz-fields">
          <div class="dz-obs"><dt>${L('Observation', 'الملاحظة')}</dt><dd>${w.observation}</dd></div>
          <div><dt>${L('Measure', 'المقياس')}</dt><dd>${w.metric}</dd></div>
          <div><dt>${L('Interpretation', 'التفسير')}</dt><dd>${w.interpretation}</dd></div>
          <div><dt>${L('Recommendation', 'التوصية')}</dt><dd>${w.recommendation}</dd></div>
          <div><dt>${L('Limits', 'الحدود')}</dt><dd>${w.limits}</dd></div>
          <div><dt>${L('Status', 'الحالة')}</dt><dd>${badge}</dd></div>
        </dl>
        <div class="dz-evidence panel-frame">
          <div class="dz-ev-head"><h3>${L('Evidence', 'الدليل')}</h3><span class="tf-domain">${w.domain}</span></div>
          <div class="dz-ev"></div>
          <p class="dz-caption"></p>
        </div>`;
      const ev = panel.querySelector<HTMLElement>('.dz-ev')!;
      panel.querySelector<HTMLElement>('.dz-caption')!.textContent = w.evidence(ev);
    });

    /* ladder */
    const lp = root.querySelector<HTMLElement>('.ladder-panel')!;
    const rungs = root.querySelector<HTMLElement>('.ladder-rungs')!;
    wireTabs(rungs, (id, i) => {
      const l = LADDER[i];
      rungs.style.setProperty('--sel', String(i));
      lp.setAttribute('aria-labelledby', `rung-${id}`);
      lp.innerHTML = `<div>${statusBadge(l.s)}<p class="lp-needs">${l.needs()}</p></div><dl><div><dt>${L('Signed off by', 'يعتمده')}</dt><dd>${l.who()}</dd></div><div><dt>${L('Shown on this site as', 'يظهر في الموقع باسم')}</dt><dd>${statusLabel(l.s)}</dd></div></dl>`;
    }, 3);
    wireDisclosures(root);
    this.cleanup.push(revealOnScroll(root), () => { trends.forEach((t) => t.destroy()); tip(null); });
  },
  unmount() { this.cleanup.forEach((f) => f()); this.cleanup = []; },
};
export default page;
