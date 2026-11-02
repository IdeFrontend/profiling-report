# Memory Utilization Heatmap — producer answers

Based on the current local `npu-simulator` implementation. Paths below are relative to `npu-simulator/`. `MemoryHeatmapLayout.csv` and `MemoryHeatmapCells.csv` mean files inside the `.npu-rep` archive. UI recommendations are explicitly distinguished from producer requirements.

Counting SSOT: [memory_heatmap_format.md](npu-simulator/npusim/prof/docs/memory_heatmap_format.md), checked against [memory_heatmap_analyzer.py](npu-simulator/npusim/prof/src/backend/analyzers/david/memory_heatmap_analyzer.py).

## DATA-50

1. **L2 / L2Cache:** `omit / N/A — not for heat UI on this profile`. `src/common/biprof_enum.py → MemoryType →` no defined L2/L2Cache ID or name. The analyzer can emit views for unknown memory IDs as `TYPE_<n>`, but these must not be interpreted as L2. If the product keeps a mandatory L2Cache tab, show a no-data state; do not synthesize a view or zero-capacity measurements.

2. **Multi-core UB:** `MemoryHeatmapLayout.csv + MemoryHeatmapCells.csv → (CoreId, CoreTypeId, MemoryType=1) → one independent view per buffer instance`. Preserve both AIV0 UB and AIV1 UB. **UI selector** is the suitable choice for a single UB tab; the format requires independent views but does not prescribe the selector widget. Do not OR the grids or silently pick a core. Capacity and all derived metrics belong to the selected view. The producer already places cube-origin UB traffic into both UB views and collapses twin reports; the UI must not repeat that operation.

3. **OutsideDeclared:** `MemoryHeatmapLayout.csv → OutsideDeclared, BaseAddress, Width, Height, CellSize → draw the supplied grid and mark/badge the view when OutsideDeclared=1`. Its window already follows observed addresses. Do not independently extend or clip it to DeclaredSize. The shown interval is `[BaseAddress, BaseAddress + Width*Height*CellSize)`. Source: format sections “The grid” and “Drawing a view”, plus analyzer `_window()`.

4. **Cell with data:** `MemoryHeatmapCells.csv → ReadAddresses, WriteAddresses → withData = (ReadAddresses + WriteAddresses > 0)`. No comparison with CellSize or a word-size threshold. Missing cells are untouched. The SSOT defines traffic coverage, **not allocation state or currently resident data**: 已分配有数据 is not a producer-backed allocation classification. For intensity, `value = ReadAddresses + WriteAddresses`, normalized by the selected view's maximum value if nonzero.

5. **MemoryUtilizationStates:** `N/A — not for the §11.2.3.2 spatial lattice or its Total/Used/Free`. For a separate timeline only: `MemoryUtilizationStates.csv → Tick → t_us = Tick * get_tick_to_us_coeff()`. `src/common/utils.py → get_tick_to_us_coeff()` uses `1/(frequency_ghz_map[arch]*1000)` by default: currently V100/Ascend950 is 1.65 GHz, so `Tick/1650` µs. With `biprof_ctx.no_ticks_to_ns`, it uses `Tick/1000` µs. Match the report's configured conversion; do not universally assume 1 tick = 1 ns.

6. **Pack contract:** `src/backend/analyzer_manager.py → david_memory_utilization_analyzers() → --memory-utilization schedules both utilization and heatmap analyzers on the supported V100/Ascend950 branch`. Nonempty successful heatmap analysis exports both CSVs. **The flag alone does not guarantee their presence**: memory/instruction data are required, and no eligible accesses means no views. `manifest.json → row_count, file, error → empty objects have row_count=0 and no file; export failures can carry error`. See `tools/export_csv.py`. `UbRwAccesses → omit as a supported current heatmap fallback`: no producing table/view or heatmap consumer is defined in the current implementation; only stale references in hint comments remain. A historical-pack adapter would need a separately specified legacy contract. Missing Layout/Cells must not silently switch to that interpretation.

7. **Counting SSOT / formula:** use the linked local `memory_heatmap_format.md`; the formulas below can be pasted into the consuming project's contract. This answer does not publish a remote document.

   `MemoryRWAccesses → Size, Step → n = Size if Size>=1 else 1; s = Step if Step>=1 else 1` (missing columns also default to 1).

   For a cell interval `[b, b+C)` and access start `a`:

   - Contiguous (`s=1`): `overlap = max(0, min(a+n, b+C) - max(a,b))`; if overlap is positive, add `ceil(overlap/4)` to that cell's read or write count.
   - Strided (`s>1`): add `count{i | 0<=i<n and b<=a+i*s<b+C}`. Each touched byte counts as one address; skipped bytes do not count.

   Counts accumulate per access and per cell; they are not distinct addresses across the run. Repeated accesses contribute repeatedly, and contiguous rounding occurs separately in each intersected cell. The producer resolves owners and UB twins before accumulating. Consumers paint exported counts rather than recomputing them.

## DATA-51

All formulas below are scoped to the exact selected key `K=(CoreId, CoreTypeId, MemoryType)`. Let `span=Width*Height*CellSize` and `N=count(MemoryHeatmapCells rows for K)`.

1. **Total:** `MemoryHeatmapLayout.csv → DeclaredSize, OutsideDeclared, Width, Height, CellSize → Total = OutsideDeclared ? span : DeclaredSize`. Thus DeclaredSize alone is **not** normative for out-of-declared views. For `DeclaredSize=NULL`, the format does not explicitly define a numeric Total; recommended UI behavior is to show capacity as unavailable and optionally label `span` separately as the observed grid span. Do not turn unknown capacity into zero.

2. **Used:** `MemoryHeatmapCells.csv + MemoryHeatmapLayout.csv → row count for K, CellSize → Used=N*CellSize`. This is touched-cell footprint at grid resolution across the run, not exact touched bytes, allocation, or peak live memory. Do not sum coverage counts or use `max(MemoryUtilizationStates.UtilizedBytes)`.

3. **Free:** `derived from the above → Free=Total-Used`, when Total is known. No reservation-leftover field or separate packed Free field exists in this contract. `Used=20KB, Free=0KB` is consistent only if the corresponding Total is 20KB, subject to display rounding; a sketch does not override the producer formula. For unknown Total, show Free as unavailable.

4. **No Layout:** `omit Total/Used/Free`. No producer-backed capacity formula exists without Layout. Recommended UI: hide the capacity caption or show an explicit no-data state. A distinct ExecInstrId count is an instruction metric and must not occupy a capacity field; if retained elsewhere, label it separately.

5. **Placement:** `N/A — no producer field or normative placement requirement`. The format's “Drawing a view”, step 6, requires communicating total/used/free but does not choose a persistent line or a name-hover tooltip. Recommended product choice: a persistent caption adjacent to the selected grid, keeping its selected owner visible. This is a UI recommendation, not a producer contract.
