/**
 * Emulate profile adapter — map npu_emulate leaf embeds into AdaptedReport.
 * @see docs/formats/ADAPTERS.md
 * @see specs/core/adapt-emulate.spec.md
 */

import type {
  AdaptedReport,
  CsvTableModel,
  ReportCapability,
  ReportViewModel,
  SwimlaneModel,
} from '../domain/types';
import { hasDependencies } from '../domain/dependencies';
import { chromeTraceToSwimlane } from './chromeTraceToSwimlane';
import { emptyReportViewModel } from './adaptRep';
import { topologyFromArchDiagramMetrics } from './emulateMemoryTopology';
import { parseCsv } from './parseCsv';
import {
  csvTableFromPipeUtilizationHist,
  pipeOccupancyFromHist,
  pipeOccupancyFromPipesUtilization,
} from './pipeOccupancyEmulate';
import { withPipeLaneUtilizations } from './withPipeLaneUtilizations';

export {
  pipeOccupancyFromHist,
  pipeOccupancyFromPipesUtilization,
} from './pipeOccupancyEmulate';

/** Producer `manifest.json` only ([PROC-8]). */
const MANIFEST_NAMES = ['manifest.json', 'Manifest.json'];
const PIPE_TRACE_NAMES = ['PipeTrace.json', 'pipetrace.json'];
const KERNEL_INFO_NAMES = ['KernelInfo.csv', 'kernelinfo.csv'];
const PIPES_UTIL_NAMES = ['PipesUtilization.csv', 'pipesutilization.csv'];
const PIPE_HIST_NAMES = ['PipeUtilizationHist.csv', 'pipeutilizationhist.csv'];
const INSTR_QUEUE_TYPE_NAMES = ['InstrQueueTypes.csv', 'instrqueuetypes.csv'];
const CORE_TYPE_NAMES = ['CoreTypes.csv', 'coretypes.csv'];
const ARCH_DIAGRAM_NAMES = ['ArchDiagramMetrics.csv', 'archdiagrammetrics.csv'];

/** Hub object names that identify an npu_emulate CSV export catalog. */
const EXPORT_CATALOG_HUBS = new Set(['ExecutedInstructions', 'KernelInfo', 'AnalysisState']);

/**
 * Prefer PipeTrace.json; else merge every `*_tracing_report_*.json` (npu_emulate native).
 * Skips critical_path reports. Multiple native cores are concatenated with remapped pids.
 */
function findEmulateTracePayload(
  payloads: Record<string, Uint8Array>,
): { bytes: Uint8Array; name: string } | undefined {
  const preferred = payloadEntry(payloads, PIPE_TRACE_NAMES);
  if (preferred) return preferred;
  const native = Object.keys(payloads)
    .filter(
      (n) =>
        /tracing[_-]?report/i.test(n) &&
        /\.json$/i.test(n) &&
        !/critical[_-]?path/i.test(n),
    )
    .sort((a, b) => {
      const ai = a.match(/core[_-]?(\d+)/i);
      const bi = b.match(/core[_-]?(\d+)/i);
      const an = ai ? Number(ai[1]) : Number.POSITIVE_INFINITY;
      const bn = bi ? Number(bi[1]) : Number.POSITIVE_INFINITY;
      return an - bn || a.localeCompare(b);
    });
  if (native.length === 0) return undefined;
  if (native.length === 1) return { bytes: payloads[native[0]], name: native[0] };
  return { bytes: mergeNativeChromeTraces(payloads, native), name: native.join('+') };
}

/** Coerce Chrome Trace pid (number or numeric string) to a finite number. */
function pidAsNumber(pid: unknown): number | undefined {
  if (typeof pid === 'number' && Number.isFinite(pid)) return pid;
  if (typeof pid === 'string' && pid.trim() !== '') {
    const n = Number(pid);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Concatenate Chrome Trace Event lists from several native core reports; remap pids to avoid collisions. */
function mergeNativeChromeTraces(
  payloads: Record<string, Uint8Array>,
  names: string[],
): Uint8Array {
  const mergedEvents: Record<string, unknown>[] = [];
  let displayTimeUnit: string | undefined;
  let pidOffset = 0;
  for (const name of names) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(decodeUtf8(payloads[name]));
    } catch {
      throw new Error(`[profiling-report] adaptEmulate: ${name} is not valid JSON`);
    }
    const obj = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    const events = Array.isArray(parsed)
      ? parsed
      : Array.isArray(obj?.traceEvents)
        ? (obj!.traceEvents as unknown[])
        : null;
    if (!events) {
      throw new Error(
        `[profiling-report] adaptEmulate: ${name} must be Chrome Trace JSON (traceEvents[])`,
      );
    }
    if (typeof obj?.displayTimeUnit === 'string' && displayTimeUnit == null) {
      displayTimeUnit = obj.displayTimeUnit;
    }
    let localMaxPid = 0;
    for (const raw of events) {
      if (!raw || typeof raw !== 'object') continue;
      const e = { ...(raw as Record<string, unknown>) };
      const pid = pidAsNumber(e.pid);
      if (pid != null) {
        localMaxPid = Math.max(localMaxPid, pid);
        e.pid = pid + pidOffset;
      }
      mergedEvents.push(e);
    }
    pidOffset += localMaxPid + 1;
  }
  const out: Record<string, unknown> = { traceEvents: mergedEvents };
  if (displayTimeUnit != null) out.displayTimeUnit = displayTimeUnit;
  return new TextEncoder().encode(JSON.stringify(out));
}

/** Detection marker only — no unused producer/tick fields (YAGNI). */
export interface EmulateManifest {
  profile: string;
  schemaVersion: number;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function payloadEntry(
  payloads: Record<string, Uint8Array>,
  names: string[],
): { bytes: Uint8Array; name: string } | undefined {
  for (const name of names) {
    if (payloads[name]) return { bytes: payloads[name], name };
    const found = Object.keys(payloads).find((k) => k.toLowerCase() === name.toLowerCase());
    if (found) return { bytes: payloads[found], name: found };
  }
  return undefined;
}

function payloadByName(
  payloads: Record<string, Uint8Array>,
  names: string[],
): Uint8Array | undefined {
  return payloadEntry(payloads, names)?.bytes;
}

function isExportCatalog(obj: Record<string, unknown>): boolean {
  if (!Array.isArray(obj.objects) || obj.objects.length === 0) return false;
  return obj.objects.some(
    (entry) =>
      entry != null &&
      typeof entry === 'object' &&
      typeof (entry as { name?: unknown }).name === 'string' &&
      EXPORT_CATALOG_HUBS.has((entry as { name: string }).name),
  );
}

/** True when leaf payloads include a valid emulate `manifest.json`. */
export function isEmulateLeaf(payloads: Record<string, Uint8Array>): boolean {
  return readEmulateManifest(payloads) != null;
}

/**
 * Read emulate marker from `manifest.json`.
 * Accepts thin `{ profile: "emulate", schemaVersion }` or export-catalog `{ objects: [...] }` with a hub table.
 * Parse/shape failures return `null` so leaf dispatch can fall through to compute adapt.
 */
export function readEmulateManifest(
  payloads: Record<string, Uint8Array>,
): EmulateManifest | null {
  const raw = payloadByName(payloads, MANIFEST_NAMES);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeUtf8(raw));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  if (obj.profile === 'emulate') {
    if (typeof obj.schemaVersion !== 'number' || !Number.isFinite(obj.schemaVersion)) {
      return null;
    }
    return { profile: 'emulate', schemaVersion: obj.schemaVersion };
  }

  // profile present but not emulate → not our leaf (e.g. mistaken compute marker)
  if (typeof obj.profile === 'string') return null;

  if (isExportCatalog(obj)) {
    return { profile: 'emulate', schemaVersion: 1 };
  }

  return null;
}

function csvTableFromPayload(
  payloads: Record<string, Uint8Array>,
  names: string[],
): CsvTableModel | undefined {
  const entry = payloadEntry(payloads, names);
  if (!entry) return undefined;
  const { headers, rows } = parseCsv(decodeUtf8(entry.bytes));
  if (headers.length === 0) return undefined;
  return { fileName: entry.name, headers, rows, blockIds: [] };
}

/**
 * Adapt an emulate-profile leaf (marker already validated or present).
 * Does not invent compute-shaped metric CSVs (DATA-45).
 * Pass `manifest` from detection to avoid a second parse.
 */
export function adaptEmulate(
  payloads: Record<string, Uint8Array>,
  manifest?: EmulateManifest | null,
): AdaptedReport {
  const resolved = manifest ?? readEmulateManifest(payloads);
  if (!resolved) {
    throw new Error(
      '[profiling-report] adaptEmulate: manifest.json (emulate profile or export catalog) required',
    );
  }

  const summary = {};

  const histPipes = pipeOccupancyFromHist(payloadByName(payloads, PIPE_HIST_NAMES));
  const utilPipes = pipeOccupancyFromPipesUtilization(
    payloadByName(payloads, PIPES_UTIL_NAMES),
    {
      queueTypes: payloadByName(payloads, INSTR_QUEUE_TYPE_NAMES),
      coreTypes: payloadByName(payloads, CORE_TYPE_NAMES),
    },
  );
  const pipeOccupancy = histPipes.length > 0 ? histPipes : utilPipes;

  // Trace optional: PipeTrace.json or native core_*_tracing_report_*.json.
  // Absent → null swimlane; corrupt → throw. Values are µs (DATA-46); override
  // misleading displayTimeUnit:"ns" on native emulate traces.
  let swimlaneModel: SwimlaneModel | null = null;
  const trace = findEmulateTracePayload(payloads);
  if (trace) {
    let traceJson: unknown;
    try {
      traceJson = JSON.parse(decodeUtf8(trace.bytes));
    } catch {
      throw new Error(
        `[profiling-report] adaptEmulate: ${trace.name} is not valid JSON`,
      );
    }
    swimlaneModel = withPipeLaneUtilizations(
      chromeTraceToSwimlane(traceJson, { sourceTimeUnit: 'us' }),
      pipeOccupancy,
    );
  }

  // UI-55: prefer projected hist (aic_/aiv0_/aiv1_ *_ratio); omit raw PipesUtilization when hist exists.
  const computeTables: CsvTableModel[] = [];
  const histPayload = payloadByName(payloads, PIPE_HIST_NAMES);
  const histTable = csvTableFromPipeUtilizationHist(histPayload);
  if (histTable) {
    computeTables.push(histTable);
  } else {
    const pipesTable = csvTableFromPayload(payloads, PIPES_UTIL_NAMES);
    if (pipesTable) computeTables.push(pipesTable);
  }

  const memoryTables: CsvTableModel[] = [];
  const archTable = csvTableFromPayload(payloads, ARCH_DIAGRAM_NAMES);
  if (archTable) memoryTables.push(archTable);

  const csvTexts: Record<string, string> = {};
  for (const name of [
    ...PIPES_UTIL_NAMES,
    ...PIPE_HIST_NAMES,
    ...KERNEL_INFO_NAMES,
    ...ARCH_DIAGRAM_NAMES,
  ]) {
    const p = payloadByName(payloads, [name]);
    if (p) csvTexts[name] = decodeUtf8(p);
  }

  const archBytes = payloadByName(payloads, ARCH_DIAGRAM_NAMES);
  const memoryTopology = topologyFromArchDiagramMetrics(
    archBytes ? decodeUtf8(archBytes) : undefined,
  );

  const reportModel: ReportViewModel = {
    ...emptyReportViewModel(),
    profile: 'emulate',
    summary,
    pipeOccupancy,
    computeTables,
    memoryTables,
    csvTexts,
    ...(memoryTopology ? { memoryTopology } : {}),
  };

  const capabilities: ReportCapability[] = [];
  if (hasDependencies(swimlaneModel)) capabilities.push('dependencies');
  if (memoryTopology) capabilities.push('archDiagram');

  return {
    swimlaneModel,
    reportModel,
    capabilities,
  };
}
