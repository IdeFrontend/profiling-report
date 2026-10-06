#!/usr/bin/env node
/**
 * Smoke: assumes `npm run build:report-shell` already ran.
 * Checks in-repo generate script and the zero-dep dist/npu-rep-html.mjs bundle.
 */
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const fixture = join(root, 'data/vector_muladd_plain.npu-rep');
const generate = join(root, 'scripts/generate-html-report.mjs');
const standalone = join(root, 'dist/npu-rep-html.mjs');

function fail(msg) {
  console.error(`[check-html-report] ${msg}`);
  process.exit(1);
}

function assertHtml(html, label) {
  if (html.includes("window.__NPU_REP_B64__ = '__HTML_EXPORT_B64__'")) {
    fail(`${label}: embed slot still has __HTML_EXPORT_B64__`);
  }
  if (html.includes("window.__NPU_REP_NAME__ = '__HTML_EXPORT_NAME__'")) {
    fail(`${label}: embed slot still has __HTML_EXPORT_NAME__`);
  }
  if (html.includes("window.__NPU_REP_LOCALE__ = '__HTML_EXPORT_LOCALE__'")) {
    fail(`${label}: embed slot still has __HTML_EXPORT_LOCALE__`);
  }
  if (!html.includes("window.__NPU_REP_LOCALE__ = 'zh-CN'")) {
    fail(`${label}: default locale is not zh-CN`);
  }
  if (!html.includes('id="app"')) fail(`${label}: missing #app mount root`);
  if (!html.includes('type="module"')) fail(`${label}: expected inlined module script`);
  if (!html.includes(readFileSync(fixture).toString('base64').slice(0, 32))) {
    fail(`${label}: embedded base64 does not match fixture prefix`);
  }
}

function runGenerate(script, out) {
  const r = spawnSync(
    process.execPath,
    [script, fixture, '-o', out, '--name', 'vector_muladd_plain.npu-rep'],
    { cwd: root, encoding: 'utf8' },
  );
  if (r.status !== 0) {
    process.stderr.write(r.stderr || r.stdout || '');
    fail(`${script} exited ${r.status}`);
  }
  assertHtml(readFileSync(out, 'utf8'), script);
  try {
    unlinkSync(out);
  } catch {
    /* keep on failure paths only */
  }
}

if (!existsSync(fixture)) fail(`missing fixture ${fixture}`);

runGenerate(generate, join(root, 'dist/report-shell/smoke-vector_muladd.html'));

if (!existsSync(standalone)) {
  fail(`missing ${standalone} — run: npm run build:report-shell`);
}
runGenerate(standalone, join(root, 'dist/report-shell/smoke-standalone.html'));

const enOut = join(root, 'dist/report-shell/smoke-locale-en.html');
const enRun = spawnSync(
  process.execPath,
  [standalone, fixture, '-o', enOut, '--en'],
  { cwd: root, encoding: 'utf8' },
);
if (enRun.status !== 0) {
  process.stderr.write(enRun.stderr || enRun.stdout || '');
  fail(`${standalone} --en exited ${enRun.status}`);
}
const enHtml = readFileSync(enOut, 'utf8');
if (!enHtml.includes("window.__NPU_REP_LOCALE__ = 'en'")) fail('standalone --en did not embed en');
if (!/\blang="en"/.test(enHtml)) fail('standalone --en did not set html lang');
try {
  unlinkSync(enOut);
} catch {
  /* keep on failure paths only */
}

console.log('[check-html-report] ok (generate + standalone)');
