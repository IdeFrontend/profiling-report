import { formatAxisTime, formatAxisBaseTime, timeScaleUnitFromNsQuantum } from './formatTime';
import type { TimeScaleUnit } from './types';

const AXIS_BASE_GROUP_MIN = 1000;

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

function coarserTimeScaleUnit(unit: TimeScaleUnit): TimeScaleUnit | null {
  switch (unit) {
    case 'ns':
      return 'us';
    case 'us':
      return 'ms';
    case 'ms':
      return 's';
    case 's':
      return null;
  }
}

export interface AxisBaseOffset {
  offsetNs: number;
  baseLabel: string;
}

/**
 * Viewport axis: coarse base snapped to a unit one step above tick scale.
 * Returns null when the offset is too small to shorten tick labels.
 */
export function resolveAxisBaseOffset(
  rangeStart: number,
  origin: number,
  tickUnit: TimeScaleUnit,
): AxisBaseOffset | null {
  const relStart = rangeStart - origin;
  const tickQuantum = unitQuantumNs(tickUnit);
  if (!(relStart >= AXIS_BASE_GROUP_MIN * tickQuantum)) return null;

  const baseUnit = coarserTimeScaleUnit(tickUnit);
  if (!baseUnit) return null;

  const baseQuantum = unitQuantumNs(baseUnit);
  const offsetNs = Math.floor(relStart / baseQuantum) * baseQuantum;
  if (!(offsetNs > 0)) return null;

  return {
    offsetNs,
    baseLabel: formatAxisBaseTime(offsetNs, baseUnit),
  };
}

/** Minor ticks between each adjacent major pair (10 subdivisions). */
export const AXIS_RULER_MINORS_PER_GAP = 9;

/** Target minimum pixel spacing between major ticks (pypto parity). */
export const AXIS_RULER_MIN_PIXEL_INTERVAL = 100;

/** Fallback track width when ResizeObserver has not fired yet. */
export const AXIS_RULER_DEFAULT_WIDTH_PX = 800;

/** Symmetric gap: base unit ↔ '+', and '+' ↔ first tick label (AxisRuler chrome). */
export const AXIS_RULER_BASE_SEP_GAP_PX = 4;
/** Major bar (1px) + gap before label — equals {@link AXIS_RULER_BASE_SEP_GAP_PX} at track origin. */
export const AXIS_RULER_MAJOR_LABEL_INSET_PX = 4;
/** Approx width of the '+' glyph at 12px (base chrome estimate). */
export const AXIS_RULER_BASE_PLUS_PX = 8;
/** Tabular 12px char width used to estimate overlaid base chrome. */
export const AXIS_RULER_BASE_CHAR_PX = 7.2;

/**
 * Pixel width of overlaid viewport base chrome: pad + label + gaps + '+'.
 * Tick labels whose left edge falls inside this band get `hideLabel`.
 */
export function estimateAxisBaseChromePx(baseLabel: string): number {
  const textPx = Math.ceil(baseLabel.trim().length * AXIS_RULER_BASE_CHAR_PX);
  return (
    AXIS_RULER_BASE_SEP_GAP_PX +
    textPx +
    AXIS_RULER_BASE_SEP_GAP_PX +
    AXIS_RULER_BASE_PLUS_PX +
    AXIS_RULER_BASE_SEP_GAP_PX
  );
}

export interface AxisRulerMajor {
  /** Absolute time (ns) at this major. */
  t: number;
  /** Position 0–100 across the ruler span. */
  pct: number;
  label: string;
  muted?: boolean;
  /** Viewport base: hide when label would sit under the overlaid base/`+` chrome. */
  hideLabel?: boolean;
}

export interface AxisRulerMinor {
  pct: number;
  muted?: boolean;
}

export interface AxisRulerTicks {
  majors: AxisRulerMajor[];
  minors: AxisRulerMinor[];
  /** Nice major step in ns. */
  interval: number;
  /** Coarse viewport offset pinned at the axis left; null for overview / near-origin. */
  baseLabel: string | null;
}

export interface BuildAxisRulerTicksOptions {
  /** Left edge of the ruler span (ns, absolute). */
  rangeStart: number;
  /** Right edge of the ruler span (ns, absolute). */
  rangeEnd: number;
  /** Subtracted from absolute times for axis display labels (usually model.minTime). */
  origin: number;
  /** Wall-time scale (viewport or overview auto unit). */
  timeScaleUnit: TimeScaleUnit;
  /** Pixel width of the ruler track (drives tick density). */
  widthPx?: number;
  /**
   * Optional window for muting ticks outside the visible/selected range
   * (overview). When omitted, nothing is muted.
   */
  muteOutside?: { start: number; end: number };
  /** Viewport axis only: show coarse base + remainder tick labels. */
  useViewportBase?: boolean;
}

function isOutside(t: number, window?: { start: number; end: number }): boolean {
  if (!window) return false;
  return t < window.start - 1e-9 || t > window.end + 1e-9;
}

/**
 * Pick the smallest 1|2|5×10ⁿ ns step that keeps majors ≥ ~100px apart.
 * Adapted from pypto-tools `calculateGridInterval` (ns-native; no fractional table).
 */
export function calculateGridInterval(timePerPixel: number): number {
  const minTimeInterval = Math.max(0, timePerPixel) * AXIS_RULER_MIN_PIXEL_INTERVAL;

  const ns = 1;
  const us = 1000 * ns;
  const ms = 1000 * us;
  const s = 1000 * ms;
  const min = 60 * s;
  const hour = 60 * min;
  const day = 24 * hour;

  const intervals = [
    1 * ns,
    2 * ns,
    5 * ns,
    10 * ns,
    20 * ns,
    50 * ns,
    100 * ns,
    200 * ns,
    500 * ns,
    1 * us,
    2 * us,
    5 * us,
    10 * us,
    20 * us,
    50 * us,
    100 * us,
    200 * us,
    500 * us,
    1 * ms,
    2 * ms,
    5 * ms,
    10 * ms,
    20 * ms,
    50 * ms,
    100 * ms,
    200 * ms,
    500 * ms,
    1 * s,
    2 * s,
    5 * s,
    10 * s,
    20 * s,
    30 * s,
    1 * min,
    2 * min,
    5 * min,
    10 * min,
    15 * min,
    30 * min,
    1 * hour,
    2 * hour,
    3 * hour,
    6 * hour,
    12 * hour,
    1 * day,
  ];

  for (const interval of intervals) {
    if (interval >= minTimeInterval) return interval;
  }

  let fallback = intervals[intervals.length - 1]!;
  while (fallback < minTimeInterval) {
    fallback *= 10;
  }
  return fallback;
}

/**
 * Overview / total-axis unit from full span × track width (not the brush window).
 * Uses the same major-step picker as tick layout, then maps that step to a scale.
 */
export function resolveTimeUnitFromAxisDensity(spanNs: number, widthPx: number): TimeScaleUnit {
  const w = widthPx > 0 ? widthPx : AXIS_RULER_DEFAULT_WIDTH_PX;
  const interval = calculateGridInterval(Math.max(1, spanNs) / w);
  return timeScaleUnitFromNsQuantum(interval);
}

function viewportBaseMinMajorPct(trackWidthPx: number): number {
  if (!(trackWidthPx > 0)) return -0.01;
  return (-AXIS_RULER_MAJOR_LABEL_INSET_PX / trackWidthPx) * 100;
}

function viewportBaseLabelHidden(
  pct: number,
  trackWidthPx: number,
  baseChromePx: number,
): boolean {
  if (!(trackWidthPx > 0)) return pct < 0;
  const labelLeftPx = (pct / 100) * trackWidthPx + AXIS_RULER_MAJOR_LABEL_INSET_PX;
  return labelLeftPx < baseChromePx;
}

/**
 * Build major bars + labels on a nice ns grid, plus 9 minors per major gap.
 * Labels are relative to `origin` (trace start = 0). Major positions move with
 * zoom because the interval depends on `span / widthPx`.
 */
export function buildAxisRulerTicks(opts: BuildAxisRulerTicksOptions): AxisRulerTicks {
  const span = Math.max(1, opts.rangeEnd - opts.rangeStart);
  const widthPx = opts.widthPx != null && opts.widthPx > 0 ? opts.widthPx : AXIS_RULER_DEFAULT_WIDTH_PX;
  const interval = calculateGridInterval(span / widthPx);
  const mute = opts.muteOutside;
  const origin = opts.origin;
  const unit = opts.timeScaleUnit;
  // Coarse base + remainder chrome is a wall-time concept.
  const base =
    opts.useViewportBase === true
      ? resolveAxisBaseOffset(opts.rangeStart, origin, unit)
      : null;
  const labelOffsetNs = base?.offsetNs ?? 0;
  const baseChromePx = base ? estimateAxisBaseChromePx(base.baseLabel) : 0;
  const minMajorPct = base ? viewportBaseMinMajorPct(widthPx) : -0.01;

  // Snap to origin + k·interval (integral relative timestamps).
  let t0 = origin + Math.ceil((opts.rangeStart - origin) / interval) * interval;
  // Floating error: if ceil overshoots by a hair below rangeStart, step back.
  if (t0 > opts.rangeStart + 1e-9 && t0 - interval >= opts.rangeStart - 1e-9) {
    t0 -= interval;
  }
  if (t0 < opts.rangeStart - 1e-9) {
    t0 += interval;
  }

  let loopT0 = t0;
  if (base) {
    const leadT = t0 - interval;
    const leadPct = ((leadT - opts.rangeStart) / span) * 100;
    if (leadT >= origin - 1e-9 && leadPct >= minMajorPct) {
      loopT0 = leadT;
    }
  }

  const majors: AxisRulerMajor[] = [];
  for (let t = loopT0; t <= opts.rangeEnd + 1e-9; t += interval) {
    const pct = ((t - opts.rangeStart) / span) * 100;
    if (pct < minMajorPct || pct > 100.01) continue;
    const clampedPct = Math.min(100, Math.max(base ? minMajorPct : 0, pct));
    majors.push({
      t,
      pct: clampedPct,
      label: formatAxisTime(t - origin - labelOffsetNs, unit, interval),
      muted: isOutside(t, mute),
      hideLabel: base ? viewportBaseLabelHidden(clampedPct, widthPx, baseChromePx) : false,
    });
  }

  const minors: AxisRulerMinor[] = [];
  const minorStep = interval / (AXIS_RULER_MINORS_PER_GAP + 1);
  for (let i = 0; i < majors.length; i++) {
    const maj = majors[i]!;
    const nextT = i + 1 < majors.length ? majors[i + 1]!.t : maj.t + interval;
    for (let k = 1; k <= AXIS_RULER_MINORS_PER_GAP; k++) {
      const t = maj.t + minorStep * k;
      if (t >= nextT - 1e-9 || t > opts.rangeEnd + 1e-9) break;
      if (t < opts.rangeStart - 1e-9) continue;
      const pct = ((t - opts.rangeStart) / span) * 100;
      if (pct < -0.01 || pct > 100.01) continue;
      minors.push({
        pct: Math.min(100, Math.max(0, pct)),
        muted: isOutside(t, mute),
      });
    }
  }

  // Leading minors before the first major (gap from previous grid line outside range).
  if (majors.length > 0) {
    const first = majors[0]!;
    for (let k = 1; k <= AXIS_RULER_MINORS_PER_GAP; k++) {
      const t = first.t - interval + minorStep * k;
      if (t <= opts.rangeStart + 1e-9 || t >= first.t - 1e-9) continue;
      if (t > opts.rangeEnd + 1e-9) continue;
      const pct = ((t - opts.rangeStart) / span) * 100;
      minors.unshift({
        pct: Math.min(100, Math.max(0, pct)),
        muted: isOutside(t, mute),
      });
    }
  }

  return { majors, minors, interval, baseLabel: base?.baseLabel ?? null };
}
