# Testing

Automated verification for profiling-report. Complements [DEVELOPMENT.md](DEVELOPMENT.md).

## Goals

- Encode specs as executable checks **before** feature code lands.
- Keep feedback fast for parsers and view-models; use the browser for swimlane interactions.
- Prove the **library** in this repo; do not require VS Code / MSTT for CI here.

## Stack (locked)

| Layer | Tool | Role |
|-------|------|------|
| Unit | **Vitest** | `.rep` parse, CSV parse, aggregations, Trace → `SwimlaneModel`, layout math |
| Component | **Vitest + Vue Test Utils** (+ happy-dom or jsdom) | `ProfilingReport`, stats/PIPE panels, selection emits |
| E2E | **Playwright** vs Vite **playground** | Load report, zoom/pan smoke, hover tooltip, select → detail |
| Visual (Phase 2) | Playwright screenshots | Optional baselines for swimlane frames |
| Lint / types | ESLint + `vue-tsc` (when scaffolded) | Static checks in CI before tests |

No Cucumber/Gherkin in v1. Map acceptance criteria to `describe` / `it` (or `test`) titles and stable **test ids**.

## Pyramid

```text
        /\
       /E2E\        few — critical user paths on playground
      /------\
     /Component\    panels, props, emits, selection wiring
    /----------\
   /    Unit     \  majority — formats, models, pure logic
  /----------------\
```

Prefer unit tests for anything that does not need DOM or Canvas. Prefer component tests for Vue state without full browser chrome. Prefer e2e for real pointer/zoom and canvas hit paths.

## What e2e covers and excludes

**In scope (this repo)**

- Playground mounts the library with `data/out.rep` (or fixture bytes)
- Timeline visible; zoom/pan smoke; hover tooltip; single select → detail strip (maps to [UX_SPEC](../ui/UX_SPEC.md) scenarios S1–S3)
- Smoke that PIPE / summary panels render without crash (S1 / S4 bars; not S5 field list)

**Out of scope (v1 CI)**

- Opening files inside the MSTT VS Code extension
- MindStudio Insight / `.bin` paths
- Full visual parity with every PNG sketch (Phase 2 screenshot suite)

MSTT integration is verified manually or via mstt’s own tests after the library is published/linked.

## Fixtures

| Source | Use |
|--------|-----|
| [`data/out.rep`](../../data/out.rep) | Primary golden container for MVP CI (**Interim [DATA-31a](../context/decisions/interim/DATA.md)** — not sketch pixel-parity) |
| `tests/fixtures/` (when code exists) | Unpacked snapshots, expected `SwimlaneModel` / `ReportViewModel` JSON |
| Synthetic tiny traces | Edge cases (empty events, NA-only AIC columns, single lane) |

Rules:

1. Do not regenerate goldens casually — review binary/JSON diffs in PR.
2. Prefer asserting structured model fields over brittle full-file string equality where possible.
3. Pack/unpack scripts under `data/` remain the reference for container layout; unit tests should match [REP_FORMAT](../formats/REP_FORMAT.md).

## Mapping FEATURE_MATRIX → tests

Every **MVP (M)** row in [FEATURE_MATRIX.md](../ui/FEATURE_MATRIX.md) must eventually have ≥1 automated test. Where behavior is **Interim**, assert the interim rule and cite [decisions/interim/](../context/decisions/interim/) in the test title or comment (e.g. thin summary, hidden overview).

Suggested id scheme:

```text
PR-FMT-001   rep header / file table parse
PR-FMT-002   embed list matches out.rep
PR-VM-001    OpBasicInfo → summary fields
PR-VM-002    PipeUtilization → PIPE bar model
PR-SWIM-001  trace.json → processes/threads/events
PR-UI-001    ProfilingReport renders with fixture
PR-UI-002    select event emits detail payload
PR-E2E-001   playground loads out.rep          (UX S1)
PR-E2E-002   hover shows tooltip               (UX S3)
PR-E2E-003   click selects event               (UX S3)
```

Put the id in the test title, e.g. `it('PR-E2E-002: hover shows tooltip', …)`.

Maintain a short checklist in the PR listing matrix feature → test id(s), and optionally UX scenario ids (S1–S9). Traceability from spec to test is now machine-checked via `npm run check:specs` — see [specs/README.md](../../specs/README.md) for the spec index. Phase 2 (P2) features may land without e2e until that phase starts, but must not be marked M without tests.

## CI gate

On every PR:

```text
lint / typecheck → vitest (unit + component) → playwright (e2e)
```

Do not merge if tests for the touched matrix IDs are missing or red.

## Local commands (after scaffold)

Exact scripts will live in `package.json`. Expected shape:

```bash
npm test           # vitest
npm run test:e2e   # playwright
npm run playground # vite playground for manual checks
```

## Renderer testing notes

- Assert against `SwimlaneModel` and the `SwimlaneRenderer` interface (setModel / setView / hitTest), not WebGL internals.
- Canvas vs WebGL backends should share the same contract tests; swap implementations without rewriting e2e selectors that use `data-testid` on Vue chrome.
- Pixel-perfect Canvas assertions are discouraged in unit tests; use e2e/visual only when necessary.

## Related specs

- Formats: [REP_FORMAT](../formats/REP_FORMAT.md), [METRICS_AND_TRACE](../formats/METRICS_AND_TRACE.md)
- UI: [INTERACTIONS](../ui/INTERACTIONS.md), [FEATURE_MATRIX](../ui/FEATURE_MATRIX.md)
- Architecture: [ARCHITECTURE](../architecture/ARCHITECTURE.md)
