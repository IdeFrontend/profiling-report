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

/** Selected event plus laid-out predecessor/successor ids (for undimmed fill + labels). */
export function dependencyNeighborIds(layout: SwimlaneLayout, selectedId: string | null): Set<string> {
  const ids = new Set<string>();
  if (!selectedId) return ids;
  const selected = findLaidOutEvent(layout, selectedId);
  if (!selected) return ids;
  ids.add(selectedId);
  const deps = selected.event.dependencies;
  if (!deps) return ids;
  for (const ref of deps.predecessors) {
    const item = laidOutFromRef(layout, ref);
    if (item) ids.add(item.id);
  }
  for (const ref of deps.successors) {
    const item = laidOutFromRef(layout, ref);
    if (item) ids.add(item.id);
  }
  return ids;
}

export interface DependencyLink {
  d: string;
  fromColor: string;
  toColor: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function linkBetween(
  from: { x: number; y: number; color: string },
  to: { x: number; y: number; color: string },
): DependencyLink {
  return {
    d: cubicLinkPath(from.x, from.y, to.x, to.y),
    fromColor: from.color,
    toColor: to.color,
    x0: from.x,
    y0: from.y,
    x1: to.x,
    y1: to.y,
  };
}

/**
 * Bezier paths from the selected event's left edge to predecessor right-mids,
 * and from its right edge to successor left-mids. Skips refs not in the layout
 * (collapsed / missing). Off-screen events still emit a path. Stroke is a
 * gradient from the predecessor block color to the successor block color.
 */
export function dependencyLinkPaths(
  layout: SwimlaneLayout,
  view: SwimlaneViewWindow,
  width: number,
  selectedId: string | null,
): DependencyLink[] {
  if (!selectedId || width < 1) return [];
  const selected = findLaidOutEvent(layout, selectedId);
  const deps = selected?.event.dependencies;
  if (!selected || !deps) return [];

  const sel = eventScreenRect(selected, view, width);
  const selLeft = { x: sel.x, y: sel.y + sel.h / 2, color: selected.color };
  const selRight = { x: sel.x + sel.w, y: sel.y + sel.h / 2, color: selected.color };
  const paths: DependencyLink[] = [];

  for (const ref of deps.predecessors) {
    const item = laidOutFromRef(layout, ref);
    if (!item) continue;
    const r = eventScreenRect(item, view, width);
    paths.push(linkBetween(
      { x: r.x + r.w, y: r.y + r.h / 2, color: item.color },
      selLeft,
    ));
  }
  for (const ref of deps.successors) {
    const item = laidOutFromRef(layout, ref);
    if (!item) continue;
    const r = eventScreenRect(item, view, width);
    paths.push(linkBetween(selRight, { x: r.x, y: r.y + r.h / 2, color: item.color }));
  }
  return paths;
}
