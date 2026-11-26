#!/usr/bin/env node
/**
 * Smoke: assumes `npm run build:report-shell` already ran.
 * Checks in-repo generate script and the zero-dep dist/npu-rep-html.mjs bundle.
 */
import { mkdirSync, mkdtempSync, readFileSync, existsSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
  if (html.includes('window.__NPU_SOURCE_TEXTS__ = {')) {
    fail(`${label}: emitted __NPU_SOURCE_TEXTS__ without a source workspace`);
  }
  // The shell is a host: it must keep the baseline picker contract wired
  // (report-shell/App.vue — views/baselines.md "every host that mounts
  // ProfilingReport"). Without it the control silently vanishes from the
  // offline artifact. Artifact markers prove the glue is bundled; the source
  // assertions prove the bindings exist (bundle strings alone survive even
  // with the `:pick-baseline-file` binding dropped).
  if (
    !html.includes('toggle-baselines')
    || !html.includes('baseline-file-input')
  ) {
    fail(`${label}: exported shell lost the baseline picker host glue`);
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

function assertSourceMap(html, label) {
  const at = html.indexOf('window.__NPU_SOURCE_TEXTS__ = {');
  if (at < 0) fail(`${label}: missing __NPU_SOURCE_TEXTS__ map script`);
  // The viewer bundle also names the variable; only the embed slot assigns it.
  const embedAt = html.lastIndexOf('__NPU_REP_B64__ =');
  if (embedAt < 0 || at > embedAt) {
    fail(`${label}: source map script does not precede __NPU_REP_B64__`);
  }
}

function runGenerateWithSource(script, out, sourceDir) {
  const r = spawnSync(
    process.execPath,
    [script, fixture, '-o', out, '--source-workspace', sourceDir],
    { cwd: root, encoding: 'utf8' },
  );
  if (r.status !== 0) {
    process.stderr.write(r.stderr || r.stdout || '');
    fail(`${script} --source-workspace exited ${r.status}`);
  }
  const html = readFileSync(out, 'utf8');
  assertSourceMap(html, script);
  if (!html.includes('"nested/op.asc"')) fail(`${script}: source map lost nested/op.asc`);
  if (html.includes('blob.bin')) fail(`${script}: source map kept a binary file`);
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

const shellSource = readFileSync(join(root, 'report-shell/App.vue'), 'utf8');
for (const binding of [
  ':pick-baseline-file="pickBaselineFile"',
  ':baseline-rows="baselineRows"',
  ':baseline-reports="baselineReports"',
  '@update:baselines="onBaselinesUpdate"',
  '@update:baseline-rows="onBaselineRows"',
]) {
  if (!shellSource.includes(binding)) {
    fail(`report-shell/App.vue lost the baseline binding: ${binding}`);
  }
}
// A single-file artifact has no /data fixtures, so a demo recent list would
// offer rows that can never adapt; the shell must keep Browse as the only
// source of baselines.
if (shellSource.includes(':recent-baselines=')) {
  fail('report-shell/App.vue offers recent baselines a single-file artifact cannot load');
}

runGenerate(generate, join(root, 'dist/report-shell/smoke-vector_muladd.html'));

if (!existsSync(standalone)) {
  fail(`missing ${standalone} — run: npm run build:report-shell`);
}
runGenerate(standalone, join(root, 'dist/report-shell/smoke-standalone.html'));

const sourceDir = mkdtempSync(join(tmpdir(), 'npu-rep-source-'));
try {
  mkdirSync(join(sourceDir, 'nested'));
  writeFileSync(join(sourceDir, 'nested/op.asc'), 'int main() { return 0; }\n');
  writeFileSync(join(sourceDir, 'blob.bin'), Buffer.from([0x01, 0x00, 0x02]));
  runGenerateWithSource(generate, join(root, 'dist/report-shell/smoke-source.html'), sourceDir);
  runGenerateWithSource(standalone, join(root, 'dist/report-shell/smoke-standalone-source.html'), sourceDir);
} finally {
  rmSync(sourceDir, { recursive: true, force: true });
}

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
