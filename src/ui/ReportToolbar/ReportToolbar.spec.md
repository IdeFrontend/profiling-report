# ReportToolbar

| spec-id-prefix |
|----------------|
| PR-TOOLBAR-*   |

Top toolbar with search, zoom controls, time unit selector, and aside panel toggle.

## Inputs

All inputs reflect current state owned by the parent: **searchQuery** drives the search input via v-model, **zoomPercent** fills the slider (log2-scaled integer: 0=fit, higher=zoom-in), **timeUnit** sets the dropdown selection (ms/µs/ns), **asideVisible** and **asideAvailable** control toggle button state and visibility. Optional **locale** localizes button labels. Optional **title** shows in the toolbar header.

## Outputs

The toolbar emits user intent, not computed results. **zoom-in**, **zoom-out**, **zoom-to-fit** signal button clicks — the parent ProfilingReport computes the actual zoom. **update:zoomPercent** carries the slider value. **update:searchQuery** carries text input. **update:timeUnit** carries the selected unit. **update:asideVisible** toggles the panel.

## Behavior

**Zoom controls.** Toolbar buttons signal intent — the parent computes zoom around the viewport center.

**Aside toggle.** Visible only when `asideAvailable` is true.

**Time unit switching.** Reformats displayed times across the UI.

**Measure (M2).** Caliper button toggles measure mode; active state reflected in UI.

## Acceptance Criteria

1. **PR-TOOLBAR-001** — Emits update:searchQuery on text input.
2. **PR-TOOLBAR-002** — Emits zoom-in on button click.
3. **PR-TOOLBAR-003** — Emits `zoom-out` on button click.
4. **PR-TOOLBAR-004** — Emits `zoom-to-fit` on button click.
5. **PR-TOOLBAR-005** — Emits `update:timeUnit` on dropdown change.
6. **PR-TOOLBAR-006** — Emits `update:asideVisible` on toggle.
7. **PR-TOOLBAR-007** — Emits `update:measureMode` when measure button clicked.

## Edge Cases

- asideAvailable=false → toggle button hidden.
- Search query initially empty, user types to filter.

## Design sketches

- [Entry overview](../../../docs/specs/ui/source/entry-overview.png)
- [changes.png](../../../docs/source/changes/changes.png) #1

## Changelog
- **2026-08-07** — Measure mode toggle (M2) on existing toolbar.
- **2026-08-05** — Initial spec.
