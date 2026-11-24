# GitHub Pages deployment preparation

## Status

The app is prepared and locally testable at the project-site path:

`https://omarrez2.github.io/wwi-supply-chain-intelligence/`

This is preparation only. The repository remains private, GitHub Pages is not enabled, the workflow is inactive, and no site has been published. The changes are on `feature/github-pages`; `main` and `v0.5.0-preview` are unchanged.

## Build base and routing

`vite.config.ts` uses `/` by default, so `npm run dev` and ordinary local builds retain their current root behavior. Set `VITE_DEPLOY_TARGET=github-pages` for a Pages build to set Vite's `base` to `/wwi-supply-chain-intelligence/`.

Vite emits the app entry, imported Fontsource files and the JSON dataset under the configured base. The favicon uses `%BASE_URL%`; team portraits in the Team page and Presentation Mode already use `import.meta.env.BASE_URL`. Open Graph and Twitter image URLs and the canonical URL point to the expected absolute Pages URL. Hash routes remain unchanged (for example `#/observatory` and `#/present?s=6`), so they need no server-side rewrite.

Build and preview the project subpath locally from PowerShell:

```powershell
$env:VITE_DEPLOY_TARGET = 'github-pages'
npm.cmd run build
npm.cmd run preview
```

Open `http://127.0.0.1:4173/wwi-supply-chain-intelligence/`. In another terminal, focused browser scripts can target that preview:

```powershell
$env:BASE_URL = 'http://127.0.0.1:4173/wwi-supply-chain-intelligence/'
node scripts/smoke.mjs
```

`BASE_URL` can also be used with `scripts/check-data-modes.mjs` against a development server. The data-mode fixture tests require Vite development mode; the production preview is for checking actual emitted assets and default verified-data loading.

## Inactive deployment workflow

`.github/workflows/pages.yml.disabled` is a draft, not a recognized GitHub Actions workflow filename. It uses only `workflow_dispatch`, builds with the Pages base, uploads `dist/`, and deploys with job-scoped Pages permissions. It must not be renamed to `.yml` until publication is approved, the account and repository are eligible, and GitHub Pages has been intentionally configured.

## Account-plan and privacy constraint

The authenticated GitHub account reports the **Free** plan. GitHub's [Pages creation guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) states that repositories owned by accounts on GitHub Free or Free for organizations must be public. It also explicitly warns that Pages sites are public on the internet even when their source repository is private, if the plan allows private-source Pages.

The current plan therefore cannot publish Pages from this private repository. A qualifying plan would address the private-source eligibility constraint, but would **not** make the deployed website private. Keep the repository private and do not publish until the owner explicitly approves public website release and all content permissions are resolved.

## Remaining steps before publication

1. Resolve approval for analytical definitions, findings, product-family groupings, team profiles, portraits and profile links.
2. Obtain a GitHub plan that supports Pages from a private source repository, or separately approve a different repository visibility/source strategy. The published site itself will be public.
3. Review this branch and explicitly approve any merge into `main`; this preparation does not include merging.
4. Configure Pages for GitHub Actions in repository settings, enable the reviewed workflow by renaming it to `.yml`, and manually run it only after publication approval.
5. Verify the resulting public site, asset URLs, and noindex/search-indexing decision. The current `noindex, nofollow` should remain until the owner approves indexing.

References: [Creating a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site), [What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
