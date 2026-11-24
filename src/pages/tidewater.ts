import '../styles/tidewater.css';
import type { Page } from '../lib/router';
import { prefersReducedMotion } from '../lib/env';
import { getDataset } from '../data/adapter';
import { esc } from '../lib/format';
import { dataStatePanel } from '../components/datastate';

/** Alternative direction study: "Tidewater". Lighter build — enough to judge its character. */
const page: Page & { stop?: () => void } = {
  async mount(root) {
    // a design study, but its numbers still come through the adapter and follow the data mode
    const result = await getDataset();
    const ds = result.state === 'ready' ? result.dataset : null;
    const gauges = (ds?.categories ?? []).map((c, i) => {
      const its = ds!.items.filter((x) => x.c === i);
      const on = its.reduce((s, x) => s + x.onHand, 0), re = its.reduce((s, x) => s + x.reorder, 0);
      return { c, level: Math.min(0.95, on / (re * 2.2)), mark: 1 / 2.2, below: on < re };
    });
    root.innerHTML = `
    <div class="tw">
      <section class="tw-hero">
        <canvas class="tw-field" aria-hidden="true"></canvas>
        <div class="tw-copy">
          <p class="tw-crumb"><a href="#/directions">Design directions</a> / Tidewater study</p>
          <h1 class="tw-title">Stock rises and falls<br/>like a tide.</h1>
          <p class="tw-lede">Tidewater reads the supply chain as a harbour. Demand is the current, inventory is the water level, and every reorder level is a line painted on the harbour wall.</p>
        </div>
      </section>
      <section class="tw-gauges" aria-labelledby="g-h">
        <h2 id="g-h">Tide gauges by stock group</h2>
        ${result.state === 'ready' ? `<p class="tw-note">${ds!.provenance.status === 'synthetic' ? 'Synthetic levels.' : 'Levels from the verified export.'} The coral line on each gauge is the combined reorder level.</p>
        <ul class="gauges">
          ${gauges.map((g) => `<li class="gauge${g.below ? ' low' : ''}" style="--lvl:${g.level};--mark:${g.mark}"><div class="tube" role="img" aria-label="${esc(g.c)}: ${g.below ? 'below' : 'above'} reorder level"><span class="water"></span><span class="mark"></span></div><b>${esc(g.c)}</b></li>`).join('')}
        </ul>` : `${dataStatePanel(result, '/directions/tidewater', { compact: true, headingId: 'g-state' })}<ul class="gauges"></ul>`}
        <a class="tw-back" href="#/directions">Back to the design directions</a>
      </section>
    </div>`;

    const cv = root.querySelector<HTMLCanvasElement>('.tw-field')!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    const draw = (t: number) => {
      const dpr = Math.min(2, devicePixelRatio);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (let k = 0; k < 26; k++) {
        ctx.beginPath();
        for (let x = -10; x <= w + 10; x += 10) {
          const base = h * (0.08 + k * 0.036);
          const y = base + Math.sin(x * 0.0042 + k * 0.45 + t * 0.00035) * 26 + Math.sin(x * 0.011 - t * 0.0005 + k * 1.3) * 10 + Math.cos(x * 0.0021 + t * 0.0002) * 14;
          if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        const reorder = k === 15;
        ctx.strokeStyle = reorder ? 'rgba(226,114,91,0.9)' : `rgba(15,61,64,${0.12 + (k / 26) * 0.35})`;
        ctx.lineWidth = reorder ? 2.2 : 1;
        ctx.stroke();
      }
    };
    if (prefersReducedMotion()) draw(0);
    else { const loop = (t: number) => { draw(t); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); }
    requestAnimationFrame(() => root.querySelector('.gauges')?.classList.add('in'));
    this.stop = () => cancelAnimationFrame(raf);
  },
  unmount() { this.stop?.(); },
};
export default page;
