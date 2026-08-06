# ReportToolbar

| spec-id-prefix |
|----------------|
| PR-TOOLBAR-*   |

Top toolbar with search, zoom controls, time unit selector, and aside panel toggle.

## Inputs

All inputs reflect current state owned by the parent: **searchQuery** drives the search input via v-model, **zoomPercent** fills the slider (log2-scaled integer: 0=fit, higher=zoom-in), **timeUnit** sets the dropdown selection (ms/µs/ns), **asideVisible** and **asideAvailable** control toggle button state and visibility. Optional **locale** localizes button labels. Optional **title** shows in the toolbar header.

## Outputs

The toolbar emits user intent, not computed results. **zoom-in**, **zoom-out**, **zoom-to-fit** signal button clicks — the parent ProfilingReport computes the actual zoom. **update:zoomPercent** carries the slider value (a log2-scaled integer where 0=fit, higher=zoom-in). **update:searchQuery** carries text input. **update:timeUnit** carries the selected unit. **update:asideVisible** toggles the panel. The parent translates all of these into viewport state changes.

## Behavior

**Zoom controls.** Toolbar buttons signal intent — the parent ProfilingReport computes the actual zoom around the viewport center. The percentage slider shows the ratio of viewport span to total timeline span. Zoom-to-fit resets to full timeline.

**Aside toggle.** The toggle button is visible only when `asideAvailable` is true — hidden for standalone CTEF (Q15) since there are no CSV embeds and no data to display in the aside panel.

**Time unit switching.** Changing the time unit reformats all displayed times across the entire UI: axis ticks, tooltip, detail strip, playhead. The dropdown emits `update:timeUnit`; the parent propagates the new unit to all children via props.

**Search.** The search input uses v-model binding. The parent ProfilingReport passes the query to SwimlaneCanvas, which applies event name filtering in the renderer.

## Acceptance Criteria

1. **PR-TOOLBAR-001** — Emits update:searchQuery on text input.
2. **PR-TOOLBAR-002** — Emits zoom-in on button click.
3. **PR-TOOLBAR-003** — Emits `zoom-out` on button click.
4. **PR-TOOLBAR-004** — Emits `zoom-to-fit` on button click.
5. **PR-TOOLBAR-005** — Emits `update:timeUnit` on dropdown change.
6. **PR-TOOLBAR-006** — Emits `update:asideVisible` on toggle.

## Edge Cases

- asideAvailable=false → toggle button hidden.
- Search query initially empty, user types to filter.

## Design sketches

- [Entry overview](../../../docs/specs/ui/source/entry-overview.png)

## Changelog
- **2026-08-05** — Initial spec. Core behaviors established.
