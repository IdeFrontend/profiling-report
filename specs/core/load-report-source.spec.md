# Load Report Source

<!--
  metadata
  spec-id-prefix: PR-JSON-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/adapters/loadReportSource.ts (loadReportSource)
  test: tests/unit/loadReportSource.spec.ts
-->

## Purpose

Detect and load profiling reports from various source types — `.rep` binary or standalone Chrome Trace Event Format (CTEF) JSON.

## Inputs / Outputs

```ts
loadReportSource(source: ArrayBuffer | Uint8Array): ReportSource
```

| Parameter | Type | Description |
|-----------|------|-------------|
| source | ArrayBuffer or Uint8Array | Raw report data |

**Returns**: ReportSource with type and parsed data.

## Behavior

- Detects `.rep` magic bytes (`cann-rep`) — parses as container.
- Detects JSON (standalone Chrome Trace) — treats as CTEF.
- Falls back to Chrome Trace if no magic matches.

## Acceptance Criteria

1. **PR-JSON-001**: Standalone CTEF JSON opens and renders swimlane without CSV sidebar per Q15.
1. **PR-JSON-002**: Valid `.rep` binary detected correctly and not misinterpreted as CTEF.

## Edge Cases

- Corrupted file — throws clear error with type hint.
- Empty buffer — throws.
- Valid JSON that is not CTEF — behavior TBD; currently may fail in chromeTraceToSwimlane.

## Dependencies

- [docs/context/OPEN_QUESTIONS.md Q15] — standalone CTEF opens without CSV pack; aside hides.

## Open Questions

- [Q15 resolved] — .json policy: Chrome Trace opens in profiling-report, aside hides.
