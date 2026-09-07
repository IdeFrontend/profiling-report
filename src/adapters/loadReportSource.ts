import { adaptPayloads, adaptRep, emptyReportViewModel } from './adaptRep';
import { chromeTraceToSwimlane } from './chromeTraceToSwimlane';
import { parseRep } from './parseRep';
import { isNestedNpuArchive, isNpuRep, npuArchiveStem, parseNpuRep } from './parseNpuRep';
import { isNestedNpuArchive160, isNpuRep160, parseNpuRep160 } from './parseNpuRep160';
import { hasDependencies } from '../domain/dependencies';
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
  const swimlaneModel = chromeTraceToSwimlane(trace);
  return {
    swimlaneModel,
    reportModel: emptyReportViewModel(),
    capabilities: hasDependencies(swimlaneModel) ? ['dependencies'] : [],
  };
}

/**
 * Map nested archive FileInfo names → operators; throws on duplicate stems
 * (`op1.npu.rep` + `op1.rep` both stem to `op1`).
 */
export function operatorsFromNestedNames(names: string[]): ReportOperator[] {
  const seenStems = new Set<string>();
  const operators: ReportOperator[] = [];
  for (const name of names) {
    const label = npuArchiveStem(name);
    if (seenStems.has(label)) {
      throw new Error(
        `[profiling-report] loadReportSource: duplicate operator stem ${JSON.stringify(label)}`,
      );
    }
    seenStems.add(label);
    operators.push({ id: name, label });
  }
  return operators;
}

/**
 * Adapt an `npu-rep` byte stream with an arbitrary parser + nested predicate.
 * An outer container (nested `.npu.rep` archives) yields a multi-operator
 * report (default-selecting the first); a flat leaf pack yields a
 * single-operator report exactly like `adaptRep`.
 */
function adaptNpuRepLike(
  bytes: Uint8Array,
  parse: (b: Uint8Array) => {
    files: { name: string; type: number; offset: number; length: number }[];
    payloads: Record<string, Uint8Array>;
  },
  isNested: (
    entry: { name: string; type: number; offset: number; length: number },
    payload: Uint8Array,
  ) => boolean,
): AdaptedReport {
  const parsed = parse(bytes);
  const nested = parsed.files.filter((f) => isNested(f, parsed.payloads[f.name]));

  if (nested.length === 0) {
    return adaptPayloads(parsed.payloads);
  }

  const operators = operatorsFromNestedNames(nested.map((e) => e.name));
  const operatorReports: Record<string, AdaptedReport> = {};
  for (const entry of nested) {
    const leaf = parse(parsed.payloads[entry.name]);
    operatorReports[entry.name] = adaptPayloads(leaf.payloads);
  }

  const selectedOperatorId = operators[0].id;
  return {
    ...operatorReports[selectedOperatorId],
    operators,
    operatorReports,
    selectedOperatorId,
  };
}

/** Adapt the interim 164-byte `npu-rep` sample format (nested `type 6`). */
function adaptNpuRep(bytes: Uint8Array): AdaptedReport {
  return adaptNpuRepLike(bytes, parseNpuRep, isNestedNpuArchive);
}

/** Adapt the product 160-byte `npu-rep` format (nested `type 1`). */
function adaptNpuRep160(bytes: Uint8Array): AdaptedReport {
  return adaptNpuRepLike(bytes, parseNpuRep160, isNestedNpuArchive160);
}

/**
 * Load either a `.rep` / `.ncrep` / `.npu-rep` container or standalone Chrome Trace JSON bytes.
 * PROC-3 / VIEW_DATA_REQUIREMENTS: JSON path hides analytics aside (empty ReportViewModel).
 */
export function loadReportSource(source: ArrayBuffer | Uint8Array): AdaptedReport {
  const bytes = toBytes(source);
  if (looksLikeCannRep(bytes)) {
    return adaptRep(parseRep(bytes));
  }
  if (isNpuRep(bytes)) {
    if (isNpuRep160(bytes)) {
      return adaptNpuRep160(bytes);
    }
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
