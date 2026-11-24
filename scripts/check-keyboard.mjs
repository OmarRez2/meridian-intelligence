// Keyboard and focus smoke test across the site. Dev server must be running (BASE_URL overrides the default).
// Uses the locally installed Chrome via playwright-core. Writes nothing to disk.
import { chromium } from 'playwright-core';
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const results = [];
const check = (name, ok) => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };
const active = (fn) => page.evaluate(fn);

// ---------- Observatory ----------
await page.goto(BASE + '#/observatory');
await page.waitForTimeout(1500);

await page.focus('#tab-sales');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(900);
check('Observatory: ArrowRight on the domain tabs selects Orders', (await page.getAttribute('#tab-orders', 'aria-selected')) === 'true');

await page.focus('.seg button[data-year="2014"]');
await page.keyboard.press('Enter');
await page.waitForTimeout(600);
check('Observatory: Enter on a year selects it', (await page.getAttribute('.seg button[data-year="2014"]', 'aria-checked')) === 'true');
check('Observatory: comparison text names 2013 for 2014', (await page.textContent('.kpi-d')).includes('2013'));
check('Observatory: an active-filter chip appears', (await page.locator('.chip[data-clear="year"]').count()) === 1);
await page.focus('.chip[data-clear="year"]');
await page.keyboard.press('Enter');
await page.waitForTimeout(600);
check('Observatory: Enter on the chip removes the year filter', (await page.locator('.chip[data-clear="year"]').count()) === 0);

await page.focus('svg.trend');
await page.keyboard.press('ArrowLeft');
await page.keyboard.press('Enter');
await page.waitForTimeout(700);
check('Observatory: Arrow + Enter on a trend chart opens the month drawer', await page.isVisible('.drawer.open'));
check('Observatory: focus moves to the drawer close button', await active(() => document.activeElement?.classList.contains('drawer-close')));
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
check('Observatory: Escape closes the drawer', !(await page.isVisible('.drawer.open')));
check('Observatory: focus returns to the chart', await active(() => document.activeElement?.matches('svg.trend')));

await page.click('.def-btn >> nth=0');
check('Observatory: definition button toggles aria-expanded', (await page.getAttribute('.def-btn >> nth=0', 'aria-expanded')) === 'true');
await page.click('.table-btn >> nth=0');
check('Observatory: table view renders a table', (await page.locator('.panel-table table').count()) > 0);

// the inventory domain filters by product family from its bar lists; every bar is a keyboard button
await page.click('#tab-inventory');
await page.waitForTimeout(1200);
await page.focus('.bar-row[aria-pressed] >> nth=0');
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
check('Observatory: Enter on a family bar applies the family filter', (await page.locator('.chip[data-clear="category"]').count()) === 1);
check('Observatory: the picked bar reports aria-pressed=true', (await page.locator('.bar-row[aria-pressed="true"]').count()) >= 1);
await page.focus('.chip[data-clear="category"]');
await page.keyboard.press('Enter');
await page.waitForTimeout(600);
check('Observatory: Enter on the family chip clears it', (await page.locator('.chip[data-clear="category"]').count()) === 0);

// ---------- Overview ----------
await page.goto(BASE + '#/overview');
await page.waitForTimeout(1200);
await page.focus('.flow-track [role=tab] >> nth=0');
await page.keyboard.press('End');
await page.waitForTimeout(300);
check('Overview: End on the flow tabs selects the last step', (await page.getAttribute('.flow-track [role=tab] >> nth=-1', 'aria-selected')) === 'true');
check('Overview: focus follows the selected tab', await active(() => document.activeElement?.getAttribute('aria-selected') === 'true'));
await page.focus('.method .text-btn >> nth=0');
await page.keyboard.press('Enter');
check('Overview: Enter on a disclosure opens its region', (await page.getAttribute('.method .text-btn >> nth=0', 'aria-expanded')) === 'true' && await page.isVisible('#m-proj-source'));

// ---------- Journey ----------
await page.goto(BASE + '#/journey');
await page.waitForTimeout(1200);
await page.focus('.j-step .text-btn >> nth=0');
await page.keyboard.press('Enter');
check('Journey: Enter on "What the project records" opens it', await page.isVisible('#j-proj-source'));

// ---------- Insights ----------
await page.goto(BASE + '#/insights');
await page.waitForTimeout(1200);
const rung = page.locator('.ladder [role=tab][aria-selected="true"]');
const before = await rung.getAttribute('data-tab');
await rung.focus();
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(300);
check('Insights: ArrowLeft moves along the verification ladder', (await page.locator('.ladder [role=tab][aria-selected="true"]').getAttribute('data-tab')) !== before);

// ---------- Engineering ----------
await page.goto(BASE + '#/engineering');
await page.waitForTimeout(1200);
await page.focus('.codeview [role=tab] >> nth=0');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(300);
check('Engineering: ArrowRight changes the code example', (await page.getAttribute('.codeview [role=tab] >> nth=1', 'aria-selected')) === 'true');
await page.focus('.ent[data-id="fsales"]');
check('Engineering: star-schema tables are focusable', await active(() => document.activeElement?.matches('.ent[data-id="fsales"]')));

// ---------- Shell: motion toggle, route focus, skip link ----------
await page.goto(BASE + '#/overview');
await page.waitForTimeout(800);
await page.focus('.motion-toggle');
await page.keyboard.press('Enter');
check('Shell: motion toggle sets aria-pressed and pauses CSS motion', (await page.getAttribute('.motion-toggle', 'aria-pressed')) === 'true' && await active(() => document.documentElement.dataset.motion === 'paused'));
await page.keyboard.press('Enter');
check('Shell: motion toggle resumes', (await page.getAttribute('.motion-toggle', 'aria-pressed')) === 'false');

await page.click('.nav-links a[href="#/team"]');
await page.waitForTimeout(1200);
check('Shell: after a route change focus moves to main content', await active(() => !!document.activeElement?.closest('#main')));
check('Shell: the page title follows the route', (await page.title()).includes('Team'));

await page.goto(BASE + '#/');
await page.reload(); // fresh document load, not an in-app route change
await page.waitForTimeout(800);
await page.keyboard.press('Tab');
check('Shell: first Tab reaches the skip link', await active(() => document.activeElement?.classList.contains('skip-link')));
await page.keyboard.press('Enter');
check('Shell: skip link focuses main without changing route', await active(() => document.activeElement?.id === 'main' && location.hash === '#/'));

// ---------- Phone menu ----------
const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
await phone.goto(BASE + '#/overview');
await phone.waitForTimeout(1000);
await phone.focus('.nav-toggle');
await phone.keyboard.press('Enter');
await phone.waitForTimeout(300);
check('Phone menu: Enter opens it and focuses the first link', (await phone.getAttribute('.nav-toggle', 'aria-expanded')) === 'true' && await phone.evaluate(() => !!document.activeElement?.closest('.nav-links')));
await phone.keyboard.press('Escape');
await phone.waitForTimeout(300);
check('Phone menu: Escape closes it and returns focus to the toggle', (await phone.getAttribute('.nav-toggle', 'aria-expanded')) === 'false' && await phone.evaluate(() => document.activeElement?.classList.contains('nav-toggle')));

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
await browser.close();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
