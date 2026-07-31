import type { AdaptedReport, ParsedRep, SwimlaneModel } from './types';
import { notImplemented } from './notImplemented';

export type { AdaptedReport, ParsedRep, SwimlaneModel };

/** Parse CANN `.rep` / `.ncrep` bytes — implemented in core-parse slice (PR-FMT-*). */
export function parseRep(_source: ArrayBuffer | Uint8Array): ParsedRep {
  return notImplemented('parseRep');
}

/**
 * Map parsed `.rep` embeds → swimlane + report view-models.
 * Implemented in view-model / swimlane slices (PR-VM-*, PR-SWIM-*).
 */
export function adaptRep(_parsed: ParsedRep): AdaptedReport {
  return notImplemented('adaptRep');
}

/** Chrome Trace Event Format JSON → SwimlaneModel (PR-SWIM-001). */
export function chromeTraceToSwimlane(_trace: unknown): SwimlaneModel {
  return notImplemented('chromeTraceToSwimlane');
}
