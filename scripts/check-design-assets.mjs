#!/usr/bin/env node

/**
 * Validate design asset hierarchy:
 * - source/manifest.yaml files exist on disk
 * - each component visual/ crop is listed in provenance.yaml
 * - each provenance source id resolves via source/manifest.yaml
 * - markdown links to design images under src/ui, docs/ui, and docs/context resolve
 * - HQ open-questions annotated crops in docs/context/visual/hq/ match manifest.yaml
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MANIFEST = resolve(ROOT, 'docs/ui/source/manifest.yaml');
const SOURCE_DIR = resolve(ROOT, 'docs/ui/source');
const UI_DIR = resolve(ROOT, 'src/ui');
const SWIM_DIR = resolve(ROOT, 'src/swimlane');
const DOCS_UI = resolve(ROOT, 'docs/ui');
const DOCS_CONTEXT = resolve(ROOT, 'docs/context');
const HQ_MANIFEST = resolve(DOCS_CONTEXT, 'visual/hq/manifest.yaml');
const HQ_OUT_DIR = resolve(DOCS_CONTEXT, 'visual/hq');

const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;
const MD_LINK_RE = /!\[[^\]]*\]\(([^)]+)\)|\[[^\]]*\]\(([^)]+\.(?:png|jpe?g|webp|gif)(?:#[^)]*)?)\)/gi;
const HTML_IMG_RE = /<img[^>]+src=["']([^"']+\.(?:png|jpe?g|webp|gif))["']/gi;

const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function listFiles(dir, predicate) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && predicate(e.name))
    .map((e) => join(dir, e.name));
}

function findFiles(dir, predicate) {
  if (!existsSync(dir)) return [];
  const acc = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) acc.push(...findFiles(full, predicate));
    else if (predicate(entry.name)) acc.push(full);
  }
  return acc;
}

/** Minimal parser for our manifest / provenance YAML subset. */
function parseSimpleYaml(text) {
  const lines = text.split(/\r?\n/);
  const root = {};
  const stack = [{ indent: -1, obj: root, key: null, isArray: false }];

  function current() {
    return stack[stack.length - 1];
  }

  function parseScalar(raw) {
    const s = raw.trim();
    if (s === '' || s === 'null' || s === '~') return null;
    if (s === 'true') return true;
    if (s === 'false') return false;
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1);
    }
    if (s.startsWith('[') && s.endsWith(']')) {
      const inner = s.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(',').map((x) => parseScalar(x));
    }
    const n = Number(s);
    if (!Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(s)) return n;
    return s;
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.match(/^ */)?.[0].length ?? 0;
    line = line.trim();

    while (stack.length > 1 && indent <= current().indent) stack.pop();
    const ctx = current();

    if (line.startsWith('- ')) {
      const rest = line.slice(2).trim();
      if (!Array.isArray(ctx.obj[ctx.key])) {
        if (ctx.key == null) fail(`YAML array without key near line ${i + 1}`);
        ctx.obj[ctx.key] = [];
      }
      const arr = ctx.obj[ctx.key];
      if (rest.includes(':') && !rest.startsWith('[') && !rest.startsWith('"') && !rest.startsWith("'")) {
        const colon = rest.indexOf(':');
        const k = rest.slice(0, colon).trim();
        const v = rest.slice(colon + 1).trim();
        const item = {};
        if (v === '') {
          arr.push(item);
          stack.push({ indent, obj: item, key: k, isArray: false });
        } else {
          item[k] = parseScalar(v);
          arr.push(item);
          stack.push({ indent, obj: item, key: null, isArray: false });
        }
      } else {
        arr.push(parseScalar(rest));
      }
      continue;
    }

    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    if (val === '') {
      ctx.obj[key] = {};
      stack.push({ indent, obj: ctx.obj[key], key: null, isArray: false });
      // peek: next non-empty may be array under this key — use placeholder
      // Fix: when children are `- ` items, they need ctx.key set. Detect via next line.
      let j = i + 1;
      while (j < lines.length && (!lines[j].trim() || lines[j].trim().startsWith('#'))) j++;
      if (j < lines.length) {
        const next = lines[j];
        const nextIndent = next.match(/^ */)?.[0].length ?? 0;
        if (next.trim().startsWith('- ') && nextIndent > indent) {
          ctx.obj[key] = [];
          stack[stack.length - 1] = { indent, obj: ctx.obj, key, isArray: true };
        }
      }
    } else {
      ctx.obj[key] = parseScalar(val);
    }
  }

  return root;
}

function loadManifest() {
  if (!existsSync(MANIFEST)) {
    fail(`missing manifest: ${relative(ROOT, MANIFEST)}`);
    return { sourceIds: new Map(), componentsHinted: new Set() };
  }
  const data = parseSimpleYaml(readFileSync(MANIFEST, 'utf-8'));
  const sourceIds = new Map(); // id -> abs path
  const componentsHinted = new Set();

  const batches = data.batches ?? {};
  for (const [batchId, batch] of Object.entries(batches)) {
    for (const f of batch.files ?? []) {
      if (!f?.id || !f?.path) continue;
      const id = `${batchId}/${f.id}`;
      const abs = resolve(SOURCE_DIR, f.path);
      sourceIds.set(id, abs);
      if (!existsSync(abs)) fail(`manifest source missing file: ${id} → ${f.path}`);
      for (const c of f.components ?? []) componentsHinted.add(c);
    }
  }

  return { sourceIds, componentsHinted };
}

function resolveSourceId(id, maps) {
  if (maps.sourceIds.has(id)) return maps.sourceIds.get(id);
  return null;
}

/** Find every `visual/` directory that has provenance.yaml under rootDir. */
function findVisualPackDirs(rootDir) {
  const packs = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = join(dir, entry.name);
      if (entry.name === 'visual') {
        const prov = join(full, 'provenance.yaml');
        if (existsSync(prov)) packs.push(full);
        continue;
      }
      walk(full);
    }
  }
  walk(rootDir);
  return packs;
}

/** Basename → absolute path of component folder that owns visual/. */
function indexVisualPacksByBasename(...roots) {
  const map = new Map();
  for (const root of roots) {
    for (const visual of findVisualPackDirs(root)) {
      const compDir = dirname(visual);
      const base = relative(ROOT, compDir).split(/[/\\]/).pop();
      if (base) map.set(base, compDir);
    }
  }
  return map;
}

function checkVisualPacks(maps) {
  function checkOnePack(visual, componentLabel) {
    const provPath = join(visual, 'provenance.yaml');
    if (!existsSync(provPath)) {
      fail(`${componentLabel}/visual/: missing provenance.yaml`);
      return;
    }

    const prov = parseSimpleYaml(readFileSync(provPath, 'utf-8'));
    const cropEntries = prov.crops ?? {};
    const listed = new Set(Object.keys(cropEntries));

    const images = listFiles(visual, (n) => IMAGE_EXT.test(n));
    for (const img of images) {
      const name = relative(visual, img);
      if (!listed.has(name)) fail(`${componentLabel}/visual/: crop ${name} not in provenance.yaml`);
    }

    for (const [name, meta] of Object.entries(cropEntries)) {
      const imgPath = join(visual, name);
      if (!existsSync(imgPath)) fail(`${componentLabel}/visual/: provenance lists missing crop ${name}`);
      const srcId = meta?.source ?? prov.source_primary;
      if (!srcId) {
        fail(`${componentLabel}/visual/: ${name} has no source`);
        continue;
      }
      const abs = resolveSourceId(srcId, maps);
      if (!abs) fail(`${componentLabel}/visual/: unknown source id "${srcId}" for ${name}`);
      else if (!existsSync(abs)) fail(`${componentLabel}/visual/: source file missing for ${srcId}`);
    }

    if (prov.source_primary) {
      const abs = resolveSourceId(prov.source_primary, maps);
      if (!abs) fail(`${componentLabel}/visual/: unknown source_primary "${prov.source_primary}"`);
    }
  }

  for (const visual of findVisualPackDirs(UI_DIR)) {
    checkOnePack(visual, relative(UI_DIR, dirname(visual)));
  }
  for (const visual of findVisualPackDirs(SWIM_DIR)) {
    checkOnePack(visual, 'swimlane/' + relative(SWIM_DIR, dirname(visual)));
  }

  const byBase = indexVisualPacksByBasename(UI_DIR, SWIM_DIR);
  for (const name of maps.componentsHinted) {
    if (!byBase.has(name)) {
      warn(`manifest lists ${name} but no visual/ pack yet`);
    }
  }
}

function stripLinkTarget(raw) {
  let t = raw.trim();
  if (t.startsWith('<') && t.endsWith('>')) t = t.slice(1, -1);
  const hash = t.indexOf('#');
  if (hash >= 0) t = t.slice(0, hash);
  const space = t.search(/\s/);
  if (space >= 0) t = t.slice(0, space);
  return t.replace(/^<|>$/g, '');
}

function resolveImageLink(base, raw) {
  const target = stripLinkTarget(raw);
  if (!target || target.startsWith('http://') || target.startsWith('https://') || target.startsWith('data:')) {
    return null;
  }
  if (!IMAGE_EXT.test(target)) return null;
  return target.startsWith('/')
    ? resolve(ROOT, target.replace(/^\//, ''))
    : resolve(base, target);
}

function checkMarkdownLinks() {
  const mdFiles = [
    ...findFiles(UI_DIR, (n) => n.endsWith('.md')),
    ...findFiles(resolve(ROOT, 'src/swimlane'), (n) => n.endsWith('.md')),
    ...findFiles(DOCS_UI, (n) => n.endsWith('.md')),
    ...findFiles(DOCS_CONTEXT, (n) => n.endsWith('.md')),
  ];

  for (const file of mdFiles) {
    const content = readFileSync(file, 'utf-8');
    const base = dirname(file);
    let m;
    MD_LINK_RE.lastIndex = 0;
    while ((m = MD_LINK_RE.exec(content))) {
      const raw = m[1] || m[2];
      if (!raw) continue;
      const abs = resolveImageLink(base, raw);
      if (abs && !existsSync(abs)) {
        fail(`broken image link in ${relative(ROOT, file)}: ${stripLinkTarget(raw)}`);
      }
    }

    HTML_IMG_RE.lastIndex = 0;
    while ((m = HTML_IMG_RE.exec(content))) {
      const raw = m[1];
      if (!raw) continue;
      const abs = resolveImageLink(base, raw);
      if (abs && !existsSync(abs)) {
        fail(`broken image link in ${relative(ROOT, file)}: ${stripLinkTarget(raw)}`);
      }
    }
  }
}

function checkHqVisuals(maps) {
  if (!existsSync(HQ_MANIFEST)) return;

  const hq = parseSimpleYaml(readFileSync(HQ_MANIFEST, 'utf-8'));
  const images = hq.images ?? {};
  const ids = Object.keys(images);
  if (!ids.length) {
    fail('docs/context/visual/hq/manifest.yaml: no images defined');
    return;
  }

  for (const id of ids) {
    const meta = images[id] ?? {};
    const outPath = join(HQ_OUT_DIR, `${id}.png`);
    if (!existsSync(outPath)) {
      fail(`hq visual missing output: ${relative(ROOT, outPath)} (run npm run render:hq-visuals)`);
    }

    const srcId = meta.source;
    if (!srcId) {
      fail(`hq visual ${id}: missing source id`);
      continue;
    }
    const abs = resolveSourceId(srcId, maps);
    if (!abs) fail(`hq visual ${id}: unknown source id "${srcId}"`);
    else if (!existsSync(abs)) fail(`hq visual ${id}: source file missing for ${srcId}`);
  }
}

const maps = loadManifest();
checkVisualPacks(maps);
checkHqVisuals(maps);
checkMarkdownLinks();

for (const w of warnings) console.warn(`WARN: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  console.error(`\ncheck-design-assets: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}

console.log(`check-design-assets: ok (${warnings.length} warning(s))`);
