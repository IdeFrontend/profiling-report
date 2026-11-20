#!/usr/bin/env node
// Render screens with design-render.mjs and pixel-diff them against the design screenshot.
//   npm run design:diff -- <Screen...> [<designRoot>] [--no-render] [--json] [--concurrency N]
//   npm run design:diff -- --all [<designRoot>] [--json]
// Prints per screen: % of pixels with a noticeable (>90 RGB-sum) / strong (>270) delta.
// Screens without a screenshot, and screens whose screenshot size does not match the
// design canvas, are skipped with a note (their diff would be meaningless).
// --json emits the same data as a JSON array (used by design-sanitize.mjs to verify).
// Rendering + screenshots run on N concurrent pages (default 6).
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ROOT = resolve(ROOT, 'docs/ui/source/1130');
const HERE = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const all = args.includes('--all');
const noRender = args.includes('--no-render');
const json = args.includes('--json');
const cIdx = args.indexOf('--concurrency');
const concArg = cIdx >= 0 ? +args[cIdx + 1] : 6;
const concurrency = Number.isFinite(concArg) && concArg > 0 ? Math.floor(concArg) : 6;
const named = args.filter((a) => !a.startsWith('--') && (cIdx < 0 || a !== args[cIdx + 1]));
const root = named.length && existsSync(named[0]) && !existsSync(`${named[0]}/arkUIDSL.json`)
  ? named.shift() // first arg is the design root when it is not a screen name
  : DEFAULT_ROOT;

const screens = all || !named.length
  ? readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name)
  : named;

const browser = await chromium.launch();
const byName = new Map();

async function diffScreen(s) {
  const dir = `${root.replace(/[\\/]$/, '')}/${s}/`;
  if (!existsSync(dir + 'arkUIDSL.json')) return { screen: s, note: 'no arkUIDSL.json' };
  if (!existsSync(dir + 'screenshot.png')) return { screen: s, note: 'no screenshot.png' };
  try {
    if (!noRender) await execFileAsync('node', [resolve(HERE, 'design-render.mjs'), s, root]);
    const a = await sharp(dir + 'screenshot.png').raw().toBuffer({ resolveWithObject: true });
    const dw = a.info.width, dh = a.info.height;
    // canvas size per screen (annotation boards can be larger than 1920x1080)
    const ark = JSON.parse(readFileSync(dir + 'arkUIDSL.json', 'utf-8'));
    const rs = ark.ui?.styles || {};
    const cw = rs.width || 1920, chh = rs.height || 1080;
    if (Math.abs(cw - dw) > Math.max(2, cw * 0.02) || Math.abs(chh - dh) > Math.max(2, chh * 0.02)) {
      return { screen: s, note: `skipped: screenshot ${dw}x${dh} != canvas ${cw}x${chh}` };
    }
    const page = await browser.newPage({ viewport: { width: dw, height: dh } });
    try {
      await page.goto('file:///' + dir + '_rebuilt.html');
      await page.waitForTimeout(1200);
      const shot = await page.screenshot();
      const b = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
      const ca = a.info.channels, cb = b.info.channels;
      let diff = 0, sharpn = 0;
      for (let y = 0; y < dh; y++) {
        for (let x = 0; x < dw; x++) {
          const oa = (y * dw + x) * ca, ob = (y * dw + x) * cb;
          const d = Math.abs(a.data[oa] - b.data[ob]) + Math.abs(a.data[oa + 1] - b.data[ob + 1]) + Math.abs(a.data[oa + 2] - b.data[ob + 2]);
          if (d > 90) diff++;
          if (d > 270) sharpn++;
        }
      }
      return { screen: s, diff: diff / (dw * dh), sharp: sharpn / (dw * dh), dims: `${dw}x${dh}` };
    } finally {
      await page.close();
    }
  } catch (e) {
    return { screen: s, note: 'ERROR: ' + String(e).split('\n')[0] };
  }
}

// bounded concurrency: each lane pulls the next screen
{
  const queue = [...screens];
  const lanes = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const s = queue.shift();
      byName.set(s, await diffScreen(s));
    }
  });
  await Promise.all(lanes);
}
await browser.close();
const results = screens.map((s) => byName.get(s));

if (json) {
  console.log(JSON.stringify(results));
} else {
  console.log('SCREEN'.padEnd(34) + 'noticeable'.padStart(11) + 'strong'.padStart(9) + '  dims');
  for (const r of results) {
    if (r.note) { console.log(r.screen.padEnd(34) + r.note); continue; }
    console.log(r.screen.padEnd(34) + (r.diff * 100).toFixed(2).padStart(9) + '%' + (r.sharp * 100).toFixed(2).padStart(8) + '%  ' + r.dims);
  }
}
