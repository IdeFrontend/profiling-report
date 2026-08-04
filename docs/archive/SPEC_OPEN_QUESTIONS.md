# Spec open questions (product owner)

Prioritized questions to close gaps and contradictions between [INPUT_FORMATS.md](../specs/formats/INPUT_FORMATS.md), [VIEW_DATA_MAPPING.md](../specs/visualization/VIEW_DATA_MAPPING.md), product §11.2 mockups, and the local sample [`data/out.rep`](../../data/out.rep).

**How to answer:** for each item, give the canonical field name(s), file, formula (if derived), and MVP vs later priority.

---

## P0 — Blocks implementation of core views

### Q1. Report container contract

1. Is the shipping format **`npu-rep`** (`NpuRepHead` / `NpuRepFileInfo`) or **`cann-rep` / `rep-file`** (current sample packer)?
2. Exact head/file-info field list, sizes, endianness, and version policy?
3. Report file naming: enforce `report_<timestamp>_<id>.npu-rep`, or accept any `*.rep` / `*.npu-rep`?

### Q2. OP selector semantics

1. Does the OP dropdown list **rows of `OpBasicInfo.csv`**, nested archives inside the container, or something else?
2. After OP selection, do all metric CSVs already contain only that OP’s blocks, or must the viewer filter by OP name / id?

### Q3. Report statistics cards 5–8

For each card, what is **field → file → formula** (including peaks for the progress bars)?

| Card | Needed |
| --- | --- |
| 算力情况 | Score (e.g. 90), measured TFLOPS, peak TFLOPS |
| 输入带宽 | Score, measured TB/s, peak TB/s |
| 输出带宽 | Score, measured TB/s, peak TB/s |
| 平均核利用率 | %, enabled cores / total cores |

Also: secondary text on 整体耗时 (“N 次迭代 / 核”) — source?

### Q4. Report statistics header

1. 核数, aic 频率, NPU ARCH peak — from `HardwareInfo.jsonl`, `OpBasicInfo` (`Current Freq` / `Rated Freq` / `Block Dim`), or elsewhere?
2. Is `HardwareInfo.jsonl` **required** in every report? If missing, hide 更多 or show empty state?

### Q5. Roofline

1. Confirm or correct the tab → field table (内存单元 → `aic_cube_ratio`, etc.). Current mapping looks like pipe ratios, not memory intensity.
2. Formulas for **X (Ops/Byte)** and **Y (TOps/s)** for GM and L2 series.
3. Sources for **roof** peak bandwidth and peak compute.
4. Op-mix label (`Vec_FP32` / `Vec_MISC`) — from `ArithmeticUtilization.csv`? Which columns and aggregation?

### Q6. Pipe occupancy layout

1. One combined bar chart (as in mockup) or separate Cube / Vector sections (as in field tables)?
2. For non-MIX ops (sample `Op Type=vector` with all AIC fields `NA`): show Vector-only, hide Cube, or show NA bars?
3. Absolute number inside each bar (mockup) — which field (`*_time(us)`, cycles, other)?
4. Aggregation across `block_id` rows: mean, max, block 0, selectable block?

---

## P1 — Memory / details completeness

### Q7. Memory edge canon

1. Confirm each edge’s canonical column (including units: GB/s vs KB datas).
2. Resolve **UB → L2 / L2 → UB**: product names `aiv_ub_read_bw_gm` / `aiv_ub_write_bw_gm` on `MemoryUB.csv` vs sample `aiv_ub_to_gm_bw` / `aiv_gm_to_ub_bw` on `Memory.csv`. Which is correct, and do `read`/`write` match the arrow directions?
3. Is **`MemoryL1.csv`** required, or is `Memory.csv` `aic_l1_*_bw` enough for L2↔L1?
4. Close 待确定 edges: L0C→L1, L0C→L2/GM (sample has `L0C_to_*_datas(KB)`), L0C→UB (missing).
5. Dual-Die / Remote memory: show remote edges? Right-click details — yes/no, and which fields?

### Q8. Memory Peak (%) heatmap

1. What metric colors each unit (Cube, L1, UB, …) on the 0–100 Peak legend?
2. Same as pipe ratios, conflict ratios, BW usage rates, or a dedicated field?

### Q9. L2Cache overlay

Which column overlays GM↔L2: `*_read_hit_rate(%)`, `*_write_hit_rate(%)`, or `*_total_hit_rate(%)`? AIC, AIV, or both?

### Q10. Detail panels

1. Pipe / Memory / L2Cache **详情**: dump all CSV columns, or a curated subset (provide the lists)?
2. Event 详情 fields (`Code`, `Detail`, `Pc_addr`, `Process_bytes`, Relevant graph): which file/schema? Sample `trace.json` does not contain them.

---

## P1 — Timeline / statistics

### Q11. Statistical analysis (Cube / Vector tracks)

1. Exact series schema (invalid placeholders in product doc).
2. Time base and sync with Kernel timeline scrubber.
3. File: derived from `trace.json`, a separate JSON, or other?

### Q12. Kernel timeline

1. Canonical event format (Chrome Trace as in sample, or richer Ascend swimlane JSON)?
2. How to build hierarchy Core → Cube/Vec → pipes and row utilization %?
3. Axis unit: ns vs 时钟周期 — switchable? Conversion?
4. Dependency / Relevant edges: which fields define Incoming / Outgoing and edge badges?

### Q13. Supplementary sample files

1. Should the UI consume **`ArithmeticUtilization.csv`** and **`ResourceConflictRatio.csv`**? If yes, which views?
2. If no, can collectors omit them?

---

## P2 — Consistency / packaging

### Q14. Multi-block aggregation policy

Sample has `Block Dim=8` and 8 `block_id` rows in metric CSVs. Default aggregation for every summary widget?

### Q15. Missing / `NA` policy

Unified rules for missing payloads and `NA` cells (hide row, show “NA”, treat as 0)?

### Q16. MVP scope

Which of §11.2.2–11.2.8 are **MVP-required** vs later (especially Roofline, dual-Die, Relevant graph, 源码/缓存 tabs)?

---

## Spec fixes already applied (no PO answer needed)

| Issue | Resolution in repo specs |
| --- | --- |
| `MemoryUB` inventory claimed GM edges | Corrected: Vec/Scalar on `MemoryUB`; GM↔UB via `Memory.csv` in sample |
| Roofline described as implementable from pipe ratios alone | Marked contradictory; blocked pending Q5 |
| Pipe mockup vs Cube/Vector tables | Documented conflict; tables preferred for binding pending Q6 |
| Stats header source ambiguity | Called out pending Q4 |
| Memory Peak % / L2 hit-rate / MemoryL1 | Called out pending Q7–Q9 |
| Dead links to removed source docx | Removed; mockups under `docs/specs/ui/source/` |
