# Extracted Report Files (backend `npu-compute`)

| spec-id-prefix |
|----------------|
| PR-FILES-*     |

The new `.npu-rep` report format is **not** parsed in the browser. A backend
service extracts it with the Linux-only `npu-compute` tool and returns the same
embeds `.rep` already carries (`trace.json`, `OpBasicInfo.csv`, metric CSVs,
`HardwareInfo.jsonl`). The frontend consumes the extracted folder via
`loadReportFiles` and the `files` prop — reusing `adaptPayloads`, so no second
parsing path exists.

## Behavior

```ts
loadReportFiles(files: Record<string, Uint8Array | ArrayBuffer> | ReportFileEntry[]): AdaptedReport
```

Accepts either a name→bytes map or the backend's `{ name, data }[]` list.
Adapts via `adaptPayloads`, so all downstream view models (summary, PIPE, CSV
tabs, roofline, hardware, memory topology, swimlane) behave exactly as for a
`.rep` container. Throws when no files are provided; `adaptPayloads` throws when
`trace.json` is absent (timeline requires a swimlane source).

The `ProfilingReport` component accepts a `files` prop mirroring `source`: it
loads on set, clears on unset, and never clobbers a concurrently-provided
`source` (each prop defers to the other when both are set).

## Tool resolution (backend)

The `npu-compute` tool is **never bundled**. `resolveNpuCompute` resolves it in
order:

1. **Explicit path** — `NPU_COMPUTE_BIN` (plugin setting). Fail loudly if set but
   not executable or incompatible.
2. **Autodetect** — `PATH` scan + `--version` compatibility check
   (`MIN_SUPPORTED_VERSION = 9.1.0`).
3. **Auto-download** — only if both above fail and `AUTO_DOWNLOAD_TOOL=1`.

The backend HTTP surface is `POST /extract` (raw `.npu-rep` bytes →
`{ tool, files: [{ name, contentBase64 }] }`) and `GET /health`.

## Acceptance Criteria

1. **PR-FILES-001**: `loadReportFiles` adapts a name→bytes map.
2. **PR-FILES-002**: `loadReportFiles` adapts the backend `{ name, data }` list.
3. **PR-FILES-003**: empty input throws.
4. **PR-FILES-004**: missing `trace.json` throws.
5. **PR-FILES-005**: `files` prop renders the timeline and derives capabilities.
6. `resolveNpuCompute` follows the ladder: explicit → autodetect (version-checked)
   → download, and throws when no tool is available.

## Dependencies

[input-formats](./input-formats.spec.md), [load-report-source](./load-report-source.spec.md),
[public-api](../architecture/public-api.spec.md), [mstt-integration](../architecture/mstt-integration.spec.md).

## Changelog
- **2026-09-03** — Initial spec. Backend extraction + `files` loading path.
