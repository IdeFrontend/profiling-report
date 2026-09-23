# Hardware details

| | |
|--|--|
| **Id** | `hardware-details` |
| **Panel / component** | `HardwareDetailsPanel` → `src/ui/StatsAside/HardwareDetailsPanel/` |
| **Capability** | `hardwareDetails` (when model present) |
| **Phase** | M1 |
| **Unification** | `adapt-mapper` |
| **Sept 30 (emulate)** | **out** with summary chrome ([DATA-47](../context/decisions/DATA.md)) — 更多 omitted on emulate |

## Sketches

![Hardware details](../ui/source/v930/hardware-more-detail.jpeg)

## Purpose

Overlay opened from 报告统计 → **更多**: host / device / AI Core / HBM snapshot for the run. Label left / value right layout; dismiss with close / back control.

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| `reportModel.hardwareDetails` | Sectioned field list for the overlay | Optional — overlay still opens when absent |
| capability `hardwareDetails` | Set when model present | Optional |

## Hide rule

**更多** always opens the overlay on the compute report shell ([UI-30](../context/decisions/UI.md), [UI-31](../context/decisions/UI.md)): show `HardwareDetailsPanel` when `hardwareDetails` is present; else **缺少 hardware info** / Missing hardware info. Emulate omits meta/更多 with summary ([DATA-47](../context/decisions/DATA.md)). Not required to open Timeline ([DATA-30](../context/decisions/DATA.md)).

## Compute fill

| Adapted field | Embed | Columns / notes | Schema SSOT |
|---------------|-------|-----------------|-------------|
| `hardwareDetails` | `HardwareInfo.jsonl` (preferred) | Category sections below; one object per line, `category` discriminator | [METRICS](../formats/compute/METRICS_AND_TRACE.md), [compute/FORMAT](../formats/compute/FORMAT.md) |
| fallback | `OpBasicInfo.csv` | Non-empty columns when jsonl absent ([DATA-34a](../context/decisions/interim/DATA.md)) | Same |

`data/out.rep` omits jsonl; the toolkit `example.rep` pack includes it (not in git).

<a id="section-fields"></a>

### Section → typical fields (docx §11.2.3.1)

| Section (UI) | Typical fields |
| --- | --- |
| Host Info | Cpu Info (optional), Cpu Physical/Logical Count, Memory Total Size (MB), Disk Total Size (GB) |
| Device Info | NPU Count, Chip Info, Arch Info |
| CPU Information | Control / AI CPU count and frequency (MHZ) |
| AI Core Information | AI Core / Cube / Vector counts, AI Core Frequency (MHZ) list |
| Memory Information | HBM Total / Used (MB), HBM Frequency (MHZ) |

**Interaction:** opened from 报告统计 → 更多; emit `open-hardware-details`; dismiss with close control. Label left / value right layout. Aside meta stays **进程** / **算子类型** / **Blocks** — not 核数 / NPU ARCH / aic频率 ([DATA-34](../context/decisions/DATA.md)).

## Emulate fill

| Adapted field | Embed | Columns / notes | Status |
|---------------|-------|-----------------|--------|
| `hardwareDetails` | — | No HardwareInfo pack promised; 更多 omitted with summary | **out** ([DATA-47](../context/decisions/DATA.md)) |

## Adapter

| Profile | Entry | Notes |
|---------|-------|-------|
| compute | `adaptPayloads` | Prefers `HardwareInfo.jsonl`; OpBasicInfo fallback (DATA-34a) |
| emulate | `adaptEmulate` | Does not map hardware overlay |

## Related

- Spec: [HardwareDetailsPanel.spec.md](../../src/ui/StatsAside/HardwareDetailsPanel/HardwareDetailsPanel.spec.md), [StatsAside.spec.md](../../src/ui/StatsAside/StatsAside.spec.md)
- Opened from: [report-summary](report-summary.md) 更多
- Product docx §: 11.2.3.1
- Decisions: [DATA-34](../context/decisions/DATA.md), [UI-30](../context/decisions/UI.md), [UI-31](../context/decisions/UI.md); interim [DATA-34a](../context/decisions/interim/DATA.md)
- Catalog: [README](README.md)
