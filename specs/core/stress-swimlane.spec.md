# Stress Swimlane Generator

| spec-id-prefix |
|----------------|
| PR-STRESS-*    |

Synthetic `SwimlaneModel` factory for playground Canvas vs WebGL paint A/B and sketch Card hierarchy (`generateStressSwimlane`).

```ts
generateStressSwimlane(options?: StressSwimlaneOptions, preset?: StressSwimlanePreset): SwimlaneModel
stressSwimlaneStats(model: SwimlaneModel): StressSwimlaneStats
stressPresetFromQuery(value: string | null): StressSwimlanePreset
stressDefaultCollapsedIds(model: SwimlaneModel): string[]
```

## Behavior

**Hierarchy.** Presets emit sketch Card trees:

```text
CardN
├── 通信          (leaf spacer, events: [])
├── 计算          (folder → Cores)
│   └── Core*.Cube / Vec* → ALL, SCALAR, FLOWCTRL, MTE1, CUBE, FIXP, MTE2, MTE3, CACHEMISS
└── 储存HBM       (leaf spacer, events: [])
```

Events only on pipe leaves. Synthetic `utilization` on folders and leaves.

**ProfilerStep bands.** Each stress model sets shared `bands` (`ProfilerStep#1` … `#N`) covering the timeline. Counts: small 3, medium 5, large 8. Adapters never invent bands for real reports.

**Presets (locked):**

| Preset | Cards | Cores / Card | Pipe leaves | Events / pipe | ≈ total events |
|--------|-------|--------------|-------------|---------------|----------------|
| small | 1 | Cube + Vec0 (Vec0: 4 pipes) | 9+4=13 | 654 | **8_502** |
| medium | 2 | Cube + Vec0 + Vec1 | 2×3×9=54 | 6_000 | **324_000** |
| large | 2 | Core0–2 × (Cube+Vec0) = 6 cores | 2×6×9=108 | 6_667 | **~720_036** (108×6667) |

Use exact integers in code so unit tests assert totals. Explicit `StressSwimlaneOptions` may override counts for tests.

**Default expand.** `stressDefaultCollapsedIds` returns ids so first paint matches sketches: every Card open; each Card’s `计算` open; only that Card’s `Core0.Cube` open; other Cores collapsed; sibling Cards’ Cores beyond Core0.Cube collapsed.

**Timeline packing.** Per-thread busy time budget is `timeSpanNs * occupancy` (nanoseconds only). Idle gaps use the remaining span.

**Determinism.** Same `seed` yields identical event layouts.

**Same-core dependencies.** After packing, pipe leaves can be wired with `EventRef` predecessors/successors. `StressSwimlaneOptions.linkDependencies` defaults **on for `small`**, **off for `medium`/`large`** (all-pairs nearest-per-pipe refs are too large for Sudu-class presets). When wiring runs: links stay inside that Core (own pipe included). If A lists B as successor, B lists A as predecessor, and vice versa. `predecessor.endTime <= successor.startTime`. Each event that can link does: on every pipe in the Core, the nearest valid successor (first start ≥ this end) and nearest valid predecessor (latest end ≤ this start) are included. Reverse edges from those nearest picks may add extra refs. Timeline-edge events may have an empty pred or succ list; the `dependencies` object is still present. 通信 / 储存HBM stay empty. Dedupes with a `${tid}:${index}` set, not a linear `some()` scan.

**Query helper.** `stressPresetFromQuery` accepts `small`/`medium`/`large`; unknown or null falls back to `medium`.

## Acceptance Criteria

1. **PR-STRESS-001**: Medium preset yields 2 Cards, 54 pipe leaves, 324_000 events over 1e9 ns.
1. **PR-STRESS-002**: Same seed produces identical first events (deterministic).
1. **PR-STRESS-003**: Explicit options override preset sizes (event count and time span).
1. **PR-STRESS-004**: `stressPresetFromQuery` maps known values and falls back to `medium`.
1. **PR-STRESS-005**: When event count exceeds `timeSpanNs * occupancy`, occupancy still leaves idle gaps (not a solid 1 ns pack).
1. **PR-STRESS-006**: Tree shape is Card → 通信/计算/储存HBM → Core → pipes; 通信/储存HBM have empty events.
1. **PR-STRESS-007**: `stressDefaultCollapsedIds` keeps Card + 计算 + Core0.Cube expanded.
1. **PR-STRESS-008**: Stress models include `bands` (`ProfilerStep#N`); count matches preset (3/5/8).
1. **PR-STRESS-009**: Pipe-event deps stay in the same Core, are bidirectional, and obey `pred.endTime <= succ.startTime`.
1. **PR-STRESS-010**: Every pipe event has `dependencies`; each Core pipe contributes its nearest valid predecessor and successor.
1. **PR-STRESS-011**: `linkDependencies` defaults on for `small` and off for `medium`/`large`; `true` enables wiring on any preset.

## Edge Cases

Unknown query string → `medium`. Custom options with a named preset still honor the option overrides. Dense packs that cannot fit without overlap wrap remaining events near the end of the span.

## Dependencies

[swimlane-model](./swimlane-model.spec.md).

## Changelog
- **2026-08-17** — Same-core wiring opt-in for medium/large (`linkDependencies`); Set dedupe; PR-STRESS-011.
- **2026-08-14** — Small/medium/large pipe events get same-core nearest predecessor/successor links.
- **2026-08-11** — Stress emits shared ProfilerStep bands (3/5/8 by preset).
- **2026-08-11** — Card → Core → pipe hierarchy; locked Sudu-class medium counts; default expand helper.
- **2026-08-10** — Fix busyBudget units (occupancy × span in ns; do not mix event count).
- **2026-08-10** — Spec for playground stress fixture (Canvas vs WebGL A/B).
