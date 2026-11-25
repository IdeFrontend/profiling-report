/** Max decimal digits a details-screen value displays (对比基线 details rule,
 *  2026-11-13): the adapters emit formatted strings that may carry binary-float
 *  residue ("0.9796212499999999") — the display rounds to at most 4 decimals.
 *  A value already inside the ceiling passes through unchanged ("0.77",
 *  "1616.3750" keeps its own tail). A tiny sub-1 magnitude keeps its
 *  significant digits instead of collapsing to "0" when 4 decimals would.
 *  Non-numeric strings pass through untouched. */
export const DETAIL_VALUE_MAX_DECIMALS = 4;

export function formatDetailValue(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  // Keep the printed precision when it already sits inside the ceiling
  // ("2.0" and "0.77" pass through); only longer tails are rounded down.
  const dot = value.indexOf('.');
  if (dot < 0 || value.length - dot - 1 <= DETAIL_VALUE_MAX_DECIMALS) return value;
  // Sub-1 values whose 4-decimal rounding flattens to zero (0.000012345) keep
  // five significant digits instead of printing "0" (review finding).
  if (Math.abs(n) < 1 && Number(n.toFixed(DETAIL_VALUE_MAX_DECIMALS)) === 0) {
    return String(Number(n.toPrecision(DETAIL_VALUE_MAX_DECIMALS + 1)));
  }
  return String(Math.round(n * 10 ** DETAIL_VALUE_MAX_DECIMALS) / 10 ** DETAIL_VALUE_MAX_DECIMALS);
}
