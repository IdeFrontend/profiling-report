# Input Formats

<!--
  spec-id-prefix: PR-FMT-* (shared)
  phase: MVP
  source: docs/specs/formats/INPUT_FORMATS.md, docs/specs/formats/METRICS_AND_TRACE.md
-->

Report container contract and embedded file conventions shared with [rep-format](./rep-format.spec.md).

## Behavior

**Container metadata per embedded file.** Each file in the `.rep` container carries: name (basename), type (raw/csv/json/txt/ini), origin (default/profile/sanitizer), payload length, and absolute byte offset.

**CSV conventions.** Keyed by `block_id`/`sub_block_id`. `aic_*` prefix = Cube counters, `aiv_*` = Vector counters. `NA` token for missing values. Times in microseconds, bandwidth in GB/s, ratios unitless 0–1.

**File → UI panel mapping.** `OpBasicInfo.csv` feeds the report summary. `PipeUtilization.csv` feeds PIPE occupancy bars and lane utilization. `trace.json` drives the swimlane. `ArithmeticUtilization.csv`, `Memory*.csv`, `L2Cache.csv`, and `ResourceConflictRatio.csv` are Phase 2 panels (roofline, memory topology, cache, stalls).

## Dependencies

I-Q6b (pipe aggregation: mean of non-NA ratios per family). Shared `PR-FMT-*` with [rep-format](./rep-format.spec.md).

## Open

Q5 — Overview series returns empty array per I-Q5+.

## Design sketches

- [NPU-REP binary layout](../../docs/specs/ui/source/npu-rep-layout.png)

## Changelog
- **2026-08-05** — Initial spec. Core behaviors established.
