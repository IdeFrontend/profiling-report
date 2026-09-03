/**
 * Run the Linux-only `npu-compute` extractor and read its output folder.
 * Plain Node (no deps) — the backend is a thin wrapper over the external tool.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

/**
 * Extract a `.npu-rep` container into `outputDir` via
 * `npu-compute -i <in> -o <outdir>` and return the extracted files.
 */
export async function extractNpuRep(bin, inputPath, outputDir) {
  await execFileAsync(bin, ['-i', inputPath, '-o', outputDir]);
  return readReportFiles(outputDir);
}

/** Read every regular file in `dir` as `{ name, data }` (Buffer). */
export async function readReportFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const data = await readFile(join(dir, entry.name));
    files.push({ name: entry.name, data });
  }
  return files;
}
