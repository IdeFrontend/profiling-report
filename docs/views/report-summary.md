# Report summary

| | |
|--|--|
| **Id** | `report-summary` |
| **Panel / component** | `StatsSummaryPanel` → `src/ui/StatsAside/StatsSummaryPanel/` |
| **Capability** | _(none)_ |
| **Phase** | M |
| **Unification** | `adapt-mapper` |
| **Sept 30 (emulate)** | **in** (thin identity/duration) |

## Sketches

![Report statistics open](../ui/source/v930/report-stats-open.jpeg)

**Component crop:** ![Summary cards](../../src/ui/StatsAside/StatsSummaryPanel/visual/summary-cards.png)

## Purpose

Aside summary cards and meta row (duration, compute/BW when present, process/op/blocks). Gives a quick OP identity and cost snapshot beside the timeline.

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| `reportModel.summary.taskDurationUs` | Duration card | **Required to show** duration card |
| `summary.opName` / `opType` / `pid` / `blockDim` | Meta / secondary | Optional |
| `computeCard` / `bandwidthCards` / parallel util | Extra cards | Optional — hide when absent |
| `hardwareDetails` | 更多 overlay source | Optional |

If no `taskDurationUs` and no `bandwidthCards` → **hide** the summary card group (PIPE may still show). Meta row is independent.

## Hide rule

[DATA-30](../context/decisions/DATA.md): omit cards whose adapted fields are empty; do not invent values.

## Compute fill

| Adapted field | Embed | Columns / notes | Schema SSOT |
|---------------|-------|-----------------|-------------|
| `summary.*` | `OpBasicInfo.csv`, `Summary.jsonl` | `Task Duration(us)`, Op Name/Type, Pid, Block Dim; FLOPS from OpInfoSummary | [METRICS](../formats/compute/METRICS_AND_TRACE.md) |
| `computeCard` | Arithmetic + HardwareInfo / summary.jsonl | DATA-33h | [METRICS](../formats/compute/METRICS_AND_TRACE.md) |
| `bandwidthCards` | Memory / summary.jsonl | DATA-33g | [METRICS](../formats/compute/METRICS_AND_TRACE.md) |

## Emulate fill

| Adapted field | Embed | Columns / notes | Status |
|---------------|-------|-----------------|--------|
| `summary.opName` / `taskDurationUs` / … | `KernelInfo.csv` / `summary.json` | Interim [DATA-42a](../context/decisions/interim/DATA.md) | `adapt-mapper` |
| `computeCard` / `bandwidthCards` | — | No compute-equivalent pack promised | `gap` → hide |

## Adapter

| Profile | Entry | Notes |
|---------|-------|-------|
| compute | `adaptPayloads` | Full summary path |
| emulate | `adaptEmulate` | `summaryFromKernelInfo` / `summaryFromEmulateJson` |

## Related

- UX: [UX_SPEC](../ui/UX_SPEC.md) S1 / S10
- FEATURE_MATRIX: Right panel summary
- Spec: StatsAside / StatsSummaryPanel (co-located when present)
- Product docx §: 11.2.3
- Open: [DATA-42](../context/questions/DATA.md); interim DATA-42a
