// Visual QA: captures screenshots of the running dev server into docs/screenshots.
// Usage: node scripts/shoot.mjs [filter]      (dev server must be running; BASE_URL overrides the default)
// Uses the locally installed Chrome via playwright-core; no browser download. Writes only inside this project.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/screenshots');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173/';
const filter = process.argv[2] ?? '';

const desktop = { width: 1440, height: 900 };
const tablet = { width: 820, height: 1180, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const mobile = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

/** scroll so the element's centre sits at the viewport centre, then let the damped camera settle */
const toEl = (sel, block = 'center') => async (p) => {
  await p.evaluate(([s, b]) => document.querySelector(s)?.scrollIntoView({ block: b }), [sel, block]);
  await p.waitForTimeout(2600);
};
/** chapters: scroll to the scroll position the homepage itself treats as the chapter's keyframe */
const toCh = (n) => async (p) => {
  await p.evaluate((ch) => {
    const s = document.querySelector(`[data-ch="${ch}"]`);
    const inner = s.querySelector('.ch-inner, .after-inner') ?? s;
    const coarse = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
    const r = (coarse ? inner : s).getBoundingClientRect();
    const centre = coarse ? r.top + scrollY + r.height / 2 - innerHeight * 0.2 : r.top + scrollY + r.height / 2;
    scrollTo(0, centre - innerHeight / 2);
  }, n);
  await p.waitForTimeout(3000);
};
/** journey steps: put the step's top where a reader would be reading (below the sticky diagram on phones) */
const toStep = (i) => async (p) => {
  await p.evaluate((n) => {
    const el = document.querySelector(`.j-step[data-i="${n}"]`);
    const narrow = window.innerWidth <= 900;
    scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * (narrow ? 0.6 : 0.3));
  }, i);
  await p.waitForTimeout(2200);
};
const click = (sel, wait = 600) => async (p) => { await p.locator(sel).first().scrollIntoViewIfNeeded(); await p.click(sel); await p.waitForTimeout(wait); };

const SHOTS = [
  // ---- homepage, desktop
  { name: 'd-01-hero', vp: desktop, url: '', wait: 4200 },
  { name: 'd-00-intro-frame', vp: desktop, url: '', wait: 900 },
  { name: 'd-02-challenge', vp: desktop, url: '', wait: 3800, act: toCh(1) },
  { name: 'd-03-network', vp: desktop, url: '', wait: 3800, act: toCh(2) },
  { name: 'd-04-preparation', vp: desktop, url: '', wait: 3800, act: toCh(3) },
  { name: 'd-05-structure', vp: desktop, url: '', wait: 3800, act: toCh(4) },
  { name: 'd-06-dial', vp: desktop, url: '', wait: 3800, act: toCh(5) },
  { name: 'd-07-about', vp: desktop, url: '', wait: 3800, act: toEl('.about') },
  { name: 'd-08-preview-obs', vp: desktop, url: '', wait: 3800, act: toEl('.preview-obs') },
  { name: 'd-09-preview-journey', vp: desktop, url: '', wait: 3800, act: toEl('.preview-journey') },
  { name: 'd-10-team-cta', vp: desktop, url: '', wait: 3800, act: toEl('.team') },
  { name: 'd-11-hover-node', vp: desktop, url: '', wait: 3800, act: async (p) => { await toCh(2)(p); await hoverNearestNode(p); } },
  // ---- other pages, desktop
  { name: 'd-20-overview', vp: desktop, url: '#/overview', wait: 2200 },
  { name: 'd-21-overview-flow', vp: desktop, url: '#/overview', wait: 2200, act: async (p) => { await toEl('.flow')(p); await p.click('.flow-track [data-tab="warehouse"]'); await p.waitForTimeout(1000); } },
  { name: 'd-22-overview-method', vp: desktop, url: '#/overview', wait: 2200, act: async (p) => { await toEl('.method', 'start')(p); await p.click('.method button >> nth=2'); await p.waitForTimeout(500); } },
  { name: 'd-30-hub-sales', vp: desktop, url: '#/observatory', wait: 2600 },
  { name: 'd-31-hub-filtered', vp: desktop, url: '#/observatory', wait: 2600, act: async (p) => { await p.click('.seg button[data-year="2015"]'); await p.click('.bar-row >> nth=0'); await p.waitForTimeout(1400); } },
  { name: 'd-32-hub-tooltip', vp: desktop, url: '#/observatory', wait: 2600, act: async (p) => { await p.locator('svg.trend').first().scrollIntoViewIfNeeded(); const b = await p.locator('svg.trend').first().boundingBox(); await p.mouse.move(b.x + b.width * 0.62, b.y + b.height * 0.5); await p.waitForTimeout(500); } },
  { name: 'd-33-hub-drawer', vp: desktop, url: '#/observatory', wait: 2600, act: async (p) => { await p.locator('svg.trend').first().scrollIntoViewIfNeeded(); const b = await p.locator('svg.trend').first().boundingBox(); await p.mouse.move(b.x + b.width * 0.8, b.y + b.height * 0.5); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(900); } },
  { name: 'd-34-hub-orders', vp: desktop, url: '#/observatory?d=orders', wait: 2600, full: true },
  { name: 'd-35-hub-inventory', vp: desktop, url: '#/observatory?d=inventory', wait: 2600 },
  { name: 'd-36-hub-table-defs', vp: desktop, url: '#/observatory?d=suppliers', wait: 2600, act: async (p) => { await p.click('.def-btn >> nth=0'); await p.click('.table-btn >> nth=0'); await p.waitForTimeout(500); } },
  { name: 'd-37-hub-glossary', vp: desktop, url: '#/observatory', wait: 2600, act: click('.about-data', 900) },
  { name: 'd-38-hub-verified-missing', vp: desktop, url: '#/observatory?data=verified', wait: 2200 },
  { name: 'd-39-hub-customers', vp: desktop, url: '#/observatory?d=customers', wait: 2600, act: async (p) => { await p.click('.seg button[data-year="2015"]'); await p.waitForTimeout(1400); } },
  // verified view with no approved file: the instrument is drawn empty and nothing is sized by data
  { name: 'd-12-verified-challenge', vp: desktop, url: '#/?data=verified', wait: 3800, act: toCh(1) },
  { name: 'd-13-verified-dial', vp: desktop, url: '#/?data=verified', wait: 3800, act: toCh(5) },
  { name: 'd-14-verified-previews', vp: desktop, url: '#/?data=verified', wait: 3800, act: toEl('.preview-obs') },
  { name: 'd-54-insights-verified-missing', vp: desktop, url: '#/insights?data=verified', wait: 2200, act: toEl('.dossier-head') },
  { name: 'm-09-verified-dial', vp: mobile, url: '#/?data=verified', wait: 3800, act: toCh(5) },
  { name: 'd-40-journey', vp: desktop, url: '#/journey', wait: 1500, act: toStep(3) },
  { name: 'd-41-journey-insight', vp: desktop, url: '#/journey', wait: 1500, act: async (p) => { await toStep(6)(p); await p.click('.j-step[data-i="6"] .text-btn'); await p.waitForTimeout(400); } },
  { name: 'd-42-journey-top', vp: desktop, url: '#/journey', wait: 1800 },
  { name: 'd-50-insights', vp: desktop, url: '#/insights', wait: 2200 },
  { name: 'd-51-insights-ladder', vp: desktop, url: '#/insights', wait: 2200, act: toEl('.ladder') },
  { name: 'd-52-insights-dossier', vp: desktop, url: '#/insights', wait: 2200, act: toEl('.dossier') },
  { name: 'd-53-insights-register', vp: desktop, url: '#/insights', wait: 2200, act: async (p) => { await toEl('.register')(p); await p.click('.register .text-btn >> nth=1'); await p.waitForTimeout(400); } },
  { name: 'd-60-engineering', vp: desktop, url: '#/engineering', wait: 2200, act: toEl('.arch') },
  { name: 'd-61-eng-schema', vp: desktop, url: '#/engineering', wait: 2200, act: toEl('.schema') },
  { name: 'd-62-eng-star', vp: desktop, url: '#/engineering', wait: 2200, act: async (p) => { await toEl('.star')(p); await p.hover('.ent[data-id="fsales"]'); await p.waitForTimeout(500); } },
  { name: 'd-63-eng-code', vp: desktop, url: '#/engineering', wait: 2200, act: async (p) => { await toEl('.codeview')(p); await p.click('.codeview [data-tab="lfl"]'); await p.waitForTimeout(400); } },
  { name: 'd-64-eng-validation', vp: desktop, url: '#/engineering', wait: 2200, act: toEl('.recon') },
  { name: 'd-70-team', vp: desktop, url: '#/team', wait: 2200 },
  { name: 'd-71-team-members', vp: desktop, url: '#/team', wait: 2200, act: async (p) => { await toEl('.members')(p); await p.hover('.member >> nth=3'); await p.waitForTimeout(800); } },
  { name: 'd-80-directions', vp: desktop, url: '#/directions', wait: 1800 },
  { name: 'd-81-manifest', vp: desktop, url: '#/directions/manifest', wait: 1500, act: async (p) => { await p.evaluate(() => window.scrollTo(0, 700)); await p.waitForTimeout(2600); } },
  { name: 'd-82-tidewater', vp: desktop, url: '#/directions/tidewater', wait: 1500 },
  { name: 'd-90-warp-mid', vp: desktop, url: '', wait: 3800, act: async (p) => { await p.click('.hero-actions [data-warp]'); await p.waitForTimeout(620); } },
  { name: 'd-91-warp-arrival', vp: desktop, url: '', wait: 3800, act: async (p) => { await p.click('.hero-actions [data-warp]'); await p.waitForTimeout(1900); } },
  { name: 'd-92-reduced-motion', vp: desktop, url: '', wait: 1200, reduced: true },
  { name: 'd-93-no-webgl', vp: desktop, url: '?nogl', wait: 1200 },
  { name: 'd-94-footer', vp: desktop, url: '#/overview', wait: 1500, act: async (p) => { await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(1200); } },
  // ---- tablet
  { name: 't-01-hero', vp: tablet, url: '', wait: 4200 },
  { name: 't-02-network', vp: tablet, url: '', wait: 3800, act: toCh(2) },
  { name: 't-10-hub', vp: tablet, url: '#/observatory', wait: 2600 },
  { name: 't-20-overview', vp: tablet, url: '#/overview', wait: 2200, act: toEl('.flow') },
  { name: 't-60-engineering', vp: tablet, url: '#/engineering', wait: 2200, act: toEl('.arch') },
  // ---- phone
  { name: 'm-01-hero', vp: mobile, url: '', wait: 4200 },
  { name: 'm-02-challenge', vp: mobile, url: '', wait: 3800, act: toCh(1) },
  { name: 'm-03-network', vp: mobile, url: '', wait: 3800, act: toCh(2) },
  { name: 'm-04-preparation', vp: mobile, url: '', wait: 3800, act: toCh(3) },
  { name: 'm-05-structure', vp: mobile, url: '', wait: 3800, act: toCh(4) },
  { name: 'm-06-dial', vp: mobile, url: '', wait: 3800, act: toCh(5) },
  { name: 'm-07-previews', vp: mobile, url: '', wait: 3800, act: toEl('.preview-obs', 'start') },
  { name: 'm-08-menu', vp: mobile, url: '', wait: 2000, act: async (p) => { await p.click('.nav-toggle'); await p.waitForTimeout(400); } },
  { name: 'm-10-hub', vp: mobile, url: '#/observatory', wait: 2600, full: true },
  { name: 'm-20-overview', vp: mobile, url: '#/overview', wait: 2200, act: toEl('.flow', 'start') },
  { name: 'm-40-journey', vp: mobile, url: '#/journey', wait: 1500, act: toStep(3) },
  { name: 'm-50-insights', vp: mobile, url: '#/insights', wait: 2200, act: toEl('.dossier', 'start') },
  { name: 'm-60-engineering', vp: mobile, url: '#/engineering', wait: 2200, act: toEl('.arch', 'start') },
  { name: 'm-70-team', vp: mobile, url: '#/team', wait: 2200, act: toEl('.members', 'start') },
  { name: 'm-80-directions', vp: mobile, url: '#/directions', wait: 1500 },
];

async function hoverNearestNode(p) {
  const pt = await p.evaluate(() => {
    const s = window.__sky; if (!s) return null;
    const n = s.nodes.find((x) => x.kind === 'supplier');
    return s.project(n.pos);
  });
  if (pt) { await p.mouse.move(pt.x, pt.y); await p.waitForTimeout(400); }
}

const browser = await chromium.launch({ channel: 'chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
const problems = [];
for (const s of SHOTS.filter((x) => x.name.includes(filter))) {
  const ctx = await browser.newContext({ viewport: { width: s.vp.width, height: s.vp.height }, deviceScaleFactor: s.vp.deviceScaleFactor ?? 1, isMobile: !!s.vp.isMobile, hasTouch: !!s.vp.hasTouch, reducedMotion: s.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`${s.name}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`${s.name}: ${e.message}`));
  await page.goto(BASE + s.url);
  await page.waitForTimeout(s.wait ?? 1500);
  if (s.act) await s.act(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) problems.push(`${s.name}: horizontal overflow ${overflow}px`);
  await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: !!s.full });
  console.log('shot', s.name);
  await ctx.close();
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'No console errors or horizontal overflow.');
