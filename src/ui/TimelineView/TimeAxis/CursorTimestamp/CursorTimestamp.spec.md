# CursorTimestamp

| spec-id-prefix |
|----------------|
| PR-CURSOR-*    |

Playhead time bubble on the viewport time axis. Shows the cursor position as `MM:SS.mmm` relative to the viewport origin.

## Inputs

**xRatio** — fractional position 0–1 along the axis. **label** — pre-formatted cursor time string (`MM:SS.mmm` in the active display unit). The parent (ProfilingReport) computes the relative time and formats it via `formatCursorTime`.

## Outputs

None. Presentational only — positioned absolutely by the parent axis container.

## Behavior

The bubble is centered on the stem by default: `left: 50%; transform: translate(-50%, 0)` at `top: 2px` inside the track.

**Above placement.** When `labelAbove` is true (parent detects overlap with measure borders / Δt), the pill uses `pr-cursor__label--above` and `transform: translate(-50%, calc(-100% - 6px))` so it sits fully above the axis top. `top` stays `2px`; only `transform` changes so the move can animate (`transition: transform 180ms ease`). `prefers-reduced-motion: reduce` disables the transition.

## Visual

Crops: [`visual/cursor-timestamp.png`](./visual/cursor-timestamp.png), [`visual/cursor-timestamp-context.png`](./visual/cursor-timestamp-context.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

| Token | Value |
|-------|--------|
| Bubble fill | `#317AF7` (align `--pr-playhead` / `#3078F0` ±) |
| Text | `#ffffff`, 11px, weight 600, tabular-nums |
| Format | `MM:SS.mmm` from time **relative to `minTime`** in **active display unit** (see `formatCursorTime`) |
| Size | ~72×19px content; `padding: 1px 8px`; `border-radius: 4px`; `min-width: 72px` |
| Stem | 1px line same blue (`#317AF7`), continuous from axis through swimlane — **no** 1px gap at the axis/canvas border; axis + canvas segments share the same x (no horizontal jog) |
| Behavior | Must update on pointer move; short traces use µs/ns unit so digits change |
| Above | `labelAbove` → pill above axis; 180ms transform transition |

**Example:** axis `4.456ms` (relative) → label `00:04.456` when unit is `ms`.

## Acceptance Criteria

1. **PR-CURSOR-001** — Renders stem at xRatio position and label bubble with text.
2. **PR-CURSOR-002** — Label text matches the prop value.
3. **PR-CURSOR-003** — Stem extends `bottom: -1px` to bridge the axis/canvas border (no gap).
4. **PR-CURSOR-004** — `labelAbove` applies `pr-cursor__label--above` with above-axis transform; CSS declares a transform transition; `prefers-reduced-motion` disables it.

## Edge Cases

| State | Behavior |
|---|---|
| xRatio = 0 | Stem at left edge; bubble centered, no overflow clipping |
| xRatio = 1 | Stem at right edge; bubble within axis container |
| Short trace (<1ms span) | Parent uses µs/ns unit; bubble digits change on move |
| labelAbove toggles | Pill animates up/down unless reduced motion |

## Design sketches

- [cursor-timestamp](./visual/cursor-timestamp.png) — from `v930/search-highlight`
- [cursor-timestamp-context](./visual/cursor-timestamp-context.png) — from `v930/search-highlight`

## Dependencies

[format-time](../../../../../specs/core/format-time.spec.md) (formatCursorTime).

## Changelog
- **2026-08-20** — Above-axis placement + transform transition; PR-CURSOR-004.
- **2026-08-10** — Extracted from ProfilingReport into own component.
