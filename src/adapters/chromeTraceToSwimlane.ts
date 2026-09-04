import type {
  EventDependencies,
  EventRef,
  SwimEvent,
  SwimlaneBand,
  SwimlaneModel,
  SwimProcess,
  SwimThread,
} from '../domain/types';

export interface ChromeTraceEvent {
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

interface ChromeTraceBand {
  id?: string;
  name?: string;
  /** Producer timestamps — same unit as X `ts`/`dur`. */
  ts?: number;
  dur?: number;
}

interface ChromeTraceDoc {
  displayTimeUnit?: string;
  traceEvents?: ChromeTraceEvent[];
  /** Optional producer phase bands (e.g. ProfilerStep#N); never invented by the adapter. */
  bands?: ChromeTraceBand[];
  /**
   * Opt-in: nest flat CoreN.Cube|Vector/PIPE lanes into Card → category → Core → pipe.
   * Absent/false → leave CTEF flat (production default).
   */
  nestCardTree?: boolean;
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

/**
 * Interim DATA-36a encoding: an X event may carry a producer-stable `args.event_id`
 * and `args.dependencies` (successor ids). Without `event_id` the adapter's own
 * `e-<seq>` id stays authoritative and dependency ids cannot resolve.
 *
 * Producers write ids as either strings or numbers, so both `event_id` and the
 * `dependencies` entries share one acceptance rule: non-empty string or finite
 * number, stringified. Anything else is treated as absent.
 */
function usableId(raw: unknown): boolean {
  return (typeof raw === 'string' && raw !== '') || Number.isFinite(raw);
}

function stableId(args: Record<string, unknown> | undefined): string | undefined {
  const raw = args?.event_id;
  return usableId(raw) ? String(raw) : undefined;
}

function dependencyIds(args: Record<string, unknown> | undefined): string[] {
  const raw = args?.dependencies;
  return Array.isArray(raw) ? raw.filter(usableId).map(String) : [];
}

function extractEvents(trace: unknown): {
  events: ChromeTraceEvent[];
  displayTimeUnit?: string;
  rawBands?: ChromeTraceBand[];
  nestCardTree?: boolean;
} {
  if (Array.isArray(trace)) {
    return { events: trace as ChromeTraceEvent[] };
  }
  const doc = (trace ?? {}) as ChromeTraceDoc;
  return {
    events: doc.traceEvents ?? [],
    displayTimeUnit: doc.displayTimeUnit,
    rawBands: Array.isArray(doc.bands) ? doc.bands : undefined,
    nestCardTree: doc.nestCardTree === true,
  };
}

/** Pass through producer bands; skip malformed entries. Times converted like X events. */
function bandsFromTrace(raw: ChromeTraceBand[] | undefined, toNs: number): SwimlaneBand[] | undefined {
  if (!raw?.length) return undefined;
  const bands: SwimlaneBand[] = [];
  for (let i = 0; i < raw.length; i++) {
    const b = raw[i]!;
    if (b.ts == null || b.dur == null || !Number.isFinite(b.ts) || !Number.isFinite(b.dur)) continue;
    if (b.dur <= 0) continue;
    bands.push({
      id: typeof b.id === 'string' && b.id !== '' ? b.id : `band-${i}`,
      name: typeof b.name === 'string' && b.name !== '' ? b.name : `Band#${i + 1}`,
      startTime: b.ts * toNs,
      duration: b.dur * toNs,
    });
  }
  return bands.length > 0 ? bands : undefined;
}

export function chromeTraceToSwimlane(
  trace: unknown,
  options?: ChromeTraceToSwimlaneOptions,
): SwimlaneModel {
  const { events, displayTimeUnit, rawBands, nestCardTree } = extractEvents(trace);
  /**
   * CTEF: `ts`/`dur` are always microseconds; `displayTimeUnit` is display-only.
   * Ascend producers (`.rep` embeds and exported JSON) store genuine ns when they
   * set `displayTimeUnit: "ns"` — honor that producer convention when no override.
   */
  const sourceUnit: TraceSourceTimeUnit =
    options?.sourceTimeUnit ??
    (String(displayTimeUnit ?? '').trim().toLowerCase() === 'ns' ? 'ns' : 'us');
  const toNs = unitToNsFactor(sourceUnit);
  const bands = bandsFromTrace(rawBands, toNs);

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
  const usedIds = new Set<string>();
  const flowStarts = new Map<string, AsyncEndpoint[]>();
  const flowFinishes = new Map<string, AsyncEndpoint[]>();
  /** `args.dependencies` targets, resolved to refs once events are sorted. */
  const declaredDeps: { event: SwimEvent; targets: string[] }[] = [];
  let minTime = Number.POSITIVE_INFINITY;
  let maxTime = Number.NEGATIVE_INFINITY;
  let eventSeq = 0;

  for (const e of events) {
    if (e.ph === 's' || e.ph === 'f') {
      if (e.id == null || e.ts == null) continue;
      const endpoint: AsyncEndpoint = {
        ts: e.ts * toNs,
        pid: String(e.pid ?? 0),
        tid: String(e.tid ?? 0),
      };
      const bucket = e.ph === 's' ? flowStarts : flowFinishes;
      const id = key(e.pid, e.id);
      const q = bucket.get(id);
      if (q) q.push(endpoint);
      else bucket.set(id, [endpoint]);
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

    const seqId = `e-${eventSeq++}`;
    // A producer id that another event already claimed would collapse two events into
    // one: the later wins in every id-keyed map (dependency graph, hit-test, selection).
    // Keep the first claimant; a duplicate — or a producer squatting an `e-<seq>` id —
    // falls back to the next free sequence id.
    const stable = stableId(e.args);
    let id = stable !== undefined && !usedIds.has(stable) ? stable : seqId;
    while (usedIds.has(id)) id = `e-${eventSeq++}`;
    usedIds.add(id);
    const ev: SwimEvent = {
      id,
      name: e.name ?? 'event',
      startTime,
      duration,
      args: e.args,
    };
    const deps = dependencyIds(e.args);
    if (deps.length > 0) {
      declaredDeps.push({ event: ev, targets: deps });
    }
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

  const connectionPairs = pairAsyncFlows(flowStarts, flowFinishes);
  const nestByThread = new Map<SwimThread, Int32Array>();
  for (const threads of processMap.values()) {
    for (const thread of threads.values()) {
      // longest first: nestParents assumes enclosing-before-nested on ties
      thread.events.sort((a, b) => a.startTime - b.startTime || b.duration - a.duration);
      if (connectionPairs.length > 0) nestByThread.set(thread, nestParents(thread.events));
    }
  }
  if (connectionPairs.length > 0) {
    linkAsyncDependencies(processMap, connectionPairs, nestByThread);
  }
  if (declaredDeps.length > 0) {
    linkDeclaredDependencies(processMap, declaredDeps);
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
    ...(bands ? { bands } : {}),
    metadata: {
      displayTimeUnit,
      ...(nestCardTree ? { nestCardTree: true } : {}),
    },
  };
}

/** Pair each id's starts/finishes by timestamp so file order (f before s) still links. */
function pairAsyncFlows(
  starts: Map<string, AsyncEndpoint[]>,
  finishes: Map<string, AsyncEndpoint[]>,
): LinkedFlow[] {
  const pairs: LinkedFlow[] = [];
  for (const [id, sList] of starts) {
    const fList = finishes.get(id);
    if (!fList) continue;
    sList.sort((a, b) => a.ts - b.ts);
    fList.sort((a, b) => a.ts - b.ts);
    let j = 0;
    for (const start of sList) {
      while (j < fList.length && fList[j]!.ts < start.ts) j++;
      const end = fList[j];
      if (!end) break;
      pairs.push({ start, end });
      j++;
    }
  }
  return pairs;
}

function linkAsyncDependencies(
  processMap: Map<string, Map<string, SwimThread>>,
  connectionPairs: LinkedFlow[],
  nestByThread: Map<SwimThread, Int32Array>,
): void {
  const seenSucc = new Map<SwimEvent, Set<string>>();
  const seenPred = new Map<SwimEvent, Set<string>>();
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
    pushRef(ensureDeps(parent).successors, seenSet(seenSucc, parent), childRef);
    pushRef(ensureDeps(child).predecessors, seenSet(seenPred, child), parentRef);
  }
}

/**
 * Nearest enclosing event index per event (`-1` = none). Call-stack stack: pop
 * intervals that ended at or before this start (touching slices are siblings).
 */
export function nestParents(events: SwimEvent[]): Int32Array {
  const parent = new Int32Array(events.length).fill(-1);
  const stack: number[] = [];
  for (let i = 0; i < events.length; i++) {
    const start = events[i]!.startTime;
    while (stack.length > 0) {
      const top = events[stack[stack.length - 1]!]!;
      if (top.startTime + top.duration <= start) stack.pop();
      else break;
    }
    if (stack.length > 0) parent[i] = stack[stack.length - 1]!;
    stack.push(i);
  }
  return parent;
}

/**
 * Innermost event whose inclusive `[startTime, startTime+duration]` contains `timestamp`.
 * Events must be sorted startTime asc, longest duration first on ties. Walks the
 * enclosing-parent chain from the last start ≤ ts so a gap does not scan the whole prefix.
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

function pushRef(list: EventRef[], seen: Set<string>, ref: EventRef): void {
  const key = `${ref.tid}:${ref.index}`;
  if (seen.has(key)) return;
  seen.add(key);
  list.push(ref);
}

function seenSet(map: Map<SwimEvent, Set<string>>, event: SwimEvent): Set<string> {
  let keys = map.get(event);
  if (!keys) {
    keys = new Set();
    map.set(event, keys);
  }
  return keys;
}

/**
 * Interim DATA-36a: `args.dependencies` names successor event ids, which only become
 * positions once every thread is sorted. Targets the model does not contain are
 * dropped — a dangling id would otherwise render as a link to nothing.
 */
function linkDeclaredDependencies(
  processMap: Map<string, Map<string, SwimThread>>,
  declared: { event: SwimEvent; targets: string[] }[],
): void {
  const byId = new Map<string, { event: SwimEvent; ref: EventRef }>();
  for (const threads of processMap.values()) {
    for (const thread of threads.values()) {
      thread.events.forEach((event, index) => {
        byId.set(event.id, { event, ref: { tid: thread.id, index } });
      });
    }
  }
  const seenSucc = new Map<SwimEvent, Set<string>>();
  const seenPred = new Map<SwimEvent, Set<string>>();
  for (const { event, targets } of declared) {
    const from = byId.get(event.id);
    if (!from) continue;
    for (const targetId of targets) {
      const to = byId.get(targetId);
      if (!to || to.event === event) continue;
      pushRef(ensureDeps(event).successors, seenSet(seenSucc, event), to.ref);
      pushRef(ensureDeps(to.event).predecessors, seenSet(seenPred, to.event), from.ref);
    }
  }
}
