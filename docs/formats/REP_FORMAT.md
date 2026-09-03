# CANN `.rep` / `.ncrep` Format

Interim normative description of the binary report container used by profiling-report. Derived from [`data/pack_rep.py`](../../data/pack_rep.py), [`data/unpack_rep.py`](../../data/unpack_rep.py), and sample [`data/out.rep`](../../data/out.rep).

**Producer status ([PROC-1](../context/decisions/PROC.md)):** The producing tool is still under development. Until an official producer format specification is published, treat this document + sample data as the implementation source of truth, and expect additive updates when the producer spec lands.

## Extensions

| Extension | Meaning |
|-----------|---------|
| `.rep` | Generic CANN report container (sample: `data/out.rep`) |
| `.ncrep` | Product alias for OP profiling reports (UI sketches: `report.ncrep`) |

Both use the same binary layout and magic (**Interim [PROC-2a](../context/decisions/interim/PROC.md)** until Product defines divergence). Hosts should open either extension with the profiling-report viewer.

### Product `npu-rep` container

The shipping product container uses the **`npu-rep`** magic (36-byte head, **164-byte** FileInfo, `type:u32`, `type 6` = nested operator archive) — see [INPUT_FORMATS §1.6](INPUT_FORMATS.md). It can pack nested per-operator archives; `loadReportSource` detects it separately from the `cann-rep` packer below and adapts each operator. This document's `cann-rep` layout remains the local sample packer (`data/pack_rep.py`).

## Byte order and packing

- Little-endian
- Structs are packed (no C padding)
- Filenames in the table are basenames only, UTF-8, fixed 128-byte fields zero-padded

## Layout

```text
[CannRepHead]                      36 bytes
[CannRepFileInfo × fileInfoCount]  160 bytes each
[file payload 1]
…
[file payload N]
```

Data region starts at absolute offset `CannRepHead.offset`, which must equal `36 + fileInfoCount × 160` for a contiguous pack.

## CannRepHead (36 bytes)

| Offset | Size | Type | Field | Notes |
|--------|------|------|-------|-------|
| 0 | 8 | `char[8]` | `magic` | Exactly `cann-rep` (no trailing NUL) |
| 8 | 4 | `uint32` | `version` | `0x00010000` = 1.0.0 |
| 12 | 4 | `uint32` | `fileInfoCount` | Number of `CannRepFileInfo` entries |
| 16 | 4 | `uint32` | `fileLength` | Size of this head (= 36) |
| 20 | 8 | `uint64` | `repLength` | Total file size in bytes |
| 28 | 8 | `uint64` | `offset` | Absolute start of first file payload |

Struct pack format (Python `struct`): `<8sIIIQQ`.

## CannRepFileInfo (160 bytes)

| Offset | Size | Type | Field | Notes |
|--------|------|------|-------|-------|
| 0 | 8 | `char[8]` | `magic` | Exactly `rep-file` |
| 8 | 128 | `char[128]` | `name` | Basename; NUL-padded; truncated if longer |
| 136 | 2 | `uint16` | `type` | See type enum |
| 138 | 2 | `uint16` | `origin` | See origin enum |
| 140 | 4 | `uint32` | `resv` | Reserved; write 0 |
| 144 | 8 | `uint64` | `length` | Payload byte length |
| 152 | 8 | `uint64` | `offset` | Absolute offset of payload in the `.rep` |

Struct pack format: `<8s128sHHIQQ`.

## Type enum

| Value | Name | Typical extensions |
|------:|------|--------------------|
| 0 | `raw` | unknown / binary |
| 1 | `csv` | `.csv` |
| 2 | `json` | `.json` |
| 3 | `txt` | `.txt` |
| 4 | `ini` | `.ini` |

## Origin enum

| Value | Name | Meaning |
|------:|------|---------|
| 0 | `default` | Unclassified embed |
| 1 | `profile` | Profiling / trace (e.g. name contains `prof` or `trace`) |
| 2 | `sanitizer` | Sanitizer-related (name contains `sanitizer`) |

Origin is metadata for tooling; the viewer should key off **filename** and **type** for parsing.

## Expected OP report embeds

Sample `data/out.rep` contains:

| Name | Type | Origin | Role |
|------|------|--------|------|
| `ArithmeticUtilization.csv` | csv | default | Cube/vector arithmetic ratios, FOPS |
| `L2Cache.csv` | csv | default | L2 hit/miss and hit rates |
| `Memory.csv` | csv | default | Path bandwidths, MTE counts, data volumes |
| `MemoryL0.csv` | csv | default | L0A/B/C bandwidths |
| `MemoryUB.csv` | csv | default | UB read/write bandwidths |
| `OpBasicInfo.csv` | csv | default | Op name, type, duration, block dim, freq |
| `PipeUtilization.csv` | csv | default | Per-pipe times/ratios, stalls |
| `ResourceConflictRatio.csv` | csv | default | Wait / conflict ratios |
| `trace.json` | json | profile | Chrome Trace Event Format timeline |

Future reports may add or omit files. The parser must tolerate missing optional CSVs. When `trace.json` (or an equivalent swimlane source) is absent, the report adapts to a **metrics-only** view: the swimlane is `null` and the aside (PIPE / memory / hardware / CSV tabs) still renders — this is not a hard error.

## Versioning

- Readers should accept `version == 0x00010000` and warn on newer unknown versions rather than silently mis-parsing.
- Breaking layout changes require a new `version` and a documented migration.

## Tools

```bash
# Pack a directory of files into a .rep (sorted by basename)
python3 data/pack_rep.py <data_dir> <out.rep>

# Inspect / extract
python3 data/unpack_rep.py <in.rep> [out_dir]
```

## Validation checklist

1. Head magic `cann-rep`, file-info magics `rep-file`
2. `repLength ==` actual file size
3. `offset == 36 + fileInfoCount * 160`
4. Each payload `offset + length` within file
5. No overlapping payloads (recommended for writers)
