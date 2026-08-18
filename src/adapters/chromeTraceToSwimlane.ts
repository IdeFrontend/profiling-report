import type {
  EventDependencies,
  EventRef,
  SwimEvent,
  SwimlaneModel,
  SwimProcess,
  SwimThread,
} from '../domain/types';

interface ChromeTraceEvent {
  ph?: string;
  name?: string;
  pid?: number | string;
  tid?: number | string;
  ts?: number;
  dur?: number;
  cat?: string;
  id?: string | number;
  args?: Record<string, unknown>;
}

/** Async/flow endpoint after ns conversion. Paired by trace `id`. */
interface AsyncEndpoint {
  ts: number;
  pid: string;
  tid: string;
}

interface ConnectionPair {
  start: AsyncEndpoint | null;
  end: AsyncEndpoint | null;
}

interface ChromeTraceDoc {
  displayTimeUnit?: string;
  traceEvents?: ChromeTraceEvent[];
}

/** Explicit source units for `ts`/`dur` (canonical model is always ns). */
export type TraceSourceTimeUnit = 'ns' | 'us' | 'ms' | 's';

/**
 * Convert producer `ts`/`dur` into nanoseconds.
 * CTEF: `ts`/`dur` are always microseconds; `displayTimeUnit` is display-only.
 * Ascend `.rep` embeds pass `sourceTimeUnit: 'ns'`.
 */
export function unitToNsFactor(sourceTimeUnit: TraceSourceTimeUnit | string | undefined): number {
  const raw = (sourceTimeUnit ?? 'us').trim().toLowerCase();
  const u = raw.replace('µ', 'u').replace('μ', 'u');
  if (u === 'ns') return 1;
  if (u === 'us' || u === 'usec' || u === 'microsecond' || u === 'microseconds') return 1000;
  if (u === 'ms') return 1_000_000;
  if (u === 's' || u === 'sec' || u === 'second' || u === 'seconds') return 1_000_000_000;
  throw new Error(
    `[profiling-report] chromeTraceToSwimlane: unsupported sourceTimeUnit ${JSON.stringify(sourceTimeUnit)}`,
  );
}

export interface ChromeTraceToSwimlaneOptions {
  /**
   * Unit of `ts`/`dur` in the payload.
   * Default `'us'` (Chrome Trace Event Format). Ascend `.rep` embeds use `'ns'`.
   */
  sourceTimeUnit?: TraceSourceTimeUnit;
}

function key(pid: number | string | undefined, tid: number | string | undefined): string {
  return `${pid ?? 0}:${tid ?? 0}`;
}

function extractEvents(trace: unknown): { events: ChromeTraceEvent[]; displayTimeUnit?: string } {
  if (Array.isArray(trace)) {
    return { events: trace as ChromeTraceEvent[] };
  }
  const doc = (trace ?? {}) as ChromeTraceDoc;
  return { events: doc.traceEvents ?? [], displayTimeUnit: doc.displayTimeUnit };
}

export function chromeTraceToSwimlane(
  trace: unknown,
  options?: ChromeTraceToSwimlaneOptions,
): SwimlaneModel {
  const { events, displayTimeUnit } = extractEvents(trace);
  /**
   * CTEF: `ts`/`dur` are always microseconds; `displayTimeUnit` is display-only.
   * Ascend producers (`.rep` embeds and exported JSON) store genuine ns when they
   * set `displayTimeUnit: "ns"` — honor that producer convention when no override.
   */
  const sourceUnit: TraceSourceTimeUnit =
    options?.sourceTimeUnit ??
    (String(displayTimeUnit ?? '').trim().toLowerCase() === 'ns' ? 'ns' : 'us');
  const toNs = unitToNsFactor(sourceUnit);

  const threadNames = new Map<string, string>();
  const processNames = new Map<string, string>();
  for (const e of events) {
    if (e.ph !== 'M') continue;
    if (e.name === 'thread_name') {
      const label = String(e.args?.name ?? `tid-${e.tid}`);
      threadNames.set(key(e.pid, e.tid), label);
    } else if (e.name === 'process_name') {
      processNames.set(String(e.pid ?? 0), String(e.args?.name ?? `Process ${e.pid}`));
    }
  }

  const processMap = new Map<string, Map<string, SwimThread>>();
  const connectionPairs = new Map<string, ConnectionPair>();
  let minTime = Number.POSITIVE_INFINITY;
  let maxTime = Number.NEGATIVE_INFINITY;
  let eventSeq = 0;

  for (const e of events) {
    if (e.ph === 's' || e.ph === 'f') {
      if (e.id == null || e.ts == null) continue;
      const id = String(e.id);
      let pair = connectionPairs.get(id);
      if (!pair) {
        pair = { start: null, end: null };
        connectionPairs.set(id, pair);
      }
      const endpoint: AsyncEndpoint = {
        ts: e.ts * toNs,
        pid: String(e.pid ?? 0),
        tid: String(e.tid ?? 0),
      };
      if (e.ph === 's') pair.start = endpoint;
      else pair.end = endpoint;
      continue;
    }

    if (e.ph !== 'X' || e.ts == null || e.dur == null) continue;
    const pid = String(e.pid ?? 0);
    const tid = String(e.tid ?? 0);
    const k = key(e.pid, e.tid);

    let threads = processMap.get(pid);
    if (!threads) {
      threads = new Map();
      processMap.set(pid, threads);
    }
    let thread = threads.get(tid);
    if (!thread) {
      thread = {
        id: `t-${pid}-${tid}`,
        name: threadNames.get(k) ?? `tid-${tid}`,
        events: [],
      };
      threads.set(tid, thread);
    }

    const startTime = e.ts * toNs;
    const duration = e.dur * toNs;
    minTime = Math.min(minTime, startTime);
    maxTime = Math.max(maxTime, startTime + duration);

    const ev: SwimEvent = {
      id: `e-${eventSeq++}`,
      name: e.name ?? 'event',
      startTime,
      duration,
      args: e.args,
    };
    if (e.cat) {
      ev.args = { ...ev.args, cat: e.cat };
    }
    thread.events.push(ev);
  }

  if (!Number.isFinite(minTime) || eventSeq === 0) {
    throw new Error(
      '[profiling-report] chromeTraceToSwimlane: no complete X events (ts+dur) in trace',
    );
  }

  for (const threads of processMap.values()) {
    for (const thread of threads.values()) {
      thread.events.sort((a, b) => a.startTime - b.startTime);
    }
  }
  if (connectionPairs.size > 0) {
    linkAsyncDependencies(processMap, connectionPairs);
  }

  const processes: SwimProcess[] = [...processMap.entries()].map(([pid, threads]) => ({
    id: `p-${pid}`,
    name: processNames.get(pid) ?? `Process ${pid}`,
    threads: [...threads.values()],
  }));

  return {
    processes,
    minTime,
    maxTime,
    metadata: { displayTimeUnit },
  };
}

function linkAsyncDependencies(
  processMap: Map<string, Map<string, SwimThread>>,
  connectionPairs: Map<string, ConnectionPair>,
): void {
  for (const pair of connectionPairs.values()) {
    const start = pair.start;
    const end = pair.end;
    if (!start || !end || start.ts > end.ts) continue;

    const parentThread = processMap.get(start.pid)?.get(start.tid);
    const childThread = processMap.get(end.pid)?.get(end.tid);
    if (!parentThread || !childThread) continue;

    const parentIndex = findEventIndex(parentThread.events, start.ts);
    const childIndex = findEventIndex(childThread.events, end.ts);
    if (parentIndex < 0 || childIndex < 0) continue;

    const parent = parentThread.events[parentIndex]!;
    const child = childThread.events[childIndex]!;
    if (parent === child) continue;
    const childRef: EventRef = { tid: childThread.id, index: childIndex };
    const parentRef: EventRef = { tid: parentThread.id, index: parentIndex };
    pushUniqueRef(ensureDeps(parent).successors, childRef);
    pushUniqueRef(ensureDeps(child).predecessors, parentRef);
  }
}

/**
 * Innermost event whose inclusive `[startTime, startTime+duration]` contains `timestamp`.
 * Events must be sorted by startTime. Nested X intervals are a call stack: walk left from
 * the first start > ts and keep the latest start (then shortest duration) that still contains.
 */
function findEventIndex(events: SwimEvent[], timestamp: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid]!.startTime <= timestamp) lo = mid + 1;
    else hi = mid;
  }
  let best = -1;
  let bestStart = Number.NEGATIVE_INFINITY;
  let bestDur = Number.POSITIVE_INFINITY;
  for (let i = lo - 1; i >= 0; i--) {
    const event = events[i]!;
    if (best >= 0 && event.startTime < bestStart) break;
    if (timestamp > event.startTime + event.duration) continue;
    if (best < 0 || event.duration < bestDur) {
      best = i;
      bestStart = event.startTime;
      bestDur = event.duration;
    }
  }
  return best;
}

function ensureDeps(event: SwimEvent): EventDependencies {
  let deps = event.dependencies;
  if (!deps) {
    deps = { predecessors: [], successors: [] };
    event.dependencies = deps;
  }
  return deps;
}

function pushUniqueRef(list: EventRef[], ref: EventRef): void {
  if (!list.some((r) => r.tid === ref.tid && r.index === ref.index)) {
    list.push(ref);
  }
}
