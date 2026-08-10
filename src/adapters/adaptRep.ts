import type {
  AdaptedReport,
  CsvTableModel,
  ParsedRep,
  PipeOccupancyItem,
  ReportViewModel,
  SummaryMetrics,
  SwimlaneModel,
} from '../domain/types';
import { laneColorKey } from '../domain/laneColors';
import { chromeTraceToSwimlane } from './chromeTraceToSwimlane';

const COMPUTE_CSV_FILES = [
  'PipeUtilization.csv',
  'ArithmeticUtilization.csv',
  'ResourceConflictRatio.csv',
] as const;

const MEMORY_CSV_FILES = [
  'MemoryL0.csv',
  'L2Cache.csv',
  'Memory.csv',
  'MemoryUB.csv',
] as const;

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? '').trim();
    });
    return row;
  });
  return { headers, rows };
}

function blockIdsFromRows(rows: Record<string, string>[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const row of rows) {
    const id = row['block_id'];
    if (id == null || id === '' || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function csvTableFromPayload(fileName: string, payload?: Uint8Array): CsvTableModel | null {
  if (!payload || payload.byteLength === 0) return null;
  const text = decodeUtf8(payload);
  const { headers, rows } = parseCsv(text);
  if (headers.length === 0) return null;
  return {
    fileName,
    headers,
    rows,
    blockIds: blockIdsFromRows(rows),
  };
}

function collectCsvTables(
  parsed: ParsedRep,
  fileNames: readonly string[],
): { tables: CsvTableModel[]; texts: Record<string, string> } {
  const tables: CsvTableModel[] = [];
  const texts: Record<string, string> = {};
  for (const name of fileNames) {
    const payload = parsed.payloads[name];
    const table = csvTableFromPayload(name, payload);
    if (!table) continue;
    tables.push(table);
    texts[name] = decodeUtf8(payload!);
  }
  return { tables, texts };
}

function parseNumber(raw: string | undefined): number | undefined {
  if (raw == null || raw === '' || raw === 'NA') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function meanFamily(rows: Record<string, string>[], columns: string[]): number | undefined {
  const vals: number[] = [];
  for (const col of columns) {
    for (const row of rows) {
      const n = parseNumber(row[col]);
      if (n != null) vals.push(n);
    }
  }
  if (vals.length === 0) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function summaryFromOpBasicInfo(payload?: Uint8Array): SummaryMetrics {
  if (!payload) return {};
  const { rows } = parseCsv(decodeUtf8(payload));
  const row = rows[0];
  if (!row) return {};
  return {
    opName: row['Op Name'] || undefined,
    opType: row['Op Type'] || undefined,
    taskDurationUs: parseNumber(row['Task Duration(us)']),
    currentFreq: parseNumber(row['Current Freq']),
    ratedFreq: parseNumber(row['Rated Freq']),
    blockDim: (() => {
      const raw = row['Block Dim']?.trim();
      if (!raw || raw === 'NA') return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    })(),
  };
}

/** Pipe family → side-specific CSV columns (VIEW_DATA_MAPPING Cube/Vector tables). */
const PIPE_COLUMNS: {
  id: string;
  label: string;
  colorKey: string;
  side: 'cube' | 'vector';
  ratioColumns: string[];
  timeColumns?: string[];
}[] = [
  // Cube side (aic_*)
  {
    id: 'cube',
    label: 'Cube',
    colorKey: 'cube',
    side: 'cube',
    ratioColumns: ['aic_cube_ratio'],
    timeColumns: ['aic_cube_time(us)'],
  },
  {
    id: 'mte2',
    label: 'MTE2',
    colorKey: 'mte2',
    side: 'cube',
    ratioColumns: ['aic_mte2_ratio'],
    timeColumns: ['aic_mte2_time(us)'],
  },
  {
    id: 'mte1',
    label: 'MTE1',
    colorKey: 'mte1',
    side: 'cube',
    ratioColumns: ['aic_mte1_ratio'],
    timeColumns: ['aic_mte1_time(us)'],
  },
  {
    id: 'fixp',
    label: 'FixP',
    colorKey: 'fixp',
    side: 'cube',
    ratioColumns: ['aic_fixpipe_ratio'],
    timeColumns: ['aic_fixpipe_time(us)'],
  },
  {
    id: 'scalar',
    label: 'Scalar',
    colorKey: 'scalar',
    side: 'cube',
    ratioColumns: ['aic_scalar_ratio'],
    timeColumns: ['aic_scalar_time(us)'],
  },
  {
    id: 'icache',
    label: 'ICache Miss',
    colorKey: 'default',
    side: 'cube',
    ratioColumns: ['aic_icache_miss_rate'],
  },
  // Vector side (aiv_*)
  {
    id: 'vector',
    label: 'Vector',
    colorKey: 'vector',
    side: 'vector',
    ratioColumns: ['aiv_vec_ratio'],
    timeColumns: ['aiv_vec_time(us)'],
  },
  {
    id: 'mte2',
    label: 'MTE2',
    colorKey: 'mte2',
    side: 'vector',
    ratioColumns: ['aiv_mte2_ratio'],
    timeColumns: ['aiv_mte2_time(us)'],
  },
  {
    id: 'mte3',
    label: 'MTE3',
    colorKey: 'mte3',
    side: 'vector',
    ratioColumns: ['aiv_mte3_ratio'],
    timeColumns: ['aiv_mte3_time(us)'],
  },
  {
    id: 'scalar',
    label: 'Scalar',
    colorKey: 'scalar',
    side: 'vector',
    ratioColumns: ['aiv_scalar_ratio'],
    timeColumns: ['aiv_scalar_time(us)'],
  },
  {
    id: 'icache',
    label: 'ICache Miss',
    colorKey: 'default',
    side: 'vector',
    ratioColumns: ['aiv_icache_miss_rate'],
  },
];

function pipeOccupancyFromCsv(payload?: Uint8Array): PipeOccupancyItem[] {
  if (!payload) return [];
  const { rows } = parseCsv(decodeUtf8(payload));
  const items: PipeOccupancyItem[] = [];
  for (const pipe of PIPE_COLUMNS) {
    const ratio = meanFamily(rows, pipe.ratioColumns);
    if (ratio == null) continue;
    const absoluteValue = pipe.timeColumns
      ? meanFamily(rows, pipe.timeColumns)
      : undefined;
    items.push({
      id: pipe.id,
      label: pipe.label,
      ratio,
      colorKey: pipe.colorKey,
      side: pipe.side,
      ...(absoluteValue != null ? { absoluteValue } : {}),
    });
  }
  return items;
}

/**
 * Attach PipeUtilization ratios onto matching lanes (METRICS_AND_TRACE).
 * When both Cube and Vector sides contribute the same colorKey, use their mean.
 */
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
    processes: model.processes.map((p) => ({
      ...p,
      threads: p.threads.map((t) => {
        const key = laneColorKey(t.name);
        if (key === 'default') return t;
        const ratio = byKey.get(key);
        if (ratio == null) return t;
        return { ...t, utilization: ratio };
      }),
    })),
  };
}

function reportModelFromParsed(parsed: ParsedRep): ReportViewModel {
  const compute = collectCsvTables(parsed, COMPUTE_CSV_FILES);
  const memory = collectCsvTables(parsed, MEMORY_CSV_FILES);
  return {
    summary: summaryFromOpBasicInfo(parsed.payloads['OpBasicInfo.csv']),
    pipeOccupancy: pipeOccupancyFromCsv(parsed.payloads['PipeUtilization.csv']),
    overviewSeries: [],
    computeTables: compute.tables,
    memoryTables: memory.tables,
    csvTexts: { ...compute.texts, ...memory.texts },
  };
}

/** Empty analytics model for Chrome Trace–only loads (Q15). */
export function emptyReportViewModel(): ReportViewModel {
  return {
    summary: {},
    pipeOccupancy: [],
    overviewSeries: [],
    computeTables: [],
    memoryTables: [],
    csvTexts: {},
  };
}

function swimlaneFromParsed(parsed: ParsedRep, pipes: PipeOccupancyItem[]): SwimlaneModel {
  const bytes = parsed.payloads['trace.json'];
  if (!bytes) {
    throw new Error(
      '[profiling-report] adaptRep: trace.json missing — timeline requires a swimlane source',
    );
  }
  let trace: unknown;
  try {
    trace = JSON.parse(decodeUtf8(bytes)) as unknown;
  } catch (cause) {
    throw new Error('[profiling-report] adaptRep: trace.json is not valid JSON', { cause });
  }
  // Ascend `.rep` embeds store ts/dur in nanoseconds (producer convention, not CTEF).
  const model = chromeTraceToSwimlane(trace, { sourceTimeUnit: 'ns' });
  return withPipeLaneUtilizations(model, pipes);
}

/** Map parsed `.rep` embeds → swimlane + report view-models. */
export function adaptRep(parsed: ParsedRep): AdaptedReport {
  const reportModel = reportModelFromParsed(parsed);
  return {
    swimlaneModel: swimlaneFromParsed(parsed, reportModel.pipeOccupancy),
    reportModel,
    capabilities: [],
  };
}
