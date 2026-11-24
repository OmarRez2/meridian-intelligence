export const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
  new URLSearchParams(location.search).has('reduced');

export const isCoarse = (): boolean => window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;

export function hasWebGL(): boolean {
  if (new URLSearchParams(location.search).has('nogl')) return false;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    // release the probe at once: browsers cap live contexts, and the sky needs its own
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}
