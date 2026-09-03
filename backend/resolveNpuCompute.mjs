/**
 * Resolve the `npu-compute` binary. Priority ladder (per product decision):
 *
 *   1. Explicit path  — `NPU_COMPUTE_BIN` (plugin setting). Fail loudly if set but invalid.
 *   2. Autodetect    — scan `PATH` for `npu-compute` + `--version` compatibility check.
 *   3. Auto-download — only if both above fail and explicitly enabled.
 *
 * The tool is never bundled with the report or the plugin.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, constants } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { downloadNpuCompute } from './downloadTool.mjs';

const execFileAsync = promisify(execFile);

/** Minimum accepted `npu-compute` version (matches the pinned release). */
export const MIN_SUPPORTED_VERSION = '9.1.0';

/** Parse the first `x.y.z` triple from `--version` output. */
export function parseVersion(out) {
  const match = out.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return match.slice(1, 4).map(Number);
}

export function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** Run `bin --version` and check it is >= MIN_SUPPORTED_VERSION. */
async function versionCheck(bin) {
  try {
    const { stdout, stderr } = await execFileAsync(bin, ['--version']);
    const version = parseVersion(`${stdout} ${stderr}`);
    if (!version) return { ok: false, reason: 'unrecognized --version output' };
    if (compareVersions(version, MIN_SUPPORTED_VERSION.split('.').map(Number)) < 0) {
      return { ok: false, reason: `${version.join('.')} < ${MIN_SUPPORTED_VERSION}` };
    }
    return { ok: true, version: version.join('.') };
  } catch (cause) {
    return { ok: false, reason: `--version failed: ${cause instanceof Error ? cause.message : cause}` };
  }
}

async function isExecutable(file) {
  try {
    await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findOnPath(name) {
  const dirs = (process.env.PATH || '').split(delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = join(dir, name);
    if (await isExecutable(candidate)) return candidate;
  }
  return null;
}

/**
 * @param {{ explicitPath?: string, allowDownload?: boolean, cacheDir?: string }} [opts]
 * @param {{
 *   versionCheck?: (bin: string) => Promise<{ ok: boolean, version?: string, reason?: string }>,
 *   isExecutable?: (file: string) => Promise<boolean>,
 *   findOnPath?: (name: string) => Promise<string | null>,
 *   download?: (cacheDir?: string) => Promise<string>,
 * }} [deps] test seams
 * @returns {Promise<{ bin: string, source: 'explicit' | 'autodetect' | 'download' }>}
 */
export async function resolveNpuCompute(opts = {}, deps = {}) {
  const check = deps.versionCheck ?? versionCheck;
  const isExec = deps.isExecutable ?? isExecutable;
  const find = deps.findOnPath ?? findOnPath;
  const download = deps.download ?? downloadNpuCompute;

  const explicit = opts.explicitPath || process.env.NPU_COMPUTE_BIN || null;

  if (explicit) {
    if (!(await isExec(explicit))) {
      throw new Error(`[profiling-report] NPU_COMPUTE_BIN ${explicit} is not executable`);
    }
    const result = await check(explicit);
    if (!result.ok) {
      throw new Error(`[profiling-report] NPU_COMPUTE_BIN ${explicit} incompatible: ${result.reason}`);
    }
    return { bin: explicit, source: 'explicit' };
  }

  const found = await find('npu-compute');
  if (found) {
    const result = await check(found);
    if (result.ok) return { bin: found, source: 'autodetect' };
  }

  if (opts.allowDownload || process.env.AUTO_DOWNLOAD_TOOL === '1') {
    const bin = await download(opts.cacheDir || process.env.NPU_COMPUTE_CACHE_DIR);
    return { bin, source: 'download' };
  }

  throw new Error(
    '[profiling-report] npu-compute not found or incompatible — set NPU_COMPUTE_BIN or enable AUTO_DOWNLOAD_TOOL=1',
  );
}
