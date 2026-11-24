/** Static planisphere drawn in SVG for devices without WebGL (also used with ?nogl). */
export function fallbackSVG(): string {
  const rings = [60, 120, 180, 240].map((r) => `<circle cx="300" cy="300" r="${r}" fill="none" style="stroke:var(--haze)" stroke-opacity=".25"/>`).join('');
  let ticks = '';
  for (let m = 0; m < 48; m++) {
    const a = -Math.PI * 0.78 + (m / 48) * Math.PI * 2;
    const r2 = m % 12 === 0 ? 278 : 264;
    ticks += `<line x1="${300 + 252 * Math.cos(a)}" y1="${300 + 252 * Math.sin(a)}" x2="${300 + r2 * Math.cos(a)}" y2="${300 + r2 * Math.sin(a)}" style="stroke:var(--brass)" stroke-opacity=".7"/>`;
  }
  let meridians = '';
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    meridians += `<line x1="300" y1="300" x2="${300 + 240 * Math.cos(a)}" y2="${300 + 240 * Math.sin(a)}" style="stroke:var(--haze)" stroke-opacity=".14"/>`;
  }
  return `<svg viewBox="0 0 600 600" role="presentation">${rings}${meridians}<circle cx="300" cy="300" r="252" fill="none" style="stroke:var(--brass)" stroke-opacity=".6"/><circle cx="300" cy="300" r="264" fill="none" style="stroke:var(--brass)" stroke-opacity=".6"/>${ticks}<circle cx="300" cy="300" r="5" style="fill:var(--chalk)"/></svg>`;
}
