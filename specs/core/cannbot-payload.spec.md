# Cannbot Payload

| spec-id-prefix |
|----------------|
| PR-CANNBOT-*   |

Pure function that assembles the read-only snapshot payload a host sends to the cannbot plugin (智能问答) for a report section. This library only assembles the data — invoking the plugin is the host's job.

```ts
buildCannbotPayload(scope: CannbotScope, report?: ReportViewModel | null, meta?: CannbotReportMeta): CannbotPayload
CANNBOT_PROMPT: string
```

## Behavior

**Fixed fields and meta fallbacks.** `version` is always `'1.0'`. `report_name` / `report_path` / `collected_at` come from **meta** and default to `''` when absent; `report_id` uses `meta.id` and falls back to `meta.name`; `op_name` comes from `report.summary.opName` (`''` without a report). `prompt` is the requirement-given **CANNBOT_PROMPT** constant, carried verbatim — it declares the read-only snapshot boundary to the assistant (no cross-report baselines, no write operations, no data beyond `data`).

**Scope data mapping.** `scope` (`summary` / `compute` / `memory`) selects which `ReportViewModel` sections land in `data`:

- **summary** — `summary`, `bandwidthCards`, `roofline`, `pipeOccupancy`, `memoryTopology`, `hardwareDetails`.
- **compute** — `pipeOccupancy`, `computeTables`, plus `csvTexts` filtered to the compute tables' file names.
- **memory** — `memoryTables`, `memoryTopology`, `bandwidthCards`, plus `csvTexts` filtered to the memory tables' file names.

The payload reuses the already-parsed view model — same section references, never a re-parse of `.rep` / CSV and never recomputed view state. Optional sections (`bandwidthCards`, `roofline`, `memoryTopology`, `hardwareDetails`, a filtered `csvTexts`) are omitted when absent or without a matching file; always-present sections (`summary`, `pipeOccupancy`, the table lists) keep their keys even when empty. Without a report, `data` is `{}`.

## Acceptance Criteria

1. **PR-CANNBOT-001** — Fixed fields and meta fallbacks.
2. **PR-CANNBOT-002** — Scope data mapping reuses view model.

## Edge Cases

| State | Behavior |
|---|---|
| meta omitted or partial | Meta fields default to `''`; `report_id` falls back to `name` |
| report null / undefined | `op_name` `''`; `data` is `{}` |
| csvTexts has no file matching the scope's tables | `csvTexts` key omitted |
| Optional section absent | That key omitted; always-present keys stay |

## Dependencies

[view-models](./view-models.spec.md) — the `ReportViewModel` sections reused by reference. Consumers: [StatsAside](../../src/ui/StatsAside/StatsAside.spec.md), [ProfilingReport](../../src/ui/ProfilingReport/ProfilingReport.spec.md).

## Changelog
- **2026-08-26** — Initial spec (cannbot payload builder).
