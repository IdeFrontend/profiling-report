# SummaryDiffIndicator

Delta badge for baseline comparison (对比基线, 1130 方案一): the small tone-tinted circle the summary cards and the compute details field list paint next to a value when it differs from the selected baseline's.

## Inputs

- **tone** (`'increase' | 'decrease'`) — `increase` = red up (the current value is lower than the baseline), `decrease` = green down.
- **text** — the unsigned delta magnitude, already formatted by the caller (e.g. `2.4`, `20%`).
- **directionLabel** — sr-only word describing the direction (增加 / 减少 · Increased / Decreased).
- **tip** — optional `BaselineTipRow[]`: the current value + every comparison row's value/delta; more than one entry makes the badge open the multi-baseline hover popup.

## Behavior

One root `<span class="pr-diff pr-diff--{tone}">` with the mockup-extracted arrow mask (8px `pr-icon pr-icon--diff-up` / `--diff-down`), the delta text (`#b3b3b3`, 13px) and an sr-only `.pr-field-sr` direction label. Fallthrough attributes (e.g. `data-testid`) bind to the root span — a single root keeps the badge testable from both the summary cards and the details field list.

The tone math lives in [metricDiff](../../../domain/metricDiff.ts): delta = baseline − current; delta > 0 tones **decrease**, delta < 0 tones **increase**.

## Acceptance Criteria

1. **PR-SDI-001** — `increase` renders the red badge class, the up-arrow icon mask, the delta text, and the sr-only direction label.
2. **PR-SDI-002** — `decrease` renders the green badge class and the down-arrow icon mask.
3. **PR-SDI-003** — A single root span receives fallthrough attributes (testid).
4. **PR-SDI-004** — With `tip` (>1 entries), hover/focus opens the teleported `.pr-diff-tip` (`#262626`, radius 12, 1px `rgba(255,255,255,0.05)` border, `0 0 16px rgba(0,0,0,0.2)` shadow, 12px inset, 16px rows on an 8px pitch) listing one row per entry in one shared grid (`display: contents` rows) with two aligned columns: label left, the value right-aligned in a 76px column, then the tone badge + **unsigned** magnitude left-aligned in a column sized by the widest chip (the tinted badge carries the direction, so a decrease never prints a minus; product review). Every row's value shares one right edge and every delta chip one left edge, and the box's right border hugs the deltas. The CURRENT row spans the value+delta columns and right-aligns to the box's **top-right corner** — flush with the 12px inset. The root gains a tab stop and leave/blur hides the popup. The popup also **re-anchors on any window scroll (capture — the aside body's own scroll included) or resize**: the teleported box is `fixed`, so it recomputes its coordinates from the badge instead of staying at stale viewport ones (closing would also kill a hover the browser just opened — scrolling the value into view dispatches its scroll event after the pointer enters). Every `tip` badge — focusable or not — is ALSO described by the same list through a hidden `aria-describedby` node: each row reads `label value direction delta` (its i18n direction word plus the unsigned magnitude), so keyboard focus opens the popup and assistive tech reads all rows without it. Without `tip` the DOM and chrome are unchanged (no popup node, no tab stop, no described text).
5. **PR-SDI-005** — With **`focusable: false`** (dense details lists) the root takes no tab stop; the same hidden `aria-describedby` node carries the tip's full text, so a field row stays reachable without adding a tab stop per row. Focusable badges keep their tab stop, open the popup on focus, and carry the same described text (no row's value/direction is visual-only).

## Visual

| Token | Value |
|-------|-------|
| Badge | circle, 12px; red `rgba(231,67,74,0.2)` / green `rgba(136,200,88,0.2)` (tone tint) |
| Arrow | 8px icon mask, `diff-up` / `diff-down` (mockup-extracted, 1130) |
| Delta text | `#e6e6e6`, 13px, on the value's baseline (1130 dsl guide) |
| Direction | sr-only word (增加 / 减少 · Increased / Decreased) |

## Changelog
- **2026-11-25** — Review fix: the teleported popup re-anchors to its badge on any window scroll (capture — the aside's own scroll included) or resize, so the fixed box can never strand over unrelated content; its flip width now matches the painted 360px box (PR-SDI-004 restated).
- **2026-11-25** — Review fix: EVERY `tip` badge (focusable included) is now described by the hidden `aria-describedby` text, and each row's text spells its direction word (`label value direction delta`) — keyboard focus still opens the visual popup, and assistive tech reads every row; the dense-list `focusable: false` only drops the tab stop (PR-SDI-004/005 restated).
- **2026-11-25** — Review fix: the optional `focusable` prop (PR-SDI-005) lets dense lists expose the comparison text via `aria-describedby` without making every badge a tab stop.
- **2026-11-23** — Product review: popup deltas print the bare magnitude (no minus on green; the badge carries the direction) and every popup row uses two fixed columns — values right-aligned, delta chips left-aligned — so nothing shifts row to row.
- **2026-11-23** — Multi-baseline hover popup (PR-SDI-004): the optional `tip` prop paints every comparison row; the inline badge stays row 0.

- **2026-11-12** — Co-located spec added (PR-SDI-001..003); the badge is shared by the aside summary cards and the compute details field list.
