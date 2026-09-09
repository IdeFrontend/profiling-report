import type {
  MeasureRange,
  SwimlaneModel,
  SwimlaneViewState,
  SwimlaneViewWindow,
} from './types';

const MIN_WINDOW = 1;

/** Shared zoom-in floor (same as `zoomAt`); export for tests / slider mapping. */
export const MIN_VIEW_WINDOW = MIN_WINDOW;

/**
 * fp32 ULP at a given magnitude: the spacing between representable float32 values at
 * `2^exp` where exp = floor(log2(maxAbs)). WebGL event coords are stored relative to
 * `model.minTime` as float32, so their magnitude is ≈ fullSpan (trace span) — at high
 * zoom one ULP can span many device pixels, which is what makes event bounds "jump".
 */
function fp32UlpAt(maxAbs: number): number {
  const e = Math.max(-126, Math.floor(Math.log2(Math.max(2 ** -126, maxAbs))));
  return 2 ** e * 2 ** -23;
}

/**
 * Zoom-in cutoff that keeps fp32 coordinate noise below `pxPerUlp` device pixels: once the
 * view span shrinks to `ulp(fullSpan) * widthPx / pxPerUlp`, a single ULP of the stored coords
 * moves the bound by `pxPerUlp` pixels. We target ~1/4 device px, so spans must stay at or above
 * `ulp * widthPx * 4`. Width is the track width in CSS px (the actual rasterized width).
 */
export function minSpanForPrecision(fullSpan: number, widthPx: number): number {
  const full = Math.max(MIN_WINDOW, fullSpan);
  const width = Math.max(1, widthPx);
  const ulp = fp32UlpAt(full);
  // ulp * (width) / span ≤ 1/4  →  span ≥ ulp * width * 4
  return Math.max(MIN_WINDOW, ulp * width * 4);
}

/**
 * Keyboard pan step in CSS px — PyPTO's `moveStep` (see
 * `swimGraphThreadEvents.vue` in the pypto_toolkit source). One A/D press shifts the
 * viewport by this many screen pixels.
 */
export const KEYBOARD_PAN_STEP_PX = 30;

/**
 * Time to shift the viewport for one keyboard pan step of `KEYBOARD_PAN_STEP_PX`
 * across a `trackWidth`-px track. Clamps `trackWidth` and `span` to a minimum of 1 so
 * the result is always positive and finite (never NaN / division by zero) — the caller
 * passes a real measured track width, this only guards the degenerate case.
 */
export function keyboardPanStepTime(span: number, trackWidth: number): number {
  return (KEYBOARD_PAN_STEP_PX / Math.max(1, trackWidth)) * Math.max(1, span);
}

/** Max zoom ratio for a trace: fullSpan / minSpan (default MIN_WINDOW) (≥ 1). */
export function maxZoomRatio(fullSpan: number, minSpan = MIN_WINDOW): number {
  return maxZoomRatioWithMin(Math.max(MIN_WINDOW, fullSpan), minSpan);
}

/**
 * Toolbar slider 0…100 from current window span.
 * 0 = fit (full span); 100 = min window (`minSpan`, default `MIN_WINDOW`, same floor as Ctrl+wheel).
 */
export function zoomPercentFromSpan(span: number, fullSpan: number, minSpan = MIN_WINDOW): number {
  const full = Math.max(MIN_WINDOW, fullSpan);
  const s = Math.max(minSpan, span);
  if (s >= full) return 0;
  const maxR = maxZoomRatioWithMin(full, minSpan);
  if (maxR <= 1) return 0;
  const ratio = full / s;
  return Math.min(100, Math.round((Math.log2(ratio) / Math.log2(maxR)) * 100));
}

/** Inverse of `zoomPercentFromSpan` — span for a slider percent. */
export function spanFromZoomPercent(pct: number, fullSpan: number, minSpan = MIN_WINDOW): number {
  const full = Math.max(MIN_WINDOW, fullSpan);
  const maxR = maxZoomRatioWithMin(full, minSpan);
  if (pct <= 0 || maxR <= 1) return full;
  if (pct >= 100) return minSpan;
  const ratio = 2 ** ((pct / 100) * Math.log2(maxR));
  return Math.max(minSpan, full / Math.max(1, ratio));
}

/** max zoom ratio for a given full span and min-span floor (shared by slider + percent). */
function maxZoomRatioWithMin(full: number, minSpan: number): number {
  return Math.max(1, full / Math.max(minSpan, 1));
}

export function createViewState(model: SwimlaneModel | null | undefined): SwimlaneViewState {
  const fit = zoomToFitWindow(model);
  return {
    startTime: fit.startTime,
    endTime: fit.endTime,
    scrollY: 0,
    selectedEventId: null,
    hoveredEventId: null,
    searchQuery: '',
    asideVisible: true,
    playheadTime: null,
    measureMode: false,
    measureRange: null,
    pinnedLaneIds: [],
    pinnedOverviewIds: [],
  };
}

/** Append leaf lane id in pin order; idempotent when already present. */
export function pinLane(state: SwimlaneViewState, laneId: string): SwimlaneViewState {
  if (state.pinnedLaneIds.includes(laneId)) return state;
  return { ...state, pinnedLaneIds: [...state.pinnedLaneIds, laneId] };
}

/** Remove leaf lane id; no-op when absent. */
export function unpinLane(state: SwimlaneViewState, laneId: string): SwimlaneViewState {
  if (!state.pinnedLaneIds.includes(laneId)) return state;
  return { ...state, pinnedLaneIds: state.pinnedLaneIds.filter((id) => id !== laneId) };
}

/** Append overview series id in pin order; idempotent when already present. */
export function pinOverview(state: SwimlaneViewState, seriesId: string): SwimlaneViewState {
  if (state.pinnedOverviewIds.includes(seriesId)) return state;
  return { ...state, pinnedOverviewIds: [...state.pinnedOverviewIds, seriesId] };
}

/** Remove overview series id; no-op when absent. */
export function unpinOverview(state: SwimlaneViewState, seriesId: string): SwimlaneViewState {
  if (!state.pinnedOverviewIds.includes(seriesId)) return state;
  return {
    ...state,
    pinnedOverviewIds: state.pinnedOverviewIds.filter((id) => id !== seriesId),
  };
}

export function normalizeMeasureRange(a: number, b: number): MeasureRange {
  return a <= b ? { startTime: a, endTime: b } : { startTime: b, endTime: a };
}

export function setMeasureMode(state: SwimlaneViewState, enabled: boolean): SwimlaneViewState {
  if (!enabled) {
    return { ...state, measureMode: false, measureRange: null };
  }
  return { ...state, measureMode: true };
}

export function setMeasureRange(state: SwimlaneViewState, range: MeasureRange | null): SwimlaneViewState {
  if (!range) return { ...state, measureRange: null };
  return { ...state, measureRange: normalizeMeasureRange(range.startTime, range.endTime) };
}

export function clearMeasure(state: SwimlaneViewState): SwimlaneViewState {
  return { ...state, measureMode: false, measureRange: null };
}

export function zoomToFitWindow(model: SwimlaneModel | null | undefined): SwimlaneViewWindow {
  if (!model) return { startTime: 0, endTime: 1, scrollY: 0 };
  if (!(model.maxTime > model.minTime)) {
    return { startTime: model.minTime, endTime: model.minTime + MIN_WINDOW, scrollY: 0 };
  }
  return {
    startTime: model.minTime,
    endTime: model.maxTime,
    scrollY: 0,
  };
}

/** Zoom time window around an anchor time (cursor or center). factor > 1 zooms in. */
export function zoomAt(
  view: SwimlaneViewWindow,
  factor: number,
  anchorTime: number,
  bounds?: { minTime: number; maxTime: number },
  minSpan = MIN_WINDOW,
): SwimlaneViewWindow {
  const span = Math.max(minSpan, view.endTime - view.startTime);
  const nextSpan = Math.max(minSpan, span / factor);
  const ratio = (anchorTime - view.startTime) / span;
  let startTime = anchorTime - nextSpan * ratio;
  let endTime = startTime + nextSpan;

  if (bounds) {
    const full = Math.max(minSpan, bounds.maxTime - bounds.minTime);
    if (nextSpan >= full) {
      return { startTime: bounds.minTime, endTime: bounds.maxTime, scrollY: view.scrollY };
    }
    if (startTime < bounds.minTime) {
      startTime = bounds.minTime;
      endTime = startTime + nextSpan;
    }
    if (endTime > bounds.maxTime) {
      endTime = bounds.maxTime;
      startTime = endTime - nextSpan;
    }
  }

  return { startTime, endTime, scrollY: view.scrollY };
}

/** Pan by delta in time units (positive → later times enter from the right). */
export function panBy(
  view: SwimlaneViewWindow,
  deltaTime: number,
  bounds?: { minTime: number; maxTime: number },
): SwimlaneViewWindow {
  let startTime = view.startTime + deltaTime;
  let endTime = view.endTime + deltaTime;
  if (bounds) {
    const span = endTime - startTime;
    if (startTime < bounds.minTime) {
      startTime = bounds.minTime;
      endTime = startTime + span;
    }
    if (endTime > bounds.maxTime) {
      endTime = bounds.maxTime;
      startTime = endTime - span;
    }
  }
  return { startTime, endTime, scrollY: view.scrollY };
}

/**
 * Viewport that centers `range` so it spans half the visible width (25% padding each side).
 * Clamped to bounds; if 2× duration exceeds the full trace, fits the full bounds.
 */
export function measureFocusWindow(
  range: MeasureRange,
  bounds: { minTime: number; maxTime: number },
  scrollY = 0,
): SwimlaneViewWindow {
  const start = Math.min(range.startTime, range.endTime);
  const end = Math.max(range.startTime, range.endTime);
  const duration = Math.max(MIN_WINDOW, end - start);
  const full = Math.max(MIN_WINDOW, bounds.maxTime - bounds.minTime);
  const span = Math.min(full, Math.max(MIN_WINDOW, duration * 2));
  if (span >= full) {
    return { startTime: bounds.minTime, endTime: bounds.maxTime, scrollY };
  }
  const mid = (start + end) / 2;
  let startTime = mid - span / 2;
  let endTime = mid + span / 2;
  if (startTime < bounds.minTime) {
    startTime = bounds.minTime;
    endTime = startTime + span;
  }
  if (endTime > bounds.maxTime) {
    endTime = bounds.maxTime;
    startTime = endTime - span;
  }
  return { startTime, endTime, scrollY };
}

export function applyWindow(state: SwimlaneViewState, window: SwimlaneViewWindow): SwimlaneViewState {
  return {
    ...state,
    startTime: window.startTime,
    endTime: window.endTime,
    scrollY: window.scrollY,
  };
}
