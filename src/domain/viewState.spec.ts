import { describe, expect, it } from 'vitest';
import {
  createViewState,
  hideLane,
  MAX_UNDO_HISTORY,
  pushUndo,
  setOffset,
  undoDepth,
  undoLast,
} from './viewState';

describe('undoStack (Q24 + general undo)', () => {
  it('starts empty and undoLast is a no-op', () => {
    const s0 = createViewState(null);
    expect(s0.undoStack).toEqual([]);
    expect(undoDepth(s0)).toBe(0);
    expect(undoLast(s0)).toBe(s0);
  });

  it('pushUndo records a snapshot of startTime/endTime/scrollY/selected/hidden/offset', () => {
    const s0 = createViewState(null);
    s0.selectedEventId = 'evt-A';
    s0.hiddenLaneIds.push('lane-X');
    s0.offsetNs = 500;
    const { next: s1, snapshot } = pushUndo(s0);
    expect(s1.undoStack.length).toBe(1);
    expect(snapshot.selectedEventId).toBe('evt-A');
    expect(snapshot.hiddenLaneIds).toEqual(['lane-X']);
    expect(snapshot.offsetNs).toBe(500);
    // The original state is not mutated.
    expect(s0.undoStack).toEqual([]);
  });

  it('caps the stack at MAX_UNDO_HISTORY', () => {
    let s = createViewState(null);
    for (let i = 0; i < MAX_UNDO_HISTORY + 5; i++) {
      s = pushUndo(s).next;
    }
    expect(s.undoStack.length).toBe(MAX_UNDO_HISTORY);
  });

  it('undoLast restores all snapshot fields, not just the window', () => {
    let s = createViewState(null);
    // Initial: selectedEventId=null, hiddenLaneIds=[], offsetNs=0
    // Simulate a sequence of three user actions; each one snapshots FIRST.
    // 1) User selected event evt-A.
    s = pushUndo(s).next;
    s = { ...s, selectedEventId: 'evt-A' };
    // 2) User hid lane-X.
    s = pushUndo(s).next;
    s = hideLane(s, 'lane-X');
    // 3) User set offset to 999.
    s = pushUndo(s).next;
    s = setOffset(s, 999);
    expect(s.selectedEventId).toBe('evt-A');
    expect(s.hiddenLaneIds).toEqual(['lane-X']);
    expect(s.offsetNs).toBe(999);
    expect(s.undoStack.length).toBe(3);

    // First undo: revert offset.
    s = undoLast(s);
    expect(s.offsetNs).toBe(0);
    expect(s.selectedEventId).toBe('evt-A');
    expect(s.hiddenLaneIds).toEqual(['lane-X']);

    // Second undo: un-hide lane-X.
    s = undoLast(s);
    expect(s.hiddenLaneIds).toEqual([]);
    expect(s.selectedEventId).toBe('evt-A');

    // Third undo: deselect event.
    s = undoLast(s);
    expect(s.selectedEventId).toBeNull();
    expect(s.undoStack.length).toBe(0);

    // Fourth undo is a no-op.
    expect(undoLast(s)).toBe(s);
  });

  it('undoLast preserves fields NOT in the snapshot (measureMode, measureRange, pinnedLaneIds, undoStack)', () => {
    const s0 = createViewState(null);
    s0.measureMode = true;
    s0.measureRange = { startTime: 0, endTime: 50 };
    s0.pinnedLaneIds.push('lane-Z');
    s0.selectedEventId = 'evt-A';
    const { next: s1 } = pushUndo(s0);
    s1.selectedEventId = 'evt-B';

    const undone = undoLast(s1);
    expect(undone.selectedEventId).toBe('evt-A'); // restored
    expect(undone.measureMode).toBe(true);        // preserved
    expect(undone.measureRange).toEqual({ startTime: 0, endTime: 50 }); // preserved
    expect(undone.pinnedLaneIds).toEqual(['lane-Z']); // preserved
    expect(undone.undoStack.length).toBe(0);      // popped
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
