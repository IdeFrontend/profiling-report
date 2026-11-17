/**
 * Emulate Trace ph:C util pipes → swim CounterTracks (Chrome CounterTrack-like).
 * #208 memory util; #209/#206 add more pipe matchers later.
 */

import type { SwimlaneModel, SwimProcess, SwimThread } from '../domain/types';

/** Oleg / #208: optional pipes `<AIC|AIV0|AIV1>_<UB|L0A|L0B|L0C|L1>_UTILIZATION`. */
const MEMORY_UTIL_PIPE_RE =
  /^((?:AIC|AIV0|AIV1)_(?:UB|L0A|L0B|L0C|L1)_UTILIZATION)\b/i;

const US_TO_NS = 1e3;

export type CounterPoint = { t: number; v: number };

function readTraceEvents(traceJson: unknown): unknown[] {
  if (Array.isArray(traceJson)) return traceJson;
  if (traceJson && typeof traceJson === 'object') {
    const te = (traceJson as { traceEvents?: unknown }).traceEvents;
    if (Array.isArray(te)) return te;
  }
  return [];
}

/**
 * Map `Utilization (%)` for display. Emulate memory counters often emit 0..1
 * fractions (rms_norm_quant); values already in (1, 100] stay as percent.
 */
export function memoryUtilDisplayValue(raw: number): number | null {
  if (!Number.isFinite(raw) || raw < 0) return null;
  if (raw <= 1) return raw * 100;
  if (raw <= 100) return raw;
  return null;
}

/** @deprecated Prefer memoryUtilDisplayValue — kept for call-site renames during #208 retarget. */
export const memoryUtilToOverviewPercent = memoryUtilDisplayValue;

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
  // Expand slightly so a full-scale sample is not clipped to the top stroke.
  return max > 0 ? max : 1;
}

/**
 * Build counter leaf threads from populated memory-util pipes in a Chrome Trace.
 * Empty processes (metadata only) are skipped. ts µs → point `t` ns.
 */
export function memoryUtilCounterThreadsFromTrace(traceJson: unknown): SwimThread[] {
  const events = readTraceEvents(traceJson);
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
    const m = MEMORY_UTIL_PIPE_RE.exec(pname);
    if (!m) continue;
    if (typeof e.name === 'string' && e.name.length > 0 && e.name !== 'memory_utilization') {
      continue;
    }
    const v = memoryUtilDisplayValue(Number(e.args?.['Utilization (%)']));
    if (v == null) continue;
    const ts = Number(e.ts);
    if (!Number.isFinite(ts)) continue;
    const id = m[1]!;
    let points = byId.get(id);
    if (!points) {
      points = [];
      byId.set(id, points);
      order.push(id);
    }
    points.push({ t: ts * US_TO_NS, v });
  }

  const threads: SwimThread[] = [];
  for (const id of order) {
    const points = collapseSameTsLast(byId.get(id)!);
    if (points.length === 0) continue;
    threads.push({
      id: `counter-${id}`,
      name: id,
      events: [],
      counter: { points, yMax: yMaxForPoints(points) },
    });
  }
  return threads;
}

/** Append a Memory utilization process with counter leaf lanes (#208). */
export function mergeMemoryUtilCounterTracks(
  model: SwimlaneModel,
  traceJson: unknown,
): SwimlaneModel {
  const threads = memoryUtilCounterThreadsFromTrace(traceJson);
  if (threads.length === 0) return model;
  const proc: SwimProcess = {
    id: 'p-counter-memory-util',
    name: 'Memory utilization',
    threads,
  };
  return { ...model, processes: [...model.processes, proc] };
}
