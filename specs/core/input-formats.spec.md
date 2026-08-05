# Input Formats

<!--
  spec-id-prefix: PR-FMT-* (shared)
  phase: MVP
  test: tests/unit/parseRep.spec.ts
-->

Report container contract and embedded file conventions. Source: `docs/specs/formats/INPUT_FORMATS.md`, `docs/specs/formats/METRICS_AND_TRACE.md`.

**Container metadata per embedded file:**

| Field | Description |
|-------|-------------|
| name | Basename (e.g. `trace.json`, `OpBasicInfo.csv`) |
| type | `raw`(0) / `csv`(1) / `json`(2) / `txt`(3) / `ini`(4) |
| origin | `default`(0) / `profile`(1) / `sanitizer`(2) |
| length | Payload byte length |
| offset | Absolute byte offset in container |

**Behavior:** CSV metrics keyed by `block_id`/`sub_block_id`, `NA` for missing. `aic_*`/`aiv_*` prefix distinguishes Cube/Vector counters. Times in microseconds, bandwidth in GB/s. File→UI mapping in `docs/specs/formats/METRICS_AND_TRACE.md`.

- [NPU-REP binary layout](/docs/specs/ui/source/npu-rep-layout.png)

## Edge Cases

- Empty payload (length=0) — handled gracefully.
- Unknown file type — treated as `raw`.
- Duplicate file names — last entry wins.

**Dependencies:** I-Q6b (MVP pipe aggregation: mean of non-NA ratios per pipe family). Shared `PR-FMT-*` prefix with [rep-format](./rep-format.spec.md).

**Open:** Q5 — Overview series returns empty array per I-Q5+.
