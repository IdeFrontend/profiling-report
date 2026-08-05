# ReportToolbar

<!--
  spec-id-prefix: PR-TOOLBAR-*
  phase: MVP
  source: src/ui/ReportToolbar/ReportToolbar.vue
  test: src/ui/ReportToolbar/ReportToolbar.spec.ts
-->

Top toolbar with search, zoom controls, time unit selector, and aside panel toggle.

## Behavior

**Zoom controls.** Toolbar buttons signal intent — the parent ProfilingReport computes the actual zoom around the viewport center. The percentage slider shows the ratio of viewport span to total timeline span. Zoom-to-fit resets to full timeline.

**Aside toggle.** The toggle button is visible only when `asideAvailable` is true — hidden for standalone CTEF (Q15) since there are no CSV embeds and no data to display in the aside panel.

**Time unit switching.** Changing the time unit reformats all displayed times across the entire UI: axis ticks, tooltip, detail strip, playhead. The dropdown emits `update:timeUnit`; the parent propagates the new unit to all children via props.

**Search.** The search input uses v-model binding. The parent ProfilingReport passes the query to SwimlaneCanvas, which applies event name filtering in the renderer.

## Acceptance Criteria

1. **PR-TOOLBAR-001** — Emits `search` on query change.
2. **PR-TOOLBAR-002** — Emits `zoom-in` on button click.
3. **PR-TOOLBAR-003** — Emits `zoom-out` on button click.
4. **PR-TOOLBAR-004** — Emits `zoom-to-fit` on button click.
5. **PR-TOOLBAR-005** — Emits `update:timeUnit` on dropdown change.
6. **PR-TOOLBAR-006** — Emits `update:asideVisible` on toggle.

## Edge Cases

- asideAvailable=false → toggle button hidden.
- Search query initially empty, user types to filter.

## Design sketches

- [Entry overview](/docs/specs/ui/source/entry-overview.png)
