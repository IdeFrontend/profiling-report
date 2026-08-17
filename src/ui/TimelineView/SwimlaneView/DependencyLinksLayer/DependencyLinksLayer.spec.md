# DependencyLinksLayer

| spec-id-prefix |
|----------------|
| PR-DEPS-*      |

Predecessor/successor Bezier curves for the selected swimlane event. WebGL2 draws an instanced polyline strip; Canvas 2D is the fallback.

## Inputs

**layout**, **selectedEventId**, **dependencyMode** (`all` / `predecessors` / `successors`, default `all`), and **dependencyDepth** (hops from the selection; default `1`; `-1` = no hop cap; `0` = no neighbor curves). Each walk direction stops after `MAX_DEPENDENCY_LINKS` (10 000). Endpoint times and content-space Y come from laid-out events (`dependencyLinks`). `EventRef` `{tid, index}` resolves through `lanesByTid` + `eventsById` (thread.events order, not duration-sorted `layout.events`). Overlay caches neighbor ids; Canvas fallback caches neighbor ids and `DependencyLink[]`. Both rebuild only when layout identity, `selectedId`, `dependencyMode`, or `dependencyDepth` changes. The WebGL pass applies pan/zoom/scroll as uniforms so the instance buffer is rebuilt only on selection/layout/mode/depth change. Canvas skips links whose `[t0, t1]` span sits entirely outside the time window.

## Outputs

None — curves are not hit-tested. Pointer events stay on the swimlane canvas.

## Behavior

On selection, curves run from each predecessor's right-mid to the selected event's left-mid, and from the selected event's right-mid to each successor's left-mid, filtered by **dependencyMode** and walked **dependencyDepth** hops along that direction (`-1` walks until the graph or the per-side link budget ends). Stroke is a linear gradient from the predecessor block fill to the successor block fill (3px). WebGL evaluates the same cubic as Canvas (`pull = max(24, |x1−x0|×0.4)`), one instance per link. Linked events in the active mode and depth keep full fill and label brightness; other events stay dimmed. No selection, or an event with no `dependencies`, yields no curves. Refs whose events are missing from layout (collapsed lanes) are skipped; off-screen endpoints still draw so the curve can leave the viewport, except Canvas omits links wholly outside the time window.

## Acceptance Criteria

1. **PR-DEPS-001** — Selected event with deps yields predecessor and successor curves.
1. **PR-DEPS-002** — No selection or empty deps yields no paths.
1. **PR-DEPS-003** — Canvas and WebGL paint selected dependency curves without throw.
1. **PR-DEPS-004** — Each curve gradient runs from predecessor fill to successor fill.
1. **PR-DEPS-005** — `dependencyMode` `predecessors` / `successors` shows only that side's curves and undimmed neighbors.
1. **PR-DEPS-006** — `dependencyDepth` `n` draws `n` hops; `-1` has no hop cap; `0` draws no neighbor curves.
1. **PR-DEPS-007** — Each walk direction stops after `MAX_DEPENDENCY_LINKS` new links.
1. **PR-DEPS-008** — Canvas fallback does not recompute the dependency graph on pan or re-render.

## Visual

Crops: [`visual/dependency-links.png`](./visual/dependency-links.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

## Design sketches

- [dependency-links](./visual/dependency-links.png) — from `v930/task-click-detail`
- [Task click detail](../../../../../docs/ui/source/v930/task-click-detail.jpeg) — full frame

## Dependencies

[swimlane-model](../../../../../specs/core/swimlane-model.spec.md), [swimlane-renderer](../../../../../specs/core/swimlane-renderer.spec.md).

## Changelog
- **2026-08-17** — Canvas fallback caches `DependencyLink[]` with neighbor ids; PR-DEPS-008.
- **2026-08-17** — Per-side `MAX_DEPENDENCY_LINKS` BFS budget; Canvas time-window cull; PR-DEPS-007.
- **2026-08-17** — `dependencyDepth` hops (default 1, −1 no hop cap); PR-DEPS-006.
- **2026-08-14** — `dependencyMode` filters pred/succ curves without reload; PR-DEPS-005.
- **2026-08-14** — Layout indexes + cached neighbor set so pan/hover does not rescan events.
- **2026-08-14** — WebGL instanced polyline (Canvas 2D fallback); drop SVG overlay.
- **2026-08-14** — Curve stroke interpolates predecessor → successor block fill.
- **2026-08-13** — Selection Bezier overlay from `{tid, index}` EventRefs.
