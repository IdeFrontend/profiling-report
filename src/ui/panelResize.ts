/** Default / clamp widths for resizable panels (px). */
export const GUTTER_WIDTH_DEFAULT = 280;
export const GUTTER_WIDTH_MIN = 180;
export const GUTTER_WIDTH_MAX = 480;

export const ASIDE_WIDTH_DEFAULT = 360;
export const ASIDE_WIDTH_MIN = 280;
export const ASIDE_WIDTH_MAX = 560;

export function clampPanelWidth(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export interface HorizontalResizeSession {
  /** Call from pointermove while dragging. */
  move: (clientX: number) => number;
  /** End drag (pointerup / cancel). */
  end: () => void;
}

/**
 * Start a horizontal resize drag. For a left panel (gutter), pass `direction: 1`
 * so moving right increases width. For a right panel (aside) resized from its
 * left edge, pass `direction: -1` so moving left increases width.
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
  const move = (clientX: number) => {
    const delta = (clientX - opts.startClientX) * direction;
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
