// Performance profile of a production build, measured from outside the page.
// Usage: node scripts/perf.mjs [baseUrl] [--profiles desktop,phone,...] [--out docs/perf/after.json] [--dist dist]
//   default baseUrl: the production preview on http://127.0.0.1:4173/
//
// How it measures (identical for any build, no hooks needed in the site):
//  - an init script wraps the WebGL context: every gl.clear() is one rendered frame of the sky, every
//    drawArrays/drawElements is a draw call, and buffer/texture/program create/delete calls give live GPU objects;
//  - Chrome DevTools Protocol Performance.getMetrics gives main-thread task, script, layout and style time;
//  - requestAnimationFrame intervals give the browser's own frame pacing; the longtask observer counts tasks >50 ms;
//  - CPU throttling is Chrome's DevTools emulation. It slows JavaScript, layout and style. It does NOT slow the
//    GPU, so throttled runs approximate a weak phone's CPU, not its GPU. Nothing here is a physical-device result.
// Writes a JSON file only when --out is given (inside this project).
import { chromium } from 'playwright-core';
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const BASE = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:4173/';
const OUT = flag('--out');
const DIST = flag('--dist');

const PROFILES = {
  desktop: { label: 'Desktop 1440×900 @1x', viewport: { width: 1440, height: 900 }, dpr: 1 },
  tablet: { label: 'Tablet 820×1180 @2x, touch', viewport: { width: 820, height: 1180 }, dpr: 2, mobile: true },
  phone: { label: 'Phone 390×844 @3x, touch', viewport: { width: 390, height: 844 }, dpr: 3, mobile: true },
  'desktop-cpu4': { label: 'Desktop 1440×900, CPU ÷4', viewport: { width: 1440, height: 900 }, dpr: 1, throttle: 4 },
  'phone-cpu6': { label: 'Phone 390×844 @3x, CPU ÷6', viewport: { width: 390, height: 844 }, dpr: 3, mobile: true, throttle: 6 },
};
const chosen = (flag('--profiles') ?? 'desktop,phone,desktop-cpu4,phone-cpu6').split(',');

const INIT = () => {
  const S = (window.__perf = { clears: 0, draws: 0, first: null, hero: null, stamps: [], live: { buffer: 0, texture: 0, program: 0 }, longTasks: [] });
  // when the homepage headline exists (the page has mounted), independent of the sky
  const poll = setInterval(() => { if (document.querySelector('.hero-title')) { S.hero = performance.now(); clearInterval(poll); } }, 5);
  const wrap = (proto) => {
    if (!proto || proto.__wrapped) return;
    proto.__wrapped = true;
    const clear = proto.clear;
    proto.clear = function (m) { const t = performance.now(); S.clears++; if (S.first === null) S.first = t; S.stamps.push(t); return clear.call(this, m); };
    for (const k of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const f = proto[k]; if (!f) continue;
      proto[k] = function (...a) { S.draws++; return f.apply(this, a); };
    }
    for (const [kind, c, d] of [['buffer', 'createBuffer', 'deleteBuffer'], ['texture', 'createTexture', 'deleteTexture'], ['program', 'createProgram', 'deleteProgram']]) {
      const cf = proto[c], df = proto[d];
      proto[c] = function (...a) { const o = cf.apply(this, a); if (o) S.live[kind]++; return o; };
      proto[d] = function (o) { if (o) S.live[kind]--; return df.call(this, o); };
    }
  };
  wrap(window.WebGL2RenderingContext?.prototype);
  wrap(window.WebGLRenderingContext?.prototype);
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => S.longTasks.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true }); } catch { /* unsupported */ }
};

const pct = (arr, q) => (arr.length ? +arr[Math.min(arr.length - 1, Math.floor(arr.length * q))].toFixed(1) : null);
const dist = (d) => { const s = d.slice().sort((a, b) => a - b); return { n: s.length, p50: pct(s, 0.5), p95: pct(s, 0.95), max: s.length ? +s[s.length - 1].toFixed(1) : null }; };

async function metrics(cdp) {
  const { metrics: m } = await cdp.send('Performance.getMetrics');
  const o = Object.fromEntries(m.map((x) => [x.name, x.value]));
  return { task: o.TaskDuration * 1000, script: o.ScriptDuration * 1000, layout: o.LayoutDuration * 1000, style: o.RecalcStyleDuration * 1000, heap: o.JSHeapUsedSize };
}

/** run `act` for `ms` and report rendered frames, draw calls, main-thread time and rAF pacing over that window */
async function window_(page, cdp, ms, act) {
  const before = await page.evaluate(() => ({ c: __perf.clears, d: __perf.draws, s: __perf.stamps.length, lt: __perf.longTasks.length }));
  const m0 = await metrics(cdp);
  const rafP = page.evaluate((dur) => new Promise((res) => {
    const d = []; let last = performance.now(); const end = last + dur;
    const f = (t) => { d.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else res(d); };
    requestAnimationFrame(f);
  }), ms);
  const t0 = Date.now();
  if (act) await act();
  const raf = await rafP;
  const wall = Date.now() - t0;
  const m1 = await metrics(cdp);
  const after = await page.evaluate((s) => ({ c: __perf.clears, d: __perf.draws, stamps: __perf.stamps.slice(s), lt: __perf.longTasks.slice(0) }), before.s);
  const frames = after.c - before.c;
  const iv = after.stamps.slice(1).map((t, i) => t - after.stamps[i]);
  const perSec = (v) => +((v / wall) * 1000).toFixed(1);
  return {
    seconds: +(wall / 1000).toFixed(1),
    skyFramesPerSec: perSec(frames),
    drawCallsPerFrame: frames ? +((after.d - before.d) / frames).toFixed(1) : 0,
    renderedIntervalMs: dist(iv),
    rafIntervalMs: dist(raf),
    mainThreadMsPerSec: { task: perSec(m1.task - m0.task), script: perSec(m1.script - m0.script), layout: perSec(m1.layout - m0.layout), style: perSec(m1.style - m0.style) },
    longTasks: after.lt.length - before.lt,
  };
}

async function profile(browser, key) {
  const P = PROFILES[key];
  const ctx = await browser.newContext({ viewport: P.viewport, deviceScaleFactor: P.dpr, isMobile: !!P.mobile, hasTouch: !!P.mobile });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  if (P.throttle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.throttle });
  const slow = P.throttle ?? 1;
  const r = { profile: P.label };

  // load: three fresh visits (new context, cold cache), median of each timing
  const loads = [];
  for (let k = 0; k < 3; k++) {
    const c2 = await browser.newContext({ viewport: P.viewport, deviceScaleFactor: P.dpr, isMobile: !!P.mobile, hasTouch: !!P.mobile });
    await c2.addInitScript(INIT);
    const p2 = await c2.newPage();
    if (P.throttle) { const d2 = await c2.newCDPSession(p2); await d2.send('Emulation.setCPUThrottlingRate', { rate: P.throttle }); }
    await p2.goto(BASE);
    await p2.waitForFunction(() => __perf.first !== null && __perf.hero !== null, null, { timeout: 30000 }).catch(() => {});
    await p2.waitForTimeout(1500);
    loads.push(await p2.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0];
      const res = performance.getEntriesByType('resource');
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
      return {
        fcpMs: fcp ? Math.round(fcp) : null,
        heroMountedMs: __perf.hero === null ? null : Math.round(__perf.hero),
        firstSkyFrameMs: __perf.first === null ? null : Math.round(__perf.first),
        domContentLoadedMs: Math.round(n.domContentLoadedEventEnd),
        transferredKB: Math.round((res.reduce((a, x) => a + (x.transferSize || 0), 0) + (n.transferSize || 0)) / 1024),
        requests: res.length + 1,
        longTasksMs: __perf.longTasks.slice(),
      };
    }));
    await c2.close();
  }
  const med = (k) => { const v = loads.map((l) => l[k]).filter((x) => x !== null).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : null; };
  r.load = {
    runs: loads.length,
    fcpMs: med('fcpMs'), heroMountedMs: med('heroMountedMs'), firstSkyFrameMs: med('firstSkyFrameMs'), domContentLoadedMs: med('domContentLoadedMs'),
    transferredKB: med('transferredKB'), requests: med('requests'), longTasksMs: loads.map((l) => l.longTasksMs),
  };
  await page.goto(BASE);
  await page.waitForFunction(() => __perf.first !== null, null, { timeout: 30000 }).catch(() => {});
  // the intro: camera flight, engraving and title (first ~3.5 s after the scene starts)
  r.intro = await window_(page, cdp, 3000);
  await page.waitForTimeout(2500 * Math.min(2, slow));
  r.heroIdle = await window_(page, cdp, 5000);
  r.heroPointer = await window_(page, cdp, 3000, async () => {
    for (let i = 0; i < 60; i++) { await page.mouse.move(700 + Math.sin(i / 6) * 300, 450 + Math.cos(i / 6) * 200); await page.waitForTimeout(40); }
  });
  r.scrollStory = await window_(page, cdp, 5000, () => page.evaluate(async () => {
    const h = document.querySelector('[data-ch="6"]')?.getBoundingClientRect().top + scrollY || document.body.scrollHeight * 0.6;
    const steps = 140;
    for (let i = 0; i <= steps; i++) { scrollTo(0, (h * i) / steps); await new Promise((res) => setTimeout(res, 30)); }
  }));
  await page.waitForTimeout(3000);
  r.dialSettled = await window_(page, cdp, 4000);
  // pause motion with the visitor control
  const toggle = page.locator('.motion-toggle');
  if (await toggle.count()) {
    await toggle.click();
    await page.waitForTimeout(3500); // the pointer parallax settles after the click
    r.paused = await window_(page, cdp, 3000);
    await toggle.click();
  }
  // background: minimise the window, which the browser reports as a hidden page
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
  await page.waitForTimeout(600);
  const hidden0 = await page.evaluate(() => [__perf.clears, document.visibilityState]);
  await page.waitForTimeout(3000);
  const hidden1 = await page.evaluate(() => __perf.clears);
  r.backgroundTab = { visibilityState: hidden0[1], skyFramesIn3s: hidden1 - hidden0[0] };
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(800);

  // ambient pages
  await page.evaluate(() => { location.hash = '#/observatory'; });
  await page.waitForTimeout(3500);
  r.observatoryIdle = await window_(page, cdp, 4000);
  await page.evaluate(() => { location.hash = '#/insights'; });
  await page.waitForTimeout(3000);
  r.insightsReading = await window_(page, cdp, 4000, () => page.evaluate(async () => {
    for (let y = 0; y < 2400; y += 30) { scrollTo(0, y); await new Promise((res) => setTimeout(res, 40)); }
  }));

  // memory: tour all seven pages three times, return home, collect garbage
  const routes = ['#/', '#/overview', '#/observatory', '#/journey', '#/insights', '#/engineering', '#/team'];
  await cdp.send('HeapProfiler.collectGarbage');
  const mem0 = await metrics(cdp);
  const live0 = await page.evaluate(() => ({ ...__perf.live }));
  for (let k = 0; k < 3; k++) for (const h of routes) { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(900 * Math.min(2, slow)); }
  await page.evaluate(() => { location.hash = '#/'; });
  await page.waitForTimeout(2000);
  await cdp.send('HeapProfiler.collectGarbage');
  const mem1 = await metrics(cdp);
  const live1 = await page.evaluate(() => ({ ...__perf.live }));
  r.memory = { jsHeapMBBefore: +(mem0.heap / 1048576).toFixed(1), jsHeapMBAfter21Routes: +(mem1.heap / 1048576).toFixed(1), glObjectsBefore: live0, glObjectsAfter: live1 };

  await ctx.close();

  // reduced motion: a fresh visit with ?reduced, measured once the page has settled
  const c3 = await browser.newContext({ viewport: P.viewport, deviceScaleFactor: P.dpr, isMobile: !!P.mobile, hasTouch: !!P.mobile });
  await c3.addInitScript(INIT);
  const p3 = await c3.newPage();
  const d3 = await c3.newCDPSession(p3);
  await d3.send('Performance.enable');
  if (P.throttle) await d3.send('Emulation.setCPUThrottlingRate', { rate: P.throttle });
  await p3.goto(BASE + '?reduced');
  await p3.waitForTimeout(4000);
  r.reducedIdle = await window_(p3, d3, 3000);
  await c3.close();
  return r;
}

function bundle(dir) {
  const assets = join(dir, 'assets');
  const files = readdirSync(assets).filter((f) => f.endsWith('.js') || f.endsWith('.css'));
  const row = (f) => { const b = readFileSync(join(assets, f)); return { file: f.replace(/-[\w-]{8}\./, '.'), kB: +(statSync(join(assets, f)).size / 1024).toFixed(1), gzipKB: +(gzipSync(b).length / 1024).toFixed(1) }; };
  const all = files.map(row);
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  const entry = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+)"/g)].map((m) => m[1]).filter((f) => f.endsWith('.js') || f.endsWith('.css'));
  const sum = (rows, k) => +rows.reduce((a, x) => a + x[k], 0).toFixed(1);
  const entryRows = all.filter((r, i) => entry.includes(files[i]));
  return { entryGzipKB: sum(entryRows, 'gzipKB'), totalJsGzipKB: sum(all.filter((r) => r.file.endsWith('.js')), 'gzipKB'), files: all.sort((a, b) => b.gzipKB - a.gzipKB) };
}

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-position=-2400,0'] });
const gpu = await (async () => {
  const p = await browser.newPage();
  const g = await p.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c?.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
  await p.close();
  return g;
})();
const out = { measuredAt: new Date().toISOString(), base: BASE, browser: `Chrome ${browser.version()} (playwright-core, headed)`, gpu, note: 'One Windows machine. CPU throttling is DevTools emulation and does not slow the GPU. Not a physical-device result.', profiles: {} };
if (DIST) out.bundle = bundle(resolve(ROOT, DIST));
for (const k of chosen) {
  process.stderr.write(`profiling ${k}…\n`);
  out.profiles[k] = await profile(browser, k);
}
await browser.close();
const json = JSON.stringify(out, null, 1);
if (OUT) { const p = resolve(ROOT, OUT); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, json); process.stderr.write(`wrote ${OUT}\n`); }
console.log(json);
