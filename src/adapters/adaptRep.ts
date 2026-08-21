import type {
  AdaptedReport,
  BandwidthCardModel,
  BandwidthSideRow,
  CsvTableModel,
  HardwareDetailsModel,
  HardwareSection,
  ParsedRep,
  PipeOccupancyItem,
  ReportCapability,
  ReportViewModel,
  RooflineMixLabel,
  RooflineViewModel,
  SummaryMetrics,
  SwimlaneModel,
} from '../domain/types';
import { laneColorKey } from '../domain/laneColors';
import { hasDependencies } from '../domain/dependencies';
import { chromeTraceToSwimlane } from './chromeTraceToSwimlane';
import { firstLabelledMemoryTopology } from './memoryTopology';

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

const BANDWIDTH_COLUMNS = {
  input: {
    aic: ['aic_main_mem_read_bw(GB/s)', 'aic_main_mem_read_bw'],
    aiv: ['aiv_main_mem_read_bw(GB/s)', 'aiv_main_mem_read_bw'],
  },
  output: {
    aic: ['aic_main_mem_write_bw(GB/s)', 'aic_main_mem_write_bw'],
    aiv: ['aiv_main_mem_write_bw(GB/s)', 'aiv_main_mem_write_bw'],
  },
} as const;

const ALL_MAIN_MEM_BW_COLUMNS = Object.values(BANDWIDTH_COLUMNS).flatMap((d) => [...d.aic, ...d.aiv]);

/** I-Q6g: sketch 1.6 TB/s hardware guess for all four aic/aiv × in/out slots. */
const BANDWIDTH_PEAK_GBS = 1600;

/** I-Q11d fallback when Memory BW columns are all NA. */
const ROOFLINE_PEAK_BW_FALLBACK_GBS = 100;
/** I-Q11d sketch-like compute plateau (TOps/s). */
const ROOFLINE_PEAK_COMPUTE_TOPS = 1;

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

function meanFamily(rows: Record<string, string>[], columns: readonly string[]): number | undefined {
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

function maxFamily(rows: Record<string, string>[], columns: readonly string[]): number | undefined {
  let max: number | undefined;
  for (const col of columns) {
    for (const row of rows) {
      const n = parseNumber(row[col]);
      if (n == null) continue;
      max = max == null ? n : Math.max(max, n);
    }
  }
  return max;
}

const VEC_MIX: { id: string; label: string; column: string }[] = [
  { id: 'fp32', label: 'Vec_FP32', column: 'aiv_vec_fp32_ratio' },
  { id: 'fp16', label: 'Vec_FP16', column: 'aiv_vec_fp16_ratio' },
  { id: 'int32', label: 'Vec_INT32', column: 'aiv_vec_int32_ratio' },
  { id: 'int16', label: 'Vec_INT16', column: 'aiv_vec_int16_ratio' },
  { id: 'misc', label: 'Vec_MISC', column: 'aiv_vec_misc_ratio' },
];

const CUBE_MIX: { id: string; label: string; column: string }[] = [
  { id: 'fp16', label: 'Cube_FP16', column: 'aic_cube_fp16_ratio' },
  { id: 'int8', label: 'Cube_INT8', column: 'aic_cube_int8_ratio' },
];

function mixLabelsFromRows(
  rows: Record<string, string>[],
  defs: { id: string; label: string; column: string }[],
): RooflineMixLabel[] {
  const parts: { id: string; label: string; value: number }[] = [];
  for (const d of defs) {
    const v = meanFamily(rows, [d.column]);
    if (v != null && v > 0) parts.push({ id: d.id, label: d.label, value: v });
  }
  const sum = parts.reduce((a, p) => a + p.value, 0);
  if (sum <= 0) return [];
  return parts.map((p) => ({
    id: p.id,
    label: p.label,
    percent: (p.value / sum) * 100,
  }));
}

/**
 * Interim I-Q11a–e: GM roofline point + mix labels from ArithmeticUtilization + Memory.
 * Returns undefined when undecidable (I-Q11c L2 omitted).
 */
function rooflineFromCsv(
  arithPayload?: Uint8Array,
  memoryPayload?: Uint8Array,
): RooflineViewModel | undefined {
  if (!arithPayload || !memoryPayload) return undefined;
  const arithRows = parseCsv(decodeUtf8(arithPayload)).rows;
  const memRows = parseCsv(decodeUtf8(memoryPayload)).rows;
  if (arithRows.length === 0 || memRows.length === 0) return undefined;

  const vecFops = meanFamily(arithRows, ['aiv_vec_fops']);
  const vecTime = meanFamily(arithRows, ['aiv_time(us)']);
  const cubeFops = meanFamily(arithRows, ['aic_cube_fops']);
  const cubeTime = meanFamily(arithRows, ['aic_time(us)']);

  const useVector = vecFops != null && vecFops > 0 && vecTime != null && vecTime > 0;
  const useCube = !useVector && cubeFops != null && cubeFops > 0 && cubeTime != null && cubeTime > 0;
  if (!useVector && !useCube) return undefined;

  const fops = useVector ? vecFops! : cubeFops!;
  const timeUs = useVector ? vecTime! : cubeTime!;
  const performance = fops / timeUs / 1e6;

  const readKb = meanFamily(memRows, ['read_main_memory_datas(KB)']);
  const writeKb = meanFamily(memRows, ['write_main_memory_datas(KB)']);
  if (readKb == null && writeKb == null) return undefined;
  const bytes = ((readKb ?? 0) + (writeKb ?? 0)) * 1024;
  if (!(bytes > 0) || !(performance > 0)) return undefined;

  const intensity = fops / bytes;
  const peakBw = maxFamily(memRows, ALL_MAIN_MEM_BW_COLUMNS) ?? ROOFLINE_PEAK_BW_FALLBACK_GBS;

  const mixLabels = mixLabelsFromRows(arithRows, useVector ? VEC_MIX : CUBE_MIX);

  return {
    points: [
      {
        id: 'gm',
        label: 'GM Read + Write',
        intensity,
        performance,
        style: 'solid',
      },
    ],
    mixLabels,
    peakComputeTops: ROOFLINE_PEAK_COMPUTE_TOPS,
    peakBandwidthGBs: peakBw,
  };
}

function firstPresentColumn(
  rows: Record<string, string>[],
  aliases: readonly string[],
): string | undefined {
  const keys = rows[0];
  if (!keys) return undefined;
  return aliases.find((c) => Object.prototype.hasOwnProperty.call(keys, c));
}

function bandwidthSide(
  rows: Record<string, string>[],
  side: BandwidthSideRow['side'],
  columns: readonly string[],
): BandwidthSideRow | undefined {
  const col = firstPresentColumn(rows, columns);
  if (!col) return undefined;
  const measuredGBs = meanFamily(rows, [col]);
  if (measuredGBs == null) return undefined;
  return { side, measuredGBs, peakGBs: BANDWIDTH_PEAK_GBS };
}

/** I-Q6g: mean non-NA Memory.csv main-mem BW; peak = sketch 1600 GB/s. */
function bandwidthCardsFromMemory(payload?: Uint8Array): BandwidthCardModel[] {
  if (!payload) return [];
  const { rows } = parseCsv(decodeUtf8(payload));
  if (rows.length === 0) return [];
  const cards: BandwidthCardModel[] = [];
  for (const id of ['input', 'output'] as const) {
    const sides: BandwidthSideRow[] = [];
    const aic = bandwidthSide(rows, 'aic', BANDWIDTH_COLUMNS[id].aic);
    const aiv = bandwidthSide(rows, 'aiv', BANDWIDTH_COLUMNS[id].aiv);
    if (aic) sides.push(aic);
    if (aiv) sides.push(aiv);
    if (sides.length > 0) cards.push({ id, sides });
  }
  return cards;
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
  const roofline = rooflineFromCsv(
    parsed.payloads['ArithmeticUtilization.csv'],
    parsed.payloads['Memory.csv'],
  );
  const hardwareDetails = hardwareDetailsFromParsed(parsed);
  const labelled = firstLabelledMemoryTopology(memory.tables);
  const memoryTopology = labelled?.model;
  const bandwidthCards = bandwidthCardsFromMemory(parsed.payloads['Memory.csv']);
  return {
    summary: summaryFromOpBasicInfo(parsed.payloads['OpBasicInfo.csv']),
    pipeOccupancy: pipeOccupancyFromCsv(parsed.payloads['PipeUtilization.csv']),
    overviewSeries: [],
    computeTables: compute.tables,
    memoryTables: memory.tables,
    csvTexts: { ...compute.texts, ...memory.texts },
    ...(bandwidthCards.length > 0 ? { bandwidthCards } : {}),
    ...(roofline ? { roofline } : {}),
    ...(hardwareDetails ? { hardwareDetails } : {}),
    ...(memoryTopology ? { memoryTopology } : {}),
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

/** HardwareInfo.jsonl categories (product source); else OpBasicInfo flat fields. */
function hardwareDetailsFromParsed(parsed: ParsedRep): HardwareDetailsModel | undefined {
  const jsonl = parsed.payloads['HardwareInfo.jsonl'];
  if (jsonl) {
    const sections = hardwareSectionsFromJsonl(decodeUtf8(jsonl));
    if (sections.length > 0) return { sections };
  }
  const op = parsed.payloads['OpBasicInfo.csv'];
  if (!op) return undefined;
  const { headers, rows } = parseCsv(decodeUtf8(op));
  const row = rows[0];
  if (!row) return undefined;
  const fields = headers
    .map((h) => ({ key: h, value: (row[h] ?? '').trim() }))
    .filter((f) => f.value !== '');
  if (fields.length === 0) return undefined;
  return {
    sections: [{ id: 'opBasicInfo', title: 'OpBasicInfo', fields }],
  };
}

function hardwareSectionsFromJsonl(text: string): HardwareSection[] {
  const sections: HardwareSection[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(lines[i]) as Record<string, unknown>;
    } catch {
      continue;
    }
    const category = String(obj.category ?? `section-${i}`);
    const fields = Object.entries(obj)
      .filter(([k]) => k !== 'category')
      .map(([key, value]) => ({
        key,
        value: value == null ? '' : Array.isArray(value) ? value.join(', ') : String(value),
      }))
      .filter((f) => f.value !== '');
    if (fields.length === 0) continue;
    sections.push({
      id: category.toLowerCase().replace(/\s+/g, '-'),
      title: category,
      fields,
    });
  }
  return sections;
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
  const swimlaneModel = swimlaneFromParsed(parsed, reportModel.pipeOccupancy);
  const capabilities: ReportCapability[] = [];
  if ((reportModel.roofline?.points.length ?? 0) > 0) capabilities.push('roofline');
  if (reportModel.hardwareDetails) capabilities.push('hardwareDetails');
  if (reportModel.memoryTopology) capabilities.push('memoryDiagram');
  if (hasDependencies(swimlaneModel)) capabilities.push('dependencies');
  return {
    swimlaneModel,
    reportModel,
    capabilities,
  };
}
