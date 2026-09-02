# Localization (zh-CN / en)

Host-driven bilingual chrome for the profiling-report Vue library. No `vue-i18n` — typed catalog + `locale` prop.

**Default locale:** `zh-CN` (interim [PKG-2](../context/questions/PKG.md) / [PACKAGING_SUGGESTIONS](../context/PACKAGING_SUGGESTIONS.md)). Product has not closed PKG-2; do not treat English as the product default until then.

## Contract

| Piece | Role |
|-------|------|
| [`src/i18n/index.ts`](../../src/i18n/index.ts) | Message catalog (`zh-CN` / `en`), `resolveLocale()`, `t(key, locale)` |
| `locale?: string` on `<ProfilingReport>` | Host injects language; drilled into toolbar / timeline / aside / detail / tooltip |
| Accepted values | `zh*` → `zh-CN`; `en*` → `en`; missing / unknown → `zh-CN` |

Library has **no** persisted language preference and **no** mandatory in-panel language control. Changing language is: host updates `:locale` (or remounts).

**Playground:** zh \| en control binds `:locale` for QA. That is a host demo, not product chrome inside the library.

## Ownership

| Surface | Owner |
|---------|-------|
| Toolbar, aside titles, detail dock chrome, tooltips, gutter pin, Card metric selector, a11y labels for resize handles | Library catalog |
| Panel / editor tab title, load errors, explorer tree | **MSTT** (host i18n) |
| CSV column names, kernel / event / arg names | **Pass-through** from producer — never rewritten |
| Hardware tokens (Cube, Vector, MTE, PIPE, HBM, Ops/Byte, TOps/s) | English in **both** locales |
| Sketch EN-in-zh columns (Parameter, Relevent, Incoming, Current, Outgoing, Task Connection Level) | Identical in both catalogs (sketch fidelity, including `Relevent`) |
| CANNBot system prompt | Out of scope for UI switch (Chinese until Product asks for dual prompts) |

## Lane category labels

Card folders `通信` / `计算` / `储存HBM` use a stable `categoryKey` on `SwimThread`:

| `categoryKey` | Message key | zh-CN | en |
|---------------|-------------|-------|-----|
| `comm` | `laneComm` | 通信 | Comm |
| `compute` | `laneCompute` | 计算 | Compute |
| `hbm` | `laneHbm` | 储存HBM | HBM storage |

Gutter (and any UI that shows those rows) calls `t(lane*, locale)` when `categoryKey` is set; otherwise shows `name` (flat CTEF threads, producer names). Domain logic that finds the compute folder should prefer `categoryKey === 'compute'` (name match remains a fallback for older fixtures).

## Card gutter metric labels

Card-header metric dropdown options use `gutterMetricLabel(metric, locale)` (`src/i18n`):

| `GutterMetric` | Message key | zh-CN | en |
|----------------|-------------|-------|-----|
| `clockCycle` | `gutterMetricClockCycle` | 时钟周期 | Clock Cycle |
| `cacheHit` | `gutterMetricCacheHit` | 缓存命中率 | Cache Hit Ratio |
| `task` | `gutterMetricTask` | 任务 | Task |
| `utilization` | `gutterMetricUtilization` | 利用率 | Utilization |

Aria label for the control: `gutterMetricFor` (`{name} 的泳道指标` / `Gutter metric for {name}`).

## MSTT host handoff

1. Map IDE / extension language to a string (`zh-CN` or `en`, or any `zh*` / `en*` prefix).
2. Pass it on webview load / theme push: `{ type: 'load', …, locale }` (see [MSTT_INTEGRATION](../architecture/MSTT_INTEGRATION.md)).
3. Bind `:locale="locale"` on `<ProfilingReport>`.
4. Keep host-only strings (panel title, load failures) in MSTT’s own i18n — do not duplicate them into this catalog.

## Related

- [UI_OVERVIEW.md](UI_OVERVIEW.md) § Theme and i18n
- [FEATURE_MATRIX.md](FEATURE_MATRIX.md) — i18n hooks row
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — host injects theme / locale
