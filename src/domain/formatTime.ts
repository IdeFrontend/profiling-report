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
 * OpBasicInfo MHz for ns→cycles display (UI-40 / UI-45).
 * Prefer Current Freq over Rated Freq; see docs/context/decisions/UI.md.
 * Returns undefined when missing/invalid so clocks UI can hide.
 */
export function resolveClockFreqMHz(summary?: SummaryMetrics | null): number | undefined {
  const current = summary?.currentFreq;
  if (current != null && Number.isFinite(current) && current > 0) return current;
  const rated = summary?.ratedFreq;
  if (rated != null && Number.isFinite(rated) && rated > 0) return rated;
  return undefined;
}

/**
 * Exact derived cycles as a BigInt (UI-45): `round(ns) × round(freqMHz) / 1000`,
 * rounded half-up. BigInt keeps the integer exact past `Number.MAX_SAFE_INTEGER`,
 * where `ns × freqMHz` as a double loses its low digits (a 708 s trace at 1650 MHz
 * is ~1.17e18 cycles, whose double ULP is ~256).
 *
 * `ns` is always a non-negative trace-relative time here (tooltip/detail subtract
 * `model.minTime`; cursor clamps to ≥ 0), so half-up rounding is safe.
 */
function wholeCyclesExact(ns: number, clockFreqMHz: number): bigint {
  const nsInt = BigInt(Math.round(ns));
  const freqInt = BigInt(Math.round(clockFreqMHz));
  return (nsInt * freqInt + 500n) / 1000n;
}

/**
 * Display cycles from wall time (UI-45): `cycles = ns × freqMHz / 1000`.
 * Exact within `Number.MAX_SAFE_INTEGER`; callers that format the label use the
 * BigInt path directly so grouped digits stay exact for long traces.
 * Not per-event `*_total_cycles`; assumes timeline ns shares the AIC clock domain.
 */
export function nsToCycles(ns: number, clockFreqMHz: number): number {
  return Number(wholeCyclesExact(ns, clockFreqMHz));
}

function hasClockFreq(
  opts: FormatTimeOpts | undefined,
): opts is FormatTimeOpts & { clockFreqMHz: number } {
  const f = opts?.clockFreqMHz;
  return f != null && f > 0 && Number.isFinite(f);
}

/**
 * Space-group every 3 digits with no leading zeroes (`10 325`, `1 000 000`, `325`).
 */
function formatCyclesValue(value: bigint): string {
  return groupIntegerDigits(value.toString());
}

/** Derived CPU-clock label — number only (no `cyc` / `cycles` suffix). */
function formatCycles(ns: number, opts: FormatTimeOpts | undefined): string {
  if (!Number.isFinite(ns) || !hasClockFreq(opts)) return '—';
  return formatCyclesValue(wholeCyclesExact(ns, opts.clockFreqMHz));
}

/** Cycles for the detail card — value only, empty unit (no `cycles` label). */
function formatCyclesParts(ns: number, opts: FormatTimeOpts | undefined): { value: string; unit: string } {
  if (!Number.isFinite(ns) || !hasClockFreq(opts)) return { value: '—', unit: '' };
  return {
    value: formatCyclesValue(wholeCyclesExact(ns, opts.clockFreqMHz)),
    unit: '',
  };
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

/** Drop trailing fractional zeros (`841.0` → `841`, `11.30` → `11.3`). */
function stripTrailingFractionZeros(body: string): string {
  if (!body.includes('.')) return body;
  return body.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
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
  body = stripTrailingFractionZeros(body);
  const sign = neg ? '-' : '';
  const dot = body.indexOf('.');
  if (dot < 0) return sign + groupIntegerDigits(body);
  return sign + groupIntegerDigits(body.slice(0, dot)) + body.slice(dot);
}

/** Digits shown on event tooltip + detail value cells (hover title keeps full precision). */
export const EVENT_TIME_SIGNIFICANT_DIGITS = 4;

/**
 * Min fraction digits so a 1 CSS-px horizontal move (`nsPerPx`) changes the label
 * in `unit`. Example: 0.00312 ms/px → 3. Not the same as axis tick-step digits.
 * Capped at the unit's nanosecond resolution (µs ≤ 3, ms ≤ 6, s ≤ 9; ns → 0).
 */
export function fractionDigitsForNsPerPx(nsPerPx: number, unit: TimeScaleUnit): number {
  if (!(nsPerPx > 0) || !Number.isFinite(nsPerPx)) return 0;
  const stepInUnit = nsPerPx / unitQuantumNs(unit);
  if (!(stepInUnit > 0) || !Number.isFinite(stepInUnit)) return 0;
  if (stepInUnit >= 1) return 0;
  const zoom = Math.ceil(-Math.log10(stepInUnit));
  return Math.min(maxFractionDigitsForUnit(unit), Math.max(0, zoom));
}

/** Max fraction digits that still represent whole nanoseconds in `unit`. */
export function maxFractionDigitsForUnit(unit: TimeScaleUnit): number {
  const q = unitQuantumNs(unit);
  return q <= 1 ? 0 : Math.round(Math.log10(q));
}

/**
 * Fraction digits implied by formatting `|valueInUnit|` with `significantDigits`
 * (e.g. 5.200 with 4 sig → 3). Used to floor zoom digits so fit-zoom labels stay
 * at least as precise as the prior significant-digit rule.
 */
export function fractionDigitsForSignificantMagnitude(
  valueInUnit: number,
  significantDigits: number,
): number {
  if (!(significantDigits > 0) || !Number.isFinite(valueInUnit) || valueInUnit === 0) {
    return 0;
  }
  const order = Math.floor(Math.log10(Math.abs(valueInUnit)));
  if (!Number.isFinite(order)) return 0;
  return Math.max(0, significantDigits - 1 - order);
}

/** Visible time span ÷ track CSS width (clamps non-positive span / width). */
export function nsPerPxForTrack(spanNs: number, widthPx: number): number {
  return Math.max(1, spanNs) / Math.max(1, widthPx);
}

export type FormatTimeOpts = {
  /** When set, format the unit magnitude with this many significant digits. */
  significantDigits?: number;
  /** `cycles` renders CPU clocks instead of wall time (UI-40 / UI-45). */
  mode?: TimeDisplayMode;
  /** AIC frequency in MHz — required when `mode` is `cycles`. */
  clockFreqMHz?: number;
  /**
   * Zoom resolution (ns per CSS px). When set (and `significantDigits` is not),
   * fraction digits follow {@link fractionDigitsForNsPerPx} instead of fixed 3.
   */
  nsPerPx?: number;
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
export function formatCursorTime(
  ns: number,
  unit: TimeScaleUnit = 'ms',
): string {
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
  const label = unitSuffix(unit);
  if (!Number.isFinite(ns)) return { value: '—', unit: label };
  const sig = opts?.significantDigits;
  const mag = (v: number, fractionDigits?: number) =>
    sig != null ? formatSignificantMagnitude(v, sig) : formatMagnitude(v, fractionDigits);
  const v = nsToUnitValue(ns, unit);
  const zoomDigits =
    sig == null && opts?.nsPerPx != null ? fractionDigitsForNsPerPx(opts.nsPerPx, unit) : undefined;
  // Zoom digits never drop below the prior 4-sig floor, and never invent sub-ns.
  const frac =
    zoomDigits != null
      ? Math.min(
          maxFractionDigitsForUnit(unit),
          Math.max(
            zoomDigits,
            fractionDigitsForSignificantMagnitude(v, EVENT_TIME_SIGNIFICANT_DIGITS),
          ),
        )
      : 3;
  switch (unit) {
    case 'ns':
      return { value: zoomDigits != null && frac > 0 ? mag(ns, frac) : mag(ns), unit: label };
    case 'us':
      return { value: mag(ns / 1e3, frac), unit: label };
    case 's':
      return { value: mag(ns / 1e9, frac), unit: label };
    case 'ms':
    default:
      return { value: mag(ns / 1e6, frac), unit: label };
  }
}

/** Format times in an explicit scale unit (axis / cursor chrome). */
export function formatTime(ns: number, unit: TimeScaleUnit = 'ms', opts?: FormatTimeOpts): string {
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
  if (opts?.mode === 'cycles') return formatCycles(ns, opts);
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
