import type {
  AdaptedReport,
  BandwidthCardModel,
  BandwidthSideRow,
  ComputeCardModel,
  ComputeSideRow,
  CsvTableModel,
  HardwareDetailsModel,
  HardwareSection,
  OverviewSeries,
  ParsedRep,
  PipeOccupancyItem,
  ReportCapability,
  ReportViewModel,
  RooflineMixLabel,
  RooflineViewModel,
  SummaryCategory,
  SummaryMetrics,
  SwimlaneModel,
} from '../domain/types';
import { laneColorKey } from '../domain/laneColors';
import { hasDependencies } from '../domain/dependencies';
import { nestCardTreeFromFlatCorePipes } from '../domain/swimTree';
import { chromeTraceToSwimlane } from './chromeTraceToSwimlane';
import { buildMemoryTopologyFromCategories, firstLabelledMemoryTopology } from './memoryTopology';

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

/** DATA-5: SOL 1600 GB/s hardware peak shared by every bandwidth side (DATA-6). */
const BANDWIDTH_PEAK_GBS = 1600;

/** DATA-37d fallback when Memory BW columns are all NA. */
const ROOFLINE_PEAK_BW_FALLBACK_GBS = 100;
/** DATA-37d sketch-like compute plateau (TOps/s). */
const ROOFLINE_PEAK_COMPUTE_TOPS = 1;

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Case-insensitive payload lookup. The product `npu-rep` spec names embeds
 * `trace.json` / `summary.jsonl` / `sampling.json` (lowercase), but the shipped
 * sample uses `PipeTrace.json` / `Summary.jsonl` / `Sampling.json` (capital),
 * and `PipeTrace.json` replaces `trace.json` as the timeline source. This maps
 * any of the accepted spellings to the present payload.
 */
function payloadByName(
  payloads: Record<string, Uint8Array>,
  names: readonly string[],
): Uint8Array | undefined {
  for (const name of names) {
    const exact = payloads[name];
    if (exact) return exact;
  }
  const lower = new Map(
    Object.entries(payloads).map(([k, v]) => [k.toLowerCase(), v] as const),
  );
  for (const name of names) {
    const hit = lower.get(name.toLowerCase());
    if (hit) return hit;
  }
  return undefined;
}

/** `ai core count` / `AI Core Count` / `ai_core_count` → `ai_core_count` (space/underscore + case). */
function normalizeFieldKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
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
  payloads: Record<string, Uint8Array>,
  fileNames: readonly string[],
): { tables: CsvTableModel[]; texts: Record<string, string> } {
  const tables: CsvTableModel[] = [];
  const texts: Record<string, string> = {};
  for (const name of fileNames) {
    const payload = payloads[name];
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

function optionalText(raw: string | undefined): string | undefined {
  const v = raw?.trim();
  if (!v || v === 'NA') return undefined;
  return v;
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
 * Interim DATA-37a–e: GM roofline point + mix labels from ArithmeticUtilization + Memory.
 * Returns undefined when undecidable (DATA-37c L2 omitted).
 */
function rooflineFromCsv(
  arithPayload?: Uint8Array,
  memoryPayload?: Uint8Array,
): RooflineViewModel | undefined {
  if (!arithPayload || !memoryPayload) return undefined;
  const arithRows = parseCsv(decodeUtf8(arithPayload)).rows;
  const memRows = parseCsv(decodeUtf8(memoryPayload)).rows;
  return rooflineFromRows(arithRows, memRows);
}

/**
 * DATA-37 interim formulas over the given rows, so the same rule serves both selector scopes
 * (DATA-19 / DATA-29): `All` passes the `summary.jsonl` `ArithmeticUtilization` + `Memory` category
 * records, a picked block its CSV rows.
 */
export function rooflineFromRows(
  arithRows: Record<string, string>[],
  memRows: Record<string, string>[],
): RooflineViewModel | undefined {
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

/** DATA-8 fallback (classic `.rep`): per-side mean non-NA `Memory.csv` main-mem BW; peak = SOL 1600 GB/s. */
function bandwidthCardsFromMemory(payload?: Uint8Array): BandwidthCardModel[] {
  if (!payload) return [];
  const { rows } = parseCsv(decodeUtf8(payload));
  return bandwidthCardsPerSideFromRows(rows);
}

/** Per-side cards (`aic` + `aiv` rows) — the classic `.rep` shape, kept for the `Memory.csv` fallback. */
function bandwidthCardsPerSideFromRows(rows: Record<string, string>[]): BandwidthCardModel[] {
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

/**
 * DATA-8 / DATA-19: one block's I/O bandwidth from its `Memory.csv` row. Read / write = that row's
 * aic + aiv sides **summed**, exactly as the producer sums them into `OpInfoSummary`, peak = SOL.
 * Emits a single `aicore` side so the UI's per-direction `reduce` stays a no-op (no double count).
 */
export function bandwidthCardsFromRows(
  rows: Record<string, string>[],
  peakGBs: number = BANDWIDTH_PEAK_GBS,
): BandwidthCardModel[] {
  if (rows.length === 0) return [];
  const cards: BandwidthCardModel[] = [];
  for (const id of ['input', 'output'] as const) {
    let sum: number | undefined;
    for (const col of [...BANDWIDTH_COLUMNS[id].aic, ...BANDWIDTH_COLUMNS[id].aiv]) {
      const v = meanFamily(rows, [col]);
      if (v != null) sum = (sum ?? 0) + v;
    }
    if (sum != null) cards.push({ id, sides: [{ side: 'aicore', measuredGBs: sum, peakGBs }] });
  }
  return cards;
}

/** ponytail: FP16 dtype until op dtype is in CSV (DATA-2 cube peak formula). */
const COMPUTE_DTYPE_BYTES_DEFAULT = 2;

interface HardwareComputeInputs {
  cubeCores?: number;
  vectorCores?: number;
  freqMhz?: number;
}

function numericFieldsFromJsonObject(obj: Record<string, unknown>): Record<string, number> {
  const fields: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj)) {
    const norm = normalizeFieldKey(key);
    if (norm === 'category') continue;
    const raw = Array.isArray(value) && value.length > 0 ? value[0] : value;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(n)) fields[norm] = n;
  }
  return fields;
}

function hardwareComputeInputsFromJsonl(text: string): HardwareComputeInputs {
  const out: HardwareComputeInputs = {};
  for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (!normalizeFieldKey(String(obj.category ?? '')).includes('ai_core')) continue;
    const fields = numericFieldsFromJsonObject(obj);
    out.cubeCores = pickPositiveField(fields, ['ai_cube_count', 'aic_cube_count']);
    out.vectorCores = pickPositiveField(fields, ['ai_vector_count', 'aic_vector_count']);
    const freq =
      pickPositiveField(fields, [
        'ai_core_frequency_mhz',
        'ai_cube_frequency_mhz',
        'ai_vector_frequency_mhz',
        'aic_core_frequency_mhz',
      ]) ?? undefined;
    if (freq != null) out.freqMhz = freq;
  }
  return out;
}

function measuredTflopsForSide(
  rows: Record<string, string>[],
  side: ComputeSideRow['side'],
): number | undefined {
  const fopsCols = side === 'aic' ? ['aic_cube_fops'] : ['aiv_vec_fops'];
  const timeCols = side === 'aic' ? ['aic_time(us)'] : ['aiv_time(us)'];
  const fops = meanFamily(rows, fopsCols);
  const timeUs = meanFamily(rows, timeCols);
  if (fops == null || timeUs == null || !(timeUs > 0)) return undefined;
  return fops / timeUs / 1e6;
}

function peakTflopsForSide(
  side: ComputeSideRow['side'],
  hw: HardwareComputeInputs,
  summary: SummaryMetrics,
): number | undefined {
  // ponytail: OpBasicInfo Rated/Current Freq treated as MHz (same as ai_core_frequency_MHZ).
  // Units unconfirmed — if reports emit Hz/GHz, peak is off by 1000× (DATA-3). Prefer jsonl MHZ.
  const freqMhz = hw.freqMhz ?? summary.ratedFreq ?? summary.currentFreq;
  if (freqMhz == null || !(freqMhz > 0)) return undefined;
  const freqGhz = freqMhz / 1000;
  if (side === 'aic') {
    const cores = hw.cubeCores;
    if (cores == null || !(cores > 0)) return undefined;
    return (16 * COMPUTE_DTYPE_BYTES_DEFAULT * 16 * cores * freqGhz * 2) / 1000;
  }
  const cores = hw.vectorCores;
  if (cores == null || !(cores > 0)) return undefined;
  return (128 * cores * freqGhz * 2) / 1000;
}


/** Product OpInfoSummary → computeCard sides (measured/theoretical TFLOPS). */
function computeCardFromSummaryMetrics(summary: SummaryMetrics): ComputeCardModel | undefined {
  const sides: ComputeSideRow[] = [];
  if (
    summary.aicFlops != null &&
    summary.aicFlopsTheoretical != null &&
    summary.aicFlopsTheoretical > 0
  ) {
    sides.push({
      side: 'aic',
      measuredTflops: summary.aicFlops,
      peakTflops: summary.aicFlopsTheoretical,
    });
  }
  if (
    summary.aivFlops != null &&
    summary.aivFlopsTheoretical != null &&
    summary.aivFlopsTheoretical > 0
  ) {
    sides.push({
      side: 'aiv',
      measuredTflops: summary.aivFlops,
      peakTflops: summary.aivFlopsTheoretical,
    });
  }
  return sides.length > 0 ? { sides } : undefined;
}

/** DATA-2..4 / UI-33: ArithmeticUtilization measured + HardwareInfo peak per aic/aiv side. */
function computeCardFromPayloads(
  arithPayload: Uint8Array | undefined,
  hwPayload: Uint8Array | undefined,
  summary: SummaryMetrics,
): ComputeCardModel | undefined {
  if (!arithPayload) return undefined;
  const { rows } = parseCsv(decodeUtf8(arithPayload));
  if (rows.length === 0) return undefined;
  const hw = hwPayload ? hardwareComputeInputsFromJsonl(decodeUtf8(hwPayload)) : {};
  const sides: ComputeSideRow[] = [];
  for (const side of ['aic', 'aiv'] as const) {
    const measuredTflops = measuredTflopsForSide(rows, side);
    const peakTflops = peakTflopsForSide(side, hw, summary);
    if (measuredTflops == null || peakTflops == null || !(peakTflops > 0)) continue;
    sides.push({ side, measuredTflops, peakTflops });
  }
  return sides.length > 0 ? { sides } : undefined;
}

/**
 * DATA-19 / DATA-29: one block's compute card — measured from that block's `ArithmeticUtilization.csv`
 * row, peak from the chip-level theoretical FLOPS in `OpInfoSummary` (a peak is per-chip, not per block;
 * `peakFallback` carries the All card's peak for a classic `.rep` with no `OpInfoSummary`).
 */
export function computeCardFromRows(
  arithRows: Record<string, string>[],
  summary: SummaryMetrics,
  peakFallback?: ComputeCardModel,
): ComputeCardModel | undefined {
  if (arithRows.length === 0) return undefined;
  const sides: ComputeSideRow[] = [];
  for (const side of ['aic', 'aiv'] as const) {
    const measuredTflops = measuredTflopsForSide(arithRows, side);
    // Peak is per-chip, not per block, so a classic `.rep` (no OpInfoSummary) may take it from
    // the All card built out of HardwareInfo peaks.
    const peakTflops =
      (side === 'aic' ? summary.aicFlopsTheoretical : summary.aivFlopsTheoretical) ??
      peakFallback?.sides.find((s) => s.side === side)?.peakTflops;
    if (measuredTflops == null || peakTflops == null || !(peakTflops > 0)) continue;
    sides.push({ side, measuredTflops, peakTflops });
  }
  return sides.length > 0 ? { sides } : undefined;
}

/**
 * Product bandwidth cards from `summary.jsonl` (DATA-8): `OpInfoSummary` provides the SOL peak
 * (`aicore_gm_bw_theoretical(GB/s)`, default 1600) and the aic + aiv sides already **summed**
 * (`aicore_gm_read_bw` / `aicore_gm_write_bw`). The `Memory` per-side columns are the classic
 * `.rep` fallback. Falls back to the `Memory.csv` path when `summary.jsonl` is absent.
 */
function bandwidthCardsFromSummary(payload?: Uint8Array): BandwidthCardModel[] {
  if (!payload) return [];
  let peakGBs = BANDWIDTH_PEAK_GBS;
  const mem: Record<string, number> = {};
  const stripUnit = (key: string): string => key.replace(/\([^)]*\)/g, '');
  for (const line of decodeUtf8(payload).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const category = obj.category;
    if (category === 'OpInfoSummary') {
      const peak = typeof obj['aicore_gm_bw_theoretical(GB/s)'] === 'number'
        ? (obj['aicore_gm_bw_theoretical(GB/s)'] as number)
        : Number(obj['aicore_gm_bw_theoretical(GB/s)']);
      if (Number.isFinite(peak) && peak > 0) peakGBs = peak;
      for (const key of ['aicore_gm_read_bw(GB/s)', 'aicore_gm_write_bw(GB/s)']) {
        const n = typeof obj[key] === 'number' ? (obj[key] as number) : Number(obj[key]);
        if (Number.isFinite(n)) mem[stripUnit(key)] = n;
      }
      continue;
    }
    if (category !== 'Memory') continue;
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'category') continue;
      const n = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(n)) mem[stripUnit(key)] = n;
    }
  }

  const side = (
    sideKind: BandwidthSideRow['side'],
    keys: readonly string[],
  ): BandwidthSideRow | undefined => {
    for (const k of keys) {
      const v = mem[k];
      if (v != null) return { side: sideKind, measuredGBs: v, peakGBs };
    }
    return undefined;
  };

  const cards: BandwidthCardModel[] = [];
  /**
   * DATA-8: `OpInfoSummary.aicore_gm_read_bw` / `aicore_gm_write_bw` publish the aic + aiv sides
   * already summed — read them directly so the viewer cannot drift from the producer. Fall back to
   * the two `Memory` per-side columns when the category does not carry the summed field (classic `.rep`).
   */
  const direction = (combinedKey: string, aicKey: string, aivKey: string): BandwidthSideRow[] => {
    const sum = mem[combinedKey];
    if (sum != null) return [{ side: 'aicore', measuredGBs: sum, peakGBs }];
    return [side('aic', [aicKey]), side('aiv', [aivKey])].filter(
      (row): row is BandwidthSideRow => row != null,
    );
  };
  const input = direction('aicore_gm_read_bw', 'aic_main_mem_read_bw', 'aiv_main_mem_read_bw');
  const output = direction('aicore_gm_write_bw', 'aic_main_mem_write_bw', 'aiv_main_mem_write_bw');
  if (input.length > 0) cards.push({ id: 'input', sides: input });
  if (output.length > 0) cards.push({ id: 'output', sides: output });
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
    pid: optionalText(row['Pid']) ?? optionalText(row['PID']),
    blockDim: (() => {
      const raw = row['Block Dim']?.trim();
      if (!raw || raw === 'NA') return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    })(),
  };
}

/**
 * Product `npu-rep` summary source: `Summary.jsonl`. Op identity lives in the
 * `OpInfoSummary` category (same field names as `OpBasicInfo.csv`, but JSON
 * typed values with `null` for absent fields), plus the derived compute /
 * bandwidth / utilization fields computed by `summarize_npu_rep.py`.
 */
function summaryFromSummaryJsonl(payload?: Uint8Array): SummaryMetrics {
  if (!payload) return {};
  for (const line of decodeUtf8(payload).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (obj.category !== 'OpInfoSummary') continue;

    const text = (v: unknown): string | undefined => {
      if (v == null) return undefined;
      const s = String(v).trim();
      return s === '' ? undefined : s;
    };
    const num = (v: unknown): number | undefined => {
      if (v == null) return undefined;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    return {
      opName: text(obj['Op Name']),
      opType: text(obj['Op Type']),
      taskDurationUs: num(obj['Task Duration(us)']),
      currentFreq: num(obj['Current Freq']),
      ratedFreq: num(obj['Rated Freq']),
      pid: text(obj['Pid']),
      blockDim: num(obj['Block Dim']) ?? text(obj['Block Dim']),
      // Derived compute / bandwidth / utilization (absent when the producer did not emit them).
      aicFlops: num(obj['aic_flops']),
      aivFlops: num(obj['aiv_flops']),
      aicFlopsTheoretical: num(obj['aic_flops_theoretical']),
      aivFlopsTheoretical: num(obj['aiv_flops_theoretical']),
      gmBwTheoreticalGBs: num(obj['aicore_gm_bw_theoretical(GB/s)']),
      gmReadBw: num(obj['aicore_gm_read_bw(GB/s)']),
      gmWriteBw: num(obj['aicore_gm_write_bw(GB/s)']),
      gmBwUsageRate: num(obj['aicore_gm_bw_usage_rate(%)']),
      parallelUtilization: num(obj['aicore_parallel_utilization']),
      parallelBalance: num(obj['aicore_parallel_balance']),
    };
  }
  return {};
}

/** Metric categories surfaced by the detail panels (summary.jsonl). */
export const SUMMARY_COMPUTE_CATEGORIES = ['PipeUtilization', 'ArithmeticUtilization', 'ResourceConflictRatio'] as const;
export const SUMMARY_MEMORY_CATEGORIES = ['MemoryL0', 'L2Cache', 'Memory', 'MemoryUB'] as const;

/**
 * Product `npu-rep` detail source: `Summary.jsonl` category lines (block-mean,
 * per spec "默认显示 summary.jsonl 分组数据"). OpInfoSummary is excluded (it is
 * the summary card, not a detail group).
 */
function summaryCategoriesFromSummaryJsonl(payload?: Uint8Array): SummaryCategory[] {
  if (!payload) return [];
  const seen = new Set<string>();
  const categories: SummaryCategory[] = [];
  for (const line of decodeUtf8(payload).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const category = typeof obj.category === 'string' ? obj.category : undefined;
    if (!category || category === 'OpInfoSummary') continue;
    if (seen.has(category)) continue;
    seen.add(category);

    const fields = Object.entries(obj)
      .filter(([k]) => k !== 'category')
      .map(([key, value]) => ({ key, value: value == null ? '' : String(value) }))
      .filter((f) => f.value !== '');
    if (fields.length === 0) continue;
    categories.push({ id: category, title: category, fields });
  }
  return categories;
}

/** DATA-1: numeric fields from HardwareInfo.jsonl. Keys normalized so `ai core count` / `ai_core_count` resolve alike. */
function hardwareNumericFieldsFromJsonl(text: string): Record<string, number> {
  const fields: Record<string, number> = {};
  for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    for (const [key, value] of Object.entries(obj)) {
      const norm = normalizeFieldKey(key);
      if (norm === 'category') continue;
      const n = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(n)) fields[norm] = n;
    }
  }
  return fields;
}

function pickPositiveField(fields: Record<string, number>, keys: string[]): number | undefined {
  for (const key of keys) {
    const n = fields[key];
    if (n != null && n > 0) return n;
  }
  return undefined;
}

/** DATA-1: core count for duration bar / secondary from op type + HardwareInfo.jsonl. */
function coreCountForOpType(fields: Record<string, number>, opType?: string): number | undefined {
  const t = (opType ?? '').trim().toLowerCase();
  if (t === 'mix') return pickPositiveField(fields, ['ai_core_count', 'aic_core_count']);
  if (t.includes('vector') || t.includes('aiv') || t.includes('vec')) {
    return pickPositiveField(fields, ['ai_vector_count', 'aic_vector_count']);
  }
  if (t.includes('cube') || t.includes('aic')) {
    return pickPositiveField(fields, ['ai_cube_count', 'aic_cube_count']);
  }
  return undefined;
}

function summaryWithHardwareCoreCount(
  summary: SummaryMetrics,
  payloads: Record<string, Uint8Array>,
): SummaryMetrics {
  const jsonl = payloadByName(payloads, ['HardwareInfo.jsonl', 'hardwareinfo.jsonl']);
  if (!jsonl) return summary;
  const coreCount = coreCountForOpType(
    hardwareNumericFieldsFromJsonl(decodeUtf8(jsonl)),
    summary.opType,
  );
  return coreCount == null ? summary : { ...summary, coreCount };
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

/**
 * DATA-28 / DATA-19: mean non-NA ratios (and times) over the given PipeUtilization rows.
 * `All` passes the `summary.jsonl` category record; a picked block its `PipeUtilization.csv` row.
 */
export function pipeOccupancyFromRows(rows: Record<string, string>[]): PipeOccupancyItem[] {
  if (rows.length === 0) return [];
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

function pipeOccupancyFromCsv(payload?: Uint8Array): PipeOccupancyItem[] {
  if (!payload) return [];
  return pipeOccupancyFromRows(parseCsv(decodeUtf8(payload)).rows);
}

/**
 * DATA-19 / DATA-28 / DATA-29: a `summary.jsonl` category record as a CSV-shaped row, so the row-based
 * builders (`pipeOccupancyFromRows`, `rooflineFromRows`, `computeCardFromRows`) serve the `All` scope
 * with the producer's own non-`NA` mean instead of a second aggregation implemented here.
 */
export function categoryRow(category: SummaryCategory): Record<string, string> {
  const row: Record<string, string> = {};
  for (const f of category.fields) row[f.key] = f.value;
  return row;
}

/** Rows for one `summary.jsonl` category id (the `All` scope of DATA-19 / DATA-29). */
export function summaryCategoryRows(
  categories: SummaryCategory[] | undefined,
  id: string,
): Record<string, string>[] {
  const category = categories?.find((c) => c.id === id);
  return category ? [categoryRow(category)] : [];
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

/** Product Sampling.json `ts` is µs (same as PipeTrace); swimlane / overview use ns. */
const SAMPLING_US_TO_NS = 1e3;

/**
 * DATA-39: one OverviewSeries per distinct Chrome Trace `ph:"C"` counter name in Sampling.json.
 * Empty when payload missing, invalid JSON, or no usable counters.
 */
export function overviewSeriesFromSampling(payload: Uint8Array | undefined): OverviewSeries[] {
  if (!payload) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeUtf8(payload)) as unknown;
  } catch {
    return [];
  }
  const events: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { traceEvents?: unknown }).traceEvents)
      ? ((parsed as { traceEvents: unknown[] }).traceEvents)
      : [];
  const byName = new Map<string, { t: number; v: number }[]>();
  const order: string[] = [];
  for (const raw of events) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as {
      ph?: string;
      name?: string;
      ts?: number;
      args?: { value?: unknown };
    };
    if (e.ph !== 'C' || typeof e.name !== 'string' || e.name.length === 0) continue;
    const rawV = e.args?.value;
    // DATA-39: finite numeric args.value only — Number(null)===0 must not invent a sample.
    if (typeof rawV !== 'number' || !Number.isFinite(rawV)) continue;
    const ts = Number(e.ts);
    if (!Number.isFinite(ts)) continue;
    let points = byName.get(e.name);
    if (!points) {
      points = [];
      byName.set(e.name, points);
      order.push(e.name);
    }
    points.push({ t: ts * SAMPLING_US_TO_NS, v: rawV });
  }
  const series: OverviewSeries[] = [];
  for (const name of order) {
    const points = byName.get(name)!;
    if (points.length === 0) continue;
    points.sort((a, b) => a.t - b.t);
    series.push({ id: name, label: name, points });
  }
  return series;
}

function reportModelFromPayloads(payloads: Record<string, Uint8Array>): ReportViewModel {
  const compute = collectCsvTables(payloads, COMPUTE_CSV_FILES);
  const memory = collectCsvTables(payloads, MEMORY_CSV_FILES);
  const hardwareDetails = hardwareDetailsFromPayloads(payloads);
  const summaryJsonl = payloadByName(payloads, ['summary.jsonl', 'Summary.jsonl', 'SUMMARY.jsonl']);
  const summaryCategories = summaryCategoriesFromSummaryJsonl(summaryJsonl);
  // DATA-19 / DATA-29 `All` scope: PIPE, roofline and the memory diagram read the summary.jsonl
  // category records, so every widget shares the producer's own non-`NA` mean; the CSV means stay
  // as the classic-`.rep` fallback (no `summary.jsonl` ⇒ no aggregate exists).
  const roofline =
    rooflineFromRows(
      summaryCategoryRows(summaryCategories, 'ArithmeticUtilization'),
      summaryCategoryRows(summaryCategories, 'Memory'),
    ) ??
    rooflineFromCsv(
      payloadByName(payloads, ['ArithmeticUtilization.csv']),
      payloadByName(payloads, ['Memory.csv']),
    );
  const memoryTopology =
    buildMemoryTopologyFromCategories(summaryCategories) ??
    firstLabelledMemoryTopology(memory.tables)?.model;
  const bandwidthCards = summaryJsonl
    ? bandwidthCardsFromSummary(summaryJsonl)
    : bandwidthCardsFromMemory(payloadByName(payloads, ['Memory.csv']));
  // Identity prefers OpBasicInfo.csv when present; Product derived FLOPS / BW /
  // parallel util always overlay from Summary.jsonl OpInfoSummary (review: do not
  // drop jsonl metrics when both embeds exist).
  const fromCsv = summaryFromOpBasicInfo(payloadByName(payloads, ['OpBasicInfo.csv']));
  const fromJsonl = summaryFromSummaryJsonl(summaryJsonl);
  const hasCsvIdentity = Object.keys(fromCsv).length > 0;
  const summary = summaryWithHardwareCoreCount(
    {
      ...(hasCsvIdentity ? fromCsv : fromJsonl),
      aicFlops: fromJsonl.aicFlops,
      aivFlops: fromJsonl.aivFlops,
      aicFlopsTheoretical: fromJsonl.aicFlopsTheoretical,
      aivFlopsTheoretical: fromJsonl.aivFlopsTheoretical,
      gmBwTheoreticalGBs: fromJsonl.gmBwTheoreticalGBs,
      gmReadBw: fromJsonl.gmReadBw,
      gmWriteBw: fromJsonl.gmWriteBw,
      gmBwUsageRate: fromJsonl.gmBwUsageRate,
      parallelUtilization: fromJsonl.parallelUtilization,
      parallelBalance: fromJsonl.parallelBalance,
    },
    payloads,
  );
  // Prefer Product OpInfoSummary FLOPS when present; else interim ArithmeticUtilization.
  const computeCard =
    computeCardFromSummaryMetrics(summary) ??
    computeCardFromPayloads(
      payloadByName(payloads, ['ArithmeticUtilization.csv']),
      payloadByName(payloads, ['HardwareInfo.jsonl', 'hardwareinfo.jsonl']),
      summary,
    );
  return {
    summary,
    pipeOccupancy: (() => {
      // DATA-19 / DATA-28 / DATA-29 `All` scope: summary.jsonl `PipeUtilization` is the producer's
      // non-NA mean across `block_id`; the CSV mean stays as the classic-`.rep` fallback.
      const fromSummary = pipeOccupancyFromRows(
        summaryCategoryRows(summaryCategories, 'PipeUtilization'),
      );
      return fromSummary.length > 0
        ? fromSummary
        : pipeOccupancyFromCsv(payloadByName(payloads, ['PipeUtilization.csv']));
    })(),
    overviewSeries: overviewSeriesFromSampling(
      payloadByName(payloads, ['Sampling.json', 'sampling.json']),
    ),
    computeTables: compute.tables,
    memoryTables: memory.tables,
    csvTexts: { ...compute.texts, ...memory.texts },
    ...(bandwidthCards.length > 0 ? { bandwidthCards } : {}),
    ...(computeCard ? { computeCard } : {}),
    ...(roofline ? { roofline } : {}),
    ...(hardwareDetails ? { hardwareDetails } : {}),
    ...(memoryTopology ? { memoryTopology } : {}),
    ...(summaryCategories.length > 0 ? { summaryCategories } : {}),
  };
}

/** Empty analytics model for Chrome Trace–only loads (PROC-3). */
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
function hardwareDetailsFromPayloads(payloads: Record<string, Uint8Array>): HardwareDetailsModel | undefined {
  const jsonl = payloadByName(payloads, ['HardwareInfo.jsonl', 'hardwareinfo.jsonl']);
  if (jsonl) {
    const sections = hardwareSectionsFromJsonl(decodeUtf8(jsonl));
    if (sections.length > 0) return { sections };
  }
  const op = payloadByName(payloads, ['OpBasicInfo.csv']);
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
function swimlaneFromPayloads(
  payloads: Record<string, Uint8Array>,
  pipes: PipeOccupancyItem[],
): SwimlaneModel | null {
  // Two timeline sources, two units:
  //  - `trace.json` (classic `.rep`) stores genuine nanoseconds (Ascend producer convention).
  //  - `PipeTrace.json` (product `npu-rep`) stores microseconds despite its
  //    `displayTimeUnit: "ns"` label — verified: every ts/dur × the 1650 MHz rated
  //    frequency is an exact integer cycle count.
  const traceJson = payloadByName(payloads, ['trace.json']);
  const pipeTraceJson = payloadByName(payloads, ['PipeTrace.json', 'pipetrace.json']);
  const isPipeTrace = traceJson == null && pipeTraceJson != null;
  const bytes = traceJson ?? pipeTraceJson;
  if (!bytes) {
    // Metrics-only pack: no timeline source. Return null so the caller renders
    // the aside without a swimlane instead of hard-erroring (VIEW_DATA_REQUIREMENTS).
    return null;
  }
  let trace: unknown;
  try {
    trace = JSON.parse(decodeUtf8(bytes)) as unknown;
  } catch (cause) {
    const embedName =
      (isPipeTrace
        ? Object.keys(payloads).find((k) => k.toLowerCase() === 'pipetrace.json')
        : Object.keys(payloads).find((k) => k.toLowerCase() === 'trace.json')) ??
      (isPipeTrace ? 'PipeTrace.json' : 'trace.json');
    throw new Error(`[profiling-report] adaptRep: ${embedName} is not valid JSON`, { cause });
  }
  const model = chromeTraceToSwimlane(trace, { sourceTimeUnit: isPipeTrace ? 'us' : 'ns' });
  // Util on flat names first (`laneColorKey` uses Core.*/PIPE suffix); nest keeps leaf util.
  // Nesting is producer opt-in (`nestCardTree` in trace.json) — never invent for arbitrary .rep.
  const withUtil = withPipeLaneUtilizations(model, pipes);
  return model.metadata?.nestCardTree === true
    ? nestCardTreeFromFlatCorePipes(withUtil)
    : withUtil;
}

/** Map parsed `.rep` embeds → swimlane + report view-models. */
export function adaptRep(parsed: ParsedRep): AdaptedReport {
  return adaptPayloads(parsed.payloads);
}

/** Map raw payloads (any container: `cann-rep` leaf or `npu-rep` leaf) → swimlane + report. */
export function adaptPayloads(payloads: Record<string, Uint8Array>): AdaptedReport {
  const reportModel = reportModelFromPayloads(payloads);
  const swimlaneModel = swimlaneFromPayloads(payloads, reportModel.pipeOccupancy);
  const capabilities: ReportCapability[] = [];
  if ((reportModel.roofline?.points.length ?? 0) > 0) capabilities.push('roofline');
  if (reportModel.hardwareDetails) capabilities.push('hardwareDetails');
  if (reportModel.memoryTopology) capabilities.push('memoryDiagram');
  if (swimlaneModel && hasDependencies(swimlaneModel)) capabilities.push('dependencies');
  return {
    swimlaneModel,
    reportModel,
    capabilities,
  };
}
