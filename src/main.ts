import '@fontsource/cormorant-garamond/300.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/300-italic.css';
import '@fontsource/ibm-plex-sans/300.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans-condensed/400.css';
import '@fontsource/ibm-plex-sans-condensed/500.css';
import '@fontsource/ibm-plex-sans-condensed/600.css';
// Arabic faces: the arabic subsets only, so English visitors download nothing extra (unicode-range)
import '@fontsource/ibm-plex-sans-arabic/arabic-300.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
import '@fontsource/amiri/arabic-400.css';
import '@fontsource/amiri/arabic-700.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/rtl.css';

import { gsap } from 'gsap';
import { Router, type RouteDef } from './lib/router';
import { hasWebGL, isCoarse } from './lib/env';
import { motion } from './lib/motion';
import { theme, applyTheme } from './lib/theme';
import { i18n, apply as applyLang, L, tr } from './i18n';
import { stage, direct, rigFor, transitionFlags } from './scene/stage';
import { fallbackSVG } from './scene/fallback';
import { SEQUENCE } from './components/shell';
import { applyMeta } from './content/meta';
import { requestedMode, hashParams, withParam, type DataMode } from './data/mode';
import { getDataset } from './data/adapter';
import { skyFor } from './data/derive';

const reduced = motion.reduced;
document.documentElement.dataset.motion = reduced ? 'reduced' : motion.paused ? 'paused' : 'full';
applyLang();
applyTheme();

/* ---------- data mode ----------
 * The website shows the project data only (see data/mode.ts). A `data` parameter from an old link is
 * dropped from the address so it cannot suggest another dataset. */
const mode: DataMode = requestedMode();
const dropDataParam = () => { if (hashParams().has('data')) history.replaceState(null, '', withParam(location.hash, 'data', null)); };
dropDataParam();
window.addEventListener('hashchange', dropDataParam);
const syncMode = () => { document.documentElement.dataset.data = mode; };
syncMode();

/* ---------- sky ---------- */
function useFallback(on = true) {
  document.body.classList.toggle('no-webgl', on);
  const el = document.getElementById('sky-fallback')!;
  if (on) el.innerHTML = fallbackSVG(); // redrawn so it follows the theme
}
/** The instrument encodes whichever dataset the adapter returns for the current mode, or nothing. */
async function syncSky() {
  syncMode();
  const s = stage.sky;
  if (s) s.setData(skyFor(await getDataset()));
}
async function bootSky() {
  if (!hasWebGL()) return useFallback();
  try {
    const [{ Sky }, data] = await Promise.all([import('./scene/Sky'), getDataset()]);
    const t0 = performance.now();
    stage.sky = new Sky(document.getElementById('sky') as HTMLCanvasElement, { reduced, coarse: isCoarse(), data: skyFor(data), light: theme.light });
    performance.measure('sky:build', { start: t0 }); // geometry and buffers, read by scripts/perf.mjs
    stage.sky.paused = motion.paused;
    // a lost GPU context shows the static chart until the browser restores it
    stage.sky.onContext = (ok) => useFallback(!ok);
    stage.sky.start();
    motion.subscribe((p) => stage.sky?.setPaused(p));
    theme.subscribe((t) => stage.sky?.setTheme(t === 'light'));
    if (import.meta.env.DEV) (window as unknown as { __sky: unknown }).__sky = stage.sky; // QA hook, dev only
  } catch (err) {
    console.warn('WebGL scene unavailable, using static fallback', err);
    useFallback();
  }
}

/* ---------- nav ---------- */
const NAV = SEQUENCE.filter((s) => s.id !== 'home');
let onNavScroll: (() => void) | null = null;
let onNavKey: ((e: KeyboardEvent) => void) | null = null;
function renderNav() {
  const el = document.getElementById('site-nav')!;
  const ar = i18n.rtl;
  el.innerHTML = `
    <a class="brand" href="#/">
      <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="var(--brass)" stroke-width="1.3"/><circle cx="16" cy="16" r="7" fill="none" stroke="var(--haze)" stroke-width=".7"/><circle cx="16" cy="16" r="2.2" fill="var(--chalk)"/><path d="M16 1.5v5M16 25.5v5M1.5 16h5M25.5 16h5" stroke="var(--brass)" stroke-width="1"/></svg>
      <span class="brand-name">WWI <span class="bn-long">Supply Chain </span>Intelligence</span><span class="sr-only">${L(', home', '، الصفحة الرئيسية')}</span>
    </a>
    <nav class="nav-main" aria-label="${L('Main', 'التنقل الرئيسي')}">
      <ul class="nav-links" id="nav-links">${NAV.map((n) => `<li><a href="${n.href}" data-id="${n.id}">${tr(n.short)}</a></li>`).join('')}</ul>
    </nav>
    <div class="nav-tools">
      <a class="present-link" href="#/present"><span class="pl-icon" aria-hidden="true"></span><span class="pl-label">${L('Present', 'العرض التقديمي')}</span></a>
      <button class="lang-toggle" type="button" lang="${ar ? 'en' : 'ar'}">${ar ? 'English' : 'العربية'}</button>
      <button class="theme-toggle" type="button" aria-pressed="${theme.light}"><span class="tt-icon" aria-hidden="true"></span><span class="sr-only">${L('Light theme', 'المظهر الفاتح')}</span></button>
      ${reduced ? '' : `<button class="motion-toggle" type="button" aria-pressed="${motion.paused}"><span class="mt-icon" aria-hidden="true"></span><span class="mt-label">${motion.paused ? L('Resume motion', 'استئناف الحركة') : L('Pause motion', 'إيقاف الحركة')}</span></button>`}
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-links">${L('Menu', 'القائمة')}</button>
    </div>`;
  const toggle = el.querySelector('.nav-toggle') as HTMLButtonElement;
  const links = el.querySelector('.nav-links') as HTMLElement;
  const close = () => { links.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = L('Menu', 'القائمة'); };
  toggle.addEventListener('click', () => {
    const open = !links.classList.contains('open');
    links.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? L('Close', 'إغلاق') : L('Menu', 'القائمة');
    if (open) links.querySelector('a')?.focus();
  });
  links.addEventListener('click', close);
  if (onNavKey) document.removeEventListener('keydown', onNavKey);
  onNavKey = (e) => { if (e.key === 'Escape' && links.classList.contains('open')) { close(); toggle.focus(); } };
  document.addEventListener('keydown', onNavKey);
  if (onNavScroll) window.removeEventListener('scroll', onNavScroll);
  onNavScroll = () => el.classList.toggle('solid', window.scrollY > 40);
  window.addEventListener('scroll', onNavScroll, { passive: true });
  onNavScroll();

  const mt = el.querySelector<HTMLButtonElement>('.motion-toggle');
  mt?.addEventListener('click', () => {
    motion.set(!motion.paused);
    mt.setAttribute('aria-pressed', String(motion.paused));
    mt.querySelector('.mt-label')!.textContent = motion.paused ? L('Resume motion', 'استئناف الحركة') : L('Pause motion', 'إيقاف الحركة');
  });
  const tt = el.querySelector<HTMLButtonElement>('.theme-toggle')!;
  tt.addEventListener('click', () => {
    theme.set(theme.light ? 'dark' : 'light');
    tt.setAttribute('aria-pressed', String(theme.light));
    if (document.body.classList.contains('no-webgl')) useFallback();
  });
  el.querySelector<HTMLButtonElement>('.lang-toggle')!.addEventListener('click', () => switchLanguage(i18n.rtl ? 'en' : 'ar'));
  markNav(document.body.dataset.route ?? 'home');
}
function markNav(id: string) {
  document.querySelectorAll<HTMLAnchorElement>('.nav-links a').forEach((a) => {
    if (a.dataset.id === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

/** Re-renders the shell and the current page in the other language, keeping the reader's place and state. */
async function switchLanguage(l: 'en' | 'ar') {
  const y = window.scrollY;
  i18n.set(l);
  document.querySelector<HTMLAnchorElement>('.skip-link')!.textContent = L('Skip to content', 'انتقل إلى المحتوى');
  renderNav();
  await syncSky(); // node and constellation labels are drawn in the page language
  keepScroll = y;
  await router.resolve();
  document.querySelector<HTMLButtonElement>('.lang-toggle')?.focus();
}
let keepScroll: number | null = null;

/* ---------- routes ---------- */
const routes: Record<string, RouteDef> = {
  '/': { id: 'home', load: () => import('./pages/home').then((m) => m.default) },
  '/overview': { id: 'overview', load: () => import('./pages/overview').then((m) => m.default) },
  '/observatory': { id: 'hub', load: () => import('./pages/hub').then((m) => m.default) },
  '/journey': { id: 'journey', load: () => import('./pages/journey').then((m) => m.default) },
  '/insights': { id: 'insights', load: () => import('./pages/insights').then((m) => m.default) },
  '/lab': { id: 'lab', load: () => import('./pages/lab').then((m) => m.default) },
  '/simulator': { id: 'sim', load: () => import('./pages/sim').then((m) => m.default) },
  '/engineering': { id: 'engineering', load: () => import('./pages/engineering').then((m) => m.default) },
  '/team': { id: 'team', load: () => import('./pages/team').then((m) => m.default) },
  '/present': { id: 'present', load: () => import('./pages/present').then((m) => m.default) },
  '/directions': { id: 'concepts', load: () => import('./pages/concepts').then((m) => m.default) },
  '/directions/manifest': { id: 'concept-manifest', load: () => import('./pages/manifest').then((m) => m.default) },
  '/directions/tidewater': { id: 'concept-tidewater', load: () => import('./pages/tidewater').then((m) => m.default) },
};

const veil = document.getElementById('veil')!;
const progress = document.getElementById('route-progress')!;

const router = new Router(routes, document.getElementById('main')!, {
  async before(from, to) {
    if (from === null) return; // the sky was built for the current mode at boot
    progress.classList.add('on');
    if (reduced || transitionFlags.warped || from === to) { await syncSky(); return; }
    // a short, quiet veil: frequent navigation should not feel like a cutscene
    await gsap.to(veil, { opacity: 0.7, duration: 0.28, ease: 'power2.in' });
    await syncSky(); // under the veil, so a change of data never pops in view
    if (to !== 'home') { const s = stage.sky; if (s) s.ambient = true; direct(rigFor(to)); }
  },
  async after(from, to) {
    progress.classList.remove('on');
    markNav(to);
    applyMeta(to);
    if (stage.sky) stage.sky.ambient = to !== 'home';
    if (to !== 'home') direct(rigFor(to), from === null || reduced || from === to);
    if (keepScroll !== null) { window.scrollTo(0, keepScroll); keepScroll = null; }
    else if (from !== null) document.getElementById('main')!.focus({ preventScroll: true }); // only on route changes, so the skip link stays first
    if (from === null || reduced || from === to) { gsap.set(veil, { opacity: 0 }); return; }
    if (transitionFlags.warped) {
      transitionFlags.warped = false;
      direct({ ...rigFor(to), warp: 0 });
      await gsap.to(veil, { opacity: 0, duration: 1.2, ease: 'power2.out' });
    } else {
      await gsap.to(veil, { opacity: 0, duration: 0.5, ease: 'power2.out' });
    }
  },
}, () => `${mode}|${i18n.lang}`);

document.querySelector<HTMLAnchorElement>('.skip-link')!.textContent = L('Skip to content', 'انتقل إلى المحتوى');
renderNav();
// skip link must not trigger the hash router
document.querySelector('.skip-link')!.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('main')!.focus();
});
router.preload(); // the page's code downloads while the scene chunk does
bootSky().then(() => router.resolve());
