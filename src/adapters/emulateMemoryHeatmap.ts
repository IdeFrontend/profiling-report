/**
 * Emulate heat tables → `MemoryHeatmapModel` (biprof §11.2.3.2 Memory Utilization Heatmap).
 * Product surface: the heat panel inside the topology fullscreen overlay; carrier `memoryHeatmap`,
 * capability `memoryHeatmap`. Its own surface beside `memoryTopology` (DATA-49).
 *
 * SSOT: `MemoryHeatmapLayout.csv` + `MemoryHeatmapCells.csv` (producer format /
 * `ui-answers-memory-heatmap.md`, DATA-50/51). No UbRwAccesses fallback.
 * @see docs/views/memory-topology.md § Memory Utilization Heatmap
 */
import type {
  MemoryHeatmapBlock,
  MemoryHeatmapModel,
  MemoryHeatmapUnit,
  MemoryHeatmapUnitId,
  MemoryHeatmapView,
} from '../domain/types';
import { parseCsv } from './parseCsv';

/** Tab order — first drawable unit becomes the overlay default ([UI-60]: no L2). */
const UNIT_ORDER: MemoryHeatmapUnitId[] = ['l1', 'ub', 'l0a', 'l0b', 'l0c'];

/** `MemoryHeatmapLayout.MemoryName` → carrier unit id. Unknown / L2 names are omitted. */
const MEMORY_NAME_TO_ID: Record<string, MemoryHeatmapUnitId> = {
  L1: 'l1',
  UB: 'ub',
  L0A: 'l0a',
  L0B: 'l0b',
  L0C: 'l0c',
};

function unitIdFromMemoryName(name: string): MemoryHeatmapUnitId | undefined {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  return MEMORY_NAME_TO_ID[trimmed] ?? MEMORY_NAME_TO_ID[trimmed.toUpperCase()];
}

/** Resolve a producer table's decoded text by basename (case-insensitive). */
function textFor(texts: Record<string, string | undefined>, file: string): string | undefined {
  const direct = texts[file];
  if (direct != null) return direct;
  const key = Object.keys(texts).find((k) => k.toLowerCase() === file.toLowerCase());
  return key ? texts[key] : undefined;
}

function parseNonNegInt(raw: string | undefined): number | undefined {
  if (raw == null) return undefined;
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

/** `OutsideDeclared` is BOOLEAN 0/1 in the CSV. */
function parseFlag(raw: string | undefined): boolean {
  const trimmed = (raw ?? '').trim();
  return trimmed === '1' || trimmed.toLowerCase() === 'true';
}

function coreTypeNames(text: string | undefined): Map<number, string> {
  const map = new Map<number, string>();
  if (!text?.trim()) return map;
  for (const row of parseCsv(text).rows) {
    const id = parseNonNegInt(row.CoreTypeId);
    const name = (row.CoreTypeName ?? '').trim();
    if (id != null && name) map.set(id, name);
  }
  return map;
}

type LayoutInstance = {
  id: MemoryHeatmapUnitId;
  memoryName: string;
  coreId: number;
  coreTypeId: number;
  columns: number;
  rows: number;
  cellSize: number;
  /** Absent when DeclaredSize is NULL/empty. */
  declaredSize?: number;
  outsideDeclared: boolean;
  memoryType: string;
};

/**
 * One view per Layout row (buffer instance). UB on AIV0 and AIV1 stay separate — the panel
 * selects among `unit.views` (DATA-50). Capacity: Total = OutsideDeclared ? span : DeclaredSize;
 * Used = touchedCells × CellSize; Free = Total − Used when Total is known (DATA-51).
 */
function unitsFromLayoutAndCells(
  layoutText: string,
  cellsText: string,
  coreTypesText?: string,
): MemoryHeatmapUnit[] | undefined {
  const layoutRows = parseCsv(layoutText).rows;
  const cellRows = parseCsv(cellsText).rows;
  if (layoutRows.length === 0) return undefined;

  const owners = coreTypeNames(coreTypesText);
  const instances: LayoutInstance[] = [];
  for (const row of layoutRows) {
    const memoryName = (row.MemoryName ?? '').trim();
    const id = unitIdFromMemoryName(memoryName);
    const columns = parseNonNegInt(row.Width);
    const rows = parseNonNegInt(row.Height);
    const cellSize = parseNonNegInt(row.CellSize);
    const coreId = parseNonNegInt(row.CoreId) ?? 0;
    const coreTypeId = parseNonNegInt(row.CoreTypeId);
    const memoryType = (row.MemoryType ?? '').trim();
    // DeclaredSize may be empty (NULL) — capacity Total then unavailable unless OutsideDeclared.
    const declaredRaw = (row.DeclaredSize ?? '').trim();
    const declaredSize = declaredRaw === '' ? undefined : parseNonNegInt(row.DeclaredSize);
    if (id == null || columns == null || rows == null || columns === 0 || rows === 0) continue;
    if (cellSize == null || coreTypeId == null || memoryType === '') continue;
    instances.push({
      id,
      memoryName: memoryName || id.toUpperCase(),
      coreId,
      coreTypeId,
      columns,
      rows,
      cellSize,
      declaredSize,
      outsideDeclared: parseFlag(row.OutsideDeclared),
      memoryType,
    });
  }
  if (instances.length === 0) return undefined;

  /** memoryType|coreTypeId|coreId|row|col → withData */
  const hit = new Set<string>();
  for (const row of cellRows) {
    const memoryType = (row.MemoryType ?? '').trim();
    const coreTypeId = (row.CoreTypeId ?? '').trim();
    const coreId = (row.CoreId ?? '0').trim() || '0';
    const cellRow = parseNonNegInt(row.CellRow);
    const cellCol = parseNonNegInt(row.CellCol);
    if (memoryType === '' || coreTypeId === '' || cellRow == null || cellCol == null) continue;
    const reads = parseNonNegInt(row.ReadAddresses) ?? 0;
    const writes = parseNonNegInt(row.WriteAddresses) ?? 0;
    if (reads + writes <= 0) continue;
    hit.add(`${memoryType}|${coreTypeId}|${coreId}|${cellRow}|${cellCol}`);
  }

  const viewsByUnit = new Map<MemoryHeatmapUnitId, MemoryHeatmapView[]>();
  for (const inst of instances) {
    const { id, columns, rows, cellSize, declaredSize, outsideDeclared, memoryType, coreId, coreTypeId } =
      inst;
    const blockCount = columns * rows;
    const span = columns * rows * cellSize;
    const blocks: MemoryHeatmapBlock[] = [];
    let usedCells = 0;
    for (let index = 0; index < blockCount; index += 1) {
      const cellRow = Math.floor(index / columns);
      const cellCol = index % columns;
      const withData = hit.has(`${memoryType}|${coreTypeId}|${coreId}|${cellRow}|${cellCol}`);
      if (withData) usedCells += 1;
      blocks.push({ index, state: withData ? 'withData' : 'withoutData' });
    }
    const usedBytes = usedCells * cellSize;
    const totalBytes = outsideDeclared ? span : declaredSize;
    const view: MemoryHeatmapView = {
      coreId,
      coreTypeId,
      ownerName: owners.get(coreTypeId),
      memoryName: inst.memoryName,
      columns,
      rows,
      blocks,
      usedBytes,
      ...(totalBytes != null
        ? { totalBytes, freeBytes: Math.max(0, totalBytes - usedBytes) }
        : {}),
      ...(outsideDeclared ? { outsideDeclared: true } : {}),
    };
    const list = viewsByUnit.get(id) ?? [];
    list.push(view);
    viewsByUnit.set(id, list);
  }

  const units: MemoryHeatmapUnit[] = [];
  for (const id of UNIT_ORDER) {
    const views = viewsByUnit.get(id);
    if (!views?.length) continue;
    units.push({ id, views });
  }
  return units.length > 0 ? units : undefined;
}

/**
 * Build the heat model from Layout+Cells (and optional CoreTypes for owner labels).
 * Returns `undefined` when nothing is drawable (DATA-30). Ignores `UbRwAccesses`.
 */
export function memoryHeatmapFromTexts(
  texts: Record<string, string | undefined>,
): MemoryHeatmapModel | undefined {
  const layoutText = textFor(texts, 'MemoryHeatmapLayout.csv');
  const cellsText = textFor(texts, 'MemoryHeatmapCells.csv');
  if (!layoutText?.trim() || !cellsText?.trim()) return undefined;
  const units = unitsFromLayoutAndCells(
    layoutText,
    cellsText,
    textFor(texts, 'CoreTypes.csv'),
  );
  return units ? { units } : undefined;
}
