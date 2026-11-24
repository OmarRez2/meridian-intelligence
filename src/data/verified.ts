import { validateDataset, VERIFIED_STATUSES, type ValidationReport } from './validate';
import type { SupplyChainDataset } from './types';

/**
 * Slot for VERIFIED data. It is intentionally empty.
 *
 * To integrate approved project data later (see `docs/export-contract.md`):
 *  1. The team exports approved aggregates (never raw personal data) as ONE JSON file matching the
 *     export contract, saved as `src/data/verified/dataset.json`.
 *  2. `provenance.status` must be 'reconciled' or 'approved', with coverage dates and producedAt.
 *  3. Nothing here queries a database. The website only reads the file the team has approved.
 *
 * The result is one of three states, and none of them falls back to synthetic numbers:
 *  - unavailable: no file is present
 *  - invalid:     a file is present but could not be read, or failed validation (errors listed)
 *  - ready:       the file passed validation (warnings, if any, are attached)
 */
const files = import.meta.glob<{ default: unknown }>('./verified/*.json');

export type VerifiedLoad =
  | { state: 'unavailable'; reason: string }
  | { state: 'invalid'; reason: string; file: string; report: ValidationReport | null }
  | { state: 'ready'; dataset: SupplyChainDataset; file: string; report: ValidationReport };

/**
 * Development-only test seam: browser checks (`scripts/check-data-modes.mjs`) can hand the loader
 * a fixture through `window.__WWI_VERIFIED_FIXTURE__`, so the ready and invalid states can be tested
 * without placing any file in `src/data/verified/`, and the unavailable state by setting it to `null`
 * (the real file is never moved). The fixture goes through the same validator.
 * `import.meta.env.DEV` is false in production builds, so this branch is removed from them.
 */
function devFixture(): { file: string; data: unknown } | 'absent' | null {
  if (!import.meta.env.DEV) return null;
  const w = window as unknown as { __WWI_VERIFIED_FIXTURE__?: unknown };
  if (w.__WWI_VERIFIED_FIXTURE__ === undefined) return null;
  // `null` simulates an empty src/data/verified/ folder without touching the real file
  if (w.__WWI_VERIFIED_FIXTURE__ === null) return 'absent';
  console.warn('[verified data] Using a test fixture injected by a QA script. This never happens in a production build.');
  return { file: 'test fixture (injected)', data: w.__WWI_VERIFIED_FIXTURE__ };
}

export async function loadVerifiedDataset(): Promise<VerifiedLoad> {
  const dev = devFixture();
  if (dev === 'absent') return { state: 'unavailable', reason: 'No verified dataset has been approved for the website yet.' };
  let source = dev;
  if (!source) {
    const paths = Object.keys(files);
    if (!paths.length) return { state: 'unavailable', reason: 'No verified dataset has been approved for the website yet.' };
    const name = (p: string) => p.replace('./verified/', 'src/data/verified/');
    if (paths.length > 1) return { state: 'invalid', file: paths.map(name).join(', '), report: null, reason: `Found ${paths.length} files in src/data/verified/. Exactly one approved export is allowed, so none is shown.` };
    try {
      source = { file: name(paths[0]), data: (await files[paths[0]]()).default };
    } catch (err) {
      console.error('Verified dataset could not be read:', err);
      return { state: 'invalid', file: name(paths[0]), report: null, reason: 'The verified file could not be read as JSON.' };
    }
  }
  const report = validateDataset(source.data, { allowedStatuses: VERIFIED_STATUSES });
  if (report.warnings.length) console.warn('Verified dataset warnings:', report.warnings);
  if (!report.ok) {
    console.error('Verified dataset rejected:', report.errors);
    return { state: 'invalid', file: source.file, report, reason: `The verified file failed ${report.errors.length === 1 ? 'a validation check' : 'validation'}, so none of it is shown.` };
  }
  return { state: 'ready', dataset: source.data as SupplyChainDataset, file: source.file, report };
}
