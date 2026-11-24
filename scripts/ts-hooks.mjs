// Node module hook: lets `node` import this project's TypeScript sources directly.
// Node 24 strips types itself; this hook only adds the `.ts` extension that Vite-style imports omit.
// Used by scripts/test-data.mjs and scripts/build-verified-dataset.mjs. No dependency is involved.
export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]s$|\.json$/.test(specifier)) {
    try { return await next(`${specifier}.ts`, context); } catch { /* fall through */ }
  }
  return next(specifier, context);
}
