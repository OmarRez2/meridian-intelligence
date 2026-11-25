import type { SupplyChainDataset } from './types';
import type { ValidationReport } from './validate';
import type { DataMode } from './mode';

/**
 * Single entry point for analytical data. Pages and the 3D scene go through `getDataset()`; nothing else
 * imports `verified.ts`. The app never imports `synthetic.ts` (tests only).
 *
 * The result is the validated project export, or an explicit 'unavailable' or 'invalid' state. There is no
 * fallback: if the project data is missing or fails validation, no values are shown.
 */
export { requestedMode, type DataMode } from './mode';

export type DataResult =
  | { state: 'ready'; mode: DataMode; dataset: SupplyChainDataset; report: ValidationReport | null; file: string | null }
  | { state: 'unavailable'; mode: DataMode; reason: string }
  | { state: 'invalid'; mode: DataMode; reason: string; file: string; report: ValidationReport | null };

let verified: Promise<DataResult> | null = null;

export function getDataset(): Promise<DataResult> {
  const mode: DataMode = 'verified';
  verified ??= import('./verified').then(async (m): Promise<DataResult> => {
    const r = await m.loadVerifiedDataset();
    if (r.state === 'ready') return { state: 'ready', mode, dataset: r.dataset, report: r.report, file: r.file };
    if (r.state === 'unavailable') return { state: 'unavailable', mode, reason: r.reason };
    return { state: 'invalid', mode, reason: r.reason, file: r.file, report: r.report };
  });
  return verified;
}
