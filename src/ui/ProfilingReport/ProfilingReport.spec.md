# ProfilingReport

| spec-id-prefix |
|----------------|
| PR-ROOT-*      |

Root component and single owner of all interaction state. Orchestrates data loading, viewport management, and event coordination across child components.

## Inputs

The component works in two modes. In **auto-loading mode**, provide **source** — a binary buffer containing a `.rep` file or standalone CTEF JSON. The component detects, parses, and renders automatically. In **host-managed mode**, provide pre-parsed **swimlaneModel** and **reportModel** to skip the internal pipeline. **title** sets the panel header. **theme** and **locale** control presentation. **timeUnit** (ms/µs/ns) selects the display unit. **capabilities** gates Phase 2 features — an array of feature flag strings such as `'roofline'`, `'memoryDiagram'`, or `'dependencies'`. It is optional in auto-loading mode: the adapter derives capabilities from the source it just parsed and those apply on their own, so a host that passes only `source` still gets the panels its report can fill. A supplied array overrides them wholesale (host-managed mode has no adapter to ask). Adapter-derived flags never outlive their report: they are dropped when `source` is cleared, and they are ignored entirely once the host drives `swimlaneModel` / `reportModel`, which publish an empty capability set unless the host passes its own array.

## Outputs

Lifecycle events: **ready** fires once the report is loaded and the timeline is rendered. **select** fires with a `SelectedEvent` (id, name, startTime, duration, endTime) when the user clicks an event on the swimlane, or `null` when they click empty space. **error** fires with `{ message, cause? }` on load or parse failure. **open-hardware-details** is forwarded from StatsAside when the user clicks 更多 (aside also opens interim HardwareDetailsPanel when data exists, I-Q7a). **open-pipe-details** is forwarded when the user clicks PIPE 详情 (aside navigates to CSV details). **view-full-csv** forwards `{ fileName, text }` for 查看全部 (I-Q6d). Aside **close** is handled internally (`asideVisible = false`); it is not a root emit. The component does not expose internal view state — viewport, hover, and cursor are managed internally.

## Interaction flows

### Zoom

```mermaid
sequenceDiagram
    participant User
    participant Toolbar as ReportToolbar
    participant Canvas as SwimlaneCanvas
    participant Root as ProfilingReport
    participant State as viewState

    User->>Canvas: Ctrl+wheel
    Canvas->>Root: emit('zoom', [factor, anchorTime])
    Root->>State: zoomAt(view, factor, anchorTime, bounds)
    State-->>Root: new SwimlaneViewWindow
    Root->>Canvas: update view prop
    Root->>TimeOverviewBar: update startTime/endTime
    Root->>Toolbar: update zoomPercent

    User->>Toolbar: click + / - / zoom-to-fit
    Toolbar->>Root: emit('zoom-in' / 'zoom-out' / 'zoom-to-fit')
    Root->>State: zoomAt / zoomToFitWindow
    State-->>Root: new SwimlaneViewWindow
    Root->>Canvas: update view prop
    Root->>TimeOverviewBar: update startTime/endTime
    Root->>Toolbar: update zoomPercent
```

Ctrl+wheel zooms around cursor position. Toolbar buttons zoom around viewport center. All zoom operations are clamped to timeline bounds.

### Drag-pan

```mermaid
sequenceDiagram
    participant User
    participant Canvas as SwimlaneCanvas
    participant Root as ProfilingReport
    participant State as viewState

    User->>Canvas: pointerdown
    User->>Canvas: pointermove (while dragging)
    Canvas->>Root: emit('pan', deltaTime)
    Root->>State: panBy(view, deltaTime, bounds)
    State-->>Root: new SwimlaneViewWindow
    Root->>Canvas: update view prop
    Root->>TimeOverviewBar: update startTime/endTime
```

Drag-to-pan emits delta time continuously on every pointermove. Pan is clamped to timeline bounds. A 4px threshold on pointer-up suppresses the click-to-select when movement exceeded 4px.

### Hover, selection, tooltip

```mermaid
sequenceDiagram
    participant User
    participant Canvas as SwimlaneCanvas
    participant Root as ProfilingReport
    participant Tooltip as EventTooltip
    participant Detail as DetailPanel

    User->>Canvas: pointermove
    Canvas->>Root: emit('hover', [event, clientX, clientY])
    Canvas->>Root: emit('cursor', { time, xRatio })
    Root->>Tooltip: update (event, stylePos)
    Root->>Detail: (selected unchanged)

    User->>Canvas: click (<4px movement)
    Canvas->>Root: emit('select', SwimEvent)
    Root->>Detail: update selected event
    Root->>Root: clear hover, hide tooltip
```

Hover is transient: tooltip follows the cursor. Selection is persistent: detail strip shows until user clicks empty space. Clicking empty space emits `select(null)` — tooltip, selection, and detail strip all clear. A 4px threshold on pointer-up gates selection: movement >4px between pointerdown and pointerup suppresses the click-to-select. Pan emits continuously on every move while dragging.

### Search

```mermaid
sequenceDiagram
    participant User
    participant Toolbar as ReportToolbar
    participant Root as ProfilingReport
    participant Canvas as SwimlaneCanvas
    participant Renderer as CanvasSwimlaneRenderer

    User->>Toolbar: type search query
    Toolbar->>Root: emit('update:searchQuery', query)
    Root->>Root: viewState.searchQuery = query
    Root->>Canvas: update searchQuery prop
    Canvas->>Renderer: filter event names (substring, case-insensitive)
    Renderer->>Renderer: dim non-matching events (25% alpha)
```

The renderer applies event name filtering as a substring, case-insensitive match during draw. Events that match render at full opacity; non-matching events are dimmed to 25% alpha but remain visible and interactive (hover/select still work on dimmed events). Lanes with no matching events remain visible (empty lanes are not collapsed).

### Data loading

```mermaid
sequenceDiagram
    participant Host
    participant Root as ProfilingReport
    participant Loader as loadReportSource
    participant Adapter as adaptRep

    Host->>Root: set source prop
    Root->>Loader: loadReportSource(source)
    alt .rep binary (magic 'cann-rep')
        Loader->>Loader: parseRep(bytes)
        Loader->>Adapter: adaptRep(parsed)
        Adapter-->>Loader: { swimlaneModel, reportModel }
        Loader-->>Root: AdaptedReport with summary + pipeOccupancy
        Root->>Root: asideAvailable = true
    else standalone CTEF JSON
        Loader->>Loader: chromeTraceToSwimlane(trace)
        Loader-->>Root: AdaptedReport with empty reportModel
        Root->>Root: asideAvailable = false
    end
    Root->>Root: emit('ready')
```

Two loading paths produce different results: `.rep` enables full UI (swimlane + aside with summary and pipe occupancy), standalone CTEF enables swimlane only (aside auto-hides per Q15).

## Behavior

**Data loading.** When `source` is provided (without pre-parsed models), the component calls `loadReportSource`, which detects `.rep` (magic bytes) vs standalone CTEF JSON. A `.rep` binary produces a full report with swimlane, summary, and pipe occupancy. Standalone CTEF produces swimlane only — the report model's `summary` is empty and `pipeOccupancy` is `[]`.

**Aside availability.** `asideAvailable` is true when `summary.taskDurationUs` is set (I-Q6a duration card) or `pipeOccupancy` is non-empty. Name/type alone do not open the aside.

**State ownership.** ProfilingReport owns a single `SwimlaneViewState` object holding viewport bounds, selection, hover, search, playhead, and aside visibility. Children receive state as read-only props and emit events upward. All mutations create new object references to trigger Vue reactivity.

**Bounds protection.** When `maxTime === minTime`, bounds clamp adds +1 to prevent division by zero during zoom calculations.

**Viewport time axis.** Shares `AxisRuler` chrome with the overview strip. Tokens: [`AxisRuler.spec.md`](../AxisRuler/AxisRuler.spec.md).

**Cursor timestamp.** Playhead time bubble on the viewport — rendered by [`CursorTimestamp`](../CursorTimestamp/CursorTimestamp.spec.md).

**Resizable panels.** Lane gutter width (`--pr-gutter-width`, default 280, clamp 180–480) and aside width (default 360, clamp 280–560) are session-only; drag handles at the gutter/timeline seam and aside left edge. Clamps: [`ReportLayout.spec.md`](../ReportLayout/ReportLayout.spec.md).

**Aside auto-open.** Initial `asideVisible` follows `reportHasAsideContent` — summary, pipe occupancy, compute tables, or memory tables (same gate as the toolbar toggle).

**Dependency state (interim I-Q9).** The root owns the dependency graph and the connection level the detail dock's Relevent column reads. `hasDependencies` gates the build: a model without edges keeps a `null` graph rather than two event-sized `Map`s, and the dock is handed no neighbours, so the column never mounts. Depth changes the walk, so `level` lives here and travels down as a prop; it resets to unlimited with the rest of the view on every model load, so a depth typed on one report does not carry into the next. The direction filter never leaves [DetailRelevant](../DetailPanel/DetailRelevant/DetailRelevant.spec.md). Neighbour semantics — cap, ordering, cycles — belong to [dependencies](../../../specs/core/dependencies.spec.md).

## Visual

(Orchestration only — component chrome lives in child specs. Panel clamps: [`ReportLayout.spec.md`](../ReportLayout/ReportLayout.spec.md).)

## Acceptance Criteria

1. **PR-ROOT-001** — Mounts with title, shows shell, handles empty source.
2. **PR-ROOT-002** — Accepts pre-parsed swimlaneModel and reportModel.
3. **PR-ROOT-003** — Auto-loaded sources apply the adapter's capabilities; the prop overrides them; host-managed models and a removed `source` publish none.

## Edge Cases

| State | Behavior |
|---|---|
| Empty source | Empty shell, no error |
| Corrupt/invalid `.rep` | Emits error with message, shows error in shell |
| `.rep` missing `trace.json` | Swimlane stays null, error displayed |
| Standalone CTEF | Swimlane renders, aside auto-hides, no error |
| `maxTime === minTime` | Bounds clamp adds +1 to prevent division by zero |

## Design sketches

- [Entry overview with sidebar](../../../docs/ui/source/v930/entry.jpeg)
- [Report stats](../../../docs/ui/source/v930/report-stats-open.jpeg)
- [v930 entry](../../../docs/ui/source/v930/entry.jpeg) — full layout context

## Dependencies

All child component specs. [CursorTimestamp](../CursorTimestamp/CursorTimestamp.spec.md). [mstt-integration](../../../specs/architecture/mstt-integration.spec.md).

**Input formats:** [REP_FORMAT.md](../../../docs/formats/REP_FORMAT.md) (`.rep` binary container), [INPUT_FORMATS.md](../../../docs/formats/INPUT_FORMATS.md) (embedded file contract), [METRICS_AND_TRACE.md](../../../docs/formats/METRICS_AND_TRACE.md) (CSV schemas and file-to-UI mapping).

## Open

Q3 (OP selector semantics), Q15 (standalone CTEF hides aside).

## Changelog
- **2026-08-19** — Adapter capabilities no longer leak: cleared when `source` is removed and ignored while the host drives `swimlaneModel` / `reportModel`; `dependencyLevel` resets with the view on model load.
- **2026-08-18** — PR-ROOT-003: auto-loaded sources apply the capabilities the adapter derived; previously `loadReportSource` computed them and the component dropped them, so `.rep` reports rendered with none unless the host repeated the array.
- **2026-08-18** — Owns the interim I-Q9 dependency graph and connection level for the detail dock's Relevent column; `capabilities` gained `'dependencies'`.
- **2026-08-07** — `reportHasAsideContent` includes compute/memory CSV; PR-UI-008.
- **2026-08-07** — Resizable lane gutter and aside (session-only widths).
- **2026-08-07** — Viewport time axis shares AxisRuler chrome with overview.
- **2026-08-05** — Initial spec. Core behaviors established.
