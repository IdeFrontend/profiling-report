/**
 * Emulate profile adapter — map npu_emulate leaf embeds into AdaptedReport.
 * @see docs/formats/ADAPTERS.md
 * @see specs/core/adapt-emulate.spec.md
 */

import type {
  AdaptedReport,
  CsvTableModel,
  PipeOccupancyItem,
  ReportCapability,
  ReportViewModel,
  SwimlaneModel,
} from '../domain/types';
import { hasDependencies } from '../domain/dependencies';
import { chromeTraceToSwimlane } from './chromeTraceToSwimlane';
import { emptyReportViewModel } from './adaptRep';
import { topologyFromArchDiagramMetrics } from './emulateMemoryTopology';
import { parseCsv } from './parseCsv';
import { withPipeLaneUtilizations } from './withPipeLaneUtilizations';

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

const PIPE_NAME_MAP: { match: RegExp; id: string; label: string; colorKey: string; side: 'cube' | 'vector' }[] = [
  { match: /^cube$/i, id: 'cube', label: 'Cube', colorKey: 'cube', side: 'cube' },
  { match: /^vector$|^vec$|^simd$/i, id: 'vector', label: 'Vector', colorKey: 'vector', side: 'vector' },
  { match: /^simt$/i, id: 'simt', label: 'SIMT', colorKey: 'default', side: 'vector' },
  { match: /^mte1$/i, id: 'mte1', label: 'MTE1', colorKey: 'mte1', side: 'cube' },
  { match: /^mte2$/i, id: 'mte2', label: 'MTE2', colorKey: 'mte2', side: 'cube' },
  { match: /^mte3$/i, id: 'mte3', label: 'MTE3', colorKey: 'mte3', side: 'cube' },
  { match: /^fixp$|^fixpipe$/i, id: 'fixp', label: 'FixP', colorKey: 'fixp', side: 'cube' },
  { match: /^scalar$/i, id: 'scalar', label: 'Scalar', colorKey: 'scalar', side: 'cube' },
  { match: /^icache/i, id: 'icache', label: 'ICache Miss', colorKey: 'default', side: 'cube' },
];

function normalizeRatio(raw: number): number | null {
  if (!Number.isFinite(raw)) return null;
  if (raw < 0) return null;
  // Accept 0..1 or 0..100 (%)
  if (raw > 1 && raw <= 100) return raw / 100;
  if (raw > 100) return null;
  return raw;
}

function mapPipeName(name: string): (typeof PIPE_NAME_MAP)[number] | null {
  const trimmed = name.trim();
  for (const entry of PIPE_NAME_MAP) {
    if (entry.match.test(trimmed)) return entry;
  }
  return null;
}

/** Map PipeUtilizationHist.csv (PipeName, Utilization) → pipeOccupancy. */
export function pipeOccupancyFromHist(payload?: Uint8Array): PipeOccupancyItem[] {
  if (!payload) return [];
  const { rows } = parseCsv(decodeUtf8(payload));
  const acc = new Map<string, { item: PipeOccupancyItem; sum: number; n: number }>();
  for (const row of rows) {
    const name = row.PipeName ?? row.pipeName ?? '';
    const mapped = mapPipeName(name);
    if (!mapped) continue;
    const ratio = normalizeRatio(Number(row.Utilization ?? row.utilization ?? row.PipeUtilization));
    if (ratio == null) continue;
    const key = `${mapped.side}:${mapped.id}`;
    const prev = acc.get(key);
    if (prev) {
      prev.sum += ratio;
      prev.n += 1;
      prev.item.ratio = prev.sum / prev.n;
    } else {
      acc.set(key, {
        sum: ratio,
        n: 1,
        item: {
          id: mapped.id,
          label: mapped.label,
          ratio,
          colorKey: mapped.colorKey,
          side: mapped.side,
        },
      });
    }
  }
  return [...acc.values()].map((v) => v.item);
}

/**
 * Map PipesUtilization.csv (CoreId, CoreTypeId, InstrQueueTypeId, PipeUtilization).
 * Producer packs INTEGER FKs — join `InstrQueueTypes` / `CoreTypes` when present.
 * Unmapped integer ids are skipped (no synthetic `Queue N` bars). String labels
 * (demo fixtures) still map via `mapPipeName`. Prefer `PipeUtilizationHist` when both exist.
 */
export function pipeOccupancyFromPipesUtilization(
  payload?: Uint8Array,
  dicts?: { queueTypes?: Uint8Array; coreTypes?: Uint8Array },
): PipeOccupancyItem[] {
  if (!payload) return [];
  const queueNames = idNameMap(dicts?.queueTypes, [
    'InstrQueueTypeId',
    'InstrQueueTypeName',
  ]);
  const coreNames = idNameMap(dicts?.coreTypes, ['CoreTypeId', 'CoreTypeName']);
  const { rows } = parseCsv(decodeUtf8(payload));
  const acc = new Map<string, { item: PipeOccupancyItem; sum: number; n: number }>();
  for (const row of rows) {
    const queueRaw = (row.InstrQueueTypeId ?? row.PipeName ?? '').trim();
    if (!queueRaw) continue;
    const queueLabel = queueNames.get(queueRaw) ?? queueRaw;
    const mapped = mapPipeName(queueLabel);
    // Skip bare integer FKs that did not resolve to a known pipe family.
    if (!mapped && /^\d+$/.test(queueRaw) && !queueNames.has(queueRaw)) continue;
    if (!mapped && /^\d+$/.test(queueLabel)) continue;

    const coreRaw = (row.CoreTypeId ?? '').trim();
    const coreLabel = (coreNames.get(coreRaw) ?? coreRaw).toLowerCase();
    const side: 'cube' | 'vector' =
      mapped?.side ??
      (coreLabel.includes('aiv') || coreLabel.includes('vector') ? 'vector' : 'cube');
    const id = mapped?.id ?? `q${queueLabel}`;
    const label = mapped?.label ?? queueLabel;
    const colorKey = mapped?.colorKey ?? 'default';
    const ratio = normalizeRatio(Number(row.PipeUtilization ?? row.Utilization));
    if (ratio == null) continue;
    const key = `${side}:${id}`;
    const prev = acc.get(key);
    if (prev) {
      prev.sum += ratio;
      prev.n += 1;
      prev.item.ratio = prev.sum / prev.n;
    } else {
      acc.set(key, {
        sum: ratio,
        n: 1,
        item: { id, label, ratio, colorKey, side },
      });
    }
  }
  return [...acc.values()].map((v) => v.item);
}

/** Build id→name map from a two-column dictionary CSV. */
function idNameMap(
  payload: Uint8Array | undefined,
  [idCol, nameCol]: [string, string],
): Map<string, string> {
  const out = new Map<string, string>();
  if (!payload) return out;
  const { rows } = parseCsv(decodeUtf8(payload));
  for (const row of rows) {
    const id = (row[idCol] ?? Object.values(row)[0] ?? '').trim();
    const name = (row[nameCol] ?? Object.values(row)[1] ?? '').trim();
    if (id && name) out.set(id, name);
  }
  return out;
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

  const computeTables: CsvTableModel[] = [];
  const pipesTable = csvTableFromPayload(payloads, PIPES_UTIL_NAMES);
  if (pipesTable) computeTables.push(pipesTable);
  const histTable = csvTableFromPayload(payloads, PIPE_HIST_NAMES);
  if (histTable) computeTables.push(histTable);

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
