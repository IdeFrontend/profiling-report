/**
 * Chrome Trace `ph:C` counters → swim CounterTracks (Chrome / Perfetto-like).
 * One process per counter pid; one leaf per numeric `args` key
 * (memory util collapses `%` + KB into one KB-Y leaf).
 */

import { colorForCounterProcess, isMemoryUtilProcess } from '../domain/laneColors';
import type { SwimCounterPoint, SwimlaneModel, SwimProcess, SwimThread } from '../domain/types';
import {
  unitToNsFactor,
  type ChromeTraceToSwimlaneOptions,
  type TraceSourceTimeUnit,
} from './chromeTraceToSwimlane';

export type CounterPoint = SwimCounterPoint;

function readTraceEvents(traceJson: unknown): unknown[] {
  if (Array.isArray(traceJson)) return traceJson;
  if (traceJson && typeof traceJson === 'object') {
    const te = (traceJson as { traceEvents?: unknown }).traceEvents;
    if (Array.isArray(te)) return te;
  }
  return [];
}

function resolveToNs(traceJson: unknown, options?: ChromeTraceToSwimlaneOptions): number {
  if (options?.sourceTimeUnit != null) return unitToNsFactor(options.sourceTimeUnit);
  const display =
    traceJson && typeof traceJson === 'object'
      ? String((traceJson as { displayTimeUnit?: unknown }).displayTimeUnit ?? '')
          .trim()
          .toLowerCase()
      : '';
  const sourceUnit: TraceSourceTimeUnit = display === 'ns' ? 'ns' : 'us';
  return unitToNsFactor(sourceUnit);
}

function processNamesByPid(events: unknown[]): Map<string, string> {
  const processName = new Map<string, string>();
  for (const raw of events) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as {
      ph?: string;
      name?: string;
      pid?: unknown;
      args?: { name?: unknown };
    };
    if (e.ph !== 'M' || e.name !== 'process_name') continue;
    const label = e.args?.name;
    if (typeof label !== 'string' || label.length === 0) continue;
    processName.set(String(e.pid ?? 0), label);
  }
  return processName;
}

/** Finite numeric entries from a `ph:C` args object (Chrome multi-series counters). */
export function numericCounterArgs(
  args: Record<string, unknown> | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!args) return out;
  for (const [key, raw] of Object.entries(args)) {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) continue;
    out[key] = n;
  }
  return out;
}

function collapseSameTsLast(points: CounterPoint[]): CounterPoint[] {
  if (points.length === 0) return points;
  points.sort((a, b) => a.t - b.t);
  const out: CounterPoint[] = [];
  for (const p of points) {
    if (out.length > 0 && out[out.length - 1]!.t === p.t) {
      out[out.length - 1] = p;
    } else {
      out.push(p);
    }
  }
  return out;
}

function yMaxForPoints(points: readonly CounterPoint[]): number {
  let max = 0;
  for (const p of points) {
    if (p.v > max) max = p.v;
  }
  return max > 0 ? max : 1;
}

type SeriesBucket = {
  pid: string;
  processName: string;
  argKey: string;
  points: CounterPoint[];
};

/** Memory util: prefer a single KB-Y leaf when `Using Bytes (KB)` is present. */
const MEMORY_BYTES_KEY = 'Using Bytes (KB)';

/** Arg keys that become CounterTrack leaves for this process + sample. */
function seriesKeysForSample(
  processName: string,
  values: Record<string, number>,
): string[] {
  if (isMemoryUtilProcess(processName) && Number.isFinite(values[MEMORY_BYTES_KEY])) {
    return [MEMORY_BYTES_KEY];
  }
  return Object.keys(values);
}

/**
 * Build CounterTrack processes from every populated `ph:C` series in a Chrome Trace.
 * Empty pids (metadata only) are skipped. Same-`ts` multi-`C` keeps last per series.
 * Memory util with KB collapses `%` + KB into one leaf (Y = KB; tip keeps both).
 */
export function counterProcessesFromTrace(
  traceJson: unknown,
  options?: ChromeTraceToSwimlaneOptions,
): SwimProcess[] {
  const events = readTraceEvents(traceJson);
  const processName = processNamesByPid(events);
  const toNs = resolveToNs(traceJson, options);
  /** `${pid}\0${argKey}` → bucket (first-seen order). */
  const bySeries = new Map<string, SeriesBucket>();
  const order: string[] = [];

  for (const raw of events) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as {
      ph?: string;
      name?: string;
      pid?: unknown;
      ts?: unknown;
      args?: Record<string, unknown>;
    };
    if (e.ph !== 'C') continue;
    const ts = Number(e.ts);
    if (!Number.isFinite(ts)) continue;
    const values = numericCounterArgs(e.args);
    if (Object.keys(values).length === 0) continue;
    const pid = String(e.pid ?? 0);
    const pname = processName.get(pid) ?? `Process ${pid}`;
    const t = ts * toNs;
    for (const argKey of seriesKeysForSample(pname, values)) {
      const seriesId = `${pid}\0${argKey}`;
      let bucket = bySeries.get(seriesId);
      if (!bucket) {
        bucket = { pid, processName: pname, argKey, points: [] };
        bySeries.set(seriesId, bucket);
        order.push(seriesId);
      }
      bucket.points.push({ t, v: values[argKey]!, values: { ...values } });
    }
  }

  const byPid = new Map<string, { name: string; threads: SwimThread[]; order: string[] }>();
  const pidOrder: string[] = [];
  for (const seriesId of order) {
    const bucket = bySeries.get(seriesId)!;
    const points = collapseSameTsLast(bucket.points);
    if (points.length === 0) continue;
    let proc = byPid.get(bucket.pid);
    if (!proc) {
      proc = { name: bucket.processName, threads: [], order: [] };
      byPid.set(bucket.pid, proc);
      pidOrder.push(bucket.pid);
    }
    const threadId = `counter-${bucket.pid}-${bucket.argKey}`;
    proc.threads.push({
      id: threadId,
      name: bucket.argKey,
      events: [],
      counter: {
        points,
        yMax: yMaxForPoints(points),
        colorHex: colorForCounterProcess(bucket.processName),
      },
    });
  }

  return pidOrder.map((pid) => {
    const proc = byPid.get(pid)!;
    return {
      id: `p-counter-${pid}`,
      name: proc.name,
      threads: proc.threads,
    } satisfies SwimProcess;
  });
}

/**
 * Append Trace `ph:C` CounterTrack processes to a swimlane model.
 * No-op when the Trace has no usable counter series.
 */
export function mergeCounterTracksFromTrace(
  model: SwimlaneModel,
  traceJson: unknown,
  options?: ChromeTraceToSwimlaneOptions,
): SwimlaneModel {
  const procs = counterProcessesFromTrace(traceJson, options);
  if (procs.length === 0) return model;
  return { ...model, processes: [...model.processes, ...procs] };
}

/** Format a counter tip cell from the arg key + numeric sample (no domain parsers). */
export function formatCounterArgValue(key: string, value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const text = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  if (/KB/i.test(key)) return `${text} KB`;
  if (/%/.test(key)) return `${text}%`;
  return text;
}

/** Tip rows for a counter sample — one row per numeric arg on the point. */
export function counterTipRows(
  point: Pick<SwimCounterPoint, 'v' | 'values'>,
  seriesKey: string,
): { label: string; value: string }[] {
  const values = point.values;
  if (values && Object.keys(values).length > 0) {
    return Object.entries(values).map(([label, v]) => ({
      label,
      value: formatCounterArgValue(label, v),
    }));
  }
  return [{ label: seriesKey, value: formatCounterArgValue(seriesKey, point.v) }];
}
