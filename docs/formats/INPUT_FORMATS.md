# Input Formats

**Moved** to profile hubs. Prefer the destinations below; this file keeps **legacy § anchors** so older decision/spec cites keep resolving.

| Content | Destination |
|---------|-------------|
| Container / detection / profile index | [`README.md`](README.md) |
| Compute (hardware / NPU-Compute) schemas | [`compute/FORMAT.md`](compute/FORMAT.md) |
| Compute embed → UI (metrics + trace) | [`compute/METRICS_AND_TRACE.md`](compute/METRICS_AND_TRACE.md) |
| Emulate (npu_emulate) leaf | [`emulate/FORMAT.md`](emulate/FORMAT.md) |
| Adapter matrix | [`ADAPTERS.md`](ADAPTERS.md) |
| View fill requirements | [`VIEW_DATA_REQUIREMENTS.md`](VIEW_DATA_REQUIREMENTS.md) |
| Consumer view packets | [`../views/README.md`](../views/README.md) |

## Legacy section map (former `INPUT_FORMATS.md` body)

Former §3.x compute schema notes now live under [`compute/FORMAT.md`](compute/FORMAT.md):

| Legacy anchor | Topic | Current location |
|---------------|-------|------------------|
| §3.4 | Memory / L0C edge columns | [compute/FORMAT.md](compute/FORMAT.md) (Memory load / L0C) |
| §3.5 | Suffix direction rule (`*_write_bw_cube` / `*_read_bw_cube`) | [compute/FORMAT.md](compute/FORMAT.md) |
| §3.6 | UB↔GM fields | [compute/FORMAT.md](compute/FORMAT.md) |

<a id="3.4"></a>
### 3.4 Memory / L0C edges

See [compute/FORMAT.md](compute/FORMAT.md) — Memory load / L0C edge columns. Decision cites: [DATA-24](../context/decisions/DATA.md), [DATA-25](../context/decisions/DATA.md), [DATA-43](../context/decisions/DATA.md).

<a id="3.5"></a>
### 3.5 Suffix direction rule

See [compute/FORMAT.md](compute/FORMAT.md) — Cube↔L0C suffix rule (`*_write_bw_cube` into L0C, `*_read_bw_cube` out). Open follow-up: [DATA-44](../context/questions/DATA.md).

<a id="3.6"></a>
### 3.6 UB ↔ GM

See [compute/FORMAT.md](compute/FORMAT.md) — UB↔GM fields. Decisions: [DATA-22](../context/decisions/DATA.md), [DATA-23](../context/decisions/DATA.md).
