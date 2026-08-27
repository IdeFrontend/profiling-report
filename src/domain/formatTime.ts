import type { SummaryMetrics, TimeDisplayMode, TimeScaleUnit } from './types';

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

/**
 * Per-value unit from the magnitude of a single timestamp / duration (PyPTO-like).
 * Used by tooltip, detail Start/End/Duration, and measure/gap Δt — not by axis/cursor.
 */
export function timeScaleUnitFromMagnitude(ns: number): TimeScaleUnit {
  if (!Number.isFinite(ns)) return 'ns';
  return timeScaleUnitFromNsQuantum(Math.abs(ns));
}

/**
 * Interim I-Q14 — OpBasicInfo MHz for ns→cycles display.
 * Prefer Current Freq over Rated Freq; see INTERIM_DECISIONS I-Q14.
 * Returns undefined when missing/invalid so clocks UI can hide.
 */
export function resolveClockFreqMHz(summary?: SummaryMetrics | null): number | undefined {
  const raw = summary?.currentFreq ?? summary?.ratedFreq;
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return undefined;
  return raw;
}

/**
 * Display cycles from wall time (I-Q14): `ns × freqMHz / 1000`.
 * Not per-event `*_total_cycles`; assumes timeline ns shares the AIC clock domain.
 */
export function nsToCycles(ns: number, clockFreqMHz: number): number {
  return (ns * clockFreqMHz) / 1000;
}

function hasClockFreq(
  opts: FormatTimeOpts | undefined,
): opts is FormatTimeOpts & { clockFreqMHz: number } {
  const f = opts?.clockFreqMHz;
  return f != null && f > 0 && Number.isFinite(f);
}

function cyclesBody(c: number): string {
  const abs = Math.abs(c);
  if (abs >= 100 || Number.isInteger(c)) return String(Math.round(c));
  if (abs >= 10) return c.toFixed(1);
  return c.toFixed(2);
}

/** Axis / compact cycle label (`1234cyc`) or tooltip / cursor (`1234 cycles`). */
function formatCycles(ns: number, opts: FormatTimeOpts | undefined, compact: boolean): string {
  if (!Number.isFinite(ns) || !hasClockFreq(opts)) return '—';
  const c = nsToCycles(ns, opts.clockFreqMHz);
  if (!Number.isFinite(c)) return '—';
  const body = cyclesBody(c);
  return compact ? `${body}cyc` : `${body} cycles`;
}

/** Value and unit apart for the detail card's cycles column (`cycles` unit). */
function formatCyclesParts(ns: number, opts: FormatTimeOpts | undefined): { value: string; unit: string } {
  const unit = 'cycles';
  if (!Number.isFinite(ns) || !hasClockFreq(opts)) return { value: '—', unit };
  const c = nsToCycles(ns, opts.clockFreqMHz);
  if (!Number.isFinite(c)) return { value: '—', unit };
  return { value: cyclesBody(c), unit };
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

/** Significant-digit magnitude for event start/end/duration display (not hover detail). */
function formatSignificantMagnitude(value: number, digits: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const neg = value < 0;
  const abs = Math.abs(value);
  let body = abs.toPrecision(digits);
  if (/e/i.test(body)) {
    const n = Number(body);
    if (!Number.isFinite(n)) return '—';
    body = Math.abs(n) >= 1 ? String(Math.round(n)) : n.toString();
    if (/e/i.test(body)) {
      const order = Math.floor(Math.log10(Math.abs(n)));
      body = n.toFixed(Math.max(0, digits - 1 - order));
    }
  }
  const sign = neg ? '-' : '';
  const dot = body.indexOf('.');
  if (dot < 0) return sign + groupIntegerDigits(body);
  return sign + groupIntegerDigits(body.slice(0, dot)) + body.slice(dot);
}

/** Digits shown on event tooltip + detail value cells (hover title keeps full precision). */
export const EVENT_TIME_SIGNIFICANT_DIGITS = 4;

export type FormatTimeOpts = {
  /** When set, format the unit magnitude with this many significant digits. */
  significantDigits?: number;
  /** `cycles` renders CPU clocks instead of wall time (I-Q14). */
  mode?: TimeDisplayMode;
  /** AIC frequency in MHz — required when `mode` is `cycles`. */
  clockFreqMHz?: number;
};

/**
 * Format axis tick labels.
 * When `tickStepNs` is provided, decimal places follow tick spacing so zoomed
 * axes do not collapse to identical labels.
 */
export function formatAxisTime(
  ns: number,
  unit: TimeScaleUnit = 'ms',
  tickStepNs?: number,
  opts?: FormatTimeOpts,
): string {
  if (opts?.mode === 'cycles') return formatCycles(ns, opts, true);
  if (!Number.isFinite(ns)) return '—';

  const suffix = unitSuffix(unit);
  const v = nsToUnitValue(ns, unit);
  const fractionDigits = axisFractionDigits(tickStepNs, unit);

  if (isAxisCompactZero(v, fractionDigits)) return `0${suffix}`;

  return `${formatAxisValue(v, fractionDigits)}${suffix}`;
}

/**
 * Cursor / playhead label as `MM:SS.mmm` in the resolved time scale
 * (sketch: 4.456ms → `00:04.456`). Cycles mode uses a plain cycle count.
 */
export function formatCursorTime(
  ns: number,
  unit: TimeScaleUnit = 'ms',
  opts?: FormatTimeOpts,
): string {
  if (opts?.mode === 'cycles') return formatCycles(Math.max(0, ns), opts, false);
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
  opts?: FormatTimeOpts,
): { value: string; unit: string } {
  if (opts?.mode === 'cycles') return formatCyclesParts(ns, opts);
  const label = unitSuffix(unit);
  if (!Number.isFinite(ns)) return { value: '—', unit: label };
  const sig = opts?.significantDigits;
  const mag = (v: number, fractionDigits?: number) =>
    sig != null ? formatSignificantMagnitude(v, sig) : formatMagnitude(v, fractionDigits);
  switch (unit) {
    case 'ns':
      return { value: mag(ns), unit: label };
    case 'us':
      return { value: mag(ns / 1e3, 3), unit: label };
    case 's':
      return { value: mag(ns / 1e9, 3), unit: label };
    case 'ms':
    default:
      return { value: mag(ns / 1e6, 3), unit: label };
  }
}

/** Format times in an explicit scale unit (axis / cursor chrome). */
export function formatTime(ns: number, unit: TimeScaleUnit = 'ms', opts?: FormatTimeOpts): string {
  if (opts?.mode === 'cycles') return formatCycles(ns, opts, false);
  if (!Number.isFinite(ns)) return '—';
  const parts = formatTimeParts(ns, unit, opts);
  return `${parts.value} ${parts.unit}`;
}

/** Tooltip / detail / Δt — unit from this value's magnitude, not viewport zoom. */
export function formatTimePartsAuto(ns: number, opts?: FormatTimeOpts): { value: string; unit: string } {
  if (opts?.mode === 'cycles') return formatCyclesParts(ns, opts);
  return formatTimeParts(ns, timeScaleUnitFromMagnitude(ns), opts);
}

/** Joined {@link formatTimePartsAuto}. */
export function formatTimeAuto(ns: number, opts?: FormatTimeOpts): string {
  if (opts?.mode === 'cycles') return formatCycles(ns, opts, false);
  if (!Number.isFinite(ns)) return '—';
  const parts = formatTimePartsAuto(ns, opts);
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
  opts?: FormatTimeOpts,
): string {
  return formatTime(ns - origin, unit, opts);
}

/** Like {@link formatTimeParts} but relative to `origin` (start/end columns). */
export function formatDisplayTimeParts(
  ns: number,
  origin: number,
  unit: TimeScaleUnit = 'ms',
  opts?: FormatTimeOpts,
): { value: string; unit: string } {
  return formatTimeParts(ns - origin, unit, opts);
}

/** Per-value display time (tooltip / detail start·end). */
export function formatDisplayTimeAuto(
  ns: number,
  origin: number,
  opts?: FormatTimeOpts,
): string {
  return formatTimeAuto(ns - origin, opts);
}

/** Per-value display parts (detail start·end columns). */
export function formatDisplayTimePartsAuto(
  ns: number,
  origin: number,
  opts?: FormatTimeOpts,
): { value: string; unit: string } {
  return formatTimePartsAuto(ns - origin, opts);
}
