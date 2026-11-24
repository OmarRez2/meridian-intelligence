import '../styles/journey.css';
import type { Page } from '../lib/router';
import { rng } from '../lib/rng';
import { motion } from '../lib/motion';
import { pageHeader, nextChapter, siteFooter, statusBadge } from '../components/shell';
import { wireDisclosures } from '../components/tabs';
import { STAGES } from '../content/journey';
import { L, tr } from '../i18n';
import { theme, token } from '../lib/theme';

/** Short labels for the diagram's seven zones; the full titles live in the steps beside it. */
const ZONE_LABELS = () => [L('Source', 'المصدر'), L('Quality', 'الجودة'), L('ETL', 'ETL'), L('Validate', 'التحقق'), L('Model', 'النموذج'), L('Report', 'التقرير'), L('Insight', 'الرؤية')];
const LANE_NAMES = () => [L('Sales', 'المبيعات'), L('Purchasing', 'المشتريات'), L('Stock', 'المخزون')];
const LANE_TOKENS = ['glacier', 'brass', 'chalk'];
/** canvas colours come from the theme tokens, re-read when the theme changes */
const C = { lanes: ['', '', ''], ember: '', raw: '', ink: '', rgb: { ink: '', glacier: '', ember: '', brass: '', haze: '' } };
function readColours() {
  C.lanes = LANE_TOKENS.map((t) => token(t));
  C.ember = token('ember'); C.ink = token('chalk');
  for (const k of Object.keys(C.rgb) as (keyof typeof C.rgb)[]) C.rgb[k] = token(`${k}-rgb`).replace(/\s+/g, ',');
  C.raw = `rgba(${C.rgb.haze},0.75)`;
}
const rgba = (k: keyof typeof C.rgb, a: number) => `rgba(${C.rgb[k]},${a})`;

const page: Page & { cleanup: (() => void)[] } = {
  cleanup: [],
  mount(root) {
    readColours();
    const zoneLabels = ZONE_LABELS(), laneNames = LANE_NAMES();
    root.innerHTML = `
    <div class="journey page-pad">
      ${pageHeader('journey', L('The data journey', 'رحلة البيانات'), L('How a record travels from the operational database to a recommendation, in the seven stages the team followed. Each stage gives the method and, separately, what the project’s files record and how far it has gone.', 'كيف ينتقل السجل من قاعدة البيانات التشغيلية إلى توصية، عبر المراحل السبع التي اتبعها الفريق. تعرض كل مرحلة المنهجية، ثم ما تسجله ملفات المشروع ومدى التقدم فيها.'), `<p class="j-badges">${statusBadge('illustrative', L('Illustrative diagram', 'مخطط توضيحي'))} ${statusBadge('pending', L('Counts from project files; team approval pending', 'الأرقام من ملفات المشروع؛ الاعتماد بانتظار الفريق'))}</p>`)}
      <div class="j-grid">
        <div class="j-figure" aria-hidden="true" dir="ltr">
          <canvas class="j-canvas"></canvas>
          <ol class="j-zones">${zoneLabels.map((s, i) => `<li data-i="${i}">${s}</li>`).join('')}</ol>
          <div class="j-legend">${laneNames.map((n, i) => `<span><i style="background:var(--${LANE_TOKENS[i]})"></i>${n}</span>`).join('')}<span><i class="ember"></i>${L('Held for review', 'محتجز للمراجعة')}</span></div>
        </div>
        <ol class="j-steps">
          ${STAGES.map((s, i) => `
          <li class="j-step" data-i="${i}">
            <span class="j-n num">${i + 1}</span>
            <div>
              <h2>${tr(s.title)}</h2>
              ${statusBadge(s.state)}
              <p class="j-k">${tr(s.line)}</p>
              <p>${tr(s.method)}</p>
              <p class="j-shows"><span>${L('In the diagram', 'في المخطط')}</span>${tr(s.shows)}</p>
              <button class="text-btn" type="button" aria-expanded="false" aria-controls="j-proj-${s.id}">${L('What the project did', 'ما أنجزه المشروع')}</button>
              <div class="j-proj" id="j-proj-${s.id}" hidden><p>${tr(s.project)}</p><p class="j-evidence"><span>${L('Evidence', 'الدليل')}</span> ${tr(s.evidence)}</p></div>
            </div>
          </li>`).join('')}
          <li class="j-step j-end" data-i="6">
            <div>
              <h2>${L('Where the journey ends', 'أين تنتهي الرحلة')}</h2>
              <p>${L('The Observatory explores the same source data, reconciled to the team’s SQL benchmarks. The Insights page turns it into findings, each with its evidence, its limits and a recommendation.', 'يستكشف المرصد بيانات المصدر نفسها، مطابقةً لمعايير الفريق المحسوبة بـ SQL. وتحوّلها صفحة الرؤى إلى نتائج، لكل منها دليلها وحدودها وتوصيتها.')}</p>
              <div class="j-actions">
                <a class="btn btn-primary" href="#/observatory"><span class="dial" aria-hidden="true"></span>${L('Open the Observatory', 'افتح المرصد')}</a>
                <a class="btn" href="#/insights">${L('Read the insights', 'اقرأ الرؤى')}</a>
              </div>
            </div>
          </li>
        </ol>
      </div>
      ${nextChapter('journey', L('Findings from 41 months of data, each with its evidence, limits and a recommendation.', 'نتائج من 41 شهرًا من البيانات، لكل منها دليلها وحدودها وتوصيتها.'))}
      ${siteFooter()}
    </div>`;
    wireDisclosures(root);

    const canvas = root.querySelector<HTMLCanvasElement>('.j-canvas')!;
    const ctx = canvas.getContext('2d')!;
    const zones = [...root.querySelectorAll<HTMLElement>('.j-zones li')];
    const steps = [...root.querySelectorAll<HTMLElement>('.j-step')];
    let active = 0;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        active = Number((e.target as HTMLElement).dataset.i);
        steps.forEach((s) => s.classList.toggle('on', s === e.target));
        zones.forEach((z, i) => z.classList.toggle('on', i === active));
        if (motion.still) frame(0); // keep the static picture in step with the text
      });
    }, {
      // on narrow screens the sticky diagram covers the top half, so the reading line sits below it
      rootMargin: window.matchMedia('(max-width: 900px)').matches ? '-66% 0px -28% 0px' : '-45% 0px -45% 0px',
    });
    steps.forEach((s) => io.observe(s));

    // ---------- the diagram ----------
    const NZ = zoneLabels.length;
    const Z = Array.from({ length: NZ + 1 }, (_, i) => i / NZ);
    const END = Z[5]; // records end their travel where the report zone begins and become bars
    let W = 0, H = 0;
    const dpr = Math.min(2, window.devicePixelRatio);
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (motion.still) frame(0);
    };

    const r = rng(55);
    type P = { x: number; y0: number; lane: number; bad: boolean; v: number; s: number };
    const N = window.innerWidth < 700 ? 240 : 460;
    const fresh = (p: Partial<P> = {}): P => ({ x: 0, y0: r(), lane: Math.floor(r() * 3), bad: r() < 0.09, v: 0.0003 + r() * 0.00035, s: r(), ...p });
    const ps: P[] = Array.from({ length: N }, () => fresh({ x: r() * END }));
    const bars = [0, 0, 0];
    let held = 0;
    let t = 0;
    const sm = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

    const frame = (dt: number) => {
      t += dt;
      ctx.clearRect(0, 0, W, H);
      if (!W) return;
      const top = H * 0.14, band = H * 0.58, trayY = H * 0.84;
      const laneY = (l: number) => top + band * (0.2 + l * 0.3);
      const zx = (i: number) => Z[i] * W;

      // zone tints and dividers
      for (let i = 0; i < NZ; i++) {
        if (i === active) { ctx.fillStyle = rgba('glacier', 0.06); ctx.fillRect(zx(i), 0, zx(i + 1) - zx(i), H); }
        if (i > 0) { ctx.strokeStyle = rgba('haze', 0.18); ctx.beginPath(); ctx.moveTo(zx(i), top - 14); ctx.lineTo(zx(i), top + band + 14); ctx.stroke(); }
      }

      // 2 Explore: a lens sweeps the column and inspects the records inside it
      const lensX = (zx(1) + zx(2)) / 2;
      const lensY = top + band * (0.5 + 0.38 * Math.sin(t * 0.0007));
      const lensR = Math.min(34, (zx(2) - zx(1)) * 0.42);
      ctx.strokeStyle = rgba('ink', active === 1 ? 0.75 : 0.28);
      ctx.beginPath(); ctx.arc(lensX, lensY, lensR, 0, 6.283); ctx.stroke();

      // 4 Validate: the gate and the review tray
      const gateX = zx(3) + 10;
      ctx.strokeStyle = rgba('ember', active === 3 ? 0.85 : 0.35);
      ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(gateX, top - 14); ctx.lineTo(gateX, trayY - 16); ctx.stroke(); ctx.setLineDash([]);
      const trayW = (zx(4) - zx(3)) * 0.86;
      ctx.strokeStyle = rgba('ember', 0.32);
      ctx.strokeRect(zx(3) + 4, trayY - 12, trayW, 24);
      const trayCols = Math.max(6, Math.floor((trayW - 10) / 4.2));
      const shown = Math.min(held, trayCols * 4);
      ctx.fillStyle = rgba('ember', 0.85);
      for (let k = 0; k < shown; k++) ctx.fillRect(zx(3) + 9 + (k % trayCols) * 4.2, trayY - 8 + Math.floor(k / trayCols) * 4.4, 2.6, 2.6);

      // records in transit
      for (const p of ps) {
        const prev = p.x;
        const inExplore = p.x > Z[1] && p.x < Z[2];
        p.x += p.v * dt * (inExplore ? 0.5 : 1);
        if (p.bad && prev <= gateX / W && p.x > gateX / W) { held = held >= trayCols * 4 ? trayCols * 3 : held + 1; Object.assign(p, fresh()); continue; }
        if (p.x >= END) { bars[p.lane] = Math.min(band * 0.92, bars[p.lane] + 1.1); Object.assign(p, fresh()); continue; }
        const lane = laneY(p.lane);
        const raw = top + p.y0 * band;
        const toLane = sm(Z[2], Z[2] + 0.09, p.x);
        let y = raw + (lane - raw) * toLane + Math.sin(p.s * 40 + p.x * 30) * 5 * (1 - toLane);
        y += (p.s - 0.5) * band * 0.18 * toLane * (1 - sm(Z[4], Z[4] + 0.05, p.x) * 0.6);
        const modelled = p.x > Z[4];
        if (modelled) y = Math.round(y / 9) * 9;
        const x = p.x * W;
        const inspected = inExplore && Math.hypot(x - lensX, y - lensY) < lensR;
        ctx.fillStyle = p.bad && p.x < gateX / W ? C.ember : p.x < Z[2] ? (inspected ? C.ink : C.raw) : C.lanes[p.lane];
        ctx.globalAlpha = inspected ? 1 : 0.85;
        if (modelled) ctx.fillRect(x - 1.8, y - 1.8, 3.6, 3.6);
        else { ctx.beginPath(); ctx.arc(x, y, inspected ? 2.4 : 1.7, 0, 6.283); ctx.fill(); }
      }
      ctx.globalAlpha = 1;

      // 6 Report: bars settle slowly so the picture never saturates
      const bz0 = zx(5), bzw = zx(6) - zx(5);
      const bw = (bzw - 24) / 3 - 6;
      const bx = (i: number) => bz0 + 12 + i * (bw + 6);
      const base = top + band;
      C.lanes.forEach((col, i) => {
        if (dt) bars[i] *= 0.9994;
        ctx.fillStyle = col; ctx.globalAlpha = 0.22; ctx.fillRect(bx(i), base - bars[i], bw, bars[i]);
        ctx.globalAlpha = 0.9; ctx.fillRect(bx(i), base - bars[i], bw, 2);
      });
      ctx.globalAlpha = 1;

      // 7 Insight: the tallest bar is compared with the average and carried into a note
      const avg = (bars[0] + bars[1] + bars[2]) / 3;
      const lead = bars.indexOf(Math.max(...bars));
      if (bars[lead] > 8) {
        const on = active === 6 ? 1 : 0.55;
        ctx.strokeStyle = rgba('ink', 0.5 * on);
        ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(bz0 + 6, base - avg); ctx.lineTo(zx(6) - 2, base - avg); ctx.stroke(); ctx.setLineDash([]);
        const cx = bx(lead) + bw / 2, cy = base - bars[lead];
        ctx.strokeStyle = rgba('brass', on);
        ctx.beginPath(); ctx.arc(cx, cy - 7, 5, 0, 6.283); ctx.stroke();
        const nx = zx(6) + 10, nw = zx(7) - nx - 10, ny = Math.max(top, cy - 30);
        ctx.beginPath(); ctx.moveTo(cx + 5, cy - 7); ctx.lineTo(nx, ny + 10); ctx.stroke();
        ctx.strokeRect(nx, ny, nw, 58);
        // abstract lines of text: observation, evidence, recommendation
        [0.85, 0.6, 0.72].forEach((f, k) => {
          ctx.fillStyle = k === 0 ? rgba('brass', 0.8 * on) : rgba('haze', 0.45 * on);
          ctx.fillRect(nx + 8, ny + 12 + k * 14, (nw - 16) * f, 3);
        });
      }
    };

    // ---------- loop, pause and reduced motion ----------
    let raf = 0, last = 0;
    const loop = (now: number) => { frame(Math.min(50, now - last)); last = now; raf = requestAnimationFrame(loop); };
    const start = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop); };
    const settle = () => { for (let i = 0; i < 1400; i++) frame(16); };
    resize();
    if (motion.still) settle(); else start();
    const unsub = motion.subscribe((paused) => { if (paused || motion.reduced) { cancelAnimationFrame(raf); frame(0); } else start(); });
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const unTheme = theme.subscribe(() => { readColours(); if (motion.still) frame(0); });
    this.cleanup.push(() => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); unsub(); unTheme(); });
  },
  unmount() { this.cleanup.forEach((f) => f()); this.cleanup = []; },
};
export default page;
