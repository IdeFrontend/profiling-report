/** Default / clamp widths for resizable panels (px). */
export const GUTTER_WIDTH_DEFAULT = 280;
export const GUTTER_WIDTH_MIN = 180;
export const GUTTER_WIDTH_MAX = 480;

/** Default open width (Product; v930 crop was ~468 at 1920). User-resizable within min/max. */
export const ASIDE_WIDTH_DEFAULT = 480;
export const ASIDE_WIDTH_MIN = 280;
export const ASIDE_WIDTH_MAX = 720;

/** Minimum swimlane track column width (px) the layout budget tries to protect. */
export const TIMELINE_TRACK_MIN = 320;

/**
 * The detail dock's two heights (px), measured off the v930 sketch pair at 1920 wide —
 * `task-click-detail` (just appeared) and `detail-strip-raised` (raised). Both exports
 * are 4x, and both put the dock's bottom at 1049 CSS, so the tops at 802 and 642 give
 * these two figures. The dock is not freely resizable: the design offers one expander,
 * and arbitrary heights only ever produced layouts the sketch never sanctioned.
 */
export const DOCK_HEIGHT_COLLAPSED = 247;
export const DOCK_HEIGHT_EXPANDED = 407;
/** Minimum in-flow dock height while a marquee is live and the dock was closed at drag start. */
export const DOCK_HEIGHT_MARQUEE_PREVIEW = 56;

/**
 * Live marquee preview dock height when opening from a closed dock.
 * Grows into dead space below lane content up to the post-commit target:
 * `min(max(minHeight, slack), targetHeight)` where
 * `slack = max(0, wrapClosed - (contentHeight - effectiveScrollY))` and
 * `wrapClosed = wrapHeightNow + currentPreviewHeight`.
 *
 * Callers opening from a closed dock should pass the pre-mount wrap as
 * `wrapHeightNow` with `currentPreviewHeight: 0` (and freeze that wrap for the
 * gesture) so the first paint is already correct — using a live wrap after the
 * dock mounts overshoots to target then shrinks.
 */
export function marqueePreviewDockHeight(opts: {
  wrapHeightNow: number;
  currentPreviewHeight: number;
  contentHeight: number;
  scrollY: number;
  contentTopPad: number;
  minHeight?: number;
  targetHeight: number;
}): number {
  const minH = opts.minHeight ?? DOCK_HEIGHT_MARQUEE_PREVIEW;
  const target = Math.max(minH, opts.targetHeight);
  const wrapNow = Math.max(0, opts.wrapHeightNow);
  const current = Math.max(0, opts.currentPreviewHeight);
  const wrapClosed = wrapNow + current;
  const effectiveScrollY = opts.scrollY - opts.contentTopPad;
  const contentBottomInViewport = opts.contentHeight - effectiveScrollY;
  const slack = Math.max(0, wrapClosed - contentBottomInViewport);
  return Math.round(Math.min(Math.max(minH, slack), target));
}

export function clampPanelWidth(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Fit gutter/aside to a host width while protecting a minimum swimlane track.
 * Starts from preferred sizes; shrinks aside toward its min first, then gutter.
 * Expanding host restores toward preferred (caller passes preferred each time).
 * Never introduces horizontal scroll — columns compress within the host.
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
  let aside = clampPanelWidth(opts.preferredAside, ASIDE_WIDTH_MIN, ASIDE_WIDTH_MAX);

  if (!Number.isFinite(hostWidth) || hostWidth <= 0) {
    return { gutterWidth: gutter, asideWidth: opts.asideVisible ? aside : 0 };
  }

  const asideBudget = opts.asideVisible ? aside : 0;
  const ideal = gutter + minTrack + asideBudget;
  if (hostWidth >= ideal) {
    return { gutterWidth: gutter, asideWidth: asideBudget };
  }

  let deficit = ideal - hostWidth;

  if (opts.asideVisible && deficit > 0) {
    const shrink = Math.min(deficit, aside - ASIDE_WIDTH_MIN);
    aside -= shrink;
    deficit -= shrink;
  }

  if (deficit > 0) {
    const shrink = Math.min(deficit, gutter - GUTTER_WIDTH_MIN);
    gutter -= shrink;
  }

  return { gutterWidth: gutter, asideWidth: opts.asideVisible ? aside : 0 };
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
