# Event / Relevant details

| | |
|--|--|
| **Id** | `event-details` |
| **Panel / component** | **DetailPanel** (`src/ui/DetailPanel/`) + **EventTooltip** (`src/ui/EventTooltip/`); Relevant graph P2 |
| **Capability** | _(none)_ — selection-driven; deps optional |
| **Phase** | M (summary strip); Relevant graph **P2** |
| **Unification** | `gap` (richer fields not in sample CTEF) |
| **Sept 30 (emulate)** | **thin** — same CTEF selection strip; no richer side table |

## Sketches

![Event details](../ui/source/v930/detail-strip-raised.jpeg)

## Purpose

Raised bottom **详情** dock (**DetailPanel**) and hover **EventTooltip** for the selected / hovered timeline block: task identity, timing, optional parameters, and a **Relevant** local dependency graph.

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| Selected / hovered `SwimEvent` | Name + timing for dock / tooltip | **Required** to show dock content |
| Parameter fields (`Code`, `Detail`, `Pc_addr`, `Process_bytes`) | Parameter region | Optional — **gap** in sample CTEF |
| Relevant graph (Incoming → Current → Outgoing) | Dependency mini-graph | Optional — P2 |

## Hide rule

Dock routing ([ProfilingReport.spec.md](../../src/ui/ProfilingReport/ProfilingReport.spec.md)):

| State | Dock content |
|-------|----------------|
| Single selection (`selectedEventId`) | Mounts **DetailPanel** |
| Multi-select (`multiSelectedIds` ≥ 2) | Same dock shell; mounts **MultiSelectSummary** |
| Live empty marquee (already-open dock, mid-drag empty coverage) | Keeps dock shell + `dock-empty` / nothing-selected (**PR-ROOT-016**) |
| No selection, no live marquee | Footer unmounts (`v-if`) |

**PR-DPANEL-002** — DetailPanel close emits `close` only; parent clears selection → unmounts **DetailPanel** ([DetailPanel.spec.md](../../src/ui/DetailPanel/DetailPanel.spec.md)). Missing optional parameter / Relevant fields → omit those regions; do not invent ([DATA-30](../context/decisions/DATA.md); Relevant column gated per **PR-DPANEL-003**).

## Compute fill

Docx §11.2.8.1 field table is **empty**. Layout from mockup:

<a id="mockup-layout"></a>

### Mockup regions (docx §11.2.8.1)

| Region | Content |
| --- | --- |
| Summary | Task name, subtype/tag, Start (ns) → Duration (ns) |
| Parameters | `Code` (source paths), `Detail` (register/memory string), `Pc_addr`, `Process_bytes` |
| Relevant | Local dependency graph: Incoming → Current → Outgoing; connection level control; optional edge badge (counts/latency) |

<a id="vm-derivation"></a>

### VM field ← source (join / derivation)

| VM field | Source embed(s) | Join key(s) | Derivation |
|----------|-----------------|-------------|------------|
| Summary name / timing | CTEF `ph:X` selected event | selection id ↔ event `id` | `name`, `startTime` / `duration` (ns) from swimlane model |
| subtype / tag | event `cat` / `args` | — | when present on CTEF args |
| Parameters (`Code`, `Detail`, `Pc_addr`, `Process_bytes`) | _(undefined)_ | — | **Gap:** not in sample `trace.json`; need richer event payload or side table |
| Relevant graph | event `args.dependencies` (+ async `ph:s`/`f`) | successor event ids | P2 mini-graph; optional edge badges TBD |

**Interaction:** activated by clicking a timeline block (mockup callout: 点击之后出现底部【详情】页面).

**Gap:** parameter fields are not in sample CTEF; require a richer event payload or side table not defined in the docx. Schema SSOT when defined: [compute/FORMAT](../formats/compute/FORMAT.md), [METRICS](../formats/compute/METRICS_AND_TRACE.md).

## Emulate fill

| VM field | Source embed(s) | Join key(s) | Derivation / status |
|----------|-----------------|-------------|------------|
| Summary | Same CTEF path (`PipeTrace` / tracing JSON) | selection id | `same-path` as compute timeline |
| Parameters / Relevant | — | — | `gap` until emulate packs richer event side tables |

## Adapter

| Profile | Entry | Notes |
|---------|-------|-------|
| compute | `chromeTraceToSwimlane` + selection state | DetailPanel reads selected `SwimEvent`; no dedicated event-details mapper yet |
| emulate | same CTEF path via `adaptEmulate` | Same gaps |

## Related

- Shell: [timeline](timeline.md)
- Specs: [DetailPanel.spec.md](../../src/ui/DetailPanel/DetailPanel.spec.md) (**PR-DPANEL-002** close emit; **PR-DPANEL-003** Relevant omit); [ProfilingReport.spec.md](../../src/ui/ProfilingReport/ProfilingReport.spec.md) (dock routing / **PR-ROOT-016**); [MultiSelectSummary.spec.md](../../src/ui/MultiSelectSummary/MultiSelectSummary.spec.md); [EventTooltip.spec.md](../../src/ui/EventTooltip/EventTooltip.spec.md); [SwimlaneCanvas](../../src/ui/TimelineView/SwimlaneView/SwimlaneCanvas/SwimlaneCanvas.spec.md)
- Product docx §: 11.2.8.1
- Open questions: [context/questions/](../context/questions/)
- Catalog: [README](README.md)
