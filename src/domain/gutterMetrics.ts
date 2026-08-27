import { laneColorKey } from './laneColors';
import { computeThreadUtilization } from './utilization';
import type { SwimlaneModel, SwimProcess, SwimThread } from './types';

export type GutterMetric = 'clockCycle' | 'cacheHit' | 'task' | 'utilization';

export type GutterBarDisplay = {
  barWidth: number;
  label: string;
  thresholdColor?: boolean;
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

const ICACHE_COLUMNS = ['aic_icache_miss_rate', 'aiv_icache_miss_rate'] as const;

function parseNumber(raw: string | undefined): number | undefined {
  if (raw == null || raw === '' || raw === 'NA') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function meanNonNa(rows: Record<string, string>[], columns: readonly string[]): number | undefined {
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

function cycleByColorKey(rows: Record<string, string>[]): Map<string, number> {
  const collected = new Map<string, number[]>();
  for (const pipe of PIPE_TIME_COLUMNS) {
    const mean = meanNonNa(rows, pipe.columns);
    if (mean == null) continue;
    const list = collected.get(pipe.colorKey) ?? [];
    list.push(mean);
    collected.set(pipe.colorKey, list);
  }
  const out = new Map<string, number>();
  for (const [key, vals] of collected) {
    out.set(key, vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  return out;
}

function cacheHitByColorKey(rows: Record<string, string>[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const col of ICACHE_COLUMNS) {
    const miss = meanNonNa(rows, [col]);
    if (miss == null) continue;
    const side = col.startsWith('aic_') ? 'cube' : 'vector';
    out.set(side, 1 - miss);
  }
  return out;
}

function leafRawValue(
  thread: SwimThread,
  metric: GutterMetric,
  model: SwimlaneModel,
  cycleByKey: Map<string, number>,
  cacheByKey: Map<string, number>,
): number | undefined {
  const key = laneColorKey(thread.name);
  switch (metric) {
    case 'clockCycle':
      return cycleByKey.get(key);
    case 'cacheHit':
      return cacheByKey.get(key);
    case 'task':
      return thread.events.length > 0 ? thread.events.length : undefined;
    case 'utilization': {
      const u = computeThreadUtilization(thread, model.minTime, model.maxTime);
      return u > 0 ? u : undefined;
    }
    default:
      return undefined;
  }
}

function rollup(
  values: number[],
  metric: GutterMetric,
): number | undefined {
  if (values.length === 0) return undefined;
  if (metric === 'task') return values.reduce((a, b) => a + b, 0);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function computeRawTree(
  thread: SwimThread,
  metric: GutterMetric,
  model: SwimlaneModel,
  cycleByKey: Map<string, number>,
  cacheByKey: Map<string, number>,
): number | undefined {
  if (thread.children !== undefined) {
    const childVals = (thread.children ?? [])
      .map((c) => computeRawTree(c, metric, model, cycleByKey, cacheByKey))
      .filter((v): v is number => v != null);
    return rollup(childVals, metric);
  }
  return leafRawValue(thread, metric, model, cycleByKey, cacheByKey);
}

function formatLabel(metric: GutterMetric, raw: number, barWidth: number): string {
  switch (metric) {
    case 'clockCycle':
      return String(Math.round(raw));
    case 'cacheHit':
      return raw.toFixed(2);
    case 'task':
      return String(Math.round(raw));
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
  const allEqual = [...entries.values()].every((v) => v === max);
  for (const [id, raw] of entries) {
    const barWidth = (raw / max) * 100;
    out.set(id, {
      barWidth,
      label: formatLabel(metric, raw, barWidth),
      thresholdColor: false,
    });
  }
  if (allEqual && entries.size > 1) {
    for (const [id, bar] of out) {
      out.set(id, { ...bar, barWidth: bar.barWidth }); // uniform gray in UI when all equal
    }
  }
  return out;
}

function collectRawForProcess(
  proc: SwimProcess,
  metric: GutterMetric,
  model: SwimlaneModel,
  cycleByKey: Map<string, number>,
  cacheByKey: Map<string, number>,
): Map<string, number> {
  const raw = new Map<string, number>();
  const walk = (threads: SwimThread[]) => {
    for (const t of threads) {
      const v = computeRawTree(t, metric, model, cycleByKey, cacheByKey);
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

function cardHasCacheData(
  proc: SwimProcess,
  cacheByKey: Map<string, number>,
): boolean {
  const walk = (threads: SwimThread[]): boolean => {
    for (const t of threads) {
      if (t.children !== undefined) {
        if (walk(t.children ?? [])) return true;
        continue;
      }
      if (cacheByKey.has(laneColorKey(t.name))) return true;
    }
    return false;
  };
  return walk(proc.threads);
}

function cardHasEvents(proc: SwimProcess): boolean {
  const walk = (threads: SwimThread[]): boolean => {
    for (const t of threads) {
      if (t.children !== undefined) {
        if (walk(t.children ?? [])) return true;
        continue;
      }
      if (t.events.length > 0) return true;
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
  const cacheByKey = cacheHitByColorKey(pipeUtilRows);
  const procs = cardId
    ? model.processes.filter((p) => p.id === cardId)
    : model.processes;

  const metrics = new Set<GutterMetric>();
  let anyEvents = false;
  for (const proc of procs) {
    if (cardHasCycleData(proc, cycleByKey)) metrics.add('clockCycle');
    if (cardHasCacheData(proc, cacheByKey)) metrics.add('cacheHit');
    if (cardHasEvents(proc)) {
      metrics.add('task');
      anyEvents = true;
    }
  }
  if (procs.length > 0 || model.processes.length > 0) metrics.add('utilization');
  if (!anyEvents && model.processes.some((p) => p.threads.length > 0)) {
    metrics.add('utilization');
  }
  return [...metrics];
}

export function defaultGutterMetric(available: GutterMetric[]): GutterMetric {
  if (available.includes('clockCycle')) return 'clockCycle';
  if (available.includes('task')) return 'task';
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
  const cacheByKey = cacheHitByColorKey(pipeUtilRows);
  const raw = collectRawForProcess(proc, metric, model, cycleByKey, cacheByKey);
  return toBars(raw, metric);
}

export const GUTTER_METRIC_LABELS: Record<GutterMetric, string> = {
  clockCycle: '时钟周期',
  cacheHit: '缓存命中率',
  task: '任务',
  utilization: '利用率',
};
