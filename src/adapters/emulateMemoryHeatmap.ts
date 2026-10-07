/**
 * Emulate per-access tables → `MemoryHeatmapModel` (biprof §11.2.3.2 Memory Utilization Heatmap).
 * Product surface: the heat panel inside the topology fullscreen overlay; carrier `memoryHeatmap`,
 * capability `memoryHeatmap`. Its own surface beside `memoryTopology` (DATA-49).
 * @see docs/views/memory-topology.md § Memory Utilization Heatmap
 */
import type {
  MemoryHeatmapBlock,
  MemoryHeatmapModel,
  MemoryHeatmapUnit,
} from '../domain/types';
import { parseCsv } from './parseCsv';

/**
 * Block body of §11.2.3.2: 16 blocks per row and 26 row groups. The producer gives no block size /
 * capacity, so the grid is a fixed shape and the unit's observed address span is binned across it
 * (DATA-50). The frame's own grid is 16 × 32; the row count is the carrier's interim binning, not
 * its own (MemoryHeatmapPanel.spec.md § Visual).
 */
export const HEATMAP_COLUMNS = 16;
export const HEATMAP_ROWS = 26;
export const HEATMAP_BLOCK_COUNT = HEATMAP_COLUMNS * HEATMAP_ROWS;

/**
 * Emulate tables read for a unit grid, keyed by the unit they describe. Attribution is **per file
 * name**: `UbRwAccesses` is a UB-scoped per-access stream (`ExecInstrId`, `AccessedAddress` — it
 * carries no unit column of its own), and no other packed table can be attributed at all, because
 * `MemoryRWAccesses` names its unit with a bare `MemoryType` integer that has no published
 * vocabulary (DATA-50). Those five tabs therefore stay blank states.
 */
const UNIT_SOURCE: { id: MemoryHeatmapUnit['id']; file: string }[] = [
  { id: 'ub', file: 'UbRwAccesses.csv' },
];

/** Resolve a producer table's decoded text by basename (case-insensitive). */
function textFor(texts: Record<string, string | undefined>, file: string): string | undefined {
  const direct = texts[file];
  if (direct != null) return direct;
  const key = Object.keys(texts).find((k) => k.toLowerCase() === file.toLowerCase());
  return key ? texts[key] : undefined;
}

/**
 * A cell that is absent or non-numeric is **not** an address. `Number('')` and `Number('  ')` are
 * both `0`, so a missing / whitespace-padded `AccessedAddress` would otherwise bin onto block 0,
 * pull `min` to 0 and count its instruction — the same guard the sibling adapters' `parseNumber`
 * applies, with a trim so padded empties match `ExecInstrId` (PR-VM-025).
 */
function parseAddress(raw: string | undefined): number | undefined {
  if (raw == null) return undefined;
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Bin one unit's `AccessedAddress` stream onto the fixed grid. A block that received at least one
 * access is `已分配有数据`; a block inside the observed span that received none is `已分配无数据`
 * (allocated, empty). Blocks outside the span are not allocated at all, so they are `withoutData`
 * too — the frame paints no third state (`MemoryHeatmapBlockState`).
 */
function unitFromAccessRows(
  id: MemoryHeatmapUnit['id'],
  text: string,
): MemoryHeatmapUnit | undefined {
  const { rows } = parseCsv(text);
  const addresses: number[] = [];
  const instructions = new Set<string>();
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const address = parseAddress(row.AccessedAddress);
    if (address == null) continue;
    addresses.push(address);
    if (address < min) min = address;
    if (address > max) max = address;
    const instr = (row.ExecInstrId ?? '').trim();
    if (instr !== '') instructions.add(instr);
  }
  if (addresses.length === 0) return undefined;

  const span = max - min + 1;
  const hit = new Set<number>();
  for (const address of addresses) {
    // `span === 1` (one address only) collapses onto block 0 rather than dividing by zero.
    const index =
      span === 1
        ? 0
        : Math.min(HEATMAP_BLOCK_COUNT - 1, Math.floor(((address - min) / span) * HEATMAP_BLOCK_COUNT));
    hit.add(index);
  }

  const blocks: MemoryHeatmapBlock[] = [];
  for (let index = 0; index < HEATMAP_BLOCK_COUNT; index += 1) {
    blocks.push({ index, state: hit.has(index) ? 'withData' : 'withoutData' });
  }
  return {
    id,
    blocks,
    ...(instructions.size > 0 ? { usedInstructionCount: instructions.size } : {}),
  };
}

/**
 * Build the heat model from decoded emulate table texts. Returns `undefined` when no unit has a
 * usable source, so the caller omits the field and the `memoryHeatmap` capability (DATA-30).
 */
export function memoryHeatmapFromTexts(
  texts: Record<string, string | undefined>,
): MemoryHeatmapModel | undefined {
  const units: MemoryHeatmapUnit[] = [];
  for (const source of UNIT_SOURCE) {
    const text = textFor(texts, source.file);
    if (!text?.trim()) continue;
    const unit = unitFromAccessRows(source.id, text);
    if (unit) units.push(unit);
  }
  return units.length > 0 ? { units } : undefined;
}
