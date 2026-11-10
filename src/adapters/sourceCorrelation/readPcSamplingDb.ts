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
  /**
   * Optional `Instructions_Executed`. Producer packs omit the column (DATA-55);
   * sample `summary.db` fills it.
   */
  instructionsExecuted?: number;
  /** Optional `Warp_Occupancy` fraction in 0–1. Same absence rule as instructions. */
  warpOccupancy?: number;
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

/** Producer `pc_sampling` names the PC key `address` (decimal INTEGER); sample DBs use `pc_offset`. */
const PC_COLUMNS = ['pc_offset', 'address'] as const;

type StallField = (typeof STALL_COLUMNS)[number][1];

type SqlJsApi = {
  Database: new (data?: ArrayLike<number> | null) => {
    exec: (sql: string) => { columns: string[]; values: SqlValue[][] }[];
    close: () => void;
  };
};

export type InitSqlJs = (config?: {
  wasmBinary?: ArrayBuffer | Uint8Array;
  locateFile?: (file: string) => string;
}) => Promise<SqlJsApi>;

let sqlFactory: InitSqlJs | null = null;
let wasmBinary: Uint8Array | undefined;
let locateFile: ((file: string) => string) | undefined;
let sqlApi: SqlJsApi | null = null;
let sqlReady: Promise<void> | null = null;

/**
 * Inject sql.js init + WASM bytes / locateFile.
 * Browser hosts: serve wasm (playground: `/sqljs/sql-wasm.wasm`) or pass `wasmBinary`.
 * Node tests: pass `wasmBinary` from `sql.js/dist/sql-wasm.wasm`.
 */
export function configurePcSamplingSql(opts: {
  initSqlJs?: InitSqlJs;
  wasmBinary?: Uint8Array;
  locateFile?: (file: string) => string;
}): void {
  if (opts.initSqlJs) sqlFactory = opts.initSqlJs;
  if (opts.wasmBinary) wasmBinary = opts.wasmBinary;
  if (opts.locateFile) locateFile = opts.locateFile;
  sqlApi = null;
  sqlReady = null;
}

export function isPcSamplingSqlReady(): boolean {
  return sqlApi != null;
}

/** Browser default path after `sync:demo-fixtures`. */
export const SQL_WASM_PUBLIC_PATH = '/sqljs/sql-wasm.wasm';

async function loadSqlFactory(): Promise<InitSqlJs> {
  if (sqlFactory) return sqlFactory;
  const mod = await import('sql.js');
  return mod.default as InitSqlJs;
}

async function resolveWasmBinary(): Promise<Uint8Array | undefined> {
  if (wasmBinary) return wasmBinary;
  // Browser / playground: fetch the synced public wasm. Node tests inject via
  // configurePcSamplingSql (see tests/helpers/sqlJsNode.ts) — keep node: out of the lib.
  if (typeof fetch === 'function') {
    try {
      const res = await fetch(SQL_WASM_PUBLIC_PATH);
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
    } catch {
      // Host must configurePcSamplingSql({ wasmBinary | locateFile }).
    }
  }
  return undefined;
}

/** Load sql.js WASM once so sync `summary.db` reads can run during adapt. */
export async function ensurePcSamplingSql(): Promise<void> {
  if (sqlApi) return;
  if (!sqlReady) {
    sqlReady = (async () => {
      const initSqlJs = await loadSqlFactory();
      const wasm = await resolveWasmBinary();
      const config: {
        wasmBinary?: Uint8Array;
        locateFile?: (file: string) => string;
      } = {};
      if (wasm) config.wasmBinary = wasm;
      if (locateFile) config.locateFile = locateFile;
      else if (!wasm && typeof document !== 'undefined') {
        // Browser-only fallback when wasm was not fetched (playground sync path).
        config.locateFile = (file) => `${SQL_WASM_PUBLIC_PATH.replace(/[^/]+$/, '')}${file}`;
      }
      if (!wasm && !config.locateFile) {
        throw new Error(
          '[profiling-report] sql.js wasm not found; call configurePcSamplingSql({ wasmBinary | locateFile }) or serve /sqljs/sql-wasm.wasm',
        );
      }
      sqlApi = await initSqlJs(config);
    })();
  }
  const pending = sqlReady;
  try {
    await pending;
  } catch (cause) {
    // Retry next ensure, but do not clear a newer in-flight init started after this one failed.
    if (sqlReady === pending) sqlReady = null;
    throw cause;
  }
}

/** Present number, including 0. NULL, blank, and non-numeric cells stay absent. */
function optionalNum(v: SqlValue | undefined): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function num(v: SqlValue | undefined): number {
  return optionalNum(v) ?? 0;
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

type SqlDb = InstanceType<SqlJsApi['Database']>;

/** Quote a sqlite_master table name for use as an identifier. */
function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

/**
 * Resolve the PC sampling table. Producers ship either `pc_sampling` (fixtures)
 * or `PcSampling` (some packs); they are distinct names, not case variants.
 * Prefer snake_case when both somehow exist.
 */
function resolvePcSamplingTable(db: SqlDb): string {
  const found = db.exec(
    `SELECT name FROM sqlite_master WHERE type='table' AND lower(name) IN ('pc_sampling', 'pcsampling')`,
  );
  const names = (found[0]?.values ?? []).map((row) => String(row[0] ?? '')).filter(Boolean);
  if (!names.length) {
    throw new Error(
      '[profiling-report] summary.db has no pc_sampling / PcSampling table',
    );
  }
  return names.find((n) => n.toLowerCase() === 'pc_sampling') ?? names[0]!;
}

function rowsFromDb(bytes: Uint8Array, api: SqlJsApi): PcSamplingRow[] {
  const db = new api.Database(bytes);
  try {
    const tableName = resolvePcSamplingTable(db);
    const result = db.exec(`SELECT * FROM ${quoteIdent(tableName)}`);
    if (!result.length) return [];
    const table = result[0]!;
    const idx = Object.fromEntries(table.columns.map((c, i) => [c.toLowerCase(), i]));
    const pcIdx = PC_COLUMNS.map((col) => idx[col]).find((i) => i != null);
    const required = [
      ...(pcIdx == null ? ['pc_offset'] : []),
      ...STALL_COLUMNS.map(([sql]) => sql),
    ];
    const missing = required.filter((name) => idx[name.toLowerCase()] == null);
    if (missing.length) {
      throw new Error(
        `[profiling-report] ${tableName} missing columns: ${missing.join(', ')}`,
      );
    }
    const instrIdx = idx.instructions_executed;
    const warpIdx = idx.warp_occupancy;
    return table.values.map((row) => {
      const fields = {} as Record<StallField, number>;
      for (const [sqlCol, field] of STALL_COLUMNS) {
        fields[field] = num(row[idx[sqlCol.toLowerCase()]!]);
      }
      const { samplingStall, stallBreakdown } = breakdown(fields);
      const extra: Pick<PcSamplingRow, 'instructionsExecuted' | 'warpOccupancy'> = {};
      if (instrIdx != null) extra.instructionsExecuted = num(row[instrIdx]);
      if (warpIdx != null) {
        const occ = optionalNum(row[warpIdx]);
        if (occ != null) extra.warpOccupancy = occ;
      }
      const pcValue = row[pcIdx!];
      return {
        pcOffset:
          typeof pcValue === 'number'
            ? `0x${Math.round(pcValue).toString(16)}`
            : String(pcValue ?? ''),
        ...fields,
        samplingStall,
        stallBreakdown,
        ...extra,
      };
    }).sort((a, b) => (Number(a.pcOffset) || 0) - (Number(b.pcOffset) || 0));
  } finally {
    db.close();
  }
}

/**
 * Sync read — call only after `ensurePcSamplingSql()`.
 * Used by the sync adapt path when `summary.db` is in the pack.
 */
export function readPcSamplingDbSync(bytes: Uint8Array): PcSamplingRow[] {
  if (!sqlApi) {
    throw new Error(
      '[profiling-report] readPcSamplingDbSync: await ensurePcSamplingSql() first',
    );
  }
  return rowsFromDb(bytes, sqlApi);
}

/** Read compute-profile `summary.db` → `pc_sampling` / `PcSampling` rows (warms sql.js if needed). */
export async function readPcSamplingDb(bytes: Uint8Array): Promise<PcSamplingRow[]> {
  await ensurePcSamplingSql();
  return readPcSamplingDbSync(bytes);
}
