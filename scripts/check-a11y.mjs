// Accessibility audit with axe-core (WCAG 2.0/2.1/2.2 A and AA rules, plus best practices).
// Usage: node scripts/check-a11y.mjs [filter] [--verbose]   (needs the dev server; BASE_URL overrides it)
// Runs the seven main pages and the important states (drawer, glossary, phone menu, verified view, no-WebGL,
// reduced motion) at desktop and phone sizes in the installed Chrome via playwright-core. Writes nothing to disk.
// What axe cannot judge here: text over the WebGL sky (it reports those as "needs review", not pass or fail),
// screen-reader announcements in practice, and whether alternatives are meaningful. Those need a manual pass.
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE = require.resolve('axe-core/axe.min.js');
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173/';
const filter = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? '';
const verbose = process.argv.includes('--verbose');

const desktop = { viewport: { width: 1440, height: 900 } };
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

/** reveal everything a reader would see by scrolling, so off-screen sections are audited in their final state */
const scrollThrough = async (p) => {
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    scrollTo(0, 0);
    // content-visibility: auto only defers rendering; audit every section in its rendered state, not as a skipped box
    const st = document.createElement('style'); st.textContent = '.lab-inst, .lab-close { content-visibility: visible !important; }'; document.head.append(st);
  });
  await p.waitForTimeout(600);
};

/** containers that recede while the reader is on another step; see docs/accessibility.md */
const DIMMED = '.j-step:not(.on), .ch:not(.is-active) .ch-inner';

const CASES = [
  ['atlas', desktop, '', scrollThrough],
  ['overview', desktop, '#/overview', scrollThrough],
  ['observatory', desktop, '#/observatory', null],
  ['observatory-drawer', desktop, '#/observatory', async (p) => { await p.locator('.kpi button, [data-drill]').first().click(); await p.waitForTimeout(700); }],
  ['observatory-glossary', desktop, '#/observatory', async (p) => { await p.locator('.glossary-toggle, [aria-controls*="gloss"]').first().click().catch(() => {}); await p.waitForTimeout(600); }],
  ['observatory-customers', desktop, '#/observatory?d=customers', null],
  ['journey', desktop, '#/journey', scrollThrough],
  ['insights', desktop, '#/insights', scrollThrough],
  ['engineering', desktop, '#/engineering', scrollThrough],
  ['team', desktop, '#/team', scrollThrough],
  ['lab', desktop, '#/lab', scrollThrough],
  ['light-lab', desktop, '?theme=light#/lab', scrollThrough],
  ['ar-lab', desktop, '?lang=ar#/lab', scrollThrough],
  ['ar-light-lab', desktop, '?lang=ar&theme=light#/lab', scrollThrough],
  ['phone-lab', phone, '#/lab', scrollThrough],
  ['sim', desktop, '#/simulator?p=0.05&ps=a&e=-1.5&r=0.5&s=2&k=0.1&pt=0.5&cv=12&cr=0.15&ab=1&a.p=0.056&a.ps=s', scrollThrough],
  ['ar-light-sim', desktop, '?lang=ar&theme=light#/simulator?p=0.05&ps=s&s=2&k=0.1&cv=12&ab=1&a.r=0.5', scrollThrough],
  ['phone-sim', phone, '#/simulator?r=0.3&s=2&k=0.1&cv=6&cr=0.1&ab=1&a.p=0.05', scrollThrough],
  ['present', desktop, '#/present?s=6', null],
  ['present-team', desktop, '#/present?s=15', null],
  ['present-sim', desktop, '#/present?s=13', null],
  ['ar-light-present-sim', desktop, '?lang=ar&theme=light#/present?s=13', null],
  ['present-lab-forecast', desktop, '#/present?s=12', null],
  ['ar-light-present-lab-forecast', desktop, '?lang=ar&theme=light#/present?s=12', null],
  ['present-lab-profit', desktop, '#/present?s=10', null],
  ['ar-light-present-lab-supply', desktop, '?lang=ar&theme=light#/present?s=11', null],
  ['light-atlas', desktop, '?theme=light#/', scrollThrough],
  ['light-observatory', desktop, '?theme=light#/observatory', null],
  ['light-present', desktop, '?theme=light#/present?s=7', null],
  ['ar-atlas', desktop, '?lang=ar#/', scrollThrough],
  ['ar-light-observatory', desktop, '?lang=ar&theme=light#/observatory', null],
  ['ar-insights', desktop, '?lang=ar#/insights', scrollThrough],
  ['ar-light-team', desktop, '?lang=ar&theme=light#/team', scrollThrough],
  ['ar-present', desktop, '?lang=ar#/present?s=6', null],
  ['ar-light-engineering', desktop, '?lang=ar&theme=light#/engineering', scrollThrough],
  ['nogl', desktop, '?nogl#/', scrollThrough],
  ['reduced', desktop, '?reduced#/', scrollThrough],
  ['phone-atlas', phone, '', scrollThrough],
  ['phone-menu', phone, '', async (p) => { await p.locator('.nav-toggle, [aria-controls="site-menu"], .menu-toggle').first().click().catch(() => {}); await p.waitForTimeout(600); }],
  ['phone-observatory', phone, '#/observatory', null],
  ['phone-journey', phone, '#/journey', scrollThrough],
  ['phone-insights', phone, '#/insights', scrollThrough],
  ['phone-engineering', phone, '#/engineering', scrollThrough],
  ['phone-team', phone, '#/team', scrollThrough],
  ['phone-overview', phone, '#/overview', scrollThrough],
];

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-position=-2400,0'] });
let total = 0;
const byRule = new Map();
for (const [name, ctxOpts, url, act] of CASES) {
  if (filter && !name.includes(filter)) continue;
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(BASE + url);
  await page.waitForTimeout(3200);
  if (act) await act(page);
  await page.addScriptTag({ path: AXE });
  const res = await page.evaluate(async (dimSel) => {
    const r = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
      resultTypes: ['violations', 'incomplete'],
    });
    // Text inside a story step or chapter that is dimmed because the reader is elsewhere is a documented design
    // deviation (docs/accessibility.md). It is counted separately; any other contrast failure still fails.
    let dimmed = 0;
    for (const v of r.violations) {
      if (v.id !== 'color-contrast') continue;
      const keep = v.nodes.filter((n) => !document.querySelector(n.target[0])?.closest(dimSel));
      dimmed += v.nodes.length - keep.length;
      v.nodes = keep;
    }
    r.violations = r.violations.filter((v) => v.nodes.length);
    r.dimmed = dimmed;
    return r;
  }, DIMMED);
  const v = res.violations;
  total += v.length;
  const review = res.incomplete.reduce((a, r) => a + r.nodes.length, 0);
  console.log(`${v.length ? 'FAIL' : 'ok  '} ${name.padEnd(24)} ${v.length} violation${v.length === 1 ? '' : 's'}, ${review} node${review === 1 ? '' : 's'} need manual review${res.dimmed ? `, ${res.dimmed} in dimmed story steps (documented)` : ''}`);
  for (const r of v) {
    byRule.set(r.id, (byRule.get(r.id) ?? 0) + r.nodes.length);
    console.log(`     - ${r.id} [${r.impact}] ${r.help} (${r.nodes.length})`);
    for (const n of r.nodes.slice(0, verbose ? 20 : 3)) console.log(`         ${n.target.join(' ')}  ${verbose ? n.failureSummary.replace(/\s+/g, ' ') : ''}`);
  }
  if (verbose) for (const r of res.incomplete) console.log(`     ? ${r.id}: ${r.help} (${r.nodes.length})`);
  await ctx.close();
}
await browser.close();
console.log(`\n${total} violation${total === 1 ? '' : 's'} in total${byRule.size ? ': ' + [...byRule].map(([k, n]) => `${k}×${n}`).join(', ') : ''}`);
process.exitCode = total ? 1 : 0;
