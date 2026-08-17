import {
  DEFAULT_DEPENDENCY_DEPTH,
  normalizeDependencyDepth,
  type DependencyMode,
  type EventRef,
  type SwimlaneViewWindow,
} from '../domain/types';
import { eventLinkContentY, findLaidOutEvent, type LaidOutEvent, type SwimlaneLayout } from './layout';

export const DEP_STROKE_WIDTH = 3;
/** BFS cap per direction so depth=-1 cannot freeze the main thread. */
export const MAX_DEPENDENCY_LINKS = 10_000;

export interface DependencyLink {
  t0: number;
  y0: number;
  t1: number;
  y1: number;
  fromColor: string;
  toColor: string;
}

function laidOutFromRef(layout: SwimlaneLayout, ref: EventRef): LaidOutEvent | undefined {
  const ev = layout.lanesByTid.get(ref.tid)?.thread.events[ref.index];
  return ev ? layout.eventsById.get(ev.id) : undefined;
}

function anchor(item: LaidOutEvent): { tLeft: number; tRight: number; y: number; color: string } {
  return {
    tLeft: item.event.startTime,
    tRight: item.event.startTime + item.event.duration,
    y: eventLinkContentY(item.y),
    color: item.color,
  };
}

function pushLink(
  links: DependencyLink[],
  seen: Set<string>,
  from: LaidOutEvent,
  to: LaidOutEvent,
): boolean {
  const key = `${from.id}>${to.id}`;
  if (seen.has(key)) return false;
  seen.add(key);
  const a = anchor(from);
  const b = anchor(to);
  links.push({ t0: a.tRight, y0: a.y, t1: b.tLeft, y1: b.y, fromColor: a.color, toColor: b.color });
  return true;
}

/**
 * Walk predecessor and/or successor refs up to `depth` hops (`-1` = no hop cap).
 * Each side stops after `MAX_DEPENDENCY_LINKS`. Cycles stop via visited ids.
 * Collapsed/missing refs are skipped.
 */
function collectDependencyGraph(
  layout: SwimlaneLayout,
  selectedId: string | null,
  mode: DependencyMode = 'all',
  depth: number = DEFAULT_DEPENDENCY_DEPTH,
): { ids: Set<string>; links: DependencyLink[] } {
  const ids = new Set<string>();
  const links: DependencyLink[] = [];
  if (!selectedId) return { ids, links };
  const selected = findLaidOutEvent(layout, selectedId);
  if (!selected) return { ids, links };
  ids.add(selectedId);

  const hops = normalizeDependencyDepth(depth);
  if (hops === 0) return { ids, links };

  const seenEdges = new Set<string>();
  const walkPred = mode !== 'successors';
  const walkSucc = mode !== 'predecessors';
  if (walkPred) walkDir(selected, 'predecessors', hops, ids, links, seenEdges, layout);
  if (walkSucc) walkDir(selected, 'successors', hops, ids, links, seenEdges, layout);
  return { ids, links };
}

function walkDir(
  start: LaidOutEvent,
  dir: 'predecessors' | 'successors',
  hops: number,
  ids: Set<string>,
  links: DependencyLink[],
  seenEdges: Set<string>,
  layout: SwimlaneLayout,
): void {
  let frontier: LaidOutEvent[] = [start];
  const visited = new Set<string>([start.id]);
  const unlimited = hops < 0;
  let added = 0;
  for (let hop = 0; (unlimited || hop < hops) && frontier.length > 0; hop++) {
    const next: LaidOutEvent[] = [];
    for (const node of frontier) {
      const refs = node.event.dependencies?.[dir] ?? [];
      for (const ref of refs) {
        if (added >= MAX_DEPENDENCY_LINKS) return;
        const item = laidOutFromRef(layout, ref);
        if (!item) continue;
        ids.add(item.id);
        const grew =
          dir === 'predecessors'
            ? pushLink(links, seenEdges, item, node)
            : pushLink(links, seenEdges, node, item);
        if (grew) added += 1;
        if (visited.has(item.id)) continue;
        visited.add(item.id);
        next.push(item);
      }
    }
    frontier = next;
  }
}

/** Selected event plus laid-out predecessor/successor ids (for undimmed fill + labels). */
export function dependencyNeighborIds(
  layout: SwimlaneLayout,
  selectedId: string | null,
  mode: DependencyMode = 'all',
  depth: number = DEFAULT_DEPENDENCY_DEPTH,
): Set<string> {
  return collectDependencyGraph(layout, selectedId, mode, depth).ids;
}

/**
 * Predecessor right-mid → selected left-mid, then selected right-mid → successor left-mid,
 * repeated for each hop up to `depth`. Times and content Y are view-independent so WebGL
 * can pan/zoom with uniforms only. Skips refs not in the layout (collapsed / missing).
 */
export function dependencyLinks(
  layout: SwimlaneLayout,
  selectedId: string | null,
  mode: DependencyMode = 'all',
  depth: number = DEFAULT_DEPENDENCY_DEPTH,
): DependencyLink[] {
  return collectDependencyGraph(layout, selectedId, mode, depth).links;
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

/** True unless both endpoints sit entirely left or entirely right of the time window. */
export function linkIntersectsTimeView(link: DependencyLink, view: SwimlaneViewWindow): boolean {
  const lo = Math.min(link.t0, link.t1);
  const hi = Math.max(link.t0, link.t1);
  return hi >= view.startTime && lo <= view.endTime;
}

/** Canvas 2D fallback: same cubic + pred→succ gradient as the WebGL instance pass. */
export function paintDependencyLinks(
  ctx: CanvasRenderingContext2D,
  layout: SwimlaneLayout,
  view: SwimlaneViewWindow,
  width: number,
  selectedId: string | null,
  mode: DependencyMode = 'all',
  depth: number = DEFAULT_DEPENDENCY_DEPTH,
): void {
  const links = dependencyLinks(layout, selectedId, mode, depth);
  if (links.length === 0) return;
  ctx.lineWidth = DEP_STROKE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const link of links) {
    if (!linkIntersectsTimeView(link, view)) continue;
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
