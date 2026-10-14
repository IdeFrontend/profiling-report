---
name: npu-rep-html
description: >
  Generate a self-contained interactive HTML report from an Ascend/CANN `.npu-rep`
  (or classic cann-rep) profiling archive using the zero-dep Node CLI `npu-rep-html.mjs`.
  Use when the user asks for an HTML report, offline report, file:// share-out, CI
  profiling HTML artifact, `npu-rep-html`, or to turn `.npu-rep` into openable HTML.
---

# npu-rep HTML report

Turn a `.npu-rep` into one offline HTML file (interactive swimlane viewer). Requires **Node ≥ 20** and the hand-distributed **`npu-rep-html.mjs`** script (not published to npm/CDN).

## Resolve the script

Find `npu-rep-html.mjs` in this order; use the first hit:

1. Env var `NPU_REP_HTML` (absolute or relative path to the `.mjs`)
2. `./npu-rep-html.mjs` in the current working directory
3. Same directory as the input `.npu-rep` (or `.rep`) file
4. `$HOME/bin/npu-rep-html.mjs` if that file exists
5. Path next to this skill file, if the host exposes the skill directory on disk

If none exist: **stop and ask the user** where `npu-rep-html.mjs` is. Do **not** download it. Do **not** run `npm run build:report-shell` unless you are already inside the `profiling-report` repo and `package.json` defines that script (maintainer path only).

## Generate

```bash
node <script> <input.npu-rep> -o <output.html> [--name <title>] [--en|--zh]
```

- Default title: input basename when `--name` omitted
- Default locale: Chinese (`zh-CN`) when `--en` / `--zh` omitted; `--en` English, `--zh` Chinese
- Output is interactive HTML; open with a browser (`file://` works)
- Not for MSTT packaging — MSTT embeds the Vue library; this is share/CI only

## Examples

```bash
node npu-rep-html.mjs ./op.npu-rep -o ./op-report.html --en
NPU_REP_HTML=~/bin/npu-rep-html.mjs node "$NPU_REP_HTML" ./op.npu-rep -o /tmp/op.html --name op
```

## After success

Tell the user the absolute output path and that they can open it in a browser.
