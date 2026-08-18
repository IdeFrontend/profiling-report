# DetailRelevant

| spec-id-prefix |
|----------------|
| PR-DREL-*      |

Right column of the detail dock: direction filter, connection-level input, and the Incoming / Current / Outgoing chip graph around the selected task.

## Inputs

**currentName** — label of the selected event (centre column). **neighbors** (`DependencyNeighbors`), **level** (`-1` = whole chain). Optional **locale**.

## Outputs

**update:level** — integer from the `Task Connection Level` input; unparsable input falls back to `-1`. Level changes the graph walk, so the parent owns it.

## Behavior

The direction filter is local state, starting at `both`. The three icon buttons the sketch annotates, left to right, as 仅展示前向依赖 / 展示前后向依赖 / 仅展示后向依赖 set it directly; 前向 means what the task waits on, so the left button selects `backward` (Incoming only) and the right one `forward` (Outgoing only). Nothing above this component reads the value, so it does not travel up as a prop and an emit.

The suppressed side renders as an empty column rather than a dropped one, so the five-column grid never reflows when the user switches direction; counts and connector curves follow the same filtered arrays as the chips.

The component still never traverses the graph itself: it renders the neighbours it is given, so the depth semantics live in one place ([dependencies](../../../specs/core/dependencies.spec.md)).

Each button carries the sketch's node-graph glyph: a fan-in tree for upstream, a four-way node for both, a fan-out tree for downstream. The glyphs are drawn as SVG path data rather than an icon font, since the library ships no icon dependency — one path for the tree edges, one for the nodes.

Between the chip columns sit two connector columns: one SVG S-curve per neighbour, from the current chip's row to that neighbour's row, as in the sketch. Row geometry (chip height and pitch) is a constant shared with the stylesheet instead of a DOM measurement, so the curves need no layout pass.

Incoming and Outgoing carry count badges; the centre column carries none, matching the sketch. Chips truncate with an ellipsis and expose the full name via `title`. When both shown sides are empty — a selected event with no neighbours at the current depth, or a direction that filters the only populated side away — the graph is replaced by an empty note, keeping the toolbar usable so the user can widen the level.

## Acceptance Criteria

1. **PR-DREL-001** — Renders the Relevent shell with Incoming / Current / Outgoing columns and count badges.
1. **PR-DREL-002** — The three direction buttons render in sketch order (`backward`, `both`, `forward`), mark the active one, and filter the rendered columns on click.
1. **PR-DREL-003** — The connection-level input emits `update:level` as an integer.
1. **PR-DREL-004** — Shows the empty note when neither side has neighbours.
1. **PR-DREL-005** — Draws one connector curve per incoming and outgoing neighbour.

## Visual

Normative crop: [`visual/relevant-graph.png`](./visual/relevant-graph.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

## Open

Chips are pinned to one line so the drawn connectors stay on their rows; a wrapping chip would drift from its curve. The swimlane-level overlay (`DependencyLinksLayer`) still has no geometry.

## Changelog
- **2026-08-14** — Direction became local state and the component blanks the suppressed side itself, instead of relaying the choice through DetailPanel to the report. Same rendering.
- **2026-08-14** — Glyphs became one path pair per direction, and the two connector columns share one template. Same coordinates, same rendering.
- **2026-08-13** — Sketch node-graph glyphs; buttons follow the sketch's 前向 / 前后 / 后向 order; SVG connector curves replace the straight rails.
- **2026-08-13** — Direction filter, connection level, chip graph wired to the dependency model.
- **2026-08-10** — Stub + visual pack from `v930/detail-strip-raised`.
