# SummaryDiffIndicator

Delta badge for baseline comparison (对比基线, 1130 方案一): the small tone-tinted circle the summary cards and the compute details field list paint next to a value when it differs from the selected baseline's.

## Inputs

- **tone** (`'increase' | 'decrease'`) — `increase` = red up (the current value is lower than the baseline), `decrease` = green down.
- **text** — the unsigned delta magnitude, already formatted by the caller (e.g. `2.4`, `20%`).
- **directionLabel** — sr-only word describing the direction (增加 / 减少 · Increased / Decreased).

## Behavior

One root `<span class="pr-diff pr-diff--{tone}">` with the mockup-extracted arrow mask (8px `pr-icon pr-icon--diff-up` / `--diff-down`), the delta text (`#b3b3b3`, 13px) and an sr-only `.pr-field-sr` direction label. Fallthrough attributes (e.g. `data-testid`) bind to the root span — a single root keeps the badge testable from both the summary cards and the details field list.

The tone math lives in [metricDiff](../../../domain/metricDiff.ts): delta = baseline − current; delta > 0 tones **decrease**, delta < 0 tones **increase**.

## Acceptance Criteria

1. **PR-SDI-001** — `increase` renders the red badge class, the up-arrow icon mask, the delta text, and the sr-only direction label.
2. **PR-SDI-002** — `decrease` renders the green badge class and the down-arrow icon mask.
3. **PR-SDI-003** — A single root span receives fallthrough attributes (testid).

## Visual

| Token | Value |
|-------|-------|
| Badge | circle, 12px; red `rgba(231,67,74,0.2)` / green `rgba(136,200,88,0.2)` (tone tint) |
| Arrow | 8px icon mask, `diff-up` / `diff-down` (mockup-extracted, 1130) |
| Delta text | `#b3b3b3`, 13px, on the value's baseline |
| Direction | sr-only word (增加 / 减少 · Increased / Decreased) |

## Changelog

- **2026-11-12** — Co-located spec added (PR-SDI-001..003); the badge is shared by the aside summary cards and the compute details field list.
