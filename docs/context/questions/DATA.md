# DATA questions

Open **DATA** questions (file/field/formula data mapping). Status enum, prefix taxonomy, and migration map: [README.md](README.md).

## Roofline sub-questions — aliases of DATA-37

The seven **DATA-11…DATA-17** rows below are the granular roofline questions from the HQ/`Q11` batch. They keep permanent ids of their own, but carry the **same status as the [DATA-37](#data-37--roofline-formulas-was-q11) umbrella** and share its findings — ask Product for them together.

### DATA-11 — Roofline axes vs pipe busy rates

<img src="../visual/questions/data-11.png" alt="DATA-11 Roofline chart — not pipe busy rates" width="900" height="655">

**Status:** `open` + `interim` — alias of [DATA-37](#data-37--roofline-formulas-was-q11).

**Question:** The Roofline chart plots **X = Ops/Byte** (arithmetic intensity) and **Y = TOps/s** (achieved performance). The producer doc's Roofline table instead points its three tab labels at **pipe busy rates** — `aic_cube_ratio`, `aic_mte2_ratio`, `aic_mte1_ratio` (`PipeUtilization.csv`). Busy-rate ratios cannot produce either axis, so: what are the real axis quantities, and are the tabs meant to be axes at all, or three separate bottleneck panels?

### DATA-12 — X axis Ops/Byte

<img src="../visual/questions/data-12.png" alt="DATA-12 X axis Ops/Byte" width="900" height="655">

**Status:** `open` + `interim` — alias of [DATA-37](#data-37--roofline-formulas-was-q11).

**Question:** **X axis = Ops/Byte** — which file, field(s), and formula? Does the **GM** point use the same formula and byte source as the **L2** point, or different ones? (Interim [DATA-37b](../decisions/interim/DATA.md): `fops ÷ ((read_main_memory_datas(KB) + write_main_memory_datas(KB)) × 1024)`.)

### DATA-13 — Y axis TOps/s

<img src="../visual/questions/data-13.png" alt="DATA-13 Y axis TOps/s" width="900" height="655">

**Status:** `open` + `interim` — alias of [DATA-37](#data-37--roofline-formulas-was-q11).

**Question:** **Y axis = TOps/s** — which file, field(s), and formula? Raw FLOPS *counts* exist (`aiv_vec_fops`, `aic_cube_fops` on `ArithmeticUtilization.csv`) but there is no documented TOps/s conversion. Is it a per-side (Cube \| Vector) value or one combined number? (Interim [DATA-37a](../decisions/interim/DATA.md): `fops ÷ mean(*_time(us)) ÷ 1e6`.)

### DATA-14 — roof lines

<img src="../visual/questions/data-14.png" alt="DATA-14 roof lines" width="900" height="655">

**Status:** `open` + `interim` — alias of [DATA-37](#data-37--roofline-formulas-was-q11).

**Question:** The two **roof lines** — the bandwidth slope and the compute plateau — which file and fields? Peak compute ([DATA-3](../decisions/DATA.md): `aic/aiv_flops_theoretical`) and peak BW ([DATA-5](../decisions/DATA.md): `aicore_gm_bw_theoretical(GB/s)` = SOL **1600 GB/s**) are documented for the summary cards; nothing states whether the roofline roof reuses those values, or which one applies to which side.

### DATA-15 — L2 bytes

<img src="../visual/questions/data-15.png" alt="DATA-15 L2 legend series" width="900" height="655">

**Status:** `open` + `interim` — alias of [DATA-37](#data-37--roofline-formulas-was-q11).

**Question:** The chart legend has an **L2** series alongside GM, and the L2 point needs **bytes moved through L2**. Which field? `L2Cache.csv` carries hit/miss **counts** and hit **rates** only — no byte traffic. If no byte field exists, should the L2 series be dropped, or taken from another file? (Interim [DATA-37c](../decisions/interim/DATA.md): omit the L2 point.)

### DATA-16 — Vec_FP32 / Vec_MISC mix labels

<img src="../visual/questions/data-16.png" alt="DATA-16 Vec_FP32 / Vec_MISC mix" width="900" height="655">

**Status:** `open` + `interim` — alias of [DATA-37](#data-37--roofline-formulas-was-q11).

**Question:** The op-mix annotation above the plot prints labels such as `Vec_FP32` / `Vec_MISC`. Which file and fields feed them on **Cube vs Vector** ops, and when several mix ratios are non-zero at once, **which labels are shown, in what order, and with how much precision?**

**Answer so far:** Fields exist in `ArithmeticUtilization.csv` — `aiv_vec_{fp32,fp16,int32,int16,misc}_ratio`. The producer dictionary uses *different* names (`aiv_vec_{vf,sfu,simt_vf}_ratio`). The "which to show when many are non-zero" rule is undocumented.

### DATA-17 — Roofline tabs

<img src="../visual/questions/data-17.png" alt="DATA-17 Roofline tabs" width="900" height="655">

**Status:** `open` + `interim` — alias of [DATA-37](#data-37--roofline-formulas-was-q11).

**Question:** Tabs **内存单元** / **内存通路** / **搬运单元** — what does each tab show, and is the tab set in scope at all this iteration (or should the panel stay single-chart)?

**Answer so far:** The producer doc maps 内存单元→`aic_cube_ratio`, 内存通路→`aic_mte2_ratio`, 搬运单元→`aic_mte1_ratio` (all `PipeUtilization.csv`) — the pipe-busy-rate mapping [DATA-11](#data-11--roofline-axes-vs-pipe-busy-rates) flags as wrong. No Product answer. (Interim [DATA-37f](../decisions/interim/DATA.md): hide the tabs.)

### DATA-31 — authoritative MVP fixture shape (was: Q4)

**Status:** `partial`

**Question:** Which fixture is authoritative for acceptance — the sketch-faithful Gantt (Card → Core → pipe hierarchy), or the flat AIV sample? Is there a golden report file Product will designate, and which properties must match (lane tree, values, chrome) versus which are pixel-cosmetic?

**Answer so far:** Product target = sketch-like Gantt (A). **CI fixture** = `out.rep` until golden — [`DATA-31a`](../decisions/interim/DATA.md).

### DATA-36 — dependencies encoding (was: Q9)

**Status:** `open` + `interim`

**Question:** How does the producer encode the dependency edges between timeline events — which Chrome Trace `args` keys, successor lists or predecessor lists, and how are ids made addressable? Are edges within one lane only, or also cross-lane?

**Interim:** [`DATA-36a`](../decisions/interim/DATA.md) successor-list encoding via Chrome Trace `args`.

### DATA-37 — roofline formulas (was: Q11)

**Status:** `open` + `interim`

**Release impact:** none this iteration — the Roofline card is **not in the current release**. It renders only for a host that opts in with the `roofline` capability ([FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md)), so these questions block the Phase 2 card, not the current one. The same applies to the DATA-11…DATA-17 aliases below.

**Question:** Which file, field, and formula feeds **each element of the Roofline chart** — X axis (Ops/Byte), Y axis (TOps/s), the GM and L2 measured points, the two roof lines (peak bandwidth + peak compute), the op-mix labels, and the 内存单元 / 内存通路 / 搬运单元 tabs? The producer docs describe the chart's *purpose* but supply no formulas, so all seven sub-questions below are open and should be answered together.

Umbrella for the granular HQ twins retained as aliases: [DATA-11](#data-11--roofline-axes-vs-pipe-busy-rates) (axes vs pipe busy rates), [DATA-12](#data-12--x-axis-opsbyte) (X Ops/Byte), [DATA-13](#data-13--y-axis-topss) (Y TOps/s), [DATA-14](#data-14--roof-lines) (roof peaks), [DATA-15](#data-15--l2-bytes) (L2 bytes), [DATA-16](#data-16--vec_fp32--vec_misc-mix-labels) (mix labels), [DATA-17](#data-17--roofline-tabs) (tabs).

**Known so far (docs checked 2026-09-10):**

- **Axes (DATA-11–13):** not documented. NPU-Compute.md Q11–Q13 have no Product answer; the docx tab→field table (`aic_cube_ratio` / `aic_mte2_ratio` / `aic_mte1_ratio`, `PipeUtilization.csv`) is pipe busy rates, not axes.
- **Roof (DATA-14):** peak compute formulas *do* exist in NPU-Compute.md Q3 (`aic/aiv_flops_theoretical`) and peak BW = `aicore_gm_bw_theoretical` (SOL **1600 GB/s**, Q5), but the docs never wire them to the roofline roof.
- **L2 bytes (DATA-15):** absent — `L2Cache.csv` has hit/miss counts and hit *rates* only.
- **Mix (DATA-16):** fields exist in `ArithmeticUtilization.csv` (`aiv_vec_{fp32,fp16,int32,int16,misc}_ratio`); the docx dictionary uses `aiv_vec_{vf,sfu,simt_vf}_ratio`. The "which to show when many are non-zero" rule is undocumented.
- **Tabs (DATA-17):** docx maps 内存单元/内存通路/搬运单元 to the pipe ratios above — the mapping DATA-11 flags as wrong; no Product answer.

**Interim:** [`DATA-37a…DATA-37f`](../decisions/interim/DATA.md).

### DATA-41 — AIC-row link values and the L0C 理论值

<img src="../visual/questions/data-41.png" alt="DATA-41 AIC-row link values" width="900" height="900">

**Status:** `partial` — the field half is answered; only the fixture validation (b), and with it a sketch-ward check of the AIC row, remains.

**Question:** The **AIC row** of the memory diagram (L1 ↔ L0A / L0B ↔ Cube ↔ L0C) carries values in the sketch, and the chrome has a plate for all seven of its plated links — `l2-l1-read`, `l1-l0a`, `l1-l0b`, `l0a-cube`, `l0b-cube`, `cube-l0c`, `l0c-cube` — but on the product fixture [`sample.lite.rep`](../../../data/sample.lite.rep) six of the seven paint **blank**: every `MemoryL0.csv` `aic_l0*_bw(GB/s)` column is `NA` in every block of both embedded ops, and "hide `NA`" then hides the labels. (The seventh, `l2-l1-read`, now carries the producer's `GM -> UB` field — [DATA-43](../decisions/DATA.md).) So: **(a)** which file and field is authoritative for each AIC-row plated link, and **(b)** is a fixture with non-`NA` AIC-row values available, so the row can be validated against the sketch? **Inherited from [DATA-20](../decisions/DATA.md):** for the slotless edges that carry a **理论值** — L0C → L1 and L0C → L2/GM ([DATA-24](../decisions/DATA.md) / [DATA-25](../decisions/DATA.md)) — which field holds the 理论值, and what is the edge's **100% reference**? The producer doc's 理论值 column is empty for every row.

**Answer so far (2026-09-15, from the producer's DATA-39 "Memory" table):**

- **(a) AIC-row fields — answered for six of the seven plates here, and for the seventh in the next bullet; all six are the fields already shipped.** The producer numbers the AIC row's slots `25`–`30` and maps each to exactly the field `EDGE_MAP` already uses: `25` L1 → L0A = `aic_l0a_read_bw(GB/s)`, `26` L1 → L0B = `aic_l0b_read_bw(GB/s)`, `27` L0A 写入其他单元 = `aic_l0a_write_bw(GB/s)`, `28` L0B 写入其他单元 = `aic_l0b_write_bw(GB/s)`, `29` Cube → L0C = `aic_l0c_write_bw_cube(GB/s)`, `30` L0C → Cube = `aic_l0c_read_bw_cube(GB/s)` — all `Summary.jsonl` → `MemoryL0`. (Rows `21`/`22` restate the Cube ↔ L0C pair, with the two directions swapped against rows `29`/`30` — [DATA-44](DATA.md).) The numbers were placed against the producer's own annotated figure, where `25`–`30` sit at exactly our `l1-l0a` … `l0c-cube` slot coordinates.
- **The `l2-l1-read` plate follows the producer's field (resolved 2026-09-15).** Row `24` labels the corridor plate at `(159.7, 235.5)` — our `l2-l1-read` slot, drawn `L2 → MTE2 → L1 (AIC)` — as **`GM -> UB`**, field **`aiv_gm_to_ub_bw(GB/s)`** from `Memory` (the same field [DATA-23](../decisions/DATA.md) gives the `l2-ub` plates). Product ruled to use that field, painted on the chrome's own slot ("display it according to svg spec"), so that plate reads `aiv_gm_to_ub_bw` and `aic_l1_read_bw` feeds no plate — it stays a Memory.csv 详情 column ([DATA-43](../decisions/DATA.md)). **(a) is now answered for all seven plates.**
- **The 理论值 has no field.** Row `23` — `L0C -> UB + L0C->L1` — is `NA` / `NA`, so the producer defines no 理论值 column for **L0C → L1** or **L0C → L2/GM**: the two slotless KB edges ([DATA-24](../decisions/DATA.md) / [DATA-25](../decisions/DATA.md)) keep their `*_datas(KB)` volume and get no 100% reference. That closes the part inherited from [DATA-20](../decisions/DATA.md).
- **(b) is still open:** no fixture with non-`NA` `MemoryL0.csv` values (`aic_l0a_read_bw` / `aic_l0b_read_bw` / `aic_l0a_write_bw` / `aic_l0b_write_bw` / `aic_l0c_read_bw_cube` / `aic_l0c_write_bw_cube`) has been offered, so the six L0/Cube plates still cannot be validated against the sketch. The corridor plate's field is settled and covered by `PR-VM-024`.

**Roots / evidence:** `EDGE_MAP` in [memoryTopology.ts](../../../src/adapters/memoryTopology.ts); the edge table in [VIEW_DATA_MAPPING §11.2.6](../../ui/VIEW_DATA_MAPPING.md); the AIC-row plates of the exported chrome ([memory-topology.svg](../../../src/ui/StatsAside/MemoryTopologyPanel/memory-topology.svg)); the sketch's AIC row in [`v930/report-stats-scrolled.jpeg`](../../ui/source/v930/report-stats-scrolled.jpeg); the producer's numbered figure `npu-compute/Questions/DATA questions/图片和附件/image 5.png` (OCR-matched slot by slot).

**Specs when answered:** [MemoryTopologyPanel.spec.md](../../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md), [view-models.spec.md](../../../specs/core/view-models.spec.md), [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md), [INPUT_FORMATS](../../formats/INPUT_FORMATS.md).

### DATA-44 — the DATA-39 table's Cube↔L0C direction slip

**Status:** `open`

**Question:** The producer's DATA-39 "Memory" table names the Cube ↔ L0C pair **twice, with the two directions swapped**: row `21` `L0C -> Cube` = `aic_l0c_write_bw_cube(GB/s)` and row `22` `Cube->L0C` = `aic_l0c_read_bw_cube(GB/s)`, while rows `29` `Cube -> L0C` and `30` `L0C -> Cube` give the same two fields the opposite way round. Both pairs cannot be right, and the choice decides two shipped plates (`cube-l0c` and `l0c-cube`). Which pair is authoritative for the **direction** — rows `29`/`30`, or rows `21`/`22`?

**Answer so far:** None from the producer. The shipped mapping follows **rows `29`/`30`**, on three grounds: the `*_write_bw_cube` suffix says the transfer is *into* L0C (Cube → L0C) and `*_read_bw_cube` *out of* it (L0C → Cube), which is exactly how [INPUT_FORMATS §3.5](../../formats/INPUT_FORMATS.md) reads the suffix rule; rows `29`/`30` are the numbered continuation of the AIC row's `25`–`28` slot list, which places them on the correct plate coordinates; and the same two rows are what [DATA-41](DATA.md) confirms 1:1 against the chrome's slots. Rows `21`/`22` look like a duplicate of the pair with the direction labels reversed, in the same table that already carries the (now resolved) row `24` and row `32` slips ([DATA-43](../decisions/DATA.md)). No behaviour changes while it is open.

**Roots / evidence:** the producer's `DATA questions` doc § DATA-39 "Memory", rows `21`/`22` against rows `29`/`30`, and its numbered figure `npu-compute/Questions/DATA questions/图片和附件/image 5.png`; `EDGE_MAP` in [memoryTopology.ts](../../../src/adapters/memoryTopology.ts) (`cube-l0c` → `aic_l0c_write_bw_cube`, `l0c-cube` → `aic_l0c_read_bw_cube`); the `**Value slots**` table of [MemoryTopologyPanel.spec.md](../../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md).

**Specs when answered:** [MemoryTopologyPanel.spec.md](../../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md), [view-models.spec.md](../../../specs/core/view-models.spec.md), [VIEW_DATA_MAPPING](../../ui/VIEW_DATA_MAPPING.md), [INPUT_FORMATS](../../formats/INPUT_FORMATS.md).
