import type { CsvTableModel, MemoryTopologyModel, SummaryCategory } from '../domain/types';

const NODE_DEFS: Omit<MemoryTopologyModel['nodes'][number], 'peakPct'>[] = [
  { id: 'gm', label: 'GM' },
  { id: 'l2', label: 'L2 Cache' },
  { id: 'xn_imm', label: 'XN_IMM' },
  { id: 'data_cache', label: 'Data Cache' },
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

/** VIEW_DATA_MAPPING §11.2.6 — first present non-NA candidate wins.
 *  Bare `*_read_bw` = leaving the named resource; `*_write_bw` = arriving there.
 *  Counterparty-suffix columns (`_bw_gm` / `_vector` / `_cube`) already name the other end. */
const EDGE_MAP: {
  id: string;
  from: string;
  to: string;
  unit: Unit;
  sources: { file: string; columns: string[] }[];
}[] = [
  {
    id: 'gm-l2-read',
    from: 'gm',
    to: 'l2',
    unit: 'GB/s',
    sources: [
      { file: 'Memory.csv', columns: ['aic_main_mem_read_bw(GB/s)', 'aiv_main_mem_read_bw(GB/s)'] },
    ],
  },
  {
    id: 'gm-l2-write',
    from: 'l2',
    to: 'gm',
    unit: 'GB/s',
    sources: [
      { file: 'Memory.csv', columns: ['aic_main_mem_write_bw(GB/s)', 'aiv_main_mem_write_bw(GB/s)'] },
    ],
  },
  // ponytail: L1/L0 stay at master from/to. out.rep is NA; L0A/L0B are L1→buffer→Cube, so the GM leaving-resource flip does not apply. Verify on an AIC-populated .rep.
  {
    id: 'l2-l1-read',
    from: 'l2',
    to: 'l1',
    unit: 'GB/s',
    sources: [{ file: 'Memory.csv', columns: ['aic_l1_read_bw(GB/s)'] }],
  },
  {
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
      value = read(src.file, src.columns);
      if (value != null) break;
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
  const nodes = NODE_DEFS.map((n) =>
    n.id === 'l2' && peakPct != null ? { ...n, peakPct } : { ...n },
  );

  return { nodes, edges };
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

/** Each Memory* CSV is the raw form of one `summary.jsonl` category. */
const FILE_CATEGORY: Record<string, string> = {
  'Memory.csv': 'Memory',
  'MemoryL0.csv': 'MemoryL0',
  'MemoryUB.csv': 'MemoryUB',
  'L2Cache.csv': 'L2Cache',
};

/**
 * `All` memory topology (DATA-19 / DATA-29): values come from the `summary.jsonl`
 * category records — the producer's non-`NA` mean across `block_id` — not from one block's row.
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

function blockIdsInOrder(tables: CsvTableModel[]): string[] {
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

/** First block that yields at least one labelled edge; otherwise undefined. */
export function firstLabelledMemoryTopology(
  tables: CsvTableModel[],
): { blockId: string; model: MemoryTopologyModel } | undefined {
  for (const blockId of blockIdsInOrder(tables)) {
    const model = buildMemoryTopology(tables, blockId);
    if (model) return { blockId, model };
  }
  return undefined;
}
