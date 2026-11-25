/**
 * The right panel's ONE number format (PR-STATS-060): always exactly two decimals,
 * trailing zeros included — percents, percent deltas, durations, TFLOPS and GB/s alike.
 * Every visible number on the aside reads through these helpers (the CSV detail lists keep
 * their own ≤4-decimal rule from 2026-11-13).
 */
export function formatAsideValue(value: number): string {
  return value.toFixed(2);
}

/** The same two-decimal format with the percent sign attached. */
export function formatAsidePct(value: number): string {
  return `${value.toFixed(2)}%`;
}

/** A magnitude whose two-decimal rounding lands on `0.00` reads as no difference. */
export function asideRoundsToZero(value: number): boolean {
  return Number(value.toFixed(2)) === 0;
}
