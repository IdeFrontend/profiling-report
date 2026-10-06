#!/usr/bin/env node
/**
 * Stitch a self-contained interactive HTML report from a .npu-rep (or cann-rep) file.
 *
 *   node scripts/generate-html-report.mjs <input.npu-rep> -o <output.html> [--name <title>] [--en|--zh]
 *   npm run generate:html-report -- <input.npu-rep> -o <output.html>
 *
 * Requires a prior `npm run build:report-shell` (writes dist/report-shell/template.html).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const templatePath = resolve(root, 'dist/report-shell/template.html');

function usage() {
  console.error(`Usage: generate-html-report.mjs <input.npu-rep> -o <output.html> [--name <title>] [--en|--zh]

Build the shell first: npm run build:report-shell`);
}

function fail(msg, code = 1) {
  console.error(`[generate-html-report] ${msg}`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let input = null;
  let output = null;
  let name = null;
  let locale = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-o' || a === '--output') {
      output = args[++i];
      continue;
    }
    if (a === '--name') {
      name = args[++i];
      continue;
    }
    if (a === '--en' || a === '--zh') {
      if (locale) fail('use only one of --en / --zh');
      locale = a === '--en' ? 'en' : 'zh-CN';
      continue;
    }
    if (a === '-h' || a === '--help') {
      usage();
      process.exit(0);
    }
    if (a.startsWith('-')) fail(`unknown option ${a}`);
    if (input) fail(`unexpected argument ${a}`);
    input = a;
  }
  return { input, output, name, locale };
}

const { input, output, name, locale } = parseArgs(process.argv);
if (!input || !output) {
  usage();
  process.exit(1);
}

const inputPath = resolve(process.cwd(), input);
const outputPath = resolve(process.cwd(), output);

if (!existsSync(templatePath)) {
  fail(`missing shell template at ${templatePath}\nRun: npm run build:report-shell`);
}
if (!existsSync(inputPath)) fail(`input not found: ${inputPath}`);

const bytes = readFileSync(inputPath);
if (bytes.length === 0) fail(`input is empty: ${inputPath}`);

const b64 = bytes.toString('base64');
const reportName = name ?? basename(inputPath);
// Encode so quotes / non-ASCII in the name cannot break the JS string literal.
const loc = locale ?? 'zh-CN';
const nameEncoded = encodeURIComponent(reportName);

let html = readFileSync(templatePath, 'utf8');
const embedStart = '<!-- __NPU_REP_EMBED_START__ -->';
const embedEnd = '<!-- __NPU_REP_EMBED_END__ -->';
let start = -1;
let endExclusive = -1;
for (let from = 0; from < html.length; ) {
  const s = html.indexOf(embedStart, from);
  if (s < 0) break;
  const after = html.slice(s + embedStart.length, s + embedStart.length + 64);
  if (/^\s*<script[\s>]/.test(after)) {
    const e = html.indexOf(embedEnd, s + embedStart.length);
    if (e < 0) break;
    start = s;
    endExclusive = e + embedEnd.length;
    break;
  }
  from = s + embedStart.length;
}
if (start < 0) {
  fail('shell template is missing embed markers — rebuild with npm run build:report-shell');
}

let embed = html.slice(start, endExclusive);
if (!embed.includes('__HTML_EXPORT_B64__')) {
  fail('shell template is missing __HTML_EXPORT_B64__ placeholder — rebuild with npm run build:report-shell');
}
if (!embed.includes('__HTML_EXPORT_LOCALE__')) {
  fail('shell template is missing __HTML_EXPORT_LOCALE__ placeholder — rebuild with npm run build:report-shell');
}
embed = embed.split('__HTML_EXPORT_B64__').join(b64);
embed = embed.split('__HTML_EXPORT_NAME__').join(nameEncoded);
embed = embed.split('__HTML_EXPORT_LOCALE__').join(loc);
html = html.slice(0, start) + embed + html.slice(endExclusive);

// Title: use the human name (HTML-escaped)
const title = reportName
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
html = html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
if (/\blang=/.test(html)) {
  html = html.replace(/\blang=(["'])[^"']*\1/, `lang="${loc}"`);
} else {
  html = html.replace(/<html\b/i, `<html lang="${loc}"`);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html, 'utf8');
console.log(`[generate-html-report] wrote ${outputPath} (${html.length} bytes, source ${bytes.length} bytes)`);
