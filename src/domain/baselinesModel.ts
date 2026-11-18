import type { AdaptedReport } from './types';

/**
 * The 对比基线 (baseline comparison) data model — strictly data, no UI.
 *
 * This module is the model layer the baseline feature shares between the
 * viewer library and its hosts: a host builds `Baseline` entries, resolves
 * file picks into `BaselinePick`s, and adapts the selected baseline's bytes
 * into a `BaselineReportData` pack. The viewer renders and selects; it never
 * reads the filesystem and never persists.
 */

/** A saved comparison report — host-owned list, the library only renders and selects. */
export interface Baseline {
  id: string;
  name: string;
  /**
   * Host-meaningful identity (absolute path / URI). The library never opens
   * it; browser hosts fabricate a display pseudo-path in their own host
   * glue.
   */
  path: string;
  /**
   * The baseline's operator names, in pack order (MSTT: the pack's operators;
   * bundled web hosts fill demo values on the host side). The aside Operator
   * dropdown lists them; absent = no operator dropdown. Plain strings by
   * design: this model carries DISPLAY names, not the repo's `ReportOperator
   * { id, label }` shape — a viewer that needs ids maps names onto its own
   * operator records.
   */
  operators?: string[];
  /**
   * Pick timestamp in epoch ms (a host mtime or the pick moment). Drives the
   * derived display title (`baselineDisplayTitle`): filename + this stamp
   * replace a generated boilerplate id. Optional — an OPPROF name's embedded
   * stamp is parsed as the fallback. Only a REAL positive instant counts:
   * `0` is the unknown-mtime sentinel and NaN/negative are broken values —
   * all three fall to the embedded stamp instead of shadowing it.
   */
  pickedAt?: number;
}

/** What the host file dialog resolved after the picker + press; `null` = cancelled. */
export interface BaselinePick {
  path: string;
  /** Display name; the root falls back to the path basename when omitted. */
  name?: string;
  /** File mtime (epoch ms) — the derived title's timestamp; defaults to the pick moment. */
  pickedAt?: number;
}

/**
 * The selected baseline's adapted pack, supplied by the host: it adapts the
 * baseline bytes itself via the public `loadReportSource` and tags the result
 * with the baseline id it belongs to. The root ignores a payload whose id does
 * not match the current selection (a late adaptation must not paint under a
 * new selection). The library never reads the filesystem.
 */
export interface BaselineReportData {
  baselineId: string;
  report: AdaptedReport;
}
