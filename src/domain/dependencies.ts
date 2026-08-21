/**
 * Detail-dock view of the swimlane dependency edges.
 *
 * `SwimEvent.dependencies` is master's `{ predecessors, successors }` pair of
 * `EventRef`s (thread id + index) — the same data the swimlane link renderer
 * walks in `src/swimlane/dependencyLinks.ts`. Reports that ship no edges yield
 * empty sides and every dependency surface hides itself
 * (VIEW_DATA_REQUIREMENTS hide-when-missing).
 */
import { normalizeDependencyDepth, type DependencyMode, type EventRef, type SwimEvent, type SwimlaneModel, type SwimThread } from './types';

export interface DependencyNode {
  id: string;
  name: string;
  startTime: number;
}

export interface DependencyNeighbors {
  incoming: DependencyNode[];
  outgoing: DependencyNode[];
}

/**
 * Per-side cap on a walk. An unlimited depth hands the panel a whole transitive
 * closure — one chip and one SVG connector each, which is where the time goes
 * (20k neighbours ≈ 1.8 s to mount).
 *
 * ponytail: flat cap, and the panel shows ~8 rows at a time. Paginate or virtualise
 * the chip list if anyone ever needs to scroll past 200.
 */
export const DEPENDENCY_MAX_NEIGHBORS = 200;

function walkThreads(threads: SwimThread[], visit: (thread: SwimThread) => void): void {
  for (const thread of threads) {
    visit(thread);
    if (thread.children?.length) walkThreads(thread.children, visit);
  }
}

/** tid → thread. Walks lanes, not events, so it is cheap enough to build per call. */
function threadsById(model: SwimlaneModel | null | undefined): Map<string, SwimThread> {
  const map = new Map<string, SwimThread>();
  for (const process of model?.processes ?? []) {
    walkThreads(process.threads, (thread) => map.set(thread.id, thread));
  }
  return map;
}

export function hasDependencies(model: SwimlaneModel | null | undefined): boolean {
  for (const process of model?.processes ?? []) {
    let found = false;
    walkThreads(process.threads, (thread) => {
      if (found) return;
      found = thread.events.some(
        (ev) =>
          (ev.dependencies?.successors.length ?? 0) > 0 ||
          (ev.dependencies?.predecessors.length ?? 0) > 0,
      );
    });
    if (found) return true;
  }
  return false;
}

function collect(
  threads: Map<string, SwimThread>,
  start: SwimEvent,
  dir: 'predecessors' | 'successors',
  depth: number,
): DependencyNode[] {
  const resolve = (ref: EventRef): SwimEvent | undefined =>
    threads.get(ref.tid)?.events[ref.index];

  const seen = new Set<string>([start.id]);
  const out: DependencyNode[] = [];
  let frontier: SwimEvent[] = [start];
  const unlimited = depth < 0;

  for (let hop = 0; frontier.length > 0 && out.length < DEPENDENCY_MAX_NEIGHBORS; hop++) {
    if (!unlimited && hop >= depth) break;
    const next: SwimEvent[] = [];
    for (const ev of frontier) {
      for (const ref of ev.dependencies?.[dir] ?? []) {
        const target = resolve(ref);
        // Refs into a collapsed or missing lane would render as a chip with no timing.
        if (!target || seen.has(target.id)) continue;
        seen.add(target.id);
        out.push({ id: target.id, name: target.name, startTime: target.startTime });
        next.push(target);
      }
    }
    frontier = next;
  }

  // Sort first, then cut: a hop that fans out past the cap still yields the earliest
  // neighbours rather than whatever order the producer wrote its refs in.
  // ponytail: sorts the whole BFS result to keep DEPENDENCY_MAX_NEIGHBORS. Fine for the
  // handful of refs per event producers ship; swap in a size-capped max-heap if one
  // ever ships wide fan-outs.
  return out
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id))
    .slice(0, DEPENDENCY_MAX_NEIGHBORS);
}

/**
 * Neighbours of `event` up to `depth` hops, at most `DEPENDENCY_MAX_NEIGHBORS` per side.
 * `depth < 0` walks the whole chain and `depth === 0` returns nothing — master's
 * `normalizeDependencyDepth` semantics, shared with the swimlane curves.
 *
 * `mode` blanks the suppressed side rather than dropping it, so DetailRelevant's
 * five-column grid keeps its shape and only loses chips.
 */
export function neighborsOf(
  model: SwimlaneModel | null | undefined,
  event: SwimEvent,
  mode: DependencyMode,
  depth: number,
): DependencyNeighbors {
  const hops = normalizeDependencyDepth(depth);
  const threads = threadsById(model);
  return {
    incoming: mode === 'successors' ? [] : collect(threads, event, 'predecessors', hops),
    outgoing: mode === 'predecessors' ? [] : collect(threads, event, 'successors', hops),
  };
}
