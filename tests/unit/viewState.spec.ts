import { describe, expect, it } from 'vitest';
import {
  applyWindow,
  clearMeasure,
  createViewState,
  panBy,
  setMeasureRange,
  zoomAt,
  zoomToFitWindow,
} from '../../src/domain/viewState';
import type { SwimlaneModel } from '../../src/domain/types';

const model: SwimlaneModel = {
  processes: [],
  minTime: 1000,
  maxTime: 5000,
};

describe('PR-VIEW: swimlane view window', () => {
  it('PR-VIEW-001: zoomToFit uses model min/max', () => {
    const w = zoomToFitWindow(model);
    expect(w.startTime).toBe(1000);
    expect(w.endTime).toBe(5000);
    const state = createViewState(model);
    expect(state.startTime).toBe(1000);
    expect(state.endTime).toBe(5000);
    expect(state.asideVisible).toBe(true);
  });

  it('PR-VIEW-002: zoomAt shrinks window around anchor', () => {
    const view = { startTime: 1000, endTime: 5000, scrollY: 0 };
    const next = zoomAt(view, 2, 3000, { minTime: 1000, maxTime: 5000 });
    expect(next.endTime - next.startTime).toBe(2000);
    expect(next.startTime).toBeLessThanOrEqual(3000);
    expect(next.endTime).toBeGreaterThanOrEqual(3000);
  });

  it('PR-VIEW-003: panBy shifts window within bounds', () => {
    const view = { startTime: 1000, endTime: 3000, scrollY: 0 };
    const next = panBy(view, 500, { minTime: 1000, maxTime: 5000 });
    expect(next.startTime).toBe(1500);
    expect(next.endTime).toBe(3500);
    const clamped = panBy(view, -9999, { minTime: 1000, maxTime: 5000 });
    expect(clamped.startTime).toBe(1000);
    const state = applyWindow(createViewState(model), next);
    expect(state.startTime).toBe(1500);
  });

  it('PR-VIEW-004: createViewState initializes measure fields off', () => {
    const state = createViewState(model);
    expect(state.measureMode).toBe(false);
    expect(state.measureRange).toBeNull();
  });

  it('PR-VIEW-005: setMeasureRange normalizes; clearMeasure resets', () => {
    let state = createViewState(model);
    state = { ...state, measureMode: true };
    state = setMeasureRange(state, { startTime: 4000, endTime: 2000 });
    expect(state.measureRange).toEqual({ startTime: 2000, endTime: 4000 });
    state = clearMeasure(state);
    expect(state.measureMode).toBe(false);
    expect(state.measureRange).toBeNull();
  });
});
