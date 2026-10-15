---
name: npu-rep-html
description: >
  Generate a self-contained interactive HTML report from an Ascend/CANN `.npu-rep`
  (or classic cann-rep) profiling archive. Fetches the latest GitCode release of
  the zero-dep Node CLI `npu-rep-html.mjs` when that tag is not cached, and
  installs Node >= 20 when the current Node is missing or older.
  Works on Linux, macOS, and Windows.
  Use when the user asks for an HTML report, offline report, file:// share-out, CI
  profiling HTML artifact, `npu-rep-html`, or to turn `.npu-rep` into openable HTML.
---

# npu-rep HTML report

Turn a `.npu-rep` into one offline HTML file (interactive swimlane viewer). Needs **Node ≥ 20** and **`npu-rep-html.mjs`** from the latest [opdevtools/plugin_release](https://gitcode.com/opdevtools/plugin_release) GitCode release (currently tag `1.5.5`). Do not publish or commit the downloaded script.

On Windows, including Git Bash (`uname -s` is `MINGW*`, `MSYS*`, or `CYGWIN*`), use the PowerShell blocks and `%LOCALAPPDATA%`. Do not install the Linux tarball there. On PowerShell, call `curl.exe`, not `curl` (`curl` is an alias of `Invoke-WebRequest`).

## Resolve the script

1. If `NPU_REP_HTML` is set, use that path and do not download. If it is missing or not a file, stop and report the path.
2. If `NPU_REP_HTML` is unset, resolve the latest release (no token):

```bash
curl -fsSL "https://api.gitcode.com/api/v5/repos/opdevtools/plugin_release/releases/latest"
```

On Windows: `curl.exe -fsSL` with the same URL. Read `tag_name`. From `assets`, take the entry whose `name` is `npu-rep-html.mjs` and use its `browser_download_url` (`https://gitcode.com/opdevtools/plugin_release/releases/download/<tag>/npu-rep-html.mjs`).

3. Cache path:
   - Linux and macOS: `$HOME/.cache/npu-rep-html/<tag>/npu-rep-html.mjs`
   - Windows: `%LOCALAPPDATA%\npu-rep-html\<tag>\npu-rep-html.mjs`
4. **Skip the download** only when that cache path exists, is non-empty, and its first line is `#!/usr/bin/env node`. A temp file or a partial download is not a cache hit.
5. Otherwise download with a **GET that follows redirects** (`curl -fsSL` / `curl.exe -fsSL` already does). Do **not** use `curl -I` / HEAD: it returns **401**. A GET returns **302** to `file-cdn.gitcode.com`, then the script. Write the body to a temp file in the tag directory. Move it onto the cache path only after curl exits 0, the file is non-empty, and the first line is `#!/usr/bin/env node`. If any check fails, delete the temp file and stop. Do not leave a partial file at the cache path.

Linux and macOS:

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

Windows (PowerShell):

```powershell
$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:LOCALAPPDATA "npu-rep-html\<tag>"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$cache = Join-Path $dir "npu-rep-html.mjs"
$tmp = Join-Path $dir ("npu-rep-html.mjs." + [guid]::NewGuid().ToString("N"))
& curl.exe -fsSL -o "`"$tmp`"" "`"<browser_download_url>`""
$ok = $LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $tmp) -and ((Get-Item -LiteralPath $tmp).Length -gt 0) -and ((Get-Content -LiteralPath $tmp -TotalCount 1) -eq '#!/usr/bin/env node')
if (-not $ok) {
  Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  throw "npu-rep-html download failed"
}
# Same-volume replace. File.Replace is atomic; do not delete $cache first.
if (Test-Path -LiteralPath $cache) {
  [System.IO.File]::Replace($tmp, $cache, [NullString]::Value)
} else {
  [System.IO.File]::Move($tmp, $cache)
}
```

Do not search the working directory, `~/bin`, or the directory next to the `.npu-rep`. Do not run `npm run build:report-shell`.

## Node

Run `node -p "process.versions.node"`. If the major version is **≥ 20**, use that `node`. Do not downgrade a newer Node.

If `node` is missing or the major is **< 20**, install the current **Node 20** line, then prepend it to `PATH` and re-check. Stop if the install fails or the major is still < 20.

Prefer a version manager already on the machine. Linux and macOS: `nvm install 20 && nvm use 20`, or `fnm install 20 && fnm use 20`, or `n 20`. Windows: `fnm install 20`, then `fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression`, then `fnm use 20`; or nvm-windows `nvm install 20` and `nvm use` that 20.x. `n` does not run on Windows. If nvm-windows `nvm use` fails because the shell is not elevated, install the zip below instead.

Otherwise download the official Node 20 archive. Require the SHA-256 from `https://nodejs.org/dist/latest-v20.x/SHASUMS256.txt` to match before extract. Stage the checksum file, the archive, and the tree outside the live prefix. Replace the live prefix only after the staged tree contains the `node` binary. If an earlier step fails, delete the stage and leave the live prefix in place.

Linux and macOS: install into `$HOME/.local/npu-rep-node` (binary `bin/node`). If that prefix already has `bin/node` at major ≥ 20, only prepend `$HOME/.local/npu-rep-node/bin`. Match `uname -s` / `uname -m` (`Linux`→`linux`, `Darwin`→`darwin`, `x86_64`→`x64`, `aarch64` or `arm64`→`arm64`) to a `node-v20.*-<os>-<arch>.tar.xz` line. `MINGW*`, `MSYS*`, and `CYGWIN*` are Windows — stop and use the PowerShell block.

```bash
mkdir -p "$HOME/.local"
sums=$(mktemp)
tarball=$(mktemp)
stage=$(mktemp -d "$HOME/.local/npu-rep-node.staging.XXXXXX")
case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=darwin ;;
  MINGW*|MSYS*|CYGWIN*) echo "Windows detected ($(uname -s)); use the PowerShell Node block" >&2; exit 1 ;;
  *) echo "unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac
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

Windows: install into `%LOCALAPPDATA%\npu-rep-node` (the zip has `node.exe` at its root, not under `bin`). If that `node.exe` is already major ≥ 20, only prepend its directory. Arch: use `PROCESSOR_ARCHITEW6432` when set, otherwise `PROCESSOR_ARCHITECTURE`. `AMD64`→`win-x64`, `ARM64`→`win-arm64`. Any other arch: stop (there is no Node 20 `win-x86` build).

```powershell
$ErrorActionPreference = 'Stop'
$live = Join-Path $env:LOCALAPPDATA "npu-rep-node"
$liveNode = Join-Path $live "node.exe"
if ((Test-Path -LiteralPath $liveNode) -and ([int](& $liveNode -p "process.versions.node").Split('.')[0] -ge 20)) {
  $env:PATH = "$live;$env:PATH"
} else {
  $cpu = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
  $plat = switch ($cpu) { 'AMD64' { 'win-x64' } 'ARM64' { 'win-arm64' } default { throw "unsupported arch: $cpu" } }
  $work = Join-Path $env:LOCALAPPDATA ("npu-rep-node.staging." + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $work | Out-Null
  $sums = Join-Path $work "SHASUMS256.txt"
  $zip = Join-Path $work "node.zip"
  $extract = Join-Path $work "extract"
  try {
    & curl.exe -fsSL -o "`"$sums`"" "https://nodejs.org/dist/latest-v20.x/SHASUMS256.txt"
    if ($LASTEXITCODE -ne 0) { throw "checksum download failed" }
    $hit = Select-String -LiteralPath $sums -Pattern ('^([0-9a-f]{64})\s+(node-v20\.[0-9.]+-' + [regex]::Escape($plat) + '\.zip)$') | Select-Object -First 1
    if (-not $hit) { throw "no Node 20 zip for $plat" }
    $expected = $hit.Matches[0].Groups[1].Value.ToLowerInvariant()
    $name = $hit.Matches[0].Groups[2].Value
    & curl.exe -fsSL -o "`"$zip`"" "`"https://nodejs.org/dist/latest-v20.x/$name`""
    if ($LASTEXITCODE -ne 0) { throw "node zip download failed" }
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw "node zip checksum mismatch" }
    Expand-Archive -LiteralPath $zip -DestinationPath $extract
    $inner = Get-ChildItem -LiteralPath $extract -Directory | Where-Object { Test-Path (Join-Path $_.FullName "node.exe") } | Select-Object -First 1
    if (-not $inner) { throw "staged zip has no node.exe" }
    if (Test-Path -LiteralPath $live) { Remove-Item -LiteralPath $live -Recurse -Force }
    Move-Item -LiteralPath $inner.FullName -Destination $live
  } catch {
    $staged = Get-ChildItem -LiteralPath $extract -Directory -ErrorAction SilentlyContinue |
      Where-Object { Test-Path (Join-Path $_.FullName "node.exe") }
    if (-not $staged) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
    throw
  }
  Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
  $env:PATH = "$live;$env:PATH"
}
```

Re-check `node -p "process.versions.node"` and stop if the major is still < 20.

## Generate

```bash
node <script> <input.npu-rep> -o <output.html> [--name <title>] [--en|--zh]
```

Same arguments on Windows once `node` is on `PATH` (`node.exe` runs the `.mjs`; the shebang is not required to launch it).

- Default title: input basename when `--name` omitted
- Default locale: Chinese (`zh-CN`) when `--en` / `--zh` omitted; `--en` English, `--zh` Chinese
- Output is one interactive HTML file; open with a browser (`file://` works)
- Not for MSTT packaging — MSTT embeds the Vue library; this is share/CI only

## Example

```bash
node "$HOME/.cache/npu-rep-html/1.5.5/npu-rep-html.mjs" ./op.npu-rep -o ./op-report.html --en
```

```powershell
node "`"$env:LOCALAPPDATA\npu-rep-html\1.5.5\npu-rep-html.mjs`"" .\op.npu-rep -o .\op-report.html --en
```

Use the tag you just resolved, not a hardcoded `1.5.5`, when a newer release is current.

## After success

Tell the user the absolute output path and that they can open it in a browser.
