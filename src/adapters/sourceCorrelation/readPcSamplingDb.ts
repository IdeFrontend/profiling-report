import type { SqlValue } from 'sql.js';
import type { SourceStallBreakdown } from '../../domain/types';

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

export type InitSqlJs = (config?: {
  wasmBinary?: ArrayBuffer | Uint8Array;
  locateFile?: (file: string) => string;
}) => Promise<{
  Database: new (data?: ArrayLike<number> | Buffer | null) => {
    exec: (sql: string) => { columns: string[]; values: SqlValue[][] }[];
    close: () => void;
  };
}>;

let sqlFactory: InitSqlJs | null = null;
let wasmBinary: Uint8Array | undefined;

/**
 * Inject sql.js init + optional WASM bytes (browser hosts pass locateFile / wasmBinary;
 * Node tests default to package dist).
 */
export function configurePcSamplingSql(opts: {
  initSqlJs: InitSqlJs;
  wasmBinary?: Uint8Array;
}): void {
  sqlFactory = opts.initSqlJs;
  wasmBinary = opts.wasmBinary;
}

async function loadSqlFactory(): Promise<InitSqlJs> {
  if (sqlFactory) return sqlFactory;
  const mod = await import('sql.js');
  return mod.default as InitSqlJs;
}

async function defaultWasmBinary(): Promise<Uint8Array | undefined> {
  if (wasmBinary) return wasmBinary;
  // Node / vitest: read package wasm. Browser must call configurePcSamplingSql.
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { readFileSync } = await import('node:fs');
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    return new Uint8Array(readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm')));
  }
  return undefined;
}

function num(v: SqlValue | undefined): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v !== '' && Number.isFinite(Number(v))) return Number(v);
  return 0;
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

/**
 * Read compute-profile `summary.db` → `pc_sampling` rows.
 * Used by the Source-tab real path (PC metrics keyed by `pc_offset`).
 */
export async function readPcSamplingDb(bytes: Uint8Array): Promise<PcSamplingRow[]> {
  const initSqlJs = await loadSqlFactory();
  const wasm = await defaultWasmBinary();
  const SQL = await initSqlJs(wasm ? { wasmBinary: wasm } : undefined);
  const db = new SQL.Database(bytes);
  try {
    const cols = STALL_COLUMNS.map(([sql]) => `"${sql}"`).join(', ');
    const result = db.exec(
      `SELECT "pc_offset", ${cols} FROM pc_sampling ORDER BY "pc_offset"`,
    );
    if (!result.length) return [];
    const table = result[0]!;
    const idx = Object.fromEntries(table.columns.map((c, i) => [c, i]));
    return table.values.map((row) => {
      const fields = {} as Record<StallField, number>;
      for (const [sqlCol, field] of STALL_COLUMNS) {
        fields[field] = num(row[idx[sqlCol]!]);
      }
      const { samplingStall, stallBreakdown } = breakdown(fields);
      return {
        pcOffset: String(row[idx.pc_offset!] ?? ''),
        ...fields,
        samplingStall,
        stallBreakdown,
      };
    });
  } finally {
    db.close();
  }
}
