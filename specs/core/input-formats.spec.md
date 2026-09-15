# Input Formats

| spec-id-prefix |
|----------------|
| PR-FMT-*       |

Shared **`.npu-rep` container hub** and profile index. Product schemas for embeds live under [compute/FORMAT.md](../../docs/formats/compute/FORMAT.md) and [emulate/FORMAT.md](../../docs/formats/emulate/FORMAT.md). Descriptive SSOT: [formats/README.md](../../docs/formats/README.md).

Classic `cann-rep` fixture details remain in [rep-format](./rep-format.spec.md).

## Behavior

**Container metadata per embedded file.** Each FileInfo carries: name (basename), type, length, absolute offset (product 160-byte or interim 164-byte layout per [npu-rep](./npu-rep.spec.md)).

**Profiles.** A leaf is `compute` or `emulate`. Emulate leaves MUST include `manifest.json` that is either a thin marker with `"profile": "emulate"` or an export catalog with hub objects ([PROC-8](../../docs/context/decisions/PROC.md)). Otherwise treat as compute (or CTEF-only).

**No compute CSV schemas here.** Compute `block_id` / `aic_*` / `aiv_*` / `NA` conventions and file→UI mapping are specified under [compute/FORMAT](../../docs/formats/compute/FORMAT.md) / [view-models](./view-models.spec.md) / [views/](../../docs/views/) / [METRICS_AND_TRACE](../../docs/formats/compute/METRICS_AND_TRACE.md) — not in this hub spec.

**PipeTrace time unit.** Product / emulate `PipeTrace.json` timestamps are **µs** at the viewer ([DATA-41](../../docs/context/decisions/DATA.md) for emulate packer conversion).

## Acceptance Criteria

*Shared PR-FMT-* prefix — see [rep-format](./rep-format.spec.md). Hub profile rules covered by [npu-rep](./npu-rep.spec.md) / [emulate-format](./emulate-format.spec.md) / [load-report-source](./load-report-source.spec.md).*

## Dependencies

[INPUT_FORMATS.md](../../docs/formats/README.md), [rep-format](./rep-format.spec.md), PROC-7, PROC-8.

## Open

[PROC-9](../../docs/context/questions/PROC.md) — dedicated head `origin` for simulator.

## Design sketches

- [NPU-REP binary layout](../../docs/ui/source/v930/entry.jpeg)

## Changelog
- **2026-09-14** — Scope hub-only; move hardware CSV conventions out to hardware docs / view-models.
- **2026-08-05** — Initial spec. Core behaviors established.
