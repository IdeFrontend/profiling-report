# LaneGutter

<!--
  spec-id-prefix: PR-GUTTER-*
  phase: MVP
  source: src/ui/LaneGutter/LaneGutter.vue
  test: src/ui/LaneGutter/LaneGutter.spec.ts
-->

Vertical lane gutter: process/thread names and utilization % alongside swimlane.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| groups | GutterGroup[] | yes | — | { id, name, lanes: { id, name, color, utilization? }[] } |

## Emits

| Event | Payload | Description |
|-------|---------|-------------|
| scroll | — | Parent syncs swimlane scroll |

**Behavior:** Renders process group headers and thread lanes with utilization %. Exposes root element via defineExpose for scroll sync.

- [Entry overview](/docs/specs/ui/source/entry-overview.png) — left gutter

## Acceptance Criteria

1. **PR-GUTTER-001**: Renders lane names for each group.
1. **PR-GUTTER-002**: Shows utilization % when provided.

## Edge Cases

- Empty groups → empty gutter. Long names → CSS truncation.

**Dependencies:** [utilization](/specs/core/utilization.spec.md).
