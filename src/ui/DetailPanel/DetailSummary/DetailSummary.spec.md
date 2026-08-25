# DetailSummary

| spec-id-prefix |
|----------------|
| PR-DSUM-*      |

Left column of the selection detail dock: selected event name and formatted times.

## Inputs

**selected** is a `SelectedEvent`. **unit** selects the time display unit. **timeOrigin** (usually `model.minTime`) offsets Start/End; duration is absolute. Optional **locale** localizes labels.

## Outputs

Purely presentational — no emitted events.

## Behavior

Identity card: a circular op glyph, the event name, an optional type pill, and an inset panel with start / duration / end in the current display unit. Mounted by `DetailPanel` when a selection exists.

The pill under the name carries the instruction or op type (the sketch shows `MOV_OUT_TO_L1_MULTI_ND2NZ` under `FIX_LOC_TO_DST`). Producers spell that field differently, so the first present of `op_type`, `kernel_type`, `kernel_name`, `type`, `cat` in `args` wins and the pill hides when none is there.

Every cell that truncates carries its full text in `title`, so a hover recovers what the ellipsis ate — a nanosecond-resolution Ascend timestamp is the common case, and it is exactly the digits that matter. The value's hover includes the unit, since the caption holding it is a separate cell.

Start/End values come from `formatDisplayTimeParts(…, timeOrigin)`; Duration from `formatTimeParts` (absolute). The number stands alone and the unit rides in the caption below it (`Start (ns)`), as in the sketch, so the three columns stay aligned on the digits.

## Acceptance Criteria

1. **PR-DSUM-001** — Renders event name.
2. **PR-DSUM-002** — Renders bare start / duration / end values with the unit in each caption.
3. **PR-DSUM-003** — Shows the type pill from `args` when present and hides it otherwise.
4. **PR-DSUM-004** — Every truncating cell carries its full text as a hover title.
5. **PR-DSUM-005** — With non-zero `timeOrigin`, Start/End are relative to it and Duration stays absolute.

## Visual

Normative crop: [`visual/identity-card.png`](./visual/identity-card.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

## Design sketches

- [identity-card](./visual/identity-card.png) — raised 「详情」 left event card from `v930/detail-strip-raised`
- [Event details](../../../../docs/ui/source/v930/detail-strip-raised.jpeg) — full frame

## Dependencies

[format-time](../../../../specs/core/format-time.spec.md).

## Changelog
- **2026-08-25** — Start/End relative to timeOrigin (shared display origin); PR-DSUM-005.
- **2026-08-20** — PR-DSUM-004: hover titles on the truncating cells (metric values and the type pill); the name already had one.
- **2026-08-20** — Glyph redrawn on a regular hexagon (r=11 about 16,16): the ring's three broken strokes and three nodes now sit on real hexagon vertices, and the cube fills it with a visible seam between faces, as in the sketch.
- **2026-08-20** — Glyph ring 46px, matching the sketch.
- **2026-08-20** — Glyph redrawn from the sketch: a solid isometric cube in a broken hexagonal node ring with three dots, replacing the hollow wireframe hexagon and its four-dot star.
- **2026-08-20** — Surfaces sampled from the sketch rather than eyeballed: card `#313131` on the `#262626` dock, metric panel `#3c3c3c`, and the type pill takes the sketch's muted `#7356a6` instead of the bright swimlane `mov` purple — the pill is dock chrome, not an event block.
- **2026-08-13** — Sketch card proportions: larger node glyph, unit moved into the metric captions.
- **2026-08-13** — Identity card layout (glyph, type pill, inset metric panel).
- **2026-08-10** — Renamed from DetailStrip; visual pack is identity card only.
- **2026-08-05** — Initial DetailStrip spec.
