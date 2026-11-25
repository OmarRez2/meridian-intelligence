import type { Bi } from '../data/types';

/**
 * Site identity and team content.
 *
 * Sources (read-only, in the original project):
 *  - roles, accountabilities, phase leads and RACI: 01_Project_Planning_and_Documentation/03_Team_Roles.docx
 *    (repeated on slide 18 of the final presentation)
 *  - documented contributions: README.md, PROJECT_STATUS.md and the candidate ETL README of the project
 *  - profile links: given by each member (the team leader's from his CV), never guessed
 * Anything not documented is shown as "awaiting confirmation", not invented. All six members consented to the
 * public publication of their names (both spellings), portraits and profile links (recorded 2026-11-25).
 */

export const SITE = {
  name: 'WWI Supply Chain Intelligence',
  programme: 'DEPI Graduation Project',
  /** Public site (GitHub Pages). */
  siteUrl: 'https://omarrez2.github.io/meridian-intelligence/' as string | null,
};

/** Project identity: "WWI Supply Chain Intelligence" and "DEPI Graduation Project". The team is never numbered. */
export const teamName = (): Bi => ({ en: 'The project team', ar: 'فريق المشروع' });

export type Link = { kind: 'linkedin' | 'github'; href: string };
export type Member = {
  id: string;
  name: Bi;
  /** short name used in captions */
  first: Bi;
  /** professional title */
  role: Bi;
  /** two or three sentences, portfolio voice */
  summary: Bi;
  /** concrete contributions; evidence for each is listed in docs/team-profiles.md */
  highlights: Bi[];
  skills: Bi[];
  portrait: string | null;
  links: Link[];
  leader?: boolean;
};

const S = (en: string, ar = en): Bi => ({ en, ar });

/**
 * Public profiles. Every statement is drawn from the project's Team Roles document, PROJECT_STATUS, the README
 * or the final presentation (sources in docs/team-profiles.md); nothing here is invented.
 */
export const MEMBERS: Member[] = [
  {
    id: 'omar', leader: true,
    name: { en: 'Omar Mahmoud Sobhy Rezk', ar: 'عمر محمود صبحى رزق' },
    first: S('Omar', 'عمر'),
    role: S('Analytics & Integration Lead', 'قائد التحليلات والتكامل'),
    summary: S(
      'Led the project from the first proposal to the final model, keeping every workstream on one architecture, one schedule and one set of numbers. Hands-on across the whole stack, from data extraction and ETL integration to the Power BI semantic model.',
      'قاد المشروع من المقترح الأول حتى النموذج النهائي، وأبقى مسارات العمل كلها على بنية واحدة وجدول واحد وأرقام واحدة. وعمل بيده على المراحل كلها، من استخراج البيانات وتكامل ETL إلى النموذج الدلالي في Power BI.',
    ),
    highlights: [
      S('Built the Power BI semantic model: 7 fact and 6 dimension tables joined by 26 one-directional relationships.', 'بنى النموذج الدلالي في Power BI: سبعة جداول حقائق وستة جداول أبعاد تربطها 26 علاقة أحادية الاتجاه.'),
      S('Ran the controlled ETL integration: 31 tables round-tripped, 18 Gold views and 12 source reconciliations.', 'نفّذ تكامل ETL المضبوط: 31 جدولًا مطابقًا ذهابًا وإيابًا، و18 عرضًا ذهبيًا، و12 مطابقة مع المصدر.'),
      S('Exported the 16 source tables with a full data dictionary, plus an independent cleaning pass kept as a cross-check.', 'استخرج جداول المصدر الستة عشر مع قاموس بيانات كامل، وأجرى تنظيفًا مستقلًا احتفظ به للمقارنة.'),
      S('Brought the proposal, schedule, risk register and repository structure together for the first submission.', 'جمع المقترح والجدول الزمني وسجل المخاطر وهيكل المستودع في التسليم الأول.'),
    ],
    skills: [S('Technical leadership', 'القيادة الفنية'), S('SQL Server'), S('Python'), S('ETL'), S('Power BI'), S('Data modelling', 'نمذجة البيانات')],
    portrait: 'omar',
    links: [
      { kind: 'linkedin', href: 'https://www.linkedin.com/in/omar-rezk-70868b211/' },
      { kind: 'github', href: 'https://github.com/OmarRez2' },
    ],
  },
  {
    id: 'ahmed',
    name: { en: 'Ahmed Saleh Abdelzaher', ar: 'أحمد صالح عبد الظاهر' },
    first: S('Ahmed', 'أحمد'),
    role: S('Data Engineer · ETL & Pipelines', 'مهندس بيانات · ETL ومسارات البيانات'),
    summary: S(
      'Owns the road from source system to warehouse: source access, staging, load scripts, logging and run instructions. Built the layered warehouse the rest of the project stands on.',
      'يتولّى الطريق من النظام المصدر إلى المستودع: الوصول إلى المصدر، ومنطقة التجهيز، وسكربتات التحميل، والتسجيل، وتعليمات التشغيل. وبنى المستودع متعدد الطبقات الذي يقوم عليه المشروع كله.',
    ),
    highlights: [
      S('Built the medallion warehouse: 48 Bronze tables, 31 Silver tables and 18 Gold views.', 'بنى مستودعًا بطبقات متدرجة: 48 جدولًا برونزيًا، و31 جدولًا فضيًا، و18 عرضًا ذهبيًا.'),
      S('Wrote the 14 Python cleaning components that produce every Silver table.', 'كتب مكوّنات التنظيف الأربعة عشر بلغة Python التي تُنتج الجداول الفضية كلها.'),
    ],
    skills: [S('Python'), S('pandas'), S('SQL Server'), S('ETL pipelines', 'مسارات ETL'), S('Medallion architecture', 'البنية متعددة الطبقات')],
    portrait: 'ahmed',
    links: [
      { kind: 'linkedin', href: 'https://www.linkedin.com/in/ahmed-saleh-205529397/' },
      { kind: 'github', href: 'https://github.com/Ahmed-Analyst25' },
    ],
  },
  {
    id: 'sara',
    name: { en: 'Sara Mostafa Abdelhafiz', ar: 'سارة مصطفى عبد الحفيظ' },
    first: S('Sara', 'سارة'),
    role: S('Data Analyst · Data Quality', 'محللة بيانات · جودة البيانات'),
    summary: S(
      'Makes sure the numbers can be trusted. Leads data understanding and validation: profiling the source, defining quality rules, keeping the anomaly log and assembling the reconciliation evidence.',
      'تحرص على أن تكون الأرقام جديرة بالثقة. تقود فهم البيانات والتحقق منها: تحليل المصدر، ووضع قواعد الجودة، ومتابعة سجل الحالات الشاذة، وجمع أدلة المطابقة.',
    ),
    highlights: [
      S('Designed the source-profiling and quality-assurance checklist used from the first submission.', 'صمّمت قائمة تحليل المصدر وضمان الجودة المعتمدة منذ التسليم الأول.'),
      S('Co-leads the data understanding, BI reporting and technical validation phases.', 'تشارك في قيادة مراحل فهم البيانات، وتقارير ذكاء الأعمال، والتحقق الفني.'),
    ],
    skills: [S('Data profiling', 'تحليل البيانات الوصفي'), S('Data quality', 'جودة البيانات'), S('Validation & reconciliation', 'التحقق والمطابقة'), S('BI reporting', 'تقارير ذكاء الأعمال')],
    portrait: 'sara',
    links: [
      { kind: 'linkedin', href: 'https://www.linkedin.com/in/sara-mostafa-604696293/' },
      { kind: 'github', href: 'https://github.com/saramostafa121212-sys' },
    ],
  },
  {
    id: 'abdelrahman',
    name: { en: 'Abdelrahman Mohammed Fathy', ar: 'عبد الرحمن محمد فتحي' },
    first: S('Abdelrahman', 'عبد الرحمن'),
    role: S('SQL Developer · Data Warehouse', 'مطوّر SQL · مستودعات البيانات'),
    summary: S(
      'Designs the structure the analysis depends on: source-to-target mapping, fact grain, keys, the star-schema DDL and the SQL checks that validate it.',
      'يصمّم البنية التي يعتمد عليها التحليل: ربط المصدر بالهدف، ومستوى تفصيل الحقائق، والمفاتيح، وتعريفات المخطط النجمي، وفحوص SQL التي تتحقق منها.',
    ),
    highlights: [
      S('Mapped the source entities to the candidate fact grains of the analytical model.', 'ربط كيانات المصدر بمستويات التفصيل المرشّحة لجداول الحقائق في النموذج التحليلي.'),
      S('Co-leads the data understanding, warehouse design and ETL phases.', 'يشارك في قيادة مراحل فهم البيانات، وتصميم المستودع، وتطوير ETL.'),
    ],
    skills: [S('T-SQL'), S('SQL Server'), S('Dimensional modelling', 'النمذجة البُعدية'), S('Star schema', 'المخطط النجمي')],
    portrait: null, links: [],
  },
  {
    id: 'ola',
    name: { en: 'Dr. Ola Abdelkader Mahmoud Mohamed', ar: 'د. علا عبد القادر محمود محمد' },
    first: S('Dr. Ola', 'د. علا'),
    role: S('Business Analyst · Documentation', 'محللة أعمال · التوثيق'),
    summary: S(
      'Keeps the work anchored in the business: stakeholder needs, user stories, technical writing and the recommendations the analysis leads to.',
      'تُبقي العمل مرتبطًا باحتياجات النشاط التجاري: أصحاب المصلحة، وقصص المستخدمين، والكتابة التقنية، والتوصيات التي ينتهي إليها التحليل.',
    ),
    highlights: [
      S('Documented the stakeholder needs, requirements and reference material behind the project scope.', 'وثّقت احتياجات أصحاب المصلحة والمتطلبات والمراجع التي بُني عليها نطاق المشروع.'),
      S('Leads the business storytelling phase and the project submissions.', 'تقود مرحلة سرد القصة للأعمال وتسليمات المشروع.'),
    ],
    skills: [S('Business analysis', 'تحليل الأعمال'), S('Requirements', 'المتطلبات'), S('User stories', 'قصص المستخدمين'), S('Technical writing', 'الكتابة التقنية')],
    portrait: 'ola', links: [],
  },
  {
    id: 'samir',
    name: { en: 'Samir Magdy Yacoub', ar: 'سمير مجدي يعقوب' },
    first: S('Samir', 'سمير'),
    role: S('Power BI Developer · DAX', 'مطوّر Power BI · DAX'),
    summary: S(
      'Turns the model into something decision-makers can read: report wireframes, the semantic layer, DAX measures and the way the report pages work together.',
      'يحوّل النموذج إلى تقارير يقرؤها صانعو القرار بسهولة: النماذج الأولية للتقارير، والطبقة الدلالية، ومقاييس DAX، وطريقة تكامل صفحات التقرير.',
    ),
    highlights: [
      S('Translated the business questions into KPI groups and report page layouts.', 'حوّل أسئلة العمل إلى مجموعات من المؤشرات وتخطيطات لصفحات التقرير.'),
      S('Leads the BI reporting phase.', 'يقود مرحلة تقارير ذكاء الأعمال.'),
    ],
    skills: [S('Power BI'), S('DAX'), S('Report design', 'تصميم التقارير'), S('KPI design', 'تصميم المؤشرات')],
    portrait: null, links: [],
  },
];

/** Who leads each workstream (the responsible member in the team's RACI; the team leader integrates all of them). */
export const WORKSTREAMS: { work: Bi; lead: string }[] = [
  { work: S('Proposal and submissions', 'المقترح والتسليمات'), lead: 'ola' },
  { work: S('Source access and ETL', 'الوصول إلى المصدر وETL'), lead: 'ahmed' },
  { work: S('Data quality', 'جودة البيانات'), lead: 'sara' },
  { work: S('Warehouse and SQL model', 'المستودع ونموذج SQL'), lead: 'abdelrahman' },
  { work: S('Power BI and DAX', 'Power BI وDAX'), lead: 'samir' },
  { work: S('Documentation', 'التوثيق'), lead: 'ola' },
  { work: S('Project integration', 'تكامل المشروع'), lead: 'omar' },
];

export const TECHNOLOGIES: { label: string; use: Bi }[] = [
  { label: 'SQL Server', use: { en: 'Source database, layered warehouse and the isolated test database', ar: 'قاعدة المصدر، والمستودع متعدد الطبقات، وقاعدة الاختبار المعزولة' } },
  { label: 'T-SQL', use: { en: '11 profiling scripts, warehouse DDL, Gold views and read-only checks', ar: '11 سكربتًا لتحليل البيانات، وتعريفات المستودع، والعروض الذهبية، والفحوص للقراءة فقط' } },
  { label: 'Python · pandas', use: { en: '14 cleaning components, the ETL loader and their regression tests', ar: '14 مكوّنًا للتنظيف، ومُحمِّل ETL، واختبارات الانحدار الخاصة بها' } },
  { label: 'Power BI', use: { en: '14-table semantic model, 11 report pages, 229 visuals', ar: 'نموذج دلالي من 14 جدولًا، و11 صفحة تقرير، و229 عنصرًا مرئيًا' } },
  { label: 'DAX', use: { en: '42 measures, reconciled 22/22 against SQL', ar: '42 مقياسًا، متطابقة 22 من 22 مع SQL' } },
  { label: 'Power Query (M)', use: { en: 'Loading and shaping the model tables', ar: 'تحميل جداول النموذج وتشكيلها' } },
];

/** Deliverables. `href: null` means the file exists in the project but is not published on this site. */
export const RESOURCES: { label: Bi; kind: Bi; status: 'completed' | 'progress' | 'pending'; note: Bi }[] = [
  { label: { en: 'Power BI report', ar: 'تقرير Power BI' }, kind: { en: 'Report', ar: 'تقرير' }, status: 'completed', note: { en: '9 pages plus 2 drill-through pages; static audit 0 errors. Slicer and drill-through click-through still to be tested.', ar: '9 صفحات وصفحتان للتعمق؛ التدقيق الثابت بلا أخطاء. اختبار التقطيع والتعمق بالنقر لم يكتمل بعد.' } },
  { label: { en: 'System analysis and design', ar: 'تحليل النظام وتصميمه' }, kind: { en: 'Document', ar: 'مستند' }, status: 'completed', note: { en: 'Use cases, ERD, schema, DFD, sequence, activity and deployment views.', ar: 'حالات الاستخدام، ومخطط الكيانات والعلاقات، والمخطط، ومخطط تدفق البيانات، ومخططات التسلسل والنشاط والنشر.' } },
  { label: { en: 'Test plan and results', ar: 'خطة الاختبار ونتائجه' }, kind: { en: 'Document', ar: 'مستند' }, status: 'completed', note: { en: 'Integrity, cleaning-regression and loader tests; KPI and visual-query reconciliation.', ar: 'اختبارات السلامة وانحدار التنظيف والمُحمِّل؛ ومطابقة المؤشرات واستعلامات العناصر المرئية.' } },
  { label: { en: 'Final presentation and infographic', ar: 'العرض النهائي والإنفوجرافيك' }, kind: { en: 'Slides', ar: 'شرائح' }, status: 'completed', note: { en: '20-slide deck and a one-slide infographic, prepared for the discussion.', ar: 'عرض من 20 شريحة وإنفوجرافيك من شريحة واحدة، أُعدّا للمناقشة.' } },
  { label: { en: 'Source repository', ar: 'مستودع الشيفرة' }, kind: { en: 'Code', ar: 'شيفرة' }, status: 'pending', note: { en: 'Upload to the official repository is still to be confirmed by the team.', ar: 'رفع الملفات إلى المستودع الرسمي بانتظار تأكيد الفريق.' } },
  { label: { en: 'Team approval of scope and model', ar: 'اعتماد الفريق للنطاق والنموذج' }, kind: { en: 'Decision', ar: 'قرار' }, status: 'progress', note: { en: 'The 20-table scope, cleaning rules and semantic model await formal team approval.', ar: 'نطاق العشرين جدولًا، وقواعد التنظيف، والنموذج الدلالي بانتظار الاعتماد الرسمي من الفريق.' } },
];
