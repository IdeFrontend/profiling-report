# PC Sampling shows 0 — issue and fix guide

Purpose: document the root causes and the recommended fix so another LLM/dev can
implement it. This is a guide, not a record of an applied change.

Scope: `src/adapters/sourceCorrelation/readPcSamplingDb.ts` (defects #2 and #3)
and `adaptComputeSourceCorrelation.ts` / `parseSymbolizer.ts` (defect #4).
Defect #1 (VSIX WASM packaging) is a host-side concern and is only noted in the
appendix.

Guiding principle: **the column names written by the CANN producer are the
source of truth.** Map those exact names to the UI fields; do not invent
case-insensitive matching. The older fixture spellings can be kept as a
secondary exact match only.

## Symptom

Loading a packed report whose `summary.db` was produced by the real CANN
collector (e.g. `data/gather_2d/report_1793947058370_be5ebbbe.npu-rep`) shows
**0** for all sampled/stall data on the Source tab. On the deployed web app
(https://profiling-report.vercel.app — where sql.js WASM loads fine) the console
shows:

```
[profiling-report] ignoring summary.db: [profiling-report] PcSampling missing columns:
pc_offset, IBuf_Empty, Nop_Cycles, Scoreboard_Not_Ready, Register_bank_conflict,
Resource_conflict, Warp_Level_Sync, Divergence_Stack_Spill, Others
```

The report still loads (the error is caught in
`adaptComputeSourceCorrelation`), but `Sampling Stall`, the per-line stall
breakdown, and the PC-sampling tooltip are all zero.

**The key defects in the web app are #2 (column names) and #3 (decimal vs hex
address).** WASM loading is *not* the blocker there — the fact that the
"missing columns" error is reached proves sql.js initialized. Defect #1 (WASM
packaging) only affects the VSIX/Webview build and is kept as an appendix.

After #2 and #3 are fixed, the **assembly pane** is correct (e.g.
`0x198 → 8`, `0x268 → 18632`), but the **source pane** can still be all 0. That
is a separate defect (#4): source-line attribution depends on
`symbolizer.json` line numbers, which the producer may ship as `0`.

---

## Defect 1 (VSIX only, not the web app) — sql.js WASM not reachable from the Webview

Customer report (point 1): the VSIX contains the `sql-wasm-browser` JS loader but
**not** the `.wasm` binary. The loader tries `/sqljs/sql-wasm.wasm` and
`/sqljs/sql-wasm-browser.wasm`; both 404 inside the Webview. Source/assembly
still render, but `summary.db` is skipped and sampled values show 0.

This does **not** apply to the Vercel web deployment, where the wasm is served
and `summary.db` is read (hence the column error below is reached). It is still
worth fixing for the packaged VSIX.

Relevant code — `src/adapters/sourceCorrelation/readPcSamplingDb.ts`:

- `SQL_WASM_PUBLIC_PATH = '/sqljs/sql-wasm.wasm'`
- `resolveWasmBinary()` does `fetch(SQL_WASM_PUBLIC_PATH)` and silently returns
  `undefined` on failure.
- `ensurePcSamplingSql()` then either uses `locateFile` (browser fallback) or
  throws `sql.js wasm not found`.
- `ProfilingReport.vue` (~line 1010) wraps `ensurePcSamplingSql()` in
  best-effort `try/catch`, so a failure only logs a warning.

**Probable fix (VSIX packaging only)**

- Ship `sql-wasm.wasm` inside the plugin package and load it from a
  Webview-reachable URI (e.g. `webview.asWebviewUri(...)`), or pass the bytes in
  via `configurePcSamplingSql({ wasmBinary })`.
- Prefer injecting `wasmBinary` / a resolving `locateFile` from the host instead
  of `/sqljs/...` absolute HTTP paths that do not exist in a Webview.

---

## Defect 2 — column names / table name do not match what CANN writes

Customer report (point 2): `libnpu_compute_processor.so` writes a `PcSampling`
table with `address` plus lowercase/underscore counters (`ibuf_empty`,
`nop_cycles`, …). The UI requires `pc_offset`, `IBuf_Empty`, … and cannot map
them. Adding WASM and only changing the table name still yields "missing
columns".

This matches our analysis exactly. Two sub-problems:

### 2a. The reader looks up the wrong exact column names

`table.columns` returns the names **as declared** in the DB, and the reader
looked them up by exact JS key. The DB declares `ibuf_empty`, `nop_cycles`, …
(the source of truth); the reader asked for `IBuf_Empty`, `Nop_Cycles`, … so
every stall column was reported "missing".

The fix is an explicit mapping from the producer's exact names to the UI
fields — **not** case-insensitive matching. The producer spelling is primary;
the older fixture spelling is a secondary exact match only.

### 2b. The PC column is `address`, not `pc_offset`

Fixture — `data/gather_2d/summary.db`:

```sql
CREATE TABLE pc_sampling (
  "pc_offset" TEXT PRIMARY KEY NOT NULL,
  "IBuf_Empty" INTEGER NOT NULL,
  "Nop_Cycles" INTEGER NOT NULL,
  ...
  "Others" INTEGER NOT NULL
);
-- pc_offset values are hex strings: '0x198', '0x1b8', ...
```

Producer pack — `data/gather_2d/report_1793947058370_be5ebbbe/summary.db`:

```sql
CREATE TABLE PcSampling(
  address INTEGER NOT NULL PRIMARY KEY,
  ibuf_empty INTEGER NOT NULL CHECK(ibuf_empty>=0),
  nop_cycles INTEGER NOT NULL CHECK(nop_cycles>=0),
  scoreboard_not_ready INTEGER NOT NULL CHECK(scoreboard_not_ready>=0),
  register_bank_conflict INTEGER NOT NULL CHECK(register_bank_conflict>=0),
  resource_conflict INTEGER NOT NULL CHECK(resource_conflict>=0),
  warp_level_sync INTEGER NOT NULL CHECK(warp_level_sync>=0),
  divergence_stack_spill INTEGER NOT NULL CHECK(divergence_stack_spill>=0),
  others INTEGER NOT NULL CHECK(others>=0)
);
-- address values are DECIMAL integers: 408, 440, ..., 616, ...
```

`resolvePcSamplingTable()` already accepts `PcSampling` (case-insensitive
`lower(name)` match), so the table name is fine. The column names are not.

Note: `ORDER BY "pc_offset"` did **not** throw even though the column is absent,
because SQLite treats a double-quoted identifier that matches no column as a
string literal. So the `ORDER BY` silently does nothing; it should be fixed to
use the resolved PC column.

**Probable fix** (all in `readPcSamplingDb.ts`)

1. **Exact-name index** (no case folding) and a first-match helper:

   ```ts
   const colIndex = new Map(table.columns.map((c, i) => [c, i] as const));
   const get = (...names: readonly string[]) =>
     names.map((n) => colIndex.get(n)).find((i) => i != null);
   ```

2. **Map the producer's exact names to UI fields.** Producer spelling first,
   older fixture spelling second:

   ```ts
   const PC_COLUMNS = ['address', 'pc_offset'] as const;
   const STALL_COLUMNS = [
     { sql: ['ibuf_empty', 'IBuf_Empty'], field: 'ibufEmpty', label: 'IBuf Empty' },
     // ... nop_cycles, scoreboard_not_ready, register_bank_conflict, ...
   ] as const;

   const pcIdx = get(...PC_COLUMNS);
   if (pcIdx == null) throw new Error(`... missing PC column (${PC_COLUMNS.join(' / ')})`);
   ```

3. **Drop the hardcoded `ORDER BY "pc_offset"`** (it silently no-ops when the
   column is absent). Sort the mapped rows by numeric PC in JS instead.

4. **Stall lookup / missing check** uses `get(...col.sql)`; a column is missing
   only if none of its exact spellings exist.

5. `Instructions_Executed` / `Warp_Occupancy` remain optional (absent here —
   see DATA-55); use `get('Instructions_Executed')` / `get('Warp_Occupancy')`.

---

## Defect 3 — address is decimal but is read as hexadecimal

Customer report (point 3): CANN stores `address` as an integer, e.g. `408`. The
UI converts it to a string and then `normalizePc` reads it as hex → `0x408`,
but the real assembly address is `0x198` (`408` decimal). `472` similarly
becomes `0x472` instead of `0x1d8`. Nothing correlates, so stalls land on no
line.

Our analysis agrees. `src/adapters/sourceCorrelation/parseObjdump.ts`:

```ts
export function normalizePc(raw: string): string {
  const hex = raw.trim().toLowerCase().replace(/^0x/, '').replace(/^0+(?=[0-9a-f])/, '');
  return `0x${hex || '0'}`;
}
```

It assumes the input is already hex. `readPcSamplingDb.ts` does
`pcOffset: String(row[idx.pc_offset!] ?? '')`, so a numeric `408` becomes the
string `"408"` and is then read as hex → `0x408`. It must be converted to
`0x198` before correlation.

Cross-check: `data/gather_2d/objdump.txt` contains `198:` and `268:`; the DB
rows `408` and `616` decimal correspond to `0x198` and `0x268`.

**Probable fix** — normalize the PC value to a `0x…` hex string in the reader.

Customer's recommendation (clean and reliable): let SQLite do the formatting.

```sql
SELECT printf('0x%x', address) AS pc_offset, * FROM PcSampling ORDER BY address
```

Then the existing `normalizePc` path works unchanged. Caveat: only apply
`printf('0x%x', …)` to the **integer** `address` column. The fixture's
`pc_offset` is already a hex TEXT (`'0x198'`); running `printf('0x%x', …)` on it
would misread `0x198` as decimal. So branch on which PC column was found:

```ts
const pcExpr =
  pcCol === 'address'
    ? `printf('0x%x', ${quoteIdent(actualPcName)})`
    : quoteIdent(actualPcName); // already '0x…' text
```

Alternatively do it in JS, with the same guard:

```ts
function pcValue(v: SqlValue | undefined): string {
  if (typeof v === 'number' && Number.isFinite(v)) return `0x${v.toString(16)}`;
  const s = String(v ?? '').trim();
  if (/^0x/i.test(s)) return s;                              // already hex
  if (/^\d+$/.test(s)) return `0x${Number(s).toString(16)}`; // decimal text
  return s;
}
```

---

## Defect 4 — source pane stays 0 because `symbolizer.json` has no line numbers

This is **separate from `summary.db`**. Both panes use the same stall numbers;
the difference is how they are attributed.

Data flow (`adaptComputeSourceCorrelation.ts`):

- Assembly pane: `stallByPc.get(insn.pc)` → `model.assembly.lines[].values.samplingStall`
  (works once #2/#3 are fixed).
- Source pane: the same value is rolled up per source line via
  `file.stallByLine.set(site.line, …)`, where `site` comes from
  `symbolizer.json`.

`parseSymbolizer.ts` reads `Symbol[0].Line` and treats `<= 0` as `null`. In
`report_1793947058370_be5ebbbe.npu-rep` **every symbolizer entry has
`"Line": 0`** (only `FileName`, `FunctionName`, `StartAddress` are populated).
So no PC maps to a source line, and the source column stays 0 even though the
assembly column is correct.

Also note: this report's `objdump.txt` was produced **without `-l`** (no
`gather_2d.asc:NN` annotations), so lines cannot be recovered from objdump
either. The top-level `data/gather_2d/objdump.txt` does have them; the report's
does not.

**Probable fix (choose one, in order of preference)**

1. **Producer-side:** emit real 1-based `Line` values in `symbolizer.json`.
2. **Fallback in `adaptComputeSourceCorrelation`:** when `site.line == null`,
   map by `FunctionName` to the `.asc` function and attribute to its body lines
   (heuristic; document the ceiling).
3. **Fallback:** parse `file:line` annotations from `objdump.txt` when built
   with `-l` (not available in this report).

Do **not** change the `summary.db` reader for this — it is already correct.

---

## Expected result after fixes #2 and #3 (the web-app fix)

For the producer pack the reader should return 17 rows, e.g.
`address=616` → `pcOffset='0x268'`, `scoreboardNotReady=18360`,
`nopCycles=272`; `address=408` → `pcOffset='0x198'`.
`adaptComputeSourceCorrelation` then matches `0x268` against the objdump
instruction at `268:` and puts 18,632 stall cycles on that **assembly** line.
The **source** line still needs defect #4 (symbolizer line numbers).

## Tests to add / update

`src/adapters/sourceCorrelation/readPcSamplingDb.spec.ts`

- A fixture DB with the producer schema (`PcSampling`, `address` INTEGER,
  lowercase stall columns) must parse without a "missing columns" error.
- Assert decimal `address` is converted to hex (`408` → `'0x198'`,
  `616` → `'0x268'`).
- Keep the existing snake_case `pc_sampling` fixture passing (hex text
  `pc_offset` `'0x198'` must be preserved as-is, not double-converted).
- `adaptComputeSourceCorrelation.spec.ts`: assert a producer-schema DB yields
  non-zero `samplingStall` on the matching instruction PC (assembly pane).
- Defect #4: a symbolizer with `Line: 0` must not be treated as a valid line;
  add a test that a real `Line: N` attributes stall to source line N, and that
  the `Line: 0` fallback path is explicit (function-level or objdump `-l`).

## Customer-report cross-check

| Customer point | Our finding | Match |
|---|---|---|
| 1. WASM not bundled in VSIX; `/sqljs/*.wasm` 404 → summary.db skipped → 0 | `resolveWasmBinary()` swallows fetch failure; `ProfilingReport.vue` only warns | **VSIX only** — not the web app (wasm loads on Vercel; column error is reached) |
| 2. Query `PcSampling`; columns `address`, `ibuf_empty`, … lowercase; UI expects `pc_offset`, `IBuf_Empty` | Same. Fix by exact-name mapping (producer spelling first), not case-insensitive matching | **Match** |
| 3. `address` is decimal integer; UI reads it as hex (`408`→`0x408` vs real `0x198`); use `printf('0x%x', address)` | Same; `normalizePc` assumes hex and `String(row[...])` keeps decimal | **Match** |
| 4. Source pane `Sampling Stall` still 0 after #2/#3 | Assembly pane is correct; source pane needs `symbolizer.json` `Line` values, which are all `0` here | **New** — separate defect #4 |

### Data mismatch to resolve

The customer's dump shows `address 408 → nop_cycles 4` and `address 472 →
nop_cycles 3`. The `summary.db` inside
`report_1793947058370_be5ebbbe.npu-rep` has `408 → nop_cycles 8` and **no row
472**. These are different captures. Reproducing the customer's exact numbers
requires their report/`summary.db`, not the sample in this repo.
