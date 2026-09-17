/**
 * Emulate ArchDiagramMetrics.csv → MemoryTopologyModel (DATA-48a).
 * @see docs/context/decisions/interim/DATA.md DATA-48a
 */
import type { MemoryTopologyModel } from '../domain/types';
import {
  hasDrawableTopology,
  MEMORY_TOPOLOGY_NODE_DEFS,
} from './memoryTopology';

type EdgeSpec = {
  id: string;
  from: string;
  to: string;
  /** One parameter, or aiv0+aiv1 pair (averaged when both present). */
  params: string[];
};

/** Plated GB/s edges + parameter names (DATA-48a). */
const ARCH_EDGE_MAP: EdgeSpec[] = [
  { id: 'gm-l2-read', from: 'gm', to: 'l2', params: ['hbm_to_l2_syn_gbs'] },
  { id: 'gm-l2-write', from: 'l2', to: 'gm', params: ['l2_to_hbm_syn_gbs'] },
  { id: 'l2-l1-read', from: 'l2', to: 'l1', params: ['aic_out_to_l1_gbs'] },
  { id: 'l1-l0a', from: 'l1', to: 'l0a', params: ['aic_l1_to_l0a_gbs'] },
  { id: 'l1-l0b', from: 'l1', to: 'l0b', params: ['aic_l1_to_l0b_gbs'] },
  { id: 'l0a-cube', from: 'l0a', to: 'cube', params: ['aic_l0a_to_cube_gbs'] },
  { id: 'l0b-cube', from: 'l0b', to: 'cube', params: ['aic_l0b_to_cube_gbs'] },
  { id: 'cube-l0c', from: 'cube', to: 'l0c', params: ['aic_cube_to_l0c_gbs'] },
  { id: 'l0c-cube', from: 'l0c', to: 'cube', params: ['aic_l0c_to_cube_gbs'] },
  {
    id: 'l2-ub',
    from: 'l2',
    to: 'ub',
    params: ['aiv0_out_to_ub_gbs', 'aiv1_out_to_ub_gbs'],
  },
  {
    id: 'ub-l2',
    from: 'ub',
    to: 'l2',
    params: ['aiv0_ub_to_out_gbs', 'aiv1_ub_to_out_gbs'],
  },
  {
    id: 'ub-vec',
    from: 'ub',
    to: 'vec',
    params: ['aiv0_ub_to_simd_gbs', 'aiv1_ub_to_simd_gbs'],
  },
  {
    id: 'vec-ub',
    from: 'vec',
    to: 'ub',
    params: ['aiv0_simd_to_ub_gbs', 'aiv1_simd_to_ub_gbs'],
  },
];

const L2_PEAK_PARAM = 'l2_cached_ratio';

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = (cols[j] ?? '').trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function parseNumber(raw: string | undefined): number | undefined {
  if (raw == null || raw === '' || raw === 'NA') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function formatGbs(n: number): string {
  return `${n.toFixed(2)} GB/s`;
}

/** Average finite values; undefined if none. */
function pickValue(map: Map<string, number>, params: string[]): number | undefined {
  const vals: number[] = [];
  for (const p of params) {
    const v = map.get(p);
    if (v != null) vals.push(v);
  }
  if (vals.length === 0) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Map ArchDiagramMetrics.csv EAV rows → topology chrome model.
 * Returns undefined when nothing drawable (DATA-30 / PR-VM-018).
 */
export function topologyFromArchDiagramMetrics(
  csvText: string | undefined,
): MemoryTopologyModel | undefined {
  if (!csvText?.trim()) return undefined;
  const { rows } = parseCsv(csvText);
  if (rows.length === 0) return undefined;

  const values = new Map<string, number>();
  for (const row of rows) {
    const name = (
      row.ArchDiagramParameterName ??
      row.archDiagramParameterName ??
      ''
    ).trim();
    const val = parseNumber(
      row.ArchDiagramParameterValue ?? row.archDiagramParameterValue,
    );
    if (name && val != null) values.set(name, val);
  }
  if (values.size === 0) return undefined;

  const edges: MemoryTopologyModel['edges'] = [];
  for (const spec of ARCH_EDGE_MAP) {
    const value = pickValue(values, spec.params);
    edges.push({
      id: spec.id,
      from: spec.from,
      to: spec.to,
      ...(value != null ? { label: formatGbs(value) } : {}),
    });
  }

  const peakPct = values.get(L2_PEAK_PARAM);
  const nodes = MEMORY_TOPOLOGY_NODE_DEFS.map((n) =>
    n.id === 'l2' && peakPct != null ? { ...n, peakPct } : { ...n },
  );

  const model: MemoryTopologyModel = { nodes, edges };
  return hasDrawableTopology(model) ? model : undefined;
}
