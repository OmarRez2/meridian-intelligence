// Quick smoke test: every route in EN/AR x dark/light loads without page errors and renders content.
// Usage: node scripts/smoke.mjs  (dev server on 127.0.0.1:5173). Writes nothing.
import { chromium } from 'playwright-core';
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173/';
const routes = ['', 'overview', 'observatory', 'journey', 'insights', 'lab', 'simulator', 'engineering', 'team', 'present'];
const browser = await chromium.launch({ channel: 'chrome' });
let fails = 0;
for (const lang of ['en', 'ar']) for (const theme of ['dark', 'light']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  for (const r of routes) {
    await page.goto(`${BASE}?lang=${lang}&theme=${theme}#/${r}`);
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => ({ dir: document.documentElement.dir, theme: document.documentElement.dataset.theme, len: document.querySelector('#app, main')?.textContent?.length ?? 0 }));
    const ok = !errs.length && info.len > 200 && info.dir === (lang === 'ar' ? 'rtl' : 'ltr');
    if (!ok) fails++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${lang}/${theme} #/${r} dir=${info.dir} theme=${info.theme} text=${info.len}${errs.length ? ' errors: ' + errs.join(' | ').slice(0, 300) : ''}`);
    errs.length = 0;
  }
  await page.close();
}
await browser.close();
process.exit(fails ? 1 : 0);
