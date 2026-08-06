# Load Report Source

| spec-id-prefix |
|----------------|
| PR-JSON-*      |

Detect and load profiling reports from `.rep` binary or standalone Chrome Trace Event Format (CTEF) JSON.

```ts
loadReportSource(source: ArrayBuffer | Uint8Array): ReportSource
```

## Behavior

Checks the first 8 bytes for the `'cann-rep'` magic string. If present: parses as `.rep` container and adapts via `adaptRep` → full `AdaptedReport` with swimlane, report model, and capabilities. If absent: assumes standalone JSON, parses as CTEF, converts via `chromeTraceToSwimlane` → produces an `AdaptedReport` with an empty `ReportViewModel` (empty summary, empty pipeOccupancy, empty overviewSeries). This triggers the aside panel auto-hide in ProfilingReport per Q15.

Throws on empty input. Throws with descriptive message on corrupted binary or unparseable JSON. Valid JSON that is not CTEF (no complete X events) fails in `chromeTraceToSwimlane` and propagates the error.

## Acceptance Criteria

1. **PR-JSON-001**: Standalone CTEF JSON opens and renders swimlane without CSV sidebar per Q15.
1. **PR-JSON-002**: Valid `.rep` detected correctly, not misinterpreted as CTEF.

## Edge Cases

- Corrupted file → throws. Empty buffer → throws. Non-CTEF JSON → fails downstream.

## Dependencies

Q15 — standalone CTEF opens without CSV pack; aside hides.

## Changelog
- **2026-08-05** — Initial spec. Core behaviors established.
