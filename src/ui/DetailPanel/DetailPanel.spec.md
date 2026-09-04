# DetailPanel

| spec-id-prefix |
|----------------|
| PR-DPANEL-*    |

Raised bottom 「详情」 dock: titled header with a close control over a three-column body — identity card, Parameter list, Relevent dependency graph.

## Inputs

**selected** (`SelectedEvent`), optional **timeOrigin** / **locale**. Start / duration / end formatting lives in `DetailSummary` (per-value auto units — no `timeScaleUnit` / `unit` prop on this dock). Optional **neighbors** (`DependencyNeighbors`), **dependencyMode** and **dependencyDepth** drive the Relevent column.

## Outputs

**close** — the header close icon; the parent clears the selection, which unmounts the dock.
**update:expanded** — the top-edge expander; the root owns which of the two heights is current.
**update:dependencyMode**, **update:dependencyDepth** — forwarded from the Relevent toolbar; the root owns both and shares them with the swimlane curves.

## Behavior

The header renders the 详情 tab label with a 2px white underline and the close button. The header row **stretches** so the underline lands on the header rule rather than floating mid-header: the sketch puts the underline at +49..+51 from the dock top and the rule at +51..+52, i.e. touching. Close is the HDesign `close` glyph via `PrIcon`, not a text `×`. The body forwards `selected` to DetailSummary and `selected.args` to DetailParameter. The Relevent column mounts **only** when `neighbors` is supplied: a report with no dependency data passes `undefined` and the dock falls back to two columns — the body carries `pr-detail-panel__body--no-relevant`, which drops the third grid track so Parameter takes the freed width instead of leaving it empty (VIEW_DATA_REQUIREMENTS hide-when-missing policy).

**Two heights, not a range.** The dock is `DOCK_HEIGHT_COLLAPSED` (247px) or `DOCK_HEIGHT_EXPANDED` (407px) — both measured off the v930 pair, whose exports put the dock bottom at 1049 CSS and its top at 802 and 642. A centred expander on the top edge switches between them; there is no drag resize, because the design offers one affordance and free heights only ever produced layouts the sketch never sanctioned. `expanded` is a prop and `update:expanded` an emit, so the root owns the state as it owns the gutter and aside widths. Painted height is `min(var(--pr-dock-h), 60vh)` so a short host cannot have the expanded dock eat the timeline — the old drag path left `innerHeight - 160` for the same reason.

The expander is the sketch's 14×1px bar plus a 6×4px solid triangle in `#6c6c6c`, 4px below the dock's top edge. The two swap order between states — triangle above the bar reads as "push up to expand", below it as "push down to collapse" — which is a flex `column-reverse` / `column` flip. Padding, not margin, grows the hit target so the visual keeps its sketch position.

Whichever way the height changes — appear, disappear, or expander — it animates over 200ms, so the timeline above always reflows at the same rate instead of jumping. The dock is `box-sizing: border-box` and clips its overflow, so `height: 0` on leave collapses completely. `prefers-reduced-motion: reduce` drops the transition.

Each column scrolls inside whichever height is current, so switching selections never resizes the panel or shifts the timeline above it. For the same reason the identity card is pinned to the top of its column and its captions stay on one line.

The identity track is `min-content` rather than a fixed width, so the card fits its start / duration / end row exactly and the rest of the width goes to Parameter and Relevent — see [DetailSummary](./DetailSummary/DetailSummary.spec.md) (`PR-DSUM-005`). The two-column fallback sizes the same way. Column *widths* therefore shift slightly per selection; heights, which are what would move the timeline, do not.

## Acceptance Criteria

1. **PR-DPANEL-001** — Renders the detail panel shell with summary when selected is provided.
1. **PR-DPANEL-002** — The header close button emits `close`.
1. **PR-DPANEL-003** — The Relevent column renders only when `neighbors` is provided, and the body drops to a two-track grid without it.
1. **PR-DPANEL-004** — Mode and depth changes from the Relevent toolbar are re-emitted to the parent.
1. **PR-DPANEL-005** — The centred expander toggles the dock between its two sketch heights and carries `aria-expanded`; no drag handle exists.
1. **PR-DPANEL-006** — The active tab underline sits on the header rule, not mid-header.
1. **PR-DPANEL-007** — Dock height animates on appear, disappear and expand (reduced motion excepted), and the close control is the design icon.

## Visual

Normative crop: [`visual/panel-chrome.png`](./visual/panel-chrome.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

## Design sketches

- [panel-chrome](./visual/panel-chrome.png) — full raised 「详情」 dock from `v930/detail-strip-raised`
- [Task click detail](../../../docs/ui/source/v930/task-click-detail.jpeg) — click → dock appears, with the dependency toolbar annotations

## Dependencies

[dependencies](../../../specs/core/dependencies.spec.md) for the neighbour model.

## Changelog
- **2026-09-02** — Expanded dock height is `min(var(--pr-dock-h), 60vh)` so a short host cannot lose the timeline; the free-drag path used to leave `innerHeight - 160` for the same reason.
- **2026-09-01** — Identity track becomes `min-content` in both the three- and two-column layouts, so the card fits its figures instead of cropping them at 290px. Behaviour is specified in DetailSummary (`PR-DSUM-005`).
- **2026-09-01** — PR-DPANEL-005 recast: the drag handle becomes the sketch's centred expander and the dock's free height range becomes two fixed heights (247 / 407), measured off the v930 pair. Adds PR-DPANEL-006 (underline on the rule) and PR-DPANEL-007 (animated height, `PrIcon` close). The stale `45vh` cap in this spec was never implemented and is gone with the range.
- **2026-08-28** — Drop phantom `unit` input; summary times are per-value auto (two-tier UI-40a).
- **2026-08-20** — PR-DPANEL-005: the dock's top edge is a drag handle. **height** is a prop and **update:height** an emit, so the root owns the size the way it owns the gutter and aside widths; the drag reuses `panelResize` on the vertical axis and clamps against the viewport so the dock can never swallow the timeline.
- **2026-08-20** — Dock height 247px, the sketch's proportion at 1920 wide.
- **2026-08-20** — Relays `dependencyMode` / `dependencyDepth` instead of `level`: the dock's direction and depth controls now drive the swimlane curves too.
- **2026-08-19** — Two-column fallback: the body drops the Relevent grid track when `neighbors` is omitted, so Parameter takes the freed width.
- **2026-08-14** — Dropped the `direction` prop and its re-emit: DetailRelevant owns the direction toggle now, and the dock only relays `level`.
- **2026-08-13** — Fixed dock height and sketch column widths so the panel stops resizing per selection.
- **2026-08-13** — Panel chrome (详情 tab + close), Relevent column gated on dependency data.
- **2026-08-10** — Introduced as DetailStrip replacement shell.
