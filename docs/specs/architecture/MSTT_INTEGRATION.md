# MSTT Integration

How the profiling-report Vue library plugs into Huawei OP DevTools (`mstt`) beside MindStudio Insight.

## Viewer boundary

| File type | Viewer |
|-----------|--------|
| `.csv` | Existing `CsvEditorProvider` |
| `.bin` | **MindStudio Insight** (`InsightDataViewerPanel` + `profiler_server`) — unchanged |
| `.json` | Insight today (revisit later if pure Chrome Trace should open profiling-report) |
| `.rep` / `.ncrep` | **profiling-report** panel (new) |

Do **not** inject the library into Insight iframes. Insight remains a sealed third-party shell.

## Integration pattern

Mirror first-party Vue panels such as `StTestResultsPanel`:

1. Add a webview panel entry under MSTT `web/src/views/panels/profiling-report/` (name TBD).
2. Depend on the profiling-report package from the `web` workspace.
3. Host class (`ProfilingReportPanel` or similar): `createOrShow`, `HtmlTransformer` / Vite multi-entry HTML, typed postMessage if the panel shell needs extension APIs.
4. Pass report bytes (or path → extension reads file → posts buffer) into the Vue app; mount `<ProfilingReport :source="…" />`.

Relevant existing MSTT touchpoints (paths may drift; search symbols):

| Step | Location (approx.) |
|------|--------------------|
| Performance file open | `plugin/src/class/operate-tree-provider.ts` → `openPerformanceFile` |
| View facade | `plugin/src/service/view-service.ts` |
| Opener | `plugin/src/core/view/view-opener.ts` |
| Insight panel | `plugin/src/class/insight-data-viewer-panel.ts` |
| Results scan | `plugin/src/core/performance/performance-run-data.ts` (`csv` \| `bin` \| `json` today) |
| Vue panel example | `plugin/src/class/st-test-results-panel.ts` + `web/src/views/panels/st-test-results/` |
| Architecture doc | `mstt/docs/performance.md` |

## Required MSTT changes (implementation phase)

1. **Scan / tree:** include `.rep` / `.ncrep` in performance result file discovery (`PerformanceRunData.scanSubFiles` or equivalent).
2. **Open dispatch:** branch `openPerformanceFile` / `ViewOpener` for report extensions → profiling-report panel; keep `.bin` → `openInsight`.
3. **Panel registration:** flavor/constants panel type id; contribute to `package.json` views/commands as needed.
4. **Dependency:** workspace package or npm link to profiling-report; Vite resolves Vue SFC from the library.
5. **i18n:** strings for “Profiling report”, load errors, etc.

## Message split (optional)

If the panel HTML is thin and the library runs entirely in the webview:

- Extension → webview: `{ type: 'load', bytes: ArrayBuffer, fileName, theme, locale }`
- Webview → extension: `{ type: 'ready' | 'error' | 'select', … }`

Prefer feeding the library via Vue props inside the webview when possible; use postMessage only for host capabilities (save dialog, open external, theme push).

## Capabilities

Host may pass capability flags so the library hides Phase 2 UI until ready. **Canonical union** is defined in [COMPONENTS.md](COMPONENTS.md) (`ReportCapability`), including at least:

`roofline` | `memoryDiagram` | `dependencies` | `hardwareDetails` | `sourceTab` | `cacheTab` | `aicpu`

MVP host can pass `[]` or omit; library shows MVP surfaces (summary, PIPE bars, timeline) without requiring capability flags for those.

## Non-goals for MSTT in v1

- Removing Insight download / `profiler_server` for `.bin`
- Replacing CSV custom editor
- Building a Vue performance-results tree (native tree stays)

## Success check

From an OP project with `opprof` (or `fileMapList`) containing a `.ncrep` / `.rep`:

1. File appears in Performance results tree.
2. Click opens profiling-report panel (not Insight).
3. Swimlane + PIPE stats render from embedded data.
4. Clicking a `.bin` still opens Insight.
