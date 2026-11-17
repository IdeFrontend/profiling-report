/**
 * Emulate Roofline view-model (DATA-57a).
 *
 * Prefer Roofline*.csv gated by AnalysisState `roofline` passed; fallback
 * `roofline.json`. Cross-product compute×bandwidth roofs to match the
 * producer HTML all-on set. Y/peaks: GOPS → TOps/s (/1000).
 */

import type { RooflinePoint, RooflineSeries, RooflineViewModel } from '../domain/types';
import { parseCsv } from './parseCsv';
import { ROOFLINE_SERIES_META, type RooflineSeriesId } from './roofline';

/** GOPS (producer PerformanceGFlops / PeakGFlops) → TOps/s. */
const GOPS_PER_TOPS = 1000;

const ANALYSIS_STATE_NAMES = ['AnalysisState.csv', 'analysisstate.csv'];
const POINTS_NAMES = ['RooflinePoints.csv', 'rooflinepoints.csv'];
const COMPUTE_PEAKS_NAMES = ['RooflineComputePeaks.csv', 'rooflinecomputepeaks.csv'];
const BANDWIDTH_PEAKS_NAMES = ['RooflineBandwidthPeaks.csv', 'rooflinebandwidthpeaks.csv'];
const JSON_NAMES = ['roofline.json', 'Roofline.json'];

/** HTML `Md` catalog order — first entry solid; later dashed. */
const MEMORY_LEVEL_ORDER = [
  'SIMD-UB',
  'SIMT-UB',
  'CUBE-L0',
  'SIMT-OUT',
  'CUBE-OUT',
] as const;

type MemoryLevel = (typeof MEMORY_LEVEL_ORDER)[number];

const MEMORY_LEVEL_DEBUG: Record<MemoryLevel, string> = {
  'SIMD-UB': 'SIMD',
  'SIMT-UB': 'SIMT',
  'CUBE-L0': 'L0',
  'SIMT-OUT': 'SIMT-OUT',
  'CUBE-OUT': 'CUBE-OUT',
};

const HTML_BW_KEY_TO_LEVEL: Record<string, MemoryLevel> = {
  peakBandwidthSIMD: 'SIMD-UB',
  peakBandwidthSIMT: 'SIMT-UB',
  peakBandwidthL0: 'CUBE-L0',
  peakBandwidthSIMT_OUT: 'SIMT-OUT',
  peakBandwidthCUBE_OUT: 'CUBE-OUT',
};

type DtypeFamily = {
  baseId: string;
  group: 'aiv' | 'aic';
  label: string;
  color: string;
};

/** Producer DataType / JSON arch key → legend family. */
const DTYPE_FAMILY: Record<string, DtypeFamily> = {
  fp16: {
    baseId: 'aiv-fp16',
    group: 'aiv',
    label: 'AIV fp16',
    color: ROOFLINE_SERIES_META['aiv-fp16'].color,
  },
  bf16: {
    baseId: 'aiv-bp16',
    group: 'aiv',
    label: 'AIV bp16',
    color: ROOFLINE_SERIES_META['aiv-bp16'].color,
  },
  fp32_aiv: {
    baseId: 'aiv-fp32',
    group: 'aiv',
    label: 'AIV fp32',
    color: ROOFLINE_SERIES_META['aiv-fp32'].color,
  },
  fp16_bf16: {
    baseId: 'aic-int16-fp16',
    group: 'aic',
    label: 'AIC int16 fp16',
    color: ROOFLINE_SERIES_META['aic-int16-fp16'].color,
  },
  fp32_aic: {
    baseId: 'aic-int32-fp32',
    group: 'aic',
    label: 'AIC int32 fp32',
    color: ROOFLINE_SERIES_META['aic-int32-fp32'].color,
  },
  int8_fp8: {
    baseId: 'aic-int8-fp8',
    group: 'aic',
    label: 'AIC int8 fp8',
    color: ROOFLINE_SERIES_META['aic-int8-fp8'].color,
  },
  tf32_hf32: {
    baseId: 'aic-tf32-hf32',
    group: 'aic',
    label: 'AIC tf32 hf32',
    color: '#9C27B0',
  },
};

const MODE_HEURISTIC: Record<string, RooflineSeriesId> = {
  SIMD: 'aiv-fp16',
  SIMT: 'aiv-bp16',
  CUBE: 'aic-int16-fp16',
};

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

function parseNumber(raw: string | undefined): number | undefined {
  if (raw == null || raw === '' || raw === 'NA') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Latest AnalysisState row for `roofline` must pass (DATA-57a). */
export function emulateRooflineAnalysisPassed(analysisStateCsv?: string): boolean {
  if (!analysisStateCsv) return false;
  const { rows } = parseCsv(analysisStateCsv);
  let passed: boolean | undefined;
  for (const row of rows) {
    const name = (row.AnalysisName ?? row.analysisname ?? '').trim();
    if (name.toLowerCase() !== 'roofline') continue;
    const raw = (row.AnalysisPassed ?? row.analysispassed ?? '').trim();
    passed = raw === '1' || raw.toLowerCase() === 'true';
  }
  return passed === true;
}

function normalizeMemoryLevel(raw: string): MemoryLevel | undefined {
  const t = raw.trim();
  if ((MEMORY_LEVEL_ORDER as readonly string[]).includes(t)) return t as MemoryLevel;
  const upper = t.toUpperCase();
  if (upper === 'SIMD' || upper === 'SIMD-UB') return 'SIMD-UB';
  if (upper === 'SIMT' || upper === 'SIMT-UB') return 'SIMT-UB';
  if (upper === 'L0' || upper === 'CUBE-L0') return 'CUBE-L0';
  if (upper === 'SIMT-OUT') return 'SIMT-OUT';
  if (upper === 'CUBE-OUT') return 'CUBE-OUT';
  return undefined;
}

function dtypeFamilyFor(unit: string, dataType: string): DtypeFamily | undefined {
  const u = unit.trim().toUpperCase();
  const dt = dataType.trim().toLowerCase();
  if (u === 'AIV') {
    if (dt === 'fp16') return DTYPE_FAMILY.fp16;
    if (dt === 'bf16') return DTYPE_FAMILY.bf16;
    if (dt === 'fp32') return DTYPE_FAMILY.fp32_aiv;
  }
  if (u === 'AIC') {
    if (dt === 'fp16_bf16' || dt === 'fp16/bf16') return DTYPE_FAMILY.fp16_bf16;
    if (dt === 'tf32_hf32' || dt === 'tf32/hf32') return DTYPE_FAMILY.tf32_hf32;
    if (dt === 'fp32') return DTYPE_FAMILY.fp32_aic;
    if (dt === 'int8_fp8' || dt === 'int8/fp8') return DTYPE_FAMILY.int8_fp8;
  }
  return undefined;
}

function jsonArchKeyToFamily(unit: string, key: string): DtypeFamily | undefined {
  const k = key.trim().toLowerCase();
  if (unit === 'AIV') {
    if (k === 'vector_fp16' || k === 'fp16') return DTYPE_FAMILY.fp16;
    if (k === 'vector_bf16' || k === 'bf16') return DTYPE_FAMILY.bf16;
    if (k === 'vector_fp32' || k === 'fp32') return DTYPE_FAMILY.fp32_aiv;
  }
  if (unit === 'AIC') {
    if (k === 'cube_fp16_bf16' || k === 'fp16_bf16') return DTYPE_FAMILY.fp16_bf16;
    if (k === 'cube_tf32_hf32' || k === 'tf32_hf32') return DTYPE_FAMILY.tf32_hf32;
    if (k === 'cube_fp32' || k === 'fp32') return DTYPE_FAMILY.fp32_aic;
    if (k === 'cube_int8_fp8' || k === 'int8_fp8') return DTYPE_FAMILY.int8_fp8;
  }
  return undefined;
}

function bwSuffix(level: MemoryLevel): string {
  return MEMORY_LEVEL_DEBUG[level].toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function shortFunctionName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'fn';
  const afterDot = trimmed.split('.').pop();
  if (afterDot && afterDot.length > 0 && afterDot.length < trimmed.length) return afterDot;
  if (trimmed.length <= 48) return trimmed;
  return `${trimmed.slice(0, 45)}…`;
}

function seriesFromFamily(
  family: DtypeFamily,
  level: MemoryLevel,
  peakGops: number,
  peakBandwidthGBs: number,
  levelIndex: number,
  multiBw: boolean,
): RooflineSeries {
  const debug = MEMORY_LEVEL_DEBUG[level];
  const id = multiBw ? `${family.baseId}-${bwSuffix(level)}` : family.baseId;
  const label = multiBw ? `${family.label} · ${debug}` : family.label;
  return {
    id,
    group: family.group,
    label,
    color: family.color,
    peakComputeTops: peakGops / GOPS_PER_TOPS,
    peakBandwidthGBs,
    slopeStyle: levelIndex === 0 ? 'solid' : 'dashed',
  };
}

function pointFromFields(args: {
  id: string;
  functionName: string;
  mode: string;
  unit: string;
  level: MemoryLevel;
  intensity: number;
  performanceGops: number;
}): RooflinePoint {
  const modeKey = args.mode.trim().toUpperCase();
  const seriesId = MODE_HEURISTIC[modeKey] ?? (args.unit.toUpperCase() === 'AIC' ? 'aic-int16-fp16' : 'aiv-fp16');
  const color = ROOFLINE_SERIES_META[seriesId].color;
  const debug = MEMORY_LEVEL_DEBUG[args.level];
  return {
    id: args.id,
    label: `${shortFunctionName(args.functionName)} - ${debug}`,
    intensity: args.intensity,
    performance: args.performanceGops / GOPS_PER_TOPS,
    style: 'solid',
    color,
    seriesId,
  };
}

function buildSeriesCrossProduct(
  computePeaks: { unit: string; dataType: string; peakGops: number }[],
  bandwidthPeaks: { unit: string; level: MemoryLevel; peakGBs: number }[],
): RooflineSeries[] {
  const bwByUnit = new Map<string, { level: MemoryLevel; peakGBs: number; index: number }[]>();
  for (const level of MEMORY_LEVEL_ORDER) {
    const index = MEMORY_LEVEL_ORDER.indexOf(level);
    for (const b of bandwidthPeaks) {
      if (b.level !== level) continue;
      const list = bwByUnit.get(b.unit) ?? [];
      list.push({ level: b.level, peakGBs: b.peakGBs, index });
      bwByUnit.set(b.unit, list);
    }
  }

  const series: RooflineSeries[] = [];
  for (const c of computePeaks) {
    const family = dtypeFamilyFor(c.unit, c.dataType);
    if (!family || !(c.peakGops > 0)) continue;
    const bws = bwByUnit.get(c.unit.toUpperCase()) ?? bwByUnit.get(c.unit) ?? [];
    if (bws.length === 0) continue;
    const multiBw = bws.length > 1;
    for (const b of bws) {
      if (!(b.peakGBs > 0)) continue;
      series.push(seriesFromFamily(family, b.level, c.peakGops, b.peakGBs, b.index, multiBw));
    }
  }
  return series;
}

function fromCsvTexts(args: {
  pointsCsv: string;
  computeCsv: string;
  bandwidthCsv: string;
}): RooflineViewModel | undefined {
  const pointsParsed = parseCsv(args.pointsCsv);
  const computeParsed = parseCsv(args.computeCsv);
  const bandwidthParsed = parseCsv(args.bandwidthCsv);

  const computePeaks: { unit: string; dataType: string; peakGops: number }[] = [];
  for (const row of computeParsed.rows) {
    const unit = (row.Unit ?? row.unit ?? '').trim();
    const dataType = (row.DataType ?? row.datatype ?? '').trim();
    const peakGops = parseNumber(row.PeakGFlops ?? row.peakgflops);
    if (!unit || !dataType || peakGops == null || !(peakGops > 0)) continue;
    computePeaks.push({ unit: unit.toUpperCase(), dataType, peakGops });
  }

  const bandwidthPeaks: { unit: string; level: MemoryLevel; peakGBs: number }[] = [];
  for (const row of bandwidthParsed.rows) {
    const unit = (row.Unit ?? row.unit ?? '').trim().toUpperCase();
    const level = normalizeMemoryLevel(row.MemoryLevel ?? row.memorylevel ?? '');
    const peakGBs = parseNumber(row.PeakGBs ?? row.peakgbs);
    if (!unit || !level || peakGBs == null || !(peakGBs > 0)) continue;
    bandwidthPeaks.push({ unit, level, peakGBs });
  }

  const series = buildSeriesCrossProduct(computePeaks, bandwidthPeaks);

  const points: RooflinePoint[] = [];
  for (const row of pointsParsed.rows) {
    const functionName = (row.FunctionName ?? row.functionname ?? '').trim();
    const mode = (row.ExecutionMode ?? row.executionmode ?? '').trim();
    const unit = (row.Unit ?? row.unit ?? '').trim();
    const level = normalizeMemoryLevel(row.MemoryLevel ?? row.memorylevel ?? '');
    const intensity = parseNumber(row.ArithmeticIntensity ?? row.arithmeticintensity);
    const performanceGops = parseNumber(row.PerformanceGFlops ?? row.performancegflops);
    const pc = (row.FunctionPC ?? row.functionpc ?? '').trim();
    if (!level || intensity == null || !(intensity > 0) || performanceGops == null || !(performanceGops > 0)) {
      continue;
    }
    points.push(
      pointFromFields({
        id: `${pc}:${mode}:${level}`,
        functionName: functionName || `pc${pc}`,
        mode,
        unit,
        level,
        intensity,
        performanceGops,
      }),
    );
  }

  if (points.length === 0) return undefined;
  return { points, mixLabels: [], series };
}

function fromRooflineJson(text: string): RooflineViewModel | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== 'object') return undefined;
  const root = parsed as Record<string, unknown>;
  const arch = root.architecture;
  const kernels = root.kernels;
  if (!arch || typeof arch !== 'object' || !kernels || typeof kernels !== 'object') return undefined;

  const computePeaks: { unit: string; dataType: string; peakGops: number }[] = [];
  const bandwidthPeaks: { unit: string; level: MemoryLevel; peakGBs: number }[] = [];
  const seenBw = new Set<string>();

  for (const unit of ['AIV', 'AIC'] as const) {
    const block = (arch as Record<string, unknown>)[unit];
    if (!block || typeof block !== 'object') continue;
    for (const [key, raw] of Object.entries(block as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object') continue;
      const m = raw as Record<string, unknown>;
      const family = jsonArchKeyToFamily(unit, key);
      if (!family) continue;
      const peakFlops = typeof m.peakFlops === 'number' ? m.peakFlops : Number(m.peakFlops);
      if (!(peakFlops > 0)) continue;
      const dataType =
        unit === 'AIV'
          ? key.replace(/^vector_/, '')
          : key.replace(/^cube_/, '');
      computePeaks.push({ unit, dataType, peakGops: peakFlops });
      for (const [bwKey, level] of Object.entries(HTML_BW_KEY_TO_LEVEL)) {
        const v = m[bwKey];
        const peakGBs = typeof v === 'number' ? v : Number(v);
        if (!(peakGBs > 0)) continue;
        const id = `${unit}:${level}`;
        if (seenBw.has(id)) continue;
        seenBw.add(id);
        bandwidthPeaks.push({ unit, level, peakGBs });
      }
    }
  }

  const series = buildSeriesCrossProduct(computePeaks, bandwidthPeaks);
  const points: RooflinePoint[] = [];
  for (const [name, raw] of Object.entries(kernels as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const k = raw as Record<string, unknown>;
    const intensity =
      typeof k.arithmetic_intensity === 'number' ? k.arithmetic_intensity : Number(k.arithmetic_intensity);
    const performanceGops = typeof k.performance === 'number' ? k.performance : Number(k.performance);
    if (!(intensity > 0) || !(performanceGops > 0)) continue;
    const label = typeof k.label === 'string' ? k.label : '';
    const unit = typeof k.unit === 'string' ? k.unit : '';
    const level = normalizeMemoryLevel(label) ?? (unit.toUpperCase() === 'AIC' ? 'CUBE-L0' : 'SIMD-UB');
    const mode =
      typeof k.label === 'string' && /CUBE|L0/i.test(k.label)
        ? 'CUBE'
        : typeof k.label === 'string' && /SIMT/i.test(k.label)
          ? 'SIMT'
          : 'SIMD';
    const pc = typeof k.pc === 'number' ? String(k.pc) : String(k.pc ?? name);
    const functionName = name.includes(' - ') ? name.slice(0, name.lastIndexOf(' - ')) : name;
    points.push(
      pointFromFields({
        id: `${pc}:${mode}:${level}`,
        functionName,
        mode,
        unit,
        level,
        intensity,
        performanceGops,
      }),
    );
  }

  if (points.length === 0) return undefined;
  return { points, mixLabels: [], series };
}

/**
 * Build emulate `RooflineViewModel` from leaf payloads.
 * Returns undefined when analysis failed/absent or no usable points (DATA-30 / DATA-57a).
 */
export function rooflineFromEmulatePayloads(
  payloads: Record<string, Uint8Array>,
): RooflineViewModel | undefined {
  const analysisBytes = payloadByName(payloads, ANALYSIS_STATE_NAMES);
  // When AnalysisState is packed, require a passing roofline row. Packs that
  // only ship roofline.json (no AnalysisState) still adapt via JSON fallback.
  if (analysisBytes && !emulateRooflineAnalysisPassed(decodeUtf8(analysisBytes))) {
    return undefined;
  }

  const pointsBytes = payloadByName(payloads, POINTS_NAMES);
  const computeBytes = payloadByName(payloads, COMPUTE_PEAKS_NAMES);
  const bandwidthBytes = payloadByName(payloads, BANDWIDTH_PEAKS_NAMES);

  if (pointsBytes && computeBytes && bandwidthBytes) {
    return fromCsvTexts({
      pointsCsv: decodeUtf8(pointsBytes),
      computeCsv: decodeUtf8(computeBytes),
      bandwidthCsv: decodeUtf8(bandwidthBytes),
    });
  }

  const jsonBytes = payloadByName(payloads, JSON_NAMES);
  if (jsonBytes) return fromRooflineJson(decodeUtf8(jsonBytes));
  return undefined;
}
