/**
 * The 对比基线 (baseline comparison) data model — strictly data, no UI.
 *
 * This module is the model layer the baseline feature shares between the
 * viewer library and its hosts: a host builds `Baseline` entries, resolves
 * file picks into `BaselinePick`s, and adapts the selected baseline's bytes
 * into a `BaselineReportData` pack. The viewer renders and selects; it never
 * reads the filesystem and never persists.
 *
 * The types themselves are DEFINED ONCE in `./types` (the domain barrel the
 * rest of the codebase imports from) — this module re-exports them so the
 * model slice stays one import for the feature's consumers, and no second
 * per-name declaration can drift out of sync.
 */
export type {
  Baseline,
  BaselinePick,
  BaselineReportData,
  BaselineReports,
  BaselineRow,
} from './types';
