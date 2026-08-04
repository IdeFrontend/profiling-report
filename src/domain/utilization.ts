import type { SwimlaneModel, SwimThread } from './types';

/** Merge overlapping [start, end) intervals; returns total covered length. */
export function coveredLength(intervals: Array<{ start: number; end: number }>): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end);
  let total = 0;
  let curStart = sorted[0]!.start;
  let curEnd = sorted[0]!.end;
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!;
    if (next.start <= curEnd) {
      curEnd = Math.max(curEnd, next.end);
    } else {
      total += Math.max(0, curEnd - curStart);
      curStart = next.start;
      curEnd = next.end;
    }
  }
  total += Math.max(0, curEnd - curStart);
  return total;
}

/** Busy fraction of [minTime, maxTime] covered by event intervals (overlaps merged, clamped 0..1). */
export function computeThreadUtilization(
  thread: SwimThread,
  minTime: number,
  maxTime: number,
): number {
  const span = maxTime - minTime;
  if (!(span > 0)) return 0;
  const intervals: Array<{ start: number; end: number }> = [];
  for (const ev of thread.events) {
    const start = Math.max(ev.startTime, minTime);
    const end = Math.min(ev.startTime + ev.duration, maxTime);
    if (end > start) intervals.push({ start, end });
  }
  return Math.min(1, coveredLength(intervals) / span);
}

/** Fill missing `utilization` from event coverage over the model time range. */
export function withDerivedUtilizations(model: SwimlaneModel): SwimlaneModel {
  return {
    ...model,
    processes: model.processes.map((p) => ({
      ...p,
      threads: p.threads.map((t) => ({
        ...t,
        utilization:
          t.utilization ??
          computeThreadUtilization(t, model.minTime, model.maxTime),
      })),
    })),
  };
}
