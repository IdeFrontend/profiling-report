/** Shared lane / pipe color mapping for gutter CSS vars and canvas fills. */

export const LANE_COLOR_HEX = {
  cube: '#007084',
  vector: '#007464',
  mte1: '#885C00',
  mte2: '#985000',
  mte3: '#A44830',
  fixp: '#586C0C',
  scalar: '#1A743E',
  default: '#606060',
} as const;

export type LaneColorKey = keyof typeof LANE_COLOR_HEX;

/**
 * Flat machine-view name `Core0.Vec0/MTE3` → match on pipe suffix only.
 * Do not take the last segment of `AIV0/PIPE_V/status` (no Core*.* / single slash).
 */
const CORE_PIPE_LEAF = /^(.+\.[^/]+)\/([^/]+)$/;

export function laneColorKey(name: string): LaneColorKey {
  const m = CORE_PIPE_LEAF.exec(name);
  // Prefer the pipe token so `Core0.Vec0/MTE3` is mte3, not vector (Vec0).
  const n = (m ? m[2]! : name).toUpperCase();
  // Specific pipes before VEC/CUBE — compound Core names otherwise mis-key.
  if (n.includes('MTE1')) return 'mte1';
  if (n.includes('MTE2')) return 'mte2';
  if (n.includes('MTE3')) return 'mte3';
  if (n.includes('PIPE_S') || n.includes('SCALAR')) return 'scalar';
  if (n.includes('FIX')) return 'fixp';
  if (n.includes('PIPE_V') || n.includes('VEC')) return 'vector';
  if (n.includes('CUBE')) return 'cube';
  return 'default';
}

/** Hex fill for canvas rendering — single source of truth for all lane colors. */
export function colorForThread(name: string): string {
  return LANE_COLOR_HEX[laneColorKey(name)];
}

/** CSS custom property reference for gutter util bars, delegating to the same hex palette.
 *  Returns `var(--pr-color-*)` for known lanes; falls back to the default hex directly. */
export function colorVarForLaneName(name: string): string {
  const key = laneColorKey(name);
  if (key === 'default') return colorForThread(name);
  return `var(--pr-color-${key})`;
}
