import { adaptRep } from './adaptRep';
import { chromeTraceToSwimlane } from './chromeTraceToSwimlane';
import { parseRep } from './parseRep';
import type { AdaptedReport } from './types';

const REP_MAGIC = 'cann-rep';

function toBytes(source: ArrayBuffer | Uint8Array): Uint8Array {
  return source instanceof Uint8Array ? source : new Uint8Array(source);
}

function looksLikeRep(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 8) return false;
  return new TextDecoder().decode(bytes.subarray(0, 8)) === REP_MAGIC;
}

/** Chrome Trace object or CTEF JSON document → AdaptedReport (no CSV aside). */
export function adaptChromeTrace(trace: unknown): AdaptedReport {
  return {
    swimlaneModel: chromeTraceToSwimlane(trace),
    reportModel: {
      summary: {},
      pipeOccupancy: [],
      overviewSeries: [],
    },
    capabilities: [],
  };
}

/**
 * Load either a `.rep` / `.ncrep` container or standalone Chrome Trace JSON bytes.
 * Q15 / VIEW_DATA_REQUIREMENTS: JSON path hides analytics aside (empty ReportViewModel).
 */
export function loadReportSource(source: ArrayBuffer | Uint8Array): AdaptedReport {
  const bytes = toBytes(source);
  if (looksLikeRep(bytes)) {
    return adaptRep(parseRep(bytes));
  }
  const text = new TextDecoder().decode(bytes).replace(/^\uFEFF/, '');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (cause) {
    throw new Error(
      '[profiling-report] loadReportSource: not a cann-rep container and not valid JSON',
      { cause },
    );
  }
  return adaptChromeTrace(json);
}
