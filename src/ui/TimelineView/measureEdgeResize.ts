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
  let t = Math.min(hi, Math.max(lo, input.time));

  if (edge === 'left') {
    const maxStart = Math.min(hi, fixedOther - minSpan);
    const start = Math.min(maxStart, Math.max(lo, t));
    return { startTime: start, endTime: Math.max(start + minSpan, fixedOther) };
  }

  const minEnd = Math.max(lo, fixedOther + minSpan);
  const end = Math.max(minEnd, Math.min(hi, t));
  return { startTime: Math.min(end - minSpan, fixedOther), endTime: end };
}
