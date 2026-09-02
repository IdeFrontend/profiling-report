import type {
  MeasureRange,
  SwimlaneModel,
  SwimlaneViewState,
  SwimlaneViewWindow,
} from './types';

const MIN_WINDOW = 1;

/** Shared zoom-in floor (same as `zoomAt`); export for tests / slider mapping. */
export const MIN_VIEW_WINDOW = MIN_WINDOW;

/** Max zoom-history depth (Q24 MVP interim: bounded undo stack). */
export const MAX_ZOOM_HISTORY = 10;

/** Max zoom ratio for a trace: fullSpan / MIN_WINDOW (≥ 1). */
export function maxZoomRatio(fullSpan: number): number {
  const full = Math.max(MIN_WINDOW, fullSpan);
  return Math.max(1, full / MIN_WINDOW);
}

/**
 * Toolbar slider 0…100 from current window span.
 * 0 = fit (full span); 100 = min window (`MIN_WINDOW`, same floor as Ctrl+wheel).
 */
export function zoomPercentFromSpan(span: number, fullSpan: number): number {
  const full = Math.max(MIN_WINDOW, fullSpan);
  const s = Math.max(MIN_WINDOW, span);
  if (s >= full) return 0;
  const maxR = maxZoomRatio(full);
  if (maxR <= 1) return 0;
  const ratio = full / s;
  return Math.min(100, Math.round((Math.log2(ratio) / Math.log2(maxR)) * 100));
}

/** Inverse of `zoomPercentFromSpan` — span for a slider percent. */
export function spanFromZoomPercent(pct: number, fullSpan: number): number {
  const full = Math.max(MIN_WINDOW, fullSpan);
  const maxR = maxZoomRatio(full);
  if (pct <= 0 || maxR <= 1) return full;
  if (pct >= 100) return MIN_WINDOW;
  const ratio = 2 ** ((pct / 100) * Math.log2(maxR));
  return Math.max(MIN_WINDOW, full / Math.max(1, ratio));
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
    hiddenLaneIds: [],
    zoomHistory: [],
    offsetNs: 0,
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

/** Hide a leaf lane from the swim body (context-menu 隐藏 / Hide). */
export function hideLane(state: SwimlaneViewState, laneId: string): SwimlaneViewState {
  if (state.hiddenLaneIds.includes(laneId)) return state;
  return { ...state, hiddenLaneIds: [...state.hiddenLaneIds, laneId] };
}

/** Bring a hidden leaf lane back (session is per-mount, so no explicit "show" UI in MVP). */
export function showLane(state: SwimlaneViewState, laneId: string): SwimlaneViewState {
  if (!state.hiddenLaneIds.includes(laneId)) return state;
  return { ...state, hiddenLaneIds: state.hiddenLaneIds.filter((id) => id !== laneId) };
}

/** Push the current window onto the zoom-history stack. No-op when window is unchanged. */
export function pushZoomHistory(
  state: SwimlaneViewState,
  window: SwimlaneViewWindow,
): SwimlaneViewState {
  const last = state.zoomHistory[state.zoomHistory.length - 1];
  if (
    last &&
    last.startTime === window.startTime &&
    last.endTime === window.endTime &&
    last.scrollY === window.scrollY
  ) {
    return state;
  }
  const next = [...state.zoomHistory, window];
  if (next.length > MAX_ZOOM_HISTORY) next.shift();
  return { ...state, zoomHistory: next };
}

/** Pop the most recent zoom-history entry and apply it. Returns the same state if empty. */
export function undoZoom(state: SwimlaneViewState): SwimlaneViewState {
  if (state.zoomHistory.length === 0) return state;
  const next = state.zoomHistory.slice(0, -1);
  const target = state.zoomHistory[state.zoomHistory.length - 1];
  return {
    ...state,
    zoomHistory: next,
    startTime: target.startTime,
    endTime: target.endTime,
    scrollY: target.scrollY,
  };
}

/** Number of zoom-history entries available to undo (Q24 badge "(N)"). */
export function zoomHistoryDepth(state: SwimlaneViewState): number {
  return state.zoomHistory.length;
}

/** Set the lane-start time offset (Q25 MVP). Pass 0 to clear. */
export function setOffset(state: SwimlaneViewState, offsetNs: number): SwimlaneViewState {
  if (state.offsetNs === offsetNs) return state;
  return { ...state, offsetNs };
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
): SwimlaneViewWindow {
  const span = Math.max(MIN_WINDOW, view.endTime - view.startTime);
  const nextSpan = Math.max(MIN_WINDOW, span / factor);
  const ratio = (anchorTime - view.startTime) / span;
  let startTime = anchorTime - nextSpan * ratio;
  let endTime = startTime + nextSpan;

  if (bounds) {
    const full = Math.max(MIN_WINDOW, bounds.maxTime - bounds.minTime);
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
