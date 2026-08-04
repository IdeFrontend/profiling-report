# Input Formats

<!--
  metadata
  spec-id-prefix: PR-FMT-* (shared with rep-format)
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: docs/specs/formats/INPUT_FORMATS.md, docs/specs/formats/METRICS_AND_TRACE.md
  test: tests/unit/parseRep.spec.ts
-->

## Purpose

Define the report container contract, embedded file conventions, and file-to-UI mapping.

## Inputs / Outputs

The `.rep` container embeds files with metadata:

| Field | Description |
|-------|-------------|
| name | Basename (e.g. `trace.json`, `OpBasicInfo.csv`) |
| type | `raw`(0) / `csv`(1) / `json`(2) / `txt`(3) / `ini`(4) |
| origin | `default`(0) / `profile`(1) / `sanitizer`(2) |
| length | Payload byte length |
| offset | Absolute byte offset in container |

## Behavior

- CSV metrics are keyed by `block_id` and `sub_block_id`, with `NA` for missing values.
- Dual-prefix fields (`aic_*` / `aiv_*`) distinguish AI Cube and AI Vector counters.
- Time units in CSVs are microseconds; bandwidth in GB/s.
- Embedded file → UI panel mapping is defined in [METRICS_AND_TRACE.md](../../docs/specs/formats/METRICS_AND_TRACE.md).

## Acceptance Criteria

1. **PR-FMT-001**: Parser identifies correct type and origin for each embedded file.
1. **PR-FMT-002**: Golden fixture contains all 9 expected embedded files: OpBasicInfo.csv, PipeUtilization.csv, ArithmeticUtilization.csv, Memory.csv, MemoryL0.csv, MemoryUB.csv, L2Cache.csv, ResourceConflictRatio.csv, trace.json.

## Edge Cases

- Empty payload (length=0) — handled gracefully.
- Unknown file type — treated as `raw`.
- File with same name appearing twice — last entry wins.

## Dependencies

- [specs/core/rep-format.spec.md] — binary container layout.
- [docs/context/INTERIM_DECISIONS.md I-Q6b] — MVP pipe aggregation uses mean of non-NA ratios.

## Open Questions

- [Q5] — Overview series; currently returns empty array per I-Q5+.
