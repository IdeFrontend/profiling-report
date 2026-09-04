import { laneColorKey } from './laneColors';
import { computeThreadUtilization } from './utilization';
import type { SwimlaneModel, SwimProcess, SwimThread } from './types';

export type GutterMetric = 'clockCycle' | 'utilization';

export type GutterBarDisplay = {
  barWidth: number;
  label: string;
  /** Util / legacy pipe ratio: red when barWidth < 50 (gray at exactly 50). */
  thresholdColor?: boolean;
  /** Relative metrics: red fill when this lane is the Card max (false when all lanes tie). */
  relativeMax?: boolean;
};

const PIPE_TIME_COLUMNS: { colorKey: string; columns: string[] }[] = [
  { colorKey: 'cube', columns: ['aic_cube_time(us)'] },
  { colorKey: 'mte2', columns: ['aic_mte2_time(us)', 'aiv_mte2_time(us)'] },
  { colorKey: 'mte1', columns: ['aic_mte1_time(us)'] },
  { colorKey: 'mte3', columns: ['aiv_mte3_time(us)'] },
  { colorKey: 'fixp', columns: ['aic_fixpipe_time(us)'] },
  { colorKey: 'scalar', columns: ['aic_scalar_time(us)', 'aiv_scalar_time(us)'] },
  { colorKey: 'vector', columns: ['aiv_vec_time(us)'] },
];

function parseNumber(raw: string | undefined): number | undefined {
  if (raw == null || raw === '' || raw === 'NA') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function meanColumn(rows: Record<string, string>[], column: string): number | undefined {
  const vals: number[] = [];
  for (const row of rows) {
    const n = parseNumber(row[column]);
    if (n != null) vals.push(n);
  }
  if (vals.length === 0) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Per-column means, then mean of those means (normative MIX / multi-column keys). */
function meanOfColumnMeans(
  rows: Record<string, string>[],
  columns: readonly string[],
): number | undefined {
  const means: number[] = [];
  for (const col of columns) {
    const m = meanColumn(rows, col);
    if (m != null) means.push(m);
  }
  if (means.length === 0) return undefined;
  return means.reduce((a, b) => a + b, 0) / means.length;
}

function cycleByColorKey(rows: Record<string, string>[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const pipe of PIPE_TIME_COLUMNS) {
    const mean = meanOfColumnMeans(rows, pipe.columns);
    if (mean != null) out.set(pipe.colorKey, mean);
  }
  return out;
}

function leafRawValue(
  thread: SwimThread,
  metric: GutterMetric,
  model: SwimlaneModel,
  cycleByKey: Map<string, number>,
): number | undefined {
  const key = laneColorKey(thread.name);
  switch (metric) {
    case 'clockCycle':
      return cycleByKey.get(key);
    case 'utilization': {
      const u = computeThreadUtilization(thread, model.minTime, model.maxTime);
      return u > 0 ? u : undefined;
    }
    default:
      return undefined;
  }
}

function rollup(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function computeRawTree(
  thread: SwimThread,
  metric: GutterMetric,
  model: SwimlaneModel,
  cycleByKey: Map<string, number>,
): number | undefined {
  if (thread.children !== undefined) {
    const childVals = (thread.children ?? [])
      .map((c) => computeRawTree(c, metric, model, cycleByKey))
      .filter((v): v is number => v != null);
    return rollup(childVals);
  }
  return leafRawValue(thread, metric, model, cycleByKey);
}

function formatClockCycleLabel(raw: number): string {
  const rounded = Math.round(raw);
  // CSV `*_time(us)` means are often fractional; Math.round alone paints "0" on non-empty bars.
  let magnitude: string;
  if (rounded !== 0 || raw === 0) magnitude = String(rounded);
  else if (raw >= 0.01) magnitude = raw.toFixed(2);
  else magnitude = raw.toPrecision(2);
  // Match formatTime's µs glyph so bars are not read as % / bare ratios.
  return `${magnitude}µs`;
}

function formatLabel(metric: GutterMetric, raw: number, barWidth: number): string {
  switch (metric) {
    case 'clockCycle':
      return formatClockCycleLabel(raw);
    case 'utilization':
      return `${barWidth}%`;
    default:
      return String(raw);
  }
}

function toBars(
  entries: Map<string, number>,
  metric: GutterMetric,
): Map<string, GutterBarDisplay> {
  const out = new Map<string, GutterBarDisplay>();
  if (entries.size === 0) return out;

  if (metric === 'utilization') {
    for (const [id, raw] of entries) {
      let barWidth = Math.round(raw * 100);
      if (barWidth === 0 && raw > 0) barWidth = 1;
      out.set(id, {
        barWidth: Math.min(100, Math.max(0, barWidth)),
        label: `${barWidth}%`,
        thresholdColor: true,
      });
    }
    return out;
  }

  const max = Math.max(...entries.values());
  if (!(max > 0)) return out;
  const values = [...entries.values()];
  const allEqual = values.length > 1 && values.every((v) => v === max);
  for (const [id, raw] of entries) {
    const barWidth = (raw / max) * 100;
    out.set(id, {
      barWidth,
      label: formatLabel(metric, raw, barWidth),
      thresholdColor: false,
      relativeMax: !allEqual && raw === max,
    });
  }
  return out;
}

function collectRawForProcess(
  proc: SwimProcess,
  metric: GutterMetric,
  model: SwimlaneModel,
  cycleByKey: Map<string, number>,
): Map<string, number> {
  const raw = new Map<string, number>();
  const walk = (threads: SwimThread[]) => {
    for (const t of threads) {
      const v = computeRawTree(t, metric, model, cycleByKey);
      if (v != null) raw.set(t.id, v);
      if (t.children?.length) walk(t.children);
    }
  };
  walk(proc.threads);
  return raw;
}

function cardHasCycleData(
  proc: SwimProcess,
  cycleByKey: Map<string, number>,
): boolean {
  const walk = (threads: SwimThread[]): boolean => {
    for (const t of threads) {
      if (t.children !== undefined) {
        if (walk(t.children ?? [])) return true;
        continue;
      }
      if (cycleByKey.has(laneColorKey(t.name))) return true;
    }
    return false;
  };
  return walk(proc.threads);
}

function cardHasTraceLanes(proc: SwimProcess): boolean {
  const walk = (threads: SwimThread[]): boolean => {
    for (const t of threads) {
      if (t.children !== undefined) {
        if (walk(t.children ?? [])) return true;
        continue;
      }
      return true;
    }
    return false;
  };
  return walk(proc.threads);
}

export function availableGutterMetrics(
  model: SwimlaneModel,
  pipeUtilRows: Record<string, string>[] = [],
  cardId?: string,
): GutterMetric[] {
  const cycleByKey = cycleByColorKey(pipeUtilRows);
  const procs = cardId
    ? model.processes.filter((p) => p.id === cardId)
    : model.processes;

  const metrics: GutterMetric[] = [];
  for (const proc of procs) {
    if (cardHasCycleData(proc, cycleByKey)) {
      metrics.push('clockCycle');
      break;
    }
  }
  for (const proc of procs) {
    if (cardHasTraceLanes(proc)) {
      metrics.push('utilization');
      break;
    }
  }
  return metrics;
}

export function defaultGutterMetric(available: GutterMetric[]): GutterMetric {
  if (available.includes('clockCycle')) return 'clockCycle';
  return 'utilization';
}

export function gutterBarsForCard(
  model: SwimlaneModel,
  pipeUtilRows: Record<string, string>[],
  metric: GutterMetric,
  cardId: string,
): Map<string, GutterBarDisplay> {
  const proc = model.processes.find((p) => p.id === cardId);
  if (!proc) return new Map();
  const cycleByKey = cycleByColorKey(pipeUtilRows);
  const raw = collectRawForProcess(proc, metric, model, cycleByKey);
  return toBars(raw, metric);
}

/** PyPTO average-line position (% of 110px track). Util = 50; clockCycle = mean barWidth. */
export function averageBarWidthForCard(
  bars: Map<string, GutterBarDisplay>,
  metric: GutterMetric,
): number | undefined {
  if (metric === 'utilization') return 50;
  const widths = [...bars.values()].map((b) => b.barWidth).filter((w) => w > 0);
  if (widths.length < 2) return undefined;
  return widths.reduce((a, b) => a + b, 0) / widths.length;
}
