/**
 * Emulate PIPE occupancy mappers — PipeUtilizationHist / PipesUtilization → pipeOccupancy.
 * CoreName drives side (aic|aiv0|aiv1); never average across AIV cores ([UI-54](../../docs/context/decisions/UI.md)).
 * Hist 详情: project Utilization onto sparse aic_/aiv0_/aiv1_ *_ratio keys ([UI-55](../../docs/context/decisions/UI.md)).
 */

import type { CsvTableModel, PipeOccupancyItem, PipeOccupancySide } from '../domain/types';
import { parseCsv } from './parseCsv';

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

const PIPE_NAME_MAP: {
  match: RegExp;
  id: string;
  label: string;
  colorKey: string;
}[] = [
  { match: /^cube$/i, id: 'cube', label: 'Cube', colorKey: 'cube' },
  { match: /^vector$|^vec$|^simd$/i, id: 'vector', label: 'Vector', colorKey: 'vector' },
  { match: /^simt$/i, id: 'simt', label: 'SIMT', colorKey: 'default' },
  { match: /^mte1$/i, id: 'mte1', label: 'MTE1', colorKey: 'mte1' },
  { match: /^mte2$/i, id: 'mte2', label: 'MTE2', colorKey: 'mte2' },
  { match: /^mte3$/i, id: 'mte3', label: 'MTE3', colorKey: 'mte3' },
  { match: /^fixp$|^fixpipe$/i, id: 'fixp', label: 'FixP', colorKey: 'fixp' },
  { match: /^scalar$/i, id: 'scalar', label: 'Scalar', colorKey: 'scalar' },
  { match: /^icache/i, id: 'icache', label: 'ICache Miss', colorKey: 'default' },
];

function normalizeRatio(raw: number): number | null {
  if (!Number.isFinite(raw)) return null;
  if (raw < 0) return null;
  // Accept 0..1 or 0..100 (%)
  if (raw > 1 && raw <= 100) return raw / 100;
  if (raw > 100) return null;
  return raw;
}

function mapPipeName(name: string): (typeof PIPE_NAME_MAP)[number] | null {
  const trimmed = name.trim();
  for (const entry of PIPE_NAME_MAP) {
    if (entry.match.test(trimmed)) return entry;
  }
  return null;
}

/** Map CoreName / CoreTypes label → emulate PIPE side (UI-54). */
export function coreNameToPipeSide(raw: string): PipeOccupancySide | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (v === 'aic' || v === 'cube') return 'aic';
  if (v === 'aiv0' || v === 'vector0' || v === 'vec0') return 'aiv0';
  if (v === 'aiv1' || v === 'vector1' || v === 'vec1') return 'aiv1';
  if (v.includes('aiv0')) return 'aiv0';
  if (v.includes('aiv1')) return 'aiv1';
  // Bare `aiv` / `vector` are ambiguous (pair vs lane) — skip like other unknowns (UI-54).
  if (v.includes('aic') || v.includes('cube')) return 'aic';
  return null;
}

function accumulate(
  acc: Map<string, { item: PipeOccupancyItem; sum: number; n: number }>,
  item: PipeOccupancyItem,
): void {
  const key = `${item.side ?? 'x'}:${item.id}`;
  const prev = acc.get(key);
  if (prev) {
    prev.sum += item.ratio;
    prev.n += 1;
    prev.item.ratio = prev.sum / prev.n;
  } else {
    acc.set(key, { sum: item.ratio, n: 1, item: { ...item } });
  }
}

/**
 * Map `PipeUtilizationHist.csv` (PipeName, CoreName, Utilization) → pipeOccupancy.
 * Acc key = `${coreSide}:${pipeId}` — AIV0 and AIV1 stay separate (UI-54).
 */
export function pipeOccupancyFromHist(payload?: Uint8Array): PipeOccupancyItem[] {
  if (!payload) return [];
  const { rows } = parseCsv(decodeUtf8(payload));
  const acc = new Map<string, { item: PipeOccupancyItem; sum: number; n: number }>();
  for (const row of rows) {
    const name = row.PipeName ?? row.pipeName ?? '';
    const mapped = mapPipeName(name);
    if (!mapped) continue;
    const side = coreNameToPipeSide(row.CoreName ?? row.coreName ?? '');
    if (side == null) continue;
    const ratio = normalizeRatio(Number(row.Utilization ?? row.utilization ?? row.PipeUtilization));
    if (ratio == null) continue;
    accumulate(acc, {
      id: mapped.id,
      label: mapped.label,
      ratio,
      colorKey: mapped.colorKey,
      side,
    });
  }
  return [...acc.values()].map((v) => v.item);
}

/**
 * Project `PipeUtilizationHist.csv` into one wide row of compute-like `*_ratio` keys (UI-55).
 * Prefix from CoreName (`aic` / `aiv0` / `aiv1`); stem from PipeName; values 0..1.
 * Headers stay in first-seen key order; duplicate `(prefix, stem)` values last-wins.
 * ICache hist rows map to bars via `mapPipeName` but have no `*_ratio` stem — omitted here
 * (compute uses `*_miss_rate`, not a ratio column).
 */
export function csvTableFromPipeUtilizationHist(
  payload?: Uint8Array,
): CsvTableModel | null {
  if (!payload || payload.byteLength === 0) return null;
  const { rows } = parseCsv(decodeUtf8(payload));
  const headers: string[] = [];
  const wide: Record<string, string> = {};
  for (const row of rows) {
    const pipe = (row.PipeName ?? row.pipeName ?? '').trim();
    const core = (row.CoreName ?? row.coreName ?? '').trim();
    const prefix = corePrefix(core);
    const stem = pipeRatioStem(pipe);
    if (prefix == null || stem == null) continue;
    const ratio = normalizeRatio(
      Number(row.Utilization ?? row.utilization ?? row.PipeUtilization),
    );
    if (ratio == null) continue;
    const key = `${prefix}_${stem}`;
    if (!(key in wide)) headers.push(key);
    wide[key] = String(ratio);
  }
  if (headers.length === 0) return null;
  return {
    fileName: 'PipeUtilizationHist.csv',
    headers,
    rows: [wide],
    blockIds: [],
  };
}

/** CoreName → key prefix (UI-55); same rules as `coreNameToPipeSide` (never invent a divergent map). */
function corePrefix(raw: string): 'aic' | 'aiv0' | 'aiv1' | null {
  const side = coreNameToPipeSide(raw);
  return side === 'aic' || side === 'aiv0' || side === 'aiv1' ? side : null;
}

/** PipeName → ratio stem aligned with compute PIPE_COLUMNS naming (UI-55).
 * No `icache` stem — bars may still show ICache Miss; 详情 does not invent a miss-rate key. */
function pipeRatioStem(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (v === 'cube') return 'cube_ratio';
  if (v === 'scalar') return 'scalar_ratio';
  if (v === 'fixp' || v === 'fixpipe') return 'fixpipe_ratio';
  if (v === 'mte1') return 'mte1_ratio';
  if (v === 'mte2') return 'mte2_ratio';
  if (v === 'mte3') return 'mte3_ratio';
  if (v === 'simd' || v === 'vector' || v === 'vec') return 'vec_ratio';
  if (v === 'simt') return 'simt_ratio';
  return null;
}

/** Build id→name map from a two-column dictionary CSV. */
function idNameMap(
  payload: Uint8Array | undefined,
  [idCol, nameCol]: [string, string],
): Map<string, string> {
  const out = new Map<string, string>();
  if (!payload) return out;
  const { rows } = parseCsv(decodeUtf8(payload));
  for (const row of rows) {
    const id = (row[idCol] ?? Object.values(row)[0] ?? '').trim();
    const name = (row[nameCol] ?? Object.values(row)[1] ?? '').trim();
    if (id && name) out.set(id, name);
  }
  return out;
}

/**
 * Map `PipesUtilization.csv` (CoreId, CoreTypeId, InstrQueueTypeId, PipeUtilization).
 * Join `InstrQueueTypes` / `CoreTypes` when present. Prefer hist when both exist.
 * Unresolved cores (`coreNameToPipeSide` null — bare integer FK without CoreTypes, or
 * unknown labels) are **dropped** (UI-54); no cube/vector default.
 */
export function pipeOccupancyFromPipesUtilization(
  payload?: Uint8Array,
  dicts?: { queueTypes?: Uint8Array; coreTypes?: Uint8Array },
): PipeOccupancyItem[] {
  if (!payload) return [];
  const queueNames = idNameMap(dicts?.queueTypes, [
    'InstrQueueTypeId',
    'InstrQueueTypeName',
  ]);
  const coreNames = idNameMap(dicts?.coreTypes, ['CoreTypeId', 'CoreTypeName']);
  const { rows } = parseCsv(decodeUtf8(payload));
  const acc = new Map<string, { item: PipeOccupancyItem; sum: number; n: number }>();
  for (const row of rows) {
    const queueRaw = (row.InstrQueueTypeId ?? row.PipeName ?? '').trim();
    if (!queueRaw) continue;
    const queueLabel = queueNames.get(queueRaw) ?? queueRaw;
    const mapped = mapPipeName(queueLabel);
    // Skip bare integer FKs that did not resolve to a known pipe family.
    if (!mapped && /^\d+$/.test(queueRaw) && !queueNames.has(queueRaw)) continue;
    if (!mapped && /^\d+$/.test(queueLabel)) continue;

    const coreRaw = (row.CoreTypeId ?? row.CoreName ?? '').trim();
    const coreLabel = coreNames.get(coreRaw) ?? coreRaw;
    const side = coreNameToPipeSide(coreLabel);
    if (side == null) continue;

    const id = mapped?.id ?? `q${queueLabel}`;
    const label = mapped?.label ?? queueLabel;
    const colorKey = mapped?.colorKey ?? 'default';
    const ratio = normalizeRatio(Number(row.PipeUtilization ?? row.Utilization));
    if (ratio == null) continue;
    accumulate(acc, { id, label, ratio, colorKey, side });
  }
  return [...acc.values()].map((v) => v.item);
}
