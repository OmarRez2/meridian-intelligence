// Browser checks for the data states: real (the only visitor mode), verified-unavailable and verified-invalid,
// plus filters, drill-down and persistence across navigation, language and theme.
// The dev server must be running (BASE_URL overrides the default). Uses the installed Chrome via
// playwright-core. Writes nothing to disk.
//
// The missing and invalid states are simulated through the dev-only `window.__WWI_VERIFIED_FIXTURE__` seam:
// `null` stands for an empty src/data/verified/ folder and an object replaces the file's contents. The real
// file is never moved or edited, and production builds do not contain the seam.
import { register } from 'node:module';
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

register('./ts-hooks.mjs', import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => pathToFileURL(join(ROOT, 'src', p)).href;
const { syntheticDataset } = await import(src('data/synthetic.ts'));
const { computeMetric } = await import(src('data/measures.ts'));
const real = JSON.parse(readFileSync(join(ROOT, 'src/data/verified/dataset.json'), 'utf8'));
const ALL = { year: null, territory: null, category: null };

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173/';
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  (${detail})` : ''}`);

/** An invalid export: the real file's shape with broken references and a wrong benchmark (a copy; the file is untouched). */
const broken = (() => { const ds = JSON.parse(JSON.stringify(real)); ds.facts[0].t = 99; ds.months[2].label = 'March 2013'; return ds; })();
/** Synthetic (test-fixture) values that must never appear on the site. */
const demoRevenue = computeMetric(syntheticDataset, 'revenue', ALL);
const realRevenue = computeMetric(real, 'revenue', ALL);
check('Fixture sanity: the real export reconciles to the team benchmark (172,261,341.20)', Math.abs(realRevenue - 172261341.2) < 0.01, String(realRevenue));

const browser = await chromium.launch({ channel: 'chrome' });
const consoleProblems = [];
const EXPECTED = /^(Verified dataset rejected|Failed to load resource)/;
/** a fresh context per scenario, so the sticky data mode and stored language/theme never leak between checks */
async function open(hash, inject, { width = 1440 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  if (inject !== undefined) await ctx.addInitScript((d) => { window.__WWI_VERIFIED_FIXTURE__ = d; }, inject);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => consoleProblems.push(`${hash}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !EXPECTED.test(m.text())) consoleProblems.push(`${hash}: ${m.text()}`); });
  await page.goto(BASE + hash);
  await page.waitForSelector('#main > *', { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('#main .data-loading'), null, { timeout: 15000 });
  await page.waitForTimeout(900);
  return { page, close: () => ctx.close() };
}
const skyKind = (page) => page.evaluate(() => window.__sky?.dataKind ?? 'no-sky');
const count = (page, sel) => page.locator(sel).count();
const text = (page) => page.evaluate(() => document.getElementById('main').innerText);
const loadedSynthetic = (page) => page.evaluate(() => performance.getEntriesByType('resource').some((r) => /synthetic/.test(r.name)));
/** KPI values once the count-up animation has settled (two equal reads in a row) */
const kpis = async (page) => {
  const read = () => page.$$eval('.kpi-v', (els) => els.map((e) => e.textContent.trim()));
  let prev = await read();
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(250); const next = await read(); if (next.join() === prev.join()) return next; prev = next; }
  return prev;
};

/* ================================================================== real data (default) */
let realValues = [];
{
  const { page, close } = await open('#/observatory');
  check('Real: Observatory renders four KPIs', (await count(page, '.kpi')) === 4);
  check('Real: provenance shows the reconciled status and no demo mark', (await count(page, '.provenance .status-reconciled')) === 1 && (await count(page, '.provenance .demo-pill')) === 0);
  check('Real: the synthetic module is never loaded', !(await loadedSynthetic(page)));
  check('Real: the sky encodes the project data', (await skyKind(page)) === 'data');
  const before = await page.textContent('.kpi-hero .kpi-v');
  check('Real: headline revenue is the reconciled 172.3M', /172/.test(before), before);
  realValues = (await kpis(page)).filter((v) => v.length > 3);
  await page.click('.seg button[data-year="2015"]');
  await page.waitForTimeout(1000);
  const after = await page.textContent('.kpi-hero .kpi-v');
  check('Real: the year filter changes the revenue KPI', before !== after, `${before} -> ${after}`);
  check('Real: the year filter adds a chip and a URL-independent state', (await count(page, '.chip[data-clear="year"]')) === 1);
  await page.selectOption('select[data-k="territory"]', '0');
  await page.waitForTimeout(800);
  check('Real: the segment filter adds a chip', (await count(page, '.chip[data-clear="territory"]')) === 1);
  const filtered = await page.textContent('.kpi-hero .kpi-v');
  check('Real: the segment filter narrows revenue', filtered !== after, `${after} -> ${filtered}`);
  await page.focus('svg.trend');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  check('Real: drill-down opens the month drawer', await page.isVisible('.drawer.open'));
  check('Real: the drawer foot does not call the values demonstration', !(await page.textContent('.drawer-foot')).includes('demonstration'));
  await page.keyboard.press('Escape');
  await page.click('.chips .reset');
  await page.waitForTimeout(600);
  check('Real: "Clear all" removes every chip', (await count(page, '.chip[data-clear]')) === 0);
  for (const d of ['orders', 'purchasing', 'inventory', 'suppliers', 'customers']) {
    await page.click(`#tab-${d}`);
    await page.waitForTimeout(1000);
    const vals = await kpis(page);
    check(`Real: ${d} domain renders four KPIs with values`, vals.length === 4 && vals.every((v) => v && v !== '—'), vals.join(' | '));
    check(`Real: ${d} domain draws its panels`, (await count(page, '.panel')) >= 3);
  }
  check('Real: the tab URL keeps the domain', page.url().includes('d=customers'));
  { const c = (await kpis(page))[0]; check('Real: active customers equal the source count (663 over the coverage)', c.replace(/,/g, '') === '663', c); }
  await page.click('.table-btn >> nth=0');
  check('Real: the largest-customers table renders', (await count(page, '.panel-table table tbody tr')) > 0);
  await page.click('.about-data');
  await page.waitForTimeout(500);
  check('Real: "About this data" names the verified file', (await page.textContent('.drawer.open')).includes('src/data/verified/dataset.json'));
  await close();
}
{
  const { page, close } = await open('#/');
  check('Real: homepage previews six domains', (await count(page, '.readout li')) === 6);
  const ter = await page.$$eval('.ter .num', (e) => e.map((x) => x.textContent.trim()));
  check('Real: five segment labels carry revenue shares', ter.length === 5 && ter.every((t) => t.endsWith('of revenue')), ter.join(','));
  check('Real: rim year labels come from the data', (await page.$$eval('.yr', (e) => e.map((x) => x.textContent).join(','))) === '2013,2014,2015,2016');
  check('Real: four computed headlines', (await count(page, '.q-list .q')) === 4);
  await close();
}
{
  const { page, close } = await open('#/insights');
  check('Real: all eight team findings are listed', (await count(page, '.team-findings .tf')) === 8);
  check('Real: no website recheck disagrees with a team finding', (await count(page, '.tf-check.is-off')) === 0 && (await count(page, '.tf-check.is-ok')) >= 6, `${await count(page, '.tf-check.is-ok')} ok`);
  check('Real: website analysis evidence chart draws', (await count(page, '.dz-ev svg')) >= 1);
  await close();
}

/* ================================================================== no visitor demo mode; persistence */
{
  const { page, close } = await open('#/observatory?data=demo&d=orders');
  check('No demo: an old ?data=demo link shows the real data', (await count(page, '.provenance .status-reconciled')) === 1 && (await count(page, '.provenance .demo-pill')) === 0);
  check('No demo: the data parameter is dropped from the address, other parameters kept', !page.url().includes('data=') && page.url().includes('d=orders'), page.url());
  check('No demo: the synthetic module is never loaded', !(await loadedSynthetic(page)));
  check('No demo: no link or label offers demo data', !/demo data|البيانات التجريبية/i.test(await page.evaluate(() => document.body.innerText)) && (await count(page, 'a[href*="data=demo"]')) === 0);
  await page.click('.seg button[data-year="2015"]');
  await page.waitForTimeout(800);
  await page.click('.lang-toggle');
  await page.waitForTimeout(1800);
  check('Persistence: switching to Arabic keeps the domain', page.url().includes('d=orders'), page.url());
  check('Persistence: switching to Arabic sets dir=rtl and keeps the year filter', (await page.evaluate(() => document.documentElement.dir)) === 'rtl' && (await count(page, '.chip[data-clear="year"]')) === 1);
  await page.click('.theme-toggle');
  await page.waitForTimeout(800);
  check('Persistence: the theme toggle switches to light and keeps the data', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light' && (await count(page, '.kpi')) === 4 && (await skyKind(page)) === 'data');
  await page.click('.nav-links a[data-id="insights"]');
  await page.waitForTimeout(1800);
  check('Persistence: language and theme survive navigation', (await page.evaluate(() => document.documentElement.dir + '|' + document.documentElement.dataset.theme)) === 'rtl|light');
  await close();
}

/* ================================================================== verified, no file (simulated) */
const ROUTES = ['#/', '#/observatory', '#/insights', '#/present?s=6'];
const demoFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(demoRevenue / 1e6);
for (const r of ROUTES) {
  const { page, close } = await open(r, null);
  const t = await text(page);
  check(`Missing: ${r} shows the unavailable state`, (await count(page, '.data-state[data-state="unavailable"]')) === 1);
  check(`Missing: ${r} shows no KPIs, previews, dossier or headlines`, (await count(page, '.kpi, .readout, .dossier, .q-list, .pk')) === 0);
  check(`Missing: ${r} never falls back to synthetic values`, !t.includes(demoFmt) && !/Synthetic values|demonstration/.test(t) && !(await loadedSynthetic(page)));
  check(`Missing: ${r} sky is empty`, (await skyKind(page)) === 'empty');
  if (r === '#/') check('Missing: segment labels carry no shares, no rim years', (await count(page, '.ter .num')) === 0 && (await count(page, '.yr')) === 0);
  await close();
}
{
  const { page, close } = await open('#/observatory', null);
  check('Missing: the unavailable state offers no switch to other data', (await count(page, '.data-state a')) === 0);
  await close();
}

/* ================================================================== verified, invalid file (simulated) */
for (const r of ['#/observatory', '#/', '#/insights']) {
  const { page, close } = await open(r, broken);
  check(`Invalid: ${r} shows the rejected state`, (await count(page, '.data-state[data-state="invalid"]')) === 1);
  const issues = await page.$$eval('.data-state .ds-issues li', (e) => e.map((x) => x.textContent));
  check(`Invalid: ${r} lists the validation errors`, issues.some((t) => t.includes('facts[0].t')) && issues.some((t) => t.includes('months[2].label')), issues.join(' | '));
  check(`Invalid: ${r} shows no values and loads no synthetic data`, (await count(page, '.kpi, .readout, .dossier, .q-list')) === 0 && !(await loadedSynthetic(page)));
  check(`Invalid: ${r} sky is empty`, (await skyKind(page)) === 'empty');
  await close();
}

/* ================================================================== presentation mode */
for (const lang of ['en', 'ar']) {
  const { page, close } = await open(`?lang=${lang}#/present`);
  const n0 = await page.textContent('.ps-count');
  await page.keyboard.press(lang === 'ar' ? 'ArrowLeft' : 'ArrowRight');
  await page.waitForTimeout(1200);
  const n1 = await page.textContent('.ps-count');
  check(`Present (${lang}): the forward arrow advances a slide`, n0.trim().startsWith('1 /') && n1.trim().startsWith('2 /'), `${n0} -> ${n1}`);
  await page.keyboard.press('End');
  await page.waitForTimeout(1200);
  check(`Present (${lang}): End jumps to the last slide and the URL keeps it`, /s=15/.test(page.url()));
  await page.goto(`${BASE}?lang=${lang}#/present?s=6`);
  await page.waitForTimeout(2000);
  check(`Present (${lang}): the numbers slide renders real KPIs and a chart`, (await count(page, '.pk')) === 4 && (await count(page, '.ps-chart svg')) === 1);
  await page.goto(`${BASE}?lang=${lang}#/present?s=10`);
  await page.waitForTimeout(2000);
  check(`Present (${lang}): the Lab profit slide renders real figures and the loss pulse`, (await count(page, '.pk')) === 4 && (await count(page, '.lab-pulse rect.cell')) === 41);
  await page.goto(`${BASE}?lang=${lang}#/present?s=11`);
  await page.waitForTimeout(2000);
  check(`Present (${lang}): the Lab supply slide renders the spend ring`, (await count(page, '.ps-lab-ring svg.lab-ring')) === 1 && (await count(page, '.pk')) === 4);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
  check(`Present (${lang}): Escape leaves to the homepage`, (await page.evaluate(() => location.hash)) === '#/');
  await close();
}

check('No unexpected console errors or page errors', consoleProblems.length === 0, consoleProblems.slice(0, 3).join(' / '));
await browser.close();
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
