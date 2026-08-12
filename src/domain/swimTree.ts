import type { SwimEvent, SwimlaneModel, SwimProcess, SwimThread } from './types';

/**
 * Folder = `children` property present (may be [] when collapsed).
 * Leaf = `children` omitted.
 */
export function isFolderNode(node: SwimThread): boolean {
  return node.children !== undefined;
}

/** Depth-first collect events from leaf nodes only. */
export function collectLeafEvents(threads: SwimThread[]): SwimEvent[] {
  const out: SwimEvent[] = [];
  const walk = (nodes: SwimThread[]) => {
    for (const n of nodes) {
      if (isFolderNode(n)) walk(n.children ?? []);
      else out.push(...n.events);
    }
  };
  walk(threads);
  return out;
}

export function collectLeafEventsFromModel(model: SwimlaneModel): SwimEvent[] {
  return model.processes.flatMap((p) => collectLeafEvents(p.threads));
}

/** Count event leaves (folders excluded). */
export function countLeafThreads(threads: SwimThread[]): number {
  let n = 0;
  const walk = (nodes: SwimThread[]) => {
    for (const node of nodes) {
      if (isFolderNode(node)) walk(node.children ?? []);
      else n += 1;
    }
  };
  walk(threads);
  return n;
}

/**
 * Drop descendants of collapsed ids.
 * - Collapsed Card: threads → [].
 * - Collapsed folder: keep folder row (`children: []`); leaf vs folder via property presence.
 */
export function filterCollapsedTree(
  model: SwimlaneModel,
  collapsedIds: readonly string[],
): SwimlaneModel {
  if (collapsedIds.length === 0) return model;
  const collapsed = new Set(collapsedIds);

  const filterThreads = (nodes: SwimThread[]): SwimThread[] =>
    nodes.map((n) => {
      if (!isFolderNode(n)) return n;
      if (collapsed.has(n.id)) {
        return { ...n, children: [], events: [] };
      }
      return { ...n, children: filterThreads(n.children ?? []) };
    });

  return {
    ...model,
    processes: model.processes.map((p) => {
      if (collapsed.has(p.id)) return { ...p, threads: [] };
      return { ...p, threads: filterThreads(p.threads) };
    }),
  };
}

export type VisibleSwimRow =
  | { kind: 'header'; process: SwimProcess }
  | { kind: 'folder'; thread: SwimThread; depth: number }
  | { kind: 'leaf'; thread: SwimThread; depth: number };

/** Visible rows for gutter/layout (pass already-filtered model, or raw with no collapse). */
export function walkVisibleRows(model: SwimlaneModel): VisibleSwimRow[] {
  const rows: VisibleSwimRow[] = [];
  const walk = (nodes: SwimThread[], depth: number) => {
    for (const n of nodes) {
      if (isFolderNode(n)) {
        rows.push({ kind: 'folder', thread: n, depth });
        walk(n.children ?? [], depth + 1);
      } else {
        rows.push({ kind: 'leaf', thread: n, depth });
      }
    }
  };
  for (const p of model.processes) {
    rows.push({ kind: 'header', process: p });
    walk(p.threads, 0);
  }
  return rows;
}
