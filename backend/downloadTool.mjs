/**
 * Download the pinned `npu-compute` release and locate the binary in its
 * unpacked tree. Used only as the last rung of `resolveNpuCompute` and only
 * when explicitly enabled (`AUTO_DOWNLOAD_TOOL=1`).
 *
 * ponytail: the `.run` is assumed to be a Makeself archive, unpacked with
 * `--target <dir> --noexec`; confirm the exact flags against the real release
 * before relying on this in CI. The binary is found by name, not by a fixed
 * layout, so it keeps working if the archive layout changes.
 */

import { createWriteStream } from 'node:fs';
import { access, chmod, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const execFileAsync = promisify(execFile);

export const TOOL_URL =
  'https://gitcode.com/ljtyzx/mstt_mlh/releases/download/1.5.2/cann-asc-tools_9.1.0_linux-x86_64%281%29.run';
export const TOOL_VERSION = '9.1.0';

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Recursively find a file named `npu-compute` under `root`. */
async function findNpuComputeBinary(root) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = await findNpuComputeBinary(full);
      if (nested) return nested;
    } else if (entry.isFile() && entry.name === 'npu-compute') {
      return full;
    }
  }
  return null;
}

/** @param {string} [cacheDir] */
export async function downloadNpuCompute(cacheDir) {
  const root = cacheDir || join(homedir(), '.cache', 'profiling-report', 'npu-compute');
  await mkdir(root, { recursive: true });

  const runPath = join(root, `cann-asc-tools_${TOOL_VERSION}_linux-x86_64.run`);
  const extractedDir = join(root, 'extracted');

  if (!(await exists(runPath))) {
    const res = await fetch(TOOL_URL);
    if (!res.ok || !res.body) {
      throw new Error(`[profiling-report] failed to download npu-compute: ${res.status}`);
    }
    await pipeline(Readable.fromWeb(res.body), createWriteStream(runPath));
  }

  await chmod(runPath, 0o755);
  await mkdir(extractedDir, { recursive: true });

  // ponytail: Makeself flags assumed — see module docstring.
  await execFileAsync(runPath, ['--target', extractedDir, '--noexec'], { cwd: root });

  const bin = await findNpuComputeBinary(extractedDir);
  if (!bin) {
    throw new Error('[profiling-report] npu-compute binary not found after extraction');
  }
  await chmod(bin, 0o755);
  return bin;
}
