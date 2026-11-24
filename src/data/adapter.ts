import type { SupplyChainDataset } from './types';
import type { ValidationReport } from './validate';
import { requestedMode, type DataMode } from './mode';

/**
 * Single entry point for analytical data. Pages, the 3D scene and the design studies all go
 * through `getDataset()`; nothing else imports `synthetic.ts` or `verified.ts`.
 *
 *  - mode 'demo'     -> the seeded synthetic dataset, always labelled as such
 *  - mode 'verified' -> an approved export that passed validation, or an explicit 'unavailable' or
 *                       'invalid' state. Never demo data: in verified mode the synthetic module is not
 *                       even loaded.
 *
 * The mode comes from `?data=verified` in the hash query (default demo); see `mode.ts`.
 */
export { requestedMode, type DataMode } from './mode';

export type DataResult =
  | { state: 'ready'; mode: DataMode; dataset: SupplyChainDataset; report: ValidationReport | null; file: string | null }
  | { state: 'unavailable'; mode: 'verified'; reason: string }
  | { state: 'invalid'; mode: 'verified'; reason: string; file: string; report: ValidationReport | null };

let demo: Promise<DataResult> | null = null;
let verified: Promise<DataResult> | null = null;

export function getDataset(mode: DataMode = requestedMode()): Promise<DataResult> {
  if (mode === 'demo') {
    demo ??= import('./synthetic').then((m): DataResult => ({ state: 'ready', mode, dataset: m.syntheticDataset, report: null, file: null }));
    return demo;
  }
  verified ??= import('./verified').then(async (m): Promise<DataResult> => {
    const r = await m.loadVerifiedDataset();
    if (r.state === 'ready') return { state: 'ready', mode, dataset: r.dataset, report: r.report, file: r.file };
    if (r.state === 'unavailable') return { state: 'unavailable', mode, reason: r.reason };
    return { state: 'invalid', mode, reason: r.reason, file: r.file, report: r.report };
  });
  return verified;
}
