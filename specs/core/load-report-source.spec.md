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

| Parameter | Type | Description |
|-----------|------|-------------|
| source | ArrayBuffer or Uint8Array | Raw report data |

**Behavior:** Detects `.rep` magic bytes (`cann-rep`) → parses as container. Detects JSON → treats as standalone CTEF. Falls back to Chrome Trace if no magic matches. Throws on corrupted/empty input.

## Acceptance Criteria

1. **PR-JSON-001**: Standalone CTEF JSON opens and renders swimlane without CSV sidebar per Q15.
1. **PR-JSON-002**: Valid `.rep` detected correctly, not misinterpreted as CTEF.

## Edge Cases

- Valid JSON that is not CTEF — behavior TBD (may fail in chromeTraceToSwimlane).

**Dependencies:** Q15 — standalone CTEF opens without CSV pack; aside hides.
