#!/usr/bin/env node
/**
 * Assert lib build ships HarmonyOS @font-face rules and per-instance token scoping.
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
const faceCount = (reportCss.match(/@font-face/g) ?? []).length;
if (faceCount < 3) {
  fail(`expected >=3 @font-face rules in profiling-report.css, got ${faceCount}`);
}
if (!/data-font-family=['"]?harmony['"]?/.test(reportCss)) {
  fail("profiling-report.css must scope --pr-font-family to .pr-root[data-font-family=harmony]");
}
if (!reportCss.includes('./fonts/HarmonyOS_Sans_SC_Regular.woff2')) {
  fail('profiling-report.css must reference ./fonts/*.woff2');
}
if (/local\s*\(/.test(reportCss)) {
  fail('profiling-report.css must not use local() font fallbacks — vendored woff2 only');
}

if (!existsSync(fontsCssPath)) {
  fail('missing dist/fonts.css');
}
const fontsCss = readFileSync(fontsCssPath, 'utf8');
if ((fontsCss.match(/@font-face/g) ?? []).length < 3) {
  fail('dist/fonts.css must declare all three HarmonyOS faces');
}
if (/local\s*\(/.test(fontsCss)) {
  fail('dist/fonts.css must not use local() font fallbacks — vendored woff2 only');
}

if (!existsSync(fontsLicensePath)) {
  fail('missing dist/fonts/LICENSE.txt');
}
if (fontsCss.includes('LICENSE.txt') && !fontsCss.includes('dist/LICENSE-HarmonyOS-Sans.txt')) {
  fail('dist/fonts.css license notice should reference dist/LICENSE-HarmonyOS-Sans.txt');
}

const umdPath = resolve(dist, 'profiling-report.umd.cjs');
if (existsSync(umdPath)) {
  const umd = readFileSync(umdPath, 'utf8');
  if (umd.includes('@font-face')) {
    fail('UMD bundle must not inline @font-face rules — faces belong in profiling-report.css');
  }
}

console.log('[check:dist-fonts] ok');
