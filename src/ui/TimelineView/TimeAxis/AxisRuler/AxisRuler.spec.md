# AxisRuler

| spec-id-prefix |
|----------------|
| PR-AXIS-*      |

Shared dual time-axis chrome used by `TimeOverviewBar` and the viewport `.pr-time-axis` in `ProfilingReport`.

## Inputs

**majors** — `{ t, pct, label, muted? }[]` positioned 0–100%. **minors** — `{ pct, muted? }[]` (9 per major gap from `buildAxisRulerTicks`).

## Behavior

Renders major **1px** bars with labels immediately to the **right**, plus short minor ticks along the bottom. Parent supplies a **20px** track and tick data from `buildAxisRulerTicks` (nice zoom-aware ns grid). Labels sit in an **18px** top-aligned box (**12px / 400**). Minors are **5px**. This component fills `inset: 0` and clips overflow.

## Visual

Normative tokens for total + viewport axes (also used by `TimeOverviewBar`). Crop: [`visual/viewport-ticks.png`](./visual/viewport-ticks.png) — [`visual/provenance.yaml`](./visual/provenance.yaml). Layout truth: [`docs/ui/source/v930/entry.jpeg`](../../../../../docs/ui/source/v930/entry.jpeg).

| Token | Value |
|-------|--------|
| Track height | **20px** |
| Label box | **18px** tall, aligned to the **top** of the 20px track |
| Label font | **12px** / weight **400**, `#c8c8c8`, tabular-nums |
| Origin | Labels use **absolute producer time** (origin t = **0**). Left edge of the timeline is **0**; events at `minTime` appear inset at their `ts`. |
| Leftmost total-scale label | `0ms` / `0µs` / `0ns` (compact zero — not `0.00xxx…`) |
| Major bar | **1px** full track height (20px), `--pr-axis-tick` / fallback `rgb(52, 52, 52)` (muted: `--pr-axis-tick-muted` / `rgb(39, 39, 39)`; v930 samples — see `COLOR_TOKENS.md`) |
| Label placement | Immediately **to the right** of its major bar (`left: pct` + ~2–3px gap; **not** centered) |
| Minor ticks | **9** between each adjacent major pair (10 subdivisions); **5px** tall from bottom; same tick tokens as majors |
| Major placement | **Nice ns steps** (`1\|2\|5×10ⁿ`) targeting ~**100px** spacing; majors at `origin + k·interval` (positions move with zoom/pan — not fixed percentages) |
| Containment | Tick text must stay inside the timeline column — **never** paint over the right aside. Track/axis `overflow: hidden` |

## Acceptance Criteria

1. **PR-AXIS-001** — Renders majors and minors with testids.
2. **PR-AXIS-002** — `buildAxisRulerTicks` yields 9 minors per gap and zero label at producer origin.
3. **PR-AXIS-003** — Major bars and minor ticks use `--pr-axis-tick` (fallback `rgb(52, 52, 52)`); muted use `--pr-axis-tick-muted` (fallback `rgb(39, 39, 39)`).

## Design sketches

- [viewport-ticks](./visual/viewport-ticks.png) — from `v930/entry`

## Changelog
- **2026-08-24** — Absolute producer axis (origin t = 0); viewport starts at 0.
- **2026-08-13** — Tick/bar colors: normal `rgb(52,52,52)`, dimmed `rgb(39,39,39)`; PR-AXIS-003.
- **2026-08-10** — Absorbed shared axis tokens from retired `docs/ui/components/VISUAL_SPEC.md`.
- **2026-08-07** — Initial shared ruler chrome.
