/** Default / clamp widths for resizable panels (px). */
export const GUTTER_WIDTH_DEFAULT = 280;
export const GUTTER_WIDTH_MIN = 180;
export const GUTTER_WIDTH_MAX = 480;

export const ASIDE_WIDTH_DEFAULT = 360;
export const ASIDE_WIDTH_MIN = 280;
export const ASIDE_WIDTH_MAX = 560;

/** Detail dock height (px). Default is the v930 sketch proportion at 1920 wide. */
export const DOCK_HEIGHT_DEFAULT = 247;
export const DOCK_HEIGHT_MIN = 140;
/** Ceiling is also capped against the viewport at drag time, so a short window can't
 *  let the dock swallow the timeline. */
export const DOCK_HEIGHT_MAX = 720;

export function clampPanelWidth(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export interface HorizontalResizeSession {
  /** Call from pointermove while dragging. Pass clientX, or clientY for a vertical drag. */
  move: (clientPos: number) => number;
  /** End drag (pointerup / cancel). */
  end: () => void;
}

/**
 * Start a panel resize drag. The maths is one axis of pointer travel against a
 * starting size, so the same session drives a vertical drag — pass `clientY` to
 * `move` and size the panel with the result.
 *
 * `direction: 1` grows the panel as the pointer moves right/down (a left panel, or
 * one dragged by its bottom edge); `-1` grows it moving left/up (the aside's left
 * edge, the dock's top edge).
 */
export function startHorizontalResize(opts: {
  startClientX: number;
  startWidth: number;
  min: number;
  max: number;
  direction?: 1 | -1;
  onChange: (width: number) => void;
}): HorizontalResizeSession {
  const direction = opts.direction ?? 1;
  const move = (clientPos: number) => {
    const delta = (clientPos - opts.startClientX) * direction;
    const next = clampPanelWidth(opts.startWidth + delta, opts.min, opts.max);
    opts.onChange(next);
    return next;
  };
  return {
    move,
    end: () => {
      /* no-op; caller clears capture / listeners */
    },
  };
}
