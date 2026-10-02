#!/usr/bin/env node
/**
 * Stitch a self-contained interactive HTML report from a .npu-rep (or cann-rep) file.
 *
 *   node scripts/generate-html-report.mjs <input.npu-rep> -o <output.html> [--name <title>]
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
  console.error(`Usage: generate-html-report.mjs <input.npu-rep> -o <output.html> [--name <title>]

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
    if (a === '-h' || a === '--help') {
      usage();
      process.exit(0);
    }
    if (a.startsWith('-')) fail(`unknown option ${a}`);
    if (input) fail(`unexpected argument ${a}`);
    input = a;
  }
  return { input, output, name };
}

const { input, output, name } = parseArgs(process.argv);
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
const nameEncoded = encodeURIComponent(reportName);

let html = readFileSync(templatePath, 'utf8');
const embedStart = '<!-- __NPU_REP_EMBED_START__ -->';
const embedEnd = '<!-- __NPU_REP_EMBED_END__ -->';
const start = html.indexOf(embedStart);
const end = html.indexOf(embedEnd);
if (start < 0 || end < 0 || end <= start) {
  fail('shell template is missing embed markers — rebuild with npm run build:report-shell');
}
if (!html.includes('%%NPU_REP_B64%%')) {
  fail('shell template is missing %%NPU_REP_B64%% placeholder — rebuild with npm run build:report-shell');
}

const before = html.slice(0, start);
let embed = html.slice(start, end + embedEnd.length);
const after = html.slice(end + embedEnd.length);
if (before.includes('%%NPU_REP_B64%%') || after.includes('%%NPU_REP_B64%%')) {
  fail('%%NPU_REP_B64%% appears outside the embed block — refusing to replace (would corrupt the shell bundle)');
}
embed = embed.split('%%NPU_REP_B64%%').join(b64);
embed = embed.split('%%NPU_REP_NAME%%').join(nameEncoded);
html = before + embed + after;

// Title: use the human name (HTML-escaped)
const title = reportName
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
html = html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html, 'utf8');
console.log(`[generate-html-report] wrote ${outputPath} (${html.length} bytes, source ${bytes.length} bytes)`);
