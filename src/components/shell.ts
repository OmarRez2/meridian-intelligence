import { SITE } from '../content/site';
import type { Bi, ValidationStatus } from '../data/types';
import { requestedMode, hrefFor } from '../data/mode';
import { L, tr, statusLabel } from '../i18n';

/** The site is read as one sequence of chapters; the order drives headers, "next" links and the nav. */
export const SEQUENCE: { id: string; href: string; label: Bi; short: Bi }[] = [
  { id: 'home', href: '#/', label: { en: 'Atlas', ar: 'الأطلس' }, short: { en: 'Atlas', ar: 'الأطلس' } },
  { id: 'overview', href: '#/overview', label: { en: 'Project overview', ar: 'نظرة على المشروع' }, short: { en: 'Overview', ar: 'المشروع' } },
  { id: 'hub', href: '#/observatory', label: { en: 'Observatory', ar: 'المرصد' }, short: { en: 'Observatory', ar: 'المرصد' } },
  { id: 'journey', href: '#/journey', label: { en: 'Data journey', ar: 'رحلة البيانات' }, short: { en: 'Journey', ar: 'الرحلة' } },
  { id: 'insights', href: '#/insights', label: { en: 'Insights', ar: 'الرؤى والتوصيات' }, short: { en: 'Insights', ar: 'الرؤى' } },
  { id: 'engineering', href: '#/engineering', label: { en: 'Engineering', ar: 'الهندسة' }, short: { en: 'Engineering', ar: 'الهندسة' } },
  { id: 'team', href: '#/team', label: { en: 'Team and resources', ar: 'الفريق والموارد' }, short: { en: 'Team', ar: 'الفريق' } },
];

export const position = (id: string) => SEQUENCE.findIndex((s) => s.id === id);

/** Page header: title, standfirst and the page's place in the sequence (a real order, so it is numbered). */
export function pageHeader(id: string, title: string, standfirst: string, extra = '') {
  const i = position(id);
  return `
  <header class="page-head">
    <nav class="crumbs" aria-label="${L('Breadcrumb', 'مسار التنقل')}"><ol><li><a href="#/">${L('Atlas', 'الأطلس')}</a></li><li aria-current="page">${SEQUENCE[i] ? tr(SEQUENCE[i].label) : title}</li></ol></nav>
    <p class="page-pos num" aria-hidden="true"><span>${String(i).padStart(2, '0')}</span> ${L('of', 'من')} ${String(SEQUENCE.length - 1).padStart(2, '0')}</p>
    <h1 class="display page-title">${title}</h1>
    <p class="lede page-standfirst">${standfirst}</p>
    ${extra}
  </header>`;
}

/** Large link to the next chapter, so every page ends by pointing forward. */
export function nextChapter(id: string, teaser: string) {
  const i = position(id);
  const next = SEQUENCE[(i + 1) % SEQUENCE.length];
  return `
  <a class="next-chapter" href="${next.href}">
    <span class="nc-kicker">${L('Next', 'التالي')}</span>
    <span class="nc-title display">${tr(next.label)}</span>
    <span class="nc-teaser">${teaser}</span>
    <span class="nc-dial" aria-hidden="true"></span>
  </a>`;
}

/** A status mark. 'placeholder' is for content awaiting real material; 'pending' for unconfirmed facts. */
export function statusBadge(status: ValidationStatus | 'placeholder' | 'pending' | 'completed' | 'progress', label?: string) {
  const text: Record<string, string> = {
    placeholder: L('Placeholder', 'عنصر نائب'), pending: L('Awaiting confirmation', 'بانتظار التأكيد'),
    completed: L('Completed', 'مكتمل'), progress: L('In progress', 'قيد التنفيذ'),
  };
  return `<span class="status status-${status}">${label ?? text[status] ?? statusLabel(status as ValidationStatus)}</span>`;
}

export function siteFooter() {
  const demo = requestedMode() === 'demo';
  return `
  <footer class="site-foot">
    <div class="sf-brand">
      <p class="sf-name display">${SITE.name}</p>
      <p>${L(`${SITE.programme}, Professional Data Analyst track. Built on Microsoft’s Wide World Importers sample database.`, 'مشروع تخرج مبادرة رواد مصر الرقمية (DEPI)، مسار محلل البيانات المحترف. مبني على قاعدة بيانات Wide World Importers النموذجية من Microsoft.')}</p>
    </div>
    <nav class="sf-nav" aria-label="${L('Footer', 'روابط التذييل')}">
      <ul>${SEQUENCE.map((s) => `<li><a href="${s.href}">${tr(s.label)}</a></li>`).join('')}<li><a href="#/present">${L('Presentation mode', 'وضع العرض التقديمي')}</a></li><li><a href="#/directions">${L('Design directions', 'الاتجاهات التصميمية')}</a></li></ul>
    </nav>
    <div class="sf-notice">${demo ? `
      <p><span class="status status-synthetic">${statusLabel('synthetic')}</span></p>
      <p>${L('You are viewing the synthetic demo data. Every chart value in this view is generated for demonstration and is not a project result.', 'أنت تشاهد البيانات التجريبية المُولَّدة. كل قيمة في هذا العرض مُنشأة للتوضيح فقط وليست نتيجة من المشروع.')} <a href="${hrefFor('/', 'verified')}">${L('Return to the project data', 'العودة إلى بيانات المشروع')}</a>.</p>` : `
      <p><span class="status status-reconciled">${statusLabel('reconciled')}</span></p>
      <p>${L('Figures are computed by this website from the project’s read-only exports of the Wide World Importers database and reconcile with the team’s SQL benchmarks. The website’s own analysis has not yet been reviewed or approved by the team.', 'الأرقام محسوبة في هذا الموقع من مستخرجات المشروع للقراءة فقط من قاعدة بيانات Wide World Importers، وهي مطابقة لمعايير الفريق المحسوبة بـ SQL. أما تحليلات الموقع الخاصة فلم يراجعها الفريق أو يعتمدها بعد.')} <a href="${hrefFor('/observatory', 'demo')}">${L('Open the demo data', 'فتح البيانات التجريبية')}</a>.</p>`}
    </div>
  </footer>`;
}
