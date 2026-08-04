import type { TimeDisplayUnit } from './types';

function decimalsForStep(step: number): number {
  if (!(step > 0) || !Number.isFinite(step)) return 3;
  if (step >= 1) return 1;
  if (step >= 0.1) return 2;
  if (step >= 0.01) return 3;
  if (step >= 0.001) return 4;
  return 5;
}

/**
 * Format axis tick labels.
 * When `tickStepNs` is provided, decimal places follow tick spacing so zoomed
 * axes do not collapse to identical labels.
 */
export function formatAxisTime(
  ns: number,
  unit: TimeDisplayUnit = 'ms',
  tickStepNs?: number,
): string {
  if (!Number.isFinite(ns)) return '—';
  switch (unit) {
    case 'ns': {
      const step = tickStepNs != null ? Math.abs(tickStepNs) : 1;
      if (step >= 1) return `${Math.round(ns)}ns`;
      return `${ns.toFixed(decimalsForStep(step))}ns`;
    }
    case 'us': {
      const v = ns / 1e3;
      const step = tickStepNs != null ? Math.abs(tickStepNs) / 1e3 : undefined;
      const d = step != null ? decimalsForStep(step) : Math.abs(v) >= 10 ? 1 : 2;
      return `${v.toFixed(d)}µs`;
    }
    case 'ms':
    default: {
      const v = ns / 1e6;
      const step = tickStepNs != null ? Math.abs(tickStepNs) / 1e6 : undefined;
      const d =
        step != null
          ? decimalsForStep(step)
          : Math.abs(v) >= 1
            ? 1
            : Math.abs(v) >= 0.01
              ? 3
              : 4;
      return `${v.toFixed(d)}ms`;
    }
  }
}

/**
 * Cursor / playhead label as `MM:SS.mmm` from absolute nanoseconds → real seconds.
 * Example: 4_456_000_000 ns (4.456 s) → `00:04.456`.
 */
export function formatCursorTime(ns: number): string {
  if (!Number.isFinite(ns)) return '00:00.000';
  const totalMs = Math.max(0, ns / 1e6);
  const totalMillis = Math.round(totalMs);
  let secs = Math.floor(totalMillis / 1000);
  const frac = totalMillis % 1000;
  const mins = Math.floor(secs / 60);
  secs = secs % 60;
  // Bound minutes display for very long traces (still readable)
  const minStr = String(mins).padStart(2, '0');
  return `${minStr}:${String(secs).padStart(2, '0')}.${String(frac).padStart(3, '0')}`;
}

/** Format tooltip / detail times. */
export function formatTime(ns: number, unit: TimeDisplayUnit = 'ms'): string {
  if (!Number.isFinite(ns)) return '—';
  switch (unit) {
    case 'ns':
      return `${Math.round(ns)} ns`;
    case 'us':
      return `${(ns / 1e3).toFixed(3)} µs`;
    case 'ms':
    default:
      return `${(ns / 1e6).toFixed(3)} ms`;
  }
}
