# REP Format

<!--
  spec-id-prefix: PR-FMT-*
  phase: MVP
  source: src/adapters/parseRep.ts
  test: tests/unit/parseRep.spec.ts
-->

Parse the binary `.rep` / `.ncrep` container format into structured file entries with raw payloads ready for adaptation.

```ts
parseRep(bytes: Uint8Array): { head: CannRepHead; files: FileEntry[] }
```

## Behavior

**Binary layout.** The `.rep` file is a packed, little-endian binary container. Layout: `[CannRepHead: 36 bytes]` + `[CannRepFileInfo × N: 160 bytes each]` + `[payload region]`. The head carries a magic string (`cann-rep`, 8 bytes), version (`0x00010000`), file count, and total length. Each file info entry carries the embedded file's basename (128 bytes, NUL-padded), type (raw/csv/json/txt/ini), origin (default/profile/sanitizer), payload length, and absolute byte offset.

**Parsing.** `parseRep` validates the 8-byte magic at offset 0 and throws if it doesn't match. It reads the head struct to get `fileInfoCount`, then iterates parsing each `CannRepFileInfo` entry. For each entry, it extracts the raw payload bytes using the absolute offset and length from the file info. The function returns the head metadata and an array of `FileEntry` objects — each containing the file's parsed metadata and its raw `Uint8Array` payload.

**Embedded file conventions.** CSV metrics are keyed by `block_id` and `sub_block_id`, with `NA` tokens for missing values. Dual-prefix fields (`aic_*` / `aiv_*`) distinguish AI Cube and AI Vector counters. Time values in CSVs are in microseconds, bandwidth in GB/s.

**Golden fixture.** CI uses `data/out.rep` (I-Q4). It contains 9 embedded files: OpBasicInfo.csv, PipeUtilization.csv, ArithmeticUtilization.csv, Memory.csv, MemoryL0.csv, MemoryUB.csv, L2Cache.csv, ResourceConflictRatio.csv, and trace.json. The file → UI panel mapping is defined in `docs/specs/formats/METRICS_AND_TRACE.md`.

## Acceptance Criteria

1. **PR-FMT-001**: Parses a valid `.rep` file and returns the expected number of files and their names.
1. **PR-FMT-002**: Parses the golden fixture `data/out.rep` — returns all 9 expected embedded files with non-empty payloads.
1. **PR-FMT-003**: Reads file info count and validates payload offsets are within file bounds.

## Edge Cases

- Unknown or truncated magic → throw clear error.
- Zero fileInfoCount → return empty files array.
- Payload offset beyond file length → throw.
- Empty payload (length=0) → handled gracefully.
- Duplicate file names → last entry wins.

## Design sketches

- [NPU-REP binary layout](/docs/specs/ui/source/npu-rep-layout.png)

**Dependencies:** I-Q2 (`.rep`/`.ncrep` share layout), I-Q4 (CI golden fixture).

**Open:** Q1 — Producer status; format may evolve.
