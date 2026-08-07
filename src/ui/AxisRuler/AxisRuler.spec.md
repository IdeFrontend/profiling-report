# AxisRuler

| spec-id-prefix |
|----------------|
| PR-AXIS-*      |

Shared dual time-axis chrome used by `TimeOverviewBar` and the viewport `.pr-time-axis` in `ProfilingReport`.

## Inputs

**majors** — `{ t, pct, label, muted? }[]` positioned 0–100%. **minors** — `{ pct, muted? }[]` (9 per major gap from `buildAxisRulerTicks`).

## Behavior

Renders major **1px** bars with labels immediately to the **right**, plus short minor ticks along the bottom. Parent supplies a **20px** track and tick data from `buildAxisRulerTicks` (nice zoom-aware ns grid). Labels sit in an **18px** top-aligned box (**12px / 400**). Minors are **5px**. This component fills `inset: 0` and clips overflow. See `docs/specs/ui/components/VISUAL_SPEC.md`.

## Acceptance Criteria

1. **PR-AXIS-001** — Renders majors and minors with testids.
2. **PR-AXIS-002** — `buildAxisRulerTicks` yields 9 minors per gap and relative-zero first label.

## Changelog
- **2026-08-07** — Initial shared ruler chrome.
