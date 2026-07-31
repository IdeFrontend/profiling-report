# Profiling Report — Documentation Index

English documentation and specifications for the reusable Vue profiling-report library.

## Reading order

1. **[context/PROJECT_GOALS.md](context/PROJECT_GOALS.md)** — why this project exists, consumers, MVP vs later, success criteria
2. **[specs/formats/FORMATS_COMPARISON.md](specs/formats/FORMATS_COMPARISON.md)** — legacy Insight vs `.rep` vs PyPTO
3. **[specs/formats/REP_FORMAT.md](specs/formats/REP_FORMAT.md)** — CANN `.rep` / `.ncrep` container layout
4. **[specs/formats/METRICS_AND_TRACE.md](specs/formats/METRICS_AND_TRACE.md)** — embedded CSVs and `trace.json`
5. **[specs/ui/UI_OVERVIEW.md](specs/ui/UI_OVERVIEW.md)** — layout regions mapped to design sketches
6. **[specs/ui/FEATURE_MATRIX.md](specs/ui/FEATURE_MATRIX.md)** — MVP vs Phase 2+ feature list
7. **[specs/ui/INTERACTIONS.md](specs/ui/INTERACTIONS.md)** — hover, selection, multiselect, menus
8. **[specs/architecture/ARCHITECTURE.md](specs/architecture/ARCHITECTURE.md)** — Vue library modules and data flow
9. **[specs/architecture/MSTT_INTEGRATION.md](specs/architecture/MSTT_INTEGRATION.md)** — how MSTT opens `.rep` beside Insight
10. **[research/SWIMLANE_IMPLEMENTATIONS.md](research/SWIMLANE_IMPLEMENTATIONS.md)** — PyPTO Canvas vs Sudu WebGL vs hybrid

## Design sketches

PNG mockups live under [`specs/ui/`](specs/ui/). Written UI specs reference them by filename.

## Research archive

| Doc | Role |
|-----|------|
| [research/SWIMLANE_WEBVIEW_REUSE_REPORT.md](research/SWIMLANE_WEBVIEW_REUSE_REPORT.md) | Original PyPTO reuse study (Russian). Conclusions superseded in English by architecture + swimlane comparison docs — packaging is a **Vue library**, not an HTML webview bundle. |
| [research/SWIMLANE_IMPLEMENTATIONS.md](research/SWIMLANE_IMPLEMENTATIONS.md) | Current English comparison and technical recommendation |

## Related repositories (local)

| Repo | Role |
|------|------|
| `mstt` | Primary host — OP DevTools; today embeds msinsight for `.bin`/`.json` |
| `msinsight` | Legacy MindStudio Insight viewer |
| `pypto-tools` | UX reference and optional copy-paste source for swimlane algorithms |
| `sudu-editor` (`pp/swimlane-shader`) | WebGL coverage-AA technique reference (not a dependency) |
