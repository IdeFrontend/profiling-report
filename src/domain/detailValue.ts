/** Max decimal digits a details-screen value displays (对比基线 details rule,
 *  2026-11-13): the adapters emit formatted strings that may carry binary-float
 *  residue ("0.9796212499999999") — the display rounds to at most 4 decimals and
 *  drops trailing zeros ("0.9796", "1616.375" stays). Non-numeric strings pass
 *  through untouched. */
export const DETAIL_VALUE_MAX_DECIMALS = 4;

export function formatDetailValue(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  // Keep the printed precision when it already sits inside the ceiling
  // ("2.0" and "0.77" pass through); only longer tails are rounded down.
  const dot = value.indexOf('.');
  if (dot < 0 || value.length - dot - 1 <= DETAIL_VALUE_MAX_DECIMALS) return value;
  return String(Math.round(n * 10 ** DETAIL_VALUE_MAX_DECIMALS) / 10 ** DETAIL_VALUE_MAX_DECIMALS);
}
