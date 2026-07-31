# Profiling Report

Reusable **Vue 3** library for Ascend / CANN operator profiling visualization and analysis.

Primary goal: unify the MSTT (OP DevTools) profiling UX with a pypto-like swimlane experience for the new **`.rep` / `.ncrep`** report format, while keeping MindStudio Insight for legacy **`.bin`** dumps.

## Documentation

Start here: **[docs/README.md](docs/README.md)**

| Area | Entry |
|------|--------|
| Goals & context | [docs/context/PROJECT_GOALS.md](docs/context/PROJECT_GOALS.md) |
| Open questions | [docs/context/OPEN_QUESTIONS.md](docs/context/OPEN_QUESTIONS.md) (blockers before complete specs) |
| Development process | [docs/process/DEVELOPMENT.md](docs/process/DEVELOPMENT.md) (docs → specs → tests → code) |
| Testing | [docs/process/TESTING.md](docs/process/TESTING.md) |
| Data formats | [docs/specs/formats/FORMATS_COMPARISON.md](docs/specs/formats/FORMATS_COMPARISON.md) (semantic: Insight / `.rep` / PyPTO) |
| UI & MVP scope | [docs/specs/ui/FEATURE_MATRIX.md](docs/specs/ui/FEATURE_MATRIX.md) |
| Architecture | [docs/specs/architecture/ARCHITECTURE.md](docs/specs/architecture/ARCHITECTURE.md) |
| Swimlane tech options | [docs/research/SWIMLANE_IMPLEMENTATIONS.md](docs/research/SWIMLANE_IMPLEMENTATIONS.md) |

## Sample data

- [`data/out.rep`](data/out.rep) — sample CANN report container
- [`data/pack_rep.py`](data/pack_rep.py) / [`data/unpack_rep.py`](data/unpack_rep.py) — pack / unpack helpers

```bash
python3 data/unpack_rep.py data/out.rep /tmp/out-rep
```

## Status

Documentation, specs, process guides, and sample data. Specs are not acceptance-complete until [open questions](docs/context/OPEN_QUESTIONS.md) (especially P0) are resolved. Library and test infrastructure are not scaffolded yet.
