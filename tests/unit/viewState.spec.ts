import { describe, expect, it } from 'vitest';
import {
  applyWindow,
  clearMeasure,
  createViewState,
  KEYBOARD_PAN_STEP_PX,
  keyboardPanStepTime,
  measureFocusWindow,
  MIN_VIEW_WINDOW,
  panBy,
  pinLane,
  setMeasureRange,
  spanFromZoomPercent,
  unpinLane,
  zoomAt,
  zoomPercentFromSpan,
  zoomToFitWindow,
} from '../../src/domain/viewState';
import type { SwimlaneModel } from '../../src/domain/types';

const model: SwimlaneModel = {
  processes: [],
  minTime: 1000,
  maxTime: 5000,
};

describe('PR-VIEW: swimlane view window', () => {
  it('PR-VIEW-001: zoomToFit uses model minTime through maxTime', () => {
    const w = zoomToFitWindow(model);
    expect(w.startTime).toBe(1000);
    expect(w.endTime).toBe(5000);
    const state = createViewState(model);
    expect(state.startTime).toBe(1000);
    expect(state.endTime).toBe(5000);
    expect(state.asideVisible).toBe(true);
  });

  it('PR-VIEW-011: zoomToFit keeps degenerate minTime===maxTime in minTime space', () => {
    const point: SwimlaneModel = { processes: [], minTime: 986_000, maxTime: 986_000 };
    const w = zoomToFitWindow(point);
    expect(w.startTime).toBe(986_000);
    expect(w.endTime).toBe(986_000 + MIN_VIEW_WINDOW);
    expect(zoomToFitWindow(null)).toEqual({ startTime: 0, endTime: 1, scrollY: 0 });
  });

  it('PR-VIEW-002: zoomAt shrinks window around anchor', () => {
    const view = { startTime: 0, endTime: 4000, scrollY: 0 };
    const next = zoomAt(view, 2, 3000, { minTime: 0, maxTime: 5000 });
    expect(next.endTime - next.startTime).toBe(2000);
    expect(next.startTime).toBeLessThanOrEqual(3000);
    expect(next.endTime).toBeGreaterThanOrEqual(3000);
  });

  it('PR-VIEW-003: panBy shifts window within bounds', () => {
    const view = { startTime: 0, endTime: 2000, scrollY: 0 };
    const next = panBy(view, 500, { minTime: 0, maxTime: 5000 });
    expect(next.startTime).toBe(500);
    expect(next.endTime).toBe(2500);
    const clamped = panBy(view, -9999, { minTime: 0, maxTime: 5000 });
    expect(clamped.startTime).toBe(0);
    const state = applyWindow(createViewState(model), next);
    expect(state.startTime).toBe(500);
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

  it('PR-VIEW-006: measureFocusWindow centers range at half viewport span', () => {
    const next = measureFocusWindow(
      { startTime: 2000, endTime: 3000 },
      { minTime: 0, maxTime: 5000 },
      12,
    );
    // Duration 1000 → span 2000, centered on 2500.
    expect(next.startTime).toBe(1500);
    expect(next.endTime).toBe(3500);
    expect(next.scrollY).toBe(12);
  });

  it('PR-VIEW-007: measureFocusWindow clamps to bounds and fits when 2× exceeds full', () => {
    const nearEdge = measureFocusWindow(
      { startTime: 1000, endTime: 1500 },
      { minTime: 0, maxTime: 5000 },
    );
    expect(nearEdge.startTime).toBe(750);
    expect(nearEdge.endTime - nearEdge.startTime).toBe(1000);

    const tooWide = measureFocusWindow(
      { startTime: 1000, endTime: 4000 },
      { minTime: 0, maxTime: 5000 },
    );
    expect(tooWide.startTime).toBe(0);
    expect(tooWide.endTime).toBe(5000);
  });

  it('PR-VIEW-008: zoomPercent extremes match fit and MIN_VIEW_WINDOW', () => {
    const full = 4000;
    expect(zoomPercentFromSpan(full, full)).toBe(0);
    expect(spanFromZoomPercent(0, full)).toBe(full);
    expect(zoomPercentFromSpan(MIN_VIEW_WINDOW, full)).toBe(100);
    expect(spanFromZoomPercent(100, full)).toBe(MIN_VIEW_WINDOW);
  });

  it('PR-VIEW-009: zoomPercent ↔ span round-trip (mid + extremes)', () => {
    const full = 4000;
    for (const pct of [0, 25, 50, 75, 100]) {
      const span = spanFromZoomPercent(pct, full);
      expect(zoomPercentFromSpan(span, full)).toBe(pct);
    }
  });

  it('PR-VIEW-010: slider max matches zoomAt floor', () => {
    const full = 5000;
    const view = { startTime: 0, endTime: 5000, scrollY: 0 };
    let cur = view;
    // Keep zooming in until floor; slider must already read 100 at that span.
    for (let i = 0; i < 40; i++) {
      cur = zoomAt(cur, 2, 3000, { minTime: 0, maxTime: 5000 });
    }
    const span = cur.endTime - cur.startTime;
    expect(span).toBe(MIN_VIEW_WINDOW);
    expect(zoomPercentFromSpan(span, full)).toBe(100);
    expect(spanFromZoomPercent(100, full)).toBe(span);
  });

  it('PR-VIEW-013: createViewState initializes pinnedLaneIds empty', () => {
    expect(createViewState(model).pinnedLaneIds).toEqual([]);
    expect(createViewState(null).pinnedLaneIds).toEqual([]);
  });

  it('PR-VIEW-014: pinLane appends id in pin order without duplicates', () => {
    const base = createViewState(model);
    const one = pinLane(base, 'a');
    expect(one.pinnedLaneIds).toEqual(['a']);
    expect(base.pinnedLaneIds).toEqual([]);
    const two = pinLane(one, 'b');
    expect(two.pinnedLaneIds).toEqual(['a', 'b']);
    expect(pinLane(two, 'a').pinnedLaneIds).toEqual(['a', 'b']);
  });

  it('PR-VIEW-015: unpinLane removes id and leaves other pins unchanged', () => {
    const pinned = pinLane(pinLane(createViewState(model), 'a'), 'b');
    const dropped = unpinLane(pinned, 'a');
    expect(dropped.pinnedLaneIds).toEqual(['b']);
    expect(unpinLane(dropped, 'missing').pinnedLaneIds).toEqual(['b']);
    expect(pinned.pinnedLaneIds).toEqual(['a', 'b']);
  });

  it('PR-VIEW-016: keyboardPanStepTime maps KEYBOARD_PAN_STEP_PX to a time delta', () => {
    expect(KEYBOARD_PAN_STEP_PX).toBe(30);
    // 30 px across a 1000 px track, over a 1000 ns span → 30 ns.
    expect(keyboardPanStepTime(1000, 1000)).toBe(30);
    // Wider span → proportionally larger step.
    expect(keyboardPanStepTime(2000, 1000)).toBe(60);
    // Wider track → proportionally smaller step (30/2000 × 1000 = 15).
    expect(keyboardPanStepTime(1000, 2000)).toBeCloseTo(15, 10);
  });

  it('PR-VIEW-017: keyboardPanStepTime clamps non-positive span/trackWidth', () => {
    // Zero/negative trackWidth clamps to 1 → step stays finite (no NaN / div-by-zero).
    expect(Number.isFinite(keyboardPanStepTime(1000, 0))).toBe(true);
    expect(keyboardPanStepTime(1000, 0)).toBe(30 * 1000);
    expect(keyboardPanStepTime(1000, -5)).toBe(30 * 1000);
    // Zero/negative span clamps to 1 → positive step.
    expect(keyboardPanStepTime(0, 1000)).toBeCloseTo(0.03, 10);
    expect(keyboardPanStepTime(-7, 1000)).toBeCloseTo(0.03, 10);
    expect(keyboardPanStepTime(-7, -3)).toBe(30);
  });
});
