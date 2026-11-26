/**
 * Dependency-free source workspace reader for the CLI HTML export.
 * Mirrors the host workspace pick the in-app export sends as `__NPU_SOURCE_TEXTS__`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const MAX_FILE_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const BINARY_SNIFF_BYTES = 4 * 1024;
const SKIP_DIRS = new Set(['.git', 'node_modules']);

/** Read every text file under `dir`, keyed by `/`-separated path relative to `dir`. */
export function readSourceWorkspace(dir) {
  const texts = {};
  let total = 0;
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const bytes = readFileSync(full);
      if (bytes.length > MAX_FILE_BYTES) continue;
      if (bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0)) continue;
      total += bytes.length;
      if (total > MAX_TOTAL_BYTES) {
        throw new Error(
          `source workspace text exceeds ${MAX_TOTAL_BYTES} bytes (8 MB): ${dir}`,
        );
      }
      texts[relative(dir, full).split(sep).join('/')] = bytes.toString('utf8');
    }
  };
  walk(dir);
  return texts;
}
