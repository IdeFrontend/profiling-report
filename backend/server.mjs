/**
 * Backend service for the new report format: extracts a raw `.npu-rep` container
 * via the external `npu-compute` tool (resolved by resolveNpuCompute.mjs) and
 * returns the extracted report files as base64 JSON.
 *
 *   POST /extract   body = raw .npu-rep bytes → { tool, files: [{ name, contentBase64 }] }
 *   GET  /health    → { ok: true }
 *
 * Plain Node (no deps). Env: PORT (8787), NPU_COMPUTE_BIN, NPU_COMPUTE_CACHE_DIR,
 * AUTO_DOWNLOAD_TOOL, TMP_DIR.
 */

import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractNpuRep } from './extract.mjs';
import { resolveNpuCompute } from './resolveNpuCompute.mjs';

const PORT = Number(process.env.PORT || 8787);

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'POST' && req.url === '/extract') {
      const body = await readBody(req);
      if (body.length === 0) {
        return sendJson(res, 400, { error: 'empty request body' });
      }

      const workDir = await mkdtemp(join(process.env.TMP_DIR || tmpdir(), 'npu-rep-'));
      try {
        const inputPath = join(workDir, 'input.npu-rep');
        const outputDir = join(workDir, 'out');
        await writeFile(inputPath, body);

        const { bin, source } = await resolveNpuCompute();
        const files = await extractNpuRep(bin, inputPath, outputDir);

        return sendJson(res, 200, {
          tool: source,
          files: files.map((f) => ({ name: f.name, contentBase64: f.data.toString('base64') })),
        });
      } finally {
        await rm(workDir, { recursive: true, force: true });
      }
    }

    return sendJson(res, 404, { error: 'not found' });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return sendJson(res, 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`[profiling-report] backend listening on :${PORT}`);
});
