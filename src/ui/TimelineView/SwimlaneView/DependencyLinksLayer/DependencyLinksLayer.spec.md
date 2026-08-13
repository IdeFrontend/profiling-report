# DependencyLinksLayer

| spec-id-prefix |
|----------------|
| PR-DEPS-*      |

SVG overlay of predecessor/successor Bezier curves for the selected swimlane event.

## Inputs

**paths** is the list of SVG `d` strings from `dependencyLinkPaths`. **width** / **height** match the canvas CSS pixel size so `viewBox` maps 1:1 onto event screen rects.

## Outputs

None — `pointer-events: none`. Clicks pass through to the canvas.

## Behavior

On selection, curves run from each predecessor's right-mid to the selected event's left-mid, and from the selected event's right-mid to each successor's left-mid. Color is `--pr-color-mov`. Linked events keep full fill and label brightness; other events stay dimmed. No selection, or an event with no `dependencies`, yields an empty overlay. Refs whose events are missing from layout (collapsed lanes) are skipped; off-screen endpoints still draw so the curve can leave the viewport.

Paths recompute when the viewport, selection, or layout changes.

## Acceptance Criteria

1. **PR-DEPS-001** — Selected event with deps yields predecessor and successor curves.
1. **PR-DEPS-002** — No selection or empty deps yields no paths.
1. **PR-DEPS-003** — Overlay renders one SVG path per computed `d` string.

## Visual

Crops: [`visual/dependency-links.png`](./visual/dependency-links.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

## Design sketches

- [dependency-links](./visual/dependency-links.png) — from `v930/task-click-detail`
- [Task click detail](../../../../../docs/ui/source/v930/task-click-detail.jpeg) — full frame

## Dependencies

[swimlane-model](../../../../../specs/core/swimlane-model.spec.md), [swimlane-renderer](../../../../../specs/core/swimlane-renderer.spec.md).

## Changelog
- **2026-08-13** — Selection Bezier overlay from `{tid, index}` EventRefs.
