import type { TimeDisplayUnit } from './types';

/** Format canonical nanosecond times for display (interim I-Q14). */
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
