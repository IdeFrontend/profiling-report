# `PipeTrace.json`

| | |
|--|--|
| **Profile** | `emulate` |
| **Role** | Timeline swimlane (µs) |
| **Decision** | [DATA-46](../../context/decisions/interim/DATA.md#data-46) |

Producer **MUST** convert simulation ticks → **µs** when packing. When absent, native `core_*_tracing_report_*.json` may be merged ([FORMAT.md](FORMAT.md) §4.1).

## Example

Chrome Trace Event JSON with `ts` / `dur` in microseconds. See [views/timeline](../../views/timeline.md).
