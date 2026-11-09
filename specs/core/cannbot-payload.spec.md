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

- **summary** — `summary`, `bandwidthCards`, `computeCard`, `roofline`, `pipeOccupancy`, `memoryTopology`, `hardwareDetails`.
- **compute** — `pipeOccupancy`, `computeTables`, plus `csvTexts` filtered to the compute tables' file names.
- **memory** — `memoryTables`, `memoryTopology`, `bandwidthCards`, plus `csvTexts` filtered to the memory tables' file names.

**Scope enum: designed set vs 930 release.** The cannbot payload contract's designed enum is the full set `roofline | sol | pipeline | compute | memory | communication | summary`. The 930 release implements only `summary`（章节1）/ `compute`（章节2）/ `memory`（章节3）: exactly the three report sections that carry cannbot icon entries in the UI and have data mappings in the view model. The remaining values — `roofline`, `sol`, `pipeline`, `communication` — are reserved for future releases and unused for now; each activates only when its section gains a UI entry and a data mapping, together with a spec update here. Until then the library's `CannbotScope` emit type stays narrowed to the implemented three, so passing a reserved value is a compile-time type error rather than a silent runtime fallback.

The payload reuses the already-parsed view model — same section references, never a re-parse of `.rep` / CSV and never recomputed view state. Optional sections (`bandwidthCards`, `computeCard`, `roofline`, `memoryTopology`, `hardwareDetails`, a filtered `csvTexts`) are omitted when absent or without a matching file; always-present sections (`summary`, `pipeOccupancy`, the table lists) keep their keys even when empty. Without a report, `data` is `{}`.

## Session state contract (CANNWork 优化 R2–R4)

The library also owns the **session state types** the host pushes down to drive the per-scope button states (`src/domain/cannbot.ts`):

```ts
type CannbotSessionStatus = 'running' | 'completed' | 'stopped' | 'error' | 'unknown'
type CannbotSessions = Partial<Record<CannbotScope, { sessionId: string; status: CannbotSessionStatus }>>
```

**`CannbotSessionStatus` mirrors the cannwork companion extension's `SessionStatus`.** The mapping record is `reportPath → scope → latest session` on the host side; the library only ever receives the **flattened latest-per-scope snapshot** for the open report (`CannbotSessions`), never the full history — the host guarantees "only the latest sessionId is kept" per (report, scope).

**Three-state derivation (the scope state machine).** For each scope the UI derives exactly one button state from `sessions[scope]`:

- no key (never started, or the host never pushed sessions — browser / playground / exported HTML) → **idle**: single 分析 button;
- `status === 'running'` → **running**: 停止 button, click asks the host to stop the session;
- a key with any **non-`running`** status (`completed` / `stopped` / `error` / **`unknown`**) → **settled**: 分析 | 引用 | 查看.

`unknown` counts as settled on purpose: an unreadable status still proves a session existed, and a settled row stays clickable. States are **per-scope independent** — one scope running never changes another scope's buttons. The component layer renders this contract in [`CannbotActions`](../../src/ui/StatsAside/CannbotActions.vue) (see [StatsAside](../../src/ui/StatsAside/StatsAside.spec.md) PR-STATS-044); this spec owns the derivation rule itself.

## Acceptance Criteria

1. **PR-CANNBOT-001** — Fixed fields and meta fallbacks.
2. **PR-CANNBOT-002** — Scope data mapping reuses view model.
3. **PR-CANNBOT-003** — Session three-state derivation: missing key → idle; `running` → running; every other status (`completed` / `stopped` / `error` / `unknown`) → settled; scopes derive independently of each other.

## Edge Cases

| State | Behavior |
|---|---|
| meta omitted or partial | Meta fields default to `''`; `report_id` falls back to `name` |
| report null / undefined | `op_name` `''`; `data` is `{}` |
| csvTexts has no file matching the scope's tables | `csvTexts` key omitted |
| Optional section absent | That key omitted; always-present keys stay |
| `sessions` missing / scope key missing | That scope idle (single 分析 button) |
| `status: 'unknown'` | Settled (引用 / 查看 render) |

## Dependencies

[view-models](./view-models.spec.md) — the `ReportViewModel` sections reused by reference. Consumers: [StatsAside](../../src/ui/StatsAside/StatsAside.spec.md), [ProfilingReport](../../src/ui/ProfilingReport/ProfilingReport.spec.md).

## Changelog
- **2026-10-30** — Session state contract (CANNWork 优化 R2–R4): `CannbotSessionStatus` / `CannbotSessions` types and the per-scope **idle / running / settled** three-state derivation (`PR-CANNBOT-003`); the host pushes only the latest-session-per-scope snapshot for the open report, `unknown` counts as settled, and scopes derive independently.
- **2026-09-04** — Summary scope includes `computeCard` (DATA-33h / HQ slice 3).
- **2026-08-26** — Initial spec (cannbot payload builder).
- **2026-08-27** — Document the designed scope enum (full 7-value set) vs the 930 release's implemented three; remaining values reserved for future releases (review follow-up).
