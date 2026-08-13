import type { EventRef, SwimEvent, SwimlaneViewWindow } from '../domain/types';
import { eventScreenRect, findLaidOutEvent, type SwimlaneLayout } from './layout';

/** Cubic S-curve from (x0,y0) to (x1,y1); control points stay on each endpoint's y. */
export function cubicLinkPath(x0: number, y0: number, x1: number, y1: number): string {
  const pull = Math.max(24, Math.abs(x1 - x0) * 0.4);
  const f = (n: number) => n.toFixed(1);
  return `M${f(x0)},${f(y0)} C${f(x0 + pull)},${f(y0)} ${f(x1 - pull)},${f(y1)} ${f(x1)},${f(y1)}`;
}

function eventFromRef(layout: SwimlaneLayout, ref: EventRef): SwimEvent | undefined {
  for (const lane of layout.lanes) {
    if (lane.thread.id === ref.tid) return lane.thread.events[ref.index];
  }
}

function laidOutFromRef(layout: SwimlaneLayout, ref: EventRef) {
  const ev = eventFromRef(layout, ref);
  return ev ? findLaidOutEvent(layout, ev.id) : undefined;
}

/**
 * Bezier paths from the selected event's left edge to predecessor right-mids,
 * and from its right edge to successor left-mids. Skips refs not in the layout
 * (collapsed / missing). Off-screen events still emit a path.
 */
export function dependencyLinkPaths(
  layout: SwimlaneLayout,
  view: SwimlaneViewWindow,
  width: number,
  selectedId: string | null,
): string[] {
  if (!selectedId || width < 1) return [];
  const selected = findLaidOutEvent(layout, selectedId);
  const deps = selected?.event.dependencies;
  if (!selected || !deps) return [];

  const sel = eventScreenRect(selected, view, width);
  const selLeft = { x: sel.x, y: sel.y + sel.h / 2 };
  const selRight = { x: sel.x + sel.w, y: sel.y + sel.h / 2 };
  const paths: string[] = [];

  for (const ref of deps.predecessors) {
    const item = laidOutFromRef(layout, ref);
    if (!item) continue;
    const r = eventScreenRect(item, view, width);
    paths.push(cubicLinkPath(r.x + r.w, r.y + r.h / 2, selLeft.x, selLeft.y));
  }
  for (const ref of deps.successors) {
    const item = laidOutFromRef(layout, ref);
    if (!item) continue;
    const r = eventScreenRect(item, view, width);
    paths.push(cubicLinkPath(selRight.x, selRight.y, r.x, r.y + r.h / 2));
  }
  return paths;
}
