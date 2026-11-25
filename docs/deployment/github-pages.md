# GitHub Pages deployment

**Live site:** https://omarrez2.github.io/meridian-intelligence/

## How it deploys
- `.github/workflows/pages.yml` runs on every push to `main`, and can also be started manually.
- It runs `npm ci`, `npm test`, then `npm run build` with `VITE_DEPLOY_TARGET=github-pages`, which sets Vite's base path to `/meridian-intelligence/`.
- It publishes `dist/` (with `.nojekyll`) to the `gh-pages` branch.
- Pages is set to **Deploy from a branch: `gh-pages` / root**. The Actions-based Pages deployment (`deploy-pages`) failed repeatedly with GitHub-side 500/502 errors on 2026-11-25, so the site is served from the branch instead.
- Hash routes (for example `#/simulator?p=0.05`, `#/present?s=13`) need no server rewrites.
- Production builds have no source maps.
- `public/robots.txt` and `public/sitemap.xml` allow indexing.

## Updating the site
1. Work on a branch, then run `npm test`, the browser checks and `npm run build`.
2. Merge into `main`. The workflow publishes the site in about two minutes.
3. Check the live site. Run `scripts/smoke.mjs` with `BASE_URL=https://omarrez2.github.io/meridian-intelligence/`.
4. To roll back, revert the commit on `main` and push. The workflow redeploys the previous state.

## Previewing the Pages build locally (PowerShell)
```powershell
$env:VITE_DEPLOY_TARGET = 'github-pages'
npm.cmd run build
npm.cmd run preview   # http://127.0.0.1:4173/meridian-intelligence/
```

## Content permissions
- **Team profiles:** all six members consented to the public publication of their names, portraits and profile links (recorded 2026-11-25).
- **Analytical findings:** they keep their *approval pending* and *not reviewed by the team* labels until the team formally approves them.
