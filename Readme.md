# Profiling Report

Reusable **Vue 3** library for Ascend / CANN operator profiling visualization and analysis.

Primary goal: unify the MSTT (OP DevTools) profiling UX with a pypto-like swimlane experience for the new **`.rep` / `.ncrep`** report format, while keeping MindStudio Insight for legacy **`.bin`** dumps.

## Documentation

Start here: **[docs/README.md](docs/README.md)**

| Area | Entry |
|------|--------|
| Goals & context | [docs/context/PROJECT_GOALS.md](docs/context/PROJECT_GOALS.md) |
| Domain & users | [docs/context/DOMAIN_AND_USERS.md](docs/context/DOMAIN_AND_USERS.md) (pain points, glossary, UX link) |
| Market & competitors | [docs/context/MARKET_AND_COMPETITORS.md](docs/context/MARKET_AND_COMPETITORS.md) (NVIDIA Nsight analogues) |
| Open questions | [docs/context/OPEN_QUESTIONS.md](docs/context/OPEN_QUESTIONS.md) (blockers; resolution log) |
| Interim MVP defaults | [docs/context/INTERIM_DECISIONS.md](docs/context/INTERIM_DECISIONS.md) (engineering, not Product-final) |
| View data requirements | [docs/formats/VIEW_DATA_REQUIREMENTS.md](docs/formats/VIEW_DATA_REQUIREMENTS.md) |
| Development process | [docs/process/DEVELOPMENT.md](docs/process/DEVELOPMENT.md) (docs → specs → tests → code) |
| Delivery roadmap | [docs/process/roadmap/](docs/process/roadmap/) (M1–M3 to full UI) |
| Testing | [docs/process/TESTING.md](docs/process/TESTING.md) |
| Data formats | [docs/formats/FORMATS_COMPARISON.md](docs/formats/FORMATS_COMPARISON.md) (semantic: Insight / `.rep` / PyPTO) |
| UI & MVP scope | [docs/ui/FEATURE_MATRIX.md](docs/ui/FEATURE_MATRIX.md) |
| UX specification | [docs/ui/UX_SPEC.md](docs/ui/UX_SPEC.md) |
| Architecture | [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) (shared UI + adapters) |
| Components & models | [docs/architecture/COMPONENTS.md](docs/architecture/COMPONENTS.md) |
| Swimlane tech options | [docs/archive/research/SWIMLANE_IMPLEMENTATIONS.md](docs/archive/research/SWIMLANE_IMPLEMENTATIONS.md) |

## Sample data

- [`data/out.rep`](data/out.rep) — sample CANN report container
- [`data/out.trace.json`](data/out.trace.json) — sample Chrome Trace (CTEF) fixture
- [`data/ffn_dense.trace.json`](data/ffn_dense.trace.json) — denser CTEF fixture (async s/f pairs); `ph: 'C'` counters stripped (regenerate when a counter lane lands)
- [`data/sample.rep`](data/sample.rep) — nested multi-operator `npu-rep` container with two distinct operators: `op1` (small machine-view trace) and `op2` (~150k-event stress trace), both with dependency connections and distinct CSV content. Regenerate with `npm run build:sample` (requires **Python 3** as `python3` on PATH — on Windows install Python and ensure the `python3` shim exists, or run `python data/build_sample_rep.py` then refresh `data/sample.rep.sha256`). Writes [`data/sample.rep.sha256`](data/sample.rep.sha256); CI verifies it via `npm run check:sample`.
- [`data/pack_rep.py`](data/pack_rep.py) / [`data/unpack_rep.py`](data/unpack_rep.py) — pack / unpack helpers (Python 3)

```bash
python3 data/unpack_rep.py data/out.rep /tmp/out-rep
```

## Demo (playground)

Static playground demo is what Vercel deploys (`vercel.json` → `npm run build:demo` → `playground/dist`).

Fixtures are synced from the repo into `playground/public/data/` via `npm run sync:demo-fixtures` (runs automatically before `dev` / `build:demo`):

- `data/sample.rep` → `/data/sample.rep`
- `data/out.rep` → `/data/out.rep`
- `data/example.npu.rep` → `/data/example.rep`
- `data/ffn_dense.trace.json` → `/data/ffn_dense.trace.json`
- `data/out.trace.json` → `/data/out.trace.json` (synced for tests; not in the playground switcher)

```bash
npm run playground          # local SPA (syncs fixtures first)
npm run build:demo          # production static build
npm run preview:demo        # preview playground/dist
```

Fixture switcher: `?fixture=sample` (default), `?fixture=rep`, `?fixture=example`, or `?fixture=ffn_dense`.

Production URL: [https://profiling-report.vercel.app](https://profiling-report.vercel.app)

Redeploys on every push to `master` (and PR previews) via Vercel Git on the **IDE Frontend** team (`vercel.json` → `npm run build:demo` → `playground/dist`). Manual backup: [`.github/workflows/deploy-demo.yml`](.github/workflows/deploy-demo.yml) (`workflow_dispatch` only).

## Status

Library timeline MVP (engineering milestones 1–4) is green on `master` (`npm run ci`).

**[Delivery Milestone 1](docs/process/roadmap/milestone-1.md) (demo-data aside modes) — completed 2026-08-11.** All `out.rep` CSV embeds are parsed and surfaced in the aside panel: Summary (op name/type/duration/freq), PIPE occupancy with Cube|Vector toggle for MIX ops, compute detail tabs (PipeUtilization / ArithmeticUtilization / ResourceConflictRatio), and memory tabs (L0 / L2Cache / L1 / UB) with block switcher and CSV export. Swimlane functionality preserved. Specs, adapters, domain types, UI components, i18n, and tests are complete.

**[Milestone 1 progress report](docs/process/roadmap/M1_PROGRESS.md)** — full inventory of completed tasks, tests, and design decisions.

**Next:** [Milestone 2](docs/process/roadmap/milestone-2.md) — MSTT host + selection/deps + details + memory graph + roofline + timeline time-range measure, target **2026-08-25**.

Interim product defaults: [INTERIM_DECISIONS.md](docs/context/INTERIM_DECISIONS.md). See [specs/README.md](specs/README.md) for the spec index and `npm run check:specs` for traceability validation.

```bash
npm install
npm run ci              # lint, typecheck, unit / component / e2e
npm run playground
```
