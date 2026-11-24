#!/usr/bin/env node
// Design ingest — the ONE command for a fresh Octo/HDesign export.
//   npm run design:sanitize -- <export.zip>            full flow: extract -> fix -> dedupe -> verify
//   npm run design:sanitize -- <designFolder>          check-only report
//   npm run design:sanitize -- <designFolder> --fix    run fix + dedupe + verify on a folder
// Options: [--skip-verify] [--keep-zip] [--tailwind-src <file>]
//
// Flow (zip input): extract into docs/ui/source/<batch>/ -> per-screen html fixes
// (local tailwind + fonts, 24px canvas margin) -> drop dsl.json/index.ets ->
// lossless asset optimization (PNG re-deflate, SVG minify, both verified) ->
// dedupe identical assets across screens into <root>/_shared/assets/ with reference
// rewriting in arkUIDSL.json and index.html -> render + pixel-diff every screen before
// and after -> update the 1130 section of docs/ui/DESIGN_INDEX.md -> remove temporary
// renders -> delete the zip on success.
import {
  readdirSync, readFileSync, writeFileSync, existsSync, statSync, lstatSync, realpathSync,
  mkdirSync, copyFileSync, unlinkSync, rmdirSync, rmSync, renameSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync, deflateSync, constants as zlibConstants } from 'node:zlib';
import sharp from 'sharp';
import { join, basename, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { rewriteAssetRefs } from './design-asset-refs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'docs/ui/source');
const HERE = dirname(fileURLToPath(import.meta.url));
// single-quoted PowerShell paths: only a quote needs doubling (nothing else interpolates)
const psq = (s) => s.replace(/'/g, "''");

// The export zip is untrusted: validate entry names before extraction (zip-slip,
// absolute/drive-letter paths) and the extracted tree afterwards (symlinks, realpath),
// so nothing outside the batch can be read, aliased, or copied into _shared/assets.
function listArchiveEntries(file) {
  if (process.platform === 'win32') {
    const bsdtar = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    if (existsSync(bsdtar)) {
      try {
        return execFileSync(bsdtar, ['-tf', file], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).split(/\r?\n/);
      } catch { /* fall back to the .NET zip reader */ }
    }
    return execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
      `$ProgressPreference='SilentlyContinue'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::OpenRead('${psq(file)}').Entries | ForEach-Object { $_.FullName }`],
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).split(/\r?\n/);
  }
  return execFileSync(process.env.UNZIP || 'unzip', ['-Z1', file], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).split(/\r?\n/);
}
function assertSafeArchiveEntries(entries) {
  for (const raw of entries) {
    const name = raw.trim();
    if (!name || name.endsWith('/')) continue;
    const norm = name.replace(/\\/g, '/');
    if (norm.startsWith('/') || /^[A-Za-z]:/.test(norm) || norm.split('/').includes('..')) {
      throw new Error(`unsafe archive entry (escapes the batch): ${name}`);
    }
  }
}
function assertSafeTree(dir) {
  const rootReal = realpathSync(dir);
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      const st = lstatSync(p);
      if (st.isSymbolicLink()) throw new Error(`symlink in archive: ${p}`);
      const real = realpathSync(p);
      if (real !== rootReal && !real.startsWith(rootReal + sep)) throw new Error(`path escapes the batch: ${p}`);
      if (st.isDirectory()) walk(p);
    }
  })(dir);
}

const args = process.argv.slice(2);
const skipVerify = args.includes('--skip-verify');
const keepZip = args.includes('--keep-zip');
const tailIdx = args.indexOf('--tailwind-src');
const tailwindSrc = tailIdx >= 0 ? args[tailIdx + 1] : null;
const scIdx = args.indexOf('--self-check');
const selfCheckScreen = scIdx >= 0 ? args[scIdx + 1] : null;
// the first positional is the input root/zip — never an option's value
const optionValues = new Set(['--tailwind-src', '--self-check']
  .map((opt) => { const i = args.indexOf(opt); return i >= 0 ? args[i + 1] : null; })
  .filter((v) => v != null));
const input = args.find((a) => !a.startsWith('--') && !optionValues.has(a));
if (!input && selfCheckScreen) {
  // `design:sanitize -- --self-check <Screen>` works without an explicit root
} else if (!input) {
  console.error('usage: npm run design:sanitize -- <export.zip | designFolder> [--fix] [--skip-verify] [--keep-zip] [--tailwind-src <file>] [--self-check <Screen>]');
  process.exit(2);
}

let zipPath = null;
let root;
let fix = args.includes('--fix');
if (input && input.toLowerCase().endsWith('.zip')) {
  zipPath = input;
  const batch = basename(input).replace(/\.zip$/i, '');
  root = join(SOURCE, batch);
  if (existsSync(root)) { console.error(`target folder already exists: ${root}`); process.exit(2); }
  console.log(`extracting ${input} -> ${root}`);
  // tar -C requires the destination to exist (Expand-Archive creates it itself)
  mkdirSync(root, { recursive: true });
  try {
    assertSafeArchiveEntries(listArchiveEntries(input));
  } catch (e) {
    rmSync(root, { recursive: true, force: true });
    console.error(`refusing to extract ${input}: ${e.message}`);
    process.exit(2);
  }
  if (process.platform === 'win32') {
    // Windows' own bsdtar (System32) extracts zips several times faster than Expand-Archive;
    // the `tar` on PATH may be GNU tar (git-bash) which cannot read zips, so try both.
    const candidates = [
      join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'),
      'tar',
    ];
    let extracted = false;
    for (const cmd of candidates) {
      try {
        // quiet: a failed candidate (e.g. GNU tar without zip support) must not spam
        execFileSync(cmd, ['-xf', input, '-C', root], { stdio: 'pipe' });
        extracted = true;
        break;
      } catch { /* try the next extractor */ }
    }
    if (extracted) console.log('extracted with tar');
    if (!extracted) {
      // $ProgressPreference: Expand-Archive's Write-Progress crashes in headless/non-console runs
      execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        `$ProgressPreference='SilentlyContinue'; Expand-Archive -LiteralPath '${psq(input)}' -DestinationPath '${psq(root)}' -Force`],
      { stdio: 'inherit' });
    }
  } else {
    execFileSync(process.env.UNZIP || 'unzip', ['-q', input, '-d', root], { stdio: 'inherit' });
  }
  try {
    assertSafeTree(root);
  } catch (e) {
    rmSync(root, { recursive: true, force: true });
    console.error(`refusing to use ${input}: ${e.message}`);
    process.exit(2);
  }
  // Octo exports wrap everything in a single top-level folder (<batch>/): unwrap it
  // so screens land directly under the design root.
  const top = readdirSync(root, { withFileTypes: true });
  if (top.length === 1 && top[0].isDirectory() && !existsSync(join(root, 'arkUIDSL.json'))) {
    const inner = join(root, top[0].name);
    for (const e of readdirSync(inner)) renameSync(join(inner, e), join(root, e));
    rmdirSync(inner);
    console.log(`unwrapped archive folder ${top[0].name}/`);
  }
  fix = true;
} else if (input) {
  root = input;
} else {
  root = join(SOURCE, '1130'); // --self-check without a root
}

const rootAbs = resolve(root);
function insideRoot(p) {
  const abs = resolve(p);
  return abs === rootAbs || abs.startsWith(rootAbs + sep);
}
// refs inside index.html / arkUIDSL.json are untrusted too (export zip)
function safeRefPath(dir, ref) {
  const p = join(dir, ref.split('?')[0]);
  return insideRoot(p) ? p : null;
}
function safeSharedName(ref) {
  const name = ref.startsWith('assets/') ? ref.slice('assets/'.length) : '';
  return name && name !== '.' && name !== '..' && !/[/\\]/.test(name) ? name : null;
}
// a folder input is already on disk: refuse symlinks/escapes before any --fix writes
if (!zipPath) {
  try {
    assertSafeTree(root);
  } catch (e) {
    console.error(`refusing to sanitize ${root}: ${e.message}`);
    process.exit(2);
  }
}

// pageIds live in the DESIGN_INDEX section (regenerated by this script, preserved across runs)
function readPageIds() {
  const ids = new Map();
  const p = join(ROOT, 'docs/ui/DESIGN_INDEX.md');
  if (existsSync(p)) {
    for (const m of readFileSync(p, 'utf-8').matchAll(/^\|\s*(?:\d+\s*\|)?\s*`([^`]+)`\s*\|\s*[^|]+\|\s*(\d+)\s*\|/gm)) ids.set(m[1], +m[2]);
  }
  return ids;
}

const screens = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name);
const batch = basename(root);
const idxPath = join(ROOT, 'docs/ui/DESIGN_INDEX.md');
const mStart = `<!-- design-screens:${batch}:start -->`;
const mEnd = `<!-- design-screens:${batch}:end -->`;
const currentIdx = existsSync(idxPath) ? readFileSync(idxPath, 'utf-8') : '';
const oldSectionStart = currentIdx.indexOf(mStart);
const oldSectionEnd = currentIdx.indexOf(mEnd);
const oldSection = oldSectionStart >= 0 && oldSectionEnd > oldSectionStart ? currentIdx.slice(oldSectionStart, oldSectionEnd) : '';
// "invalid screenshot" notes survive the crop's removal: a later run must keep naming it
// instead of reporting the missing file as a brand-new gap
const oldInvalid = new Map();
for (const m of oldSection.matchAll(/^\| `([^`]+)` \|([^|]*)\|/gm)) {
  const note = m[2].split(';').map((x) => x.trim()).find((x) => x.includes('invalid screenshot'));
  if (note) oldInvalid.set(m[1], note);
}
const problems = []; // unexpected issues — exit 1 in check-only, block zip deletion
const warnings = []; // documented export gaps (missing screenshots/assets) — exit 0
const missingByScreen = new Map(); // screen -> refs with no file anywhere
const missingRefs = new Map(); // screen -> count of refs still missing after adoption
const invalidShots = new Map(); // screen -> {w, h} screenshots that are not the full canvas (popup crops)
let fixCount = 0;

// --- tailwind runtime: prefer an existing batch's copy, then --tailwind-src ---
function ensureTailwind() {
  const local = join(root, '_shared', 'tailwind-play.js');
  if (existsSync(local)) return local;
  if (!fix) return null; // check-only never writes into the batch
  for (const d of readdirSync(SOURCE, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const other = join(SOURCE, d.name, '_shared', 'tailwind-play.js');
    if (existsSync(other)) {
      mkdirSync(join(root, '_shared'), { recursive: true });
      copyFileSync(other, local);
      console.log(`tailwind runtime copied from ${d.name}/_shared`);
      return local;
    }
  }
  if (tailwindSrc && existsSync(tailwindSrc)) {
    mkdirSync(join(root, '_shared'), { recursive: true });
    copyFileSync(tailwindSrc, local);
    console.log('tailwind runtime copied from --tailwind-src');
    return local;
  }
  return null;
}
const tailwindLocal = ensureTailwind();

// --- per-screen fixes ---
function hoistFonts(screen, url) {
  if (url.includes('_shared')) return url;
  const from = safeRefPath(join(root, screen), url);
  if (!from) { problems.push(`${screen}: font url escapes the batch: ${url}`); return url; }
  const name = basename(url.split('?')[0]);
  if (!fix) {
    // check-only never modifies the batch
    if (!existsSync(from)) problems.push(`${screen}: font file missing on disk: ${url}`);
    else problems.push(`${screen}: font url ${url} (--fix hoists it into _shared/fonts/)`);
    return url;
  }
  if (!existsSync(from)) { problems.push(`${screen}: font file missing on disk: ${url}`); return url; }
  const shared = join(root, '_shared', 'fonts');
  mkdirSync(shared, { recursive: true });
  const to = join(shared, name);
  // byte-compare, not size: same-size fonts from different revisions must replace the shared copy
  if (!existsSync(to) || !readFileSync(to).equals(readFileSync(from))) copyFileSync(from, to);
  fixCount++;
  return `../_shared/fonts/${name}`;
}

for (const s of screens) {
  const dir = join(root, s);
  const htmlPath = join(dir, 'index.html');
  if (!existsSync(htmlPath)) { problems.push(`${s}: no index.html`); continue; }
  let html = readFileSync(htmlPath, 'utf-8');
  const orig = html;

  // tailwind ref -> ../_shared/tailwind-play.js (one level up from <Screen>/)
  const tail = html.match(/src="([^"]*tailwind[^"]*)"/i);
  if (tail) {
    const target = '../_shared/tailwind-play.js';
    if (tail[1] !== target) {
      if (fix) { html = html.replace(tail[0], `src="${target}"`); fixCount++; }
      else problems.push(`${s}: tailwind ref ${tail[1]} (--fix rewrites to ${target})`);
    }
    if (!tailwindLocal && !existsSync(join(root, s, target.split('?')[0]))) {
      problems.push(`${s}: no local tailwind runtime (--tailwind-src <file>)`);
    }
  } else {
    problems.push(`${s}: no tailwind script ref found`);
  }

  // fonts -> ../_shared/fonts/
  html = html.replace(/url\((['"]?)([^'")]+\.(?:woff2?|ttf|otf))\1\)/gi, (m, q, u) => {
    if (u.startsWith('http') || !u.includes('_shared')) {
      const local = hoistFonts(s, u);
      return `url("${local}")`;
    }
    return m;
  });

  // the 24px canvas margin (renders the whole design shifted)
  html = html.replace(/m-\[24px\]/g, '');

  // compact the stock html: newline+indentation between tags is ~25% of the file.
  // Only whitespace-only text nodes that contain a newline collapse — meaningful
  // single-space separators between inline elements survive.
  html = html.replace(/>\s*\n\s*</g, '><').trim() + '\n';

  // missing assets (before dedupe: local paths; after dedupe: shared paths).
  // index.html keeps the stock export's entity-escaped url(&#39;assets/…&#39;) forms, so
  // CSS refs must be collected too or adoption never sees them.
  const refs = new Set();
  const addRef = (u) => {
    if (!u || u.startsWith('http') || u.startsWith('data:') || u.startsWith('#')) return;
    refs.add(u);
  };
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) addRef(m[1]);
  for (const m of html.matchAll(/url\(\s*([^)]+?)\s*\)/g)) {
    addRef(m[1].replace(/&#39;|&#x27;|&quot;|&#34;/g, '').replace(/^['"]|['"]$/g, ''));
  }
  const missing = [...refs].filter((u) => {
    const p = safeRefPath(dir, u);
    return !p || !existsSync(p);
  });
  if (missing.length) missingByScreen.set(s, missing);

  const shotPath = join(dir, 'screenshot.png');
  if (!existsSync(shotPath)) {
    // a screen exported without a screenshot is a documented gap (listed in DESIGN_INDEX),
    // not a failed sanitize run — a re-export is needed, not a local fix
    warnings.push(oldInvalid.has(s) ? `${s}: screenshot missing (invalid popup crop removed earlier)` : `${s}: no screenshot.png`);
  } else if (existsSync(join(dir, 'arkUIDSL.json'))) {
    // a screenshot that is not the full canvas is an invalid export (e.g. a popup crop):
    // it cannot be diffed and misleads comparisons — remove it with --fix
    const arkUi = JSON.parse(readFileSync(join(dir, 'arkUIDSL.json'), 'utf-8')).ui?.styles || {};
    const cw = arkUi.width ?? 1920, chh = arkUi.height ?? 1080;
    const hdr = readFileSync(shotPath);
    if (hdr.readUInt32BE(0) === 0x89504e47) {
      const w = hdr.readUInt32BE(16), h = hdr.readUInt32BE(20);
      if (Math.abs(w - cw) > 2 || Math.abs(h - chh) > 2) {
        invalidShots.set(s, { w, h, cw, chh });
        if (fix) {
          unlinkSync(shotPath);
          fixCount++;
          console.log(`  ${s}: removed invalid screenshot (${w}x${h} popup crop, canvas ${cw}x${chh})`);
        } else {
          problems.push(`${s}: screenshot ${w}x${h} != canvas ${cw}x${chh} (invalid popup crop — removed by --fix)`);
        }
      }
    }
  }
  if (!existsSync(join(dir, 'arkUIDSL.json'))) problems.push(`${s}: no arkUIDSL.json`);
  for (const junk of ['dsl.json', 'index.ets']) {
    const jp = join(dir, junk);
    if (existsSync(jp)) {
      if (fix) { unlinkSync(jp); fixCount++; }
      else problems.push(`${s}: ${junk} present (unused — dropped by --fix)`);
    }
  }

  if (fix && html !== orig) writeFileSync(htmlPath, html);
}

// per-screen export archives are redundant once the folders are extracted
{
  const zips = join(root, '_zips');
  if (existsSync(zips)) {
    if (fix) { rmSync(zips, { recursive: true, force: true }); fixCount++; console.log('  removed _zips/ (per-screen archives, redundant)'); }
    else problems.push('_zips/ present at the export root (redundant archives — removed by --fix)');
  }
}

// export-root MANIFEST.md is superseded by the DESIGN_INDEX section this script regenerates
{
  const mf = join(root, 'MANIFEST.md');
  if (existsSync(mf)) {
    if (fix) { unlinkSync(mf); fixCount++; console.log('  removed export MANIFEST.md (superseded by DESIGN_INDEX)'); }
    else problems.push('MANIFEST.md present at the export root (superseded by DESIGN_INDEX — removed by --fix)');
  }
}

// Unused icon font: HMSymbolVF covers supplementary private-use glyphs (U+F0000–F126D).
// The exporter always ships it and lists it first in the body font-family fallback, but
// the file is ~4 MB. Remove it only after proving that no design text uses a PUA glyph —
// scan every string in every arkUIDSL.json and every index.html of the batch.
{
  const iconFont = join(root, '_shared', 'fonts', 'HMSymbolVF.ttf');
  if (existsSync(iconFont)) {
    let used = false;
    for (const s of screens) {
      if (used) break;
      const ap = join(root, s, 'arkUIDSL.json');
      if (existsSync(ap)) {
        const j = JSON.parse(readFileSync(ap, 'utf-8'));
        const scan = (v) => {
          if (used) return;
          if (typeof v === 'string') {
            for (const ch of v) {
              const cp = ch.codePointAt(0);
              if (cp >= 0xF0000 && cp <= 0xF126D) { used = true; return; }
            }
          } else if (Array.isArray(v)) v.forEach(scan);
          else if (v && typeof v === 'object') Object.values(v).forEach(scan);
        };
        scan(j);
      }
      const hp = join(root, s, 'index.html');
      if (!used && existsSync(hp)) {
        for (const ch of readFileSync(hp, 'utf-8')) {
          const cp = ch.codePointAt(0);
          if (cp >= 0xF0000 && cp <= 0xF126D) { used = true; break; }
        }
      }
    }
    if (used) {
      console.log('icon font HMSymbolVF.ttf is used by design text — kept');
    } else if (fix) {
      let fontSize = 0;
      try { fontSize = statSync(iconFont).size; } catch { /* already removed */ }
      try { unlinkSync(iconFont); } catch { /* already removed */ }
      let stripped = 0;
      for (const s of screens) {
        const hp = join(root, s, 'index.html');
        if (!existsSync(hp)) continue;
        const html = readFileSync(hp, 'utf-8');
        const next = html.replace(/@font-face\s*\{[^}]*font-family:\s*["']HMSymbol["'][^}]*\}\s*/g, '');
        if (next !== html) { writeFileSync(hp, next); stripped++; }
      }
      fixCount++;
      console.log(`removed unused HMSymbolVF.ttf (~${(fontSize / 1048576).toFixed(1)} MB), stripped @font-face from ${stripped} html`);
    } else {
      problems.push('HMSymbolVF.ttf is unused by any design text (removed by --fix)');
    }
  }
}

// --- lossless asset optimization (no quality loss, verified per file) ---
// PNG: re-deflate the IDAT stream at level 9 (several strategies, smallest wins). The
//   filtered scanlines are preserved byte-for-byte, so pixels are provably identical;
//   the new stream is inflated again and compared before writing. Text/time chunks drop,
//   colour-relevant chunks (IHDR/PLTE/tRNS/gAMA/iCCP/sRGB/cHRM/sBIT) are kept.
// SVG: drop comments/metadata, collapse inter-tag whitespace, normalize numbers without
//   changing their value (28.000000 -> 28), drop the xlink namespace declaration when
//   xlink is not used, drop the non-standard customFrame attribute. Verified by
//   rasterizing both versions with sharp and comparing raw pixels.
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_KEEP = new Set(['IHDR', 'PLTE', 'tRNS', 'gAMA', 'iCCP', 'sRGB', 'cHRM', 'sBIT']);
let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function pngOptimize(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) return null;
  const chunks = [];
  let off = 8;
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) });
    off += 12 + len;
    if (type === 'IEND') break;
  }
  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
  let raw;
  try { raw = inflateSync(idat); } catch { return null; }
  const best = [
    deflateSync(raw, { level: 9, memLevel: 9 }),
    deflateSync(raw, { level: 9, memLevel: 9, strategy: zlibConstants.Z_FILTERED }),
    deflateSync(raw, { level: 9, memLevel: 9, strategy: zlibConstants.Z_RLE }),
  ].sort((a, b) => a.length - b.length)[0];
  if (!inflateSync(best).equals(raw)) return null; // lossless proof failed — keep the original
  const parts = [PNG_SIG];
  for (const c of chunks) if (PNG_KEEP.has(c.type)) parts.push(pngChunk(c.type, c.data));
  parts.push(pngChunk('IDAT', best), pngChunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}
function svgOptimize(text) {
  let out = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<metadata[\s\S]*?<\/metadata>/g, '');
  if (!/xlink:/.test(out)) out = out.replace(/\s+xmlns:xlink="[^"]*"/g, '');
  out = out.replace(/\s+customFrame="[^"]*"/g, '');
  return out
    .replace(/>\s+</g, '><')
    .replace(/\s+\/>/g, '/>')
    .replace(/(\d+)\.(\d+)/g, (m, a, b) => { const t = b.replace(/0+$/, ''); return t ? `${a}.${t}` : a; })
    .trim();
}
async function sameRaster(a, b) {
  try {
    const ra = await sharp(a).raw().toBuffer({ resolveWithObject: true });
    const rb = await sharp(b).raw().toBuffer({ resolveWithObject: true });
    return ra.info.width === rb.info.width && ra.info.height === rb.info.height &&
      ra.info.channels === rb.info.channels && ra.data.equals(rb.data);
  } catch {
    return false; // unrenderable — treat as unverified and keep the original
  }
}
// run async workers over items with bounded concurrency (sharp releases the event loop)
async function runPool(items, worker, concurrency) {
  const queue = [...items];
  const lanes = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) await worker(queue.shift());
  });
  await Promise.all(lanes);
}
if (fix) {
  const t0 = Date.now();
  let pngN = 0, svgN = 0, saved = 0, failedVerify = 0, shotSaved = 0;
  const dirs = [];
  for (const s of screens) {
    const d = join(root, s, 'assets');
    if (existsSync(d)) dirs.push(d);
  }
  const sharedAssets = join(root, '_shared', 'assets');
  if (existsSync(sharedAssets)) dirs.push(sharedAssets);
  // collect work: PNG files recompress synchronously (zlib is fast), SVG minification
  // is verified by rasterization and parallelized across workers
  const svgJobs = [];
  for (const dir of dirs) {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      const before = readFileSync(p);
      if (f.endsWith('.png')) {
        const opt = pngOptimize(before);
        if (opt && opt.length < before.length) {
          writeFileSync(p, opt);
          pngN++;
          saved += before.length - opt.length;
        }
      } else if (f.endsWith('.svg')) {
        const text = before.toString('utf-8');
        const min = svgOptimize(text);
        if (min === text) continue;
        const minBuf = Buffer.from(min, 'utf-8');
        if (minBuf.length >= before.length) continue;
        svgJobs.push({ path: p, before, minBuf });
      }
    }
  }
  await runPool(svgJobs, async (job) => {
    if (!(await sameRaster(job.before, job.minBuf))) { failedVerify++; return; }
    writeFileSync(job.path, job.minBuf);
    svgN++;
    saved += job.before.length - job.minBuf.length;
  }, 8);
  // design screenshots: the export stores them with a weak deflate too — same lossless pass
  for (const s of screens) {
    const p = join(root, s, 'screenshot.png');
    if (!existsSync(p)) continue;
    const before = readFileSync(p);
    const opt = pngOptimize(before);
    if (opt && opt.length < before.length) {
      writeFileSync(p, opt);
      shotSaved += before.length - opt.length;
    }
  }
  if (pngN || svgN || failedVerify || shotSaved) {
    console.log(`optimize: PNG ${pngN} recompressed, SVG ${svgN} minified, screenshots saved ${(shotSaved / 1048576).toFixed(2)} MB | total saved ${(saved / 1048576).toFixed(2)} MB | failed verification ${failedVerify} | ${Date.now() - t0}ms`);
  }
}

// --- verification helper: renders + diffs all screens, returns {screen: {diff, sharp, note}} ---
let failed = false;
function verify(label) {
  let out;
  try {
    out = execFileSync('node', [join(HERE, 'design-diff.mjs'), '--all', '--json', root], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    // design-diff exits 1 when a screen could not be compared at all; its JSON is still the report
    if (!e.stdout) throw e;
    out = e.stdout;
  }
  const rows = JSON.parse(out);
  const map = new Map(rows.map((r) => [r.screen, r]));
  const errors = rows.filter((r) => r.error);
  console.log(`  [${label}] ${rows.filter((r) => r.diff != null).length} screens diffed, ${rows.filter((r) => r.note).length} skipped/errored`);
  for (const r of rows) {
    if (r.diff != null) console.log(`    ${r.screen.padEnd(32)} noticeable ${(r.diff * 100).toFixed(2)}%  strong ${(r.sharp * 100).toFixed(2)}%`);
    else console.log(`    ${r.screen.padEnd(32)} ${r.note}`);
  }
  if (errors.length) {
    console.log(`  [${label}] ${errors.length} screen(s) could not be compared — verification FAILED`);
    failed = true;
  }
  return map;
}

// --- baseline verification BEFORE the dedupe touches anything ---
let beforeMap = null;
if (fix && !skipVerify) beforeMap = verify('before dedupe');

// --- asset dedupe: identical files across screens -> <root>/_shared/assets/ ---
const pool = new Map(); // name -> {size, md5}
let sharedFiles = 0, sharedBytes = 0, collisions = 0;
const collisionScreens = new Map(); // screen -> colliding names (kept local, informational)
const sharedNamesPerScreen = new Map();
if (fix) {
  const sharedDir = join(root, '_shared', 'assets');
  mkdirSync(sharedDir, { recursive: true });
  // seed the pool from the existing shared folder — re-runs must never overwrite
  // already-shared content with a colliding screen's version
  for (const name of readdirSync(sharedDir)) {
    const p = join(sharedDir, name);
    const st = statSync(p);
    pool.set(name, { size: st.size, md5: createHash('md5').update(readFileSync(p)).digest('hex') });
  }
  for (const s of screens) {
    const dir = join(root, s, 'assets');
    if (!existsSync(dir)) continue;
    const names = [];
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      const md5 = createHash('md5').update(readFileSync(p)).digest('hex');
      const hit = pool.get(name);
      if (hit && hit.size === st.size && hit.md5 === md5) {
        unlinkSync(p); // duplicate of an already-shared file
        sharedBytes += st.size;
        names.push(name);
      } else if (hit) {
        // same name, different content — normal across screens from different design
        // revisions; keep this screen's copy local (info, not a problem)
        collisions++;
        if (!collisionScreens.has(s)) collisionScreens.set(s, []);
        collisionScreens.get(s).push(name);
      } else {
        pool.set(name, { size: st.size, md5 });
        copyFileSync(p, join(sharedDir, name));
        unlinkSync(p);
        sharedBytes += st.size;
        names.push(name);
      }
    }
    const leftovers = readdirSync(dir);
    if (!leftovers.length) rmdirSync(dir);
    sharedNamesPerScreen.set(s, names);
    sharedFiles += names.length;
    if (names.length) console.log(`  ${s}: ${names.length} assets shared`);
  }
  console.log(`dedupe: ${sharedFiles} files shared (${(sharedBytes / 1048576).toFixed(1)} MB in _shared/assets), ${collisions} collisions kept local`);
  for (const [s, names] of collisionScreens) console.log(`  ${s}: ${names.length} name collision(s) kept local (${names.slice(0, 3).join(', ')}${names.length > 3 ? ', …' : ''})`);

  // rewrite references in arkUIDSL.json + index.html (idempotent exact-pattern replaces)
  for (const s of screens) {
    const names = sharedNamesPerScreen.get(s);
    if (!names || !names.length) continue;
    const dir = join(root, s);
    // an incomplete screen (missing html or DSL) was reported as a problem above;
    // never read its files unconditionally in a --fix pass
    if (!existsSync(join(dir, 'arkUIDSL.json')) || !existsSync(join(dir, 'index.html'))) continue;
    let ark = readFileSync(join(dir, 'arkUIDSL.json'), 'utf-8');
    let html = readFileSync(join(dir, 'index.html'), 'utf-8');
    for (const name of names) {
      ark = rewriteAssetRefs(ark, name, `../_shared/assets/${name}`);
      html = rewriteAssetRefs(html, name, `../_shared/assets/${name}`);
    }
    writeFileSync(join(dir, 'arkUIDSL.json'), ark);
    writeFileSync(join(dir, 'index.html'), html);
  }
}

// --- adopt shared assets for screens whose own assets were never exported ---
// A screen exported without assets can still render the parts whose asset names exist
// in _shared/assets (same Octo node id => same graphic within one design revision).
// Ref names that exist nowhere stay missing and are reported as export gaps.
{
  const sharedDir = join(root, '_shared', 'assets');
  let adoptedTotal = 0;
  for (const [s, missing] of missingByScreen) {
    const adoptable = missing.filter((u) => {
      const name = safeSharedName(u);
      return name && existsSync(join(sharedDir, name));
    });
    const remaining = missing.filter((u) => !adoptable.includes(u));
    const dir = join(root, s);
    const complete = existsSync(join(dir, 'arkUIDSL.json')) && existsSync(join(dir, 'index.html'));
    if (fix && adoptable.length && complete) {
      let ark = readFileSync(join(dir, 'arkUIDSL.json'), 'utf-8');
      let html = readFileSync(join(dir, 'index.html'), 'utf-8');
      for (const u of adoptable) {
        const name = safeSharedName(u);
        if (!name) continue;
        ark = rewriteAssetRefs(ark, name, `../_shared/assets/${name}`);
        html = rewriteAssetRefs(html, name, `../_shared/assets/${name}`);
      }
      writeFileSync(join(dir, 'arkUIDSL.json'), ark);
      writeFileSync(join(dir, 'index.html'), html);
      adoptedTotal += adoptable.length;
      console.log(`  ${s}: adopted ${adoptable.length}/${missing.length} refs from _shared/assets`);
    }
    // --fix cannot adopt anything on an incomplete screen (write-back skipped), so every
    // missing ref is still broken; only check-only may advertise the pending adoption
    const left = fix && !complete ? missing : remaining;
    if (left.length) {
      missingRefs.set(s, left.length);
      const adoptNote = !fix && adoptable.length
        ? ` (${adoptable.length} adoptable from _shared/assets with --fix)` : '';
      // a missing asset ref is a documented export gap (named in DESIGN_INDEX), never a
      // failed run: it needs a re-export, and --fix does whatever adoption can do
      warnings.push(`${s}: ${left.length} missing asset refs${adoptNote} (${left[0]} …)`);
    }
  }
  if (adoptedTotal) console.log(`adoption: ${adoptedTotal} refs rewired to _shared/assets`);
}

// --- structural adoption: recover assets by matching the design structure ---
// Assets missing under one Octo id often exist under a different id from another
// design revision. Match by structure instead of name:
//   same octoName + rounded size + file extension, absolute position within ±4px (a
//   1-2px shift is normal between revisions), optionally the same nearest-ancestor name.
// Ranking per content md5: smallest position shift first, then ancestor-name hit, then
// closest pageId (neighbouring design states), then frequency. All-screens validation
// (leave-one-screen-out over the 25 screens, 2026-11-20): no screen regressed, +16
// correct picks vs the previous exact-position matcher; self-check on CannWorkButtonIdle:
// 254/255 covered, 219 picked correctly (ceiling 248 — some assets changed between revisions).
// A match is materialized as _shared/assets/<missing-name> (alias of the donor file),
// so refs keep the screen's own names.
const SHIFT_TOLERANCE = 4;
function md5Of(p) { return createHash('md5').update(readFileSync(p)).digest('hex'); }
function resolveSrc(screenName, src) {
  const p = src.startsWith('../_shared/assets/')
    ? join(root, '_shared', 'assets', src.split('/').pop())
    : join(root, screenName, src);
  return insideRoot(p) && existsSync(p) ? p : null;
}
function buildAssetIndex(excludeScreen) {
  const index = new Map(); // octo|WxH|ext -> [{screen, md5, path, chain, x, y}]
  for (const s of screens) {
    if (s === excludeScreen) continue;
    const p = join(root, s, 'arkUIDSL.json');
    if (!existsSync(p)) continue;
    const ark = JSON.parse(readFileSync(p, 'utf-8'));
    const walkIdx = (n, chain) => {
      if (!n || typeof n !== 'object') return;
      const m = n.meta || {};
      if (n.src && m.bbox) {
        const abs = resolveSrc(s, n.src);
        if (abs) {
          const ext = (n.src.split('.').pop() || '').toLowerCase();
          const key = `${m.octoName || ''}|${Math.round(m.bbox[2] - m.bbox[0])}x${Math.round(m.bbox[3] - m.bbox[1])}|${ext}`;
          if (!index.has(key)) index.set(key, []);
          index.get(key).push({
            screen: s, md5: md5Of(abs), path: abs, chain: chain.slice(-1).join('>'),
            x: m.bbox[0], y: m.bbox[1],
          });
        }
      }
      for (const c of n.children || []) walkIdx(c, [...chain, m.octoName || n.componentName]);
    };
    walkIdx(ark.ui, []);
  }
  return index;
}
// candidates for one missing node: same name+size+ext within the shift tolerance
function candidatesFor(index, node) {
  const key = `${node.octo || ''}|${Math.round(node.w)}x${Math.round(node.h)}|${node.ext}`;
  const cands = index.get(key);
  if (!cands) return null;
  const near = cands.filter((c) =>
    Math.abs(c.x - node.bbox[0]) <= SHIFT_TOLERANCE && Math.abs(c.y - node.bbox[1]) <= SHIFT_TOLERANCE);
  return near.length ? near : null;
}
// rank candidates per content md5: position shift -> ancestor-name hit -> pageId -> frequency
function pickFrom(cands, node, pageIds, screen) {
  const pid = (s) => pageIds.get(s) ?? 1e9;
  const agg = new Map();
  for (const c of cands) {
    const e = agg.get(c.md5) || { md5: c.md5, path: c.path, minDist: Infinity, minPid: Infinity, count: 0, chainHit: 0 };
    e.minDist = Math.min(e.minDist, Math.abs(c.x - node.bbox[0]) + Math.abs(c.y - node.bbox[1]));
    e.minPid = Math.min(e.minPid, Math.abs(pid(c.screen) - pid(screen)));
    e.count++;
    if (c.chain && c.chain === node.chain) e.chainHit++;
    agg.set(c.md5, e);
  }
  const best = [...agg.values()].sort((a, b) =>
    (a.minDist - b.minDist) || (b.chainHit - a.chainHit) || (a.minPid - b.minPid) || (b.count - a.count))[0];
  return best ? best : null;
}
// collect the target screen's missing asset nodes: name -> [{octo, w, h, ext, bbox, chain}]
function missingAssetNodes(s) {
  const byName = new Map();
  const arkPath = join(root, s, 'arkUIDSL.json');
  if (!existsSync(arkPath)) return byName; // screen without a DSL: nothing to structurally recover
  const ark = JSON.parse(readFileSync(arkPath, 'utf-8'));
  const walkMiss = (n, chain) => {
    if (!n || typeof n !== 'object') return;
    const m = n.meta || {};
    if (n.src && m.bbox && !resolveSrc(s, n.src)) {
      const name = n.src.split('/').pop();
      // a hostile ref (".", "..", separators) must not become a materialized asset name
      if (!name || name === '.' || name === '..' || /[/\\]/.test(name)) {
        for (const c of n.children || []) walkMiss(c, [...chain, m.octoName || n.componentName]);
        return;
      }
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push({
        octo: m.octoName || '',
        w: m.bbox[2] - m.bbox[0], h: m.bbox[3] - m.bbox[1],
        bbox: m.bbox,
        chain: chain.slice(-1).join('>'),
        ext: (name.split('.').pop() || '').toLowerCase(),
      });
    }
    for (const c of n.children || []) walkMiss(c, [...chain, m.octoName || n.componentName]);
  };
  walkMiss(ark.ui, []);
  return byName;
}

// --self-check <screen>: leave-one-screen-out evaluation of the structural matcher
if (scIdx >= 0) {
  const evalScreen = selfCheckScreen;
  if (!evalScreen) { console.error('--self-check needs a screen name'); process.exit(2); }
  const pageIds = readPageIds();
  const index = buildAssetIndex(evalScreen);
  const ark = JSON.parse(readFileSync(join(root, evalScreen, 'arkUIDSL.json'), 'utf-8'));
  let total = 0, covered = 0, present = 0, correct = 0;
  const walkEval = (n, chain) => {
    if (!n || typeof n !== 'object') return;
    const m = n.meta || {};
    if (n.src && m.bbox) {
      const abs = resolveSrc(evalScreen, n.src);
      if (abs) {
        total++;
        const truth = md5Of(abs);
        const node = {
          octo: m.octoName || '', w: m.bbox[2] - m.bbox[0], h: m.bbox[3] - m.bbox[1], bbox: m.bbox,
          chain: chain.slice(-1).join('>'), ext: (n.src.split('.').pop() || '').toLowerCase(),
        };
        const cands = candidatesFor(index, node);
        if (cands) {
          covered++;
          if (cands.some((c) => c.md5 === truth)) present++;
          const pick = pickFrom(cands, node, pageIds, evalScreen);
          if (pick && pick.md5 === truth) correct++;
        }
      }
    }
    for (const c of n.children || []) walkEval(c, [...chain, m.octoName || n.componentName]);
  };
  walkEval(ark.ui, []);
  console.log(`self-check ${evalScreen}: assets ${total} | structurally covered ${covered} | truth among candidates ${present} | picked correctly ${correct}`);
  console.log(`  precision of picks: ${covered ? ((100 * correct) / covered).toFixed(1) : 0}% (upper bound ${present})`);
  process.exit(0);
}

{
  const pageIds = readPageIds();
  const sharedDir = join(root, '_shared', 'assets');
  let index = null;
  let recoveredTotal = 0;
  for (const s of missingByScreen.keys()) {
    // incomplete screens are reported by the per-screen pass; never read their files here
    if (!existsSync(join(root, s, 'arkUIDSL.json')) || !existsSync(join(root, s, 'index.html'))) continue;
    // re-check what is still missing after name adoption
    const byName = missingAssetNodes(s);
    if (!byName.size) continue;
    index = index || buildAssetIndex(null);
    const recovered = [];
    for (const [name, nodes] of byName) {
      // vote across the nodes that reference this name
      const votes = new Map();
      for (const nd of nodes) {
        const cands = candidatesFor(index, nd);
        if (!cands) continue;
        const pick = pickFrom(cands, nd, pageIds, s);
        if (pick) votes.set(pick.md5, { pick, n: (votes.get(pick.md5)?.n || 0) + 1 });
      }
      if (!votes.size) continue;
      const best = [...votes.values()].sort((a, b) => b.n - a.n)[0].pick;
      recovered.push({ name, path: best.path });
    }
    if (!recovered.length) continue;
    if (fix) {
      // Point the refs at the donor's own name instead of copying an alias under the
      // screen's missing name — no duplicate bytes in _shared/assets. Only a name
      // collision with different content forces a per-screen alias.
      const refNames = [];
      for (const r of recovered) {
        const donorName = basename(r.path);
        const target = join(sharedDir, donorName);
        let refName = donorName;
        if (existsSync(target) && md5Of(target) !== md5Of(r.path)) refName = r.name;
        const dest = join(sharedDir, refName);
        if (!insideRoot(dest)) continue;
        if (existsSync(dest)) {
          // never point a ref at bytes that are not the donor's: an alias name may already
          // hold another screen's file from a different design revision
          if (md5Of(dest) !== md5Of(r.path)) {
            warnings.push(`${s}: cannot alias ${r.name} (different content already in _shared/assets) — left missing`);
            continue;
          }
        } else {
          copyFileSync(r.path, dest);
        }
        refNames.push({ name: r.name, refName });
      }
      const dir = join(root, s);
      let ark = readFileSync(join(dir, 'arkUIDSL.json'), 'utf-8');
      let html = readFileSync(join(dir, 'index.html'), 'utf-8');
      for (const { name, refName } of refNames) {
        ark = rewriteAssetRefs(ark, name, `../_shared/assets/${refName}`);
        html = rewriteAssetRefs(html, name, `../_shared/assets/${refName}`);
      }
      writeFileSync(join(dir, 'arkUIDSL.json'), ark);
      writeFileSync(join(dir, 'index.html'), html);
      recoveredTotal += refNames.length;
      console.log(`  ${s}: structurally recovered ${refNames.length}/${byName.size} assets`);
      const left = byName.size - refNames.length;
      if (left) missingRefs.set(s, left);
      else missingRefs.delete(s);
      // update the "missing refs" gap for names that are now recovered
      const remainingNames = new Set([...byName.keys()].filter((n) => !refNames.some((r) => r.name === n)));
      const idxGap = warnings.findIndex((p) => p.startsWith(`${s}: `) && p.includes('missing asset refs'));
      if (idxGap >= 0) {
        if (remainingNames.size) warnings[idxGap] = `${s}: ${remainingNames.size} missing asset refs after recovery (${[...remainingNames][0]} …)`;
        else warnings.splice(idxGap, 1);
      }
    } else {
      console.log(`  ${s}: ${recovered.length}/${byName.size} assets structurally recoverable (--fix applies)`);
    }
  }
  if (recoveredTotal) console.log(`structural recovery: ${recoveredTotal} assets materialized in _shared/assets`);
}

// --- compact arkUIDSL.json (whitespace is ~80% of the file; the tree is read by tools) ---
if (fix) {
  let arkSaved = 0;
  for (const s of screens) {
    const ap = join(root, s, 'arkUIDSL.json');
    if (!existsSync(ap)) continue;
    const text = readFileSync(ap, 'utf-8');
    let min;
    try { min = JSON.stringify(JSON.parse(text)); } catch { continue; }
    if (min.length < text.length) { writeFileSync(ap, min); arkSaved += text.length - min.length; }
  }
  if (arkSaved) console.log(`arkUIDSL.json minified: saved ${(arkSaved / 1048576).toFixed(1)} MB`);
}

// --- verification AFTER the dedupe; fail if any screen got worse ---
// ponytail: --fix is not transactional — a failed verify leaves the batch mutated. A
// snapshot copy of the 20+ MB batch buys little: zip imports keep the archive on failure
// and a folder run can be re-run after the reported screen is fixed. Upgrade path: copy
// `root` to a temp dir before the first write and restore it when verify fails.
if (fix && !skipVerify) {
  const after = verify('after dedupe');
  for (const [s, b] of beforeMap) {
    const a = after.get(s);
    if (b.diff == null) continue; // a perfect baseline is a valid 0, not "no result"
    if (!a || a.diff == null) { console.log(`  FAIL ${s}: no after result`); failed = true; continue; }
    const dd = (a.diff - b.diff) * 100, ds = (a.sharp - b.sharp) * 100;
    if (dd > 0.05 || ds > 0.05) {
      console.log(`  FAIL ${s}: noticeable ${dd >= 0 ? '+' : ''}${dd.toFixed(2)}pp, strong ${ds >= 0 ? '+' : ''}${ds.toFixed(2)}pp`);
      failed = true;
    }
  }
  console.log(failed ? 'verify: FAILED' : 'verify: OK (nothing got worse)');
}

// --- update this batch's section of docs/ui/DESIGN_INDEX.md (pageIds preserved) ---
if (fix) {
  const pngSize = (p) => {
    try { const b = readFileSync(p); return b.readUInt32BE(0) === 0x89504e47 ? `${b.readUInt32BE(16)}×${b.readUInt32BE(20)}` : null } catch { return null }
  };
  let idx = readFileSync(idxPath, 'utf-8');
  // pageIds belong to THIS batch's section only: scraping the whole file would give a
  // batch with no pageId column a useless all-"—" one just because another batch has ids
  const pageIds = new Map();
  for (const m of oldSection.matchAll(/^\|\s*(?:\d+\s*\|)?\s*`([^`]+)`\s*\|\s*[^|]+\|\s*(\d+)\s*\|/gm)) pageIds.set(m[1], m[2]);
  const pidHeader = pageIds.size ? ' pageId |' : '';
  // separator must match the header width (the pageId column is conditional)
  const tableSep = `|${'---|'.repeat(pidHeader ? 5 : 4)}`;
  const rows = [];
  const gaps = [];
  for (const s of screens) {
    const dir = join(root, s);
    let name = s;
    let shared = 0;
    try {
      const ark = JSON.parse(readFileSync(join(dir, 'arkUIDSL.json'), 'utf-8'));
      name = ark.page?.name || ark.ui?.meta?.octoName || s;
      const countShared = (x) => {
        if (!x || typeof x !== 'object') return 0;
        return (x.src && x.src.startsWith('../_shared/assets/') ? 1 : 0) +
          (x.children || []).reduce((acc, k) => acc + countShared(k), 0);
      };
      shared = countShared(ark.ui);
    } catch { /* keep folder name */ }
    const local = existsSync(join(dir, 'assets')) ? readdirSync(join(dir, 'assets')).length : 0;
    const shot = join(dir, 'screenshot.png');
    const shotExists = existsSync(shot);
    const dims = shotExists ? pngSize(shot) : null;
    const inv = invalidShots.get(s);
    const invNote = inv
      ? `invalid screenshot removed (${inv.w}×${inv.h} popup crop)`
      : (!shotExists && oldInvalid.has(s) ? oldInvalid.get(s) : null);
    const shotStr = shotExists ? `screenshot.png${dims ? ` (${dims})` : ''}` : (invNote ? 'screenshot invalid (removed)' : 'screenshot missing');
    const pid = pageIds.get(s);
    const pidCell = pidHeader ? ` ${pid ?? '—'} |` : '';
    rows.push(`| \`${s}\` | ${name} |${pidCell} ${shotStr} | assets: ${shared} shared, ${local} local |`);
    if (missingRefs.has(s) || invNote || !shotExists) {
      const parts = [];
      if (missingRefs.has(s)) parts.push(`${missingRefs.get(s)} broken refs, ${local} local assets`);
      if (invNote) parts.push(invNote);
      else if (!shotExists) parts.push('no screenshot');
      gaps.push(`| \`${s}\` | ${parts.join('; ')} |`);
    }
  }
  const section = `${mStart}
## Source frames (\`${batch}\` — Octo/HDesign export)

Full-state screens with a machine-readable DSL, not plain jpegs: each folder under
[\`source/${batch}/\`](./source/${batch}/) holds \`arkUIDSL.json\` (node tree with absolute bboxes),
\`screenshot.png\`, a sanitized \`index.html\`, and shared assets in
[\`source/${batch}/_shared/assets/\`](./source/${batch}/_shared/assets/).
Work with them via the design-tools skill (\`.agents/skills/design-tools/SKILL.md\`):
\`npm run design:find -- "<element>" docs/ui/source/${batch}\` to locate a UI element across screens,
\`npm run design:render -- <Screen> docs/ui/source/${batch}\` /
\`npm run design:diff -- <Screen> docs/ui/source/${batch}\` to render and compare with the screenshot.
\`npm run design:sanitize -- <export.zip>\` ingests a fresh export (extract, tailwind/fonts/margins,
lossless PNG/SVG optimization, asset dedupe, structural asset recovery, before/after
verification) — this section is regenerated by that command.

### Screens

| Folder | Design name |${pidHeader} Screenshot | Assets |
${tableSep}
${rows.join('\n')}

### Known export gaps

Screens with remaining missing assets or screenshots (structure-based recovery already
applied) — excluded from render/diff until re-exported:

| Folder | Note |
|---|---|
${gaps.join('\n') || '| — | none |'}

${mEnd}`;
  const start = idx.indexOf(mStart);
  const end = idx.indexOf(mEnd);
  if (start >= 0 && end > start) {
    idx = idx.slice(0, start) + section + idx.slice(end + mEnd.length);
  } else {
    idx += '\n' + section;
  }
  writeFileSync(idxPath, idx);
  console.log(`DESIGN_INDEX.md ${batch} section updated`);
}

// temporary renders (design:render / design:diff verification) must not stay in the repo
if (fix) {
  let removed = 0;
  for (const s of screens) {
    const r = join(root, s, '_rebuilt.html');
    if (existsSync(r)) { unlinkSync(r); removed++; }
  }
  if (removed) console.log(`cleanup: removed ${removed} temporary _rebuilt.html render(s)`);
}

console.log(`screens: ${screens.length} | fixes applied: ${fixCount} | problems: ${problems.length} | warnings: ${warnings.length}`);
for (const p of problems) console.log('  problem: ' + p);
for (const w of warnings) console.log('  warn: ' + w);

// documented export gaps (warnings) do not block success — only real problems/verify failures do
if (zipPath && !keepZip && !failed && !problems.length) {
  rmSync(zipPath);
  console.log(`zip removed: ${zipPath}`);
} else if (zipPath && (failed || problems.length)) {
  console.log(`zip kept (verify failed or problems found): ${zipPath}`);
}
process.exit(failed ? 2 : problems.length ? 1 : 0);
