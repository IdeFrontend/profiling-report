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

/** Per-pipe cycle columns ([DATA-38](../../docs/context/decisions/DATA.md)). Each CSV column carries its side for derive. */
const PIPE_CYCLE_COLUMNS: {
  colorKey: string;
  columns: { cycleCol: string; timeCol: string; side: 'aic' | 'aiv' }[];
}[] = [
  { colorKey: 'cube', columns: [{ cycleCol: 'aic_cube_total_cycles', timeCol: 'aic_cube_time(us)', side: 'aic' }] },
  {
    colorKey: 'mte2',
    columns: [
      { cycleCol: 'aic_mte2_total_cycles', timeCol: 'aic_mte2_time(us)', side: 'aic' },
      { cycleCol: 'aiv_mte2_total_cycles', timeCol: 'aiv_mte2_time(us)', side: 'aiv' },
    ],
  },
  { colorKey: 'mte1', columns: [{ cycleCol: 'aic_mte1_total_cycles', timeCol: 'aic_mte1_time(us)', side: 'aic' }] },
  { colorKey: 'mte3', columns: [{ cycleCol: 'aiv_mte3_total_cycles', timeCol: 'aiv_mte3_time(us)', side: 'aiv' }] },
  {
    colorKey: 'fixp',
    columns: [{ cycleCol: 'aic_fixpipe_total_cycles', timeCol: 'aic_fixpipe_time(us)', side: 'aic' }],
  },
  {
    colorKey: 'scalar',
    columns: [
      { cycleCol: 'aic_scalar_total_cycles', timeCol: 'aic_scalar_time(us)', side: 'aic' },
      { cycleCol: 'aiv_scalar_total_cycles', timeCol: 'aiv_scalar_time(us)', side: 'aiv' },
    ],
  },
  { colorKey: 'vector', columns: [{ cycleCol: 'aiv_vec_total_cycles', timeCol: 'aiv_vec_time(us)', side: 'aiv' }] },
];

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

/** Direct cycle column mean, else timeCol × matching-side Hz. */
function columnCycles(
  rows: Record<string, string>[],
  col: { cycleCol: string; timeCol: string; side: 'aic' | 'aiv' },
): number | undefined {
  const direct = meanColumn(rows, col.cycleCol);
  if (direct != null) return direct;
  const timeMean = meanColumn(rows, col.timeCol);
  if (timeMean == null) return undefined;
  const rate = sideCyclesPerUs(rows, col.side);
  if (rate == null) return undefined;
  return timeMean * rate;
}

function cycleByColorKey(rows: Record<string, string>[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const pipe of PIPE_CYCLE_COLUMNS) {
    const values: number[] = [];
    for (const col of pipe.columns) {
      const v = columnCycles(rows, col);
      if (v != null) values.push(v);
    }
    if (values.length === 0) continue;
    out.set(
      pipe.colorKey,
      values.reduce((a, b) => a + b, 0) / values.length,
    );
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

/**
 * Leaf cycle totals keyed by `laneColorKey` under `thread`.
 * PipeUtilization is per-pipe-family, not per-core — same key must not be counted twice.
 */
function leafCyclesByColorKey(
  thread: SwimThread,
  cycleByKey: Map<string, number>,
): Map<string, number> {
  const out = new Map<string, number>();
  const walk = (t: SwimThread) => {
    if (t.children !== undefined) {
      for (const c of t.children ?? []) walk(c);
      return;
    }
    const key = laneColorKey(t.name);
    const v = cycleByKey.get(key);
    if (v != null) out.set(key, v);
  };
  walk(thread);
  return out;
}

/** Absolute cycle tree — labels only; folders sum **distinct** pipe keys. */
function computeCycleTree(
  thread: SwimThread,
  cycleByKey: Map<string, number>,
): number | undefined {
  if (thread.children !== undefined) {
    return sumRollup([...leafCyclesByColorKey(thread, cycleByKey).values()]);
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
