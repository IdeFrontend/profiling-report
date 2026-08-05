# REP Format

<!--
  spec-id-prefix: PR-FMT-*
  phase: MVP
  source: src/adapters/parseRep.ts
  test: tests/unit/parseRep.spec.ts
-->

Parse binary `.rep` / `.ncrep` container into structured file entries and payloads.

```ts
parseRep(bytes: Uint8Array): { head: CannRepHead; files: FileEntry[] }
```

| Parameter | Type | Description |
|-----------|------|-------------|
| bytes | Uint8Array | Raw bytes of the `.rep` file |

**Behavior:** Validates 8-byte magic (`cann-rep`) at offset 0, reads head struct (version, fileInfoCount, fileLength, repLength, offset), parses each `CannRepFileInfo` entry (name, type, origin, length, offset), extracts raw payload bytes for each file via absolute offsets. Throws if magic does not match.

- [NPU-REP binary layout](/docs/specs/ui/source/npu-rep-layout.png)

## Acceptance Criteria

1. **PR-FMT-001**: Parses a valid `.rep` file and returns the expected number of files and their names.
1. **PR-FMT-002**: Parses the golden fixture `data/out.rep` — returns all 9 expected embedded files with non-empty payloads.
1. **PR-FMT-003**: Reads file info count and validates that payload offsets are within file bounds.

## Edge Cases

- Unknown/truncated magic — throw clear error.
- Zero fileInfoCount — return empty files array.
- Payload offset beyond file length — throw.

**Dependencies:** I-Q2 (`.rep`/`.ncrep` share layout), I-Q4 (CI uses `data/out.rep`).

**Open:** Q1 — Producer status; format may evolve. Treat current sample as source of truth.
