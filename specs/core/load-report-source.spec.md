# Load Report Source

<!--
  spec-id-prefix: PR-JSON-*
  phase: MVP
  source: src/adapters/loadReportSource.ts
  test: tests/unit/loadReportSource.spec.ts
-->

Detect and load profiling reports from `.rep` binary or standalone Chrome Trace Event Format (CTEF) JSON.

```ts
loadReportSource(source: ArrayBuffer | Uint8Array): ReportSource
```

## Behavior

**Detection.** Checks the first 8 bytes of the input for the `'cann-rep'` magic string. If present, treats the input as a `.rep` container, parses it via `parseRep`, and adapts via `adaptRep` — producing a full `AdaptedReport` with swimlane model, report model, and capabilities.

**Standalone JSON path.** If the magic is absent, assumes the input is standalone JSON (Chrome Trace). Parses it as CTEF, converts via `chromeTraceToSwimlane`, and produces an `AdaptedReport` with an empty `ReportViewModel` (empty summary, empty pipeOccupancy, empty overviewSeries). This triggers the aside panel auto-hide in ProfilingReport per Q15 — standalone JSON traces have no CSV embeds and therefore no summary or pipe occupancy to display.

**Error handling.** Throws on empty input. Throws with a descriptive message on corrupted binary or unparseable JSON. Valid JSON that is not CTEF (no complete X events) will fail in `chromeTraceToSwimlane` and propagate the error.

## Acceptance Criteria

1. **PR-JSON-001**: Standalone CTEF JSON opens and renders swimlane without CSV sidebar per Q15.
1. **PR-JSON-002**: Valid `.rep` detected correctly, not misinterpreted as CTEF.

## Edge Cases

- Corrupted file → throws clear error.
- Empty buffer → throws.
- Valid JSON that is not CTEF → fails in chromeTraceToSwimlane.

**Dependencies:** Q15 — standalone CTEF opens without CSV pack; aside hides.
