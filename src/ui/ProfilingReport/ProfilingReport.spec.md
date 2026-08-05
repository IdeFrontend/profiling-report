# ProfilingReport

<!--
  spec-id-prefix: PR-ROOT-*
  phase: MVP
  source: src/ui/ProfilingReport/ProfilingReport.vue
  test: src/ui/ProfilingReport/ProfilingReport.spec.ts
-->

Root component and single owner of all interaction state. Orchestrates data loading, viewport management, and event coordination across child components.

## Inputs

The component works in two modes. In **auto-loading mode**, provide **source** — a binary buffer containing a `.rep` file or standalone CTEF JSON. The component detects, parses, and renders automatically. In **host-managed mode**, provide pre-parsed **swimlaneModel** and **reportModel** to skip the internal pipeline. **title** sets the panel header. **theme** and **locale** control presentation. **timeUnit** (ms/µs/ns) selects the display unit. **capabilities** gates Phase 2 features — an array of feature flag strings such as `'roofline'` or `'memoryDiagram'`.

## Outputs

Three lifecycle events: **ready** fires once the report is loaded and the timeline is rendered. **select** fires with a `SelectedEvent` (id, name, startTime, duration, endTime) when the user clicks an event on the swimlane, or `null` when they click empty space. **error** fires with `{ message, cause? }` on load or parse failure. The component does not expose internal view state — viewport, hover, and cursor are managed internally.

## Behavior

**Data loading.** When `source` is provided (without pre-parsed models), the component calls `loadReportSource`, which detects `.rep` (magic bytes) vs standalone CTEF JSON. A `.rep` binary produces a full report with swimlane, summary, and pipe occupancy. Standalone CTEF produces swimlane only — the report model's `summary` is empty and `pipeOccupancy` is `[]`.

**Right panel visibility.** The aside panel auto-hides when there is no report data to display — specifically for standalone CTEF (Q15) since no CSV embeds exist. It shows when a `.rep` source provides summary statistics and pipe occupancy.

**State ownership.** ProfilingReport owns a single `SwimlaneViewState` object holding viewport bounds, selection, hover, search, playhead, and aside visibility. Children receive state as read-only props and emit events upward. All mutations create new object references to trigger Vue reactivity.

**Zoom and pan flow.** Ctrl+wheel zooms around the cursor position. Toolbar +/- zooms around the viewport center. Drag-to-pan on the canvas has a 4px threshold to prevent accidental selections. All operations are clamped to timeline bounds with protection against `maxTime === minTime` (adds +1 to prevent zero division).

**Hover, selection, tooltip lifecycle.** Pointer move on the canvas performs hit test, emits hover (with clientX/clientY for tooltip positioning) and cursor (time + xRatio for the playhead). Click sets selection. Click on empty area clears selection. The tooltip is positioned from client coordinates; the detail strip shows the persistent selection.

## Acceptance Criteria

1. **PR-ROOT-001** — Mounts with title, shows shell, handles empty source.
2. **PR-ROOT-002** — Accepts pre-parsed swimlaneModel and reportModel.

## Edge Cases

- Empty source → empty shell with no error.
- Corrupt/invalid `.rep` → emits error event, shows error in shell.
- `.rep` with missing `trace.json` → swimlane stays null, error displayed.
- Standalone CTEF → swimlane renders, aside auto-hides, no error.

## Design sketches

- [Entry overview with sidebar](/docs/specs/ui/source/entry-overview.png)
- [Report stats](/docs/specs/ui/source/report-stats.png)

## Dependencies

All child component specs. [mstt-integration](/specs/architecture/mstt-integration.spec.md).

## Open

Q3 (OP selector semantics), Q15 (standalone CTEF hides aside).
