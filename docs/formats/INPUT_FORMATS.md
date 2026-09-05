# Input Formats

Clean specification of profiling-report **input container** and **embedded metric files**, derived from product spec §11.2 (可视化界面数据关联) and cross-checked against the local sample [`data/out.rep`](../../data/out.rep) / packer [`data/pack_rep.py`](../../data/pack_rep.py). Mockups: [`docs/ui/source/`](../ui/source/).

Related visualization mappings: [VIEW_DATA_MAPPING.md](../ui/VIEW_DATA_MAPPING.md).

---

## 1. Report container

### 1.1 Naming and entry

| Item | Product intent (docx) | Local sample / packer |
| --- | --- | --- |
| File name pattern | `report_<timestamp>_<rand id>.npu-rep` | `out.rep` (generic `.rep`) |
| Magic / brand | `npu-rep` (`NpuRepHead` / `NpuRepFileInfo`) | `cann-rep` / `rep-file` (`CannRepHead` / `CannRepFileInfo`) |
| Role | Single binary archive of metric CSVs, hardware JSONL, and timeline JSON opened by the viewer | Same layout idea; different magic and struct field names |

Mockup (binary layout):

![npu-rep layout](../ui/source/v930/entry.jpeg)

### 1.2 On-disk layout

```text
[Head]
[FileInfo × fileInfoCount]
[payload bytes for file 1]
…
[payload bytes for file N]
```

Payloads are addressed by absolute byte offsets from the start of the container. Endianness in the local packer: **little-endian**, packed (no padding).

### 1.3 Head (product intent vs local packer)

**Product intent (docx `NpuRepHead`):**

| Field | Type (as shown) | Meaning |
| --- | --- | --- |
| `magic[8]` | `char` | `"npu-rep"` |
| `version` | `uint32_t` | Report version (e.g. 1.0.0) |
| `orgin` | `uint16_t` | Collection origin (spelling as in source diagram) |
| `repHeadLength` | `uint16_t` | Length of the head structure |
| `fileInfoCount` | `uint32_t` | Number of `FileInfo` entries |
| `fileInflLength` | `uint32_t` | Length of the file-info region (spelling as in source) |
| `resv` | `uint32_t` | Reserved / alignment |
| `npuRepLength` | `uint64_t` | Total container length |

**Local packer (`CannRepHead`, 36 bytes)** — concrete instance used by this repo:

| Field | Type | Value / meaning |
| --- | --- | --- |
| `magic[8]` | `char` | `"cann-rep"` (no trailing NUL; 8 chars) |
| `version` | `uint32_t` | `0x00010000` (1.0.0) |
| `fileInfoCount` | `uint32_t` | Number of embedded files |
| `fileLength` | `uint32_t` | Head size (`36`) |
| `repLength` | `uint64_t` | Total file length |
| `offset` | `uint64_t` | Absolute start of payload region (`36 + N×160`) |

### 1.4 File info entry

**Product intent (docx `NpuRepFileInfo`):**

| Field | Type (as shown) | Meaning |
| --- | --- | --- |
| `magic[8]` | `char` | `"npu-rep"` |
| `fileName[128]` | `char` | Embedded file name |
| `type` | `uint16_t` | `raw` / `json` / `csv` / `txt` / `ini` |
| reserved | — | Alignment / reserved |
| `fileLength` | `uint64_t` | Payload byte length |
| `fileRepOffset` | `uint64_t` | Absolute offset of payload |

**Local packer (`CannRepFileInfo`, 160 bytes):**

| Field | Type | Meaning |
| --- | --- | --- |
| `magic[8]` | `char` | `"rep-file"` |
| `name[128]` | `char` | Basename, NUL-padded |
| `type` | `uint16_t` | `0=raw`, `1=csv`, `2=json`, `3=txt`, `4=ini` |
| `origin` | `uint16_t` | `0=default`, `1=profile`, `2=sanitizer` |
| `resv` | `uint32_t` | `0` |
| `length` | `uint64_t` | Payload length |
| `offset` | `uint64_t` | Absolute payload offset |

### 1.5 Parsing rules

1. Validate head magic and version.
2. Read `fileInfoCount` consecutive FileInfo records.
3. For each entry, slice `[offset, offset+length)` and interpret by `type` / extension.
4. Build a name→payload map used by all visualization sections.
5. Missing optional payloads (e.g. `HardwareInfo.jsonl`) disable the dependent drill-down; required metric CSVs for a selected OP should be present for that OP’s views.

### 1.6 Shipped `npu-rep` layout (nested operators)

The product container ships as `npu-rep` (not `cann-rep`). Concrete layout confirmed against `data/example.npu.rep` (two operators):

**Head (36 bytes):**

| Offset | Size | Type | Field | Value |
| --- | --- | --- | --- | --- |
| 0 | 8 | `char[8]` | `magic` | `npu-rep` + NUL |
| 8 | 4 | `uint32` | `version` | `0x00010000` |
| 12 | 2 | `uint16` | `orgin` | `0` |
| 14 | 2 | `uint16` | `repHeadLength` | `36` |
| 16 | 4 | `uint32` | `fileInfoCount` | number of embeds |
| 20 | 4 | `uint32` | `fileInflLength` | `164` (FileInfo stride) |
| 24 | 4 | `uint32` | `resv` | `0` |
| 28 | 8 | `uint64` | `npuRepLength` | total container length |

**FileInfo (164 bytes):**

| Offset | Size | Type | Field |
| --- | --- | --- | --- |
| 0 | 8 | `char[8]` | `magic` (`npu-rep` + NUL) |
| 8 | 128 | `char[128]` | `name` (NUL-padded) |
| 136 | 4 | `uint32` | `type` |
| 140 | 4 | `uint32` | `resv` |
| 144 | 4 | `uint32` | `pad` |
| 148 | 8 | `uint64` | `length` |
| 156 | 8 | `uint64` | `offset` |

**Type enum (npu-rep):**

| Value | Meaning |
| --- | --- |
| 1 | `csv` |
| 2 | `json` / `jsonl` |
| 6 | **nested operator archive** (`.npu.rep`) |

**Operator nesting.** An outer `npu-rep` packs one FileInfo per operator; each payload is itself an `npu-rep` leaf archive containing `trace.json` + metric CSVs (types 1/2). The viewer lists these nested archives in the top-left OP selector and adapts each leaf independently. A container with no `type 6` embeds is treated as a flat single-operator leaf pack.

---

## 2. Payload inventory

### 2.1 Expected by product UI (docx)

| File | Format | Grain | Consumed by |
| --- | --- | --- | --- |
| `OpBasicInfo.csv` | CSV | Operator / task | Report statistics header |
| `HardwareInfo.jsonl` | JSONL | Device / host snapshot | Hardware details |
| `PipeUtilization.csv` | CSV | `block_id` + `sub_block_id` | Roofline tabs, pipe occupancy, pipe details |
| `Memory.csv` | CSV | block / sub-block | Memory load edges (GM/L2/L1) |
| `MemoryL0.csv` | CSV | block / sub-block | L0A/B/C ↔ Cube edges |
| `MemoryUB.csv` | CSV | block / sub-block | UB ↔ Vec / Scalar; GM↔UB product names here, sample fallback `Memory.csv` |
| `L2Cache.csv` | CSV | block / sub-block | L2 hit-rate overlay |
| `MemoryL1.csv` | CSV | (docx mockup annotation only) | L2→L1 path — **not in sample** |
| Timeline / kernel events | (unspecified in tables) | Block / pipe event | Kernel block timeline + event details |

### 2.2 Present in local sample `data/out.rep`

| File | Type | Origin | Notes |
| --- | --- | --- | --- |
| `OpBasicInfo.csv` | csv | default | Matches docx report-stat sources |
| `PipeUtilization.csv` | csv | default | Matches docx pipe / roofline fields |
| `Memory.csv` | csv | default | Includes L1 BW and some L0C datas columns |
| `MemoryL0.csv` | csv | default | L0 bandwidths |
| `MemoryUB.csv` | csv | default | UB↔vector/scalar BW; **no** `aiv_ub_*_bw_gm` columns named in docx |
| `L2Cache.csv` | csv | default | Hit rates |
| `ArithmeticUtilization.csv` | csv | default | **Not mapped in docx tables**; useful for Roofline op-mix labels |
| `ResourceConflictRatio.csv` | csv | default | **Not mapped in docx tables**; supplementary conflict ratios |
| `trace.json` | json | profile | Chrome-trace-like timeline (see §4) |
| `HardwareInfo.jsonl` | — | — | **Absent** |
| `MemoryL1.csv` | — | — | **Absent** (L1 fields live on `Memory.csv` in sample) |

Missing values in metric CSVs are encoded as the literal string `NA`.

---

## 3. Metric CSV schemas

Unless noted, metric rows are keyed by:

| Column | Meaning |
| --- | --- |
| `block_id` | Block index within the kernel grid |
| `sub_block_id` | Sub-block / vector-core lane label (sample uses values like `vector0`) |

Aggregation for summary cards (operator-level) is **not specified** in the docx for fields such as average core utilization; viewers typically aggregate or pick a representative block row.

### 3.1 `OpBasicInfo.csv`

Operator-level (one row per profiled OP in the sample).

| Column | Sample presence | Docx UI use |
| --- | --- | --- |
| `Op Name` | yes | Kernel / OP identity |
| `Op Type` | yes | 算子类型 (`OpType`); MIX triggers Cube/Vector pipe split |
| `Task Duration(us)` | yes | 整体耗时 |
| `Block Dim` | yes | Blocks |
| `Mix Block Dim` | yes | — |
| `Device Id` | yes | — |
| `Pid` | yes | 进程ID (aside meta **进程**) |
| `Current Freq` | yes | Hardware overlay / OpBasicInfo dump; **not** on the v930 header |
| `Rated Freq` | yes | Same as Current Freq — not on the aside shell |

### 3.2 `HardwareInfo.jsonl`

One JSON object per line; discriminated by `"category"`. **Specified in docx; not present in `out.rep`.**

Example categories from the source doc:

```json
{"category":"Host Info","cpu_physical_count":2,"cpu_logical_count":46,"memory_total_size_MB":461897260,"disk_total_size_GB":2879978960}
{"category":"Device Info","npu_count":1,"chip_info":"Ascend 950PR_9599 V100","arch_info":"3510"}
{"category":"CPU Information","control_cpu_count":1,"ai_cpu_count":6,"ai_cpu_frequency_MHZ":1500}
{"category":"AI Core Information","ai_core_count":36,"ai_cube_count":36,"ai_vector_count":72,"ai_core_frequency_MHZ":[100,100]}
{"category":"Memory Information","hbm_total_MB":131072,"hbm_used_MB":5190.55,"hbm_frequency_MHZ":3200}
```

UI also shows host CPU model string (`Cpu Info`) that is **not** in these example lines — treat as an optional host field when available.

### 3.3 `PipeUtilization.csv`

Primary source for pipe occupancy (Cube / Vector) and several Roofline tab fields in the docx.

**Cube-side (AIC) fields used by UI:**

| Field | Used as |
| --- | --- |
| `aic_cube_ratio` | Cube bar / Roofline「内存单元」 |
| `aic_mte2_ratio` | MTE2 / Roofline「内存通路」 |
| `aic_mte1_ratio` | MTE1 / Roofline「搬运单元」 |
| `aic_fixpipe_ratio` | FIXP |
| `aic_scalar_ratio` | Scalar |
| `aic_icache_miss_rate` | ICache Miss |
| `aic_*_time(us)` | Absolute times in details list |
| `aic_total_cycles` | Cycles in details |
| `aic_mte3_*`, `aic_fixpipe_active_bw(GB/s)`, stall times | Details list |

**Vector-side (AIV) fields used by UI:**

| Field | Used as |
| --- | --- |
| `aiv_vec_ratio` | Vector |
| `aiv_mte2_ratio` | MTE2 |
| `aiv_mte3_ratio` | MTE3 |
| `aiv_scalar_ratio` | Scalar |
| `aiv_icache_miss_rate` | ICache Miss |
| `aiv_*_time(us)`, bandwidths, stall times | Details list |

Full sample header also includes dual/single scalar times and wait/stall breakdowns; show in the pipe **详情** key-value list (docx detail table was empty).

### 3.4 `Memory.csv`

GM / L2 / L1 oriented bandwidth and data volumes. Bare `*_read_bw` = leaving the named resource; `*_write_bw` = arriving there (same rule as UB: `ub_read_*` = leaving UB).

| Docx display edge | Docx field | Sample column | Status |
| --- | --- | --- | --- |
| GM → L2 | `ai*_main_mem_read_bw` | `aic_main_mem_read_bw(GB/s)`, `aiv_main_mem_read_bw(GB/s)` | Present; read = leaving GM (`out.rep` 16.89 tracks `gm_to_ub`) |
| GM ← L2 | `ai*_main_mem_write_bw` | `aic_main_mem_write_bw(GB/s)`, `aiv_main_mem_write_bw(GB/s)` | Present; write = arriving at GM (≡ `aiv_ub_to_gm_bw`) |
| L2 → L1 | `aic_l1_read_bw(GB/s)` | `aic_l1_read_bw(GB/s)` | **Confirmed** on `Memory.csv`; no `MemoryL1.csv`; `out.rep` NA |
| L2 ← L1 | `aic_l1_write_bw(GB/s)` | `aic_l1_write_bw(GB/s)` | **Confirmed**; `out.rep` NA |
| L0C → L1 | `L0C_to_L1_datas` | `L0C_to_L1_datas(KB)` (+ usage rate) | Present in sample; marked 待确定 in docx |
| L0C → L2 / GM | `L0C_to_GM_datas` | `L0C_to_GM_datas(KB)` (+ usage rate) | Present in sample; marked 待确定 in docx |
| L0C → UB | — | — | **TBD** (docx); absent in sample |

Also present in sample (not all listed in docx edge table): MTE instruction/ratio columns, `GM_to_L1_*`, `UB_to_GM_*`, `aiv_ub_to_gm_bw(GB/s)`, `aiv_gm_to_ub_bw(GB/s)`, etc.

### 3.5 `MemoryL0.csv`

L0C `_bw_cube` directions are confirmed by suffix. L0A/L0B keep master L1→buffer→Cube; `out.rep` is NA.

| Docx display edge | Field | Sample |
| --- | --- | --- |
| L1 → L0A | `aic_l0a_read_bw(GB/s)` | yes |
| L1 → L0B | `aic_l0b_read_bw(GB/s)` | yes |
| L0A → Cube | `aic_l0a_write_bw(GB/s)` | yes |
| L0B → Cube | `aic_l0b_write_bw(GB/s)` | yes |
| L0C → Cube | `aic_l0c_read_bw_cube(GB/s)` | yes (docx: 待确定 source, listed as MemoryL0) |
| Cube → L0C | `aic_l0c_write_bw_cube(GB/s)` | yes |

### 3.6 `MemoryUB.csv`

| Docx display edge | Docx field | Sample column | Status |
| --- | --- | --- | --- |
| Vec → UB | `aiv_ub_write_bw_vector(GB/s)` | `aiv_ub_write_bw_vector(GB/s)` | Present; `ub_read_*` = leaving UB |
| UB → Vec | `aiv_ub_read_bw_vector(GB/s)` | `aiv_ub_read_bw_vector(GB/s)` | Present |
| UB → L2 | `aiv_ub_read_bw_gm(GB/s)` | — | Product name on `MemoryUB.csv` (unverified; absent from sample); sample uses `aiv_ub_to_gm_bw` on `Memory.csv` |
| L2 → UB | `aiv_ub_write_bw_gm(GB/s)` | — | Same: product `MemoryUB.csv` unverified; sample `aiv_gm_to_ub_bw` on `Memory.csv` |

Sample also includes `aiv_ub_read_bw_scalar(GB/s)` / `aiv_ub_write_bw_scalar(GB/s)`.

### 3.7 `L2Cache.csv`

Docx maps「L2Cache Hit Rate」to this file without listing columns. Sample columns:

| Prefix | Hit / miss metrics |
| --- | --- |
| `aic_*` | write/read cache hit & miss-allocate, `aic_write_hit_rate(%)`, `aic_read_hit_rate(%)`, `aic_total_hit_rate(%)` |
| `aiv_*` | same pattern for vector |

Use read/write (or total) hit rate on the GM↔L2 link in the memory diagram (per annotated mockup).

### 3.8 `ArithmeticUtilization.csv` (sample supplementary)

Not referenced in docx field tables. Sample columns support Roofline composition labels such as `Vec_FP32` / `Vec_MISC`:

- AIC: `aic_cube_ratio`, `aic_cube_fp16_ratio`, `aic_cube_int8_ratio`, FOPs / instruction counts
- AIV: `aiv_vec_ratio`, `aiv_vec_fp32_ratio`, `aiv_vec_fp16_ratio`, `aiv_vec_int32_ratio`, `aiv_vec_int16_ratio`, `aiv_vec_misc_ratio`, `aiv_vec_fops`

### 3.9 `ResourceConflictRatio.csv` (sample supplementary)

Not referenced in docx. Sample columns: AIC wait ratios (`aic_cube_wait_ratio`, `aic_mte*_wait_ratio`) and AIV conflict/wait ratios (`aiv_vec_*_cflt_ratio`, `aiv_mte*_wait_ratio`).

---

## 4. Timeline / trace payload

Docx §11.2.8 tables for timeline and pipeline details are **empty**. The local sample embeds `trace.json` (Chrome Trace Event format).

### 4.1 Top level

| Field | Type | Sample |
| --- | --- | --- |
| `traceEvents` | array | Event list |
| `displayTimeUnit` | string | `"ns"` |

### 4.2 Metadata events (`ph: "M"`)

Used to name lanes, e.g.:

```json
{"ph":"M","name":"thread_name","pid":2,"tid":1256,"args":{"name":"AIV0/PIPE_FIX/status"}}
```

Lane naming pattern in sample: `{channel}/{pipe}/status` (e.g. `AIV0/PIPE_FIX/status`).

### 4.3 Complete events (`ph: "X"`)

Common fields: `name`, `cat`, `pid`, `tid`, `ts`, `dur`, `args`.

`args` variants observed in sample:

| Kind | Distinctive args |
| --- | --- |
| Pipe state / marker | `channel`, `pipe`, `record_type`, `marker`, `raw`, `delta_time`, `state_PIPE_*` |
| Interval / span | `start_index`, `end_index`, `start_raw`, `end_raw`, `start_abs_ts`, `end_abs_ts` |

This is sufficient to drive hierarchical Core → Cube/Vec → pipe swimlanes once events are grouped by `pid`/`tid` / channel metadata. Richer UI fields shown in event-details mockup (`Pc_addr`, `Process_bytes`, source `Code` paths, Relevant graph) are **not present** in the sample `trace.json` and remain unspecified in the docx tables.

---

## 5. Sample cross-check (`data/out.rep`)

Verified against unpacked payloads (2026-08-03 local sample):

| Check | Result |
| --- | --- |
| Docx-mapped pipe occupancy / Roofline ratio fields on `PipeUtilization.csv` | All present |
| Docx-mapped L0 BW fields on `MemoryL0.csv` | All present |
| Docx-mapped Vec↔UB BW on `MemoryUB.csv` | Present |
| Docx `aiv_ub_*_bw_gm` on `MemoryUB.csv` | **Absent**; GM↔UB BW is `aiv_ub_to_gm_bw` / `aiv_gm_to_ub_bw` on `Memory.csv` |
| Docx `L0C_to_L1_datas` / `L0C_to_GM_datas` | Present as `*_datas(KB)` (+ usage rate) on `Memory.csv` |
| `OpBasicInfo.csv` PID / Op Type / Block Dim / Task Duration | Present |
| `L2Cache.csv` hit-rate columns | Present |
| `HardwareInfo.jsonl`, `MemoryL1.csv` | jsonl in the toolkit `example.rep` pack (not in git); **absent** from `data/out.rep`. No `MemoryL1.csv` — L1 BW on `Memory.csv` |
| Supplementary (not in docx tables) | `ArithmeticUtilization.csv`, `ResourceConflictRatio.csv`, `trace.json` present |

---

## 6. Open / TBD (formats)

See prioritized product-owner list: [questions](../context/questions/).

| Item | Notes |
| --- | --- |
| `npu-rep` vs `cann-rep` | Product diagram vs repo packer; same conceptual layout |
| `HardwareInfo.jsonl` | Details source confirmed; missing from `out.rep`; toolkit `example.rep` pack (not in git) |
| `MemoryL1.csv` | Not required; L1 BW on `Memory.csv` |
| UB↔GM field names | Product `MemoryUB.csv` first; sample `Memory.csv` fallback |
| L0C → UB edge | 待确定; no sample column |
| Timeline event schema for full details panel | Product tables empty; sample trace is pipe-state oriented only |
| Report-stat derived cards | **Compute** interim DATA-33h; **AICore parallel** still empty (DATA-33a); **带宽利用率** measured confirmed, peak/score → [DATA-33g](../context/decisions/interim/DATA.md). **Obsolete:** 平均核利用率 / dual 输入·输出 aic\|aiv cards |
| Block aggregation | Sample has multiple `block_id` rows; summary policy unspecified |
