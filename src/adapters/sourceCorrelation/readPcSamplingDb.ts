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

/**
 * Stall counter columns. The first spelling is what the CANN producer
 * (`libnpu_compute_processor.so`) writes in the gather_2d.2 `PcSampling` table
 * and is the source of truth; the second is the older fixture spelling. Names
 * are exact DB names, case preserved — no case folding.
 */
const STALL_COLUMNS = [
  { sql: ['ibuf_empty', 'IBuf_Empty'], field: 'ibufEmpty', label: 'IBuf Empty' },
  { sql: ['nop_cycles', 'Nop_Cycles'], field: 'nopCycles', label: 'Nop Cycles' },
  {
    sql: ['scoreboard_not_ready', 'Scoreboard_Not_Ready'],
    field: 'scoreboardNotReady',
    label: 'Scoreboard Not Ready',
  },
  {
    sql: ['register_bank_conflict', 'Register_bank_conflict'],
    field: 'registerBankConflict',
    label: 'Register Bank Conflict',
  },
  {
    sql: ['resource_conflict', 'Resource_conflict'],
    field: 'resourceConflict',
    label: 'Resource Conflict',
  },
  {
    sql: ['warp_level_sync', 'Warp_Level_Sync'],
    field: 'warpLevelSync',
    label: 'Warp Level Sync',
  },
  {
    sql: ['divergence_stack_spill', 'Divergence_Stack_Spill'],
    field: 'divergenceStackSpill',
    label: 'Divergence Stack Spill',
  },
  { sql: ['others', 'Others'], field: 'others', label: 'Others' },
] as const;

type StallField = (typeof STALL_COLUMNS)[number]['field'];

/**
 * PC column spellings. The gather_2d.2 `PcSampling` table has `address`
 * (decimal INTEGER); older fixtures use `pc_offset` (TEXT hex). Exact names
 * only.
 */
const PC_COLUMNS = ['address', 'pc_offset'] as const;

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
  const samplingStall = STALL_COLUMNS.reduce((sum, col) => sum + values[col.field], 0);
  const stallBreakdown: SourceStallBreakdown[] = STALL_COLUMNS.map((col) => {
    const value = values[col.field];
    return {
      metric: col.label,
      value,
      percent: samplingStall > 0 ? (value / samplingStall) * 100 : 0,
    };
  }).filter((row) => row.value > 0);
  return { samplingStall, stallBreakdown };
}

/** Largest valid PC address; anything above it is garbage packed into the cell. */
const MAX_PC = 2 ** 48;

/**
 * Format a PC cell for display: `0x…` hex for a valid address, `''` otherwise.
 * Valid means a non-negative integer no larger than `MAX_PC`. Decimal INTEGER
 * and TEXT (`0x…` or decimal) take the same rule.
 */
function pcValue(v: SqlValue | undefined): string {
  let n = Number.NaN;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string') {
    const text = v.trim();
    if (/^0x[0-9a-f]+$/i.test(text)) n = Number.parseInt(text.slice(2), 16);
    else if (/^\d+$/.test(text)) n = Number(text);
  }
  if (!Number.isInteger(n) || n < 0 || n > MAX_PC) return '';
  return `0x${n.toString(16)}`;
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
    // Exact column names from the DB are the source of truth. Each logical
    // field lists the producer spelling first, then the older fixture spelling.
    const colIndex = new Map(table.columns.map((c, i) => [c, i] as const));
    const get = (names: readonly string[]): number | undefined => {
      for (const name of names) {
        const i = colIndex.get(name);
        if (i != null) return i;
      }
      return undefined;
    };

    const pcIdx = get(PC_COLUMNS);
    if (pcIdx == null) {
      throw new Error(
        `[profiling-report] ${tableName} missing PC column: ${PC_COLUMNS.join(' / ')}`,
      );
    }
    const missing = STALL_COLUMNS.filter((col) => get(col.sql) == null).map((col) =>
      col.sql.join(' / '),
    );
    // A partly packed table still carries usable counters: fill the absent ones
    // with 0. Only a table with no counter at all is unreadable.
    if (missing.length === STALL_COLUMNS.length) {
      throw new Error(
        `[profiling-report] ${tableName} missing columns: ${missing.join(', ')}`,
      );
    }
    const instrIdx = colIndex.get('Instructions_Executed');
    const warpIdx = colIndex.get('Warp_Occupancy');
    const rows: PcSamplingRow[] = [];
    let skipped = 0;
    for (const row of table.values) {
      const pcOffset = pcValue(row[pcIdx]);
      if (!pcOffset) {
        skipped += 1;
        continue;
      }
      const fields = {} as Record<StallField, number>;
      for (const col of STALL_COLUMNS) {
        const i = get(col.sql);
        fields[col.field] = i == null ? 0 : num(row[i]);
      }
      const { samplingStall, stallBreakdown } = breakdown(fields);
      const extra: Pick<PcSamplingRow, 'instructionsExecuted' | 'warpOccupancy'> = {};
      if (instrIdx != null) extra.instructionsExecuted = num(row[instrIdx]);
      if (warpIdx != null) {
        const occ = optionalNum(row[warpIdx]);
        if (occ != null) extra.warpOccupancy = occ;
      }
      rows.push({
        pcOffset,
        ...fields,
        samplingStall,
        stallBreakdown,
        ...extra,
      });
    }
    if (missing.length || skipped) {
      const notes = [
        missing.length ? `missing columns: ${missing.join(', ')} (filled with 0)` : '',
        skipped ? `skipped ${skipped} rows with invalid address` : '',
      ].filter(Boolean);
      console.warn(`[profiling-report] ${tableName}: ${notes.join('; ')}`);
    }
    // DB order (`SELECT *` without ORDER BY); callers sort nothing.
    return rows;
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
