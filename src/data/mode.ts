/**
 * Which dataset the website shows. Kept free of imports so the shell can read it without pulling the
 * dataset into the entry bundle.
 *
 * Since the Analytics Lab milestone the website shows the project data only: the visitor-facing demo mode was
 * removed at the owner's request. The synthetic generator (`synthetic.ts`) is kept for automated tests and is
 * never loaded by the app. An old `?data=demo` link is ignored (main.ts strips it), so it shows the real data
 * or, if that is missing or rejected, the explicit unavailable/invalid state, never generated values.
 */
export type DataMode = 'verified';

export function hashParams(hash = location.hash): URLSearchParams {
  return new URLSearchParams(hash.split('?')[1] ?? '');
}

export const requestedMode = (): DataMode => 'verified';

/** Returns `hash` with one query parameter set (or removed when `value` is null). */
export function withParam(hash: string, key: string, value: string | null): string {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const q = new URLSearchParams(query);
  if (value === null) q.delete(key); else q.set(key, value);
  const s = q.toString();
  return `#${path || '/'}${s ? `?${s}` : ''}`;
}
