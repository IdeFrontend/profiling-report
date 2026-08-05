# ProfilingReport

<!--
  spec-id-prefix: PR-ROOT-*
  phase: MVP
  source: src/ui/ProfilingReport/ProfilingReport.vue
  test: src/ui/ProfilingReport/ProfilingReport.spec.ts
-->

Root component — the single owner of all interaction state. Orchestrates data loading, viewport management, and event coordination across child components.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| title | string | no | undefined | Panel title |
| source | ArrayBuffer or Uint8Array | no | undefined | Report binary (`.rep` or standalone CTEF) |
| swimlaneModel | SwimlaneModel | no | undefined | Pre-parsed swimlane — skips parse+adapt |
| reportModel | ReportViewModel | no | undefined | Pre-parsed report — skips parse+adapt |
| theme | `'light'` / `'dark'` | no | undefined | Theme variant |
| locale | string | no | undefined | Locale code for UI labels |
| timeUnit | TimeDisplayUnit | no | `'ms'` | Time display unit |
| capabilities | ReportCapability[] | no | undefined | Feature flags |

## Emits

| Event | Payload | Description |
|-------|---------|-------------|
| ready | — | Fires after source is parsed and models are loaded |
| select | SelectedEvent or null | Event selected or deselected by user |
| error | { message, cause? } | Load/parse failure |

## Behavior

**Data loading.** When `source` is provided (without pre-parsed models), the component calls `loadReportSource`, which detects `.rep` vs standalone CTEF by magic bytes. A `.rep` binary produces a full `AdaptedReport` with swimlane, report summary, and pipe occupancy. Standalone CTEF JSON produces swimlane only — the report model's `summary` is empty and `pipeOccupancy` is `[]`. Pre-parsed models skip all loading.

**Right panel visibility.** The aside panel auto-hides when there is no report data to display. It hides for standalone CTEF (per Q15) since there are no CSV embeds. It shows when a `.rep` source provides summary statistics and pipe occupancy.

**State ownership.** ProfilingReport owns `SwimlaneViewState` — a single object holding viewport bounds, selection, hover, search, playhead, and aside visibility. Children receive state as read-only props and emit events upward. All mutations create new object references to trigger reactivity.

**Zoom and pan.** Cursor-wheel (Ctrl+wheel) zooms around the cursor position. Toolbar +/- buttons zoom around the viewport center. Drag-to-pan has a 4px threshold to avoid accidental selection triggers. All zoom/pan operations are clamped to timeline bounds via `zoomAt`/`panBy` with bounds protection against `maxTime === minTime`.

**Hover, selection, tooltip.** Pointer move on the swimlane canvas performs `hitTest`, emits hover (with clientX/clientY for tooltip positioning) and cursor (time + xRatio for the playhead). Click sets selection. Click on empty area clears selection. The EventTooltip is positioned via `stylePos` computed from client coordinates. The DetailStrip shows the selected event.

**Error handling.** Invalid source emits `error`. Failed parse results in a `loadError` string displayed in the shell. The playbackhead and overview can be toggled off via the toolbar toggle.

## Acceptance Criteria

1. **PR-ROOT-001**: Mounts with title prop, shows profiling-report shell, handles empty source gracefully.
1. **PR-ROOT-002**: Accepts pre-parsed swimlaneModel and reportModel, skipping parse+adapt.

## Edge Cases

- Empty source → empty shell with no error.
- Corrupt/invalid `.rep` → emits error event.
- `.rep` with missing `trace.json` → swimlane stays null, error displayed.
- Standalone CTEF → swimlane renders, aside auto-hides.

## Design sketches

- [Entry overview with sidebar](/docs/specs/ui/source/entry-overview.png)
- [Report stats](/docs/specs/ui/source/report-stats.png)

**Dependencies:** All child component specs, [mstt-integration](/specs/architecture/mstt-integration.spec.md).

**Open:** Q3 (OP selector), Q15 (standalone CTEF hides aside).
