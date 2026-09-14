import { laneColorKey } from './laneColors';
import { computeThreadUtilization } from './utilization';
import type { SwimlaneModel, SwimProcess, SwimThread } from './types';

export type GutterMetric = 'clockCycle' | 'utilization';

export type GutterBarDisplay = {
  barWidth: number;
  label: string;
  /** Event-coverage bars: red when barWidth < 50 (gray at exactly 50). Both metrics. */
  thresholdColor?: boolean;
  /** @deprecated Unused when barWidth is event coverage for both metrics. */
  relativeMax?: boolean;
};

/** Per-pipe cycle columns (DATA-38a). Parallel rename of the former `*_time(us)` map. */
const PIPE_CYCLE_COLUMNS: { colorKey: string; columns: string[]; side: 'aic' | 'aiv' }[] = [
  { colorKey: 'cube', columns: ['aic_cube_total_cycles'], side: 'aic' },
  { colorKey: 'mte2', columns: ['aic_mte2_total_cycles', 'aiv_mte2_total_cycles'], side: 'aic' },
  { colorKey: 'mte1', columns: ['aic_mte1_total_cycles'], side: 'aic' },
  { colorKey: 'mte3', columns: ['aiv_mte3_total_cycles'], side: 'aiv' },
  { colorKey: 'fixp', columns: ['aic_fixpipe_total_cycles'], side: 'aic' },
  { colorKey: 'scalar', columns: ['aic_scalar_total_cycles', 'aiv_scalar_total_cycles'], side: 'aic' },
  { colorKey: 'vector', columns: ['aiv_vec_total_cycles'], side: 'aiv' },
];

/** Time columns used only when per-pipe `*_total_cycles` are absent (fixture gap). */
const PIPE_TIME_FALLBACK: Record<string, string[]> = {
  cube: ['aic_cube_time(us)'],
  mte2: ['aic_mte2_time(us)', 'aiv_mte2_time(us)'],
  mte1: ['aic_mte1_time(us)'],
  mte3: ['aiv_mte3_time(us)'],
  fixp: ['aic_fixpipe_time(us)'],
  scalar: ['aic_scalar_time(us)', 'aiv_scalar_time(us)'],
  vector: ['aiv_vec_time(us)'],
};

const SIDE_TIME: Record<'aic' | 'aiv', string> = {
  aic: 'aic_time(us)',
  aiv: 'aiv_time(us)',
};
const SIDE_CYCLES: Record<'aic' | 'aiv', string> = {
  aic: 'aic_total_cycles',
  aiv: 'aiv_total_cycles',
};

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

/**
 * Cycles-per-µs from block totals (`side_total_cycles / side_time(us)`).
 * ponytail: many fixtures lack per-pipe `*_total_cycles`; upgrade when producer ships them.
 */
function sideCyclesPerUs(
  rows: Record<string, string>[],
  side: 'aic' | 'aiv',
): number | undefined {
  const time = meanColumn(rows, SIDE_TIME[side]);
  const cycles = meanColumn(rows, SIDE_CYCLES[side]);
  if (time == null || cycles == null || !(time > 0)) return undefined;
  return cycles / time;
}

function derivePipeCycles(
  rows: Record<string, string>[],
  colorKey: string,
  side: 'aic' | 'aiv',
): number | undefined {
  const timeCols = PIPE_TIME_FALLBACK[colorKey];
  if (!timeCols) return undefined;
  const timeMean = meanOfColumnMeans(rows, timeCols);
  if (timeMean == null) return undefined;
  const rate =
    sideCyclesPerUs(rows, side) ??
    sideCyclesPerUs(rows, side === 'aic' ? 'aiv' : 'aic');
  if (rate == null) return undefined;
  return timeMean * rate;
}

function cycleByColorKey(rows: Record<string, string>[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const pipe of PIPE_CYCLE_COLUMNS) {
    const direct = meanOfColumnMeans(rows, pipe.columns);
    if (direct != null) {
      out.set(pipe.colorKey, direct);
      continue;
    }
    const derived = derivePipeCycles(rows, pipe.colorKey, pipe.side);
    if (derived != null) out.set(pipe.colorKey, derived);
  }
  return out;
}

function leafUtilization(thread: SwimThread, model: SwimlaneModel): number {
  // Include 0 so idle lanes paint `0%` and folder means count idle children.
  return computeThreadUtilization(thread, model.minTime, model.maxTime);
}

function leafCycleRaw(
  thread: SwimThread,
  cycleByKey: Map<string, number>,
): number | undefined {
  return cycleByKey.get(laneColorKey(thread.name));
}

function meanRollup(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sumRollup(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0);
}

/** Event-coverage tree — drives barWidth for **both** metrics. */
function computeUtilTree(thread: SwimThread, model: SwimlaneModel): number | undefined {
  if (thread.children !== undefined) {
    const childVals = (thread.children ?? [])
      .map((c) => computeUtilTree(c, model))
      .filter((v): v is number => v != null);
    return meanRollup(childVals);
  }
  return leafUtilization(thread, model);
}

/** Absolute cycle tree — drives clockCycle labels only (folders sum children). */
function computeCycleTree(
  thread: SwimThread,
  cycleByKey: Map<string, number>,
): number | undefined {
  if (thread.children !== undefined) {
    const childVals = (thread.children ?? [])
      .map((c) => computeCycleTree(c, cycleByKey))
      .filter((v): v is number => v != null);
    return sumRollup(childVals);
  }
  return leafCycleRaw(thread, cycleByKey);
}

/** Space-group thousands (`1 502`, `10 325`) — same glyph as UI-45 cycle labels. */
function groupIntegerDigits(intPart: string): string {
  const neg = intPart.startsWith('-');
  const digits = neg ? intPart.slice(1) : intPart;
  if (digits.length <= 3) return intPart;
  const groups: string[] = [];
  for (let i = digits.length; i > 0; i -= 3) {
    groups.unshift(digits.slice(Math.max(0, i - 3), i));
  }
  return (neg ? '-' : '') + groups.join(' ');
}

function formatClockCycleLabel(raw: number): string {
  const rounded = Math.round(raw);
  const n = rounded === 0 && raw > 0 ? 1 : rounded;
  return groupIntegerDigits(String(n));
}

function utilBarWidth(coverage: number): number {
  let barWidth = Math.round(coverage * 100);
  if (barWidth === 0 && coverage > 0) barWidth = 1;
  return Math.min(100, Math.max(0, barWidth));
}

function collectUtilForProcess(proc: SwimProcess, model: SwimlaneModel): Map<string, number> {
  const raw = new Map<string, number>();
  const walk = (threads: SwimThread[]) => {
    for (const t of threads) {
      const v = computeUtilTree(t, model);
      if (v != null) raw.set(t.id, v);
      if (t.children?.length) walk(t.children);
    }
  };
  walk(proc.threads);
  return raw;
}

function collectCycleForProcess(
  proc: SwimProcess,
  cycleByKey: Map<string, number>,
): Map<string, number> {
  const raw = new Map<string, number>();
  const walk = (threads: SwimThread[]) => {
    for (const t of threads) {
      const v = computeCycleTree(t, cycleByKey);
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

export function defaultGutterMetric(available: GutterMetric[]): GutterMetric | null {
  if (available.includes('utilization')) return 'utilization';
  if (available.includes('clockCycle')) return 'clockCycle';
  return null;
}

/**
 * Bar width is always event coverage (same for both metrics).
 * Labels: utilization → `NN%`; clockCycle → bare absolute cycle counts.
 */
export function gutterBarsForCard(
  model: SwimlaneModel,
  pipeUtilRows: Record<string, string>[],
  metric: GutterMetric,
  cardId: string,
): Map<string, GutterBarDisplay> {
  const proc = model.processes.find((p) => p.id === cardId);
  if (!proc) return new Map();

  const utilById = collectUtilForProcess(proc, model);
  const cycleByKey = cycleByColorKey(pipeUtilRows);
  const cycleById =
    metric === 'clockCycle' ? collectCycleForProcess(proc, cycleByKey) : undefined;

  const out = new Map<string, GutterBarDisplay>();
  for (const [id, coverage] of utilById) {
    const barWidth = utilBarWidth(coverage);
    if (metric === 'utilization') {
      out.set(id, {
        barWidth,
        label: `${barWidth}%`,
        thresholdColor: true,
      });
      continue;
    }
    const cycles = cycleById?.get(id);
    out.set(id, {
      barWidth,
      label: cycles != null ? formatClockCycleLabel(cycles) : '',
      thresholdColor: true,
    });
  }
  return out;
}

/** Midline fixed at 50% for both metrics (bar = event coverage). */
export function averageBarWidthForCard(
  _bars: Map<string, GutterBarDisplay>,
  _metric: GutterMetric,
): number | undefined {
  return 50;
}
