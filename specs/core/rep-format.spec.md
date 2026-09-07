# REP Format

| spec-id-prefix |
|----------------|
| PR-FMT-*       |

Parse the binary `.rep` / `.ncrep` container into structured file entries with raw payloads ready for adaptation.

```ts
parseRep(bytes: Uint8Array): { header: ParseHeader; files: FileEntry[]; payloads: Record<string, Uint8Array> }
```

## Behavior

The `.rep` file is a packed, little-endian binary container. Layout: `[CannRepHead: 36 bytes]` + `[CannRepFileInfo × N: 160 bytes each]` + `[payload region]`. The head carries a magic string (`cann-rep`, 8 bytes), version (`0x00010000`), file count, and total length. Each file info entry carries the embedded file's basename (128 bytes, NUL-padded), type (raw/csv/json/txt/ini), origin (default/profile/sanitizer), payload length, and absolute byte offset.

Parsing validates the magic at offset 0 and throws if it doesn't match. It reads the head struct to get `fileInfoCount`, then iterates parsing each `CannRepFileInfo` entry. For each entry, it extracts the raw payload bytes using the absolute offset and length. Returns the head metadata and an array of `FileEntry` objects.

**Embedded file conventions.** CSV metrics are keyed by `block_id`/`sub_block_id`, with `NA` for missing values. `aic_*`/`aiv_*` prefix distinguishes Cube/Vector counters. Time values in microseconds, bandwidth in GB/s.

**Golden fixture.** CI uses `data/out.rep` (DATA-31a). Contains 9 embedded files: `OpBasicInfo.csv`, `PipeUtilization.csv`, `ArithmeticUtilization.csv`, `Memory.csv`, `MemoryL0.csv`, `MemoryUB.csv`, `L2Cache.csv`, `ResourceConflictRatio.csv`, `trace.json`.

## Acceptance Criteria

1. **PR-FMT-001**: Parses a valid `.rep` file and returns the expected number of files and their names.
1. **PR-FMT-002**: Parses the golden fixture `data/out.rep` — returns all 9 expected embedded files with non-empty payloads.
1. **PR-FMT-003**: Reads file info count and validates payload offsets are within file bounds.

## Edge Cases

- Unknown/truncated magic → throw. Zero fileInfoCount → empty files array. Payload offset beyond file length → throw. Empty payload (length=0) → handled gracefully. Duplicate file names → throw error.

## Dependencies

PROC-2a (`.rep`/`.ncrep` share layout), DATA-31a (CI golden fixture).

## Open

PROC-1 — Producer status; format may evolve.

## Design sketches

- [NPU-REP binary layout](../../docs/ui/source/v930/entry.jpeg)

## Changelog
- **2026-08-05** — Initial spec. Core behaviors established.
