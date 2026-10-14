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

1. If `NPU_REP_HTML` is set, use that path and do not download. If it is missing or not a file, stop and report the path.
2. If `NPU_REP_HTML` is unset, resolve the latest release (no token):

```bash
curl -fsSL "https://api.gitcode.com/api/v5/repos/opdevtools/plugin_release/releases/latest"
```

Read `tag_name`. From `assets`, take the entry whose `name` is `npu-rep-html.mjs` and use its `browser_download_url` (`https://gitcode.com/opdevtools/plugin_release/releases/download/<tag>/npu-rep-html.mjs`).

3. Cache path: `$HOME/.cache/npu-rep-html/<tag>/npu-rep-html.mjs`.
4. **Skip the download** only when that cache path exists, is non-empty, and its first line is `#!/usr/bin/env node`. A temp file or a partial download is not a cache hit.
5. Otherwise download with a **GET that follows redirects** (`curl -fsSL` already does). Do **not** use `curl -I` / HEAD: it returns **401**. A GET returns **302** to `file-cdn.gitcode.com`, then the script. Write the body to a temp file in the tag directory. Move it onto the cache path only after curl exits 0, the file is non-empty, and the first line is `#!/usr/bin/env node`. If any check fails, delete the temp file and stop. Do not leave a partial file at the cache path.

```bash
mkdir -p "$HOME/.cache/npu-rep-html/<tag>"
cache="$HOME/.cache/npu-rep-html/<tag>/npu-rep-html.mjs"
tmp=$(mktemp "$HOME/.cache/npu-rep-html/<tag>/npu-rep-html.mjs.XXXXXX")
if curl -fsSL -o "$tmp" "<browser_download_url>" \
  && [ -s "$tmp" ] \
  && [ "$(head -n 1 "$tmp")" = '#!/usr/bin/env node' ]; then
  mv "$tmp" "$cache"
else
  rm -f "$tmp"
  echo "npu-rep-html download failed" >&2
  exit 1
fi
```

Do not search the working directory, `~/bin`, or the directory next to the `.npu-rep`. Do not run `npm run build:report-shell`.

## Node

Run `node -p "process.versions.node"`. If the major version is **≥ 20**, use that `node`. Do not downgrade a newer Node.

If `node` is missing or the major is **< 20**, install the current **Node 20** line, then prepend it to `PATH` and re-check. Stop if the install fails or the major is still < 20.

Prefer a version manager already on the machine: `nvm install 20 && nvm use 20`, or `fnm install 20 && fnm use 20`, or `n 20`.

Otherwise download the official tarball (no root, no apt) into `$HOME/.local/npu-rep-node`. If that prefix already has `bin/node` at major ≥ 20, only prepend it. Match `uname -s` / `uname -m` (`Linux`→`linux`, `Darwin`→`darwin`, `x86_64`→`x64`, `aarch64` or `arm64`→`arm64`) to a `node-v20.*-<os>-<arch>.tar.xz` line in `SHASUMS256.txt`, and require that SHA-256 to match before extract. `mkdir -p` the prefix parent. Stage the checksum file, the tarball, and the tree with `mktemp` (not a fixed `/tmp` name). Extract with `--strip-components=1`. Remove and replace `$HOME/.local/npu-rep-node` only after the staged tree has `bin/node`. If an earlier step fails, leave the live prefix in place.

```bash
mkdir -p "$HOME/.local"
sums=$(mktemp)
tarball=$(mktemp)
stage=$(mktemp -d "$HOME/.local/npu-rep-node.staging.XXXXXX")
case "$(uname -s)" in Linux) os=linux ;; Darwin) os=darwin ;; *) echo "unsupported OS: $(uname -s)" >&2; exit 1 ;; esac
case "$(uname -m)" in x86_64) arch=x64 ;; aarch64|arm64) arch=arm64 ;; *) echo "unsupported arch: $(uname -m)" >&2; exit 1 ;; esac
curl -fsSL -o "$sums" "https://nodejs.org/dist/latest-v20.x/SHASUMS256.txt" \
  && file=$(awk -v os="$os" -v arch="$arch" '$2 ~ "^node-v20\\.[0-9.]+-" os "-" arch "\\.tar\\.xz$" { print $2; exit }' "$sums") \
  && [ -n "$file" ] \
  && curl -fsSL -o "$tarball" "https://nodejs.org/dist/latest-v20.x/${file}" \
  && expected=$(awk -v file="$file" '$2 == file { print $1; exit }' "$sums") \
  && if command -v sha256sum >/dev/null 2>&1; then actual=$(sha256sum "$tarball" | awk '{ print $1 }'); else actual=$(shasum -a 256 "$tarball" | awk '{ print $1 }'); fi \
  && [ -n "$expected" ] && [ "$actual" = "$expected" ] \
  && tar -xJf "$tarball" -C "$stage" --strip-components=1 \
  && test -x "$stage/bin/node" \
  && rm -rf "$HOME/.local/npu-rep-node" \
  && mv "$stage" "$HOME/.local/npu-rep-node"
status=$?
rm -f "$sums" "$tarball"
if [ "$status" -ne 0 ]; then
  if [ ! -x "$stage/bin/node" ]; then rm -rf "$stage"; fi
  exit "$status"
fi
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
