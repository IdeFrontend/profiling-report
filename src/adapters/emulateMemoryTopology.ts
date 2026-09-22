/**
 * Emulate ArchDiagramMetrics.csv → MemoryTopologyModel interim carrier (DATA-48a).
 * Product surface: Architecture Diagram (capability archDiagram); not compute memoryDiagram.
 * @see docs/context/decisions/interim/DATA.md DATA-48a
 */
import type { MemoryTopologyModel } from '../domain/types';
import {
  hasDrawableTopology,
  MEMORY_TOPOLOGY_NODE_DEFS,
} from './memoryTopology';
import { parseCsv } from './parseCsv';

type EdgeSpec = {
  id: string;
  from: string;
  to: string;
  /** One parameter, or aiv0+aiv1 pair (averaged when both present). */
  params: string[];
};

/** Plated GB/s edges + parameter names (DATA-48a).
 *  Names match gelu Architecture Diagram SVG `*_gbs` element ids (Bandwidth per operator) —
 *  evidence toward DATA-48, not a Product stamp. Unplated HTML edges (SIMT/cache/L0C→OUT/…)
 *  stay unmapped — see `ARCH_DIAGRAM_UNPLATED_HTML_BASES`. */
export const ARCH_DIAGRAM_EDGE_MAP: readonly EdgeSpec[] = [
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

/** L2 Peak(%) plate — HTML util id shared across biprof Bandwidth tabs (DATA-48a). */
export const ARCH_DIAGRAM_L2_PEAK_PARAM = 'l2_cached_ratio';

/**
 * HTML Architecture Diagram Bandwidth-per-operator bases that exist in the gelu inventory
 * but have **no** plated Asc chrome slot — intentionally omitted from `ARCH_DIAGRAM_EDGE_MAP`
 * (DATA-48a / UI-38). Kept here so tests fail if someone maps them without a chrome plate.
 */
export const ARCH_DIAGRAM_UNPLATED_HTML_BASES = [
  'aic_l0c_to_all_syn',
  'aic_l0c_to_l1',
  'aic_l0c_to_out',
  'aic_l0c_to_ub0',
  'aic_l0c_to_ub1',
  'aiv0_ub_to_l1',
  'aiv1_ub_to_l1',
  'aiv0_out_to_simt',
  'aiv0_simt_to_out',
  'aiv1_out_to_simt',
  'aiv1_simt_to_out',
  'aiv0_ub_to_simt',
  'aiv0_simt_to_ub',
  'aiv1_ub_to_simt',
  'aiv1_simt_to_ub',
  'aiv0_cache_to_simt',
  'aiv0_simt_to_cache',
  'aiv1_cache_to_simt',
  'aiv1_simt_to_cache',
] as const;

/**
 * HTML util `*_ratio` ids present on all biprof Architecture Diagram tabs.
 * Emulate interim paints **only** `l2_cached_ratio` as L2 Peak(%); the rest are not `plates`
 * (compute UI-49 badges come from PipeUtilization, not ArchDiagramMetrics).
 */
export const ARCH_DIAGRAM_HTML_UTIL_RATIOS = [
  'aic_cube_ratio',
  'aic_fixp_ratio',
  'aic_scalar_ratio',
  'aiv0_simd_ratio',
  'aiv0_simt_ratio',
  'aiv0_scalar_ratio',
  'aiv1_simd_ratio',
  'aiv1_simt_ratio',
  'aiv1_scalar_ratio',
  'l2_cached_ratio',
] as const;

const ARCH_EDGE_MAP = ARCH_DIAGRAM_EDGE_MAP;
const L2_PEAK_PARAM = ARCH_DIAGRAM_L2_PEAK_PARAM;

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
