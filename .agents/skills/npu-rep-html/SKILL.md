---
name: npu-rep-html
description: >
  Generate a self-contained interactive HTML report from an Ascend/CANN `.npu-rep`
  (or classic cann-rep) profiling archive. Fetches the latest GitCode release of
  the zero-dep Node CLI `npu-rep-html.mjs` when that tag is not cached, and
  installs Node >= 20 when the current Node is missing or older.
  Use when the user asks for an HTML report, offline report, file:// share-out, CI
  profiling HTML artifact, `npu-rep-html`, or to turn `.npu-rep` into openable HTML.
---

# npu-rep HTML report

Turn a `.npu-rep` into one offline HTML file (interactive swimlane viewer). Needs **Node ≥ 20** and **`npu-rep-html.mjs`** from the latest [opdevtools/plugin_release](https://gitcode.com/opdevtools/plugin_release) GitCode release (currently tag `1.5.5`). Do not publish or commit the downloaded script.

## Resolve the script

1. If `NPU_REP_HTML` is set and that file exists, use it. Do not download.
2. Otherwise resolve the latest release (no token):

```bash
curl -fsSL "https://api.gitcode.com/api/v5/repos/opdevtools/plugin_release/releases/latest"
```

Read `tag_name`. From `assets`, take the entry whose `name` is `npu-rep-html.mjs` and use its `browser_download_url` (`https://gitcode.com/opdevtools/plugin_release/releases/download/<tag>/npu-rep-html.mjs`).

3. Cache path: `$HOME/.cache/npu-rep-html/<tag>/npu-rep-html.mjs`.
4. **Skip the download** when that file exists, is non-empty, and the first line is `#!/usr/bin/env node`.
5. Otherwise download with a **GET that follows redirects** (`curl -fsSL` already does). Do **not** use `curl -I` / HEAD: it returns **401**. A GET returns **302** to `file-cdn.gitcode.com`, then the script.

```bash
mkdir -p "$HOME/.cache/npu-rep-html/<tag>"
curl -fsSL -o "$HOME/.cache/npu-rep-html/<tag>/npu-rep-html.mjs" "<browser_download_url>"
```

6. Reject the file (delete it and stop) if it is empty or does not start with `#!/usr/bin/env node` — that is an HTML or JSON error page, not the CLI.

Do not search the working directory, `~/bin`, or the directory next to the `.npu-rep`. Do not run `npm run build:report-shell`.

## Node

Run `node -p "process.versions.node"`. If the major version is **≥ 20**, use that `node`. Do not downgrade a newer Node.

If `node` is missing or the major is **< 20**, install the current **Node 20** line, then prepend it to `PATH` and re-check. Stop if the install fails or the major is still < 20.

Prefer a version manager already on the machine: `nvm install 20 && nvm use 20`, or `fnm install 20 && fnm use 20`, or `n 20`.

Otherwise download the official tarball (no root, no apt) into `$HOME/.local/npu-rep-node`. If that prefix already has `bin/node` at major ≥ 20, only prepend it. Match `uname -s` / `uname -m` (`Linux`→`linux`, `Darwin`→`darwin`, `x86_64`→`x64`, `aarch64` or `arm64`→`arm64`) against a name in:

```bash
curl -fsSL "https://nodejs.org/dist/latest-v20.x/SHASUMS256.txt"
```

```bash
curl -fsSL -o /tmp/node20.tar.xz "https://nodejs.org/dist/latest-v20.x/node-v20.<patch>-<os>-<arch>.tar.xz"
tar -xJf /tmp/node20.tar.xz -C "$HOME/.local"
rm -rf "$HOME/.local/npu-rep-node"
mv "$HOME/.local"/node-v20.*-"<os>-<arch>" "$HOME/.local/npu-rep-node"
export PATH="$HOME/.local/npu-rep-node/bin:$PATH"
```

## Generate

```bash
node <script> <input.npu-rep> -o <output.html> [--name <title>] [--en|--zh]
```

- Default title: input basename when `--name` omitted
- Default locale: Chinese (`zh-CN`) when `--en` / `--zh` omitted; `--en` English, `--zh` Chinese
- Output is interactive HTML; open with a browser (`file://` works)
- Not for MSTT packaging — MSTT embeds the Vue library; this is share/CI only

## Example

```bash
node "$HOME/.cache/npu-rep-html/1.5.5/npu-rep-html.mjs" ./op.npu-rep -o ./op-report.html --en
```

Use the tag you just resolved, not a hardcoded `1.5.5`, when a newer release is current.

## After success

Tell the user the absolute output path and that they can open it in a browser.
