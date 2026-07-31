import type { SwimEvent, SwimlaneModel, SwimProcess, SwimThread } from './types';
import { withDerivedUtilizations } from './utilization';

interface ChromeTraceEvent {
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

function key(pid: number | string | undefined, tid: number | string | undefined): string {
  return `${pid ?? 0}:${tid ?? 0}`;
}

/** Fill utilization from event coverage when metadata omits it. */
function finalizeModel(model: SwimlaneModel): SwimlaneModel {
  return withDerivedUtilizations(model);
}

export function chromeTraceToSwimlane(trace: unknown): SwimlaneModel {
  const doc = (trace ?? {}) as ChromeTraceDoc;
  const events = doc.traceEvents ?? [];

  const threadNames = new Map<string, string>();
  for (const e of events) {
    if (e.ph === 'M' && e.name === 'thread_name') {
      const label = String(e.args?.name ?? `tid-${e.tid}`);
      threadNames.set(key(e.pid, e.tid), label);
    }
  }

  const processMap = new Map<string, Map<string, SwimThread>>();
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

    const startTime = e.ts;
    const duration = e.dur;
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

  if (!Number.isFinite(minTime)) {
    minTime = 0;
    maxTime = 0;
  }

  const processes: SwimProcess[] = [...processMap.entries()].map(([pid, threads]) => ({
    id: `p-${pid}`,
    name: `Process ${pid}`,
    threads: [...threads.values()].map((t) => ({
      ...t,
      events: [...t.events].sort((a, b) => a.startTime - b.startTime),
    })),
  }));

  return finalizeModel({
    processes,
    minTime,
    maxTime,
    metadata: { displayTimeUnit: doc.displayTimeUnit },
  });
}
