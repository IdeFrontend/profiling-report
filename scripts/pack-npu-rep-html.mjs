#!/usr/bin/env node
/**
 * Pack dist/report-shell/template.html + stitch CLI into one zero-dep ESM script:
 *   dist/npu-rep-html.mjs
 *
 * Runtime needs only Node >= 20 (no node_modules, no sidecar template).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const templatePath = resolve(root, 'dist/report-shell/template.html');
const outPath = resolve(root, 'dist/npu-rep-html.mjs');

function fail(msg) {
  console.error(`[pack-npu-rep-html] ${msg}`);
  process.exit(1);
}

if (!existsSync(templatePath)) {
  fail(`missing ${templatePath} — run: npm run build:report-shell`);
}

const template = readFileSync(templatePath, 'utf8');
if (!template.includes('%%NPU_REP_B64%%') || !template.includes('<!-- __NPU_REP_EMBED_START__ -->')) {
  fail('template missing embed placeholders — rebuild report-shell');
}

// Stitch + CLI body inlined so the shipped file has zero imports from this repo.
const body = `#!/usr/bin/env node
/**
 * Zero-dep npu-rep → self-contained interactive HTML.
 * Built by scripts/pack-npu-rep-html.mjs — Node >= 20, no npm dependencies.
 *
 *   node npu-rep-html.mjs <input.npu-rep> -o <output.html> [--name <title>]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const TEMPLATE = ${JSON.stringify(template)};

function usage() {
  console.error(\`Usage: npu-rep-html.mjs <input.npu-rep> -o <output.html> [--name <title>]\`);
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
    if (a.startsWith('-')) fail(\`unknown option \${a}\`);
    if (input) fail(\`unexpected argument \${a}\`);
    input = a;
  }
  return { input, output, name };
}

function stitch(template, reportBytes, reportName) {
  const b64 = reportBytes.toString('base64');
  const nameEncoded = encodeURIComponent(reportName);
  const embedStart = '<!-- __NPU_REP_EMBED_START__ -->';
  const embedEnd = '<!-- __NPU_REP_EMBED_END__ -->';
  const start = template.indexOf(embedStart);
  const end = template.indexOf(embedEnd);
  if (start < 0 || end < 0 || end <= start) {
    fail('embedded shell template is missing embed markers');
  }
  if (!template.includes('%%NPU_REP_B64%%')) {
    fail('embedded shell template is missing %%NPU_REP_B64%% placeholder');
  }
  const before = template.slice(0, start);
  let embed = template.slice(start, end + embedEnd.length);
  const after = template.slice(end + embedEnd.length);
  if (before.includes('%%NPU_REP_B64%%') || after.includes('%%NPU_REP_B64%%')) {
    fail('%%NPU_REP_B64%% appears outside the embed block');
  }
  embed = embed.split('%%NPU_REP_B64%%').join(b64);
  embed = embed.split('%%NPU_REP_NAME%%').join(nameEncoded);
  let html = before + embed + after;
  const title = reportName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  html = html.replace(new RegExp('<title>[^<]*</title>', 'i'), \`<title>\${title}</title>\`);
  return html;
}

const { input, output, name } = parseArgs(process.argv);
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
const html = stitch(TEMPLATE, bytes, reportName);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html, 'utf8');
console.log(\`[npu-rep-html] wrote \${outputPath} (\${html.length} bytes, source \${bytes.length} bytes)\`);
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, body, { encoding: 'utf8', mode: 0o755 });
console.log(`[pack-npu-rep-html] wrote ${outPath} (${body.length} bytes)`);
