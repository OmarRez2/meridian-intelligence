import { SITE } from './site';
import type { Bi } from '../data/types';
import { tr, L } from '../i18n';

/** Per-route document metadata in both languages. Applied on every navigation by `applyMeta`. */
export const META: Record<string, { title: Bi; description: Bi }> = {
  home: { title: { en: SITE.name, ar: SITE.name }, description: { en: 'A DEPI graduation project on the Wide World Importers supply chain: reconciled sales, fulfilment, purchasing, inventory and customer analytics, from source to recommendation.', ar: 'مشروع تخرج ضمن مبادرة رواد مصر الرقمية عن سلسلة إمداد Wide World Importers: تحليلات مطابقة للمصدر للمبيعات والتلبية والمشتريات والمخزون والعملاء، من البيانات الخام إلى التوصية.' } },
  overview: { title: { en: 'Project overview', ar: 'نظرة على المشروع' }, description: { en: 'The business problem, objectives, scope, method and deliverables of the WWI supply chain analytics project.', ar: 'مشكلة العمل، والأهداف، والنطاق، والمنهجية، ومخرجات مشروع تحليلات سلسلة إمداد WWI.' } },
  hub: { title: { en: 'Observatory', ar: 'المرصد' }, description: { en: 'Explore 41 months of reconciled Wide World Importers data across six domains, with cross-filters, drill-down and metric definitions.', ar: 'استكشف 41 شهرًا من بيانات Wide World Importers المطابقة للمصدر عبر ستة مجالات، مع مرشحات متقاطعة وتعمّق وتعريفات للمؤشرات.' } },
  journey: { title: { en: 'Data journey', ar: 'رحلة البيانات' }, description: { en: 'How a record travels from the operational database through Bronze, Silver and Gold to a business recommendation.', ar: 'كيف ينتقل السجل من قاعدة البيانات التشغيلية عبر الطبقات البرونزية والفضية والذهبية إلى توصية عمل.' } },
  insights: { title: { en: 'Insights and recommendations', ar: 'الرؤى والتوصيات' }, description: { en: 'Evidence-backed findings on loss-making lines, unpicked demand, growth, inventory and suppliers, each with its evidence and limits.', ar: 'نتائج مدعومة بالأدلة عن الأسطر الخاسرة، والطلب غير المجهَّز، والنمو، والمخزون، والموردين، مع أدلة كل منها وحدوده.' } },
  lab: { title: { en: 'Analytics Lab', ar: 'مختبر التحليلات' }, description: { en: 'Interactive instruments on the WWI data: which items carry the business, and where demand leaks away. Findings, calculations, hypotheses and recommendations kept apart.', ar: 'أدوات تفاعلية على بيانات WWI: أي الأصناف تحمل النشاط، وأين يتسرّب الطلب. مع الفصل بين النتائج والحسابات والفرضيات والتوصيات.' } },
  engineering: { title: { en: 'Engineering case study', ar: 'دراسة الحالة الهندسية' }, description: { en: 'Profiling, cleaning, the layered warehouse, the dimensional model and the validation behind the project.', ar: 'تحليل البيانات، والتنظيف، والمستودع متعدد الطبقات، والنموذج البُعدي، والتحقق الذي يقوم عليه المشروع.' } },
  team: { title: { en: 'Team and resources', ar: 'الفريق والموارد' }, description: { en: 'The six members behind the WWI supply chain analytics project, their roles and the project deliverables.', ar: 'الأعضاء الستة وراء مشروع تحليلات سلسلة إمداد WWI، وأدوارهم، ومخرجات المشروع.' } },
  present: { title: { en: 'Presentation mode', ar: 'وضع العرض التقديمي' }, description: { en: 'The graduation discussion, told as a cinematic sequence: problem, method, analytics, insights and team.', ar: 'مناقشة مشروع التخرج في تسلسل سينمائي: المشكلة، والمنهجية، والتحليلات، والرؤى، والفريق.' } },
  concepts: { title: { en: 'Design directions', ar: 'الاتجاهات التصميمية' }, description: { en: 'Three creative directions considered for this website, with the evaluation behind the choice.', ar: 'ثلاثة اتجاهات إبداعية دُرست لهذا الموقع، مع التقييم الذي حسم الاختيار.' } },
  'concept-manifest': { title: { en: 'Manifest — design study', ar: 'Manifest — دراسة تصميمية' }, description: { en: 'An alternative design direction: the industrial ledger.', ar: 'اتجاه تصميمي بديل: السجل الصناعي.' } },
  'concept-tidewater': { title: { en: 'Tidewater — design study', ar: 'Tidewater — دراسة تصميمية' }, description: { en: 'An alternative design direction: inventory as tide.', ar: 'اتجاه تصميمي بديل: المخزون كالمدّ والجزر.' } },
};

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.content = value;
}

export function applyMeta(route: string) {
  const m = META[route] ?? META.home;
  const programme = L(SITE.programme, 'مشروع تخرج DEPI');
  const title = route === 'home' ? `${SITE.name} | ${programme}` : `${tr(m.title)} | ${SITE.name}`;
  document.title = title;
  setMeta('name', 'description', tr(m.description));
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', tr(m.description));
  setMeta('property', 'og:locale', L('en_US', 'ar_EG'));
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', tr(m.description));
}
