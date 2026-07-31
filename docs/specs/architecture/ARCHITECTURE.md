# Architecture

## Packaging decision

profiling-report ships as a **reusable Vue 3 library** consumed by host apps (MSTT first), **not** as a sealed HTML webview bundle.

This supersedes the webview-bundle recommendation in the archived [SWIMLANE_WEBVIEW_REUSE_REPORT.md](../../research/SWIMLANE_WEBVIEW_REUSE_REPORT.md) for this project. Reasons:

- MSTT already builds first-party panels with Vue 3 + Vite + Ant Design Vue.
- A library integrates via normal imports, shared theming, and typed props/emits.
- Hosts keep VS Code webview lifecycle; the library stays framework-UI only.

## Integration strategy: shared UI + adapters

MSTT and PyPTO both want a **pypto-like timeline UX**, but their on-disk semantics differ (see [FORMATS_COMPARISON.md](../formats/FORMATS_COMPARISON.md)). This project does **not** build a single uber-viewer that natively understands Insight `.bin`, full PyPTO schedule payloads, and `.rep` as equal first-class modes.

**Decision:** share **Vue swimlane/report components and the renderer** behind canonical models; use **per-format adapters** and **capability flags** for what each host/format can supply.

**Rejected:** one mega component with a combinatorial matrix of all product features and file types.

```mermaid
flowchart LR
  Rep[".rep adapter"] --> Models["SwimlaneModel + ReportViewModel"]
  Pypto["PyPTO adapter later"] --> Models
  Models --> SharedUI["Shared Vue swimlane + panels"]
  SharedUI --> MsttHost["MSTT host"]
  SharedUI --> PyptoHost["PyPTO host optional"]
  Bin["Insight .bin"] --> Insight["MindStudio Insight"]
```

| Layer | Owns |
|-------|------|
| **Adapter** | Map raw bytes/files → `SwimlaneModel` and optional `ReportViewModel`; format-specific rules stay here |
| **Shared UI** | Swimlane chrome, panels, interactions; driven only by canonical models + capabilities |
| **Host** | File I/O, VS Code APIs, theme/locale, navigation; no swimlane internals |
| **Insight** | Legacy `.bin` (and system profiles) — **outside** this library |

Adapters must not call `useViewServer()`, `window.vscode`, or host routers. Capabilities (e.g. `roofline`, `dependencies`, `aicpu`, `memoryDiagram`) hide UI the current format/host does not support.

**Phasing**

1. **v1:** `.rep` adapter + MSTT host only; copy PyPTO render algorithms as needed without changing pypto-tools.
2. **Later (optional):** PyPTO adapter feeding the same models/UI if that host adopts the package — not required for MVP.

**Explicit non-goal:** parsing or rendering MindStudio Insight `.bin` inside this library.

## Single package, internal modules

Prefer one publishable package with clear folders (can split later if needed):

```text
profiling-report/
  packages/profiling-report/          # or repo root src/ when implementation starts
    src/
      core/           # adapters: .rep first (parse → models); room for more adapters later
      swimlane/       # renderer (Canvas and/or WebGL) + swimlane Vue wrapper
      ui/             # ReportShell, StatsPanel, PipePanel, DetailStrip, …
      index.ts        # public exports
```

Logical names used in docs:

| Module | Responsibility |
|--------|-----------------|
| **core** | Format adapters — v1: `.rep` reader, CSV → `ReportViewModel`, Chrome Trace → `SwimlaneModel` |
| **swimlane** | Timeline renderer + lane layout; no VS Code APIs |
| **ui** | Vue components composing the report shell |

## Data flow (v1: `.rep` adapter)

The diagram below is the **first adapter path**. Other adapters would produce the same models and skip the `.rep`-specific parse.

```mermaid
flowchart LR
  RepFile[".rep / .ncrep bytes"] --> RepAdapter["core: .rep adapter"]
  RepAdapter --> CSVs["CSV tables"]
  RepAdapter --> Trace["trace.json"]
  CSVs --> ViewModel["ReportViewModel"]
  Trace --> SwimModel["SwimlaneModel"]
  ViewModel --> VueUI["ui: ReportShell"]
  SwimModel --> Swimlane["swimlane: Vue + renderer"]
  VueUI --> Host["MSTT webview panel"]
  Swimlane --> VueUI
```

### Host responsibilities

- Read file from disk / remote into `ArrayBuffer` or `Uint8Array`
- Create VS Code `WebviewPanel`, CSP, asset URIs
- Inject theme / locale
- Route open events for `.rep` / `.ncrep` (leave `.bin` to Insight)
- Optional: persist UI state (zoom, selected event id)
- Pass `capabilities` appropriate to the opened format

### Library responsibilities

- Run the selected adapter (v1: `.rep`)
- Build canonical view-models
- Render shared swimlane and panels according to capabilities
- Emit events: `ready`, `select`, `error`, `configChange`

### Suggested public API (illustrative)

```ts
// Props — prefer feeding models after adapt, or raw source for the .rep adapter
interface ProfilingReportProps {
  source?: ArrayBuffer | Uint8Array | ParsedReport;
  swimlaneModel?: SwimlaneModel;
  reportModel?: ReportViewModel;
  theme?: 'light' | 'dark';
  locale?: string;
  capabilities?: ReportCapability[]; // e.g. 'dependencies' | 'roofline'
}

// Emits
type ProfilingReportEmits = {
  ready: [];
  select: [event: SelectedEvent | null];
  error: [error: { message: string; cause?: unknown }];
};
```

Library must **not** depend on `useViewServer()`, `window.vscode`, or PyPTO DevUI.

## Canonical models (library-owned)

Align swimlane DTO with the reuse report’s TraceModel spirit. **Adapters converge here**; UI never branches on “is this PyPTO vs .rep” except via capabilities and optional `args`.

```ts
interface SwimlaneModel {
  processes: SwimProcess[];
  minTime: number; // ns
  maxTime: number;
  metadata?: Record<string, unknown>;
}

interface SwimProcess {
  id: string;
  name: string;
  threads: SwimThread[];
}

interface SwimThread {
  id: string;
  name: string;
  utilization?: number; // 0..1 for gutter bar
  events: SwimEvent[];
}

interface SwimEvent {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  args?: Record<string, unknown>;
  dependencies?: { predecessors: string[]; successors: string[] };
}
```

`ReportViewModel` aggregates OpBasicInfo + pipe/memory/arithmetic summaries for the right panel (primarily the `.rep` adapter).

## Renderer strategy

See [SWIMLANE_IMPLEMENTATIONS.md](../../research/SWIMLANE_IMPLEMENTATIONS.md).

- **MVP:** Canvas 2D (or thin WebGL) sufficient for sample-scale traces; Vue chrome around it.
- **Target:** Hybrid — TypeScript WebGL interval layer (Sudu coverage-AA idea) + DOM/Canvas overlays for text and hit-testing.
- Copy-paste from PyPTO allowed for layout math, color tables, time formatting — strip host coupling.

## Theming

- Prefer CSS variables compatible with MSTT / VS Code theme injection.
- Dark default matching sketches; light mode supported via tokens.

## Testing fixtures

- Golden unpack of `data/out.rep`
- Unit tests for head/file-info parsing and adapter → model mapping
- Component fixture: load sample bytes in Storybook or Vite demo app (implementation phase)

## Copy-paste policy

| Allowed | Not required |
|---------|----------------|
| PyPTO `eventRender` / mipmap / time utils ideas | Refactoring pypto_toolkit |
| Trace → process/thread mapping concepts | Shared monorepo with pypto |
| Sudu shader math (reimplement in TS) | Maven/TeaVM dependency on sudu-editor |
