import type { SwimCounterPoint, SwimlaneModel, SwimThread } from './types';

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

/**
 * True when a CounterTrack series key is a utilization / percent quantity ([DATA-59]).
 * Queue depth and byte series are never ratio keys even if the name contains "utilization".
 */
export function isRatioUtilizationKey(seriesKey: string): boolean {
  if (/queue/i.test(seriesKey)) return false;
  if (/KB|\bbytes\b/i.test(seriesKey)) return false;
  if (/%/.test(seriesKey)) return true;
  if (/利用率/.test(seriesKey)) return true;
  if (/utili[sz]ation/i.test(seriesKey)) return true;
  return false;
}

/**
 * Time-weighted mean of a step-after counter series over [minTime, maxTime].
 * Each sample holds until the next; the last sample holds to maxTime.
 */
export function timeWeightedCounterMean(
  points: readonly SwimCounterPoint[],
  minTime: number,
  maxTime: number,
): number | undefined {
  if (!(maxTime > minTime) || points.length === 0) return undefined;
  const sorted =
    points.length === 1
      ? points
      : [...points].sort((a, b) => a.t - b.t || a.v - b.v);
  let sum = 0;
  let dur = 0;
  for (let i = 0; i < sorted.length; i++) {
    const t0 = sorted[i]!.t;
    const t1 = i + 1 < sorted.length ? sorted[i + 1]!.t : maxTime;
    const a = Math.max(t0, minTime);
    const b = Math.min(t1, maxTime);
    if (b > a) {
      sum += sorted[i]!.v * (b - a);
      dur += b - a;
    }
  }
  if (!(dur > 0)) return undefined;
  return sum / dur;
}

/**
 * Gutter utilization as 0..1 for a ratio CounterTrack leaf, or undefined when absolute / empty.
 * Scale: yMax ≤ 1 → samples are fractions (×100); else already-percent ([DATA-59]).
 */
export function counterUtilizationFraction(
  thread: SwimThread,
  minTime: number,
  maxTime: number,
): number | undefined {
  const series = thread.counter;
  if (!series || !isRatioUtilizationKey(thread.name)) return undefined;
  const mean = timeWeightedCounterMean(series.points, minTime, maxTime);
  if (mean == null || !Number.isFinite(mean)) return undefined;
  const asPercent = series.yMax <= 1 ? mean * 100 : mean;
  if (!Number.isFinite(asPercent)) return undefined;
  return Math.min(1, Math.max(0, asPercent / 100));
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
