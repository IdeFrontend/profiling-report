import type { TimeDisplayUnit } from './types';

/** Format axis tick labels closer to sketch style (e.g. `0.0ms`, `4.5ms`). */
export function formatAxisTime(ns: number, unit: TimeDisplayUnit = 'ms'): string {
  switch (unit) {
    case 'ns':
      return `${Math.round(ns)}ns`;
    case 'us': {
      const v = ns / 1e3;
      return `${v >= 10 ? v.toFixed(1) : v.toFixed(2)}µs`;
    }
    case 'ms':
    default: {
      const v = ns / 1e6;
      if (v >= 1) return `${v.toFixed(1)}ms`;
      if (v >= 0.01) return `${v.toFixed(3)}ms`;
      return `${v.toFixed(4)}ms`;
    }
  }
}

/** Format tooltip / detail times (sketch hover uses ns). */
export function formatTime(ns: number, unit: TimeDisplayUnit = 'ms'): string {
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
