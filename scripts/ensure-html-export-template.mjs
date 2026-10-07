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
const r = spawnSync('npm', ['run', 'build:report-shell'], { cwd: root, stdio: 'inherit' });
process.exit(r.status ?? 1);
