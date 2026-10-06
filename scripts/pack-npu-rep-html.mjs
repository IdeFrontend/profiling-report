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
if (!template.includes('__HTML_EXPORT_B64__') || !template.includes('__HTML_EXPORT_LOCALE__') || !template.includes('<!-- __NPU_REP_EMBED_START__ -->')) {
  fail('template missing embed placeholders — rebuild report-shell');
}

// Stitch + CLI body inlined so the shipped file has zero imports from this repo.
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

function stitch(template, reportBytes, reportName, locale) {
  const b64 = reportBytes.toString('base64');
  const nameEncoded = encodeURIComponent(reportName);
  const loc = locale ?? 'zh-CN';
  const embedStart = '<!-- __NPU_REP_EMBED_START__ -->';
  const embedEnd = '<!-- __NPU_REP_EMBED_END__ -->';
  let start = -1;
  let endExclusive = -1;
  for (let from = 0; from < template.length; ) {
    const s = template.indexOf(embedStart, from);
    if (s < 0) break;
    const after = template.slice(s + embedStart.length, s + embedStart.length + 64);
    if (/^\\s*<script[\\s>]/.test(after)) {
      const e = template.indexOf(embedEnd, s + embedStart.length);
      if (e < 0) break;
      start = s;
      endExclusive = e + embedEnd.length;
      break;
    }
    from = s + embedStart.length;
  }
  if (start < 0) {
    fail('embedded shell template is missing embed markers');
  }
  let embed = template.slice(start, endExclusive);
  if (!embed.includes('__HTML_EXPORT_B64__')) {
    fail('embedded shell template is missing __HTML_EXPORT_B64__ placeholder');
  }
  if (!embed.includes('__HTML_EXPORT_LOCALE__')) {
    fail('embedded shell template is missing __HTML_EXPORT_LOCALE__ placeholder');
  }
  embed = embed.split('__HTML_EXPORT_B64__').join(b64);
  embed = embed.split('__HTML_EXPORT_NAME__').join(nameEncoded);
  embed = embed.split('__HTML_EXPORT_LOCALE__').join(loc);
  let html = template.slice(0, start) + embed + template.slice(endExclusive);
  const title = reportName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  html = html.replace(new RegExp('<title>[^<]*</title>', 'i'), \`<title>\${title}</title>\`);
  if (/\\blang=/.test(html)) {
    html = html.replace(/\\blang=(["'])[^"']*\\1/, \`lang="\${loc}"\`);
  } else {
    html = html.replace(/<html\\b/i, \`<html lang="\${loc}"\`);
  }
  return html;
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
const html = stitch(TEMPLATE, bytes, reportName, locale);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html, 'utf8');
console.log(\`[npu-rep-html] wrote \${outputPath} (\${html.length} bytes, source \${bytes.length} bytes)\`);
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, body, { encoding: 'utf8', mode: 0o755 });
console.log(`[pack-npu-rep-html] wrote ${outPath} (${body.length} bytes)`);
