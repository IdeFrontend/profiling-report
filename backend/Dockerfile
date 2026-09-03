FROM ubuntu:22.04

# Windows local dev server shell — the Linux-only `npu-compute` tool cannot run
# natively on Windows, so the backend service runs here during development.
# The tool itself is NOT baked in: resolveNpuCompute still applies at runtime
# (explicit path -> autodetect + version check -> auto-download).

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/server.mjs backend/extract.mjs backend/resolveNpuCompute.mjs backend/downloadTool.mjs ./

EXPOSE 8787

CMD ["node", "server.mjs"]
