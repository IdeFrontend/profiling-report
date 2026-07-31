# Profiling Report

Reusable **Vue 3** library for Ascend / CANN operator profiling visualization and analysis.

Primary goal: unify the MSTT (OP DevTools) profiling UX with a pypto-like swimlane experience for the new **`.rep` / `.ncrep`** report format, while keeping MindStudio Insight for legacy **`.bin`** dumps.

## Documentation

Start here: **[docs/README.md](docs/README.md)**

| Area | Entry |
|------|--------|
| Goals & context | [docs/context/PROJECT_GOALS.md](docs/context/PROJECT_GOALS.md) |
| Data formats | [docs/specs/formats/FORMATS_COMPARISON.md](docs/specs/formats/FORMATS_COMPARISON.md) |
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

Documentation and sample data only. Library implementation is not started yet.
