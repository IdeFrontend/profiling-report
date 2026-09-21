import type {
  CsvTableModel,
  MemoryTopologyModel,
  MemoryTopologyPlateNodeId,
  SummaryCategory,
} from '../domain/types';

/** Shared node scaffold for compute Memory* and emulate ArchDiagramMetrics mappers. */
export const MEMORY_TOPOLOGY_NODE_DEFS: Omit<MemoryTopologyModel['nodes'][number], 'peakPct'>[] = [
  { id: 'gm', label: 'GM' },
  { id: 'l2', label: 'L2 Cache' },
  { id: 'xn_imm', label: 'XN_IMM' },
  { id: 'data_cache', label: 'Data Cache' },
  // UI-38: the chrome draws MTE1/2/3 blocks on the L2↔unit paths, but the export gives them no
  // value plate, so the panel has no slot to paint (PR-VM-017). They still belong to the model:
  // their utilizations live in PipeUtilization.csv and surface through the memory 详情 CSV field list.
  { id: 'mte1', label: 'MTE1' },
  { id: 'mte2', label: 'MTE2' },
  { id: 'mte3', label: 'MTE3' },
  { id: 'l1', label: 'L1' },
  { id: 'l0a', label: 'L0A' },
  { id: 'l0b', label: 'L0B' },
  { id: 'l0c', label: 'L0C' },
  { id: 'cube', label: 'Cube' },
  { id: 'fixp', label: 'FixP' },
  { id: 'aic_scalar', label: 'Scalar' },
  { id: 'ub', label: 'UB' },
  { id: 'vec', label: 'Vec' },
  { id: 'simt', label: 'SIMT' },
  { id: 'simd', label: 'SIMD' },
  { id: 'aiv_scalar', label: 'Scalar' },
];

/** DATA-21 interim column order for L2 hit rate (= L2 Peak%, DATA-20). */
const L2_HIT_RATE_COLUMNS = [
  'aic_total_hit_rate(%)',
  'aiv_total_hit_rate(%)',
  'aic_read_hit_rate(%)',
  'aiv_read_hit_rate(%)',
] as const;

type Unit = 'GB/s' | 'KB' | '%';

/** VIEW_DATA_MAPPING §11.2.6 — first present non-NA candidate wins, unless `aggregate` says otherwise.
 *  Bare `*_read_bw` = leaving the named resource; `*_write_bw` = arriving there.
 *  Counterparty-suffix columns (`_bw_gm` / `_vector` / `_cube`) already name the other end. */
const EDGE_MAP: {
  id: string;
  from: string;
  to: string;
  unit: Unit;
  sources: { file: string; columns: string[]; aggregate?: 'sum' }[];
}[] = [
  {
    // DATA-40: the plate is the producer's "Main Read" — the aic + aiv sides **summed**, the same
    // quantity the 带宽利用率 读 card shows (DATA-8). First-present would print one side alone.
    id: 'gm-l2-read',
    from: 'gm',
    to: 'l2',
    unit: 'GB/s',
    sources: [
      {
        file: 'Memory.csv',
        columns: ['aic_main_mem_read_bw(GB/s)', 'aiv_main_mem_read_bw(GB/s)'],
        aggregate: 'sum',
      },
    ],
  },
  {
    // DATA-40: "Main Write", likewise summed (the producer's row 32 lists the AIC read column by
    // slip; the card's `aicore_gm_write_bw` side is the AIC **write** column).
    id: 'gm-l2-write',
    from: 'l2',
    to: 'gm',
    unit: 'GB/s',
    sources: [
      {
        file: 'Memory.csv',
        columns: ['aic_main_mem_write_bw(GB/s)', 'aiv_main_mem_write_bw(GB/s)'],
        aggregate: 'sum',
      },
    ],
  },
  // ponytail: L1/L0 stay at master from/to. out.rep is NA; L0A/L0B are L1→buffer→Cube, so the GM leaving-resource flip does not apply. Verify on an AIC-populated .rep.
  {
    // DATA-43 (row 24): the producer assigns this plate — the AIC row's corridor slot, drawn
    // `L2 → MTE2 → L1 (AIC)` — the `GM -> UB` field `aiv_gm_to_ub_bw`, the same field the two AIV
    // `l2-ub` plates carry (DATA-23). Product ruling 2026-09-15: use the producer's field and
    // paint it on the chrome's own slot ("display it according to svg spec"). `aic_l1_read_bw` is
    // therefore read by no plate; it stays visible in the Memory.csv 详情 field list.
    id: 'l2-l1-read',
    from: 'l2',
    to: 'l1',
    unit: 'GB/s',
    sources: [{ file: 'Memory.csv', columns: ['aiv_gm_to_ub_bw(GB/s)'] }],
  },
  {
    // Drawn blank on the chrome until UI-48: the export routes this corridor onto FixP.
    id: 'l2-l1-write',
    from: 'l1',
    to: 'l2',
    unit: 'GB/s',
    sources: [{ file: 'Memory.csv', columns: ['aic_l1_write_bw(GB/s)'] }],
  },
  {
    id: 'l1-l0a',
    from: 'l1',
    to: 'l0a',
    unit: 'GB/s',
    sources: [{ file: 'MemoryL0.csv', columns: ['aic_l0a_read_bw(GB/s)'] }],
  },
  {
    id: 'l1-l0b',
    from: 'l1',
    to: 'l0b',
    unit: 'GB/s',
    sources: [{ file: 'MemoryL0.csv', columns: ['aic_l0b_read_bw(GB/s)'] }],
  },
  {
    id: 'l0a-cube',
    from: 'l0a',
    to: 'cube',
    unit: 'GB/s',
    sources: [{ file: 'MemoryL0.csv', columns: ['aic_l0a_write_bw(GB/s)'] }],
  },
  {
    id: 'l0b-cube',
    from: 'l0b',
    to: 'cube',
    unit: 'GB/s',
    sources: [{ file: 'MemoryL0.csv', columns: ['aic_l0b_write_bw(GB/s)'] }],
  },
  {
    id: 'l0c-cube',
    from: 'l0c',
    to: 'cube',
    unit: 'GB/s',
    sources: [{ file: 'MemoryL0.csv', columns: ['aic_l0c_read_bw_cube(GB/s)'] }],
  },
  {
    id: 'cube-l0c',
    from: 'cube',
    to: 'l0c',
    unit: 'GB/s',
    sources: [{ file: 'MemoryL0.csv', columns: ['aic_l0c_write_bw_cube(GB/s)'] }],
  },
  {
    id: 'l0c-l1',
    from: 'l0c',
    to: 'l1',
    unit: 'KB',
    sources: [{ file: 'Memory.csv', columns: ['L0C_to_L1_datas(KB)'] }],
  },
  {
    id: 'l0c-l2',
    from: 'l0c',
    to: 'l2',
    unit: 'KB',
    sources: [{ file: 'Memory.csv', columns: ['L0C_to_GM_datas(KB)'] }],
  },
  {
    id: 'ub-l2',
    from: 'ub',
    to: 'l2',
    unit: 'GB/s',
    // DATA-22: Memory.csv `aiv_ub_to_gm_bw` is the collected field; MemoryUB `*_gm` is not collected.
    sources: [{ file: 'Memory.csv', columns: ['aiv_ub_to_gm_bw(GB/s)'] }],
  },
  {
    id: 'l2-ub',
    from: 'l2',
    to: 'ub',
    unit: 'GB/s',
    // DATA-23: Memory.csv `aiv_gm_to_ub_bw` is the collected field; MemoryUB `*_gm` is not collected.
    sources: [{ file: 'Memory.csv', columns: ['aiv_gm_to_ub_bw(GB/s)'] }],
  },
  {
    id: 'vec-ub',
    from: 'vec',
    to: 'ub',
    unit: 'GB/s',
    // ub_read_* = leaving UB (same as ub-l2). out.rep add_custom is 2:1 in:out.
    sources: [{ file: 'MemoryUB.csv', columns: ['aiv_ub_write_bw_vector(GB/s)'] }],
  },
  {
    id: 'ub-vec',
    from: 'ub',
    to: 'vec',
    unit: 'GB/s',
    sources: [{ file: 'MemoryUB.csv', columns: ['aiv_ub_read_bw_vector(GB/s)'] }],
  },
  {
    id: 'l2-hit',
    from: 'l2',
    to: 'l2',
    unit: '%',
    sources: [{ file: 'L2Cache.csv', columns: [...L2_HIT_RATE_COLUMNS] }],
  },
];

/**
 * Edges the official chrome gives a value plate — the panel's `SLOTS` keys
 * ([panel spec](../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md) § Value slots).
 * `l2-hit` is plated too, but in the L2 pillar's in-box `%` plate rather than a link slot,
 * so it rides separately. `l0c-l1` / `l0c-l2` (KB) and `l2-l1-write` (UI-48) have **no** plate:
 * they stay in the 详情 tabs (PR-MEMTOP-009). The panel types its `SLOTS` against this tuple, so a
 * plated edge without coordinates fails typecheck instead of silently drawing nothing.
 */
export const TOPOLOGY_SLOT_EDGE_IDS = [
  'gm-l2-read',
  'gm-l2-write',
  'l2-ub',
  'ub-l2',
  'l2-l1-read',
  'ub-vec',
  'vec-ub',
  'l1-l0a',
  'l1-l0b',
  'l0a-cube',
  'l0b-cube',
  'cube-l0c',
  'l0c-cube',
] as const;

export type TopologySlotEdgeId = (typeof TOPOLOGY_SLOT_EDGE_IDS)[number];

/** DATA-20 L2 Peak(%): plate on the L2 pillar, not a link slot (`unit: '%'`). */
export const TOPOLOGY_PEAK_PLATE_EDGE_ID = 'l2-hit';

/**
 * UI-49 / DATA-39: units whose **in-box** badge is a pipe-utilization ratio, not a peak percent.
 * The panel types its `PLATE_SLOTS` against this tuple, so a newly plated unit without
 * coordinates fails typecheck instead of silently drawing nothing (same rule as the link slots).
 * AIV0/AIV1 share one field and one plate entry — the panel paints it in both AIV rows.
 * `satisfies` keeps the tuple in step with the domain union: a unit that is not a
 * `MemoryTopologyPlateNodeId` cannot be listed here.
 */
export const TOPOLOGY_PLATE_NODE_IDS = ['aiv_scalar', 'vec', 'cube'] as const satisfies readonly MemoryTopologyPlateNodeId[];

export type TopologyPlateNodeId = (typeof TOPOLOGY_PLATE_NODE_IDS)[number];

/**
 * UI-49 in-box `%` badges (DATA-39 rows 1/2, 6'/7', 8). `aiv_scalar_ratio` / `aiv_vec_ratio` /
 * `aic_cube_ratio` are **fractions** of the unit's own busy time (DATA-28) — the same ratio the
 * 计算负载分析 pipe rows show — and print as `{ratio × 100}%` at the sketch's **two decimals**
 * (`57.90%`, where the pipe row rounds to `58%`). The producer's six `NA` in-box
 * rows (AIC `Scalar`, AIV0/AIV1 `SIMT VF`, AIV0/AIV1 `SIMD VF`, `FixP`) cover only **four** badge
 * positions: the `SIMD VF` rows describe the `Vec` position, which the `Vec` rows (`6'`/`7'`) fill,
 * so it is painted, and those four positions stay blank.
 */
const PLATE_MAP: { node: TopologyPlateNodeId; file: string; columns: string[] }[] = [
  { node: 'aiv_scalar', file: 'PipeUtilization.csv', columns: ['aiv_scalar_ratio'] },
  { node: 'vec', file: 'PipeUtilization.csv', columns: ['aiv_vec_ratio'] },
  { node: 'cube', file: 'PipeUtilization.csv', columns: ['aic_cube_ratio'] },
];

/**
 * True when the chrome can paint something: a plated link value, the L2 plate (`peakPct` or a
 * `l2-hit` label), or both. A model whose only labels are slotless (`l0c-l1` / `l0c-l2` /
 * `l2-l1-write`) is not drawable — mounting the chrome with every overlay blank is worse than
 * hiding it (PR-MEMTOP-009 / PR-MEMTOP-012). Shared by the panel's `show` gate and the default
 * block pick below, so both agree on what "the diagram exists" means.
 */
export function hasDrawableTopology(model: MemoryTopologyModel | null | undefined): boolean {
  if (!model || model.nodes.length === 0) return false;
  if (model.nodes.some((n) => n.id === 'l2' && n.peakPct != null)) return true;
  return model.edges.some(
    (e) =>
      e.label != null &&
      e.label !== '' &&
      ((TOPOLOGY_SLOT_EDGE_IDS as readonly string[]).includes(e.id) ||
        e.id === TOPOLOGY_PEAK_PLATE_EDGE_ID),
  );
}

function parseNumber(raw: string | undefined): number | undefined {
  if (raw == null || raw === '' || raw === 'NA') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function rowForBlock(table: CsvTableModel | undefined, blockId: string): Record<string, string> | undefined {
  if (!table) return undefined;
  return table.rows.find((r) => r['block_id'] === blockId);
}

function formatLabel(n: number, unit: Unit): string {
  if (unit === '%') return `${n.toFixed(2)}%`;
  return `${n.toFixed(2)} ${unit}`;
}

/**
 * Where an edge value comes from, resolved per selector scope (DATA-19 / DATA-29):
 * `All` reads `summary.jsonl` category fields, a picked id reads that block's CSV row.
 */
export type MemoryValueSource = (
  file: string,
  columns: readonly string[],
) => number | undefined;

function topologyFromSource(read: MemoryValueSource): MemoryTopologyModel | undefined {
  const edges: MemoryTopologyModel['edges'] = [];
  const edgeValues = new Map<string, number>();

  for (const spec of EDGE_MAP) {
    let value: number | undefined;
    for (const src of spec.sources) {
      const present = src.columns
        .map((column) => read(src.file, [column]))
        .filter((v): v is number => v != null);
      if (present.length === 0) continue;
      value = src.aggregate === 'sum' ? present.reduce((a, b) => a + b, 0) : present[0];
      break;
    }
    if (value != null) edgeValues.set(spec.id, value);
    edges.push({
      id: spec.id,
      from: spec.from,
      to: spec.to,
      ...(value != null ? { label: formatLabel(value, spec.unit) } : {}),
    });
  }

  if (!edges.some((e) => e.label != null)) return undefined;

  // DATA-20: L2 Peak(%) = same hit-rate value as the `l2-hit` edge (DATA-21 interim order).
  const peakPct = edgeValues.get('l2-hit');
  const nodes = MEMORY_TOPOLOGY_NODE_DEFS.map((n) =>
    n.id === 'l2' && peakPct != null ? { ...n, peakPct } : { ...n },
  );

  // UI-49: in-box unit-utilization badges. The ratio is a fraction of the unit's own busy time.
  const plates = PLATE_MAP.flatMap((p) => {
    const ratio = read(p.file, p.columns);
    return ratio == null ? [] : [{ node: p.node, label: formatLabel(ratio * 100, '%') }];
  });

  return { nodes, edges, ...(plates.length > 0 ? { plates } : {}) };
}

/**
 * Block-scoped memory topology from Memory* CSV tables (§11.2.6).
 * Product: hide `NA`; show 0. Omit the whole diagram when no edge has a label.
 */
export function buildMemoryTopology(
  tables: CsvTableModel[],
  blockId: string,
): MemoryTopologyModel | undefined {
  const byFile = new Map(tables.map((t) => [t.fileName, t]));
  return topologyFromSource((file, columns) => {
    const row = rowForBlock(byFile.get(file), blockId);
    if (!row) return undefined;
    for (const col of columns) {
      const v = parseNumber(row[col]);
      if (v != null) return v;
    }
    return undefined;
  });
}

/**
 * `All` memory topology (DATA-19 / DATA-29): values come from the `summary.jsonl` category
 * records — the producer's non-`NA` mean across `block_id` — not from one block's row.
 */
export function buildMemoryTopologyFromCategories(
  categories: SummaryCategory[],
): MemoryTopologyModel | undefined {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return topologyFromSource((file, columns) => {
    const category = byId.get(FILE_CATEGORY[file] ?? file);
    if (!category) return undefined;
    const field = new Map(category.fields.map((f) => [f.key, f.value]));
    for (const col of columns) {
      const v = parseNumber(field.get(col));
      if (v != null) return v;
    }
    return undefined;
  });
}

/** Each Memory* CSV is the raw form of one `summary.jsonl` category. */
const FILE_CATEGORY: Record<string, string> = {
  'Memory.csv': 'Memory',
  'MemoryL0.csv': 'MemoryL0',
  'MemoryUB.csv': 'MemoryUB',
  'L2Cache.csv': 'L2Cache',
  // UI-49: the in-box unit-utilization badges (Scalar / Vec / Cube) live in PipeUtilization.
  'PipeUtilization.csv': 'PipeUtilization',
};

/** Distinct `block_id` values across the given tables, in fixture order (no duplicates). */
export function blockIdsInOrder(tables: CsvTableModel[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const table of tables) {
    for (const id of table.blockIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/**
 * First block whose model the chrome can paint (`hasDrawableTopology`, not merely "has a label"),
 * so the default pick always yields a diagram; otherwise undefined (PR-VM-018).
 */
export function firstLabelledMemoryTopology(
  tables: CsvTableModel[],
): { blockId: string; model: MemoryTopologyModel } | undefined {
  for (const blockId of blockIdsInOrder(tables)) {
    const model = buildMemoryTopology(tables, blockId);
    if (model && hasDrawableTopology(model)) return { blockId, model };
  }
  return undefined;
}
