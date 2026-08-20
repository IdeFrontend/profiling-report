import type { MeasureRange } from '../../domain/types';

export type MeasureResizeEdge = 'left' | 'right';

/** ~1px of time in the current view, at least 1 time unit. */
export function measureResizeMinSpan(viewStart: number, viewEnd: number, widthPx: number): number {
  const span = Math.max(1, viewEnd - viewStart);
  const w = Math.max(1, widthPx);
  return Math.max(1, span / w);
}

/**
 * Resize one measure edge without crossing the other; clamp into the view window.
 * `fixedOther` is the unchanged bound (end for left drag, start for right drag).
 */
export function resizeMeasureEdge(input: {
  edge: MeasureResizeEdge;
  time: number;
  fixedOther: number;
  viewStart: number;
  viewEnd: number;
  minSpan: number;
}): MeasureRange {
  const { edge, fixedOther, viewStart, viewEnd } = input;
  const minSpan = Math.max(1, input.minSpan);
  const lo = Math.min(viewStart, viewEnd);
  const hi = Math.max(viewStart, viewEnd);
  const t = Math.min(hi, Math.max(lo, input.time));

  if (edge === 'left') {
    const maxStart = Math.min(hi, fixedOther - minSpan);
    const start = Math.min(maxStart, Math.max(lo, t));
    return { startTime: start, endTime: Math.max(start + minSpan, fixedOther) };
  }

  const minEnd = Math.max(lo, fixedOther + minSpan);
  const end = Math.max(minEnd, Math.min(hi, t));
  return { startTime: Math.min(end - minSpan, fixedOther), endTime: end };
}

/**
 * Window-level move/up for measure create + edge resize so the gesture ends even when
 * pointerup lands on Card strips (above canvas/borders) or element capture is missed.
 * Move uses capture; up/cancel bubble so the element handler can see the gesture first.
 * Trusted moves with buttons===0 recover from a lost pointerup (skip synthetic test events).
 */
export function bindWindowPointerDrag(handlers: {
  onMove: (clientX: number) => void;
  onEnd: () => void;
}): () => void {
  const moveOpts: AddEventListenerOptions = { capture: true };
  const onMove = (e: PointerEvent) => {
    if (e.isTrusted && e.buttons === 0) {
      onEnd();
      return;
    }
    handlers.onMove(e.clientX);
  };
  const onEnd = () => {
    cleanup();
    handlers.onEnd();
  };
  const cleanup = () => {
    window.removeEventListener('pointermove', onMove, moveOpts);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
  };
  window.addEventListener('pointermove', onMove, moveOpts);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
  return cleanup;
}
