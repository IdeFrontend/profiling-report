# Backend: `npu-compute` extraction service

Extracts the new `.npu-rep` report format via the external, Linux-only
`npu-compute` tool and returns the extracted report files as JSON for the
frontend (`loadReportFiles`).

The tool is **never bundled** with the report or the plugin. It is resolved at
runtime, in this order:

1. **Explicit path** — plugin setting, exported as `NPU_COMPUTE_BIN`.
2. **Autodetect** — `PATH` scan + `--version` compatibility check
   (minimum `9.1.0`).
3. **Auto-download** — only if both above fail and `AUTO_DOWNLOAD_TOOL=1` is set;
   downloads the pinned `cann-asc-tools_9.1.0_linux-x86_64(1).run` into
   `NPU_COMPUTE_CACHE_DIR` (default `~/.cache/profiling-report/npu-compute`).

## Endpoints

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/health` | — | `{ "ok": true }` |
| `POST` | `/extract` | raw `.npu-rep` bytes | `{ "tool": "explicit\|autodetect\|download", "files": [{ "name", "contentBase64" }] }` |

## Run — native Linux (or WSL)

```bash
npu-compute --version          # ensure >= 9.1.0, or:
export NPU_COMPUTE_BIN=/path/to/npu-compute
node backend/server.mjs        # or: npm run backend:start
```

## Run — Windows (local dev server)

Docker is used **only** for the local dev server on Windows (the Linux tool
can't run natively there):

```bash
docker build -t profiling-report-backend -f backend/Dockerfile .
docker run --rm -p 8787:8787 \
  -e AUTO_DOWNLOAD_TOOL=1 \
  -v "$HOME/.cache/profiling-report:/root/.cache/profiling-report" \
  profiling-report-backend
```

Alternatively, run natively under WSL (same commands as Linux above).

## Extraction command

```bash
npu-compute -i <npu-rep file path> -o <output file path>
```

## Env vars

| Var | Default | Meaning |
|-----|---------|---------|
| `PORT` | `8787` | Listen port |
| `NPU_COMPUTE_BIN` | unset | Explicit tool path (rung 1) |
| `NPU_COMPUTE_CACHE_DIR` | `~/.cache/profiling-report/npu-compute` | Auto-download cache dir |
| `AUTO_DOWNLOAD_TOOL` | unset | Set `1` to enable rung 3 |
| `TMP_DIR` | OS tmp | Work dir for each extraction |
