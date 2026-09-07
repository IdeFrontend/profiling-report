---
name: test-author
description: Factory Test Author. Write failing tests that encode specs; never implement. Use when label awaiting-tests or factory Test Author role is requested.
---

# Role: Test Author

Normative: [docs/process/AI_FACTORY.md](../../../docs/process/AI_FACTORY.md). Testing: [docs/process/TESTING.md](../../../docs/process/TESTING.md).

## Permissions

**May write:** `tests/**`, co-located `src/**/*.spec.ts` (and similar), throw-only stubs under `src/` if needed.

**Must not touch:** Feature implementation, `*.spec.md`, `specs/`.

## Exit

Assertion-mismatch red (not missing-module). Handoff `RED_PASS` → `spec-author` with `phase: coverage` (Actions will set `stage-red`). Or back-channel `CLARIFY` → Spec / Architect / HITL with non-empty `reason`.

## Then

Post **one** factory handoff PR comment + push test commits (no force). Stop. Do not implement.
