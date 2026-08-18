import type { SwimEvent, SwimlaneModel, SwimProcess, SwimThread } from '../domain/types';

export interface ChromeTraceEvent {
  ph?: string;
  name?: string;
  pid?: number | string;
  tid?: number | string;
  ts?: number;
  dur?: number;
  cat?: string;
  args?: Record<string, unknown>;
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

/**
 * Interim I-Q9 encoding: an X event may carry a producer-stable `args.event_id`
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
  const usedIds = new Set<string>();
  let minTime = Number.POSITIVE_INFINITY;
  let maxTime = Number.NEGATIVE_INFINITY;
  let eventSeq = 0;

  for (const e of events) {
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
      ev.dependencies = deps;
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

  const processes: SwimProcess[] = [...processMap.entries()].map(([pid, threads]) => ({
    id: `p-${pid}`,
    name: processNames.get(pid) ?? `Process ${pid}`,
    threads: [...threads.values()].map((t) => ({
      ...t,
      events: [...t.events].sort((a, b) => a.startTime - b.startTime),
    })),
  }));

  return {
    processes,
    minTime,
    maxTime,
    metadata: { displayTimeUnit },
  };
}
