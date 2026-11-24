import { prefersReducedMotion } from './env';

/**
 * Visitor-controlled pause for autonomous motion (WCAG 2.2.2 Pause, Stop, Hide).
 * Reduced-motion preference starts the site paused-equivalent; the toggle is remembered per browser.
 */
type Listener = (paused: boolean) => void;
const listeners = new Set<Listener>();
const KEY = 'meridian:motion-paused';

function read(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export const motion = {
  paused: read(),
  reduced: prefersReducedMotion(),
  /** true when nothing should move on its own */
  get still() { return this.paused || this.reduced; },
  set(p: boolean) {
    this.paused = p;
    try { localStorage.setItem(KEY, p ? '1' : '0'); } catch { /* storage unavailable: keep in memory only */ }
    document.documentElement.dataset.motion = this.reduced ? 'reduced' : p ? 'paused' : 'full';
    listeners.forEach((f) => f(p));
  },
  subscribe(f: Listener): () => void { listeners.add(f); return () => { listeners.delete(f); }; },
};
