/**
 * Which dataset the visitor asked for. Kept free of imports so the shell can read it without
 * pulling either dataset into the entry bundle.
 *
 * Since phase 5 the verified (real, source-reconciled) dataset is the default. The synthetic demo is
 * opened with `?data=demo` in the hash query; `main.ts` carries that choice across navigation, so a
 * visitor who opens the demo stays in it until they choose `?data=verified` or follow a plain link home.
 */
export type DataMode = 'demo' | 'verified';

export function hashParams(hash = location.hash): URLSearchParams {
  return new URLSearchParams(hash.split('?')[1] ?? '');
}

export function requestedMode(hash = location.hash): DataMode {
  return hashParams(hash).get('data') === 'demo' ? 'demo' : 'verified';
}

/** Returns `hash` with one query parameter set (or removed when `value` is null). */
export function withParam(hash: string, key: string, value: string | null): string {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const q = new URLSearchParams(query);
  if (value === null) q.delete(key); else q.set(key, value);
  const s = q.toString();
  return `#${path || '/'}${s ? `?${s}` : ''}`;
}

/** A link that switches to `mode` on `route`. Both modes are explicit, so the link also ends a sticky demo view. */
export const hrefFor = (route: string, mode: DataMode) => withParam(`#${route}`, 'data', mode);
