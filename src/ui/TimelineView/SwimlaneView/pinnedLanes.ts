import { filterCollapsedTree, isFolderNode } from '../../../domain/swimTree';
import type { SwimlaneModel, SwimThread } from '../../../domain/types';
import type { GutterLane } from './LaneGutter/gutterTypes';

function walkThreads(threads: SwimThread[], visit: (t: SwimThread) => void): void {
  for (const t of threads) {
    visit(t);
    if (t.children?.length) walkThreads(t.children, visit);
  }
}

function walkGutter(
  lanes: GutterLane[],
  depth: number,
  visit: (lane: GutterLane, depth: number) => void,
): void {
  for (const lane of lanes) {
    visit(lane, depth);
    if (lane.children?.length) walkGutter(lane.children, depth + 1, visit);
  }
}

function cloneThread(t: SwimThread): SwimThread {
  if (!isFolderNode(t)) return { ...t };
  return { ...t, children: (t.children ?? []).map(cloneThread) };
}

function cloneGutterLane(lane: GutterLane): GutterLane {
  if (lane.children === undefined) return { ...lane };
  return { ...lane, children: lane.children.map(cloneGutterLane) };
}

export type PinnedGutterRoot = { lane: GutterLane; depth: number };

/** @deprecated Use PinnedGutterRoot — strip renders subtree roots, not flat leaves. */
export type PinnedGutterRow = PinnedGutterRoot;

/**
 * Resolve pinned lane/folder roots in pin order (full subtrees, depth 0).
 * Skips missing ids. Cards are not in the gutter lane tree.
 */
export function resolvePinnedGutterRoots(
  groups: { lanes: GutterLane[] }[],
  ids: readonly string[],
): PinnedGutterRoot[] {
  const byId = new Map<string, GutterLane>();
  for (const g of groups) {
    walkGutter(g.lanes, 0, (lane) => {
      byId.set(lane.id, lane);
    });
  }
  const out: PinnedGutterRoot[] = [];
  for (const id of ids) {
    const lane = byId.get(id);
    if (lane) out.push({ lane: cloneGutterLane(lane), depth: 0 });
  }
  return out;
}

/** Alias kept for call sites that still import the old name. */
export const resolvePinnedGutterLanes = resolvePinnedGutterRoots;

/** Visible strip rows for a root list under strip-local collapse. */
export function countPinnedVisibleRows(
  roots: readonly PinnedGutterRoot[],
  stripCollapsedIds: readonly string[] = [],
): number {
  const collapsed = new Set(stripCollapsedIds);
  let n = 0;
  const walk = (lane: GutterLane): void => {
    n += 1;
    if (lane.children === undefined || collapsed.has(lane.id)) return;
    for (const child of lane.children) walk(child);
  };
  for (const root of roots) walk(root.lane);
  return n;
}

/**
 * Swim model of pinned roots (leaf or folder subtree), pin order, Card-free.
 * Sets `skipCardHeaders` so layout omits Card header bands.
 * Pass the **unfiltered** swim model so pins survive ancestor Card/folder collapse.
 * `stripCollapsedIds` filters descendants inside the strip only (independent of body).
 */
export function buildPinnedSwimModel(
  model: SwimlaneModel | null,
  pinnedLaneIds: readonly string[],
  stripCollapsedIds: readonly string[] = [],
): SwimlaneModel | null {
  if (!model || pinnedLaneIds.length === 0) return null;
  const byId = new Map<string, SwimThread>();
  for (const p of model.processes) {
    walkThreads(p.threads, (t) => {
      byId.set(t.id, t);
    });
  }
  const threads: SwimThread[] = [];
  for (const id of pinnedLaneIds) {
    const t = byId.get(id);
    if (t) threads.push(cloneThread(t));
  }
  if (threads.length === 0) return null;
  const base: SwimlaneModel = {
    minTime: model.minTime,
    maxTime: model.maxTime,
    skipCardHeaders: true,
    processes: [{ id: 'pinned', name: '', threads }],
  };
  if (stripCollapsedIds.length === 0) return base;
  return filterCollapsedTree(base, stripCollapsedIds);
}
