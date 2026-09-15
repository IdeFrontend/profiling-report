# Input Formats

| spec-id-prefix |
|----------------|
| PR-FMT-*       |

Shared **`.npu-rep` container hub** and profile index. Product schemas for embeds live under [compute/FORMAT.md](../../docs/formats/compute/FORMAT.md) and [emulate/FORMAT.md](../../docs/formats/emulate/FORMAT.md). Descriptive SSOT: [INPUT_FORMATS.md](../../docs/formats/INPUT_FORMATS.md).

Classic `cann-rep` fixture details remain in [rep-format](./rep-format.spec.md).

## Behavior

**Container metadata per embedded file.** Each FileInfo carries: name (basename), type, length, absolute offset (product 160-byte or interim 164-byte layout per [npu-rep](./npu-rep.spec.md)).

**Profiles.** A leaf is `hardware` or `simulator`. Simulator leaves MUST include `EmulateManifest.json` with `"profile": "emulate"` ([PROC-8](../../docs/context/decisions/PROC.md)). Otherwise treat as hardware (or CTEF-only).

**No hardware CSV schemas here.** Hardware `block_id` / `aic_*` / `aiv_*` / `NA` conventions and file→UI mapping are specified under hardware format / [view-models](./view-models.spec.md) / [METRICS_AND_TRACE](../../docs/formats/compute/METRICS_AND_TRACE.md) — not in this hub spec.

**PipeTrace time unit.** Product / simulator `PipeTrace.json` timestamps are **µs** at the viewer ([DATA-41](../../docs/context/decisions/DATA.md) for simulator packer conversion).

## Acceptance Criteria

*Shared PR-FMT-* prefix — see [rep-format](./rep-format.spec.md). Hub profile rules covered by [npu-rep](./npu-rep.spec.md) / [emulate-format](./emulate-format.spec.md) / [load-report-source](./load-report-source.spec.md).*

## Dependencies

[INPUT_FORMATS.md](../../docs/formats/INPUT_FORMATS.md), [rep-format](./rep-format.spec.md), PROC-7, PROC-8.

## Open

[PROC-9](../../docs/context/questions/PROC.md) — dedicated head `origin` for simulator.

## Design sketches

- [NPU-REP binary layout](../../docs/ui/source/v930/entry.jpeg)

## Changelog
- **2026-09-14** — Scope hub-only; move hardware CSV conventions out to hardware docs / view-models.
- **2026-08-05** — Initial spec. Core behaviors established.
