/** Shared lane / pipe color mapping for gutter CSS vars and canvas fills. */

export const LANE_COLOR_HEX = {
  cube: '#007084',
  vector: '#007464',
  mte1: '#885C00',
  mte2: '#985000',
  mte3: '#A44830',
  fixp: '#586C0C',
  scalar: '#38702C',
  default: '#3860A8',
} as const;

export type LaneColorKey = keyof typeof LANE_COLOR_HEX;

export function laneColorKey(name: string): LaneColorKey {
  const n = name.toUpperCase();
  if (n.includes('PIPE_V') || n.includes('VEC')) return 'vector';
  if (n.includes('PIPE_S') || n.includes('SCALAR')) return 'scalar';
  if (n.includes('MTE1')) return 'mte1';
  if (n.includes('MTE2')) return 'mte2';
  if (n.includes('MTE3')) return 'mte3';
  if (n.includes('FIX')) return 'fixp';
  if (n.includes('CUBE')) return 'cube';
  return 'default';
}

/** Hex fill for canvas. */
export function colorForThread(name: string): string {
  return LANE_COLOR_HEX[laneColorKey(name)];
}

/** CSS custom property for gutter util bars (tokens.css). */
export function colorVarForLaneName(name: string): string {
  const key = laneColorKey(name);
  if (key === 'default') return LANE_COLOR_HEX.default;
  return `var(--pr-color-${key})`;
}
