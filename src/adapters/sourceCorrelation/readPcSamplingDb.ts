import type { SourceStallBreakdown } from '../../domain/types';

/**
 * Read-only walker for compute-profile `summary.db` → `pc_sampling`.
 *
 * ponytail: hand-rolled SQLite3 B-tree reader for one known table (no sql.js /
 * WASM). Ceiling: page size / UTF-8 / no overflow / table B-tree only. Upgrade
 * to a real engine if the producer widens the format.
 */

/** One `pc_sampling` row from compute-profile `summary.db`. */
export interface PcSamplingRow {
  /** Hex PC offset as stored (`0x388`). */
  pcOffset: string;
  ibufEmpty: number;
  nopCycles: number;
  scoreboardNotReady: number;
  registerBankConflict: number;
  resourceConflict: number;
  warpLevelSync: number;
  divergenceStackSpill: number;
  others: number;
  /** Sum of stall counter columns (Sampling Stall numerator). */
  samplingStall: number;
  /** Counter columns as tooltip breakdown (percent of samplingStall). */
  stallBreakdown: SourceStallBreakdown[];
}

const STALL_COLUMNS = [
  ['IBuf_Empty', 'ibufEmpty', 'IBuf Empty'],
  ['Nop_Cycles', 'nopCycles', 'Nop Cycles'],
  ['Scoreboard_Not_Ready', 'scoreboardNotReady', 'Scoreboard Not Ready'],
  ['Register_bank_conflict', 'registerBankConflict', 'Register Bank Conflict'],
  ['Resource_conflict', 'resourceConflict', 'Resource Conflict'],
  ['Warp_Level_Sync', 'warpLevelSync', 'Warp Level Sync'],
  ['Divergence_Stack_Spill', 'divergenceStackSpill', 'Divergence Stack Spill'],
  ['Others', 'others', 'Others'],
] as const;

type StallField = (typeof STALL_COLUMNS)[number][1];

const SQLITE_HEADER = 'SQLite format 3\0';
const PAGE_LEAF_TABLE = 0x0d;
const PAGE_INTERIOR_TABLE = 0x05;

function fail(msg: string): never {
  throw new Error(`[profiling-report] summary.db: ${msg}`);
}

function readU16(view: DataView, o: number): number {
  return view.getUint16(o, false);
}

function readU32(view: DataView, o: number): number {
  return view.getUint32(o, false);
}

function readVarint(bytes: Uint8Array, start: number): { value: number; next: number } {
  let value = 0;
  let i = start;
  for (let n = 0; n < 9; n++) {
    if (i >= bytes.length) fail('varint overrun');
    const x = bytes[i]!;
    i += 1;
    if (n === 8) {
      value = value * 256 + x;
      return { value, next: i };
    }
    value = value * 128 + (x & 0x7f);
    if (x < 0x80) return { value, next: i };
  }
  fail('varint too long');
}

function serialPayloadSize(serialType: number): number {
  if (serialType >= 0 && serialType <= 4) return [0, 1, 2, 3, 4][serialType]!;
  if (serialType === 5) return 6;
  if (serialType === 6 || serialType === 7) return 8;
  if (serialType === 8 || serialType === 9) return 0;
  if (serialType >= 12 && serialType % 2 === 0) return (serialType - 12) / 2;
  if (serialType >= 13 && serialType % 2 === 1) return (serialType - 13) / 2;
  fail(`unsupported serial type ${serialType}`);
}

function readSignedBe(bytes: Uint8Array, start: number, len: number): number {
  if (len === 0) return 0;
  let v = bytes[start]!;
  const neg = v & 0x80;
  let x = neg ? v - 256 : v;
  for (let i = 1; i < len; i++) x = x * 256 + bytes[start + i]!;
  return x;
}

function parseRecord(payload: Uint8Array): unknown[] {
  const hdr = readVarint(payload, 0);
  const headerSize = hdr.value;
  if (headerSize <= 0 || headerSize > payload.length) fail('bad record header size');
  const types: number[] = [];
  let i = hdr.next;
  while (i < headerSize) {
    const st = readVarint(payload, i);
    types.push(st.value);
    i = st.next;
  }
  if (i !== headerSize) fail('record header size mismatch');
  const cols: unknown[] = [];
  for (const st of types) {
    const sz = serialPayloadSize(st);
    if (i + sz > payload.length) fail('record payload overrun');
    const chunk = payload.subarray(i, i + sz);
    i += sz;
    if (st === 0) cols.push(null);
    else if (st >= 1 && st <= 6) cols.push(readSignedBe(chunk, 0, sz));
    else if (st === 7) fail('float columns not supported');
    else if (st === 8) cols.push(0);
    else if (st === 9) cols.push(1);
    else if (st >= 13 && st % 2 === 1) cols.push(new TextDecoder('utf-8').decode(chunk));
    else fail(`blob column not supported (serial ${st})`);
  }
  return cols;
}

/** Depth ceiling for table B-trees (hostile/corrupt embeds). */
const MAX_BTREE_DEPTH = 32;

function pageBytes(file: Uint8Array, pageSize: number, pageNo: number): Uint8Array {
  if (pageNo < 1) fail(`bad page number ${pageNo}`);
  const start = (pageNo - 1) * pageSize;
  const end = start + pageSize;
  if (end > file.length) fail(`page ${pageNo} past EOF`);
  return file.subarray(start, end);
}

function walkTableBtree(
  file: Uint8Array,
  pageSize: number,
  pageNo: number,
  out: { rowid: number; cols: unknown[] }[],
  seen: Set<number> = new Set(),
  depth = 0,
): void {
  if (depth > MAX_BTREE_DEPTH) fail(`B-tree deeper than ${MAX_BTREE_DEPTH}`);
  if (seen.has(pageNo)) fail(`B-tree cycle at page ${pageNo}`);
  seen.add(pageNo);

  const pg = pageBytes(file, pageSize, pageNo);
  const contentStart = pageNo === 1 ? 100 : 0;
  const pageType = pg[contentStart]!;
  const cellCount = (pg[contentStart + 3]! << 8) | pg[contentStart + 4]!;
  const hdrSize = pageType === PAGE_INTERIOR_TABLE ? 12 : 8;
  const ptrBase = contentStart + hdrSize;
  const cellAreaStart = ptrBase + 2 * cellCount;

  if (pageType === PAGE_LEAF_TABLE) {
    for (let c = 0; c < cellCount; c++) {
      const ptr = (pg[ptrBase + 2 * c]! << 8) | pg[ptrBase + 2 * c + 1]!;
      if (ptr < cellAreaStart || ptr >= pg.length) {
        fail(`leaf cell pointer ${ptr} out of range on page ${pageNo}`);
      }
      let i = ptr;
      const payloadLen = readVarint(pg, i);
      i = payloadLen.next;
      const rowid = readVarint(pg, i);
      i = rowid.next;
      const end = i + payloadLen.value;
      if (end > pg.length) {
        fail('overflow pages not supported (pc_sampling cells must fit in-page)');
      }
      out.push({ rowid: rowid.value, cols: parseRecord(pg.subarray(i, end)) });
    }
    return;
  }

  if (pageType === PAGE_INTERIOR_TABLE) {
    const rightMost =
      (pg[contentStart + 8]! << 24) |
      (pg[contentStart + 9]! << 16) |
      (pg[contentStart + 10]! << 8) |
      pg[contentStart + 11]!;
    for (let c = 0; c < cellCount; c++) {
      const ptr = (pg[ptrBase + 2 * c]! << 8) | pg[ptrBase + 2 * c + 1]!;
      if (ptr < cellAreaStart || ptr + 4 > pg.length) {
        fail(`interior cell pointer ${ptr} out of range on page ${pageNo}`);
      }
      const leftChild =
        (pg[ptr]! << 24) | (pg[ptr + 1]! << 16) | (pg[ptr + 2]! << 8) | pg[ptr + 3]!;
      walkTableBtree(file, pageSize, leftChild, out, seen, depth + 1);
    }
    walkTableBtree(file, pageSize, rightMost, out, seen, depth + 1);
    return;
  }

  fail(`unsupported B-tree page type 0x${pageType.toString(16)} on page ${pageNo}`);
}

function breakdown(values: Record<StallField, number>): {
  samplingStall: number;
  stallBreakdown: SourceStallBreakdown[];
} {
  const samplingStall = STALL_COLUMNS.reduce((sum, [, field]) => sum + values[field], 0);
  const stallBreakdown: SourceStallBreakdown[] = STALL_COLUMNS.map(([, field, label]) => {
    const value = values[field];
    return {
      metric: label,
      value,
      percent: samplingStall > 0 ? (value / samplingStall) * 100 : 0,
    };
  }).filter((row) => row.value > 0);
  return { samplingStall, stallBreakdown };
}

function asInt(v: unknown, label: string): number {
  if (typeof v === 'number' && Number.isSafeInteger(v)) return v;
  fail(`expected integer ${label}`);
}

/**
 * Read compute-profile `summary.db` → `pc_sampling` rows (sync, no WASM).
 */
export function readPcSamplingDb(bytes: Uint8Array): PcSamplingRow[] {
  if (bytes.byteLength < 100) fail('file too small');
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 16));
  if (head !== SQLITE_HEADER) fail('not a SQLite 3 database');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pageSize = readU16(view, 16);
  if (pageSize === 1) pageSize = 65536;
  if (pageSize < 512 || (pageSize & (pageSize - 1)) !== 0) fail(`unsupported page_size ${pageSize}`);
  if (bytes[20] !== 0) fail('reserved per-page bytes not supported');
  if (readU32(view, 56) !== 1) fail('database encoding must be UTF-8');

  const pageCount = readU32(view, 28);
  if (pageCount === 0 || pageCount * pageSize > bytes.byteLength) {
    fail('page_count does not match file length');
  }

  const masterRows: { rowid: number; cols: unknown[] }[] = [];
  walkTableBtree(bytes, pageSize, 1, masterRows);

  let rootPage: number | null = null;
  for (const { cols } of masterRows) {
    // sqlite_master: type, name, tbl_name, rootpage, sql
    if (cols[0] === 'table' && cols[1] === 'pc_sampling') {
      rootPage = asInt(cols[3], 'pc_sampling.rootpage');
      break;
    }
  }
  if (rootPage == null) fail('table pc_sampling not found');

  const dataRows: { rowid: number; cols: unknown[] }[] = [];
  walkTableBtree(bytes, pageSize, rootPage, dataRows);

  return dataRows.map(({ cols }) => {
    if (cols.length !== 9) fail(`pc_sampling row has ${cols.length} columns, expected 9`);
    if (typeof cols[0] !== 'string') fail('pc_offset must be TEXT');
    const fields = {
      ibufEmpty: asInt(cols[1], 'IBuf_Empty'),
      nopCycles: asInt(cols[2], 'Nop_Cycles'),
      scoreboardNotReady: asInt(cols[3], 'Scoreboard_Not_Ready'),
      registerBankConflict: asInt(cols[4], 'Register_bank_conflict'),
      resourceConflict: asInt(cols[5], 'Resource_conflict'),
      warpLevelSync: asInt(cols[6], 'Warp_Level_Sync'),
      divergenceStackSpill: asInt(cols[7], 'Divergence_Stack_Spill'),
      others: asInt(cols[8], 'Others'),
    };
    const { samplingStall, stallBreakdown } = breakdown(fields);
    return {
      pcOffset: cols[0],
      ...fields,
      samplingStall,
      stallBreakdown,
    };
  });
}
