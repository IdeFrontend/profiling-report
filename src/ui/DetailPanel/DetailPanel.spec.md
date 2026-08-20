# DetailPanel

| spec-id-prefix |
|----------------|
| PR-DPANEL-*    |

Raised bottom 「详情」 dock: titled header with a close control over a three-column body — identity card, Parameter list, Relevent dependency graph.

## Inputs

**selected** (`SelectedEvent`), **unit**, optional **locale**. Optional **neighbors** (`DependencyNeighbors`), **dependencyMode** and **dependencyDepth** drive the Relevent column.

## Outputs

**close** — the header `×`; the parent clears the selection, which unmounts the dock.
**update:dependencyMode**, **update:dependencyDepth** — forwarded from the Relevent toolbar; the root owns both and shares them with the swimlane curves.

## Behavior

The header renders the 详情 tab label with an accent underline and the close button. The body forwards `selected` to DetailSummary and `selected.args` to DetailParameter. The Relevent column mounts **only** when `neighbors` is supplied: a report with no dependency data passes `undefined` and the dock falls back to two columns — the body carries `pr-detail-panel__body--no-relevant`, which drops the third grid track so Parameter takes the freed width instead of leaving it empty (VIEW_DATA_REQUIREMENTS hide-when-missing policy).

Height is capped at `45vh` so the dock never swallows the timeline; each column scrolls internally.

The dock keeps a fixed height and each column scrolls inside it, so switching selections never resizes the panel or shifts the timeline above it. For the same reason the identity card is pinned to the top of its column and its captions stay on one line.

## Acceptance Criteria

1. **PR-DPANEL-001** — Renders the detail panel shell with summary when selected is provided.
1. **PR-DPANEL-002** — The header close button emits `close`.
1. **PR-DPANEL-003** — The Relevent column renders only when `neighbors` is provided, and the body drops to a two-track grid without it.
1. **PR-DPANEL-004** — Mode and depth changes from the Relevent toolbar are re-emitted to the parent.
1. **PR-DPANEL-005** — Dragging the top edge resizes the dock, clamped, and stops on pointerup.

## Visual

Normative crop: [`visual/panel-chrome.png`](./visual/panel-chrome.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

## Design sketches

- [panel-chrome](./visual/panel-chrome.png) — full raised 「详情」 dock from `v930/detail-strip-raised`
- [Task click detail](../../../docs/ui/source/v930/task-click-detail.jpeg) — click → dock appears, with the dependency toolbar annotations

## Dependencies

[dependencies](../../../specs/core/dependencies.spec.md) for the neighbour model.

## Changelog
- **2026-08-20** — PR-DPANEL-005: the dock's top edge is a drag handle. **height** is a prop and **update:height** an emit, so the root owns the size the way it owns the gutter and aside widths; the drag reuses `panelResize` on the vertical axis and clamps against the viewport so the dock can never swallow the timeline.
- **2026-08-20** — Dock height 247px, the sketch's proportion at 1920 wide.
- **2026-08-20** — Relays `dependencyMode` / `dependencyDepth` instead of `level`: the dock's direction and depth controls now drive the swimlane curves too.
- **2026-08-19** — Two-column fallback: the body drops the Relevent grid track when `neighbors` is omitted, so Parameter takes the freed width.
- **2026-08-14** — Dropped the `direction` prop and its re-emit: DetailRelevant owns the direction toggle now, and the dock only relays `level`.
- **2026-08-13** — Fixed dock height and sketch column widths so the panel stops resizing per selection.
- **2026-08-13** — Panel chrome (详情 tab + close), Relevent column gated on dependency data.
- **2026-08-10** — Introduced as DetailStrip replacement shell.
