import type { SwimlaneModel, SwimThread } from './types';

/** Busy fraction of [minTime, maxTime] covered by event intervals (clamped 0..1). */
export function computeThreadUtilization(
  thread: SwimThread,
  minTime: number,
  maxTime: number,
): number {
  const span = maxTime - minTime;
  if (!(span > 0)) return 0;
  let busy = 0;
  for (const ev of thread.events) {
    const start = Math.max(ev.startTime, minTime);
    const end = Math.min(ev.startTime + ev.duration, maxTime);
    if (end > start) busy += end - start;
  }
  return Math.min(1, busy / span);
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
