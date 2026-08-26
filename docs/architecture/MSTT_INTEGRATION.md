# MSTT Integration

How the profiling-report Vue library plugs into Huawei OP DevTools (`mstt`) beside MindStudio Insight.

## Viewer boundary

| File type | Viewer |
|-----------|--------|
| `.csv` | Existing `CsvEditorProvider` |
| `.bin` | **MindStudio Insight** (`InsightDataViewerPanel` + `profiler_server`) — unchanged |
| `.json` | **profiling-report** when the file is Chrome Trace (same swimlane path as embedded `trace.json`; analytics aside hidden without CSV pack). Non-trace JSON policy: host decides; default do not send opaque Insight JSON here. |
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
2. **Open dispatch:** branch `openPerformanceFile` / `ViewOpener` for `.rep` / `.ncrep` **and** Chrome Trace `.json` → profiling-report panel; keep `.bin` → `openInsight`.
3. **Panel registration:** flavor/constants panel type id; contribute to `package.json` views/commands as needed.
4. **Dependency:** workspace package or npm link to profiling-report; Vite resolves Vue SFC from the library.
5. **i18n:** strings for “Profiling report”, load errors, etc.

## Message split (optional)

If the panel HTML is thin and the library runs entirely in the webview:

- Extension → webview: `{ type: 'load', bytes: ArrayBuffer, fileName, theme, locale }`
- Webview → extension: `{ type: 'ready' | 'error' | 'select', … }`

Prefer feeding the library via Vue props inside the webview when possible; use postMessage only for host capabilities (save dialog, open external, theme push).

### Fonts

Default typeface is **system UI** (`fontFamily="system"`): no HarmonyOS woff2 download. To enable HarmonyOS Sans SC:

```vue
<ProfilingReport :source="…" font-family="harmony" />
```

That lazy-loads `@font-face` rules and switches canvas event labels to the Harmony stack. Keep the library `style.css` (tokens + components) always; faces are not bundled into the default CSS entry.

Hosts that prefer a static import can also load faces via the package export `@huawei/profiling-report/fonts.css` (still pass `font-family="harmony"` so canvas matches).

Playground A/B: `?fonts=harmony` (default) or `?fonts=system`.

**查看全部 (I-Q6d):** when the library emits `view-full-csv` with `{ fileName, text }`, the host should open the CSV in a **new editor tab** (or equivalent). Playground may use a blob URL in a new browser tab.

## Capabilities

Host may pass capability flags so the library hides Phase 2 UI until ready. **Canonical union** is defined in [COMPONENTS.md](COMPONENTS.md) (`ReportCapability`), including at least:

`roofline` | `memoryDiagram` | `dependencies` | `hardwareDetails` | `sourceTab` | `cacheTab` | `aicpu` | `measureMode`

MVP/M1 host can pass `[]` or omit; library shows summary, PIPE, M1 detail tabs, and timeline without requiring capability flags for those. `memoryDiagram` / `roofline` / measure chrome may be gated.

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
