# Packaging and Process Suggestions (PKG-1 … PKG-3)

**Status:** **Interim** for MVP scaffold — treat as accepted until Product confirms or changes. Tracked in [decisions/interim/](decisions/interim/) (PKG-1a … PKG-3a) and [questions](questions/).

Former **UI-41** (gesture parity) is **resolved** — see [decisions/UI.md](decisions/UI.md).

## PKG-1 — Package identity

| Choice | Suggestion |
|--------|------------|
| Layout | Repo-root `src/` + `playground/` (already in DEVELOPMENT) — no monorepo `packages/` until a second publishable package appears |
| npm name | `@huawei/profiling-report` or MSTT-scoped name matching other `mstt/web` workspace packages — **confirm with MSTT package naming** |
| Consume in MSTT | **Workspace path / workspace protocol dependency** for v1 (fast iterate); publish to internal registry when a second host needs a versioned artifact |
| License | Match MSTT / CANN internal license; do not invent a public OSS license without Legal |

## PKG-2 — Design system & i18n

| Choice | Suggestion |
|--------|------------|
| Component kit | **Ant Design Vue for chrome** that must match MSTT (buttons, inputs, tabs) + **custom CSS** for swimlane/PIPE/canvas (sketches are not Ant Design) |
| Colors | Normative sketch tokens in [COLOR_TOKENS.md](../ui/COLOR_TOKENS.md) — do not replace pipe hues with Ant theme primaries |
| Default locale | **zh-CN** strings as default (sketches are Chinese); English message catalog from day one via i18n keys |
| Theme | Dark default; accept VS Code / MSTT CSS variable injection for shell |

## PKG-3 — PyPTO copy-paste

| Choice | Suggestion |
|--------|------------|
| Policy | **Allowed to reimplement** layout/time/mipmap ideas in TypeScript inside this repo |
| Blocker | **Legal/OSL clearance** before pasting substantial PyPTO source verbatim — treat as Required before large copy PRs |
| Attribution | Note non-trivial ports in PR description; no runtime dependency on pypto_toolkit |

## Ask Product to confirm

Reply with accept / change per row (PKG-1 … PKG-3). Until then, implementers follow the **Suggestion** column.
