# Profiling Formats Comparison

Concise comparison of the three format / viewer stacks relevant to this project.

## Summary

| Axis | Legacy msinsight (MSTT today) | New profiling-report | PyPTO swimlane |
|------|-------------------------------|----------------------|----------------|
| **Primary trigger in MSTT** | `.bin` / `.json` via `InsightDataViewerPanel` + `profiler_server` | `.rep` / `.ncrep` container | Not used by MSTT today |
| **Typical payload** | msProf operator BIN dumps; also JSON/DB/CSV trees for system profiling | Binary container of metric CSVs + Chrome Trace `trace.json` | Swimlane JSON, Chrome Trace, or `perf_swimlane` (+ optional PMU/topology) |
| **Canonical UI model** | Insight-internal (Compute / Timeline / Source / Details / Cache plugins) | Report view-model + swimlane process/thread/event model (library-owned) | Host parse → process/thread/event `SwimData` |
| **UI owner** | External MindStudio Insight SPA | This **Vue 3 library** | Embedded `swimGraph` in pypto_toolkit |
| **Host role** | Download Insight, start server, pass `binPath`, WS bridge | Read file bytes, theme/locale, open panel | File I/O, SQLite cache, compression, ViewServer APIs |
| **Kept for MSTT?** | **Yes** for legacy `.bin` (and current Insight JSON paths) | **Primary** path for new OP reports | Source of UX patterns; optional copy-paste of render logic |
| **Extension / packaging** | Zip under `insightPath` | npm/workspace Vue package imported by MSTT `web/` | Extension-local Vue app in `webview-dist/` |

## When to use which viewer (MSTT)

```text
Performance results tree file click
  ├─ .csv          → existing CsvEditorProvider (unchanged)
  ├─ .bin          → MindStudio Insight (legacy)
  ├─ .json         → Insight today; revisit if JSON is only Chrome Trace without Insight needs
  └─ .rep / .ncrep → profiling-report Vue panel (new)
```

## Data shape contrast

### Legacy Insight (operator path)

- Opaque **BIN** (and related) consumed by Insight’s C++/server stack.
- MSTT does not parse BIN; it passes a path into the Insight webview.
- Broader Insight also accepts SQLite DBs and text JSON/CSV for system-level profiles — out of scope for this library’s MVP.

### New `.rep` / `.ncrep`

- Self-describing **container**: header + file table + embedded files.
- Expected embeds for OP reports: `OpBasicInfo.csv`, pipe/memory/arithmetic/cache CSVs, `trace.json` (Chrome Trace Event Format).
- Library parses the container and maps metrics → panels, trace → swimlane.
- Normative layout: [REP_FORMAT.md](REP_FORMAT.md). Field mapping: [METRICS_AND_TRACE.md](METRICS_AND_TRACE.md).

### PyPTO swimlane inputs

- Host detects format (Chrome Trace vs PerfSwim vs MsProf-style JSON).
- Converts to a canonical structure: processes → threads → events (`startTime`, `duration`, deps, optional PMU).
- Frontend builds layout, LOD/mipmap, Canvas layers.
- Useful as a **target swimlane model** for this library; not required as an on-disk format for MSTT.

## UX contrast

| Concern | Insight (operator) | profiling-report (target) | PyPTO |
|---------|--------------------|---------------------------|-------|
| Timeline | Insight Timeline / Compute plugins | Swimlane + Cube/Vector overview charts | Multi-layer Canvas swimlane |
| Stats | Insight panels | Report stats, PIPE bars (MVP); roofline/memory (later) | Performance / detail side panels |
| Feel | Separate Ant Design SPA | Native to MSTT Vue + pypto-like lanes | Native to pypto toolkit |
| Tabs | OP / Timeline / Source / Details / Cache | Timeline first (MVP); other tabs Phase 2+ | Swim graph focused |

## Naming note

Design sketches show tab name `report.ncrep`. Sample fixture is `data/out.rep`. Treat **`.rep` and `.ncrep` as the same container format** (same magic `cann-rep`); `.ncrep` is the product-facing extension alias for OP profiling reports. See [REP_FORMAT.md](REP_FORMAT.md).
