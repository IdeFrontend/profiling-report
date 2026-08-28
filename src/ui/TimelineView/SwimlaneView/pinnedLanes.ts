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

export type PinnedGutterRow = { lane: GutterLane; depth: number };

/** Resolve leaf gutter lanes in `ids` order (skip missing / folders). */
export function resolvePinnedGutterLanes(
  groups: { lanes: GutterLane[] }[],
  ids: readonly string[],
): PinnedGutterRow[] {
  const byId = new Map<string, PinnedGutterRow>();
  for (const g of groups) {
    walkGutter(g.lanes, 0, (lane, depth) => {
      if (lane.children === undefined) byId.set(lane.id, { lane, depth });
    });
  }
  const out: PinnedGutterRow[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row) out.push(row);
  }
  return out;
}

/**
 * Flat swim model of pinned leaf threads only (Card-free), pin order.
 * Sets `skipCardHeaders` so layout omits Card header bands.
 */
export function buildPinnedSwimModel(
  model: SwimlaneModel | null,
  pinnedLaneIds: readonly string[],
): SwimlaneModel | null {
  if (!model || pinnedLaneIds.length === 0) return null;
  const byId = new Map<string, SwimThread>();
  for (const p of model.processes) {
    walkThreads(p.threads, (t) => {
      if (!t.children?.length) byId.set(t.id, t);
    });
  }
  const threads: SwimThread[] = [];
  for (const id of pinnedLaneIds) {
    const t = byId.get(id);
    if (t) threads.push({ ...t, children: undefined });
  }
  if (threads.length === 0) return null;
  return {
    minTime: model.minTime,
    maxTime: model.maxTime,
    skipCardHeaders: true,
    processes: [{ id: 'pinned', name: '', threads }],
  };
}
