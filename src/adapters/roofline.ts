/**
 * Roofline view-model builder (npu-compute §11.8).
 *
 * Prefer `HardwareInfo.jsonl` category `Roofline` series (`p_peak`, `b_peak`, `w`, `t`, `q`).
 * Otherwise: theoretical roofs from §11.8.1 (HardwareInfo counts + freq, or product example
 * ceilings) plus a measured GM point from ArithmeticUtilization + Memory.
 */

import type {
  RooflineMixLabel,
  RooflinePoint,
  RooflineSeries,
  RooflineViewModel,
} from '../domain/types';

/** Product default peak bandwidth (GB/s) = 1.6 T/s (§11.8.1). */
export const ROOFLINE_B_PEAK_GBS = 1600;

/** Ops/s → TOps/s. */
const OPS_PER_TOPS = 1e12;

/** MHz × MACs/cycle → TOps/s. The §11.8.1 print form `/ 1000` is 1000× this axis. */
const MHZ_MAC_TO_TOPS = 1e6;

export type RooflineSeriesId =
  | 'aiv-fp16'
  | 'aiv-bp16'
  | 'aiv-fp32'
  | 'aic-int16-fp16'
  | 'aic-int32-fp32'
  | 'aic-fp32'
  | 'aic-int8-fp8';

/** Screenshot legend + colors (tabs omitted). */
export const ROOFLINE_SERIES_META: Record<
  RooflineSeriesId,
  { group: 'aiv' | 'aic'; label: string; color: string; slopeStyle: 'solid' | 'dashed' }
> = {
  'aiv-fp16': { group: 'aiv', label: 'AIV fp16', color: '#8C78F0', slopeStyle: 'solid' },
  'aiv-bp16': { group: 'aiv', label: 'AIV bp16', color: '#E63C82', slopeStyle: 'dashed' },
  'aiv-fp32': { group: 'aiv', label: 'AIV fp32', color: '#32BE8C', slopeStyle: 'solid' },
  'aic-int16-fp16': {
    group: 'aic',
    label: 'AIC int16 fp16',
    color: '#E53935',
    slopeStyle: 'solid',
  },
  'aic-int32-fp32': {
    group: 'aic',
    label: 'AIC int32 fp32',
    color: '#4C8DFF',
    slopeStyle: 'dashed',
  },
  'aic-fp32': { group: 'aic', label: 'AIC fp32', color: '#B4E04A', slopeStyle: 'solid' },
  'aic-int8-fp8': {
    group: 'aic',
    label: 'AIC int8 fp8',
    color: '#F0A020',
    slopeStyle: 'dashed',
  },
};

/** Map producer Roofline JSON keys → legend series. */
const JSON_KEY_TO_SERIES: Record<string, RooflineSeriesId> = {
  aiv_simd_b16: 'aiv-fp16',
  aiv_simt_b16: 'aiv-bp16',
  aiv_simd_b32: 'aiv-fp32',
  aiv_simt_b32: 'aiv-fp32',
  aiv_simd_b8: 'aiv-fp16',
  aiv_simt_b8: 'aiv-bp16',
  aic_b16: 'aic-int16-fp16',
  aic_b32: 'aic-int32-fp32',
  aic_b8: 'aic-int8-fp8',
};

/** §11.8.2 example ceilings (ops/s → TOps/s) when HardwareInfo counts are absent. */
const EXAMPLE_PEAK_TOPS: Record<RooflineSeriesId, { peakComputeTops: number; peakBandwidthGBs: number }> =
  {
    'aiv-fp16': { peakComputeTops: 27033600000000 / OPS_PER_TOPS, peakBandwidthGBs: 1600 },
    'aiv-bp16': { peakComputeTops: 13516800000000 / OPS_PER_TOPS, peakBandwidthGBs: 800 },
    'aiv-fp32': { peakComputeTops: 13516800000000 / OPS_PER_TOPS, peakBandwidthGBs: 1600 },
    'aic-int16-fp16': { peakComputeTops: 432537600000000 / OPS_PER_TOPS, peakBandwidthGBs: 800 },
    'aic-int32-fp32': { peakComputeTops: 27033600000000 / OPS_PER_TOPS, peakBandwidthGBs: 1600 },
    'aic-fp32': { peakComputeTops: 27033600000000 / OPS_PER_TOPS, peakBandwidthGBs: 1600 },
    'aic-int8-fp8': { peakComputeTops: 865075200000000 / OPS_PER_TOPS, peakBandwidthGBs: 1600 },
  };

const VEC_MIX: { id: string; label: string; column: string; seriesId: RooflineSeriesId }[] = [
  { id: 'fp32', label: 'Vec_FP32', column: 'aiv_vec_fp32_ratio', seriesId: 'aiv-fp32' },
  { id: 'fp16', label: 'Vec_FP16', column: 'aiv_vec_fp16_ratio', seriesId: 'aiv-fp16' },
  { id: 'int32', label: 'Vec_INT32', column: 'aiv_vec_int32_ratio', seriesId: 'aiv-fp32' },
  { id: 'int16', label: 'Vec_INT16', column: 'aiv_vec_int16_ratio', seriesId: 'aiv-fp16' },
  { id: 'misc', label: 'Vec_MISC', column: 'aiv_vec_misc_ratio', seriesId: 'aiv-fp32' },
];

const CUBE_MIX: { id: string; label: string; column: string; seriesId: RooflineSeriesId }[] = [
  { id: 'fp16', label: 'Cube_FP16', column: 'aic_cube_fp16_ratio', seriesId: 'aic-int16-fp16' },
  { id: 'int8', label: 'Cube_INT8', column: 'aic_cube_int8_ratio', seriesId: 'aic-int8-fp8' },
];

type CsvRows = Record<string, string>[];

function parseNumber(raw: string | undefined): number | undefined {
  if (raw == null || raw === '' || raw === 'NA') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function meanFamily(rows: CsvRows, columns: readonly string[]): number | undefined {
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

function mixLabelsFromRows(
  rows: CsvRows,
  defs: { id: string; label: string; column: string; seriesId: RooflineSeriesId }[],
): { labels: RooflineMixLabel[]; dominantSeriesId: RooflineSeriesId } {
  const parts: { id: string; label: string; value: number; seriesId: RooflineSeriesId }[] = [];
  for (const d of defs) {
    const v = meanFamily(rows, [d.column]);
    if (v != null && v > 0) parts.push({ id: d.id, label: d.label, value: v, seriesId: d.seriesId });
  }
  const sum = parts.reduce((a, p) => a + p.value, 0);
  if (sum <= 0) {
    return { labels: [], dominantSeriesId: defs[0]!.seriesId };
  }
  const labels = parts.map((p) => ({
    id: p.id,
    label: p.label,
    percent: (p.value / sum) * 100,
  }));
  const dominant = parts.reduce((a, b) => (b.value > a.value ? b : a));
  return { labels, dominantSeriesId: dominant.seriesId };
}

function seriesFromMeta(
  id: RooflineSeriesId,
  peakComputeTops: number,
  peakBandwidthGBs: number,
): RooflineSeries {
  const meta = ROOFLINE_SERIES_META[id];
  return {
    id,
    group: meta.group,
    label: meta.label,
    color: meta.color,
    peakComputeTops,
    peakBandwidthGBs,
    slopeStyle: meta.slopeStyle,
  };
}

/** §11.8.1 p_peak in TOps/s. `frequencyMhz` is MHz. */
export function peakComputeTopsFromFormula(
  id: RooflineSeriesId,
  cubeNum: number,
  vectorNum: number,
  frequencyMhz: number,
): number {
  const f = frequencyMhz;
  switch (id) {
    case 'aiv-fp16':
    case 'aiv-bp16':
      return (vectorNum * 128 * 2 * f) / MHZ_MAC_TO_TOPS;
    case 'aiv-fp32':
      return (vectorNum * 64 * 2 * f) / MHZ_MAC_TO_TOPS;
    case 'aic-int16-fp16':
      return (cubeNum * 4096 * 2 * f) / MHZ_MAC_TO_TOPS;
    case 'aic-int32-fp32':
      return (cubeNum * 2048 * 2 * f) / MHZ_MAC_TO_TOPS;
    case 'aic-fp32':
      // Same plateau family as int32/fp32 cube path when producer does not split further.
      return (cubeNum * 2048 * 2 * f) / MHZ_MAC_TO_TOPS;
    case 'aic-int8-fp8':
      return (cubeNum * 8192 * 2 * f) / MHZ_MAC_TO_TOPS;
  }
}

/** AIV formulas need vector+freq; AIC formulas need cube+freq (not both sides). */
function canFormulaForId(
  id: RooflineSeriesId,
  cubeNum: number | undefined,
  vectorNum: number | undefined,
  frequencyMhz: number | undefined,
): boolean {
  if (frequencyMhz == null || !(frequencyMhz > 0)) return false;
  if (id.startsWith('aiv-')) return vectorNum != null && vectorNum > 0;
  return cubeNum != null && cubeNum > 0;
}

function defaultSeriesCatalog(
  cubeNum: number | undefined,
  vectorNum: number | undefined,
  cubeFrequencyMhz: number | undefined,
  vectorFrequencyMhz: number | undefined,
): RooflineSeries[] {
  const ids = Object.keys(ROOFLINE_SERIES_META) as RooflineSeriesId[];
  return ids.map((id) => {
    const frequencyMhz = id.startsWith('aiv-') ? vectorFrequencyMhz : cubeFrequencyMhz;
    if (canFormulaForId(id, cubeNum, vectorNum, frequencyMhz)) {
      return seriesFromMeta(
        id,
        peakComputeTopsFromFormula(id, cubeNum ?? 0, vectorNum ?? 0, frequencyMhz!),
        ROOFLINE_B_PEAK_GBS,
      );
    }
    const ex = EXAMPLE_PEAK_TOPS[id];
    return seriesFromMeta(id, ex.peakComputeTops, ex.peakBandwidthGBs);
  });
}

type RooflineMetric = {
  p_peak?: number;
  b_peak?: number;
  w?: number;
  t?: number;
  q?: number;
};

function parseRooflineJsonl(text: string): {
  series: RooflineSeries[];
  points: RooflinePoint[];
} | undefined {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let obj: Record<string, unknown> | undefined;
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (String(parsed.category ?? '') === 'Roofline') {
        obj = parsed;
        break;
      }
    } catch {
      /* skip */
    }
  }
  if (!obj) return undefined;

  const seriesById = new Map<RooflineSeriesId, RooflineSeries>();
  const points: RooflinePoint[] = [];
  const pointSeries: RooflineSeriesId[] = [];

  for (const [key, raw] of Object.entries(obj)) {
    if (key === 'category' || raw == null || typeof raw !== 'object') continue;
    const seriesId = JSON_KEY_TO_SERIES[key];
    if (!seriesId) continue;
    const m = raw as RooflineMetric;
    const pPeakOps = typeof m.p_peak === 'number' ? m.p_peak : undefined;
    // Only a positive p_peak overlays the catalog. Missing / ≤0 must not
    // substitute EXAMPLE_PEAK_TOPS — that clobbers §11.8.1 formula roofs.
    if (pPeakOps != null && pPeakOps > 0) {
      const peakTops = pPeakOps / OPS_PER_TOPS;
      const bPeak = typeof m.b_peak === 'number' && m.b_peak > 0 ? m.b_peak : ROOFLINE_B_PEAK_GBS;
      // Many producer keys map to one legend series — keep the max p_peak (and its b_peak).
      const prev = seriesById.get(seriesId);
      if (!prev || peakTops > prev.peakComputeTops) {
        seriesById.set(seriesId, seriesFromMeta(seriesId, peakTops, bPeak));
      }
    }

    const w = typeof m.w === 'number' ? m.w : undefined;
    const t = typeof m.t === 'number' ? m.t : undefined;
    const q = typeof m.q === 'number' ? m.q : undefined;
    if (w == null || t == null || q == null || !(w > 0) || !(t > 0) || !(q > 0)) continue;
    const intensity = w / q;
    const performance = w / t / OPS_PER_TOPS;
    if (!(intensity > 0) || !(performance > 0)) continue;
    const meta = ROOFLINE_SERIES_META[seriesId];
    points.push({
      id: key,
      label: meta.label,
      intensity,
      performance,
      style: 'solid',
      color: meta.color,
      seriesId,
    });
    pointSeries.push(seriesId);
  }

  // One point on a series keeps the legend name. Several keys sharing a
  // seriesId append the producer key so the hover tip stays distinguishable.
  const countBySeries = new Map<RooflineSeriesId, number>();
  for (const id of pointSeries) {
    countBySeries.set(id, (countBySeries.get(id) ?? 0) + 1);
  }
  pointSeries.forEach((id, i) => {
    if ((countBySeries.get(id) ?? 0) > 1) {
      points[i]!.label = `${ROOFLINE_SERIES_META[id].label} (${points[i]!.id})`;
    }
  });

  if (seriesById.size === 0 && points.length === 0) return undefined;
  // Keep legend order (sparse — caller merges onto the full catalog).
  const ordered = (Object.keys(ROOFLINE_SERIES_META) as RooflineSeriesId[])
    .filter((id) => seriesById.has(id))
    .map((id) => seriesById.get(id)!);
  return { series: ordered, points };
}

/** Same fold as `adaptRep` HardwareInfo keys. Not imported: that module already imports this one. */
function normalizeHwKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function positiveHwNumber(value: unknown): number | undefined {
  if (Array.isArray(value)) {
    let best: number | undefined;
    for (const item of value) {
      const n = positiveHwNumber(item);
      if (n != null && (best == null || n > best)) best = n;
    }
    return best;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseHardwareCounts(jsonlText: string | undefined): {
  cubeNum?: number;
  vectorNum?: number;
  cubeFrequencyMhz?: number;
  vectorFrequencyMhz?: number;
} {
  if (!jsonlText) return {};
  let cubeNum: number | undefined;
  let vectorNum: number | undefined;
  let cubeFrequencyMhz: number | undefined;
  let vectorFrequencyMhz: number | undefined;
  for (const line of jsonlText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (!normalizeHwKey(String(obj.category ?? '')).includes('ai_core')) continue;
    const fields: Record<string, number> = {};
    for (const [key, value] of Object.entries(obj)) {
      const norm = normalizeHwKey(key);
      if (norm === 'category') continue;
      const n = positiveHwNumber(value);
      if (n == null) continue;
      fields[norm] = fields[norm] == null ? n : Math.max(fields[norm], n);
    }
    const cube = fields.ai_cube_count ?? fields.aic_cube_count;
    const vector = fields.ai_vector_count ?? fields.aic_vector_count;
    if (cube != null) cubeNum = cube;
    if (vector != null) vectorNum = vector;
    // Side clocks win. A shared core clock fills only a side that has none.
    const coreFreq = fields.ai_core_frequency_mhz ?? fields.aic_core_frequency_mhz;
    const cubeFreq = fields.ai_cube_frequency_mhz ?? fields.ai_cube_frequency;
    const vectorFreq = fields.ai_vector_frequency_mhz ?? fields.ai_vector_frequency;
    if (cubeFreq != null) cubeFrequencyMhz = cubeFreq;
    else if (coreFreq != null) cubeFrequencyMhz = coreFreq;
    if (vectorFreq != null) vectorFrequencyMhz = vectorFreq;
    else if (coreFreq != null) vectorFrequencyMhz = coreFreq;
  }
  return { cubeNum, vectorNum, cubeFrequencyMhz, vectorFrequencyMhz };
}

function measuredGmPoint(
  arithRows: CsvRows,
  memRows: CsvRows,
): { point: RooflinePoint; mixLabels: RooflineMixLabel[] } | undefined {
  const vecFops = meanFamily(arithRows, ['aiv_vec_fops']);
  const vecTime = meanFamily(arithRows, ['aiv_time(us)']);
  const cubeFops = meanFamily(arithRows, ['aic_cube_fops']);
  const cubeTime = meanFamily(arithRows, ['aic_time(us)']);

  const useVector = vecFops != null && vecFops > 0 && vecTime != null && vecTime > 0;
  const useCube = !useVector && cubeFops != null && cubeFops > 0 && cubeTime != null && cubeTime > 0;
  if (!useVector && !useCube) return undefined;

  const fops = useVector ? vecFops! : cubeFops!;
  const timeUs = useVector ? vecTime! : cubeTime!;
  // fops / µs → ops/s → TOps/s: / 1e6 / 1e12? Historical interim used fops/timeUs/1e6 as TOps/s
  // (treating fops as already-scaled). Keep that GM formula for ArithmeticUtilization fixtures.
  const performance = fops / timeUs / 1e6;

  const readKb = meanFamily(memRows, ['read_main_memory_datas(KB)']);
  const writeKb = meanFamily(memRows, ['write_main_memory_datas(KB)']);
  if (readKb == null && writeKb == null) return undefined;
  const bytes = ((readKb ?? 0) + (writeKb ?? 0)) * 1024;
  if (!(bytes > 0) || !(performance > 0)) return undefined;

  const intensity = fops / bytes;
  const mixDefs = useVector ? VEC_MIX : CUBE_MIX;
  const { labels, dominantSeriesId } = mixLabelsFromRows(arithRows, mixDefs);
  const color = ROOFLINE_SERIES_META[dominantSeriesId].color;

  return {
    point: {
      id: 'gm',
      label: 'GM Read + Write',
      intensity,
      performance,
      style: 'solid',
      color,
      seriesId: dominantSeriesId,
    },
    mixLabels: labels,
  };
}

/**
 * §11.8 GM point + AIV/AIC roof catalog over the given rows (DATA-19 / DATA-29 scopes).
 * `All` passes summary.jsonl category records; a picked block passes that block's CSV rows.
 * Pass `hardwareInfoJsonlText` so roofs stay chip-level (Roofline category or §11.8.1 counts).
 */
export function rooflineFromRows(
  arithRows: Record<string, string>[],
  memRows: Record<string, string>[],
  hardwareInfoJsonlText?: string,
): RooflineViewModel | undefined {
  const fromJson = hardwareInfoJsonlText ? parseRooflineJsonl(hardwareInfoJsonlText) : undefined;
  const counts = parseHardwareCounts(hardwareInfoJsonlText);
  const catalog = defaultSeriesCatalog(
    counts.cubeNum,
    counts.vectorNum,
    counts.cubeFrequencyMhz,
    counts.vectorFrequencyMhz,
  );

  let mixLabels: RooflineMixLabel[] = [];
  let points: RooflinePoint[] = [];

  if (fromJson && fromJson.points.length > 0) {
    points = fromJson.points;
  }

  const measured = measuredGmPoint(arithRows, memRows);
  if (measured) {
    mixLabels = measured.mixLabels;
    if (points.length === 0) points = [measured.point];
  }

  if (points.length === 0) return undefined;

  // Overlay JSON peaks onto the full AIV+AIC catalog so a sparse Roofline category
  // cannot blank the rest of the product legend.
  const series =
    fromJson && fromJson.series.length > 0
      ? catalog.map((base) => fromJson.series.find((s) => s.id === base.id) ?? base)
      : catalog;
  return { points, mixLabels, series };
}
