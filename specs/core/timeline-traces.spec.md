---
spec-id-prefix: PR-TLTRACE
---

# Timeline traces (多流水显示)

Discover and adapt §11.14 catalog CTEF embeds so the toolbar can switch among present timelines.

## Behavior

**Catalog.** Present leaf embeds (case-insensitive aliases) map to kinds:

| Kind | Aliases |
|------|---------|
| `communication` | `Communication.json` |
| `warpOccupy` | `SimtWarpOccpy.json`, `SimtWarpOccupy.json`, `simt_warp_occupancy.json` |
| `pipeTrace` | `PipeTrace.json`, `pipetrace.json` |

Unmatched kinds (including design **stat**) are omitted until a matched embed exists ([DATA-56](../../docs/context/decisions/DATA.md)).

**Adapt.** Each present catalog file builds a `SwimlaneModel` via `chromeTraceToSwimlane` with `sourceTimeUnit: 'us'`. **AdaptedReport** carries **timelineTraces**, **selectedTimelineTraceId**, and **timelineTraceModels**. Default selection prefers **pipeTrace** when present, else the first catalog hit.

**Fallback.** When the catalog is empty, compute uses classic `trace.json` (ns); emulate uses PipeTrace-or-native-merge as before. Classic `trace.json` is never a menu row.

## Acceptance Criteria

1. **PR-TLTRACE-001** — Discovers catalog aliases.
2. **PR-TLTRACE-002** — Omits unmatched kinds.
3. **PR-TLTRACE-003** — Default prefers pipeTrace.
4. **PR-TLTRACE-004** — Builds one swimlane per file.
5. **PR-TLTRACE-005** — adaptPayloads exposes multi-trace fields.

## Related

[view-models](./view-models.spec.md), [adapt-emulate](./adapt-emulate.spec.md), [timeline](../../docs/views/timeline.md), [ReportToolbar](../../src/ui/ReportToolbar/ReportToolbar.spec.md).
