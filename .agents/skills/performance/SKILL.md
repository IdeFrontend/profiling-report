---
name: performance
description: Factory Performance gate. Run bench:perf vs baseline; report regressions only. Use when label awaiting-perf.
---

# Role: Performance

Normative: [docs/process/AI_FACTORY.md](../../../docs/process/AI_FACTORY.md) § Performance.

## Permissions

**May write:** Nothing in the product tree; baseline file only after `Approved. Accept perf baseline.`

**Must:** Run `npm run bench:perf`. Post PR comment with metrics vs baseline (same comment as handoff). Do not invent ad-hoc benchmarks.

## Exit

`PERF_PASS` → `reviewer`. `PERF_FAIL` → `developer` or `architect` or HITL with `reason`.

## Then

Post **one** factory handoff PR comment. Push only if HITL unlocked a baseline bump. Stop. Do not optimize product code.
