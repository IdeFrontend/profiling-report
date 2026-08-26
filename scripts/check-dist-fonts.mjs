#!/usr/bin/env node
/**
 * Assert lib build keeps HarmonyOS faces opt-in and ships fonts.css separately.
 * Run after `npm run build`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const reportCssPath = resolve(dist, 'profiling-report.css');
const fontsCssPath = resolve(dist, 'fonts.css');
const fontsLicensePath = resolve(dist, 'fonts', 'LICENSE.txt');

function fail(message) {
  console.error(`[check:dist-fonts] ${message}`);
  process.exit(1);
}

if (!existsSync(reportCssPath)) {
  fail('missing dist/profiling-report.css — run npm run build first');
}

const reportCss = readFileSync(reportCssPath, 'utf8');
if (reportCss.includes('@font-face')) {
  fail('profiling-report.css must not declare @font-face — import fonts.css for harmony');
}
if (!/data-font-family=['"]?harmony['"]?/.test(reportCss)) {
  fail("profiling-report.css must scope --pr-font-family to .pr-root[data-font-family=harmony]");
}
if (reportCss.includes('./fonts/') || reportCss.includes('.woff2')) {
  fail('profiling-report.css must not reference vendored woff2 files');
}

if (!existsSync(fontsCssPath)) {
  fail('missing dist/fonts.css');
}
const fontsCss = readFileSync(fontsCssPath, 'utf8');
const faceCount = (fontsCss.match(/@font-face/g) ?? []).length;
if (faceCount !== 2) {
  fail(`dist/fonts.css must declare exactly 2 HarmonyOS faces (Regular + Semibold), got ${faceCount}`);
}
if (!fontsCss.includes('./fonts/HarmonyOS_Sans_SC_Regular.woff2')) {
  fail('dist/fonts.css must reference ./fonts/HarmonyOS_Sans_SC_Regular.woff2');
}
if (!fontsCss.includes('./fonts/HarmonyOS_Sans_SC_Semibold.woff2')) {
  fail('dist/fonts.css must reference ./fonts/HarmonyOS_Sans_SC_Semibold.woff2');
}
if (fontsCss.includes('HarmonyOS_Sans_SC_Light')) {
  fail('dist/fonts.css must not ship the unused Light face');
}
if (/local\s*\(/.test(fontsCss)) {
  fail('dist/fonts.css must not use local() font fallbacks — vendored woff2 only');
}

if (!existsSync(fontsLicensePath)) {
  fail('missing dist/fonts/LICENSE.txt');
}

const umdPath = resolve(dist, 'profiling-report.umd.cjs');
if (existsSync(umdPath)) {
  const umd = readFileSync(umdPath, 'utf8');
  if (umd.includes('@font-face')) {
    fail('UMD bundle must not inline @font-face rules — faces belong in fonts.css');
  }
}

console.log('[check:dist-fonts] ok');
