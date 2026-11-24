// Approximate WCAG text-contrast check across routes (no extra dependencies). Prints findings; writes nothing.
// Usage: node scripts/check-contrast.mjs   (dev server must be running; BASE_URL overrides the default)
// Method: for each visible text element, its colour (alpha included, element opacity ignored because the site
// fades text in on scroll) is composited over the nearest
// opaque-ish background found by walking up the tree, ending at the page background. The WebGL sky,
// gradients and images are ignored, so a pass here is necessary, not sufficient. Elements deliberately
// dimmed as "not yet reached" (the inactive journey steps) are skipped.
import { chromium } from 'playwright-core';
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173/';
const ROUTES = ['', '#/overview', '#/observatory', '#/journey', '#/insights', '#/engineering', '#/team'];
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let failures = 0;
for (const r of ROUTES) {
  await page.goto(BASE + r);
  await page.waitForTimeout(1800);
  // reveal everything that animates in on scroll, so it is measured in its final state
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((f) => setTimeout(f, 40)); } scrollTo(0, 0); });
  await page.waitForTimeout(1200);
  const found = await page.evaluate(() => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
    const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const pageBg = parse(getComputedStyle(document.body).backgroundColor) ?? { r: 5, g: 13, b: 31, a: 1 };
    const bgOf = (el) => {
      const stack = [];
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) stack.push(c); }
      return stack.reverse().reduce((acc, c) => over(c, acc), { ...pageBg, a: 1 });
    };
    const out = [];
    const seen = new Set();
    document.querySelectorAll('main *').forEach((el) => {
      if (el.closest('.j-step:not(.on), [aria-hidden="true"], svg, canvas, .sr-only')) return;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
      if (!own) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return;
      const fg = parse(cs.color); if (!fg) return;
      const op = 1; // measured in the revealed state: scroll-driven fades are transitional, not resting colours
      const bg = bgOf(el);
      const c = ratio(over({ ...fg, a: fg.a * op }, bg), bg);
      const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
      const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
      if (c < need) {
        const key = `${el.tagName}.${el.className}|${cs.color}`;
        if (seen.has(key)) return; seen.add(key);
        out.push(`${c.toFixed(2)} < ${need}  <${el.tagName.toLowerCase()} class="${el.className}">  "${el.textContent.trim().slice(0, 50)}"`);
      }
    });
    return out;
  });
  failures += found.length;
  console.log(`\n${r || '#/'}  ${found.length ? found.length + ' below threshold' : 'OK'}`);
  found.forEach((f) => console.log('  ' + f));
}
await browser.close();
console.log(`\n${failures} text styles below the WCAG AA threshold (approximate method; see header).`);
