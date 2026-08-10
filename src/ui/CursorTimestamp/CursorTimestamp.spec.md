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

Renders a **1px** blue stem at `xRatio * 100%` with a centered label bubble above. The stem extends `bottom: -1px` to overlap the axis border and meet the canvas playhead line with no gap. The bubble is always centered on the stem: `left: 50%; transform: translateX(-50%)`.

## Visual

Crops: [`visual/cursor-timestamp.png`](./visual/cursor-timestamp.png), [`visual/cursor-timestamp-context.png`](./visual/cursor-timestamp-context.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

| Token | Value |
|-------|--------|
| Bubble fill | `#317AF7` (align `--pr-playhead` / `#3078F0` ±) |
| Text | `#ffffff`, 11px, weight 600, tabular-nums |
| Format | `MM:SS.mmm` from time **relative to `minTime`** in **active display unit** (see `formatCursorTime`) |
| Size | ~72×19px content; `padding: 1px 8px`; `border-radius: 4px` |
| Stem | 1px line same blue (`#317AF7`), continuous from axis through swimlane — **no** 1px gap at the axis/canvas border; axis + canvas segments share the same x (no horizontal jog) |
| Behavior | Must update on pointer move; short traces use µs/ns unit so digits change |

**Example:** axis `4.456ms` (relative) → label `00:04.456` when unit is `ms`.

## Acceptance Criteria

1. **PR-CURSOR-001** — Renders stem at xRatio position and label bubble with text.
2. **PR-CURSOR-002** — Label text matches the prop value.
3. **PR-CURSOR-003** — Stem extends `bottom: -1px` to bridge the axis/canvas border (no gap).

## Edge Cases

| State | Behavior |
|---|---|
| xRatio = 0 | Stem at left edge; bubble centered, no overflow clipping |
| xRatio = 1 | Stem at right edge; bubble within axis container |
| Short trace (<1ms span) | Parent uses µs/ns unit; bubble digits change on move |

## Design sketches

- [cursor-timestamp](./visual/cursor-timestamp.png) — from `v930/entry`
- [cursor-timestamp-context](./visual/cursor-timestamp-context.png) — from `v930/entry`

## Dependencies

[format-time](../../../specs/core/format-time.spec.md) (formatCursorTime).

## Changelog
- **2026-08-10** — Extracted from ProfilingReport into own component.
