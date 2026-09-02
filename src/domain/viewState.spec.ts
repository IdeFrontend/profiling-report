import { describe, expect, it } from 'vitest';
import {
  createViewState,
  MAX_ZOOM_HISTORY,
  pushZoomHistory,
  setOffset,
  undoZoom,
  zoomHistoryDepth,
} from './viewState';

describe('zoom-history (Q24)', () => {
  it('starts empty and undoZoom is a no-op', () => {
    const s0 = createViewState(null);
    expect(s0.zoomHistory).toEqual([]);
    expect(zoomHistoryDepth(s0)).toBe(0);
    const s1 = undoZoom(s0);
    expect(s1).toBe(s0);
  });

  it('pushZoomHistory adds a new entry; consecutive duplicates are deduped', () => {
    const s0 = createViewState(null);
    const w1 = { startTime: 0, endTime: 100, scrollY: 0 };
    const s1 = pushZoomHistory(s0, w1);
    expect(s1.zoomHistory).toEqual([w1]);

    // Identical window → no-op (same reference returned).
    expect(pushZoomHistory(s1, w1)).toBe(s1);

    // Different window → push.
    const w2 = { startTime: 0, endTime: 200, scrollY: 0 };
    const s2 = pushZoomHistory(s1, w2);
    expect(s2.zoomHistory).toEqual([w1, w2]);
  });

  it('caps the stack at MAX_ZOOM_HISTORY', () => {
    let s = createViewState(null);
    for (let i = 0; i < MAX_ZOOM_HISTORY + 5; i++) {
      s = pushZoomHistory(s, { startTime: i, endTime: i + 1, scrollY: 0 });
    }
    expect(s.zoomHistory.length).toBe(MAX_ZOOM_HISTORY);
    expect(s.zoomHistory[0].startTime).toBe(5);
    expect(s.zoomHistory[s.zoomHistory.length - 1].startTime).toBe(MAX_ZOOM_HISTORY + 4);
  });

  it('undoZoom pops the most recent entry and applies it as the new window', () => {
    // Real-world flow: the host calls `applyWindowWithHistory(next)` which
    //   1) pushes the CURRENT window (so undo can return to it), and
    //   2) applies `next` as the new window.
    // We simulate two zoom-ins and check the undo step walks back to the
    // previous window.
    let s = createViewState(null);
    // Before any change: history is empty.
    expect(s.zoomHistory.length).toBe(0);

    // Zoom-in #1: push {0..100}, then apply {0..50}.
    s = pushZoomHistory(s, { startTime: 0, endTime: 100, scrollY: 0 });
    // Imagine applyWindow set startTime=0, endTime=50 — for undo we just
    // trust the stack. The host would now set startTime/endTime/scrollY.
    s = { ...s, startTime: 0, endTime: 50 };

    // Zoom-in #2: push {0..50}, then apply {0..25}.
    s = pushZoomHistory(s, { startTime: 0, endTime: 50, scrollY: 0 });
    s = { ...s, startTime: 0, endTime: 25 };

    expect(s.zoomHistory.length).toBe(2);
    expect(s.zoomHistory[0]).toEqual({ startTime: 0, endTime: 100, scrollY: 0 });
    expect(s.zoomHistory[1]).toEqual({ startTime: 0, endTime: 50, scrollY: 0 });

    // First undo: walk {0..25} → {0..50} (the most-recent push) and pop.
    const undone = undoZoom(s);
    expect(undone.startTime).toBe(0);
    expect(undone.endTime).toBe(50);
    expect(undone.zoomHistory.length).toBe(1);

    // Second undo: walk {0..50} → {0..100} and pop.
    const undone2 = undoZoom(undone);
    expect(undone2.startTime).toBe(0);
    expect(undone2.endTime).toBe(100);
    expect(undone2.zoomHistory.length).toBe(0);

    // Third undo on an empty history is a no-op.
    expect(undoZoom(undone2)).toBe(undone2);
  });
});

describe('setOffset (Q25)', () => {
  it('starts at 0 and updates idempotently', () => {
    const s0 = createViewState(null);
    expect(s0.offsetNs).toBe(0);
    expect(setOffset(s0, 0)).toBe(s0);
    const s1 = setOffset(s0, 12345);
    expect(s1.offsetNs).toBe(12345);
    expect(setOffset(s1, 12345)).toBe(s1);
  });
});
