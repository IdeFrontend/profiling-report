# Formats


Hub for profiling-report **on-disk inputs** (shared **`.npu-rep` container**, payload **profiles**, detection). Profile schemas live under `compute/` and `emulate/`. Consumer UI surfaces live under [`../views/`](../views/). This file does **not** define metric CSV columns or emulate contract tables.

| Doc | Role |
|-----|------|
| **This file** (`README.md`) | Container binary + profile index + detection |
| [compute/FORMAT.md](compute/FORMAT.md) | Compute OP embed schemas (npu-compute) |
| [compute/METRICS_AND_TRACE.md](compute/METRICS_AND_TRACE.md) | Compute embed column detail (UI fills: [../views/](../views/)) |
| [emulate/FORMAT.md](emulate/FORMAT.md) | Emulate contract + leaf pack (npu_emulate) |
| [emulate/TABLES.md](emulate/TABLES.md) | Emulate table inventory |
| [FORMATS_COMPARISON.md](FORMATS_COMPARISON.md) | Semantic comparison across stacks |
| [../views/README.md](../views/README.md) | UI surfaces ↔ adapted view-models (per-view packets) |
| [VIEW_DATA_REQUIREMENTS.md](VIEW_DATA_REQUIREMENTS.md) | Legacy redirect → views catalog |
| [ADAPTERS.md](ADAPTERS.md) | Detect profile → adapt → view-models |
| [REP_FORMAT.md](REP_FORMAT.md) | Classic `cann-rep` engineering fixtures only |

Related: [../views/](../views/) · [VIEW_DATA_MAPPING.md](../ui/VIEW_DATA_MAPPING.md) (docx/sketch index). Decisions: [PROC-6](../context/decisions/PROC.md) … [PROC-8](../context/decisions/PROC.md), [DATA-45](../context/decisions/DATA.md), [DATA-46](../context/decisions/DATA.md).

---

## 1. Host open contract

| Item | Rule |
| --- | --- |
| Product / MSTT extension | **`.npu-rep` only** ([PROC-2](../context/decisions/PROC.md)) |
| Producers | **compute** leaf: npu-compute. **emulate** leaf: npu_emulate. Both pack into `.npu-rep` ([PROC-6](../context/decisions/PROC.md)) |
| File name pattern (product) | `report_<timestamp>_<rand id>.npu-rep` |
| Classic fixtures | `cann-rep` / sample `.rep` — engineering only; see [REP_FORMAT.md](REP_FORMAT.md) |
| Standalone Chrome Trace | `.json` → profiling-report ([PROC-3](../context/decisions/PROC.md)); aside analytics hidden without metric embeds |

Mockup (binary layout):

![npu-rep layout](../ui/source/v930/entry.jpeg)

---

## 2. Payload profiles

Same container binary; **different embed sets** ([PROC-7](../context/decisions/PROC.md)).

| Profile | Producer | Leaf contents (summary) | Adapter |
| --- | --- | --- | --- |
| `compute` | npu-compute | `OpBasicInfo.csv`, `PipeUtilization.csv`, `Memory*.csv`, `PipeTrace.json` / `trace.json`, … | Hardware path in [ADAPTERS.md](ADAPTERS.md) (today `adaptPayloads`) |
| `emulate` | npu_emulate | `EmulateManifest.json` + `PipeTrace.json` + KernelInfo/summary (+ contract CSVs) | `adaptEmulate` — see [emulate/FORMAT.md](emulate/FORMAT.md) |

**No silent remap** ([DATA-45](../context/decisions/DATA.md)): do not invent compute-shaped metric CSVs from emulate tables. Map each profile into shared `SwimlaneModel` + `ReportViewModel` + `capabilities[]`.

### 2.1 Detection

| Signal | Rule |
| --- | --- |
| Emulate marker | Leaf embeds **`EmulateManifest.json`** with `"profile": "emulate"` → **emulate** ([PROC-8](../context/decisions/PROC.md)) |
| Otherwise | Treat as **compute** (or Chrome Trace–only if no metric pack) |
| Head `origin` | Product 160-byte layout uses `origin = 1` (profile) for both until Product assigns a dedicated emulate origin (open [PROC-9](../context/questions/PROC.md)). Parser today rejects `origin ≠ 1`. |

---

## 3. Report container

### 3.1 On-disk layout

```text
[Head]
[FileInfo × fileInfoCount]
[payload bytes for file 1]
…
[payload bytes for file N]
```

Payloads are addressed by absolute byte offsets from the start of the container. Endianness: **little-endian**, packed (no padding).

### 3.2 Head (product intent vs classic local packer)

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

**Classic fixture packer (`CannRepHead`, 36 bytes)** — see [REP_FORMAT.md](REP_FORMAT.md):

| Field | Type | Value / meaning |
| --- | --- | --- |
| `magic[8]` | `char` | `"cann-rep"` (no trailing NUL; 8 chars) |
| `version` | `uint32_t` | `0x00010000` (1.0.0) |
| `fileInfoCount` | `uint32_t` | Number of embedded files |
| `fileLength` | `uint32_t` | Head size (`36`) |
| `repLength` | `uint64_t` | Total file length |
| `offset` | `uint64_t` | Absolute start of payload region (`36 + N×160`) |

### 3.3 File info entry

**Product intent (docx `NpuRepFileInfo`):**

| Field | Type (as shown) | Meaning |
| --- | --- | --- |
| `magic[8]` | `char` | `"npu-rep"` |
| `fileName[128]` | `char` | Embedded file name |
| `type` | `uint16_t` | `raw` / `json` / `csv` / `txt` / `ini` |
| reserved | — | Alignment / reserved |
| `fileLength` | `uint64_t` | Payload byte length |
| `fileRepOffset` | `uint64_t` | Absolute offset of payload |

**Classic fixture (`CannRepFileInfo`, 160 bytes):** see [REP_FORMAT.md](REP_FORMAT.md).

### 3.4 Parsing rules

1. Validate head magic and version.
2. Read `fileInfoCount` consecutive FileInfo records.
3. For each entry, slice `[offset, offset+length)` and interpret by `type` / extension.
4. Build a name→payload map; detect profile (§2.1); dispatch to the matching adapter.
5. Missing optional payloads disable dependent panels ([DATA-30](../context/decisions/DATA.md)); hard error only on unparseable container / invalid JSON.

### 3.5 Shipped `npu-rep` layout (nested operators)

The product container ships as `npu-rep` (not `cann-rep`). There are **two** FileInfo layouts sharing the same head, disambiguated by the head's `fileInfoLength` field:

- **Product 160-byte layout** (`fileInfoLength = 160`, `origin = 1`) — produced by `npu-compute` / future emulate packers (`data/scripts/pack_rep.py` / `unpack_rep.py`). Sample: `data/result.npu-rep`. Parsed by `parseNpuRep160`.
- **Interim 164-byte sample layout** (`fileInfoLength = 164`) — repo sample packer (`data/build_sample_rep.py`); `data/example.npu.rep` / `data/sample.lite.rep`. Parsed by `parseNpuRep`.

#### Product 160-byte layout

**Head (36 bytes):**

| Offset | Size | Type | Field | Value |
| --- | --- | --- | --- | --- |
| 0 | 8 | `char[8]` | `magic` | `npu-rep` + NUL |
| 8 | 4 | `uint32` | `version` | `0x00010000` |
| 12 | 2 | `uint16` | `origin` | `1` (profile) |
| 14 | 2 | `uint16` | `repHeadLength` | `36` |
| 16 | 4 | `uint32` | `fileInfoCount` | number of embeds |
| 20 | 4 | `uint32` | `fileInfoLength` | `160` (FileInfo stride) |
| 24 | 4 | `uint32` | `reserved` | `0` |
| 28 | 8 | `uint64` | `npuRepLength` | total container length |

**FileInfo (160 bytes):**

| Offset | Size | Type | Field |
| --- | --- | --- | --- |
| 0 | 8 | `char[8]` | `magic` (`npu-rep` + NUL) |
| 8 | 128 | `char[128]` | `name` (NUL-padded) |
| 136 | 2 | `uint16` | `type` |
| 138 | 2 | `uint16` | `reserved` (`0`) |
| 140 | 4 | `uint32` | `reserved1` (`0`) |
| 144 | 8 | `uint64` | `fileLength` |
| 152 | 8 | `uint64` | `fileRepOffset` |

Payloads are contiguous — no gaps between entries and no unreferenced trailing bytes.

**Type enum (160-byte layout):**

| Value | Meaning |
| --- | --- |
| 1 | **nested operator archive** (`.npu.rep`) |
| 2 | `json` |
| 3 | `jsonl` |
| 4 | `csv` |
| 5 | `sqlite3` (reserved; not required for simulator Phase 1) |
| 6 | `protobuf` |

#### Interim 164-byte sample layout (repo packer)

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

**Type enum (164-byte layout):**

| Value | Meaning |
| --- | --- |
| 1 | `csv` |
| 2 | `json` / `jsonl` |
| 6 | **nested operator archive** (`.npu.rep`) |

**Operator nesting.** An outer `npu-rep` packs one FileInfo per operator; each payload is itself an `npu-rep` leaf archive. The viewer lists nested archives in the OP selector and adapts each leaf independently. A container with no nested embeds is a flat single-operator leaf pack. Each leaf is either **hardware** or **simulator** per §2.1.

---

## 4. Time base (shared viewer rule)

| Embed | Viewer interpretation |
| --- | --- |
| Product `PipeTrace.json` | Timestamps / durations in **µs** (despite possible `displayTimeUnit: "ns"` label) |
| Classic / sample `trace.json` | **ns** |
| Simulator `PipeTrace.json` | Must be packed in **µs** — producer converts ticks → µs ([DATA-46](../context/decisions/DATA.md)) |

---

## 5. Open / TBD

| Item | Notes |
| --- | --- |
| Dedicated head `origin` for simulator | [PROC-9](../context/questions/PROC.md) |
| KernelInfo → summary field map | [DATA-47](../context/questions/DATA.md) |
| Hardware-only open items | [compute/FORMAT.md](compute/FORMAT.md) § Open / TBD |
