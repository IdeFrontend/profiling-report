import type { SwimlaneModel, SwimlaneViewState, SwimlaneViewWindow } from './types';

const MIN_WINDOW = 1;

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
  };
}

export function zoomToFitWindow(model: SwimlaneModel | null | undefined): SwimlaneViewWindow {
  if (!model || !(model.maxTime > model.minTime)) {
    return { startTime: 0, endTime: 1, scrollY: 0 };
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

export function applyWindow(state: SwimlaneViewState, window: SwimlaneViewWindow): SwimlaneViewState {
  return {
    ...state,
    startTime: window.startTime,
    endTime: window.endTime,
    scrollY: window.scrollY,
  };
}
