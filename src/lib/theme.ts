/**
 * Light and dark themes. Dark ("Night") is the original cinematic Meridian; light ("Day") reads the same
 * instrument as an engraved chart on vellum. The choice is remembered per browser; a first visit follows the
 * Night default, because the cinematic dark sky is the identity of the site. `?theme=light` overrides it.
 *
 * The theme is a `data-theme` attribute on <html>; every colour in the CSS is a token that both themes define,
 * and the 3D sky switches its palette and blending through `Sky.setTheme()`.
 */
export type Theme = 'dark' | 'light';
type Listener = (t: Theme) => void;
const KEY = 'meridian:theme';
const listeners = new Set<Listener>();

function initial(): Theme {
  const q = new URLSearchParams(location.search).get('theme');
  if (q === 'light' || q === 'dark') return q;
  try { const s = localStorage.getItem(KEY); if (s === 'light' || s === 'dark') return s; } catch { /* storage blocked */ }
  return 'dark';
}

export const theme = {
  current: initial() as Theme,
  get light() { return this.current === 'light'; },
  set(t: Theme) {
    if (t === this.current) return;
    this.current = t;
    try { localStorage.setItem(KEY, t); } catch { /* keep in memory only */ }
    applyTheme();
    listeners.forEach((f) => f(t));
  },
  subscribe(f: Listener) { listeners.add(f); return () => { listeners.delete(f); }; },
};

const META: Record<Theme, string> = { dark: '#060f22', light: '#efeae0' };

export function applyTheme() {
  const h = document.documentElement;
  h.dataset.theme = theme.current;
  h.style.colorScheme = theme.current;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META[theme.current]);
}

/** Reads a colour token from the current theme, for code that cannot use CSS variables directly. */
export const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
