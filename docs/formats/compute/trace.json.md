# `trace.json`

## Timeline / trace payload

Docx §11.2.8 tables for timeline and pipeline details are **empty**. The local sample embeds `trace.json` (Chrome Trace Event format).

### 4.1 Top level

| Field | Type | Sample |
| --- | --- | --- |
| `traceEvents` | array | Event list |
| `displayTimeUnit` | string | `"ns"` |

### 4.2 Metadata events (`ph: "M"`)

Used to name lanes, e.g.:

```json
{"ph":"M","name":"thread_name","pid":2,"tid":1256,"args":{"name":"AIV0/PIPE_FIX/status"}}
```

Lane naming pattern in sample: `{channel}/{pipe}/status` (e.g. `AIV0/PIPE_FIX/status`).

### 4.3 Complete events (`ph: "X"`)

Common fields: `name`, `cat`, `pid`, `tid`, `ts`, `dur`, `args`.

`args` variants observed in sample:

| Kind | Distinctive args |
| --- | --- |
| Pipe state / marker | `channel`, `pipe`, `record_type`, `marker`, `raw`, `delta_time`, `state_PIPE_*` |
| Interval / span | `start_index`, `end_index`, `start_raw`, `end_raw`, `start_abs_ts`, `end_abs_ts` |

This is sufficient to drive hierarchical Core → Cube/Vec → pipe swimlanes once events are grouped by `pid`/`tid` / channel metadata. Richer UI fields shown in event-details mockup (`Pc_addr`, `Process_bytes`, source `Code` paths, Relevant graph) are **not present** in the sample `trace.json` and remain unspecified in the docx tables.

---
