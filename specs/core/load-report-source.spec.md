# Load Report Source

| spec-id-prefix |
|----------------|
| PR-JSON-*      |

Detect and load profiling reports from product **`.npu-rep`** (and classic engineering `cann-rep` / sample `.rep` fixtures) or standalone Chrome Trace Event Format (CTEF) JSON.

```ts
loadReportSource(source: ArrayBuffer | Uint8Array): ReportSource
```

## Behavior

Inspects the head magic (first 8 bytes):

1. **`npu-rep`** — product container ([PROC-2](../../docs/context/decisions/PROC.md)). Routes by `fileInfoLength` to the 160-byte product layout or the interim 164-byte sample layout ([npu-rep.spec](./npu-rep.spec.md)), then adapts nested or flat operators → full `AdaptedReport`.
2. **`cann-rep`** — classic engineering / sample fixture container. Parses via `parseRep` / `adaptRep` → full `AdaptedReport`.
3. **Otherwise** — assumes standalone JSON, parses as CTEF, converts via `chromeTraceToSwimlane` → `AdaptedReport` with an empty `ReportViewModel` (empty summary, empty pipeOccupancy, empty overviewSeries). This triggers the aside panel auto-hide in ProfilingReport per PROC-3.

Throws on empty input. Throws with descriptive message on corrupted binary or unparseable JSON. Valid JSON that is not CTEF (no complete X events) fails in `chromeTraceToSwimlane` and propagates the error.

## Acceptance Criteria

1. **PR-JSON-001**: Standalone CTEF JSON opens and renders swimlane without CSV sidebar per PROC-3.
1. **PR-JSON-002**: Valid classic `cann-rep` / sample `.rep` detected correctly, not misinterpreted as CTEF.
1. **PR-JSON-003**: Product `npu-rep` magic (160- and 164-byte layouts) loads via `loadReportSource` and is not treated as CTEF.

## Edge Cases

- Corrupted file → throws. Empty buffer → throws. Non-CTEF JSON → fails downstream.

## Dependencies

[PROC-2](../../docs/context/decisions/PROC.md) — product host extension `.npu-rep`. PROC-3 — standalone CTEF opens without CSV pack; aside hides. [npu-rep.spec](./npu-rep.spec.md), [rep-format.spec](./rep-format.spec.md).

## Changelog
- **2026-09-07** — Document product `npu-rep` detection ahead of classic `cann-rep` and CTEF ([PROC-2](../../docs/context/decisions/PROC.md)).
- **2026-08-05** — Initial spec. Core behaviors established.
