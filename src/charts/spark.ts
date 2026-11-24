/** Dependency-free sparkline, shared by the Observatory and the homepage preview. */
export function spark(values: number[], color: string) {
  if (values.length < 2) return '';
  const w = 120, h = 30;
  const lo = Math.min(...values), hi = Math.max(...values) || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - lo) / (hi - lo || 1)) * (h - 6)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" style="stroke:${color}" stroke-width="1.4" vector-effect="non-scaling-stroke"/></svg>`;
}
