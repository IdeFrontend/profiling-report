/** Shared lane / pipe color mapping for gutter CSS vars and canvas fills. */

import { hexToOklch, oklchToHex } from './oklch';

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

export type EventState = 'normal' | 'hover' | 'selected';

/**
 * Interaction states as offsets from the lane's own base fill, in OKLCH.
 *
 * One palette entry per lane, three states derived from it, rather than the hand-picked
 * two-tone table this replaces — where hover and selection had drifted to nearly the
 * same colour and adding a lane meant inventing its states by eye.
 *
 * Experiment: hover and selection share the same lightness lift (`L + 0.33` → ≈ 0.83).
 * Selection alone is then told apart by chroma (`C × 1.05`) and the 2px white ring.
 * Both land above the label-flip threshold, so a label inverts as the pointer crosses it.
 * A hovered block is also exempt from the selection dim — without that, dark text on a
 * light fill washed by 0.45 opacity is what made the oranges unreadable.
 */
const STATE_LIFT_L = 0.33;

const STATE: Record<EventState, { dL: number; kC: number }> = {
  normal: { dL: 0, kC: 1 },
  hover: { dL: STATE_LIFT_L, kC: 1 },
  selected: { dL: STATE_LIFT_L, kC: 1.05 },
};

/**
 * Lightness above which a fill needs dark text rather than light.
 *
 * The whole palette rests at L ≈ 0.50, so labels are light until the pointer or a click
 * lifts a block past this — hover/selected to ≈ 0.83 — and then dark.
 */
const TEXT_FLIP_L = 0.6;

/**
 * Which state wins when a block is both selected and hovered.
 *
 * Selection, because hovering your own selection must not drop it back to the hover
 * fill, or it reads as having lost the selection. The white ring sits on top of the
 * fill, so a hovered selection is still marked.
 */
export function eventStateOf(
  id: string,
  selectedId: string | null,
  hoveredId: string | null,
): EventState {
  if (id === selectedId) return 'selected';
  if (id === hoveredId) return 'hover';
  return 'normal';
}

/** Base fills are 8 palette entries, so every state and label colour is computed once. */
const memo = new Map<string, string>();

/**
 * Fill for an event block in a given interaction state.
 *
 * Passes non-hex input (a `var(--pr-color-*)` reference) through untouched, since the
 * gutter hands those to CSS where they resolve later.
 */
export function eventFill(hex: string, state: EventState): string {
  if (state === 'normal') return hex;
  const key = `${hex}|${state}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;

  const base = hexToOklch(hex);
  let out = hex;
  if (base) {
    const { dL, kC } = STATE[state];
    out = oklchToHex({ L: base.L + dL, C: base.C * kC, h: base.h });
  }
  memo.set(key, out);
  return out;
}

/**
 * Label colour for text sitting on `hex`, chosen by the fill's lightness.
 *
 * The CSS form of the same rule, for DOM rather than canvas, is
 * `color: oklch(from var(--c) clamp(0, (0.6 - l) * 1000, 1) 0 0)`.
 */
export function labelColorOn(hex: string): string {
  const key = `${hex}|text`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const base = hexToOklch(hex);
  const out = base && base.L > TEXT_FLIP_L ? '#000000' : '#ffffff';
  memo.set(key, out);
  return out;
}

/** CSS custom property reference for gutter util bars, delegating to the same hex palette.
 *  Returns `var(--pr-color-*)` for known lanes; falls back to the default hex directly. */
export function colorVarForLaneName(name: string): string {
  const key = laneColorKey(name);
  if (key === 'default') return colorForThread(name);
  return `var(--pr-color-${key})`;
}
