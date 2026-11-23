/**
 * Chrome Trace `ph:C` counters → swim CounterTracks (Chrome / Perfetto-like).
 * Card = process_name; lane = ph:C name; numeric args = series (folder when N>1).
 */

import { colorForCounterProcess, counterSeriesColor } from '../domain/laneColors';
import type {
  SwimCounterPoint,
  SwimCounterSeries,
  SwimlaneModel,
  SwimProcess,
  SwimThread,
} from '../domain/types';
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

/** tid 0 thread_name per pid (Chrome CounterTrack name fallback). */
function threadNamesByPid(events: unknown[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of events) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as {
      ph?: string;
      name?: string;
      pid?: unknown;
      tid?: unknown;
      args?: { name?: unknown };
    };
    if (e.ph !== 'M' || e.name !== 'thread_name') continue;
    if (Number(e.tid ?? 0) !== 0) continue;
    const label = e.args?.name;
    if (typeof label !== 'string' || label.length === 0) continue;
    out.set(String(e.pid ?? 0), label);
  }
  return out;
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

type ArgSeriesBucket = {
  argKey: string;
  points: CounterPoint[];
};

type TrackBucket = {
  pid: string;
  processName: string;
  cName: string;
  /** First-seen arg key order. */
  argOrder: string[];
  byArg: Map<string, ArgSeriesBucket>;
};

function makeSeries(
  points: CounterPoint[],
  colorHex: string,
): SwimCounterSeries {
  return {
    points,
    yMax: yMaxForPoints(points),
    colorHex,
  };
}

/**
 * Build CounterTrack processes from every populated `ph:C` track in a Chrome Trace.
 * Card = process_name; lane = ph:C name; args = series (folder when N>1).
 * Same-`ts` multi-`C` keeps last per arg series.
 */
export function counterProcessesFromTrace(
  traceJson: unknown,
  options?: ChromeTraceToSwimlaneOptions,
): SwimProcess[] {
  const events = readTraceEvents(traceJson);
  const processName = processNamesByPid(events);
  const threadName = threadNamesByPid(events);
  const toNs = resolveToNs(traceJson, options);
  /** `${pid}\0${cName}` → track bucket. */
  const byTrack = new Map<string, TrackBucket>();
  const trackOrder: string[] = [];

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
    const argKeys = Object.keys(values);
    if (argKeys.length === 0) continue;
    const pid = String(e.pid ?? 0);
    const pname = processName.get(pid) ?? `Process ${pid}`;
    const cName =
      (typeof e.name === 'string' && e.name.length > 0
        ? e.name
        : threadName.get(pid)) ?? 'counter';
    const trackId = `${pid}\0${cName}`;
    let track = byTrack.get(trackId);
    if (!track) {
      track = {
        pid,
        processName: pname,
        cName,
        argOrder: [],
        byArg: new Map(),
      };
      byTrack.set(trackId, track);
      trackOrder.push(trackId);
    }
    const t = ts * toNs;
    for (const argKey of argKeys) {
      let bucket = track.byArg.get(argKey);
      if (!bucket) {
        bucket = { argKey, points: [] };
        track.byArg.set(argKey, bucket);
        track.argOrder.push(argKey);
      }
      bucket.points.push({ t, v: values[argKey]!, values: { ...values } });
    }
  }

  const byPid = new Map<string, { name: string; threads: SwimThread[] }>();
  const pidOrder: string[] = [];

  for (const trackId of trackOrder) {
    const track = byTrack.get(trackId)!;
    const baseColor = colorForCounterProcess(track.processName);
    const seriesList: { argKey: string; series: SwimCounterSeries }[] = [];
    for (let i = 0; i < track.argOrder.length; i++) {
      const argKey = track.argOrder[i]!;
      const points = collapseSameTsLast(track.byArg.get(argKey)!.points);
      if (points.length === 0) continue;
      seriesList.push({
        argKey,
        series: makeSeries(points, counterSeriesColor(baseColor, i)),
      });
    }
    if (seriesList.length === 0) continue;

    let proc = byPid.get(track.pid);
    if (!proc) {
      proc = { name: track.processName, threads: [] };
      byPid.set(track.pid, proc);
      pidOrder.push(track.pid);
    }

    const laneId = `counter-${track.pid}-${track.cName}`;
    if (seriesList.length === 1) {
      const only = seriesList[0]!;
      proc.threads.push({
        id: laneId,
        name: track.cName,
        events: [],
        counter: only.series,
      });
      continue;
    }

    const children: SwimThread[] = seriesList.map(({ argKey, series }) => ({
      id: `${laneId}-${argKey}`,
      name: argKey,
      events: [],
      counter: series,
    }));
    proc.threads.push({
      id: laneId,
      name: track.cName,
      events: [],
      children,
      counterSeries: seriesList.map((s) => s.series),
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

/** Multi-series CounterTrack folder ids (for default collapse). */
export function counterMultiSeriesFolderIds(processes: readonly SwimProcess[]): string[] {
  const ids: string[] = [];
  for (const p of processes) {
    for (const t of p.threads) {
      if (t.children && t.children.length > 1 && (t.counterSeries?.length ?? 0) > 1) {
        ids.push(t.id);
      }
    }
  }
  return ids;
}

/**
 * Append Trace `ph:C` CounterTrack processes to a swimlane model.
 * No-op when the Trace has no usable counter series.
 * Merges multi-series folder ids into `metadata.defaultCollapsedIds`.
 */
export function mergeCounterTracksFromTrace(
  model: SwimlaneModel,
  traceJson: unknown,
  options?: ChromeTraceToSwimlaneOptions,
): SwimlaneModel {
  const procs = counterProcessesFromTrace(traceJson, options);
  if (procs.length === 0) return model;
  const folderIds = counterMultiSeriesFolderIds(procs);
  const prev = model.metadata?.defaultCollapsedIds;
  const mergedDefaults = [
    ...new Set([
      ...(Array.isArray(prev) ? prev.filter((id): id is string => typeof id === 'string') : []),
      ...folderIds,
    ]),
  ];
  return {
    ...model,
    processes: [...model.processes, ...procs],
    metadata: {
      ...model.metadata,
      ...(mergedDefaults.length > 0 ? { defaultCollapsedIds: mergedDefaults } : {}),
    },
  };
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
