/**
 * Emulate ArchDiagramMetrics.csv → MemoryTopologyModel interim carrier (DATA-48a).
 * Product surface: Architecture Diagram (capability archDiagram); not compute memoryDiagram.
 * @see docs/context/decisions/interim/DATA.md DATA-48a
 */
import type { MemoryTopologyModel } from '../domain/types';
import {
  foldCubeL0cCorridorEdges,
  hasDrawableTopology,
  MEMORY_TOPOLOGY_NODE_DEFS,
} from './memoryTopology';
import { parseCsv } from './parseCsv';

/** Biprof Architecture Diagram edge-label modes (HTML tabs / sibling SVGs). */
export const ARCH_DIAGRAM_METRIC_MODES = [
  'bandwidth_per_operator',
  'bandwidth_per_request',
  'number_of_requests',
] as const;

export type ArchDiagramMetricMode = (typeof ARCH_DIAGRAM_METRIC_MODES)[number];

export const ARCH_DIAGRAM_DEFAULT_METRIC_MODE: ArchDiagramMetricMode = 'bandwidth_per_operator';

const METRIC_SUFFIX: Record<ArchDiagramMetricMode, '_gbs' | '_ratio' | '_cnt'> = {
  bandwidth_per_operator: '_gbs',
  bandwidth_per_request: '_ratio',
  number_of_requests: '_cnt',
};

type EdgeSpec = {
  id: string;
  from: string;
  to: string;
  /** Corridor base names (no `_gbs` / `_ratio` / `_cnt`); aiv0+aiv1 pair when both present. */
  params: string[];
};

/** Plated edge → ArchDiagram corridor bases (DATA-48a).
 *  Suffix selected by {@link ArchDiagramMetricMode}. Unplated HTML edges stay in
 *  `ARCH_DIAGRAM_UNPLATED_HTML_BASES`. */
export const ARCH_DIAGRAM_EDGE_MAP: readonly EdgeSpec[] = [
  { id: 'gm-l2-read', from: 'gm', to: 'l2', params: ['hbm_to_l2_syn'] },
  { id: 'gm-l2-write', from: 'l2', to: 'gm', params: ['l2_to_hbm_syn'] },
  { id: 'l2-l1-read', from: 'l2', to: 'l1', params: ['aic_out_to_l1'] },
  { id: 'l1-l0a', from: 'l1', to: 'l0a', params: ['aic_l1_to_l0a'] },
  { id: 'l1-l0b', from: 'l1', to: 'l0b', params: ['aic_l1_to_l0b'] },
  { id: 'l0a-cube', from: 'l0a', to: 'cube', params: ['aic_l0a_to_cube'] },
  { id: 'l0b-cube', from: 'l0b', to: 'cube', params: ['aic_l0b_to_cube'] },
  { id: 'cube-l0c', from: 'cube', to: 'l0c', params: ['aic_cube_to_l0c'] },
  { id: 'l0c-cube', from: 'l0c', to: 'cube', params: ['aic_l0c_to_cube'] },
  {
    id: 'l2-ub',
    from: 'l2',
    to: 'ub',
    params: ['aiv0_out_to_ub', 'aiv1_out_to_ub'],
  },
  {
    id: 'ub-l2',
    from: 'ub',
    to: 'l2',
    params: ['aiv0_ub_to_out', 'aiv1_ub_to_out'],
  },
  {
    id: 'ub-vec',
    from: 'ub',
    to: 'vec',
    params: ['aiv0_ub_to_simd', 'aiv1_ub_to_simd'],
  },
  {
    id: 'vec-ub',
    from: 'vec',
    to: 'ub',
    params: ['aiv0_simd_to_ub', 'aiv1_simd_to_ub'],
  },
];

/** L2 Peak(%) plate — HTML util id shared across biprof Bandwidth tabs (DATA-48a). Mode-invariant. */
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

/** Emulate interim paints **only** `ARCH_DIAGRAM_L2_PEAK_PARAM` as L2 Peak(%); other HTML
 *  util `*_ratio` ids stay unplated (compute UI-49 badges come from PipeUtilization). */

function parseNumber(raw: string | undefined): number | undefined {
  if (raw == null || raw === '' || raw === 'NA') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function formatEdgeLabel(n: number, mode: ArchDiagramMetricMode): string {
  if (mode === 'number_of_requests') {
    // DATA-48a / biprof: `*_cnt` is integral. Round float noise for the integer plate label
    // rather than dropping the edge (CSV from an untrusted .rep may carry `3.0`).
    return String(Math.round(n));
  }
  // Operator BW and per-request (CSV `*_ratio`) both print `{n} GB/s` in biprof SVGs.
  return `${n.toFixed(2)} GB/s`;
}

/**
 * Combine aiv0+aiv1 (or any multi-param edge): **sum** for gbs/cnt, **unweighted average**
 * for ratio (DATA-48a). Scalar `*_ratio` params do not carry numerators/denominators, so a
 * true combined per-request ratio is unavailable — asymmetric AIV0/AIV1 traffic can
 * over/under-state the corridor vs (Σnum)/(Σden). Undefined if none present.
 */
export function combineArchDiagramValues(
  vals: number[],
  mode: ArchDiagramMetricMode,
): number | undefined {
  if (vals.length === 0) return undefined;
  const sum = vals.reduce((a, b) => a + b, 0);
  if (mode === 'bandwidth_per_request') return sum / vals.length;
  return sum;
}

/** Case-insensitive cell lookup — same regime as CsvFieldListPanel EAV / archDiagramCsvFromTexts. */
function eavCell(row: Record<string, string>, headerLower: string): string | undefined {
  for (const key of Object.keys(row)) {
    if (key.toLowerCase() === headerLower) {
      const v = row[key];
      return v === undefined || v === '' ? undefined : v;
    }
  }
  return undefined;
}

function pickValue(
  map: Map<string, number>,
  bases: string[],
  mode: ArchDiagramMetricMode,
): number | undefined {
  const suffix = METRIC_SUFFIX[mode];
  const vals: number[] = [];
  for (const base of bases) {
    const v = map.get(`${base}${suffix}`);
    if (v != null) vals.push(v);
  }
  return combineArchDiagramValues(vals, mode);
}

/**
 * Map ArchDiagramMetrics.csv EAV rows → topology chrome model.
 * Returns undefined when nothing drawable (DATA-30 / PR-VM-018).
 */
export function topologyFromArchDiagramMetrics(
  csvText: string | undefined,
  mode: ArchDiagramMetricMode = ARCH_DIAGRAM_DEFAULT_METRIC_MODE,
): MemoryTopologyModel | undefined {
  if (!csvText?.trim()) return undefined;
  const { rows } = parseCsv(csvText);
  if (rows.length === 0) return undefined;

  const values = new Map<string, number>();
  for (const row of rows) {
    const name = (eavCell(row, 'archdiagramparametername') ?? '').trim();
    const val = parseNumber(eavCell(row, 'archdiagramparametervalue'));
    if (name && val != null) values.set(name, val);
  }
  if (values.size === 0) return undefined;

  const edges: MemoryTopologyModel['edges'] = [];
  for (const spec of ARCH_DIAGRAM_EDGE_MAP) {
    const value = pickValue(values, spec.params, mode);
    edges.push({
      id: spec.id,
      from: spec.from,
      to: spec.to,
      ...(value != null ? { label: formatEdgeLabel(value, mode) } : {}),
    });
  }

  const peakPct = values.get(ARCH_DIAGRAM_L2_PEAK_PARAM);
  const nodes = MEMORY_TOPOLOGY_NODE_DEFS.map((n) =>
    n.id === 'l2' && peakPct != null ? { ...n, peakPct } : { ...n },
  );

  const model: MemoryTopologyModel = { nodes, edges: foldCubeL0cCorridorEdges(edges) };
  return hasDrawableTopology(model) ? model : undefined;
}

/** Resolve ArchDiagramMetrics raw CSV from `report.csvTexts` (case-insensitive name). */
export function archDiagramCsvFromTexts(
  csvTexts: Record<string, string> | undefined,
): string | undefined {
  if (!csvTexts) return undefined;
  for (const key of Object.keys(csvTexts)) {
    if (key.toLowerCase() === 'archdiagrammetrics.csv') return csvTexts[key];
  }
  return undefined;
}
