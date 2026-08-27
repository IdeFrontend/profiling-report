import type { TimeScaleUnit } from './types';

const GROUP_MIN = 1000;

function decimalsForStep(step: number): number {
  if (!(step > 0) || !Number.isFinite(step)) return 3;
  if (step >= 1) return 1;
  if (step >= 0.1) return 2;
  if (step >= 0.01) return 3;
  if (step >= 0.001) return 4;
  return 5;
}

/** Map a time quantum (span or major tick step, ns) to a display scale. */
export function timeScaleUnitFromNsQuantum(quantumNs: number): TimeScaleUnit {
  if (!(quantumNs > 0) || !Number.isFinite(quantumNs)) return 'ns';
  if (quantumNs >= 1e9) return 's';
  if (quantumNs >= 1e6) return 'ms';
  if (quantumNs >= 1e3) return 'us';
  return 'ns';
}

/** Viewport / chrome: one unit from the visible window length. */
export function resolveTimeUnitFromVisibleRange(spanNs: number): TimeScaleUnit {
  return timeScaleUnitFromNsQuantum(spanNs);
}

function nsToUnitValue(ns: number, unit: TimeScaleUnit): number {
  switch (unit) {
    case 'ns':
      return ns;
    case 'us':
      return ns / 1e3;
    case 'ms':
      return ns / 1e6;
    case 's':
      return ns / 1e9;
  }
}

function unitSuffix(unit: TimeScaleUnit): string {
  switch (unit) {
    case 'ns':
      return 'ns';
    case 'us':
      return 'µs';
    case 'ms':
      return 'ms';
    case 's':
      return 's';
  }
}

/** Space-group thousands when |value| ≥ 1000 (e.g. `1 800 000`). */
function groupIntegerDigits(intPart: string): string {
  const neg = intPart.startsWith('-');
  const digits = neg ? intPart.slice(1) : intPart;
  const groups: string[] = [];
  for (let i = digits.length; i > 0; i -= 3) {
    groups.unshift(digits.slice(Math.max(0, i - 3), i));
  }
  return (neg ? '-' : '') + groups.join(' ');
}

function formatMagnitude(value: number, fractionDigits?: number): string {
  if (!Number.isFinite(value)) return '—';
  if (fractionDigits != null) {
    if (Math.abs(value) < GROUP_MIN) return value.toFixed(fractionDigits);
    const fixed = value.toFixed(fractionDigits);
    const dot = fixed.indexOf('.');
    if (dot < 0) return groupIntegerDigits(fixed);
    return groupIntegerDigits(fixed.slice(0, dot)) + fixed.slice(dot);
  }
  const rounded = Math.round(value);
  if (Math.abs(rounded) < GROUP_MIN) return String(rounded);
  return groupIntegerDigits(String(rounded));
}

/**
 * Format axis tick labels.
 * When `tickStepNs` is provided, decimal places follow tick spacing so zoomed
 * axes do not collapse to identical labels.
 */
export function formatAxisTime(
  ns: number,
  unit: TimeScaleUnit = 'ms',
  tickStepNs?: number,
): string {
  if (!Number.isFinite(ns)) return '—';
  if (Math.abs(ns) < 1e-9) return `0${unitSuffix(unit)}`;

  switch (unit) {
    case 'ns': {
      const step = tickStepNs != null ? Math.abs(tickStepNs) : 1;
      if (step >= 1) return `${formatMagnitude(ns)}ns`;
      return `${formatMagnitude(ns, decimalsForStep(step))}ns`;
    }
    case 'us': {
      const v = ns / 1e3;
      const step = tickStepNs != null ? Math.abs(tickStepNs) / 1e3 : undefined;
      const d = step != null ? decimalsForStep(step) : Math.abs(v) >= 10 ? 1 : 2;
      return `${formatMagnitude(v, d)}µs`;
    }
    case 's': {
      const v = ns / 1e9;
      const step = tickStepNs != null ? Math.abs(tickStepNs) / 1e9 : undefined;
      const d =
        step != null
          ? decimalsForStep(step)
          : Math.abs(v) >= 1
            ? 1
            : Math.abs(v) >= 0.01
              ? 3
              : 4;
      return `${formatMagnitude(v, d)}s`;
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
      return `${formatMagnitude(v, d)}ms`;
    }
  }
}

/**
 * Cursor / playhead label as `MM:SS.mmm` in the resolved time scale
 * (sketch: 4.456ms → `00:04.456`).
 */
export function formatCursorTime(ns: number, unit: TimeScaleUnit = 'ms'): string {
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
 * Value and unit apart, for surfaces that label the unit once instead of
 * repeating it per value (sketch detail card: `7419` under `Start (ns)`).
 */
export function formatTimeParts(
  ns: number,
  unit: TimeScaleUnit = 'ms',
): { value: string; unit: string } {
  const label = unitSuffix(unit);
  if (!Number.isFinite(ns)) return { value: '—', unit: label };
  switch (unit) {
    case 'ns':
      return { value: formatMagnitude(ns), unit: label };
    case 'us':
      return { value: formatMagnitude(ns / 1e3, 3), unit: label };
    case 's':
      return { value: formatMagnitude(ns / 1e9, 3), unit: label };
    case 'ms':
    default:
      return { value: formatMagnitude(ns / 1e6, 3), unit: label };
  }
}

/** Format tooltip / detail times. */
export function formatTime(ns: number, unit: TimeScaleUnit = 'ms'): string {
  if (!Number.isFinite(ns)) return '—';
  const parts = formatTimeParts(ns, unit);
  return `${parts.value} ${parts.unit}`;
}

/**
 * Display an absolute model timestamp relative to a shared origin (usually
 * `SwimlaneModel.minTime`), matching PyPTO / Perfetto Timecode defaults.
 */
export function formatDisplayTime(
  ns: number,
  origin: number,
  unit: TimeScaleUnit = 'ms',
): string {
  return formatTime(ns - origin, unit);
}

/** Like {@link formatTimeParts} but relative to `origin` (start/end columns). */
export function formatDisplayTimeParts(
  ns: number,
  origin: number,
  unit: TimeScaleUnit = 'ms',
): { value: string; unit: string } {
  return formatTimeParts(ns - origin, unit);
}
