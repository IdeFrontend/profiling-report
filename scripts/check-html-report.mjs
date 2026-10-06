#!/usr/bin/env node
/**
 * Smoke: assumes `npm run build:report-shell` already ran.
 * Checks in-repo generate script and the zero-dep dist/npu-rep-html.mjs bundle.
 */
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { stitchHtmlReport } from './stitch-html-report.mjs';

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

const mini = `<!doctype html>
<html lang="zh-CN"><head><title>profiling-report</title></head>
<body>
<!-- __NPU_REP_EMBED_START__ -->
<script>
  window.__NPU_REP_B64__ = '__HTML_EXPORT_B64__';
  window.__NPU_REP_NAME__ = '__HTML_EXPORT_NAME__';
  window.__NPU_REP_LOCALE__ = '__HTML_EXPORT_LOCALE__';
</script>
<!-- __NPU_REP_EMBED_END__ -->
<p lang="zh-CN">keep</p>
</body></html>`;
const miniHtml = stitchHtmlReport(mini, new Uint8Array([1, 2, 3, 4]), 'op.npu-rep', 'en');
if (!/<html[^>]*\blang="en"/.test(miniHtml)) fail('stitch-html-report: html lang not en');
if (!miniHtml.includes('<p lang="zh-CN">keep</p>')) fail('stitch-html-report: rewrote inner lang=');
if (miniHtml.includes('__HTML_EXPORT_LOCALE__')) fail('stitch-html-report: locale placeholder left');

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
