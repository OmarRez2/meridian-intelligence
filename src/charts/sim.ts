import { scaleLinear } from 'd3-scale';
import { line, curveMonotoneX } from 'd3-shape';
import { L, money, pct } from '../i18n';
import { esc } from '../lib/format';
import { motion } from '../lib/motion';
import type { Basis } from '../data/sim';

/**
 * Decision Simulator charts. All three redraw from numbers handed in by the page; none computes anything.
 *  - ProfitBridge: recorded gross profit → each step → scenario gross profit (a waterfall on a zoomed axis).
 *  - loadGauge: how the bridge's total movement splits between decision, external and assumed steps.
 *  - SensitivityCurve: scenario profit across the volume assumption, with the break-even point.
 * Charts stay LTR in Arabic (as elsewhere on the site); assumed steps are hatched, matching the dashed
 * "assumption" mark in the statements.
 */
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export type BridgeBar = { key: string; label: string; short?: string; basis: Basis | 'total'; delta: number };

/** Hatch pattern for assumed steps; one per chart so ids never collide. */
const hatch = (id: string) => `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="br-hatch-bg"/><line x1="0" y1="0" x2="0" y2="6" class="br-hatch-ln"/></pattern></defs>`;

export class ProfitBridge {
  private el: HTMLElement;
  private w = 0;
  private ro: ResizeObserver;
  private from: number[] | null = null;
  private cur: { base: number; bars: BridgeBar[] } | null = null;
  private raf = 0;
  private focusIndex = 0;
  private shape = '';
  constructor(el: HTMLElement) {
    this.el = el;
    this.w = el.clientWidth;
    this.ro = new ResizeObserver(([e]) => { const w = Math.round(e.contentRect.width); if (w && w !== this.w) { this.w = w; this.render(1, this.levels()); } });
    this.ro.observe(el);
    el.addEventListener('keydown', (e) => this.key(e));
  }
  destroy() { this.ro.disconnect(); cancelAnimationFrame(this.raf); }

  /** cumulative levels: [recorded, after step 1, …, scenario] */
  private levels() {
    if (!this.cur) return [];
    const out = [this.cur.base];
    for (const b of this.cur.bars) if (b.basis !== 'total') out.push(out[out.length - 1] + b.delta);
    return out;
  }

  update(base: number, bars: BridgeBar[]) {
    const prev = this.from && this.cur && this.cur.bars.length === bars.length ? this.levels() : null;
    this.cur = { base, bars };
    const next = this.levels();
    cancelAnimationFrame(this.raf);
    if (!prev || motion.still) { this.from = next; this.render(1, next); return; }
    const t0 = performance.now(), dur = 520;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur), k = ease(t);
      this.render(k, prev.map((v, i) => v + (next[i] - v) * k));
      if (t < 1) this.raf = requestAnimationFrame(tick); else this.from = next;
    };
    this.raf = requestAnimationFrame(tick);
  }

  private render(_k: number, lv: number[]) {
    if (!this.cur || !this.w) return;
    const narrow = this.w < 520;
    const W = this.w, H = narrow ? 250 : 300, m = { t: 30, r: 8, b: 46, l: narrow ? 8 : 12 };
    const bars = this.cur.bars;
    const n = bars.length + 1;                                  // recorded + steps + scenario (scenario is the last bar)
    const lo = Math.min(...lv), hi = Math.max(...lv), span = Math.max(hi - lo, Math.abs(lv[0]) * 0.02, 1);
    // zoomed axis: the totals are drawn from a broken baseline, so small steps stay legible (marked on the chart)
    const floor = lo - span * 0.9;
    const y = scaleLinear().domain([floor, hi + span * 0.35]).range([H - m.b, m.t]);
    const band = (W - m.l - m.r) / n, bw = Math.min(band * 0.62, 92);
    const cx = (i: number) => m.l + band * i + band / 2;
    const end = lv[lv.length - 1];
    const all: BridgeBar[] = [{ key: 'base', label: L('Recorded', 'المسجَّل'), basis: 'total', delta: lv[0] }, ...bars];
    const geo = all.map((b, i) => {
      const isTotal = b.basis === 'total';
      const top = isTotal ? (i === 0 ? lv[0] : end) : Math.max(lv[i - 1], lv[i]);
      const bot = isTotal ? floor : Math.min(lv[i - 1], lv[i]);
      const value = isTotal ? (i === 0 ? lv[0] : end) : lv[i] - lv[i - 1];
      const cls = isTotal ? 'br-total' : `br-step br-${b.basis} ${value < 0 ? 'br-down' : 'br-up'}${Math.abs(value) < 0.5 ? ' br-zero' : ''}`;
      const txt = isTotal ? money(value) : `${value > 0 ? '+' : value < 0 ? '' : '±'}${money(value)}`;
      const basisText = isTotal ? (i === 0 ? L('recorded gross profit', 'إجمالي الربح المسجَّل') : L('scenario gross profit', 'إجمالي ربح السيناريو')) : b.basis === 'assumed' ? L('rests on an assumption', 'يستند إلى افتراض') : b.basis === 'external' ? L('supposed outside change', 'تغيّر خارجي مفترض') : L('decision on recorded volumes', 'قرار على الكميات المسجّلة');
      return { b, isTotal, y: y(top), h: Math.max(1, y(bot) - y(top)), cls, txt, aria: `${b.label}: ${txt}, ${basisText}`, link: i < all.length - 1 ? y(lv[Math.min(i, lv.length - 1)]) : null };
    });
    // axis break on the totals: they start from a cut-off baseline, not from zero
    const yb = y(floor);
    const brkD = (i: number) => `M${cx(i) - bw / 2 - 2},${yb - 3} l${bw / 4},-5 l${bw / 4},6 l${bw / 4},-6 l${bw / 4 + 4},5`;
    const cap = L(`Totals are cut at ${money(floor)}, not zero, so the steps stay legible.`, `الإجماليات مقطوعة عند ${money(floor)} لا عند الصفر، لتبقى الخطوات مقروءة.`);
    // while the bars animate the structure is unchanged: move the existing marks instead of re-parsing the SVG each frame
    const shape = `${W}|${document.documentElement.lang}|${all.map((b) => `${b.key}:${b.basis}:${b.label}`).join(',')}`;
    if (shape === this.shape && this.el.querySelector('svg')) {
      const bars = this.el.querySelectorAll<SVGGElement>('.br-bar'), links = this.el.querySelectorAll<SVGLineElement>('.br-link');
      geo.forEach((g, i) => {
        const el = bars[i], rect = el.querySelector('rect')!, val = el.querySelector('.br-val')!;
        el.setAttribute('class', `br-bar ${g.cls}`); el.setAttribute('aria-label', g.aria);
        rect.setAttribute('y', String(g.y)); rect.setAttribute('height', String(g.h));
        val.setAttribute('y', String(g.y - 8)); val.textContent = g.txt;
        if (g.link !== null) { links[i].setAttribute('y1', String(g.link)); links[i].setAttribute('y2', String(g.link)); }
      });
      const fl = this.el.querySelector('.br-floor')!; fl.setAttribute('y1', String(yb)); fl.setAttribute('y2', String(yb));
      this.el.querySelectorAll('.br-break').forEach((p, j) => p.setAttribute('d', brkD(j === 0 ? 0 : all.length - 1)));
      this.el.querySelector('.br-cap')!.textContent = cap;
      return;
    }
    this.shape = shape;
    const pid = 'br-hatch';
    const items = geo.map((g, i) => `${g.link !== null ? `<line class="br-link" x1="${cx(i) + bw / 2}" x2="${cx(i + 1) - bw / 2}" y1="${g.link}" y2="${g.link}"/>` : ''}
      <g class="br-bar ${g.cls}" tabindex="${i === this.focusIndex ? 0 : -1}" role="img" aria-label="${esc(g.aria)}" data-i="${i}">
        <rect x="${cx(i) - bw / 2}" y="${g.y}" width="${bw}" height="${g.h}" rx="1.5" ${g.b.basis === 'assumed' ? `fill="url(#${pid})"` : ''}/>
        <text class="br-val num" x="${cx(i)}" y="${g.y - 8}" text-anchor="middle">${esc(g.txt)}</text>
        <text class="br-lab" x="${cx(i)}" y="${H - m.b + 18}" text-anchor="middle">${esc(narrow ? g.b.short ?? g.b.label : g.b.label)}</text>
        ${!g.isTotal ? `<text class="br-basis" x="${cx(i)}" y="${H - m.b + 33}" text-anchor="middle">${g.b.basis === 'assumed' ? L('assumed', 'مفترَض') : g.b.basis === 'external' ? L('external', 'خارجي') : L('decision', 'قرار')}</text>` : ''}
      </g>`);
    const brk = [0, all.length - 1].map((i) => `<path class="br-break" d="${brkD(i)}"/>`).join('');
    const svg = `<svg class="bridge-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="${esc(L('Profit bridge from recorded to scenario gross profit. Use the arrow keys to move between bars.', 'جسر الربح من الربح المسجَّل إلى ربح السيناريو. استخدم مفاتيح الأسهم للتنقّل بين الأعمدة.'))}" dir="ltr">
      ${hatch(pid)}
      <line class="br-floor" x1="${m.l}" x2="${W - m.r}" y1="${yb}" y2="${yb}"/>
      ${items.join('')}${brk}
    </svg><p class="br-cap">${esc(cap)}</p>`;
    const had = this.el.contains(document.activeElement);
    this.el.innerHTML = svg;
    if (had) this.el.querySelector<SVGGElement>(`.br-bar[data-i="${this.focusIndex}"]`)?.focus();
  }

  private key(e: KeyboardEvent) {
    const bars = [...this.el.querySelectorAll<SVGGElement>('.br-bar')];
    const i = bars.indexOf(document.activeElement as SVGGElement);
    if (i < 0) return;
    const j = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? Math.min(bars.length - 1, i + 1) : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? Math.max(0, i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? bars.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    bars[i].tabIndex = -1; bars[j].tabIndex = 0; bars[j].focus();
    this.focusIndex = j;
  }
}

/**
 * Assumption load as a split bar. Shares are of Σ|step| (the bridge's total movement), so they add to 100%
 * and read as "how much of the movement rests on what", never as a probability.
 */
export function loadGauge(load: { total: number; decision: number; external: number; assumed: number }) {
  if (!load.total) return `<div class="load-bar load-empty" role="img" aria-label="${esc(L('No movement: the scenario equals the recorded baseline.', 'لا تغيّر: السيناريو يساوي الأساس المسجَّل.'))}"><span></span></div>`;
  const seg = (k: 'decision' | 'external' | 'assumed', name: string) => {
    const s = load[k] / load.total;
    return s > 0 ? `<span class="load-seg load-${k}" style="flex-grow:${s.toFixed(4)}" title="${esc(`${name}: ${pct(s)}`)}"></span>` : '';
  };
  const parts = [[L('Decision', 'قرار'), load.decision], [L('External', 'خارجي'), load.external], [L('Assumed', 'مفترَض'), load.assumed]].filter(([, v]) => (v as number) > 0).map(([n, v]) => `${n} ${pct((v as number) / load.total, 0)}`).join(', ');
  return `<div class="load-bar" role="img" aria-label="${esc(L(`Share of total movement: ${parts}`, `نصيب كل نوع من إجمالي التغيّر: ${parts}`))}" dir="ltr">${seg('decision', L('Decision', 'قرار'))}${seg('external', L('External', 'خارجي'))}${seg('assumed', L('Assumed', 'مفترَض'))}</div>`;
}

/**
 * Scenario profit across one assumption (x), recorded profit as the reference line. `cursor` marks the point the
 * reader is inspecting with the keyboard or pointer; `current` is the lever's value. Not a prediction interval.
 */
export function sensitivityCurve(el: HTMLElement, pts: { value: number; profit: number }[], opts: { base: number; current: number; breakEven: number | null; cursor: number | null; fmt: (v: number) => string; breakLabel?: string }) {
  const W = Math.max(260, el.clientWidth || 300), H = 170, m = { t: 16, r: 14, b: 30, l: 14 };
  const ys = pts.map((p) => p.profit).concat(opts.base);
  const lo = Math.min(...ys), hi = Math.max(...ys), pad = Math.max((hi - lo) * 0.15, Math.abs(opts.base) * 0.002, 1);
  const x0 = pts[0].value, x1 = pts[pts.length - 1].value;
  const x = scaleLinear().domain([x0, x1]).range([m.l, W - m.r]);
  const y = scaleLinear().domain([lo - pad, hi + pad]).range([H - m.b, m.t]);
  const d = line<{ value: number; profit: number }>().x((p) => x(p.value)).y((p) => y(p.profit)).curve(curveMonotoneX)(pts) ?? '';
  const near = (v: number) => pts.reduce((a, p) => (Math.abs(p.value - v) < Math.abs(a.value - v) ? p : a), pts[0]);
  const curP = near(opts.current);
  const be = opts.breakEven !== null && opts.breakEven >= Math.min(x0, x1) && opts.breakEven <= Math.max(x0, x1) ? opts.breakEven : null;
  const ticks = [0, 1 / 3, 2 / 3, 1].map((t) => x0 + (x1 - x0) * t);
  // region above the recorded line, lightly shaded, so "better or worse than recorded" reads at a glance
  const cur = opts.cursor === null ? null : pts[opts.cursor];
  el.innerHTML = `<svg class="sens-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" dir="ltr" aria-hidden="true">
    <rect class="sens-above" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${Math.max(0, y(opts.base) - m.t)}"/>
    <line class="sens-base" x1="${m.l}" x2="${W - m.r}" y1="${y(opts.base)}" y2="${y(opts.base)}"/>
    <text class="sens-lab" x="${W - m.r}" y="${y(opts.base) - 5}" text-anchor="end">${esc(L('recorded', 'المسجَّل'))}</text>
    <path class="sens-line" d="${d}"/>
    ${be !== null ? `<line class="sens-be" x1="${x(be)}" x2="${x(be)}" y1="${m.t}" y2="${H - m.b}"/><text class="sens-lab" x="${x(be)}" y="${m.t + 2}" dx="4">${esc(opts.breakLabel ?? L('break-even', 'التعادل'))}</text>` : ''}
    ${cur ? `<line class="sens-cursor" x1="${x(cur.value)}" x2="${x(cur.value)}" y1="${m.t}" y2="${H - m.b}"/><circle class="sens-probe" cx="${x(cur.value)}" cy="${y(cur.profit)}" r="4"/>` : ''}
    <circle class="sens-now" cx="${x(curP.value)}" cy="${y(curP.profit)}" r="5"/>
    ${ticks.map((t, i) => `<text class="sens-tick num" x="${x(t)}" y="${H - 10}" text-anchor="${i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}">${esc(opts.fmt(t))}</text>`).join('')}
  </svg>`;
  return { x: (v: number) => x(v), width: W, left: m.l, right: W - m.r };
}

/**
 * One-at-a-time sweeps as horizontal bars on a shared profit axis. Each bar spans the profit reached across that
 * assumption's full range; the tick is the current value. Bars are buttons that choose the curve below.
 */
export function tornadoChart(rows: { key: string; name: string; lo: string; hi: string; min: number; max: number; now: number; profitAtLo: number; profitAtHi: number }[], base: number, active: string) {
  if (!rows.length) return '';
  const lo = Math.min(base, ...rows.map((r) => r.min)), hi = Math.max(base, ...rows.map((r) => r.max));
  const span = hi - lo || 1, at = (v: number) => (((v - lo) / span) * 100).toFixed(2);
  return `<div class="tornado" role="radiogroup" aria-label="${esc(L('Assumption to explore', 'الافتراض المراد استكشافه'))}" dir="ltr">
    ${rows.map((r) => `<button type="button" class="tn-row" role="radio" aria-checked="${r.key === active}" tabindex="${r.key === active ? 0 : -1}" data-key="${r.key}"
        aria-label="${esc(`${r.name}: ${money(r.min)} – ${money(r.max)}`)}">
      <span class="tn-name">${esc(r.name)}</span>
      <span class="tn-track"><span class="tn-ref" style="left:${at(base)}%" title="${esc(L('recorded', 'المسجَّل'))}"></span><span class="tn-bar" style="left:${at(r.min)}%;width:${(((r.max - r.min) / span) * 100).toFixed(2)}%"></span><span class="tn-now" style="left:${at(r.now)}%"></span></span>
      <span class="tn-range num">${esc(money(r.min))} – ${esc(money(r.max))}</span>
    </button>`).join('')}
  </div>`;
}
