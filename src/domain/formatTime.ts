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
  // Trace origin / left edge: compact zero (sketches show `0` / `0ms`, not `0.00000ms`).
  if (Math.abs(ns) < 1e-9) {
    switch (unit) {
      case 'ns':
        return '0ns';
      case 'us':
        return '0µs';
      case 'ms':
      default:
        return '0ms';
    }
  }
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
 * Convert ns → scalar in the given display unit.
 */
function nsToUnitValue(ns: number, unit: TimeDisplayUnit): number {
  switch (unit) {
    case 'ns':
      return ns;
    case 'us':
      return ns / 1e3;
    case 'ms':
    default:
      return ns / 1e6;
  }
}

/**
 * Cursor / playhead label as `MM:SS.mmm`.
 *
 * The scalar in `unit` is formatted like a clock (matches sketch: 4.456ms →
 * `00:04.456` when unit is `ms`). Short traces should pass `us`/`ns` (or use
 * {@link resolveCursorTimeUnit}) so the label updates while moving.
 */
export function formatCursorTime(ns: number, unit: TimeDisplayUnit = 'ms'): string {
  if (!Number.isFinite(ns)) return '00:00.000';
  const value = Math.max(0, nsToUnitValue(ns, unit));
  const totalThousandths = Math.round(value * 1000);
  let secs = Math.floor(totalThousandths / 1000);
  const frac = ((totalThousandths % 1000) + 1000) % 1000;
  const mins = Math.floor(secs / 60);
  secs = secs % 60;
  const minStr = String(Math.min(mins, 99)).padStart(2, '0');
  return `${minStr}:${String(secs).padStart(2, '0')}.${String(frac).padStart(3, '0')}`;
}

/**
 * Prefer a unit fine enough that cursor `MM:SS.mmm` digits change across the
 * visible span (kernel fixtures are often &lt; 1ms).
 */
export function resolveCursorTimeUnit(
  spanNs: number,
  preferred: TimeDisplayUnit,
): TimeDisplayUnit {
  if (!(spanNs > 0) || !Number.isFinite(spanNs)) return preferred;
  if (preferred === 'ns') return 'ns';
  if (spanNs < 1e3) return 'ns';
  if (spanNs < 1e6 && preferred === 'ms') return 'us';
  return preferred;
}

/**
 * Value and unit apart, for surfaces that label the unit once instead of
 * repeating it per value (sketch detail card: `7419` under `Start (ns)`).
 */
export function formatTimeParts(
  ns: number,
  unit: TimeDisplayUnit = 'ms',
): { value: string; unit: string } {
  // The unit label survives NaN/Infinity so the detail card keeps its column
  // header while the number falls back to the em dash.
  const label = unit === 'ns' ? 'ns' : unit === 'us' ? 'µs' : 'ms';
  if (!Number.isFinite(ns)) return { value: '—', unit: label };
  switch (unit) {
    case 'ns':
      return { value: `${Math.round(ns)}`, unit: label };
    case 'us':
      return { value: (ns / 1e3).toFixed(3), unit: label };
    case 'ms':
    default:
      return { value: (ns / 1e6).toFixed(3), unit: label };
  }
}

/** Format tooltip / detail times. */
export function formatTime(ns: number, unit: TimeDisplayUnit = 'ms'): string {
  // Bare em dash, not '— ms': the tooltip has no unit column to fill.
  if (!Number.isFinite(ns)) return '—';
  const parts = formatTimeParts(ns, unit);
  return `${parts.value} ${parts.unit}`;
}
