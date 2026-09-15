/**
 * Emulate profile adapter — map npu_emulate leaf embeds into AdaptedReport.
 * @see docs/formats/ADAPTERS.md
 * @see specs/core/adapt-emulate.spec.md
 */

import type {
  AdaptedReport,
  CsvTableModel,
  PipeOccupancyItem,
  ReportViewModel,
  SummaryMetrics,
  SwimlaneModel,
} from '../domain/types';
import { hasDependencies } from '../domain/dependencies';
import { laneColorKey } from '../domain/laneColors';
import { chromeTraceToSwimlane } from './chromeTraceToSwimlane';
import { emptyReportViewModel } from './adaptRep';

/** Primary: producer `manifest.json`; legacy: `EmulateManifest.json` ([PROC-8]). */
const MANIFEST_NAMES = [
  'manifest.json',
  'Manifest.json',
  'EmulateManifest.json',
  'emulatemanifest.json',
];
const PIPE_TRACE_NAMES = ['PipeTrace.json', 'pipetrace.json'];
const KERNEL_INFO_NAMES = ['KernelInfo.csv', 'kernelinfo.csv'];
const SUMMARY_JSON_NAMES = ['summary.json', 'Summary.json'];
const PIPES_UTIL_NAMES = ['PipesUtilization.csv', 'pipesutilization.csv'];
const PIPE_HIST_NAMES = ['PipeUtilizationHist.csv', 'pipeutilizationhist.csv'];

/** Hub object names that identify an npu_emulate CSV export catalog. */
const EXPORT_CATALOG_HUBS = new Set(['ExecutedInstructions', 'KernelInfo', 'AnalysisState']);

/**
 * Prefer PipeTrace.json; else first `*_tracing_report_*.json` (npu_emulate native name).
 * Skips critical_path reports.
 */
function findEmulateTracePayload(
  payloads: Record<string, Uint8Array>,
): { bytes: Uint8Array; name: string } | undefined {
  const preferred = payloadByName(payloads, PIPE_TRACE_NAMES);
  if (preferred) {
    const name =
      Object.keys(payloads).find((k) => PIPE_TRACE_NAMES.some((n) => k.toLowerCase() === n.toLowerCase())) ??
      'PipeTrace.json';
    return { bytes: preferred, name };
  }
  const native = Object.keys(payloads)
    .filter(
      (n) =>
        /tracing[_-]?report/i.test(n) &&
        /\.json$/i.test(n) &&
        !/critical[_-]?path/i.test(n),
    )
    .sort((a, b) => a.localeCompare(b));
  if (native.length === 0) return undefined;
  return { bytes: payloads[native[0]], name: native[0] };
}

export interface EmulateManifest {
  profile: string;
  schemaVersion: number;
  producer?: string;
  tickToUs?: number | null;
  /** True when detection used export-catalog `objects[]` rather than thin profile marker. */
  fromExportCatalog?: boolean;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function payloadByName(
  payloads: Record<string, Uint8Array>,
  names: string[],
): Uint8Array | undefined {
  for (const name of names) {
    if (payloads[name]) return payloads[name];
    const found = Object.keys(payloads).find((k) => k.toLowerCase() === name.toLowerCase());
    if (found) return payloads[found];
  }
  return undefined;
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = (cols[j] ?? '').trim();
    });
    rows.push(row);
  }
  return { headers, rows };
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

/** True when leaf payloads include a valid emulate `manifest.json` (or legacy EmulateManifest). */
export function isEmulateLeaf(payloads: Record<string, Uint8Array>): boolean {
  return readEmulateManifest(payloads) != null;
}

/**
 * Read emulate marker from `manifest.json` / legacy `EmulateManifest.json`.
 * Accepts thin `{ profile: "emulate", schemaVersion }` or export-catalog `{ objects: [...] }` with a hub table.
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
    throw new Error('[profiling-report] adaptEmulate: manifest.json is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('[profiling-report] adaptEmulate: manifest.json must be an object');
  }
  const obj = parsed as Record<string, unknown>;

  if (obj.profile === 'emulate') {
    if (typeof obj.schemaVersion !== 'number' || !Number.isFinite(obj.schemaVersion)) {
      throw new Error('[profiling-report] adaptEmulate: manifest.json schemaVersion required');
    }
    return {
      profile: 'emulate',
      schemaVersion: obj.schemaVersion,
      ...(typeof obj.producer === 'string' ? { producer: obj.producer } : {}),
      tickToUs: (obj.tickToUs as number | null | undefined) ?? null,
    };
  }

  // profile present but not emulate → not our leaf (e.g. mistaken compute marker)
  if (typeof obj.profile === 'string') return null;

  if (isExportCatalog(obj)) {
    return {
      profile: 'emulate',
      schemaVersion: 1,
      fromExportCatalog: true,
      ...(typeof obj.database === 'string' && /npu_emulate/i.test(obj.database)
        ? { producer: 'npu_emulate' }
        : {}),
    };
  }

  return null;
}

/** Interim DATA-47a: KernelInfo attr/val rows → SummaryMetrics. */
export function summaryFromKernelInfo(payload?: Uint8Array): SummaryMetrics {
  if (!payload) return {};
  const { rows } = parseCsv(decodeUtf8(payload));
  if (rows.length === 0) return {};
  const map = new Map<string, string>();
  for (const row of rows) {
    const attr = (row.KernelInfoAttr ?? row.Attr ?? row.key ?? Object.values(row)[0] ?? '')
      .trim()
      .toLowerCase();
    const val = (row.KernelInfoVal ?? row.Val ?? row.value ?? Object.values(row)[1] ?? '').trim();
    if (attr) map.set(attr, val);
  }
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = map.get(k.toLowerCase());
      if (v != null && v !== '') return v;
    }
    return undefined;
  };
  const num = (v: string | undefined) => {
    if (v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const summary: SummaryMetrics = {};
  const opName = pick('op name', 'opname', 'kernel name', 'kernelname', 'name');
  if (opName) summary.opName = opName;
  const opType = pick('op type', 'optype', 'kernel type', 'type');
  if (opType) summary.opType = opType;
  const dur = num(pick('task duration(us)', 'taskdurationus', 'duration(us)', 'duration_us', 'duration'));
  if (dur != null) summary.taskDurationUs = dur;
  const pid = pick('pid', 'process id');
  if (pid) summary.pid = pid;
  const blockDim = pick('block dim', 'blockdim', 'block_dim');
  if (blockDim) summary.blockDim = blockDim;
  return summary;
}

/** Interim DATA-47a: emulate summary.json loose fields → SummaryMetrics. */
export function summaryFromEmulateJson(payload?: Uint8Array): SummaryMetrics {
  if (!payload) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeUtf8(payload));
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const obj = parsed as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const summary: SummaryMetrics = {};
  const opName = str(obj.opName ?? obj.name ?? obj.kernel_name ?? obj['Op Name']);
  if (opName) summary.opName = opName;
  const opType = str(obj.opType ?? obj.type ?? obj['Op Type']);
  if (opType) summary.opType = opType;
  const dur =
    num(obj.taskDurationUs) ??
    num(obj.duration_us) ??
    num(obj.durationUs) ??
    num(obj['Task Duration(us)']);
  if (dur != null) summary.taskDurationUs = dur;
  const pid = str(obj.pid ?? obj.Pid ?? obj.PID);
  if (pid) summary.pid = pid;
  const blockDim = obj.blockDim ?? obj.block_dim ?? obj['Block Dim'];
  if (typeof blockDim === 'string' || typeof blockDim === 'number') summary.blockDim = blockDim;
  return summary;
}

function mergeSummary(a: SummaryMetrics, b: SummaryMetrics): SummaryMetrics {
  return { ...a, ...b };
}

const PIPE_NAME_MAP: { match: RegExp; id: string; label: string; colorKey: string; side: 'cube' | 'vector' }[] = [
  { match: /^cube$/i, id: 'cube', label: 'Cube', colorKey: 'cube', side: 'cube' },
  { match: /^vector$|^vec$/i, id: 'vector', label: 'Vector', colorKey: 'vector', side: 'vector' },
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
 * When PipeName is absent, InstrQueueTypeId is treated as a pipe name if it matches known labels;
 * otherwise a synthetic `q{id}` bar is emitted (still shows occupancy).
 */
export function pipeOccupancyFromPipesUtilization(payload?: Uint8Array): PipeOccupancyItem[] {
  if (!payload) return [];
  const { rows } = parseCsv(decodeUtf8(payload));
  const acc = new Map<string, { item: PipeOccupancyItem; sum: number; n: number }>();
  for (const row of rows) {
    const queue = (row.InstrQueueTypeId ?? row.PipeName ?? '').trim();
    const mapped = mapPipeName(queue);
    const coreType = (row.CoreTypeId ?? '').toLowerCase();
    const side: 'cube' | 'vector' =
      mapped?.side ??
      (coreType.includes('aiv') || coreType.includes('vector') ? 'vector' : 'cube');
    const id = mapped?.id ?? `q${queue || 'unknown'}`;
    const label = mapped?.label ?? (queue ? `Queue ${queue}` : 'Pipe');
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

function csvTableFromPayload(
  payloads: Record<string, Uint8Array>,
  names: string[],
): CsvTableModel | undefined {
  const payload = payloadByName(payloads, names);
  if (!payload) return undefined;
  const fileName =
    Object.keys(payloads).find((k) => names.some((n) => k.toLowerCase() === n.toLowerCase())) ??
    names[0];
  const { headers, rows } = parseCsv(decodeUtf8(payload));
  if (headers.length === 0) return undefined;
  return { fileName, headers, rows, blockIds: [] };
}

function withPipeLaneUtilizations(
  model: SwimlaneModel,
  pipes: PipeOccupancyItem[],
): SwimlaneModel {
  if (pipes.length === 0) return model;
  const collected = new Map<string, number[]>();
  for (const p of pipes) {
    if (p.id === 'icache' || p.colorKey === 'default') continue;
    const list = collected.get(p.colorKey) ?? [];
    list.push(p.ratio);
    collected.set(p.colorKey, list);
  }
  const byKey = new Map<string, number>();
  for (const [key, vals] of collected) {
    byKey.set(key, vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  return {
    ...model,
    processes: model.processes.map((proc) => ({
      ...proc,
      threads: proc.threads.map((t) => {
        const key = laneColorKey(t.name);
        if (key === 'default') return t;
        const ratio = byKey.get(key);
        if (ratio == null) return t;
        return { ...t, utilization: ratio };
      }),
    })),
  };
}

/**
 * Adapt an emulate-profile leaf (marker already validated or present).
 * Does not invent compute-shaped metric CSVs (DATA-45).
 */
export function adaptEmulate(payloads: Record<string, Uint8Array>): AdaptedReport {
  const manifest = readEmulateManifest(payloads);
  if (!manifest) {
    throw new Error(
      '[profiling-report] adaptEmulate: manifest.json (emulate profile or export catalog) required',
    );
  }

  const summary = mergeSummary(
    summaryFromKernelInfo(payloadByName(payloads, KERNEL_INFO_NAMES)),
    summaryFromEmulateJson(payloadByName(payloads, SUMMARY_JSON_NAMES)),
  );

  const histPipes = pipeOccupancyFromHist(payloadByName(payloads, PIPE_HIST_NAMES));
  const utilPipes = pipeOccupancyFromPipesUtilization(payloadByName(payloads, PIPES_UTIL_NAMES));
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

  const csvTexts: Record<string, string> = {};
  for (const name of [...PIPES_UTIL_NAMES, ...PIPE_HIST_NAMES, ...KERNEL_INFO_NAMES]) {
    const p = payloadByName(payloads, [name]);
    if (p) csvTexts[name] = decodeUtf8(p);
  }

  const reportModel: ReportViewModel = {
    ...emptyReportViewModel(),
    summary,
    pipeOccupancy,
    computeTables,
    csvTexts,
  };

  return {
    swimlaneModel,
    reportModel,
    capabilities: hasDependencies(swimlaneModel) ? ['dependencies'] : [],
  };
}
