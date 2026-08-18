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

interface LinkedFlow {
  start: AsyncEndpoint;
  end: AsyncEndpoint;
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
  const openStarts = new Map<string, AsyncEndpoint[]>();
  const connectionPairs: LinkedFlow[] = [];
  let minTime = Number.POSITIVE_INFINITY;
  let maxTime = Number.NEGATIVE_INFINITY;
  let eventSeq = 0;

  for (const e of events) {
    if (e.ph === 's' || e.ph === 'f') {
      if (e.id == null || e.ts == null) continue;
      const id = String(e.id);
      const endpoint: AsyncEndpoint = {
        ts: e.ts * toNs,
        pid: String(e.pid ?? 0),
        tid: String(e.tid ?? 0),
      };
      if (e.ph === 's') {
        const q = openStarts.get(id);
        if (q) q.push(endpoint);
        else openStarts.set(id, [endpoint]);
      } else {
        const start = openStarts.get(id)?.shift();
        if (start && start.ts <= endpoint.ts) connectionPairs.push({ start, end: endpoint });
      }
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

  const nestByThread = new Map<SwimThread, Int32Array>();
  for (const threads of processMap.values()) {
    for (const thread of threads.values()) {
      thread.events.sort((a, b) => a.startTime - b.startTime);
      if (connectionPairs.length > 0) nestByThread.set(thread, nestParents(thread.events));
    }
  }
  if (connectionPairs.length > 0) {
    linkAsyncDependencies(processMap, connectionPairs, nestByThread);
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
  connectionPairs: LinkedFlow[],
  nestByThread: Map<SwimThread, Int32Array>,
): void {
  for (const pair of connectionPairs) {
    const start = pair.start;
    const end = pair.end;

    const parentThread = processMap.get(start.pid)?.get(start.tid);
    const childThread = processMap.get(end.pid)?.get(end.tid);
    if (!parentThread || !childThread) continue;

    const parentIndex = findEventIndex(parentThread.events, start.ts, nestByThread.get(parentThread)!);
    const childIndex = findEventIndex(childThread.events, end.ts, nestByThread.get(childThread)!);
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
 * Nearest enclosing event index per event (`-1` = none). Call-stack stack: pop
 * intervals that ended before this start, then the remaining top is the parent.
 */
function nestParents(events: SwimEvent[]): Int32Array {
  const parent = new Int32Array(events.length).fill(-1);
  const stack: number[] = [];
  for (let i = 0; i < events.length; i++) {
    const start = events[i]!.startTime;
    while (stack.length > 0) {
      const top = events[stack[stack.length - 1]!]!;
      if (top.startTime + top.duration < start) stack.pop();
      else break;
    }
    if (stack.length > 0) parent[i] = stack[stack.length - 1]!;
    stack.push(i);
  }
  return parent;
}

/**
 * Innermost event whose inclusive `[startTime, startTime+duration]` contains `timestamp`.
 * Events must be sorted by startTime. Walks the enclosing-parent chain from the last
 * start ≤ ts so a gap does not scan the whole prefix.
 */
function findEventIndex(events: SwimEvent[], timestamp: number, parent: Int32Array): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid]!.startTime <= timestamp) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo - 1; i >= 0; i = parent[i]!) {
    const event = events[i]!;
    if (timestamp <= event.startTime + event.duration) return i;
  }
  return -1;
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
