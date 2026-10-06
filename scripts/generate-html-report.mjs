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
import { stitchHtmlReport } from './stitch-html-report.mjs';

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

const reportName = name ?? basename(inputPath);
const template = readFileSync(templatePath, 'utf8');
let html;
try {
  html = stitchHtmlReport(template, bytes, reportName, locale);
} catch (cause) {
  fail(`${cause instanceof Error ? cause.message : String(cause)} — rebuild with npm run build:report-shell`);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html, 'utf8');
console.log(`[generate-html-report] wrote ${outputPath} (${html.length} bytes, source ${bytes.length} bytes)`);
