# DetailRelevant

| spec-id-prefix |
|----------------|
| PR-DREL-*      |

Right column of the detail dock: direction filter, connection-level input, and the Incoming / Current / Outgoing chip graph around the selected task.

## Inputs

**currentName** — label of the selected event (centre column). **neighbors** (`DependencyNeighbors`), **mode** (`DependencyMode`) and **depth** (hops, `-1` = whole chain). Optional **locale**.

## Outputs

**update:mode** — the `DependencyMode` picked from the three direction buttons. **update:depth** — hop count from the `Task Connection Level` input, run through `normalizeDependencyDepth` so an empty or unparsable field yields the shared default rather than `NaN`.

## Behavior

This is where dependency direction and depth are edited for the whole report: both travel up to the root, which feeds the same values to the swimlane curves, so the dock and the timeline can never disagree. The three icon buttons the sketch annotates, left to right, as 仅展示前向依赖 / 展示前后向依赖 / 仅展示后向依赖 emit the mode directly; 前向 means what the task waits on, so the left button selects `predecessors` (Incoming only) and the right one `successors` (Outgoing only).

The walk blanks the suppressed side rather than dropping it, and the graph is three tracks — `[incoming chips + connector] | Current | [connector + outgoing chips]` — with both side tracks at `1fr`. So the Current pill holds the centre whatever the chips do: a longer neighbour name, or a direction filter emptying one side, moves nothing. Inside a side the chip column is content-sized (capped, then truncating) and the connector absorbs the slack, so a curve always spans chip edge to pill edge.

The component never traverses the model itself: it renders the neighbours it is given, so mode and depth semantics live in one place ([dependencies](../../../specs/core/dependencies.spec.md)).

Each button carries the sketch's node-graph glyph: a fan-in tree for upstream, a four-way node for both, a fan-out tree for downstream. The glyphs are drawn as SVG path data rather than an icon font, since the library ships no icon dependency — one path for the tree edges, one for the nodes.

Between the chip columns sit two connector columns: one SVG S-curve per neighbour, from the current chip's row to that neighbour's row, as in the sketch. Row geometry (chip height and pitch) is a constant shared with the stylesheet instead of a DOM measurement, so the curves need no layout pass.

Incoming and Outgoing carry count badges; the centre column carries none, matching the sketch. Chips truncate with an ellipsis and expose the full name via `title`. When both shown sides are empty — a selected event with no neighbours at the current depth, or a mode that filters the only populated side away — the graph is replaced by an empty note, keeping the toolbar usable so the user can widen the level.

## Acceptance Criteria

1. **PR-DREL-001** — Renders the Relevent shell with Incoming / Current / Outgoing columns and count badges.
1. **PR-DREL-002** — The three direction buttons render in sketch order (`predecessors`, `all`, `successors`), mark the active mode, and emit it on click.
1. **PR-DREL-003** — The connection-level input emits `update:depth`, normalized.
1. **PR-DREL-004** — Shows the empty note when neither side has neighbours.
1. **PR-DREL-005** — Draws one connector curve per incoming and outgoing neighbour.

## Visual

Normative crop: [`visual/relevant-graph.png`](./visual/relevant-graph.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

## Open

Chips are pinned to one line so the drawn connectors stay on their rows; a wrapping chip would drift from its curve. The swimlane-level overlay (`DependencyLinksLayer`) still has no geometry.

## Changelog
- **2026-08-20** — Chips centre their text through half-leading (`line-height` = the pill height, no vertical padding) instead of a hand-tuned 1px pad against a shorter line box. The old pair left ~1px of vertical slack, which Segoe UI's taller metrics consumed — parentheses and descenders clipped on Windows while Linux rendered clean.
- **2026-08-20** — Current stopped drifting: the graph went from five tracks to three with equal `1fr` sides, so an emptied or wider side no longer shifts the pill (measured 8-12px before, 0 after).
- **2026-08-20** — Connectors reach their chips again: the chip columns and the connector column now share one gap token (they had drifted to 8px vs 6px, putting every curve 2px off its row), and the chip tracks are `fit-content(--pr-chip-max)` rather than `auto`, which had sized each column to the *untruncated* name and left the curve short of the capped pill. The connector svg stretches across whatever gap is left, with a non-scaling stroke.
- **2026-08-20** — Geometry measured against the sketch's 4x export rather than eyeballed: 18px chips on a 26px pitch, 66px level field, 14px help glyph. Chips are content-sized — a flex column stretches its children by default, which had every chip spanning its whole track — and cap at 150px so a long name truncates instead of filling the column.
- **2026-08-20** — Direction glyphs redrawn as the sketch's node graphs: fatter dots joined by short links, not hairline trees.
- **2026-08-20** — Toolbar and chip surfaces sampled from the sketch: mode plate `#313131` with a `#464646` active cell, borderless `#313131` level field, neighbour chips `#3c3c3c`, and the Current chip its light `#d5bcff` lavender with dark text (it reads as the selection, not as a swimlane block).
- **2026-08-20** — Direction and depth moved here from 显示控制 and became `DependencyMode` / `dependencyDepth`, the same pair the swimlane curves read: both are now emitted upward instead of one living as local state. PR-DREL-002/003 restated.
- **2026-08-14** — Direction became local state and the component blanks the suppressed side itself, instead of relaying the choice through DetailPanel to the report. Same rendering.
- **2026-08-14** — Glyphs became one path pair per direction, and the two connector columns share one template. Same coordinates, same rendering.
- **2026-08-13** — Sketch node-graph glyphs; buttons follow the sketch's 前向 / 前后 / 后向 order; SVG connector curves replace the straight rails.
- **2026-08-13** — Direction filter, connection level, chip graph wired to the dependency model.
- **2026-08-10** — Stub + visual pack from `v930/detail-strip-raised`.
