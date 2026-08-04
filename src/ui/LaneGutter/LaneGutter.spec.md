# LaneGutter

<!--
  metadata
  spec-id-prefix: PR-GUTTER-*
  phase: MVP
  owner: -
  last-updated: 2026-08-04
  source: src/ui/LaneGutter/LaneGutter.vue
  test: src/ui/LaneGutter/LaneGutter.spec.ts
-->

## Purpose

Vertical lane gutter showing thread/process names and utilization percentages alongside the swimlane canvas.

## Inputs / Outputs

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| groups | GutterGroup[] | yes | — | Lane groups with id, name, and lanes |

### Emits

| Event | Payload | Description |
|-------|---------|-------------|
| scroll | [] | Gutter scrolled (parent syncs swimlane scroll) |

## Behavior

- Renders process group headers and thread lanes.
- Shows utilization percentage per thread when available.
- Emits scroll event for swimlane scroll synchronization.
- Exposes root element via defineExpose for scroll sync.

## Acceptance Criteria

1. **PR-GUTTER-001**: Renders lane names for each provided group and thread.
1. **PR-GUTTER-002**: Shows utilization percentage when provided.

## Edge Cases

- Empty groups array — renders empty gutter.
- Very long thread names — truncated (CSS handles).

## Dependencies

- [specs/core/utilization.spec.md] — utilization computation.

## Open Questions

- None.
