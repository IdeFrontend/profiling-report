/** Default / clamp widths for resizable panels (px). */
export const GUTTER_WIDTH_DEFAULT = 280;
export const GUTTER_WIDTH_MIN = 180;
export const GUTTER_WIDTH_MAX = 480;

/** v930 aside column width at 1920-wide reference (1870px crop @ 7680 source). */
export const V930_SOURCE_WIDTH = 7680;
export const V930_REFERENCE_WIDTH = 1920;
export const V930_ASIDE_CROP_WIDTH = 1870;
export const ASIDE_WIDTH_DEFAULT = Math.round(
  (V930_ASIDE_CROP_WIDTH / V930_SOURCE_WIDTH) * V930_REFERENCE_WIDTH,
);
/** Aside is fixed at sketch width (not user-resizable). */
export const ASIDE_WIDTH_MIN = ASIDE_WIDTH_DEFAULT;
export const ASIDE_WIDTH_MAX = ASIDE_WIDTH_DEFAULT;

/** Minimum swimlane track column width (px) the layout budget tries to protect. */
export const TIMELINE_TRACK_MIN = 320;

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

/**
 * Fit gutter width to a host budget while protecting a minimum swimlane track.
 * Aside stays fixed at sketch width (`ASIDE_WIDTH_DEFAULT`); only gutter shrinks.
 */
export function fitPanelWidths(
  hostWidth: number,
  opts: {
    asideVisible: boolean;
    preferredGutter: number;
    preferredAside: number;
    minTrack?: number;
  },
): { gutterWidth: number; asideWidth: number } {
  const minTrack = opts.minTrack ?? TIMELINE_TRACK_MIN;
  let gutter = clampPanelWidth(opts.preferredGutter, GUTTER_WIDTH_MIN, GUTTER_WIDTH_MAX);
  const aside = opts.asideVisible ? ASIDE_WIDTH_DEFAULT : 0;

  if (!Number.isFinite(hostWidth) || hostWidth <= 0) {
    return { gutterWidth: gutter, asideWidth: aside };
  }

  const ideal = gutter + minTrack + aside;
  if (hostWidth >= ideal) {
    return { gutterWidth: gutter, asideWidth: aside };
  }

  const deficit = ideal - hostWidth;

  if (deficit > 0) {
    const shrink = Math.min(deficit, gutter - GUTTER_WIDTH_MIN);
    gutter -= shrink;
  }

  return { gutterWidth: gutter, asideWidth: aside };
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
