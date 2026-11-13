# MSTT Integration

How the profiling-report Vue library plugs into Huawei OP DevTools (`mstt`) beside MindStudio Insight.

## Viewer boundary

| File type | Viewer |
|-----------|--------|
| `.csv` | Existing `CsvEditorProvider` |
| `.bin` | **MindStudio Insight** (`InsightDataViewerPanel` + `profiler_server`) — unchanged |
| `.json` | **profiling-report** when the file is Chrome Trace (same swimlane path as embedded `trace.json`; analytics aside hidden without CSV pack). Non-trace JSON policy: host decides; default do not send opaque Insight JSON here. |
| `.npu-rep` | **profiling-report** panel ([PROC-2](../context/decisions/PROC.md)). Hardware or **simulator** leaf — library detects via `manifest.json` ([PROC-8](../context/decisions/PROC.md)); host does **not** need a second extension ([PROC-6](../context/decisions/PROC.md)). |

Do **not** inject the library into Insight iframes. Insight remains a sealed third-party shell.

## Integration pattern

Mirror first-party Vue panels such as `StTestResultsPanel`:

1. Add a webview panel entry under MSTT `web/src/views/panels/profiling-report/` (name TBD).
2. Depend on the profiling-report package from the `web` workspace.
3. Host class (`ProfilingReportPanel` or similar): `createOrShow`, `HtmlTransformer` / Vite multi-entry HTML, typed postMessage if the panel shell needs extension APIs.
4. Pass report bytes (or path → extension reads file → posts buffer) into the Vue app; mount `<ProfilingReport :source="…" />`. Do **not** pass `allowHtmlExport` (it defaults false). Offline HTML is engineer/CI share-out via `npu-rep-html`, not the MSTT webview packaging form. Hosts that want in-viewer download must serve `/npu-rep-html-template.txt` and pass `allowHtmlExport`.

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

1. **Scan / tree:** include `.npu-rep` in performance result file discovery (`PerformanceRunData.scanSubFiles` or equivalent).
2. **Open dispatch:** branch `openPerformanceFile` / `ViewOpener` for `.npu-rep` **and** Chrome Trace `.json` → profiling-report panel; keep `.bin` → `openInsight`. Do **not** register `.rep` / `.ncrep` as product open types ([PROC-2](../context/decisions/PROC.md)).
3. **Panel registration:** flavor/constants panel type id; contribute to `package.json` views/commands as needed.
4. **Dependency:** workspace package or npm link to profiling-report; Vite resolves Vue SFC from the library.
5. **i18n:** host-owned strings for “Profiling report”, load errors, etc. Map IDE/extension language → `locale` (`zh-CN` \| `en`, or `zh*` / `en*` prefixes) and pass it into the library. Library chrome uses [`src/i18n`](../../src/i18n/index.ts); see [LOCALIZATION.md](../ui/LOCALIZATION.md).
6. **User guide:** library emits `open-user-guide` with the URL and also attempts `window.open`. Optional `userGuideUrl` on `<ProfilingReport>` overrides the library default (`https://gitcode.com/opdevtools/plugin_release/blob/main/README.md#profiling-report-用户指南`). That page is Chinese-only; English hosts should pass their own guide URL until a locale-aware page exists. In MSTT webviews, listen for `open-user-guide` and call `openExternal` (webview may block `window.open`).

## Message split (optional)

If the panel HTML is thin and the library runs entirely in the webview:

- Extension → webview: `{ type: 'load', bytes: ArrayBuffer, fileName, theme, locale }` (and theme/locale push messages when the IDE language changes)
- Webview → extension: `{ type: 'ready' | 'error' | 'select', … }`

Prefer feeding the library via Vue props inside the webview when possible (`:locale="locale"`); use postMessage only for host capabilities (save dialog, open external, theme/locale push).

**查看全部 (DATA-33d):** when the library emits `view-full-csv` with `{ fileName, text }`, the host should open the CSV in a **new editor tab** (or equivalent). Playground may use a blob URL in a new browser tab.

## Capabilities

Host may pass capability flags so the library hides Phase 2 UI until ready. **Canonical union** is defined in [COMPONENTS.md](COMPONENTS.md) (`ReportCapability`), including at least:

`roofline` | `memoryDiagram` | `dependencies` | `hardwareDetails` | `sourceTab` | `cacheTab` | `aicpu` | `measureMode`

**`sourceTab` (UI-37).** Derived on report packs (`.rep` / npu-rep / emulate) only when a non-mock `reportModel.sourceCorrelation` adapted. Packs without Source embeds omit the flag and the 源码 control. Pure Chrome Trace omits it. Host `capabilities` override replaces adapter flags — include `'sourceTab'` and a non-mock model to keep the tab when overriding. Hosts that open Source must serve the Sudu worker (`suduWorkerUrl` prop; same-origin). The editor uses the browser’s generic `monospace` family with no fallback stack; no font assets are required.

**`resolveSourceFile` ([#175](https://github.com/IdeFrontend/profiling-report/issues/175)).** Optional prop on `<ProfilingReport>`:

```ts
resolveSourceFile?: (request: {
  fileName: string;  // symbolizer FileName (often absolute)
  basename: string;  // e.g. gather_2d.asc
}) => Promise<string | null>;
```

Compute packs may ship `objdump` / `symbolizer` / `summary.db` without Ascend C source. The library only looks inside pack payloads; it never opens disk paths. When adapted source text is the `// missing source embed: …` placeholder, the library calls this hook (once per missing file). Return UTF-8 source text to fill the editor (async after first paint is supported); return `null` or throw to keep the placeholder. Skip is automatic when `.asc` / `.cpp` is already in the pack. Hosts (VS Code / MSTT) should implement the hook via `workspace.fs` (Remote-SSH-safe) with an allowlist (workspace folders + report directory).

MVP/M1 host can pass `[]` or omit; library shows summary, PIPE, M1 detail tabs, and timeline without requiring capability flags for those. `memoryDiagram` / measure chrome may be gated.

`roofline` is derived when the report yields usable points; a host `capabilities` prop overrides the derived set wholesale.

**Baselines (对比基线).** Optional props on `<ProfilingReport>` — the baseline list is **host-owned** (the library renders and selects, never persists; host persistence via props/state, see [ARCHITECTURE](ARCHITECTURE.md)):

```ts
baselines?: Baseline[];          // { id, name, path, operators? }
selectedBaselineId?: string | null;
selectedBaselineOperator?: string | null;
pickBaselineFile?: () => Promise<{ path: string; name?: string } | null>;
recentBaselines?: Baseline[];    // the host's own report list for Add Recent
```

The toolbar's add-baseline control renders only when `pickBaselineFile` is provided. The hook opens the host file dialog (MSTT: VS Code open dialog / `workspace.fs`; return the absolute path and a display name — the library never reads the filesystem itself, same contract as `resolveSourceFile`; return `null` to cancel). The popover is a single checkbox view of `recentBaselines`: the checked set IS `baselines`, and every toggle / Browse emits `update:baselines` with the new list (Browse appends `{ id, name, path }` — fresh id, `name` falls back to the path basename; a checked row inserts at its checked-set position so the host list keeps the displayed order of the checked entries; Browse dedupes by path against the whole row list — re-picking an unchecked **recent** row checks that row instead of appending a duplicate, trailing separators are ignored, and letter case is folded for Windows-style paths only, so POSIX `A.rep`/`a.rep` stay two files). The aside's Baseline dropdown emits `update:selectedBaselineId` (an id or `null` for Not selected); the root clears the selection when it leaves the checked set. While `baselines` is `undefined` (not loaded yet) the root performs no selection validation — restore the saved list **before** (or with) the saved id/operator, otherwise the mount clears the restored values; **omit the prop** until it is loaded (`[]` means a known-empty list and is validated).

**Checkbox view.** MSTT passes its live **Performance results tree** as `recentBaselines` (`id` = the record `key`, `name` = the record `title` — the opprof run folder name `OPPROF_<YYYYMMDDHHMMSS>_<16 uppercase letters>` or the file-map basename — `path` = the record `dirPath`); the picker renders one checkbox per record, and the checked set IS `baselines` (every toggle emits `update:baselines`). **Aside dropdowns:** a baseline entry may carry `operators?: string[]` (MSTT: the pack's operators, in order); the aside always shows the Baseline / Operator dropdown row under its meta line — nothing checked reads **Not selected** (hide-vs-empty is open: UI-63); Baseline is the global selection (`update:selectedBaselineId`, `null` = Not selected), Operator defaults to the baseline's first and every pick forwards as `update:selectedBaselineOperator` (a `Baseline.operators` entry or `null`) — the host can read what comparison rendering means. The host persists the values where it sees fit (`globalState` / workspace storage). **Both bundled hosts already pass the contract** through the shared glue `src/host/baselinesHost.ts` — the playground (`playground/App.vue`, where the **baselines** link opens the picker; the checked set always starts empty, with the demo recent list) and the exported HTML shell (`report-shell/App.vue`, hidden file input, `recentBaselines = []` — a user's offline report never shows fabricated runs) — so the offline artifact carries the control; a new host must do the same or the control stays hidden. The glue keeps the list in session state only (no persistence in the library or the bundled hosts); a custom pick lives until the page reloads, exactly like the other playground demo values. Browser hosts fabricate a display pseudo-path (`name (size B, mtime)`) because a File object exposes no real path — `ponytail:`-bounded, opaque identity; MSTT must return the absolute path from its own dialog. Comparison rendering (baseline swimlane / deltas) is host work — the library only maintains the list contract.

## Non-goals for MSTT in v1

- Removing Insight download / `profiler_server` for `.bin`
- Replacing CSV custom editor
- Building a Vue performance-results tree (native tree stays)

## Success check

From an OP project with `opprof` (or `fileMapList`) containing a `.npu-rep`:

1. File appears in Performance results tree.
2. Click opens profiling-report panel (not Insight).
3. Swimlane + PIPE stats render from embedded data.
4. Clicking a `.bin` still opens Insight.
