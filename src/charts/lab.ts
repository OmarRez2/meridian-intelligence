import { scaleLinear, scaleLog } from 'd3-scale';
import { area, curveMonotoneX } from 'd3-shape';
import { L, int, pct, monthShort } from '../i18n';
import { esc } from '../lib/format';
import { tip } from './kit';
import type { AbcClass } from '../data/lab';

/**
 * Analytics Lab instruments. Hand-built SVG in the Meridian idiom: hairline grids, glowing marks, colour by
 * role (glacier = sales/demand, ember = risk only, brass = the instrument). Charts read left to right in both
 * languages (rtl.css). Every chart is one tab stop; arrow keys move between marks and update a live readout.
 */
const NS = 'http://www.w3.org/2000/svg';

/** Roving focus over `selector` inside `svg`, in DOM order; calls `onFocus(index)` on every move. */
function rove(svg: SVGSVGElement, selector: string, onFocus: (el: SVGElement) => void) {
  svg.addEventListener('keydown', (e) => {
    const els = [...svg.querySelectorAll<SVGElement>(selector)];
    const i = els.indexOf(document.activeElement as SVGElement);
    if (i < 0) return;
    const k = e.key;
    const next = k === 'ArrowRight' || k === 'ArrowDown' ? i + 1 : k === 'ArrowLeft' || k === 'ArrowUp' ? i - 1 : k === 'Home' ? 0 : k === 'End' ? els.length - 1 : k === 'PageDown' ? i + 10 : k === 'PageUp' ? i - 10 : null;
    if (next === null) return;
    e.preventDefault();
    const to = els[Math.max(0, Math.min(els.length - 1, next))];
    els[i].setAttribute('tabindex', '-1');
    to.setAttribute('tabindex', '0');
    to.focus();
  });
  svg.addEventListener('focusin', (e) => { const t = e.target as SVGElement; if (t.matches(selector)) onFocus(t); });
}

/* ---------------------------------------------------------------- profit map */
export type MapPoint = {
  id: number; label: string; family: string; cls: AbcClass; value: number; margin: number | null;
  highMargin: boolean; negative: boolean; lossLines: number; detail: string;
};
export type MapFilter = { cls?: AbcClass; high?: boolean } | null;

/**
 * Items as stars: x = the ABC basis value (log scale, so the long tail stays legible), y = recorded margin.
 * The A|B and B|C cut-offs fall at a single value of the basis, so they are drawn as vertical "horizons";
 * the median margin is a horizontal one. Items with no positive value (profit basis) sit in a gutter at left.
 */
export class ProfitMap {
  private svg: SVGSVGElement;
  private pts: MapPoint[] = [];
  private horizons: { ab: number | null; bc: number | null; cut: number; basis: string } = { ab: null, bc: null, cut: 0, basis: '' };
  private filter: MapFilter = null;
  private ro: ResizeObserver;
  constructor(private el: HTMLElement, private onFocus: (p: MapPoint | null) => void) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('lab-map');
    this.svg.setAttribute('role', 'group');
    el.appendChild(this.svg);
    rove(this.svg, 'circle.star', (c) => this.focusPoint(c as SVGCircleElement));
    this.svg.addEventListener('focusout', () => tip(null));
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(el);
  }
  update(pts: MapPoint[], horizons: ProfitMap['horizons']) { this.pts = pts; this.horizons = horizons; this.draw(); }
  setFilter(f: MapFilter) { this.filter = f; this.applyFilter(); }
  private matches(p: MapPoint) { const f = this.filter; return !f || ((f.cls === undefined || p.cls === f.cls) && (f.high === undefined || p.highMargin === f.high)); }
  private applyFilter() {
    this.svg.querySelectorAll<SVGCircleElement>('circle.star').forEach((c) => c.classList.toggle('dim', !this.matches(this.pts[Number(c.dataset.i)])));
  }
  private focusPoint(c: SVGCircleElement) {
    const p = this.pts[Number(c.dataset.i)];
    const b = c.getBoundingClientRect();
    tip(`<div class="tt">${esc(p.label)}</div><div class="tr">${esc(p.detail)}</div>`, b.left, b.top);
    this.onFocus(p);
  }
  private draw() {
    const r = this.el.getBoundingClientRect();
    const w = Math.max(300, r.width), h = Math.max(300, Math.min(560, w * 0.62));
    const narrow = w < 560;
    const m = { t: 34, r: 18, b: 46, l: narrow ? 52 : 64 };
    const gutter = 22; // for items with no positive value
    const pos = this.pts.filter((p) => p.value > 0);
    const lo = Math.max(1, Math.min(...pos.map((p) => p.value), Infinity) * 0.7), hi = Math.max(lo * 10, ...pos.map((p) => p.value)) * 1.25;
    const x = scaleLog().domain([lo, hi]).range([m.l + gutter, w - m.r]).clamp(true);
    const margins = this.pts.map((p) => p.margin).filter((v): v is number => v !== null);
    const y = scaleLinear().domain([Math.min(-0.1, ...margins), Math.max(0.8, ...margins)]).range([h - m.b, m.t]).nice();
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.svg.style.height = `${h}px`;
    const { ab, bc, cut, basis } = this.horizons;
    const counts = { A: 0, B: 0, C: 0 } as Record<AbcClass, number>;
    this.pts.forEach((p) => counts[p.cls]++);
    this.svg.setAttribute('aria-label', L(
      `Profit map of ${this.pts.length} items: ${basis} on a logarithmic horizontal axis against recorded margin. Class A ${counts.A} items, B ${counts.B}, C ${counts.C}. Use the arrow keys to move between items, largest first.`,
      `خريطة الربحية لـ ${int(this.pts.length)} صنفًا: ${basis} على محور أفقي لوغاريتمي مقابل الهامش المسجَّل. الفئة A ${int(counts.A)} صنفًا، وB ${int(counts.B)}، وC ${int(counts.C)}. استخدم مفاتيح الأسهم للتنقل بين الأصناف من الأكبر.`));
    const X0 = m.l + gutter, X1 = w - m.r, Y0 = m.t, Y1 = h - m.b;
    let out = '<defs><radialGradient id="lab-glow"><stop offset="0" stop-color="currentColor" stop-opacity=".32"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs>';
    // class bands, right (A) to left (C)
    const xa = ab !== null ? x(ab) : X0, xb = bc !== null ? x(bc) : X0;
    out += `<rect class="band band-a" x="${xa}" y="${Y0}" width="${X1 - xa}" height="${Y1 - Y0}"/>`;
    out += `<rect class="band band-b" x="${xb}" y="${Y0}" width="${xa - xb}" height="${Y1 - Y0}"/>`;
    // grid
    for (const t of y.ticks(5)) out += `<line class="grid${t === 0 ? ' zero' : ''}" x1="${m.l}" x2="${X1}" y1="${y(t)}" y2="${y(t)}"/><text class="ax" x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${Math.round(t * 100)}%</text>`;
    const decades: number[] = [];
    for (let d = Math.pow(10, Math.ceil(Math.log10(lo))); d <= hi; d *= 10) decades.push(d);
    const short = (v: number) => (v >= 1e6 ? `$${v / 1e6}M` : v >= 1e3 ? `$${v / 1e3}K` : `$${v}`);
    for (const d of decades) out += `<line class="grid v" x1="${x(d)}" x2="${x(d)}" y1="${Y0}" y2="${Y1}"/><text class="ax" x="${x(d)}" y="${Y1 + 18}" text-anchor="middle">${short(d)}</text>`;
    out += `<text class="ax ax-title" x="${X1}" y="${h - 6}" text-anchor="end">${esc(basis)} ${L('(log scale)', '(مقياس لوغاريتمي)')}</text>`;
    out += `<text class="ax ax-title" x="${m.l}" y="${Y0 - 20}" text-anchor="start">${L('Recorded margin', 'الهامش المسجَّل')}</text>`;
    // horizons
    if (ab !== null) out += `<line class="horizon" x1="${xa}" x2="${xa}" y1="${Y0 - 6}" y2="${Y1}"/><text class="hz-label" x="${(xa + X1) / 2}" y="${Y0 + 14}" text-anchor="middle">A</text>`;
    if (bc !== null) out += `<line class="horizon" x1="${xb}" x2="${xb}" y1="${Y0 - 6}" y2="${Y1}"/><text class="hz-label" x="${(xb + xa) / 2}" y="${Y0 + 14}" text-anchor="middle">B</text>`;
    out += `<text class="hz-label" x="${(X0 + xb) / 2}" y="${Y0 + 14}" text-anchor="middle">C</text>`;
    out += `<line class="horizon cut" x1="${m.l}" x2="${X1}" y1="${y(cut)}" y2="${y(cut)}"/><text class="ax cut-label" x="${X1 - 4}" y="${y(cut) - 6}" text-anchor="end">${L('Median item margin', 'وسيط هامش الأصناف')} ${pct(cut)}</text>`;
    if (this.pts.some((p) => p.value <= 0)) out += `<text class="ax gutter-label" x="${m.l + gutter / 2}" y="${Y1 - 4}" text-anchor="middle" transform="rotate(-90 ${m.l + gutter / 2} ${Y1 - 4})">${L('no profit', 'بلا ربح')}</text>`;
    // stars, largest first, so the arrow keys travel from the brightest down the tail
    const order = this.pts.map((_, i) => i).sort((a, b) => this.pts[b].value - this.pts[a].value);
    order.forEach((i, k) => {
      const p = this.pts[i];
      const cx = p.value > 0 ? x(p.value) : m.l + gutter / 2;
      const cy = y(p.margin ?? 0);
      const rad = p.cls === 'A' ? 4.6 : p.cls === 'B' ? 3.6 : 2.8;
      const cls = `star cls-${p.cls}${p.lossLines > 0 ? ' loss' : ''}${p.negative ? ' neg' : ''}`;
      if (p.cls === 'A') out += `<circle class="halo" cx="${cx}" cy="${cy}" r="${rad * 2.2}" fill="url(#lab-glow)"/>`;
      out += `<circle class="${cls}" cx="${cx}" cy="${cy}" r="${rad}" data-i="${i}" style="--k:${Math.min(k, 120)}" tabindex="${k === 0 ? 0 : -1}" role="img" aria-label="${esc(p.label)}: ${esc(p.detail)}"/>`;
    });
    this.svg.innerHTML = out;
    this.svg.querySelectorAll<SVGCircleElement>('circle.star').forEach((c) => {
      c.addEventListener('pointerenter', (e) => { const p = this.pts[Number(c.dataset.i)]; tip(`<div class="tt">${esc(p.label)}</div><div class="tr">${esc(p.detail)}</div>`, e.clientX, e.clientY); this.onFocus(p); });
      c.addEventListener('pointerleave', () => tip(null));
    });
    this.applyFilter();
  }
  destroy() { this.ro.disconnect(); tip(null); }
}

/* ---------------------------------------------------------------- Pareto curve */
/** Cumulative share of the basis value against the share of items, with the class cut-offs and the 20% mark. */
export function paretoCurve(el: HTMLElement, cum: number[], t: { a: number; b: number }, top20: number) {
  const w = Math.round(Math.min(420, Math.max(240, el.clientWidth || 300))), h = Math.round(w * 0.6), m = { t: 14, r: 12, b: 30, l: 38 };
  const n = cum.length;
  const x = scaleLinear().domain([0, 1]).range([m.l, w - m.r]);
  const y = scaleLinear().domain([0, 1]).range([h - m.b, m.t]);
  const pts = [[0, 0], ...cum.map((c, i) => [(i + 1) / n, c])];
  const d = pts.map(([a, b], i) => `${i ? 'L' : 'M'}${x(a).toFixed(1)} ${y(b).toFixed(1)}`).join('');
  let out = `<line class="grid" x1="${x(0)}" y1="${y(0)}" x2="${x(1)}" y2="${y(1)}" stroke-dasharray="2 4"/>`;
  for (const v of [0, 0.5, 1]) out += `<text class="ax" x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${v * 100}%</text><text class="ax" x="${x(v)}" y="${h - m.b + 16}" text-anchor="middle">${v * 100}%</text>`;
  for (const v of [t.a, t.b]) out += `<line class="horizon" x1="${m.l}" x2="${x(1)}" y1="${y(v)}" y2="${y(v)}"/>`;
  out += `<path class="pareto" d="${d}"/>`;
  out += `<line class="horizon cut" x1="${x(0.2)}" x2="${x(0.2)}" y1="${y(0)}" y2="${y(top20)}"/><circle class="pareto-dot" cx="${x(0.2)}" cy="${y(top20)}" r="4"/>`;
  out += `<text class="ax ax-title" x="${w - m.r}" y="${h - 2}" text-anchor="end">${L('Share of items', 'نسبة الأصناف')}</text>`;
  el.innerHTML = `<svg class="lab-pareto" viewBox="0 0 ${w} ${h}" role="img" aria-label="${L(`Pareto curve. The top 20% of items hold ${pct(top20)} of the value; the class cut-offs are at ${pct(t.a, 0)} and ${pct(t.b, 0)}.`, `منحنى باريتو. أعلى 20٪ من الأصناف تمثّل ${pct(top20)} من القيمة؛ وحدود الفئات عند ${pct(t.a, 0)} و${pct(t.b, 0)}.`)}">${out}</svg>`;
}

/* ---------------------------------------------------------------- drip chart */
export type DripMonth = { y: number; m: number; ordered: number; unmet: number; rate: number };

/**
 * Two panels on one time axis. Above: units ordered per month (context, its own scale). Below: the share of
 * ordered units never picked, hanging from the baseline like drips. The final `tail` months are shaded: if the
 * shortfall were only orders still open at the end of the extract, the drips would gather there.
 */
export class DripChart {
  private svg: SVGSVGElement;
  private rows: DripMonth[] = [];
  private tail = 3; private avg = 0;
  private ro: ResizeObserver;
  constructor(private el: HTMLElement, private onFocus: (i: number | null) => void) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('lab-drip');
    this.svg.setAttribute('role', 'group');
    el.appendChild(this.svg);
    rove(this.svg, 'rect.drip-hit', (r) => this.focusMonth(Number(r.dataset.i), r));
    this.svg.addEventListener('focusout', () => tip(null));
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(el);
  }
  update(rows: DripMonth[], tail: number, avg: number) { this.rows = rows; this.tail = tail; this.avg = avg; this.draw(); }
  private text(i: number) {
    const r = this.rows[i];
    return { head: `${monthShort(r.m)} ${r.y}`, body: L(`${pct(r.rate)} never picked · ${int(r.unmet)} of ${int(r.ordered)} units`, `${pct(r.rate)} لم تُجهَّز · ${int(r.unmet)} من ${int(r.ordered)} وحدة`) };
  }
  private focusMonth(i: number, el: Element) {
    const t = this.text(i), b = el.getBoundingClientRect();
    tip(`<div class="tt">${t.head}</div><div class="tr">${t.body}</div>`, b.left + b.width / 2, b.top);
    this.onFocus(i);
  }
  private draw() {
    const r = this.el.getBoundingClientRect();
    const w = Math.max(300, r.width), narrow = w < 560;
    const h = narrow ? 330 : 380;
    const m = { t: 18, r: 14, b: 30, l: narrow ? 44 : 56 };
    const n = this.rows.length;
    if (!n) { this.svg.innerHTML = ''; return; }
    const base = m.t + (h - m.t - m.b) * 0.36; // baseline between the two panels
    const x = scaleLinear().domain([0, n]).range([m.l, w - m.r]);
    const bw = (x(1) - x(0)) * 0.62;
    const top = scaleLinear().domain([0, Math.max(...this.rows.map((d) => d.ordered)) * 1.1]).range([base - 6, m.t]);
    const maxRate = Math.max(0.05, ...this.rows.map((d) => d.rate)) * 1.12;
    const drop = scaleLinear().domain([0, maxRate]).range([base + 6, h - m.b]).nice();
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.svg.style.height = `${h}px`;
    const worst = this.rows.reduce((a, d, i) => (d.rate > this.rows[a].rate ? i : a), 0);
    this.svg.setAttribute('aria-label', L(
      `Monthly fulfilment leakage, ${n} months. Upper panel: units ordered. Lower panel: share of ordered units never picked, average ${pct(this.avg)}, highest ${pct(this.rows[worst].rate)} in ${monthShort(this.rows[worst].m)} ${this.rows[worst].y}. The last ${this.tail} months are shaded. Use the arrow keys to read each month.`,
      `تسرّب التنفيذ شهريًا على مدى ${int(n)} شهرًا. اللوحة العليا: الوحدات المطلوبة. اللوحة السفلى: نسبة الوحدات المطلوبة التي لم تُجهَّز، بمتوسط ${pct(this.avg)}، وأعلاها ${pct(this.rows[worst].rate)} في ${monthShort(this.rows[worst].m)} ${this.rows[worst].y}. الأشهر الثلاثة الأخيرة مظلَّلة. استخدم مفاتيح الأسهم لقراءة كل شهر.`));
    const tx0 = x(n - this.tail);
    let out = `<rect class="tail" x="${tx0}" y="${m.t}" width="${x(n) - tx0}" height="${h - m.b - m.t}"/>`;
    out += `<text class="ax tail-label" x="${(tx0 + x(n)) / 2}" y="${h - m.b - 6}" text-anchor="middle">${L('end of extract', 'نهاية البيانات')}</text>`;
    // year separators and labels
    this.rows.forEach((d, i) => {
      if (d.m === 0 || i === 0) out += `<line class="grid v" x1="${x(i)}" x2="${x(i)}" y1="${m.t}" y2="${h - m.b}"/><text class="ax yr-label" x="${x(i) + 4}" y="${h - m.b + 18}">${d.y}</text>`;
    });
    // upper panel: ordered units
    const ar = area<DripMonth>().x((_, i) => x(i + 0.5)).y0(base - 6).y1((d) => top(d.ordered)).curve(curveMonotoneX);
    out += `<path class="ordered" d="${ar(this.rows)}"/>`;
    out += `<text class="ax ax-title" x="${m.l}" y="${m.t + 10}">${L('Units ordered per month', 'الوحدات المطلوبة شهريًا')}</text>`;
    out += `<line class="baseline" x1="${m.l}" x2="${w - m.r}" y1="${base}" y2="${base}"/>`;
    // lower panel: drips
    for (const t of drop.ticks(3)) if (t > 0) out += `<line class="grid" x1="${m.l}" x2="${w - m.r}" y1="${drop(t)}" y2="${drop(t)}"/><text class="ax" x="${m.l - 8}" y="${drop(t) + 4}" text-anchor="end">${Math.round(t * 1000) / 10}%</text>`;
    out += `<line class="avg" x1="${m.l}" x2="${w - m.r}" y1="${drop(this.avg)}" y2="${drop(this.avg)}"/><text class="ax avg-label" x="${m.l + 6}" y="${drop(this.avg) + 14}" text-anchor="start">${L('average', 'المتوسط')} ${pct(this.avg)}</text>`;
    this.rows.forEach((d, i) => {
      const cx = x(i + 0.5), y1 = drop(d.rate);
      out += `<path class="drip${i >= n - this.tail ? ' in-tail' : ''}" style="--k:${i}" d="M${cx - bw / 2} ${base + 6} L${cx + bw / 2} ${base + 6} L${cx + bw / 2} ${Math.max(base + 6, y1 - bw / 2)} Q${cx + bw / 2} ${y1} ${cx} ${y1} Q${cx - bw / 2} ${y1} ${cx - bw / 2} ${Math.max(base + 6, y1 - bw / 2)} Z"/>`;
      const t = this.text(i);
      out += `<rect class="drip-hit" data-i="${i}" x="${x(i)}" y="${m.t}" width="${x(1) - x(0)}" height="${h - m.b - m.t}" tabindex="${i === 0 ? 0 : -1}" role="img" aria-label="${t.head}: ${t.body}"/>`;
    });
    this.svg.innerHTML = out;
    this.svg.querySelectorAll<SVGRectElement>('rect.drip-hit').forEach((el) => {
      el.addEventListener('pointerenter', () => this.focusMonth(Number(el.dataset.i), el));
      el.addEventListener('pointerleave', () => { tip(null); this.onFocus(null); });
    });
  }
  destroy() { this.ro.disconnect(); tip(null); }
}

/* ---------------------------------------------------------------- loss pulse */
export type PulseMonth = { y: number; m: number; lines: number; loss: number };
/** One cell per month, ember intensity = loss-making lines: a persistent pattern reads as a steady band. */
export class PulseStrip {
  private svg: SVGSVGElement;
  private rows: PulseMonth[] = [];
  private ro: ResizeObserver;
  constructor(private el: HTMLElement, private fmtLoss: (v: number) => string) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('lab-pulse');
    this.svg.setAttribute('role', 'group');
    el.appendChild(this.svg);
    rove(this.svg, 'rect.cell', (c) => { const b = c.getBoundingClientRect(); const t = this.text(Number(c.dataset.i)); tip(`<div class="tt">${t.head}</div><div class="tr">${t.body}</div>`, b.left + b.width / 2, b.top); });
    this.svg.addEventListener('focusout', () => tip(null));
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(el);
  }
  update(rows: PulseMonth[]) { this.rows = rows; this.draw(); }
  private text(i: number) {
    const r = this.rows[i];
    return { head: `${monthShort(r.m)} ${r.y}`, body: L(`${int(r.lines)} loss-making lines · ${this.fmtLoss(r.loss)} recorded loss`, `${int(r.lines)} سطرًا خاسرًا · خسارة مسجّلة ${this.fmtLoss(r.loss)}`) };
  }
  private draw() {
    const n = this.rows.length;
    if (!n) { this.svg.innerHTML = ''; return; }
    const w = Math.max(300, this.el.getBoundingClientRect().width), h = 74, m = { t: 6, r: 6, b: 22, l: 6 };
    const cw = (w - m.l - m.r) / n, top = Math.max(1, ...this.rows.map((r) => r.lines));
    const active = this.rows.filter((r) => r.lines > 0).length;
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.svg.style.height = `${h}px`;
    this.svg.setAttribute('aria-label', L(`Loss-making lines per month: present in ${active} of ${n} months. Use the arrow keys to read each month.`, `الأسطر الخاسرة شهريًا: موجودة في ${int(active)} من ${int(n)} شهرًا. استخدم مفاتيح الأسهم لقراءة كل شهر.`));
    let out = '';
    this.rows.forEach((r, i) => {
      const x = m.l + i * cw, o = r.lines ? 0.18 + 0.82 * (r.lines / top) : 0.04;
      const t = this.text(i);
      out += `<rect class="cell${r.lines ? '' : ' none'}" data-i="${i}" x="${x + 1}" y="${m.t}" width="${Math.max(1, cw - 2)}" height="${h - m.t - m.b}" rx="2" style="--o:${o.toFixed(3)};--k:${i}" tabindex="${i === 0 ? 0 : -1}" role="img" aria-label="${t.head}: ${t.body}"/>`;
      if (r.m === 0 || i === 0) out += `<text class="ax yr-label" x="${x + 2}" y="${h - 6}">${r.y}</text>`;
    });
    this.svg.innerHTML = out;
    this.svg.querySelectorAll<SVGRectElement>('rect.cell').forEach((c) => {
      c.addEventListener('pointerenter', (e) => { const t = this.text(Number(c.dataset.i)); tip(`<div class="tt">${t.head}</div><div class="tr">${t.body}</div>`, e.clientX, e.clientY); });
      c.addEventListener('pointerleave', () => tip(null));
    });
  }
  destroy() { this.ro.disconnect(); tip(null); }
}

/* ---------------------------------------------------------------- supplier ring */
export type RingSlice = { label: string; share: number; pos: number; group: string };
/**
 * Spend share as arcs on one ring, drawn at their true size (a 0.01% supplier is a hairline, as it should be).
 * The centre holds the concentration index on its own 0-1 dial, with the conventional threshold marked.
 */
export function supplierRing(el: HTMLElement, slices: RingSlice[], hhiValue: number, threshold: number) {
  const S = 300, c = S / 2, R = 128, r = 104;
  const pt = (a: number, rad: number) => [c + rad * Math.sin(a), c - rad * Math.cos(a)];
  const arcPath = (a0: number, a1: number, ro: number, ri: number) => {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = pt(a0, ro), [x1, y1] = pt(a1, ro), [x2, y2] = pt(a1, ri), [x3, y3] = pt(a0, ri);
    return `M${x0} ${y0} A${ro} ${ro} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${ri} ${ri} 0 ${large} 0 ${x3} ${y3} Z`;
  };
  let a = 0, out = `<circle class="ring-track" cx="${c}" cy="${c}" r="${(R + r) / 2}" stroke-width="${R - r}"/>`;
  slices.forEach((s, i) => {
    const span = s.share * Math.PI * 2;
    if (span > 0) out += `<path class="ring-arc${i < 2 ? ' major' : ''}" style="--k:${i}" d="${arcPath(a + 0.004, Math.max(a + 0.006, a + span - 0.004), R, r)}"/>`;
    if (i < 2 && span > 0.3) {
      const mid = a + span / 2, [lx, ly] = pt(mid, R + 16);
      out += `<text class="ring-label" x="${lx}" y="${ly}" text-anchor="${Math.sin(mid) >= 0 ? 'start' : 'end'}">${esc(s.label)} · ${pct(s.share, 0)}</text>`;
    }
    a += span;
  });
  // concentration dial inside: 0 at the lower left, 1 at the lower right
  const d0 = -Math.PI * 0.75, d1 = Math.PI * 0.75, dr = 70, at = (v: number) => d0 + (d1 - d0) * Math.min(1, Math.max(0, v));
  const dialArc = (v0: number, v1: number) => { const [x0, y0] = pt(at(v0), dr), [x1, y1] = pt(at(v1), dr); return `M${x0} ${y0} A${dr} ${dr} 0 ${at(v1) - at(v0) > Math.PI ? 1 : 0} 1 ${x1} ${y1}`; };
  out += `<path class="dial-track" d="${dialArc(0, 1)}"/><path class="dial-value" d="${dialArc(0, Math.max(0.001, hhiValue))}"/>`;
  const [tx0, ty0] = pt(at(threshold), dr - 8), [tx1, ty1] = pt(at(threshold), dr + 8);
  out += `<line class="dial-threshold" x1="${tx0}" y1="${ty0}" x2="${tx1}" y2="${ty1}"/>`;
  out += `<text class="dial-v" x="${c}" y="${c + 8}" text-anchor="middle">${hhiValue.toFixed(2)}</text><text class="dial-l" x="${c}" y="${c + 30}" text-anchor="middle">${L('concentration (HHI)', 'التركّز (HHI)')}</text>`;
  const top = slices.slice(0, 2);
  el.innerHTML = `<svg class="lab-ring" viewBox="-80 -10 ${S + 160} ${S + 20}" role="img" aria-label="${esc(L(
    `Purchase spend by supplier. ${top.map((s) => `${s.label} ${pct(s.share)}`).join(', ')}; ${slices.length - 2} others share the rest. Concentration index ${hhiValue.toFixed(2)}, a descriptive measure; reference mark at ${threshold}, not a risk threshold.`,
    `الإنفاق على المشتريات حسب المورد. ${top.map((s) => `${s.label} ${pct(s.share)}`).join('، ')}؛ ويتقاسم ${int(slices.length - 2)} موردين الباقي. مؤشر التركّز ${hhiValue.toFixed(2)}، وهو مقياس وصفي؛ والعلامة المرجعية عند ${threshold} ليست حدًّا للمخاطر.`))}">${out}</svg>`;
}

/* ---------------------------------------------------------------- cover histogram */
export type CoverBand = { from: number; to: number; items: number; value: number; excess: number };
/**
 * Stock value at cost by months of cover (uneven bands, widening to the right). Each bar splits into the value
 * a cover policy would keep and the value beyond it; the policy itself is a brass line placed inside its band.
 */
export class CoverHistogram {
  private svg: SVGSVGElement;
  private bands: CoverBand[] = []; private months = 12;
  private ro: ResizeObserver;
  constructor(private el: HTMLElement, private fmtMoney: (v: number) => string) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('lab-hist');
    this.svg.setAttribute('role', 'group');
    el.appendChild(this.svg);
    rove(this.svg, 'rect.hist-hit', (c) => { const b = c.getBoundingClientRect(); const t = this.text(Number(c.dataset.i)); tip(`<div class="tt">${t.head}</div><div class="tr">${t.body}</div>`, b.left + b.width / 2, b.top + 40); });
    this.svg.addEventListener('focusout', () => tip(null));
    // the width comes from the observer, so a slider drag never forces a layout of the whole page
    this.ro = new ResizeObserver((e) => { const w = Math.round(e[0].contentRect.width); if (w !== this.w) { this.w = w; this.draw(); } });
    this.ro.observe(el);
  }
  private w = 0;
  update(bands: CoverBand[], months: number) { this.bands = bands; this.months = months; this.draw(); }
  private name(b: CoverBand) { return Number.isFinite(b.to) ? `${b.from}–${b.to}` : `${b.from}+`; }
  private text(i: number) {
    const b = this.bands[i];
    return { head: L(`${this.name(b)} months of cover`, `تغطية ${this.name(b)} شهرًا`), body: L(`${int(b.items)} items · ${this.fmtMoney(b.value)} at cost · ${this.fmtMoney(b.excess)} beyond ${this.months} months`, `${int(b.items)} صنفًا · ${this.fmtMoney(b.value)} بالتكلفة · ${this.fmtMoney(b.excess)} فوق ${int(this.months)} شهرًا`) };
  }
  private draw() {
    const n = this.bands.length;
    if (!n) { this.svg.innerHTML = ''; return; }
    if (!this.w) this.w = Math.round(this.el.getBoundingClientRect().width);
    const w = Math.max(300, this.w), narrow = w < 560;
    const h = narrow ? 300 : 340, m = { t: 34, r: 10, b: 46, l: narrow ? 44 : 54 };
    const bw = (w - m.l - m.r) / n;
    const y = scaleLinear().domain([0, Math.max(1, ...this.bands.map((b) => b.value)) * 1.08]).range([h - m.b, m.t]).nice();
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.svg.style.height = `${h}px`;
    const total = this.bands.reduce((s, b) => s + b.value, 0), ex = this.bands.reduce((s, b) => s + b.excess, 0);
    this.svg.setAttribute('aria-label', L(`Stock value at cost by months of cover, ${n} bands. With a ${this.months}-month cover policy, ${this.fmtMoney(ex)} of ${this.fmtMoney(total)} sits beyond it. Use the arrow keys to read each band.`, `قيمة المخزون بالتكلفة حسب أشهر التغطية، ${int(n)} فئات. مع سياسة تغطية ${int(this.months)} شهرًا، تقع ${this.fmtMoney(ex)} من ${this.fmtMoney(total)} خارجها. استخدم مفاتيح الأسهم لقراءة كل فئة.`));
    let out = '';
    const axMoney = (v: number) => (v >= 1e6 ? `${Math.round(v / 1e6)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : `${v}`);
    for (const t of y.ticks(4)) out += `<line class="grid" x1="${m.l}" x2="${w - m.r}" y1="${y(t)}" y2="${y(t)}"/><text class="ax" x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${axMoney(t)}</text>`;
    this.bands.forEach((b, i) => {
      const x = m.l + i * bw + bw * 0.14, wd = bw * 0.72;
      const keep = b.value - b.excess;
      out += `<rect class="bar-keep" x="${x}" y="${y(keep)}" width="${wd}" height="${Math.max(0, y(0) - y(keep))}"/>`;
      if (b.excess > 0) out += `<rect class="bar-excess" x="${x}" y="${y(b.value)}" width="${wd}" height="${Math.max(0, y(keep) - y(b.value))}"/>`;
      if (b.items) out += `<text class="ax hist-n" x="${x + wd / 2}" y="${y(b.value) - 6}" text-anchor="middle">${int(b.items)}</text>`;
      out += narrow
        ? `<text class="ax" x="${m.l + i * bw}" y="${h - m.b + 16}" text-anchor="middle">${b.from}</text>`
        : `<text class="ax" x="${x + wd / 2}" y="${h - m.b + 16}" text-anchor="middle">${this.name(b)}</text>`;
      const t = this.text(i);
      out += `<rect class="hist-hit" data-i="${i}" x="${m.l + i * bw}" y="${m.t}" width="${bw}" height="${h - m.b - m.t}" tabindex="${i === 0 ? 0 : -1}" role="img" aria-label="${t.head}: ${t.body}"/>`;
    });
    // policy line: log-interpolated inside its band
    const k = this.bands.findIndex((b) => this.months >= b.from && this.months < b.to);
    if (k >= 0) {
      const b = this.bands[k], lo = Math.log(Math.max(b.from, 0.5)), hi = Math.log(Number.isFinite(b.to) ? b.to : b.from * 2);
      const f = Math.min(1, Math.max(0, (Math.log(Math.max(this.months, 0.5)) - lo) / (hi - lo)));
      const px = m.l + (k + f) * bw;
      out += `<line class="policy" x1="${px}" x2="${px}" y1="${m.t - 12}" y2="${h - m.b}"/><text class="ax policy-label" x="${px}" y="${m.t - 18}" text-anchor="middle">${L(`policy ${this.months} mo`, `السياسة ${int(this.months)} شهرًا`)}</text>`;
    }
    out += `<text class="ax ax-title" x="${w - m.r}" y="${h - 6}" text-anchor="end">${L('Months of cover (on hand ÷ average monthly use)', 'أشهر التغطية (الرصيد ÷ متوسط الاستخدام الشهري)')}</text>`;
    this.svg.innerHTML = out;
    this.svg.querySelectorAll<SVGRectElement>('rect.hist-hit').forEach((c) => {
      c.addEventListener('pointerenter', (e) => { const t = this.text(Number(c.dataset.i)); tip(`<div class="tt">${t.head}</div><div class="tr">${t.body}</div>`, e.clientX, e.clientY); });
      c.addEventListener('pointerleave', () => tip(null));
    });
  }
  destroy() { this.ro.disconnect(); tip(null); }
}

/* ---------------------------------------------------------------- backtest chart */
export type BacktestPoint = { t: number; origin: number; forecast: number; actual: number; error: number };
export type BacktestData = { months: { y: number; m: number }[]; actual: number[]; warmup: number; points: BacktestPoint[]; model: string; h: number; fmt: (v: number) => string };

/**
 * Monthly revenue (glacier line) with one model's past forecasts (brass marks) for every scored month, and a
 * hairline from each forecast to what happened. The warm-up months only feed the models and are shaded.
 * Nothing is drawn beyond the last month in the data: this is a backtest, not a forecast.
 */
export class BacktestChart {
  private svg: SVGSVGElement;
  private d: BacktestData | null = null;
  private ro: ResizeObserver;
  private w = 0;
  /** `compact`: a shorter chart for a presentation slide */
  constructor(private el: HTMLElement, private compact = false) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('lab-backtest');
    this.svg.setAttribute('role', 'group');
    el.appendChild(this.svg);
    rove(this.svg, 'rect.bt-hit', (r) => this.show(Number(r.dataset.k), r));
    this.svg.addEventListener('focusout', () => tip(null));
    this.ro = new ResizeObserver((e) => { const w = Math.round(e[0].contentRect.width); if (w !== this.w) { this.w = w; this.draw(); } });
    this.ro.observe(el);
  }
  update(d: BacktestData) { this.d = d; this.draw(); }
  private label(i: number) { const m = this.d!.months[i]; return `${monthShort(m.m)} ${m.y}`; }
  private text(k: number) {
    const d = this.d!, p = d.points[k], f = d.fmt, sign = p.error >= 0 ? '+' : '−';
    return {
      head: this.label(p.t),
      body: L(`Actual ${f(p.actual)} · ${d.model} forecast ${f(p.forecast)}, made with data to ${this.label(p.origin - 1)} · off by ${sign}${pct(Math.abs(p.error) / p.actual)}`,
        `الفعلي ${f(p.actual)} · توقّع ${d.model} ${f(p.forecast)}، ببيانات حتى ${this.label(p.origin - 1)} · بفارق ${sign}${pct(Math.abs(p.error) / p.actual)}`),
    };
  }
  private show(k: number, el: Element) {
    const t = this.text(k), b = el.getBoundingClientRect();
    tip(`<div class="tt">${t.head}</div><div class="tr">${t.body}</div>`, b.left + b.width / 2, b.top + 30);
  }
  private draw() {
    const d = this.d;
    if (!d || !d.actual.length) { this.svg.innerHTML = ''; return; }
    if (!this.w) this.w = Math.round(this.el.getBoundingClientRect().width);
    const w = Math.max(300, this.w), narrow = w < 560, h = this.compact ? (narrow ? 200 : 230) : narrow ? 280 : 330;
    const m = { t: 16, r: 12, b: 30, l: narrow ? 44 : 56 }, n = d.actual.length;
    const x = scaleLinear().domain([0, n - 1]).range([m.l + 6, w - m.r - 6]);
    const vals = d.actual.concat(d.points.map((p) => p.forecast));
    const y = scaleLinear().domain([Math.min(...vals) * 0.9, Math.max(...vals) * 1.05]).range([h - m.b, m.t]).nice(4);
    const axMoney = (v: number) => `$${(v / 1e6).toFixed(1)}M`;
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.svg.style.height = `${h}px`;
    const mape = d.points.length ? d.points.reduce((s, p) => s + Math.abs(p.error) / p.actual, 0) / d.points.length : 0;
    this.svg.setAttribute('aria-label', L(
      `Backtest of the ${d.model} model, ${d.h} month${d.h > 1 ? 's' : ''} ahead: monthly revenue with the model's past forecasts for ${d.points.length} months, average error ${pct(mape)}. The first ${d.warmup} months are warm-up only. Use the arrow keys to read each forecast.`,
      `اختبار رجعي لنموذج ${d.model} لأفق ${int(d.h)} شهر: الإيرادات الشهرية مع توقعات النموذج السابقة لـ${int(d.points.length)} شهرًا، بمتوسط خطأ ${pct(mape)}. أول ${int(d.warmup)} شهرًا للإحماء فقط. استخدم مفاتيح الأسهم لقراءة كل توقع.`));
    const wx = (x(d.warmup - 1) + x(d.warmup)) / 2;
    let out = `<rect class="warmup" x="${m.l}" y="${m.t}" width="${wx - m.l}" height="${h - m.b - m.t}"/>`;
    out += `<text class="ax warmup-label" x="${m.l + 8}" y="${m.t + 14}">${L('warm-up: feeds the models, not scored', 'إحماء: يغذّي النماذج ولا يُقيَّم')}</text>`;
    for (const t of y.ticks(4)) out += `<line class="grid" x1="${m.l}" x2="${w - m.r}" y1="${y(t)}" y2="${y(t)}"/><text class="ax" x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${axMoney(t)}</text>`;
    d.months.forEach((mo, i) => { if (mo.m === 0) out += `<line class="grid v" x1="${x(i)}" x2="${x(i)}" y1="${m.t}" y2="${h - m.b}"/><text class="ax yr-label" x="${x(i) + 4}" y="${h - m.b + 18}">${mo.y}</text>`; });
    out += `<path class="bt-actual" d="${d.actual.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('')}"/>`;
    d.points.forEach((p, k) => {
      const px = x(p.t);
      out += `<line class="bt-miss" x1="${px}" x2="${px}" y1="${y(p.actual)}" y2="${y(p.forecast)}"/><circle class="bt-fc" cx="${px}" cy="${y(p.forecast)}" r="4" style="--k:${k}"/>`;
    });
    const step = x(1) - x(0);
    d.points.forEach((p, k) => {
      const t = this.text(k);
      out += `<rect class="bt-hit" data-k="${k}" x="${x(p.t) - step / 2}" y="${m.t}" width="${step}" height="${h - m.b - m.t}" tabindex="${k === 0 ? 0 : -1}" role="img" aria-label="${esc(`${t.head}: ${t.body}`)}"/>`;
    });
    this.svg.innerHTML = out;
    this.svg.querySelectorAll<SVGRectElement>('rect.bt-hit').forEach((r) => {
      r.addEventListener('pointerenter', () => this.show(Number(r.dataset.k), r));
      r.addEventListener('pointerleave', () => tip(null));
    });
  }
  destroy() { this.ro.disconnect(); tip(null); }
}
