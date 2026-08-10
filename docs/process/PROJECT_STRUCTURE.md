# Project Structure

How the profiling-report repository is organized — where things live, why, and the conventions that keep them connected.

## Guiding principle: proximity

Files that change together should live together. A feature touches a spec, a source module, and a test — the closer those three files are, the easier it is to reason about the feature.

```
spec / contract  ───→  what it should do
source            ───→  how it does it
test              ───→  proof that it does it
```

This repo uses **two strategies** depending on the module shape:

| Module shape | Strategy | Example |
|---|---|---|
| Pure TypeScript, shared logic, no 1:1 file mapping | **Mirrored**: `specs/` ↔ `src/` ↔ `tests/` | format-time, view-state |
| Vue SFC, self-contained component with 1:1 artifact mapping | **Co-located**: folder with `.vue` + `.spec.md` + `.spec.ts` | ReportToolbar, LaneGutter |

## Directory tree

```
profiling-report/
  specs/                                    root-level specs for core + architecture
    README.md                                 spec index and coverage matrix
    TEMPLATE.md                               standard spec template

    core/                                     mirrors src/domain/ and tests/unit/
      rep-format.spec.md
      input-formats.spec.md
      swimlane-model.spec.md
      view-models.spec.md
      format-time.spec.md
      view-state.spec.md
      swimlane-renderer.spec.md
      load-report-source.spec.md
      utilization.spec.md
      integration.spec.md                     cross-component integration + e2e test ACs
      scaffold.spec.md                        infrastructure smoke test ACs

    architecture/                             cross-cutting contracts
      public-api.spec.md
      mstt-integration.spec.md

  src/
    index.ts                                  library barrel export
    adapters/                                 format parsers and data adapters
      parseRep.ts, adaptRep.ts, loadReportSource.ts, chromeTraceToSwimlane.ts, ...
    domain/                                   pure TypeScript domain logic
      types.ts, formatTime.ts, viewState.ts, utilization.ts, laneColors.ts, ...
    i18n/                                     internationalization
      index.ts, ...

    swimlane/
      CanvasSwimlaneRenderer.ts               imperative canvas renderer
      SwimlaneCanvas/
        SwimlaneCanvas.vue                      Vue wrapper for the renderer
        SwimlaneCanvas.spec.md                  behavioral spec
        SwimlaneCanvas.spec.ts                  unit test

    ui/
      tokens.css                                shared design tokens (not component-specific)

      ProfilingReport/                          per-component folder
        ProfilingReport.vue                       root orchestration component
        ProfilingReport.spec.md                   behavioral spec (props, emits, behavior)
        ProfilingReport.spec.ts                   unit test

      ReportToolbar/
        ReportToolbar.vue
        ReportToolbar.spec.md
        ReportToolbar.spec.ts

      TimeOverviewBar/
        TimeOverviewBar.vue
        TimeOverviewBar.spec.md
        TimeOverviewBar.spec.ts

      StatsAside/
        StatsAside.vue
        StatsAside.spec.md
        StatsAside.spec.ts

      ReportLayout/
        ReportLayout.vue
        ReportLayout.spec.md
        ReportLayout.spec.ts

      LaneGutter/
        LaneGutter.vue
        LaneGutter.spec.md
        LaneGutter.spec.ts

      EventTooltip/
        EventTooltip.vue
        EventTooltip.spec.md
        EventTooltip.spec.ts

      DetailStrip/
        DetailStrip.vue
        DetailStrip.spec.md
        DetailStrip.spec.ts

  tests/
    unit/                                     unit tests for pure-TS domain modules
      scaffold.spec.ts, parseRep.spec.ts, viewModels.spec.ts, ...
    component/                                integration tests spanning multiple components
      ProfilingReport.feature.spec.ts
    e2e/                                      Playwright end-to-end tests against playground
      playground.spec.ts, feature.spec.ts
    helpers/                                  test utilities
      fixtures.ts
    fixtures/                                 test data
      out.trace.json, .gitkeep

  data/                                       profiling data fixtures
    out.rep                                     golden binary fixture for CI
    pack_rep.py, unpack_rep.py                  binary pack/unpack utilities

  playground/                                 demo SPA for local dev and Vercel deployment
    App.vue, main.ts, index.html, vite.config.ts

  docs/                                       descriptive system docs + design assets
    context/                                    goals, domain, market, decisions
    process/                                    development, testing, definition of ready
    archive/                                    historical research
    ui/                                         UX narrative + design sources (v930/)
      source/                                   full-frame dumps + manifest.yaml
      DESIGN_INDEX.md                           source → visual packs
    formats/                                    format explainers (non-AC narrative)
    architecture/                               packaging / component catalog prose
    visualization/                              view ↔ data mapping

  specs/                                      formal behavioral contracts (AC IDs)
    core/                                       mirrors domain/adapters
    architecture/                               public-api, mstt-integration

  scripts/
    sync-demo-fixtures.mjs                    copy data files into playground
    check-spec-coverage.mjs                   validate spec ↔ test traceability
    check-design-assets.mjs                   validate source/crops/provenance consistency
```

**Docs vs specs:** [`docs/`](.) holds descriptive system/UX/format docs and design assets. Root [`specs/`](../../specs/) (plus co-located `src/**/*.spec.md`) holds formal behavioral contracts checked by `npm run check:specs`.

## Per-component folder convention

Each Vue component lives in its own folder with the triad plus an optional design pack:

```
src/ui/ReportToolbar/
  ReportToolbar.vue          component (template + script)
  ReportToolbar.spec.md      behavioral + visual spec
  ReportToolbar.spec.ts      unit test (proof, using @vue/test-utils)
  visual/                    optional — component crops + provenance
    provenance.yaml            crop → source id + region
    search.png
    zoom.png
    actions.png
```

### When to create a component folder

- A new `.vue` file → create a folder, name it after the component (PascalCase), place the triad inside.
- When cropping from a design source for that component → add `visual/` with `provenance.yaml` and the crop PNGs.

### What goes in the spec (`*.spec.md`)

- **Inputs** (English prose — what the component receives, why each prop matters)
- **Outputs** (English prose — what the component emits, payloads, parent interaction)
- **Behavior** (non-obvious constraints, data flow, interactions with other components)
- **Visual** (component-local measures; axis chrome in [`AxisRuler.spec.md`](../../src/ui/AxisRuler/AxisRuler.spec.md), panel clamps in [`ReportLayout.spec.md`](../../src/ui/ReportLayout/ReportLayout.spec.md))
- Acceptance criteria with test IDs
- Edge cases
- **Design sketches** — relative links to `./visual/*.png` and/or `docs/ui/source/...`
- Dependencies on other specs

Follow the standard template: [`specs/TEMPLATE.md`](../../specs/TEMPLATE.md).

Design asset hierarchy: [`docs/ui/DESIGN_INDEX.md`](../ui/DESIGN_INDEX.md).

### What goes in the test (`*.spec.ts`)

- Uses `@vue/test-utils` (`mount`) to render the component
- Asserts DOM output matches the spec's acceptance criteria
- Each test case carries the matching spec AC ID (e.g., `it('PR-TOOLBAR-001: renders toolbar', ...)`)
- Imports from `./ComponentName.vue` (relative import, no path alias)

### Shared files at `src/ui/` level

`src/ui/tokens.css` is the only file that stays at the `src/ui/` level — it's a shared design token file imported by the library entry and not owned by any single component.

## Core modules (mirrored approach)

Pure TypeScript modules that don't map 1:1 to a single file use the mirrored approach:

| Layer | Location | Example |
|---|---|---|
| Spec | `specs/core/format-time.spec.md` | Behavioral contract |
| Source | `src/domain/formatTime.ts` | Implementation |
| Test | `tests/unit/formatTime.spec.ts` | Unit tests |

The `specs/core/` directory mirrors the source layout. Each spec file carries `source:` and `test:` metadata in its header pointing to the actual implementation and test files.

## Architecture specs

Cross-cutting contracts that don't belong to a single module live in `specs/architecture/`:

- `public-api.spec.md` — library exports, type surface, breaking change policy
- `mstt-integration.spec.md` — host integration contract (props, emits, lifecycle)

These have no corresponding test files directly; they describe integration contracts verified by integration tests.

## Integration and E2E tests

Integration and E2E tests span multiple components and stay in `tests/component/` and `tests/e2e/`:

| Layer | Example | What it tests |
|---|---|---|
| `tests/component/` | `ProfilingReport.feature.spec.ts` | Mounts root component, exercises complete tree |
| `tests/e2e/` | `feature.spec.ts` | Playwright tests against the live playground |

Their acceptance criteria are documented in `specs/core/integration.spec.md` with `PR-UI-*` and `PR-E2E-*` prefixes.

## Test ID conventions

Every test is identified by a unique ID with the format `PR-{NAMESPACE}-{NNN}`.

### Component namespaces

Each component gets its own prefix to avoid collisions and make ownership clear:

| Component | Prefix |
|---|---|
| ProfilingReport | `PR-ROOT-*` |
| ReportToolbar | `PR-TOOLBAR-*` |
| TimeOverviewBar | `PR-OVERVIEW-*` |
| StatsAside | `PR-STATS-*` |
| ReportLayout | `PR-LAYOUT-*` |
| LaneGutter | `PR-GUTTER-*` |
| EventTooltip | `PR-TOOLTIP-*` |
| DetailStrip | `PR-STRIP-*` |
| SwimlaneCanvas | `PR-CANVAS-*` |
| AxisRuler | `PR-AXIS-*` |
| CsvFieldListPanel | `PR-CSV-*` |
| CursorTimestamp | `PR-CURSOR-*` |
### Core module prefixes

| Module | Prefix |
|---|---|
| rep-format | `PR-FMT-*` |
| input-formats | `PR-FMT-*` (shared) |
| view-models | `PR-VM-*` |
| swimlane-model | `PR-SWIM-*` |
| format-time | `PR-TIME-*` |
| view-state | `PR-VIEW-*` |
| swimlane-renderer | `PR-RENDER-*` |
| load-report-source | `PR-JSON-*` |
| utilization | `PR-UTIL-*` |

### Integration prefixes

| Layer | Prefix |
|---|---|
| Component integration | `PR-UI-*` |
| E2E playground | `PR-E2E-*` |
| Scaffold smoke | `PR-SCAFFOLD-*` |

### Rules

1. Every acceptance criterion in a spec gets a unique ID.
2. Every test case includes that ID in its title: `it('PR-TOOLBAR-001: renders toolbar', ...)`.
3. IDs must be unique across all specs — the checker detects duplicates.
4. An ID must appear in exactly one spec and at least one test.

## Traceability validation

The script `scripts/check-spec-coverage.mjs` validates bidirectional traceability:

- Every spec AC has a matching test ID
- Every test ID appears in a spec
- No duplicate AC IDs across specs

Run it with `npm run check:specs`. It is wired into the CI pipeline (`lint → typecheck → check:specs → test:*`) and fails the build on any mismatch.

## Adding a new module

### New Vue component

1. Create `src/ui/{ComponentName}/` folder.
2. Add `ComponentName.vue`, `ComponentName.spec.md`, `ComponentName.spec.ts`.
3. Assign a unique prefix (e.g., `PR-{NAMESPACE}-*`).
4. Add acceptance criteria with IDs to the spec.
5. Write tests with matching IDs.
6. If the component is a child of `ProfilingReport`, update its import path in `ProfilingReport.vue`.
7. Run `npm run check:specs` to verify.

### New core module

1. Create `specs/core/{module-name}.spec.md` with the standard template.
2. Add the source module in `src/domain/` or `src/adapters/`.
3. Add tests in `tests/unit/{module-name}.spec.ts`.
4. Update `specs/README.md` with the new entry.
5. Run `npm run check:specs` to verify.

## Reference

- Spec template: [`specs/TEMPLATE.md`](../../specs/TEMPLATE.md)
- Spec index: [`specs/README.md`](../../specs/README.md)
- Development process: [`docs/process/DEVELOPMENT.md`](DEVELOPMENT.md)
- Testing strategy: [`docs/process/TESTING.md`](TESTING.md)
- Coverage checker: `node scripts/check-spec-coverage.mjs`
