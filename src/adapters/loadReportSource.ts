import { adaptPayloads, adaptRep, emptyReportViewModel } from './adaptRep';
import { chromeTraceToSwimlane } from './chromeTraceToSwimlane';
import { parseRep } from './parseRep';
import { isNestedNpuArchive, isNpuRep, npuArchiveStem, parseNpuRep } from './parseNpuRep';
import type { AdaptedReport, ReportOperator } from '../domain/types';

const CANN_REP_MAGIC = 'cann-rep';

function toBytes(source: ArrayBuffer | Uint8Array): Uint8Array {
  return source instanceof Uint8Array ? source : new Uint8Array(source);
}

function looksLikeCannRep(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 8) return false;
  return new TextDecoder().decode(bytes.subarray(0, 8)) === CANN_REP_MAGIC;
}

/** Chrome Trace object or CTEF JSON document → AdaptedReport (no CSV aside). */
export function adaptChromeTrace(trace: unknown): AdaptedReport {
  return {
    swimlaneModel: chromeTraceToSwimlane(trace),
    reportModel: emptyReportViewModel(),
    capabilities: [],
  };
}

/**
 * Adapt `npu-rep` bytes. An outer container (nested `.npu.rep` archives) yields
 * a multi-operator report (default-selecting the first); a flat leaf pack yields
 * a single-operator report exactly like `adaptRep`.
 */
function adaptNpuRep(bytes: Uint8Array): AdaptedReport {
  const parsed = parseNpuRep(bytes);
  const nested = parsed.files.filter((f) => isNestedNpuArchive(f, parsed.payloads[f.name]));

  if (nested.length === 0) {
    return adaptPayloads(parsed.payloads);
  }

  const operators: ReportOperator[] = [];
  const operatorReports: Record<string, AdaptedReport> = {};
  const seenStems = new Set<string>();
  for (const entry of nested) {
    const leaf = parseNpuRep(parsed.payloads[entry.name]);
    // FileInfo name is unique; stem is the short menu label (throw if stems collide).
    const id = entry.name;
    const label = npuArchiveStem(entry.name);
    if (seenStems.has(label)) {
      throw new Error(
        `[profiling-report] loadReportSource: duplicate operator stem ${JSON.stringify(label)}`,
      );
    }
    seenStems.add(label);
    operators.push({ id, label });
    operatorReports[id] = adaptPayloads(leaf.payloads);
  }

  const selectedOperatorId = operators[0].id;
  return {
    ...operatorReports[selectedOperatorId],
    operators,
    operatorReports,
    selectedOperatorId,
  };
}

/**
 * Load either a `.rep` / `.ncrep` / `.npu-rep` container or standalone Chrome Trace JSON bytes.
 * Q15 / VIEW_DATA_REQUIREMENTS: JSON path hides analytics aside (empty ReportViewModel).
 */
export function loadReportSource(source: ArrayBuffer | Uint8Array): AdaptedReport {
  const bytes = toBytes(source);
  if (looksLikeCannRep(bytes)) {
    return adaptRep(parseRep(bytes));
  }
  if (isNpuRep(bytes)) {
    return adaptNpuRep(bytes);
  }
  const text = new TextDecoder().decode(bytes).replace(/^\uFEFF/, '');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (cause) {
    throw new Error(
      '[profiling-report] loadReportSource: not a cann-rep/npu-rep container and not valid JSON',
      { cause },
    );
  }
  return adaptChromeTrace(json);
}
