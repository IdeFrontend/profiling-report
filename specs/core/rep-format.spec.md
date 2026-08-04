# REP Format

<!--
  metadata
  spec-id-prefix: PR-FMT-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/core/parseRep.ts
  test: tests/unit/parseRep.spec.ts
-->

## Purpose

Parse the binary `.rep` / `.ncrep` container format into structured file entries and payloads.

## Inputs / Outputs

```ts
parseRep(bytes: Uint8Array): { head: CannRepHead; files: FileEntry[] }
```

| Parameter | Type | Description |
|-----------|------|-------------|
| bytes | Uint8Array | Raw bytes of the `.rep` file |

**Returns**: Parsed head metadata and array of file entries with their raw payloads.

**Errors**: Throws if magic does not match `cann-rep`.

## Behavior

- Validates the 8-byte magic (`cann-rep`) at offset 0.
- Reads the head struct (version, fileInfoCount, fileLength, repLength, offset).
- Parses each `CannRepFileInfo` entry (name, type, origin, length, offset).
- Extracts raw payload bytes for each file using absolute offsets.

## Acceptance Criteria

1. **PR-FMT-001**: Parses a valid `.rep` file and returns the expected number of files and their names.
1. **PR-FMT-002**: Parses the golden fixture `data/out.rep` and returns all 9 expected embedded files with non-empty payloads.

## Edge Cases

- Unknown or truncated magic — throw clear error.
- Zero fileInfoCount — return empty files array.
- Payload offset beyond file length — throw.

## Dependencies

- [docs/context/INTERIM_DECISIONS.md I-Q2] — `.rep` and `.ncrep` share the same layout.
- [docs/context/INTERIM_DECISIONS.md I-Q4] — CI uses `data/out.rep` as golden fixture.

## Open Questions

- [Q1] — Producer status; format may evolve. Treat current sample as source of truth.
