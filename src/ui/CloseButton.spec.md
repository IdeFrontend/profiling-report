# CloseButton

| spec-id-prefix |
|----------------|
| PR-CLOSE-*     |

The shared ✕ that dismisses a panel — the multi-select dock, the detail dock, the stats aside, and the toolbar's display control all mount this one button.

## Inputs

**label** — the already-localized name of the action (`closePanel`). It feeds both `aria-label` and `title`, so the button never falls back to reading its glyph out loud.

## Outputs

No custom events. The native `click` reaches the parent through fallthrough, so each panel keeps owning what "close" means for it.

## Behavior

The sketch draws a **stroked ✕**, not the typographic `×`. That distinction is the reason this component exists: `×` (U+00D7) is a math operator positioned on the font's math axis, so it sits high and narrow inside its own box and cannot be optically centered by `align-items: center` — the button looks correct in the box model while the glyph reads low and off-center. The icon is drawn as the two diagonals of a square viewBox with equal inset on all four sides, so its optical center is its geometric center at any size.

The button itself is a fixed square flex box centering that icon, with no padding to bias it. Color is `currentColor`, brightening on hover; every panel gets the same rest and hover treatment rather than each re-deriving one.

## Acceptance Criteria

1. **PR-CLOSE-001** — stroked ✕ centered in a square button.
2. **PR-CLOSE-002** — label drives aria-label and title; click passes through.

## Visual

20×20 button; 12×12 icon; 1.3px round-capped strokes at `#e6e6e6`, `#ffffff` on hover.

## Design sketches

- Close affordance in `v930/task-marquee` (multi-select dock header) and `v930/report-stats-open` (aside header).

Design hierarchy: [`docs/ui/DESIGN_INDEX.md`](../../docs/ui/DESIGN_INDEX.md).

## Changelog

- **2026-08-26** — Extracted from the four panels that each hand-rolled a `×` text button. The typographic glyph never centered; replaced by a stroked icon.
