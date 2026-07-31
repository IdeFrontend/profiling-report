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
| View data requirements | [docs/specs/formats/VIEW_DATA_REQUIREMENTS.md](docs/specs/formats/VIEW_DATA_REQUIREMENTS.md) |
| Development process | [docs/process/DEVELOPMENT.md](docs/process/DEVELOPMENT.md) (docs → specs → tests → code) |
| Testing | [docs/process/TESTING.md](docs/process/TESTING.md) |
| Data formats | [docs/specs/formats/FORMATS_COMPARISON.md](docs/specs/formats/FORMATS_COMPARISON.md) (semantic: Insight / `.rep` / PyPTO) |
| UI & MVP scope | [docs/specs/ui/FEATURE_MATRIX.md](docs/specs/ui/FEATURE_MATRIX.md) |
| UX specification | [docs/specs/ui/UX_SPEC.md](docs/specs/ui/UX_SPEC.md) |
| Architecture | [docs/specs/architecture/ARCHITECTURE.md](docs/specs/architecture/ARCHITECTURE.md) (shared UI + adapters) |
| Components & models | [docs/specs/architecture/COMPONENTS.md](docs/specs/architecture/COMPONENTS.md) |
| Swimlane tech options | [docs/research/SWIMLANE_IMPLEMENTATIONS.md](docs/research/SWIMLANE_IMPLEMENTATIONS.md) |

## Sample data

- [`data/out.rep`](data/out.rep) — sample CANN report container
- [`data/pack_rep.py`](data/pack_rep.py) / [`data/unpack_rep.py`](data/unpack_rep.py) — pack / unpack helpers

```bash
python3 data/unpack_rep.py data/out.rep /tmp/out-rep
```

## Status

Documentation and specs are in place with [interim MVP defaults](docs/context/INTERIM_DECISIONS.md). **Milestone 1 scaffold** is green (`npm run ci`). **Milestone 2** adds failing feature specs (`npm run test:feature` / `test:e2e:feature`) — implement slices to make them green. See [tests/README.md](tests/README.md).

```bash
npm install
npm run ci              # lint, typecheck, scaffold tests
npm run test:feature    # expected red until parse/UI slices
npm run playground
```
