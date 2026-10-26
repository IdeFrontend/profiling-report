#!/usr/bin/env node
/** Build the report-shell template if playground Export would 404. */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const template = join(root, 'dist/report-shell/template.html');
if (existsSync(template)) {
  process.exit(0);
}
console.log('[ensure-html-export-template] missing template — running build:report-shell');

// Prefer `node npm-cli.js` so Windows does not need to spawn `npm.cmd` (EINVAL without a
// shell after the CVE-2024-27980 patch). Fall back to a shell only when npm_execpath is unset.
const npmCli = process.env.npm_execpath;
const r = npmCli
  ? spawnSync(process.execPath, [npmCli, 'run', 'build:report-shell'], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    })
  : spawnSync('npm run build:report-shell', {
      cwd: root,
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });

if (r.error) {
  console.error('[ensure-html-export-template]', r.error.message);
}
process.exit(r.status ?? 1);
