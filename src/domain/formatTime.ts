import type { SummaryMetrics, TimeDisplayMode, TimeScaleUnit } from './types';

export type FormatTimeOpts = {
  /** Required for `time` mode labels. */
  unit?: TimeScaleUnit;
  tickStepNs?: number;
  /** AIC frequency in MHz (OpBasicInfo Current/Rated Freq). */
  clockFreqMHz?: number;
};

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

/**
 * Interim I-Q14 frequency: prefer Current Freq, else Rated Freq (MHz).
 * Returns undefined when missing/invalid so clocks UI can hide.
 */
export function resolveClockFreqMHz(summary?: SummaryMetrics | null): number | undefined {
  const raw = summary?.currentFreq ?? summary?.ratedFreq;
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return undefined;
  return raw;
}

/** cycles = ns × freqMHz / 1000 */
export function nsToCycles(ns: number, clockFreqMHz: number): number {
  return (ns * clockFreqMHz) / 1000;
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

function formatCycles(ns: number, clockFreqMHz: number | undefined, compact: boolean): string {
  if (clockFreqMHz == null || !(clockFreqMHz > 0) || !Number.isFinite(clockFreqMHz)) {
    return '—';
  }
  const c = nsToCycles(ns, clockFreqMHz);
  if (!Number.isFinite(c)) return '—';
  const abs = Math.abs(c);
  let body: string;
  if (abs >= 100 || Number.isInteger(c)) body = String(Math.round(c));
  else if (abs >= 10) body = c.toFixed(1);
  else body = c.toFixed(2);
  return compact ? `${body}cyc` : `${body} cycles`;
}

/**
 * Format axis tick labels.
 * When `tickStepNs` is provided, decimal places follow tick spacing so zoomed
 * axes do not collapse to identical labels.
 */
export function formatAxisTime(
  ns: number,
  mode: TimeDisplayMode = 'time',
  opts: FormatTimeOpts = {},
): string {
  if (!Number.isFinite(ns)) return '—';
  if (mode === 'cycles') {
    if (Math.abs(ns) < 1e-9) return '0cyc';
    return formatCycles(ns, opts.clockFreqMHz, true);
  }
  const unit = opts.unit ?? 'ms';
  if (Math.abs(ns) < 1e-9) return `0${unitSuffix(unit)}`;

  switch (unit) {
    case 'ns': {
      const step = opts.tickStepNs != null ? Math.abs(opts.tickStepNs) : 1;
      if (step >= 1) return `${Math.round(ns)}ns`;
      return `${ns.toFixed(decimalsForStep(step))}ns`;
    }
    case 'us': {
      const v = ns / 1e3;
      const step = opts.tickStepNs != null ? Math.abs(opts.tickStepNs) / 1e3 : undefined;
      const d = step != null ? decimalsForStep(step) : Math.abs(v) >= 10 ? 1 : 2;
      return `${v.toFixed(d)}µs`;
    }
    case 's': {
      const v = ns / 1e9;
      const step = opts.tickStepNs != null ? Math.abs(opts.tickStepNs) / 1e9 : undefined;
      const d =
        step != null
          ? decimalsForStep(step)
          : Math.abs(v) >= 1
            ? 1
            : Math.abs(v) >= 0.01
              ? 3
              : 4;
      return `${v.toFixed(d)}s`;
    }
    case 'ms':
    default: {
      const v = ns / 1e6;
      const step = opts.tickStepNs != null ? Math.abs(opts.tickStepNs) / 1e6 : undefined;
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
 * Cursor / playhead label as `MM:SS.mmm` in the resolved time scale
 * (sketch: 4.456ms → `00:04.456`). Cycles mode uses a plain cycle count.
 */
export function formatCursorTime(
  ns: number,
  mode: TimeDisplayMode = 'time',
  opts: FormatTimeOpts = {},
): string {
  if (mode === 'cycles') {
    if (!Number.isFinite(ns)) return '—';
    return formatCycles(Math.max(0, ns), opts.clockFreqMHz, false);
  }
  if (!Number.isFinite(ns)) return '00:00.000';
  const unit = opts.unit ?? 'ms';
  const value = Math.max(0, nsToUnitValue(ns, unit));
  const totalThousandths = Math.round(value * 1000);
  let secs = Math.floor(totalThousandths / 1000);
  const frac = ((totalThousandths % 1000) + 1000) % 1000;
  const mins = Math.floor(secs / 60);
  secs = secs % 60;
  const minStr = String(Math.min(mins, 99)).padStart(2, '0');
  return `${minStr}:${String(secs).padStart(2, '0')}.${String(frac).padStart(3, '0')}`;
}

/** Format tooltip / detail times. */
export function formatTime(
  ns: number,
  mode: TimeDisplayMode = 'time',
  opts: FormatTimeOpts = {},
): string {
  if (!Number.isFinite(ns)) return '—';
  if (mode === 'cycles') return formatCycles(ns, opts.clockFreqMHz, false);
  const unit = opts.unit ?? 'ms';
  switch (unit) {
    case 'ns':
      return `${Math.round(ns)} ns`;
    case 'us':
      return `${(ns / 1e3).toFixed(3)} µs`;
    case 's':
      return `${(ns / 1e9).toFixed(3)} s`;
    case 'ms':
    default:
      return `${(ns / 1e6).toFixed(3)} ms`;
  }
}
