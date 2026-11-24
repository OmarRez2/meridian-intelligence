import { gsap } from 'gsap';
import { scaleLinear } from 'd3-scale';
import { area, line, curveMonotoneX } from 'd3-shape';
import { max, min } from 'd3-array';
import { prefersReducedMotion } from '../lib/env';
import { L as tx, int } from '../i18n';

import { fmt, esc, type Fmt } from '../lib/format';
export { fmt, type Fmt };

const NS = 'http://www.w3.org/2000/svg';
const reduced = () => prefersReducedMotion();
/** Tick labels drop trailing zeros: "$1.50M" -> "$1.5M", "$2.00M" -> "$2M". */
const tickLabel = (s: string) => s.replace(/(\.\d*?)0+(?=[KM%٪ ]|$)/, '$1').replace(/\.(?=[KM%٪ ]|$)/, '');

/* --------------------------------------------------------------- tooltip */
let tipEl: HTMLDivElement | null = null;
export function tip(html: string | null, x = 0, y = 0) {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'chart-tip';
    tipEl.setAttribute('role', 'status');
    document.body.appendChild(tipEl);
  }
  if (html === null) { tipEl.classList.remove('on'); return; }
  tipEl.innerHTML = html;
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  const rtl = document.documentElement.dir === 'rtl';
  const left = rtl ? Math.max(12, Math.min(window.innerWidth - w - 12, x - w - 16)) : Math.min(window.innerWidth - w - 12, Math.max(12, x + 16));
  const top = y - h - 14 < 70 ? y + 18 : y - h - 14;
  tipEl.style.transform = `translate(${left}px, ${top}px)`;
  tipEl.classList.add('on');
}

/* ------------------------------------------------------------ trend chart */
export type Series = { key: string; name: string; color: string; values: number[]; fill?: boolean; dashed?: boolean };
/** `reference` is a computed comparison line (for example the period average), never an assumed business standard. */
/** `ticks`: which labels the x axis shows (for example January of each year), as index and short text. */
export type TrendData = { labels: string[]; series: Series[]; format: Fmt; reference?: { value: number; label: string }; picked?: number | null; ticks?: { i: number; text: string }[] };

export class Trend {
  private svg: SVGSVGElement;
  private shown: Series[] | null = null;
  private data!: TrendData;
  private ro: ResizeObserver;
  private hoverI = -1;
  constructor(private el: HTMLElement, private onPick?: (i: number) => void) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('trend');
    this.svg.setAttribute('role', 'img');
    this.svg.tabIndex = 0;
    el.appendChild(this.svg);
    this.ro = new ResizeObserver(() => this.data && this.shown && this.draw(this.shown));
    this.ro.observe(el);
    this.svg.addEventListener('pointermove', (e) => this.hover(e));
    this.svg.addEventListener('pointerleave', () => { this.hoverI = -1; tip(null); if (this.shown) this.draw(this.shown); });
    this.svg.addEventListener('click', () => this.hoverI >= 0 && this.onPick?.(this.hoverI));
    this.svg.addEventListener('keydown', (e) => {
      if (!this.shown) return;
      const n = this.data.labels.length;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        this.hoverI = Math.max(0, Math.min(n - 1, (this.hoverI < 0 ? n - 1 : this.hoverI) + (e.key === 'ArrowRight' ? 1 : -1)));
        this.draw(this.shown!);
        const r = this.svg.getBoundingClientRect();
        this.showTip(r.left + this.x(this.hoverI), r.top + 30);
      } else if (e.key === 'Enter' && this.hoverI >= 0) { e.preventDefault(); this.onPick?.(this.hoverI); }
      else if (e.key === 'Escape') { this.hoverI = -1; tip(null); this.draw(this.shown!); }
    });
    this.svg.addEventListener('blur', () => { tip(null); });
  }
  private w = 0; private h = 0; private m = { t: 18, r: 14, b: 30, l: 58 };
  private x = (i: number) => this.m.l + (this.data.labels.length <= 1 ? 0 : (i / (this.data.labels.length - 1)) * (this.w - this.m.l - this.m.r));
  private yScale = scaleLinear();

  update(data: TrendData) {
    const prev = this.shown;
    this.data = data;
    const empty = !data.labels.length || data.series.every((s) => s.values.every((v) => !v));
    this.el.classList.toggle('is-empty', empty);
    if (empty) {
      this.shown = null;
      this.svg.innerHTML = '';
      this.svg.setAttribute('aria-label', tx('No records match the current filters.', 'لا توجد سجلات تطابق المرشحات الحالية.'));
      return;
    }
    const names = data.series.map((s) => s.name).join(tx(' and ', ' و'));
    const first = data.labels[0], last = data.labels[data.labels.length - 1];
    this.svg.setAttribute('aria-label', tx(`Line chart, ${names}, ${first} to ${last}. Use the left and right arrow keys to read values; press Enter to open a month.`, `مخطط خطي: ${names}، من ${first} إلى ${last}. استخدم مفتاحي السهمين لقراءة القيم، واضغط Enter لفتح شهر.`));
    const sameShape = prev && prev.length === data.series.length && prev.every((s, i) => s.values.length === data.series[i].values.length);
    if (!sameShape || reduced()) { this.shown = data.series; this.draw(data.series); if (!sameShape && !reduced()) gsap.fromTo(this.svg, { opacity: 0.2 }, { opacity: 1, duration: 0.5 }); return; }
    const from = prev!.map((s) => s.values.slice());
    const proxy = { t: 0 };
    gsap.to(proxy, {
      t: 1, duration: 0.75, ease: 'power3.inOut',
      onUpdate: () => {
        this.shown = data.series.map((s, k) => ({ ...s, values: s.values.map((v, i) => from[k][i] + (v - from[k][i]) * proxy.t) }));
        this.draw(this.shown);
      },
    });
  }

  private draw(series: Series[]) {
    const r = this.el.getBoundingClientRect();
    this.w = Math.max(280, r.width); this.h = Math.max(180, r.height);
    const { m, w, h } = this;
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const all = series.flatMap((s) => s.values).concat(this.data.reference ? [this.data.reference.value] : []);
    const lo = Math.min(0, min(all) ?? 0), hi = (max(all) ?? 1) * 1.08 || 1;
    this.yScale = scaleLinear().domain([lo, hi]).range([h - m.b, m.t]).nice(4);
    const y = this.yScale;
    let out = '';
    // grid + y labels
    for (const t of y.ticks(4)) out += `<line class="grid" x1="${m.l}" x2="${w - m.r}" y1="${y(t)}" y2="${y(t)}"/><text class="ax" x="${m.l - 10}" y="${y(t) + 4}" text-anchor="end">${tickLabel(this.data.format(t))}</text>`;
    // x labels: given by the caller (month metadata), else every other label
    const L = this.data.labels;
    const ticks = this.data.ticks ?? L.map((text, i) => ({ i, text })).filter((t) => t.i % 2 === 0);
    for (const t of ticks) out += `<text class="ax" x="${this.x(t.i)}" y="${h - 8}" text-anchor="middle">${esc(t.text)}</text><line class="tick" x1="${this.x(t.i)}" x2="${this.x(t.i)}" y1="${h - m.b}" y2="${h - m.b + 5}"/>`;
    if (this.data.reference) {
      const ty = y(this.data.reference.value);
      out += `<line class="reference" x1="${m.l}" x2="${w - m.r}" y1="${ty}" y2="${ty}"/><text class="ax reference-label" x="${w - m.r}" y="${ty - 6}" text-anchor="end">${esc(this.data.reference.label)}</text>`;
    }
    const ln = line<number>().x((_, i) => this.x(i)).y((v) => y(v)).curve(curveMonotoneX);
    const ar = area<number>().x((_, i) => this.x(i)).y0(y(Math.max(0, lo))).y1((v) => y(v)).curve(curveMonotoneX);
    series.forEach((s, k) => {
      // colours go in style, not presentation attributes, so theme tokens (var(--…)) resolve
      if (s.fill) out += `<defs><linearGradient id="g-${s.key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${s.color};stop-opacity:.28"/><stop offset="1" style="stop-color:${s.color};stop-opacity:0"/></linearGradient></defs><path d="${ar(s.values)}" fill="url(#g-${s.key})"/>`;
      out += `<path class="series${s.dashed ? ' dashed' : ''}" d="${ln(s.values)}" style="stroke:${s.color};--i:${k}"/>`;
    });
    if (this.data.picked != null && this.data.picked >= 0) {
      const px = this.x(this.data.picked);
      out += `<line class="picked" x1="${px}" x2="${px}" y1="${m.t}" y2="${h - m.b}"/>`;
    }
    if (this.hoverI >= 0 && this.hoverI < L.length) {
      const hx = this.x(this.hoverI);
      out += `<line class="cross" x1="${hx}" x2="${hx}" y1="${m.t}" y2="${h - m.b}"/>`;
      series.forEach((s) => (out += `<circle class="dot" cx="${hx}" cy="${y(s.values[this.hoverI])}" r="4.5" style="stroke:${s.color}"/>`));
    }
    out += `<rect class="hit" x="${m.l}" y="${m.t}" width="${w - m.l - m.r}" height="${h - m.t - m.b}" fill="transparent"/>`;
    this.svg.innerHTML = out;
  }
  private hover(e: PointerEvent) {
    const r = this.svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * this.w;
    const n = this.data.labels.length;
    const i = Math.round(((px - this.m.l) / (this.w - this.m.l - this.m.r)) * (n - 1));
    if (i < 0 || i >= n) return;
    if (i !== this.hoverI) { this.hoverI = i; this.draw(this.shown!); }
    this.showTip(e.clientX, e.clientY);
  }
  private showTip(x: number, y: number) {
    const i = this.hoverI;
    const rows = this.data.series.map((s) => `<div class="tr"><i style="background:${s.color}"></i>${esc(s.name)}<b>${this.data.format(s.values[i])}</b></div>`).join('');
    tip(`<div class="tt">${esc(this.data.labels[i])}</div>${rows}${this.onPick ? `<div class="th">${tx('Select to open this month', 'اختر لفتح هذا الشهر')}</div>` : ''}`, x, y);
  }
  destroy() { this.ro.disconnect(); tip(null); }
}

/* --------------------------------------------------------------- bar list */
/** `risk` marks a row as worse than the stated comparison (for example the average of the groups shown). */
export type BarItem = { key: number; label: string; value: number; note?: string; risk?: boolean };
/** A computed comparison drawn as a tick on every track, e.g. the average of the groups shown. */
export type BarReference = { value: number; label: string };
export class BarList {
  private rows = new Map<number, HTMLButtonElement>();
  private refEl: HTMLParagraphElement;
  constructor(private el: HTMLElement, private opts: { color: string; format: Fmt; onPick?: (key: number) => void; limit?: number }) {
    el.classList.add('barlist');
    this.refEl = document.createElement('p');
    this.refEl.className = 'bar-ref-note';
  }
  update(items: BarItem[], active: number | null, reference?: BarReference) {
    this.el.classList.toggle('is-empty', !items.length);
    const list = items.slice().sort((a, b) => b.value - a.value).slice(0, this.opts.limit ?? 12);
    const top = Math.max(...list.map((i) => i.value), reference?.value ?? 0, 1e-9);
    this.el.style.setProperty('--ref', reference ? `${(reference.value / top) * 100}%` : '');
    this.el.classList.toggle('has-ref', !!reference);
    const keep = new Set(list.map((i) => i.key));
    for (const [k, row] of this.rows) if (!keep.has(k)) { row.remove(); this.rows.delete(k); }
    list.forEach((it, idx) => {
      let row = this.rows.get(it.key);
      if (!row) {
        row = document.createElement('button');
        row.type = 'button';
        row.className = 'bar-row';
        row.innerHTML = `<span class="bar-label"></span><span class="bar-track"><span class="bar-fill"></span><span class="bar-ref" aria-hidden="true"></span></span><span class="bar-value num"></span><span class="sr-only bar-hint"></span>`;
        if (this.opts.onPick) row.addEventListener('click', () => this.opts.onPick!(it.key));
        else row.disabled = true;
        this.rows.set(it.key, row);
        (row.querySelector('.bar-fill') as HTMLElement).style.width = '0%';
      }
      this.el.appendChild(row); // reorders in place
      row.style.setProperty('--c', it.risk ? 'var(--ember)' : this.opts.color);
      row.style.setProperty('--d', `${idx * 28}ms`);
      row.querySelector('.bar-label')!.textContent = it.label;
      row.querySelector('.bar-value')!.textContent = this.opts.format(it.value) + (it.note ? ` ${it.note}` : '');
      row.classList.toggle('active', active === it.key);
      row.classList.toggle('muted', active !== null && active !== it.key);
      if (this.opts.onPick) row.setAttribute('aria-pressed', String(active === it.key));
      // the visible label and value are the name (WCAG 2.5.3); the action is added for screen readers only
      row.querySelector('.bar-hint')!.textContent = this.opts.onPick ? (active === it.key ? tx('. Selected; select again to clear the filter', '. محدد؛ اختر مرة أخرى لإلغاء التصفية') : tx('. Select to filter the workspace', '. اختر لتصفية مساحة العمل')) : '';
      const fill = row.querySelector('.bar-fill') as HTMLElement;
      requestAnimationFrame(() => (fill.style.width = `${(it.value / top) * 100}%`));
    });
    if (reference) {
      this.refEl.textContent = tx(`The pale tick on each bar marks ${reference.label}: ${this.opts.format(reference.value)}.`, `العلامة الباهتة على كل شريط تمثّل ${reference.label}: ${this.opts.format(reference.value)}.`);
      this.el.appendChild(this.refEl);
    } else this.refEl.remove();
  }
}

/* ---------------------------------------------------------------- scatter */
export type Pt = { x: number; y: number; label: string; risk: boolean; extra: string };
export class Scatter {
  private svg: SVGSVGElement;
  private pts: Pt[] = [];
  private ro: ResizeObserver;
  constructor(private el: HTMLElement, private opts: { xLabel: string; yLabel: string }) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('scatter');
    // a group, not an image: the points inside are operable and must stay in the accessibility tree
    this.svg.setAttribute('role', 'group');
    el.appendChild(this.svg);
    // one tab stop for the whole plot; arrow keys move between points in reading order (left to right)
    this.svg.addEventListener('keydown', (e) => {
      const pts = [...this.svg.querySelectorAll<SVGCircleElement>('circle.pt')];
      const i = pts.indexOf(document.activeElement as SVGCircleElement);
      if (i < 0) return;
      const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? pts.length - 1 : -2;
      if (next === -2) return;
      e.preventDefault();
      const to = pts[Math.max(0, Math.min(pts.length - 1, next))];
      pts[i].setAttribute('tabindex', '-1');
      to.setAttribute('tabindex', '0');
      to.focus();
    });
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(el);
  }
  update(pts: Pt[]) { this.pts = pts; this.draw(); }
  private draw() {
    const r = this.el.getBoundingClientRect();
    const w = Math.max(280, r.width), h = Math.max(220, r.height);
    const m = { t: 16, r: 16, b: 42, l: 54 };
    const xm = (max(this.pts, (p) => p.x) ?? 1) * 1.08, ym = (max(this.pts, (p) => p.y) ?? 1) * 1.05;
    const x = scaleLinear().domain([0, xm]).range([m.l, w - m.r]).nice();
    const y = scaleLinear().domain([0, ym]).range([h - m.b, m.t]).nice();
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const nr = this.pts.filter((p) => p.risk).length;
    this.svg.setAttribute('aria-label', tx(`Scatter plot of ${this.pts.length} stock items, ${this.opts.yLabel} against ${this.opts.xLabel}. ${nr} items sit at or below their reorder level. Use the arrow keys to move between items.`, `مخطط انتشار لـ ${int(this.pts.length)} صنفًا: ${this.opts.yLabel} مقابل ${this.opts.xLabel}. ${int(nr)} أصناف عند حد إعادة الطلب أو دونه. استخدم مفاتيح الأسهم للتنقل بين الأصناف.`));
    const d = Math.min(x.domain()[1], y.domain()[1]);
    let out = `<path class="risk-zone" d="M${x(0)} ${y(0)} L${x(x.domain()[1])} ${y(0)} L${x(x.domain()[1])} ${y(Math.min(y.domain()[1], x.domain()[1]))} L${x(d)} ${y(d)} Z"/>`;
    for (const t of y.ticks(4)) out += `<line class="grid" x1="${m.l}" x2="${w - m.r}" y1="${y(t)}" y2="${y(t)}"/><text class="ax" x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`;
    for (const t of x.ticks(5)) out += `<text class="ax" x="${x(t)}" y="${h - m.b + 18}" text-anchor="middle">${t}</text>`;
    out += `<line class="diag" x1="${x(0)}" y1="${y(0)}" x2="${x(d)}" y2="${y(d)}"/>`;
    out += `<text class="ax ax-title" x="${w - m.r}" y="${h - 6}" text-anchor="end">${esc(this.opts.xLabel)}</text><text class="ax ax-title" x="${m.l}" y="${m.t - 4}" text-anchor="start">${esc(this.opts.yLabel)}</text>`;
    out += `<text class="ax zone-label" x="${w - m.r - 6}" y="${h - m.b - 10}" text-anchor="end">${tx('At or below reorder level', 'عند حد إعادة الطلب أو دونه')}</text>`;
    // points in reading order (left to right), so arrow keys travel predictably
    const order = this.pts.map((_, i) => i).sort((a, b) => this.pts[a].x - this.pts[b].x || this.pts[b].y - this.pts[a].y);
    order.forEach((i, k) => {
      const p = this.pts[i];
      out += `<circle class="pt${p.risk ? ' risk' : ''}" cx="${x(p.x)}" cy="${y(p.y)}" r="${p.risk ? 5 : 3.8}" data-i="${i}" tabindex="${k === 0 ? 0 : -1}" role="img" aria-label="${esc(p.label)}: ${esc(p.extra)}"/>`;
    });
    this.svg.innerHTML = out;
    this.svg.querySelectorAll<SVGCircleElement>('circle.pt').forEach((c) => {
      const show = (cx: number, cy: number) => { const p = this.pts[Number(c.dataset.i)]; tip(`<div class="tt">${esc(p.label)}</div><div class="tr">${esc(p.extra)}</div>`, cx, cy); };
      c.addEventListener('pointerenter', (e) => show(e.clientX, e.clientY));
      c.addEventListener('pointerleave', () => tip(null));
      c.addEventListener('focus', () => { const b = c.getBoundingClientRect(); show(b.left, b.top); });
      c.addEventListener('blur', () => tip(null));
    });
  }
  destroy() { this.ro.disconnect(); }
}

/* ------------------------------------------------------- dot strip (lead) */
export type StripRow = { key: number; label: string; values: number[]; promise: number; late: boolean[] };
export class Strip {
  private svg: SVGSVGElement;
  private rows: StripRow[] = [];
  private ro: ResizeObserver;
  constructor(private el: HTMLElement) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('strip');
    this.svg.setAttribute('role', 'img');
    el.appendChild(this.svg);
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(el);
  }
  update(rows: StripRow[]) { this.rows = rows; this.draw(); }
  private draw() {
    const r = this.el.getBoundingClientRect();
    const w = Math.max(300, r.width);
    const rowH = 30, m = { t: 10, r: 18, b: 34, l: 92 };
    const h = m.t + m.b + rowH * this.rows.length;
    const hi = Math.max(10, ...this.rows.flatMap((x) => x.values)) * 1.05;
    const x = scaleLinear().domain([0, hi]).range([m.l, w - m.r]).nice();
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.svg.style.height = `${h}px`;
    this.svg.setAttribute('aria-label', tx(`Lead time in days for each received purchase order, grouped by supplier, with the expected lead time marked. ${this.rows.length} suppliers.`, `مدة التوريد بالأيام لكل أمر شراء مُستلَم، مجمّعة حسب المورد، مع تمييز المدة المتوقعة. ${int(this.rows.length)} موردين.`));
    let out = '';
    for (const t of x.ticks(6)) out += `<line class="grid" x1="${x(t)}" x2="${x(t)}" y1="${m.t}" y2="${h - m.b}"/><text class="ax" x="${x(t)}" y="${h - m.b + 18}" text-anchor="middle">${t}</text>`;
    out += `<text class="ax ax-title" x="${w - m.r}" y="${h - 4}" text-anchor="end">${tx('Lead time, days', 'مدة التوريد بالأيام')}</text>`;
    this.rows.forEach((row, k) => {
      const cy = m.t + rowH * k + rowH / 2;
      out += `<text class="ax row-label" x="${m.l - 12}" y="${cy + 4}" text-anchor="end">${esc(row.label)}</text>`;
      out += `<line class="row-rule" x1="${m.l}" x2="${w - m.r}" y1="${cy}" y2="${cy}"/>`;
      row.values.forEach((v, i) => {
        const h1 = ((i * 9301 + 49297) % 233280) / 233280, h2 = ((i * 4253 + 1931) % 7919) / 7919;
        out += `<circle class="lead${row.late[i] ? ' late' : ''}" cx="${x(v + (h2 - 0.5) * 0.8)}" cy="${cy + (h1 - 0.5) * 14}" r="2.4"/>`;
      });
      out += `<line class="promise" x1="${x(row.promise)}" x2="${x(row.promise)}" y1="${cy - 11}" y2="${cy + 11}"><title>${tx(`Expected ${row.promise} days`, `المتوقع ${row.promise} يومًا`)}</title></line>`;
    });
    this.svg.innerHTML = out;
  }
  destroy() { this.ro.disconnect(); }
}

/* ------------------------------------------------------------- sparkline */
export { spark } from './spark';

/* --------------------------------------------------------- count-up value */
export function countTo(el: HTMLElement, to: number, format: Fmt) {
  const from = Number(el.dataset.v ?? 0);
  el.dataset.v = String(to);
  if (reduced() || from === to) { el.textContent = format(to); return; }
  const o = { v: from };
  gsap.to(o, { v: to, duration: 0.9, ease: 'power3.out', onUpdate: () => (el.textContent = format(o.v)) });
}
