# Stress Swimlane Generator

| spec-id-prefix |
|----------------|
| PR-STRESS-*    |

Synthetic `SwimlaneModel` factory for playground Canvas vs WebGL paint A/B (`generateStressSwimlane`).

```ts
generateStressSwimlane(options?: StressSwimlaneOptions, preset?: StressSwimlanePreset): SwimlaneModel
stressSwimlaneStats(model: SwimlaneModel): StressSwimlaneStats
stressPresetFromQuery(value: string | null): StressSwimlanePreset
```

## Behavior

**Presets.** `small` / `medium` / `large` set process, thread, and events-per-thread counts. `medium` targets Sudu-class density (4 processes × 8 threads × 10_000 events = 320_000). Explicit `StressSwimlaneOptions` override preset sizes.

**Timeline packing.** Per-thread busy time budget is `timeSpanNs * occupancy` (nanoseconds only). Idle gaps use the remaining span. Event count must not be mixed into that budget — when `eventsPerThread` exceeds the busy budget in ns, durations still floor to ≥1 ns and wrapping may occur, but occupancy gaps remain.

**Determinism.** Same `seed` yields identical event layouts so renderer A/B comparisons are stable.

**Query helper.** `stressPresetFromQuery` accepts `small`/`medium`/`large`; unknown or null falls back to `medium`.

## Acceptance Criteria

1. **PR-STRESS-001**: Medium preset yields 4 processes, 32 threads, 320_000 events over 1e9 ns.
1. **PR-STRESS-002**: Same seed produces identical first events (deterministic).
1. **PR-STRESS-003**: Explicit options override preset sizes (event count and time span).
1. **PR-STRESS-004**: `stressPresetFromQuery` maps known values and falls back to `medium`.
1. **PR-STRESS-005**: When event count exceeds `timeSpanNs * occupancy`, occupancy still leaves idle gaps (not a solid 1 ns pack).

## Edge Cases

Unknown query string → `medium`. Custom options with a named preset still honor the option overrides. Dense packs that cannot fit without overlap wrap remaining events near the end of the span.

## Dependencies

[swimlane-model](./swimlane-model.spec.md).

## Changelog
- **2026-08-10** — Fix busyBudget units (occupancy × span in ns; do not mix event count).
- **2026-08-10** — Spec for playground stress fixture (Canvas vs WebGL A/B).
