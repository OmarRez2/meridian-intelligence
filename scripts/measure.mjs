// Performance measurement on this machine. Prints numbers only; writes nothing to disk.
// Usage: node scripts/measure.mjs [baseUrl]   (default: the production preview on :4173)
// What it measures, and what it does not:
//  - load timings and transferred bytes for the homepage, from the browser's own Performance API;
//  - frame intervals (requestAnimationFrame) on the hero and while scrolling the story;
//  - the adaptive-quality state the scene chose (dev builds expose it; the preview build does not).
// Results describe one Windows machine running Chrome through playwright-core. They are not a claim
// about other devices, browsers or network conditions.
import { chromium } from 'playwright-core';
const BASE = process.argv[2] ?? 'http://127.0.0.1:4173/';
// THROTTLE=6 slows the page's CPU sixfold (Chrome DevTools emulation) to exercise the adaptive-quality fallback
const THROTTLE = Number(process.env.THROTTLE ?? 1);
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-position=-2400,0'] });

async function run(label, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: opts.dpr ?? 1, isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  const page = await ctx.newPage();
  if (THROTTLE > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE }); }
  await page.goto(BASE);
  await page.waitForTimeout(THROTTLE > 1 ? 9000 : 3500);
  const load = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource');
    const bytes = res.reduce((a, r) => a + (r.transferSize || 0), 0) + (n.transferSize || 0);
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
    return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: fcp ? Math.round(fcp) : null, transferredKB: Math.round(bytes / 1024), requests: res.length + 1 };
  });
  const frames = (ms) => page.evaluate((dur) => new Promise((res) => {
    const d = []; let last = performance.now(); const end = last + dur;
    const f = (t) => { d.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else { d.sort((a, b) => a - b); res({ frames: d.length, medianMs: +d[d.length >> 1].toFixed(1), p95Ms: +d[Math.floor(d.length * 0.95)].toFixed(1) }); } };
    requestAnimationFrame(f);
  }), ms);
  const hero = await frames(3000);
  const scrollP = page.evaluate(async () => { const h = document.body.scrollHeight; for (let y = 0; y < h * 0.6; y += 40) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 16)); } });
  const scroll = await frames(3000);
  await scrollP;
  const quality = await page.evaluate(() => window.__sky?.quality ?? 'not exposed in this build');
  console.log(JSON.stringify({ label, viewport, load, hero, scroll, quality }, null, 1));
  await ctx.close();
}

await run('desktop 1440x900', { width: 1440, height: 900 });
if (THROTTLE === 1) await run('phone-sized 390x844 @2x (desktop GPU, not a phone)', { width: 390, height: 844 }, { dpr: 2, mobile: true });
await browser.close();
