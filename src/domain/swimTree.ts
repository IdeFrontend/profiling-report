import type { SwimEvent, SwimlaneModel, SwimProcess, SwimThread } from './types';

/**
 * Folder = `children` property present (may be [] when collapsed).
 * Leaf = `children` omitted.
 */
export function isFolderNode(node: SwimThread): boolean {
  return node.children !== undefined;
}

/** Flat CTEF name `Core0.Cube/SCALAR` → Core0.Cube + SCALAR (not `AIV0/PIPE_V/status`). */
const CORE_PIPE_LEAF = /^(.+\.[^/]+)\/([^/]+)$/;

function meanUtilization(nodes: SwimThread[]): number | undefined {
  const vals = nodes.map((n) => n.utilization).filter((u): u is number => u != null);
  if (vals.length === 0) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Nest flat `CoreN.Cube|Vector/PIPE` lanes into Card → 通信|计算|储存HBM → Core → pipe
 * (design mockup / stress shape). Preserves leaf thread ids for dependency EventRefs.
 * No-op when no matching names (real AIV pipe-state traces stay flat).
 */
export function nestCardTreeFromFlatCorePipes(model: SwimlaneModel): SwimlaneModel {
  let any = false;
  const processes: SwimProcess[] = model.processes.map((proc) => {
    const byCore = new Map<string, SwimThread[]>();
    const unmatched: SwimThread[] = [];
    for (const t of proc.threads) {
      const m = CORE_PIPE_LEAF.exec(t.name);
      if (!m) {
        unmatched.push(t);
        continue;
      }
      any = true;
      const core = m[1]!;
      const pipe = m[2]!;
      const list = byCore.get(core) ?? [];
      list.push({ ...t, name: pipe });
      byCore.set(core, list);
    }
    if (byCore.size === 0) return proc;

    const coreFolders: SwimThread[] = [...byCore.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([coreName, leaves]) => ({
        id: `${proc.id}/${coreName}`,
        name: coreName,
        events: [] as SwimEvent[],
        utilization: meanUtilization(leaves),
        children: leaves,
      }));

    const compute: SwimThread = {
      id: `${proc.id}/compute`,
      name: '计算',
      events: [],
      utilization: meanUtilization(coreFolders) ?? 1,
      children: [...coreFolders, ...unmatched],
    };
    return {
      ...proc,
      threads: [
        { id: `${proc.id}/comm`, name: '通信', events: [], utilization: 1 },
        compute,
        { id: `${proc.id}/hbm`, name: '储存HBM', events: [], utilization: 0.46 },
      ],
    };
  });

  if (!any) return model;

  const collapsed: string[] = [];
  for (const p of processes) {
    const compute = p.threads.find((t) => t.name === '计算' && isFolderNode(t));
    if (!compute?.children) continue;
    for (const core of compute.children) {
      if (core.name !== 'Core0.Cube' && isFolderNode(core)) collapsed.push(core.id);
    }
  }

  return {
    ...model,
    processes,
    metadata: {
      ...model.metadata,
      defaultCollapsedIds: collapsed,
    },
  };
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
