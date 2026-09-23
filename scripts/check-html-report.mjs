#!/usr/bin/env node
/**
 * Smoke: build shell (if needed) is assumed done; generate HTML from a fixture and
 * assert placeholders were replaced and the mount root is present.
 */
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const fixture = join(root, 'data/vector_muladd_plain.npu-rep');
const out = join(root, 'dist/report-shell/smoke-vector_muladd.html');
const generate = join(root, 'scripts/generate-html-report.mjs');

function fail(msg) {
  console.error(`[check-html-report] ${msg}`);
  process.exit(1);
}

if (!existsSync(fixture)) fail(`missing fixture ${fixture}`);

const r = spawnSync(process.execPath, [generate, fixture, '-o', out, '--name', 'vector_muladd_plain.npu-rep'], {
  cwd: root,
  encoding: 'utf8',
});
if (r.status !== 0) {
  process.stderr.write(r.stderr || r.stdout || '');
  fail(`generate-html-report exited ${r.status}`);
}

const html = readFileSync(out, 'utf8');
if (html.includes('%%NPU_REP_B64%%')) fail('placeholder %%NPU_REP_B64%% still present');
if (html.includes('%%NPU_REP_NAME%%')) fail('placeholder %%NPU_REP_NAME%% still present');
if (!html.includes('window.__NPU_REP_B64__')) fail('missing window.__NPU_REP_B64__ assignment');
if (!html.includes('id="app"')) fail('missing #app mount root');
if (!html.includes('type="module"')) fail('expected inlined module script');
if (!html.includes(readFileSync(fixture).toString('base64').slice(0, 32))) {
  fail('embedded base64 does not match fixture prefix');
}

try {
  unlinkSync(out);
} catch {
  /* keep on failure paths only */
}

console.log('[check-html-report] ok');
