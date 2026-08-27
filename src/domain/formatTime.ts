import type { TimeScaleUnit } from './types';

const GROUP_MIN = 1000;

/** Uniform axis fraction digits from tick step in display units (0 when step is integral). */
function axisFractionDigitsFromStep(stepInUnit: number): number {
  if (!(stepInUnit > 0) || !Number.isFinite(stepInUnit)) return 0;
  const eps = 1e-9 * Math.max(1, Math.abs(stepInUnit));
  if (Math.abs(stepInUnit - Math.round(stepInUnit)) < eps) return 0;
  for (let d = 1; d <= 9; d++) {
    const scaled = stepInUnit * 10 ** d;
    if (Math.abs(scaled - Math.round(scaled)) < eps * 10 ** d) return d;
  }
  return 9;
}

function unitQuantumNs(unit: TimeScaleUnit): number {
  switch (unit) {
    case 'ns':
      return 1;
    case 'us':
      return 1e3;
    case 'ms':
      return 1e6;
    case 's':
      return 1e9;
  }
}

function axisFractionDigits(tickStepNs: number | undefined, unit: TimeScaleUnit): number {
  if (tickStepNs == null) return 0;
  return axisFractionDigitsFromStep(Math.abs(tickStepNs) / unitQuantumNs(unit));
}

function formatAxisValue(value: number, fractionDigits: number): string {
  return fractionDigits === 0
    ? formatMagnitude(value)
    : formatMagnitude(value, fractionDigits);
}

/** Compact axis zero — always `0` + suffix, never `0.0…`. */
function isAxisCompactZero(value: number, fractionDigits: number): boolean {
  if (!Number.isFinite(value) || value === 0) return value === 0;
  if (fractionDigits === 0) return false;
  return Math.round(value * 10 ** fractionDigits) === 0;
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

  const suffix = unitSuffix(unit);
  const v = nsToUnitValue(ns, unit);
  const fractionDigits = axisFractionDigits(tickStepNs, unit);

  if (isAxisCompactZero(v, fractionDigits)) return `0${suffix}`;

  return `${formatAxisValue(v, fractionDigits)}${suffix}`;
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

/** Viewport axis coarse base — integral value only (no decimal point). */
export function formatAxisBaseTime(ns: number, unit: TimeScaleUnit): string {
  if (!Number.isFinite(ns)) return '—';
  const quantum =
    unit === 'ns' ? 1 : unit === 'us' ? 1e3 : unit === 'ms' ? 1e6 : 1e9;
  const intValue = Math.round(ns / quantum);
  return `${formatMagnitude(intValue)} ${unitSuffix(unit)}`;
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
