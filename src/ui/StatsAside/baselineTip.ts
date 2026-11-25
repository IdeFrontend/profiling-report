import type { DiffTone } from '../../domain/metricDiff';

/**
 * One comparison row's value + delta for a single metric (对比基线 hover
 * popup): the FIRST baseline paints inline, the others surface only in the
 * popup. `value` is the baseline's own number formatted like the surface
 * shows it; `delta` is the unsigned magnitude in the inline delta's unit.
 */
export interface BaselineTipRow {
  /** `基线 1`, `基线 2`, … */
  label: string;
  value: string;
  tone?: DiffTone;
  delta?: string;
}
