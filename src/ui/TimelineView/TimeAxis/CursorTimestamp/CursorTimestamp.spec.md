# CursorTimestamp

| spec-id-prefix |
|----------------|
| PR-CURSOR-*    |

Playhead time bubble on the viewport time axis. Shows the cursor position as a scalar timestamp relative to `minTime` (same `formatDisplayTime` as tooltip Start).

## Inputs

**xRatio** — fractional position 0–1 along the axis. **label** — pre-formatted cursor time string (scalar, same as tooltip Start). The parent formats via `formatDisplayTime(time, minTime, unit)`.

## Outputs

None. Presentational only — positioned absolutely by the parent axis container.

## Behavior

The bubble is centered on the stem by default: `left: 50%; transform: translate(-50%, 0)` at `top: 2px` inside the track.

**Above placement.** When `labelAbove` is true (parent: pointer over the viewport time axis, or cursor pill overlaps the measure range / outside Δt), the pill uses `pr-cursor__label--above` and `transform: translate(-50%, calc(-100% - 6px))` so it sits fully above the axis top (into the overview / total-axis band). `top` stays `2px`; only `transform` changes so the move can animate (`transition: transform 180ms ease`). `prefers-reduced-motion: reduce` disables the transition.

**Stacking.** Stem (`z-index: 3`) paints under axis Δt (`4`) and axis measure bars (`5`); the timestamp pill (`z-index: 6`) paints above Δt so the vertical line never crosses the duration label when the pill is raised. Swimlane measure borders also use `3` (same band as the stem).

**Magnet snap.** When `snapped` is true (the cursor magnetized to an event edge), the stem renders gray (`#4c4c4c`, the measure-border gray) instead of blue, matching the swimlane body bar; the blue 2px per-lane event-edge bars (`measure-edge-snap`) carry the "matched event" emphasis instead.

**Aside seam.** The pill is centered on the stem and may extend past the timeline column when the playhead is near the right (or left) edge. ReportLayout keeps `.pr-main` `overflow: visible` with stacking above the aside so the full pill stays painted (slight overlap over the sidebar is OK). The stem stays in-track.

## Visual

Crops: [`visual/cursor-timestamp.png`](./visual/cursor-timestamp.png), [`visual/cursor-timestamp-context.png`](./visual/cursor-timestamp-context.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

| Token | Value |
|-------|--------|
| Bubble fill | `#317AF7` (align `--pr-playhead` / `#3078F0` ±) |
| Text | `#ffffff`, 11px, weight 600, tabular-nums |
| Format | Scalar via `formatDisplayTime` relative to `minTime` (e.g. `2.368 µs`) — matches tooltip/detail Start |
| Size | ~72×19px content; `padding: 1px 8px`; `border-radius: 4px`; `min-width: 72px` |
| Stem | 1px line same blue (`#317AF7`), continuous from axis through swimlane — **no** 1px gap at the axis/canvas border; axis + canvas segments share the same x (no horizontal jog) |
| Behavior | Must update on pointer move; short traces use µs/ns unit so digits change |
| Above | `labelAbove` → pill above axis; 180ms transform transition |

**Example:** producer `4.456ms` → label `4.456 ms` when unit is `ms`.

## Acceptance Criteria

1. **PR-CURSOR-001** — Renders stem at xRatio position and label bubble with text.
2. **PR-CURSOR-002** — Label text matches the prop value.
3. **PR-CURSOR-003** — Stem extends `bottom: -1px` to bridge the axis/canvas border (no gap).
4. **PR-CURSOR-004** — `labelAbove` applies `pr-cursor__label--above` with above-axis transform; CSS declares a transform transition; `prefers-reduced-motion` disables it.
5. **PR-CURSOR-005** — Stem `z-index` is below measure Δt; label `z-index` is above measure Δt (stem does not cross the duration pill).
6. **PR-CURSOR-006** — `snapped` prop grays the stem (`#4c4c4c`) while the cursor is magnetized to an event edge.

## Edge Cases

| State | Behavior |
|---|---|
| xRatio = 0 | Stem at left edge; bubble centered; may slightly overlap past the left column edge |
| xRatio = 1 | Stem at right edge; bubble centered; may slightly overlap the aside seam (not clipped) |
| Short trace (<1ms span) | Parent uses µs/ns unit; bubble digits change on move |
| labelAbove toggles | Pill animates up/down unless reduced motion |
| labelAbove + Δt under stem x | Stem under Δt; raised pill still readable |

## Design sketches

- [cursor-timestamp](./visual/cursor-timestamp.png) — from `v930/search-highlight`
- [cursor-timestamp-context](./visual/cursor-timestamp-context.png) — from `v930/search-highlight`

## Dependencies

[format-time](../../../../../specs/core/format-time.spec.md) (formatDisplayTime).

## Changelog
- **2026-08-26** — `snapped` prop grays the stem (`#4c4c4c`) while the cursor is magnetized to an event edge; PR-CURSOR-006.
- **2026-08-25** — Label relative to minTime via formatDisplayTime.
- **2026-08-24** — Scalar `formatTime` cursor label (matches tooltip).
- **2026-08-20** — Parent also lifts pill while hovering the viewport time axis (TimelineView).
- **2026-08-20** — Pill may overlap aside seam when playhead is at the edge.
- **2026-08-20** — Stem under Δt, pill above; PR-CURSOR-005.
- **2026-08-20** — Above-axis placement + transform transition; PR-CURSOR-004.
- **2026-08-10** — Extracted from ProfilingReport into own component.
