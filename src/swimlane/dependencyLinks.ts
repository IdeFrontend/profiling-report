import type { EventRef, SwimEvent, SwimlaneViewWindow } from '../domain/types';
import { eventLinkContentY, findLaidOutEvent, type LaidOutEvent, type SwimlaneLayout } from './layout';

export const DEP_STROKE_WIDTH = 3;

export interface DependencyLink {
  t0: number;
  y0: number;
  t1: number;
  y1: number;
  fromColor: string;
  toColor: string;
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

function anchor(item: LaidOutEvent): { tLeft: number; tRight: number; y: number; color: string } {
  return {
    tLeft: item.event.startTime,
    tRight: item.event.startTime + item.event.duration,
    y: eventLinkContentY(item.y),
    color: item.color,
  };
}

/**
 * Predecessor right-mid → selected left-mid, then selected right-mid → successor left-mid.
 * Times and content Y are view-independent so WebGL can pan/zoom with uniforms only.
 * Skips refs not in the layout (collapsed / missing).
 */
export function dependencyLinks(layout: SwimlaneLayout, selectedId: string | null): DependencyLink[] {
  if (!selectedId) return [];
  const selected = findLaidOutEvent(layout, selectedId);
  const deps = selected?.event.dependencies;
  if (!selected || !deps) return [];
  const sel = anchor(selected);
  const links: DependencyLink[] = [];
  for (const ref of deps.predecessors) {
    const item = laidOutFromRef(layout, ref);
    if (!item) continue;
    const a = anchor(item);
    links.push({ t0: a.tRight, y0: a.y, t1: sel.tLeft, y1: sel.y, fromColor: a.color, toColor: sel.color });
  }
  for (const ref of deps.successors) {
    const item = laidOutFromRef(layout, ref);
    if (!item) continue;
    const a = anchor(item);
    links.push({ t0: sel.tRight, y0: sel.y, t1: a.tLeft, y1: a.y, fromColor: sel.color, toColor: a.color });
  }
  return links;
}

export function cubicControlPull(x0: number, x1: number): number {
  return Math.max(24, Math.abs(x1 - x0) * 0.4);
}

/** Float32-safe time for the WebGL curve pass — same origin as `encodeIntervalPair`. */
export function glLinkTime(t: number, timeBase: number): number {
  return Math.fround(t - timeBase);
}

export function linkToScreen(
  link: DependencyLink,
  view: SwimlaneViewWindow,
  width: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const span = Math.max(1, view.endTime - view.startTime);
  return {
    x0: ((link.t0 - view.startTime) / span) * width,
    y0: link.y0 - view.scrollY,
    x1: ((link.t1 - view.startTime) / span) * width,
    y1: link.y1 - view.scrollY,
  };
}

/** Canvas 2D fallback: same cubic + pred→succ gradient as the WebGL instance pass. */
export function paintDependencyLinks(
  ctx: CanvasRenderingContext2D,
  layout: SwimlaneLayout,
  view: SwimlaneViewWindow,
  width: number,
  selectedId: string | null,
): void {
  const links = dependencyLinks(layout, selectedId);
  if (links.length === 0) return;
  ctx.lineWidth = DEP_STROKE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const link of links) {
    const { x0, y0, x1, y1 } = linkToScreen(link, view, width);
    const pull = cubicControlPull(x0, x1);
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, link.fromColor);
    g.addColorStop(1, link.toColor);
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x0 + pull, y0, x1 - pull, y1, x1, y1);
    ctx.stroke();
  }
}
