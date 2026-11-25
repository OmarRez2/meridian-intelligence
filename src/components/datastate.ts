import type { DataResult } from '../data/adapter';
import { esc } from '../lib/format';
import { L, statusLabel } from '../i18n';
import { statusBadge } from './shell';

/**
 * Shared markup for the data states every data-driven page must handle:
 *  - loading:     while the adapter resolves (the dataset is loaded on demand)
 *  - unavailable: verified mode, no approved file
 *  - invalid:     verified mode, a file that failed to load or validate (its errors are listed)
 * None of them shows a number. Demo values are never put in their place.
 */

/** The badge naming the data a page shows: lavender for synthetic, the status colour for real data. */
export function dataBadge(r: DataResult): string {
  if (r.state === 'ready') return r.dataset.provenance.status === 'synthetic' ? `<span class="demo-pill">${statusLabel('synthetic')}</span>` : statusBadge(r.dataset.provenance.status, `${L('Project data', 'بيانات المشروع')}: ${statusLabel(r.dataset.provenance.status)}`);
  return statusBadge('placeholder', r.state === 'invalid' ? L('Project data rejected', 'رُفضت بيانات المشروع') : L('No project data', 'لا توجد بيانات للمشروع'));
}

/** True when the page should show values. A narrowing helper for the three-state result. */
export const isReady = (r: DataResult): r is Extract<DataResult, { state: 'ready' }> => r.state === 'ready';

/** Loading placeholder; it carries no values and is replaced as soon as the adapter answers. */
export const loadingState = (what?: string) => `<div class="data-state data-loading" role="status" aria-live="polite"><span class="ds-dial" aria-hidden="true"></span><p>${what ? esc(what) : L('Loading data…', 'جارٍ تحميل البيانات…')}</p></div>`;

/**
 * Explains why no values are shown. `route` is the current route (it names the heading id);
 * `compact` drops the heading for use inside a section that already has one.
 */
export function dataStatePanel(r: Exclude<DataResult, { state: 'ready' }>, route: string, opts: { compact?: boolean; headingId?: string } = {}): string {
  const id = opts.headingId ?? `ds-h-${route.replace(/\W/g, '') || 'home'}`;
  const invalid = r.state === 'invalid';
  const title = invalid ? L('Project data rejected', 'رُفضت بيانات المشروع') : L('No project data yet', 'لا توجد بيانات للمشروع بعد');
  const body = invalid
    ? `${esc(r.reason)} ${L('Nothing from the file is shown, and no other values are shown in its place.', 'لا يُعرض شيء من الملف، ولا تُعرض أي قيم أخرى بدلًا منه.')}`
    : `${esc(r.reason)} ${L('Figures appear here only from the validated project export. No other values are shown in their place.', 'تظهر الأرقام هنا فقط من ملف المشروع المستخرج بعد اجتيازه التحقق، ولا تُعرض أي قيم أخرى بدلًا منها.')}`;
  const issues = invalid && r.report ? r.report.errors.slice(0, 8) : [];
  const more = invalid && r.report && r.report.errors.length > issues.length ? r.report.errors.length - issues.length : 0;
  return `
  <section class="data-state${opts.compact ? ' compact' : ''}" role="${opts.compact ? 'note' : 'region'}" aria-labelledby="${id}" data-state="${r.state}">
    ${opts.compact ? '' : '<div class="ds-dial" aria-hidden="true"></div>'}
    <h2 id="${id}" class="${opts.compact ? 'ds-title' : 'h-section'}">${title}</h2>
    <p class="lede">${body}</p>
    ${invalid ? `<p class="ds-file">${L('File', 'الملف')}: <code>${esc(r.file)}</code></p>` : ''}
    ${issues.length ? `<ul class="ds-issues">${issues.map((i) => `<li><code>${esc(i.path || i.code)}</code> <span dir="ltr">${esc(i.message)}</span></li>`).join('')}${more ? `<li>${L(`…and ${more} more errors. The full list is in the browser console.`, `…و${more} أخطاء أخرى. القائمة الكاملة في وحدة تحكم المتصفح.`)}</li>` : ''}</ul>` : ''}
  </section>`;
}

/** Validation warnings for an accepted dataset, shown in "About this data". */
export function warningList(r: DataResult): string {
  if (r.state !== 'ready' || !r.report?.warnings.length) return '';
  return `<h3>${L('Validation warnings', 'تنبيهات التحقق')}</h3><ul class="ds-issues">${r.report.warnings.map((w) => `<li><code>${esc(w.path || w.code)}</code> <span dir="ltr">${esc(w.message)}</span></li>`).join('')}</ul>`;
}
