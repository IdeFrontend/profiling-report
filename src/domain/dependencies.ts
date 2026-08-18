/**
 * Interim Q9 dependency model — see docs/context/INTERIM_DECISIONS.md (I-Q9).
 *
 * `SwimEvent.dependencies` holds **successor** ids; predecessors come from the
 * reverse index built here. Producers that ship no dependency data yield an
 * empty graph, and every dependency surface hides itself
 * (VIEW_DATA_REQUIREMENTS hide-when-missing policy).
 */
import type { SwimlaneModel, SwimThread } from './types';

/** Sketch toolbar (v930/task-click-detail): forward-only / both / backward-only. */
export type DependencyDirection = 'forward' | 'both' | 'backward';

export interface DependencyNode {
  id: string;
  name: string;
  startTime: number;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  /** successor ids by event id (the encoded direction) */
  outgoing: Map<string, string[]>;
  /** predecessor ids by event id (reverse index) */
  incoming: Map<string, string[]>;
}

export interface DependencyNeighbors {
  incoming: DependencyNode[];
  outgoing: DependencyNode[];
}

/** Sketch default for `Task Connection Level`: negative means "no depth limit". */
export const DEPENDENCY_LEVEL_UNLIMITED = -1;

/**
 * Per-side cap on a walk. The default level is "no depth limit", so a chained model
 * hands the panel its whole transitive closure — one chip and one SVG connector each,
 * which is where the time goes (20k neighbours ≈ 1.8 s to mount).
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

export function buildDependencyGraph(model: SwimlaneModel | null | undefined): DependencyGraph {
  const nodes = new Map<string, DependencyNode>();
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const process of model?.processes ?? []) {
    walkThreads(process.threads, (thread) => {
      for (const ev of thread.events) {
        nodes.set(ev.id, { id: ev.id, name: ev.name, startTime: ev.startTime });
      }
    });
  }

  for (const process of model?.processes ?? []) {
    walkThreads(process.threads, (thread) => {
      for (const ev of thread.events) {
        for (const target of ev.dependencies ?? []) {
          // Ignore edges to events the model does not contain — a dangling id would
          // otherwise render as a chip with no timing.
          if (target === ev.id || !nodes.has(target)) continue;
          const succ = outgoing.get(ev.id);
          if (succ) {
            // ponytail: linear scan — successor lists are a handful of ids per event in
            // the sketch. Swap for a per-source Set if a producer ever ships fan-outs.
            if (succ.includes(target)) continue;
            succ.push(target);
          } else {
            outgoing.set(ev.id, [target]);
          }
          const pred = incoming.get(target);
          if (pred) pred.push(ev.id);
          else incoming.set(target, [ev.id]);
        }
      }
    });
  }

  return { nodes, outgoing, incoming };
}

export function hasDependencies(model: SwimlaneModel | null | undefined): boolean {
  for (const process of model?.processes ?? []) {
    let found = false;
    walkThreads(process.threads, (thread) => {
      if (found) return;
      found = thread.events.some((ev) => (ev.dependencies?.length ?? 0) > 0);
    });
    if (found) return true;
  }
  return false;
}

function collect(
  graph: DependencyGraph,
  startId: string,
  edges: Map<string, string[]>,
  level: number,
): DependencyNode[] {
  const seen = new Set<string>([startId]);
  const out: DependencyNode[] = [];
  let frontier = [startId];
  let depth = 0;

  while (
    frontier.length > 0 &&
    out.length < DEPENDENCY_MAX_NEIGHBORS &&
    (level < 0 || depth < level)
  ) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of edges.get(id) ?? []) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        const node = graph.nodes.get(neighbor);
        if (node) out.push(node);
        next.push(neighbor);
      }
    }
    frontier = next;
    depth += 1;
  }

  // Sort first, then cut: a hop that fans out past the cap still yields the earliest
  // neighbours rather than whatever order the producer wrote its ids in.
  return out
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id))
    .slice(0, DEPENDENCY_MAX_NEIGHBORS);
}

/**
 * Neighbours of `eventId` up to `level` hops, at most `DEPENDENCY_MAX_NEIGHBORS` per
 * side. `level < 0` walks the whole chain and `level === 0` returns nothing. Both sides
 * always come back: the sketch's three direction icons live in DetailRelevant, which
 * blanks the suppressed column itself.
 */
export function neighborsOf(
  graph: DependencyGraph,
  eventId: string,
  level: number = DEPENDENCY_LEVEL_UNLIMITED,
): DependencyNeighbors {
  return {
    incoming: collect(graph, eventId, graph.incoming, level),
    outgoing: collect(graph, eventId, graph.outgoing, level),
  };
}
