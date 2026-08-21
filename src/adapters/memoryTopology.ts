import type { CsvTableModel, MemoryTopologyModel } from '../domain/types';

const NODES: MemoryTopologyModel['nodes'] = [
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

type Unit = 'GB/s' | 'KB' | '%';

/** VIEW_DATA_MAPPING §11.2.6 — first present non-NA candidate wins. */
const EDGE_MAP: {
  id: string;
  from: string;
  to: string;
  unit: Unit;
  sources: { file: string; columns: string[] }[];
}[] = [
  {
    id: 'gm-l2-read',
    from: 'l2',
    to: 'gm',
    unit: 'GB/s',
    sources: [
      { file: 'Memory.csv', columns: ['aic_main_mem_read_bw(GB/s)', 'aiv_main_mem_read_bw(GB/s)'] },
    ],
  },
  {
    id: 'gm-l2-write',
    from: 'gm',
    to: 'l2',
    unit: 'GB/s',
    sources: [
      { file: 'Memory.csv', columns: ['aic_main_mem_write_bw(GB/s)', 'aiv_main_mem_write_bw(GB/s)'] },
    ],
  },
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
    sources: [
      { file: 'MemoryUB.csv', columns: ['aiv_ub_read_bw_gm(GB/s)'] },
      { file: 'Memory.csv', columns: ['aiv_ub_to_gm_bw(GB/s)'] },
    ],
  },
  {
    id: 'l2-ub',
    from: 'l2',
    to: 'ub',
    unit: 'GB/s',
    sources: [
      { file: 'MemoryUB.csv', columns: ['aiv_ub_write_bw_gm(GB/s)'] },
      { file: 'Memory.csv', columns: ['aiv_gm_to_ub_bw(GB/s)'] },
    ],
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
    sources: [
      {
        file: 'L2Cache.csv',
        columns: ['aic_total_hit_rate(%)', 'aiv_total_hit_rate(%)', 'aic_read_hit_rate(%)', 'aiv_read_hit_rate(%)'],
      },
    ],
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
 * Block-scoped memory topology from Memory* CSV tables (§11.2.6).
 * Product: hide `NA`; show 0. Omit the whole diagram when no edge has a label.
 */
export function buildMemoryTopology(
  tables: CsvTableModel[],
  blockId: string,
): MemoryTopologyModel | undefined {
  const byFile = new Map(tables.map((t) => [t.fileName, t]));
  const edges: MemoryTopologyModel['edges'] = [];

  for (const spec of EDGE_MAP) {
    let value: number | undefined;
    for (const src of spec.sources) {
      const row = rowForBlock(byFile.get(src.file), blockId);
      if (!row) continue;
      for (const col of src.columns) {
        value = parseNumber(row[col]);
        if (value != null) break;
      }
      if (value != null) break;
    }
    edges.push({
      id: spec.id,
      from: spec.from,
      to: spec.to,
      ...(value != null ? { label: formatLabel(value, spec.unit) } : {}),
    });
  }

  if (!edges.some((e) => e.label != null)) return undefined;
  return { nodes: NODES, edges };
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
