# Input Formats

<!--
  spec-id-prefix: PR-FMT-* (shared)
  phase: MVP
  test: tests/unit/parseRep.spec.ts
-->

Report container contract and embedded file conventions. Defines what the parser delivers to the adaptation layer. Source: `docs/specs/formats/INPUT_FORMATS.md`, `docs/specs/formats/METRICS_AND_TRACE.md`.

## Container metadata per embedded file

| Field | Description |
|-------|-------------|
| name | Basename (e.g. `trace.json`, `OpBasicInfo.csv`) |
| type | `raw`(0) / `csv`(1) / `json`(2) / `txt`(3) / `ini`(4) |
| origin | `default`(0) / `profile`(1) / `sanitizer`(2) |
| length | Payload byte length |
| offset | Absolute byte offset in container |

## CSV conventions

- Keyed by `block_id` and `sub_block_id`
- `aic_*` prefix = AI Cube / AIC counters, `aiv_*` prefix = AI Vector / AIV counters
- Missing values = `NA` token (not empty string)
- Time values in microseconds, bandwidth in GB/s, ratios are unitless 0–1 unless labeled `%`

## File → UI panel mapping

| Embedded file | MVP panel | P2 panel |
|---|---|---|
| `OpBasicInfo.csv` | Report summary (name, type, duration) | Hardware/op header |
| `PipeUtilization.csv` | PIPE occupancy bars, lane utilization | Pipe field list |
| `ArithmeticUtilization.csv` | — | Roofline inputs |
| `Memory*.csv` | — | Memory topology diagram |
| `L2Cache.csv` | — | Cache tab |
| `ResourceConflictRatio.csv` | — | Stall/conflict details |
| `trace.json` | Swimlane lanes and events | Dependency overlays |

## Design sketches

- [NPU-REP binary layout](/docs/specs/ui/source/npu-rep-layout.png)

**Dependencies:** I-Q6b (pipe aggregation: mean of non-NA ratios). Shared `PR-FMT-*` prefix with [rep-format](./rep-format.spec.md).

**Open:** Q5 — Overview series returns empty array per I-Q5+.
