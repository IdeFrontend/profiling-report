# Profiling Report

Reusable **Vue 3** library for Ascend / CANN operator profiling visualization and analysis.

Primary goal: unify the MSTT (OP DevTools) profiling UX with a pypto-like swimlane experience for the product **`.npu-rep`** report format ([PROC-2](docs/context/decisions/PROC.md)), while keeping MindStudio Insight for legacy **`.bin`** dumps.

## Documentation

Start here: **[docs/README.md](docs/README.md)**

| Area | Entry |
|------|--------|
| Goals & context | [docs/context/PROJECT_GOALS.md](docs/context/PROJECT_GOALS.md) |
| Domain & users | [docs/context/DOMAIN_AND_USERS.md](docs/context/DOMAIN_AND_USERS.md) (pain points, glossary, UX link) |
| Market & competitors | [docs/context/MARKET_AND_COMPETITORS.md](docs/context/MARKET_AND_COMPETITORS.md) (NVIDIA Nsight analogues) |
| Open questions | [docs/context/questions/](docs/context/questions/) (blockers; resolution log) |
| Interim MVP defaults | [docs/context/decisions/interim/](docs/context/decisions/interim/) (engineering, not Product-final) |
| View data requirements | [docs/formats/VIEW_DATA_REQUIREMENTS.md](docs/formats/VIEW_DATA_REQUIREMENTS.md) |
| Development process | [docs/process/DEVELOPMENT.md](docs/process/DEVELOPMENT.md) (docs → specs → tests → code) |
| Delivery roadmap | [docs/process/roadmap/](docs/process/roadmap/) (M1–M3 to full UI) |
| Testing | [docs/process/TESTING.md](docs/process/TESTING.md) |
| Data formats | [docs/formats/FORMATS_COMPARISON.md](docs/formats/FORMATS_COMPARISON.md) (semantic: Insight / `.npu-rep` / PyPTO) |
| UI & MVP scope | [docs/ui/FEATURE_MATRIX.md](docs/ui/FEATURE_MATRIX.md) |
| UX specification | [docs/ui/UX_SPEC.md](docs/ui/UX_SPEC.md) |
| Architecture | [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) (shared UI + adapters) |
| Components & models | [docs/architecture/COMPONENTS.md](docs/architecture/COMPONENTS.md) |
| Swimlane tech options | [docs/archive/research/SWIMLANE_IMPLEMENTATIONS.md](docs/archive/research/SWIMLANE_IMPLEMENTATIONS.md) |

## Sample data

- [`data/out.rep`](data/out.rep) — sample CANN report container
- [`data/result.npu-rep`](data/result.npu-rep) — product 160-byte `npu-rep` sample (parsed in-browser via `parseNpuRep160`; partial — no `trace.json`)
- [`data/out.trace.json`](data/out.trace.json) — sample Chrome Trace (CTEF) fixture
- [`data/ffn_dense.trace.json`](data/ffn_dense.trace.json) — denser CTEF fixture (async s/f pairs); `ph: 'C'` counters stripped (regenerate when a counter lane lands)
- [`data/sample.lite.rep`](data/sample.lite.rep) — lite nested multi-operator **product** `npu-rep` (160-byte FileInfo; op2 omits ~30 MB `trace.json`). Not standalone-valid: hydrate via [`hydrateSampleRep`](playground/hydrateSampleRep.ts) / [`generateSampleOp2Trace`](playground/generateSampleOp2Trace.ts) before `loadReportSource`. Regenerate with `npm run build:sample` (Python 3 as `python3`). CI verifies [`data/sample.lite.rep.sha256`](data/sample.lite.rep.sha256) via `npm run check:sample`. Default `?fixture=sample` selects **op1**, whose SCALAR / MTE2 / ALL leaves carry intentional call-stack nests spaced across the timeline so multi-height lanes are visible; op2 stays exclusive. Both operators embed four Ascend C source files (cube, MTE, fixpipe, tile helper) plus a shared objdump, `summary.db` PC-sampling metrics (stall, instructions, warp occupancy), a HardwareInfo Roofline category, and `UbRwAccesses.csv` (packed; not a heat source — Layout+Cells SSOT). op1 `Code` frames open those files on the Source tab.
- [`data/pack_rep.py`](data/pack_rep.py) / [`data/unpack_rep.py`](data/unpack_rep.py) — pack / unpack helpers (Python 3)

```bash
python3 data/unpack_rep.py data/out.rep /tmp/out-rep
```

## Offline HTML report (CLI)

Self-contained interactive HTML for local share-out and CI artifacts (not the MSTT packaging form — that remains the Vue library).

```bash
npm run build:report-shell
npm run generate:html-report -- path/to/report.npu-rep -o report.html --en
# or: node scripts/generate-html-report.mjs path/to/report.npu-rep -o report.html --zh
# or (after build:report-shell, then npm link): npu-rep-html path/to/report.npu-rep -o report.html
# attach a source folder when the pack omitted Ascend C source:
npm run generate:html-report -- path/to/report.npu-rep -o report.html --en --source-workspace path/to/src
# `npm run build` does not pack the CLI; the bin fails fast until build:report-shell.
```

Open `report.html` in a browser (`file://` works). Rebuild the shell when viewer code changes; the generate step only embeds report bytes into the prebuilt template.

**Source workspace.** Both generators (`scripts/generate-html-report.mjs` and `dist/npu-rep-html.mjs`) accept `--source-workspace <dir>`. The scan is recursive and text-only: it skips `.git` / `node_modules`, files larger than 256 KiB, and binary files (a NUL byte in the first 4 KiB); total text is capped at 8 MiB (the command fails above the cap). Keys are `/`-separated paths relative to `<dir>`, so the matcher can use exact path, longest shared suffix, then basename.

The option fills only `// missing source embed:` files. Text packed in the leaf stays authoritative and is never replaced. In the viewer, the Source tab shows **Pick source workspace** while the open report has placeholders; 源码对比 shows a separate button for the open report (left) and the baseline (right), and the baseline button is absent when that pack already carries source. 源码对比 is available with any checked baseline; a baseline without source opens an explicit empty right pane with a hint. The in-app pick records matched open-report text for HTML export, so the downloaded file carries `window.__NPU_SOURCE_TEXTS__` next to the report bytes; a baseline pick stays local and is never exported. Only the `source-diff` demo fixtures omit embedded source — every other pack keeps packed source. Each demo operator carries two source files: a renamed kernel variant and one shared helper name that pairs across operators.

The playground toolbar **Download HTML Report** action writes the current viewer **locale** into the file (`allowHtmlExport` is opt-in; playground passes true). Requires `npm run build:report-shell` once so `/npu-rep-html-template.txt` is copied into the playground public dir.

### Zero-dep distribution

`npm run build:report-shell` also writes **`dist/npu-rep-html.mjs`** (~1 MB): generator + embedded viewer shell in one ESM file. Consumers need only **Node ≥ 20** (no `npm install`, no sidecar template):

```bash
node dist/npu-rep-html.mjs path/to/report.npu-rep -o report.html --en
node dist/npu-rep-html.mjs path/to/report.npu-rep -o report.html --source-workspace path/to/src
# or anywhere after copying the file:
node npu-rep-html.mjs path/to/report.npu-rep -o report.html
```

The standalone script is build output under `dist/` (gitignored), **not committed in this repo** (no npm / CDN). Published copies are the `opdevtools/plugin_release` GitCode release assets. `package.json` `bin` (`npu-rep-html`) is a stub that runs `dist/npu-rep-html.mjs` or exits telling you to run `npm run build:report-shell` — `npm link` still needs that step first (`npm run build` does not pack the CLI).

### External agents

Copy [`.agents/skills/npu-rep-html/SKILL.md`](.agents/skills/npu-rep-html/SKILL.md) into the agent skills folder. On Linux, macOS, and Windows, the skill fetches `npu-rep-html.mjs` from the latest [opdevtools/plugin_release](https://gitcode.com/opdevtools/plugin_release) GitCode release when that tag is not already cached. Hand delivery of the script is not required. Set `NPU_REP_HTML` to pin a local copy and skip the download.

CI (in-repo):

```bash
npm ci
npm run build:report-shell
npm run generate:html-report -- "$REPORT_PATH" -o artifacts/profiling-report.html
# or: node dist/npu-rep-html.mjs "$REPORT_PATH" -o artifacts/profiling-report.html
```

Smoke: `npm run check:html-report` (needs a prior `build:report-shell`; checks both the in-repo generator and `dist/npu-rep-html.mjs`).

## Demo (playground)

Static playground demo is what Vercel deploys (`vercel.json` → `npm run build:demo` → `playground/dist`).

Fixtures are synced from the repo into `playground/public/data/` via `npm run sync:demo-fixtures` (runs automatically before `dev` / `build:demo`):

- `data/sample.lite.rep` → `/data/sample.lite.rep`
- `data/out.rep` → `/data/out.rep`
- `data/example.npu.rep` → `/data/example.rep`
- `data/ffn_dense.trace.json` → `/data/ffn_dense.trace.json`
- `data/out.trace.json` → `/data/out.trace.json` (synced for tests; not in the playground switcher)

Report fixtures under `data/` (`*.npu-rep`, `*.db`) are **Git LFS**. The Vercel install command runs [`scripts/checkout-lfs.sh`](scripts/checkout-lfs.sh) before `npm ci`. That checks out `data/**` with `git lfs pull` when `git-lfs` is installed, and otherwise downloads the pointer oids from the GitHub LFS API (the Vercel build image has no `git-lfs`). `sync:demo-fixtures` exits if a copied file is still an LFS pointer.

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

Interim product defaults: [decisions/interim/](docs/context/decisions/interim/). See [specs/README.md](specs/README.md) for the spec index and `npm run check:specs` for traceability validation.

UI source mockups under [`docs/ui/source/`](docs/ui/source/) use **Git LFS**. Install once (`git lfs install`) before cloning; otherwise you get pointer files instead of images.

```bash
npm install
npm run ci              # lint, typecheck, unit / component / e2e
npm run playground
```
