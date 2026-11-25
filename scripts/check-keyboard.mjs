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

// ---------- Analytics Lab ----------
await page.goto(BASE + '#/lab');
await page.waitForTimeout(1500);
const firstClaim = async () => (await page.textContent('.abc-claims .claim-finding')).trim();
const revClaim = await firstClaim();
await page.focus('.lab-basis [data-basis="revenue"]');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(500);
check('Lab: ArrowRight on the basis radios selects "By profit" and moves focus', (await page.getAttribute('[data-basis="profit"]', 'aria-checked')) === 'true' && await active(() => document.activeElement?.dataset.basis === 'profit'));
check('Lab: switching the basis recomputes the statements', (await firstClaim()) !== revClaim);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(400);
await page.focus('.lab-map circle.star[tabindex="0"]');
const star0 = await active(() => document.activeElement?.getAttribute('aria-label'));
await page.keyboard.press('ArrowRight');
const star1 = await active(() => document.activeElement?.getAttribute('aria-label'));
check('Lab: ArrowRight moves between stars on the profit map', !!star0 && !!star1 && star0 !== star1);
check('Lab: focusing a star fills the item readout', (await page.textContent('.readout-card .rc-name'))?.length > 0);
check('Lab: the map is a single tab stop', (await page.locator('.lab-map circle.star[tabindex="0"]').count()) === 1);
await page.focus('.q-cell[data-cls="A"][data-high="false"]');
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
check('Lab: Enter on a class/margin cell filters the map', (await page.getAttribute('.q-cell[data-cls="A"][data-high="false"]', 'aria-pressed')) === 'true' && (await page.locator('.lab-map circle.star.dim').count()) > 0);
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
check('Lab: Enter again clears the filter', (await page.locator('.lab-map circle.star.dim').count()) === 0);
await page.locator('#lab-leak').scrollIntoViewIfNeeded(); await page.waitForTimeout(400); // instruments draw as they near the viewport
await page.focus('.lab-drip rect.drip-hit[tabindex="0"]');
await page.keyboard.press('End');
check('Lab: End jumps to the last month on the leakage chart', await active(() => { const r = [...document.querySelectorAll('.lab-drip rect.drip-hit')]; return document.activeElement === r[r.length - 1]; }));
check('Lab: focusing a month highlights its year in the ledger', (await page.locator('#lab-leak .ledger tr.on').count()) === 1);
await page.locator('#lab-loss').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
await page.focus('.lab-pulse rect.cell[tabindex="0"]');
await page.keyboard.press('ArrowRight');
check('Lab: ArrowRight moves along the loss pulse', await active(() => document.activeElement?.matches('.lab-pulse rect.cell') && document.activeElement.dataset.i === '1'));
await page.locator('#lab-stock').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
const excess0 = await page.textContent('[data-excess]');
await page.focus('#cover-policy');
for (let k = 0; k < 12; k++) await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);
check('Lab: arrow keys on the cover policy recompute the capital beyond it', (await page.getAttribute('#cover-policy', 'aria-valuetext'))?.startsWith('24') && (await page.textContent('[data-excess]')) !== excess0);
await page.focus('.lab-hist rect.hist-hit[tabindex="0"]');
await page.keyboard.press('End');
check('Lab: End reaches the last cover band', await active(() => { const r = [...document.querySelectorAll('.lab-hist rect.hist-hit')]; return document.activeElement === r[r.length - 1]; }));
await page.locator('#lab-forecast').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
await page.focus('.fc-model [aria-checked="true"]');
await page.keyboard.press('ArrowRight');
check('Lab: arrow keys on the forecast rules select the next rule and redraw the scores', await active(() => document.activeElement?.getAttribute('aria-checked') === 'true' && document.activeElement.dataset.model === 'avg12') && (await page.locator('.fc-board tr.on').count()) === 1 && (await page.textContent('.fc-board tr.on th')).includes('12-month'));
await page.focus('.lab-backtest rect.bt-hit[tabindex="0"]');
await page.keyboard.press('End');
check('Lab: End reaches the last scored month on the backtest', await active(() => { const r = [...document.querySelectorAll('.lab-backtest rect.bt-hit')]; return document.activeElement === r[r.length - 1]; }));
await page.focus('.lab-index a >> nth=2');
await page.keyboard.press('Enter');
await page.waitForTimeout(900);
check('Lab: the instrument index moves focus to the instrument heading', await active(() => document.activeElement?.id === 'lab-leak-h'));
await page.focus('.dc-link >> nth=1');
await page.keyboard.press('Enter');
await page.waitForTimeout(900);
check('Lab: a recommendation evidence link moves focus to its instrument', await active(() => document.activeElement?.id === 'lab-supply-h'));

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
