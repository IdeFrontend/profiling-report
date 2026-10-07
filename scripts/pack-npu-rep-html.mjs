#!/usr/bin/env node
/**
 * Pack dist/report-shell/template.html + stitch CLI into one zero-dep ESM script:
 *   dist/npu-rep-html.mjs
 *
 * Runtime needs only Node >= 20 (no node_modules, no sidecar template).
 * Stitch body is copied from scripts/stitch-html-report.mjs so locale rewrite
 * cannot drift from generate-html-report.mjs.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const templatePath = resolve(root, 'dist/report-shell/template.html');
const stitchPath = resolve(here, 'stitch-html-report.mjs');
const outPath = resolve(root, 'dist/npu-rep-html.mjs');

function fail(msg) {
  console.error(`[pack-npu-rep-html] ${msg}`);
  process.exit(1);
}

if (!existsSync(templatePath)) {
  fail(`missing ${templatePath} — run: npm run build:report-shell`);
}
if (!existsSync(stitchPath)) {
  fail(`missing ${stitchPath}`);
}

const template = readFileSync(templatePath, 'utf8');
if (!template.includes('__HTML_EXPORT_B64__') || !template.includes('__HTML_EXPORT_LOCALE__') || !template.includes('<!-- __NPU_REP_EMBED_START__ -->')) {
  fail('template missing embed placeholders — rebuild report-shell');
}

const stitchSrc = readFileSync(stitchPath, 'utf8')
  .replace(/^\/\*\*[\s\S]*?\*\/\s*/, '')
  .replace(/^export /gm, '');

const body = `#!/usr/bin/env node
/**
 * Zero-dep npu-rep → self-contained interactive HTML.
 * Built by scripts/pack-npu-rep-html.mjs — Node >= 20, no npm dependencies.
 *
 *   node npu-rep-html.mjs <input.npu-rep> -o <output.html> [--name <title>] [--en|--zh]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const TEMPLATE = ${JSON.stringify(template)};

${stitchSrc}

function usage() {
  console.error(\`Usage: npu-rep-html.mjs <input.npu-rep> -o <output.html> [--name <title>] [--en|--zh]\`);
}

function fail(msg, code = 1) {
  console.error(\`[npu-rep-html] \${msg}\`);
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
    if (a.startsWith('-')) fail(\`unknown option \${a}\`);
    if (input) fail(\`unexpected argument \${a}\`);
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
if (!existsSync(inputPath)) fail(\`input not found: \${inputPath}\`);
const bytes = readFileSync(inputPath);
if (bytes.length === 0) fail(\`input is empty: \${inputPath}\`);

const reportName = name ?? basename(inputPath);
let html;
try {
  html = stitchHtmlReport(TEMPLATE, bytes, reportName, locale);
} catch (cause) {
  fail(cause instanceof Error ? cause.message : String(cause));
}
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html, 'utf8');
console.log(\`[npu-rep-html] wrote \${outputPath} (\${html.length} bytes, source \${bytes.length} bytes)\`);
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, body, { encoding: 'utf8', mode: 0o755 });
console.log(`[pack-npu-rep-html] wrote ${outPath} (${body.length} bytes)`);
