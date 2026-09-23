#!/usr/bin/env node
/**
 * Fold Vite's report-shell build into one HTML template with embed placeholders.
 * Usage: node scripts/inline-report-shell.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const distDir = join(root, 'dist/report-shell');
const htmlPath = join(distDir, 'index.html');

function fail(msg) {
  console.error(`[inline-report-shell] ${msg}`);
  process.exit(1);
}

if (!existsSync(htmlPath)) {
  fail(`missing ${htmlPath} — run: npx vite build --config report-shell/vite.config.ts`);
}

let html = readFileSync(htmlPath, 'utf8');
const assetsDir = join(distDir, 'assets');
const assetFiles = existsSync(assetsDir) ? readdirSync(assetsDir) : [];

function readAsset(name) {
  const path = join(assetsDir, name);
  if (!existsSync(path)) fail(`missing asset ${path}`);
  return readFileSync(path, 'utf8');
}

// Inline CSS <link rel="stylesheet" href="...">
html = html.replace(
  /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi,
  (tag) => {
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) return tag;
    const name = href.split('/').pop();
    if (!name || !assetFiles.includes(name)) {
      // Absolute or already inlined — leave alone if we cannot resolve.
      if (href.startsWith('data:')) return tag;
      fail(`cannot inline stylesheet ${href}`);
    }
    const css = readAsset(name);
    return `<style>\n${css}\n</style>`;
  },
);

// Inline <script type="module" src="..."> (keep type=module — single bundle, no imports)
html = html.replace(
  /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
  (full, pre, src, post) => {
    const name = src.split('/').pop();
    if (!name || !assetFiles.includes(name)) {
      if (src.startsWith('data:')) return full;
      fail(`cannot inline script ${src}`);
    }
    const js = readAsset(name);
    const attrs = `${pre} ${post}`.replace(/\s+/g, ' ').trim();
    const typeMod = /\btype\s*=\s*["']module["']/i.test(attrs) ? ' type="module"' : '';
    return `<script${typeMod}>\n${js}\n</script>`;
  },
);

// Ensure embed placeholders survived the Vite HTML transform.
if (!html.includes('%%NPU_REP_B64%%') || !html.includes('%%NPU_REP_NAME%%')) {
  fail('embed placeholders %%NPU_REP_B64%% / %%NPU_REP_NAME%% missing from built HTML');
}

const outPath = join(distDir, 'template.html');
writeFileSync(outPath, html, 'utf8');
console.log(`[inline-report-shell] wrote ${outPath} (${html.length} bytes)`);
