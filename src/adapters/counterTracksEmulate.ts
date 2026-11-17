/**
 * Emulate Trace ph:C util pipes → swim CounterTracks (Chrome CounterTrack-like).
 * #208 memory util; #209 unit util; #206 queue util.
 */

import type { SwimCounterPoint, SwimlaneModel, SwimProcess, SwimThread } from '../domain/types';

/** Oleg / #208: optional pipes `<AIC|AIV0|AIV1>_<UB|L0A|L0B|L0C|L1>_UTILIZATION`. */
const MEMORY_UTIL_PIPE_RE =
  /^((?:AIC|AIV0|AIV1)_(?:UB|L0A|L0B|L0C|L1)_UTILIZATION)\b/i;

/** #209: `<AIC|AIV0|AIV1>_UNIT_UTILIZATION`. */
const UNIT_UTIL_PIPE_RE = /^((?:AIC|AIV0|AIV1)_UNIT_UTILIZATION)\b/i;

/** #206: `<AIC|AIV0|AIV1>_PUSHQ_<EXEC|ISSUE>_QUEUE_UTILIZATION`. */
const QUEUE_UTIL_PIPE_RE =
  /^((?:AIC|AIV0|AIV1)_PUSHQ_(?:EXEC|ISSUE)_QUEUE_UTILIZATION)\b/i;

const US_TO_NS = 1e3;

/** Memory util CounterTrack stroke/fill (gutter low-util red hue; UI-61). */
export const MEMORY_UTIL_COUNTER_COLOR = '#E7434A';

export type CounterPoint = SwimCounterPoint;

function readTraceEvents(traceJson: unknown): unknown[] {
  if (Array.isArray(traceJson)) return traceJson;
  if (traceJson && typeof traceJson === 'object') {
    const te = (traceJson as { traceEvents?: unknown }).traceEvents;
    if (Array.isArray(te)) return te;
  }
  return [];
}

/**
 * Map `Utilization (%)` for memory util display. Emulate memory counters often
 * emit 0..1 fractions (rms_norm_quant); values already in (1, 100] stay as percent.
 */
export function memoryUtilDisplayValue(raw: number): number | null {
  if (!Number.isFinite(raw) || raw < 0) return null;
  if (raw <= 1) return raw * 100;
  if (raw <= 100) return raw;
  return null;
}

/** @deprecated Prefer memoryUtilDisplayValue — kept for call-site renames during #208 retarget. */
export const memoryUtilToOverviewPercent = memoryUtilDisplayValue;

/** Unit util CT already ships 0..100 under `Utilization (%)` — no fraction scaling. */
export function unitUtilDisplayValue(raw: number): number | null {
  if (!Number.isFinite(raw) || raw < 0) return null;
  return raw;
}

/** Queue util depths (not percents) — finite ≥0; Y auto-scales per track. */
export function queueUtilDisplayValue(raw: number): number | null {
  if (!Number.isFinite(raw) || raw < 0) return null;
  return raw;
}

function readQueueUtilArg(args: Record<string, unknown> | undefined): number | null {
  if (!args) return null;
  const raw = Number(
    args['Exec Queue Utilization'] ??
      args['Issue Queue Utilization'] ??
      args['Utilization (%)'],
  );
  return queueUtilDisplayValue(raw);
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

type PipeCounterOpts = {
  pipeRe: RegExp;
  /** When set, only accept this `ph:C` name (empty name still accepted). */
  counterName?: string;
  readValue: (args: Record<string, unknown> | undefined) => number | null;
};

function counterThreadsFromPipes(traceJson: unknown, opts: PipeCounterOpts): SwimThread[] {
  const events = readTraceEvents(traceJson);
  const processName = processNamesByPid(events);
  const byId = new Map<string, CounterPoint[]>();
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
    const pname = processName.get(String(e.pid ?? 0));
    if (!pname) continue;
    const m = opts.pipeRe.exec(pname);
    if (!m) continue;
    if (
      opts.counterName != null &&
      typeof e.name === 'string' &&
      e.name.length > 0 &&
      e.name !== opts.counterName
    ) {
      continue;
    }
    const v = opts.readValue(e.args);
    if (v == null) continue;
    const ts = Number(e.ts);
    if (!Number.isFinite(ts)) continue;
    const usingRaw = Number(e.args?.['Using Bytes (KB)']);
    const point: CounterPoint = { t: ts * US_TO_NS, v };
    if (Number.isFinite(usingRaw)) point.abs = usingRaw;
    const id = m[1]!;
    let points = byId.get(id);
    if (!points) {
      points = [];
      byId.set(id, points);
      order.push(id);
    }
    points.push(point);
  }

  const threads: SwimThread[] = [];
  for (const id of order) {
    const points = collapseSameTsLast(byId.get(id)!);
    if (points.length === 0) continue;
    threads.push({
      id: `counter-${id}`,
      name: id,
      events: [],
      counter: {
        points,
        yMax: yMaxForPoints(points),
        colorHex: MEMORY_UTIL_COUNTER_COLOR,
      },
    });
  }
  return threads;
}

function appendCounterProcess(
  model: SwimlaneModel,
  id: string,
  name: string,
  threads: SwimThread[],
): SwimlaneModel {
  if (threads.length === 0) return model;
  const proc: SwimProcess = { id, name, threads };
  return { ...model, processes: [...model.processes, proc] };
}

/**
 * Build counter leaf threads from populated memory-util pipes in a Chrome Trace.
 * Empty processes (metadata only) are skipped. ts µs → point `t` ns.
 */
export function memoryUtilCounterThreadsFromTrace(traceJson: unknown): SwimThread[] {
  return counterThreadsFromPipes(traceJson, {
    pipeRe: MEMORY_UTIL_PIPE_RE,
    counterName: 'memory_utilization',
    readValue: (args) => memoryUtilDisplayValue(Number(args?.['Utilization (%)'])),
  });
}

/** #209 unit util pipes → CounterTrack leaves. */
export function unitUtilCounterThreadsFromTrace(traceJson: unknown): SwimThread[] {
  return counterThreadsFromPipes(traceJson, {
    pipeRe: UNIT_UTIL_PIPE_RE,
    counterName: 'unit_utilization',
    readValue: (args) => unitUtilDisplayValue(Number(args?.['Utilization (%)'])),
  });
}

/** #206 PUSHQ exec/issue queue util pipes → CounterTrack leaves (depth Y). */
export function queueUtilCounterThreadsFromTrace(traceJson: unknown): SwimThread[] {
  return counterThreadsFromPipes(traceJson, {
    pipeRe: QUEUE_UTIL_PIPE_RE,
    readValue: readQueueUtilArg,
  });
}

/** Append a Memory utilization process with counter leaf lanes (#208). */
export function mergeMemoryUtilCounterTracks(
  model: SwimlaneModel,
  traceJson: unknown,
): SwimlaneModel {
  return appendCounterProcess(
    model,
    'p-counter-memory-util',
    'Memory utilization',
    memoryUtilCounterThreadsFromTrace(traceJson),
  );
}

/** Append a Unit utilization process with counter leaf lanes (#209). */
export function mergeUnitUtilCounterTracks(
  model: SwimlaneModel,
  traceJson: unknown,
): SwimlaneModel {
  return appendCounterProcess(
    model,
    'p-counter-unit-util',
    'Unit utilization',
    unitUtilCounterThreadsFromTrace(traceJson),
  );
}

/** Append a Queue utilization process with counter leaf lanes (#206). */
export function mergeQueueUtilCounterTracks(
  model: SwimlaneModel,
  traceJson: unknown,
): SwimlaneModel {
  return appendCounterProcess(
    model,
    'p-counter-queue-util',
    'Queue utilization',
    queueUtilCounterThreadsFromTrace(traceJson),
  );
}
