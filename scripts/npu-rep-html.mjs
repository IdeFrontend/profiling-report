#!/usr/bin/env node
/**
 * npm bin entry. The packed CLI lives at dist/npu-rep-html.mjs after
 * `npm run build:report-shell` (`npm run build` does not produce it).
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packed = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/npu-rep-html.mjs');
if (!existsSync(packed)) {
  console.error(`[npu-rep-html] missing ${packed}
Run: npm run build:report-shell
(npm link / the bin command need that step; npm run build does not pack the CLI.)`);
  process.exit(1);
}
const r = spawnSync(process.execPath, [packed, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
