#!/usr/bin/env node

/**
 * Render annotated HQ open-question crops from docs/context/visual/hq/manifest.yaml
 * and v930 source frames under docs/ui/source/.
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SOURCE_MANIFEST = resolve(ROOT, 'docs/ui/source/manifest.yaml');
const HQ_MANIFEST = resolve(ROOT, 'docs/context/visual/hq/manifest.yaml');
const HQ_OUT_DIR = resolve(ROOT, 'docs/context/visual/hq');
const SOURCE_DIR = resolve(ROOT, 'docs/ui/source');

const STROKE = '#2d70e3';
const FILL = 'rgba(45, 112, 227, 0.12)';
const LABEL_BG = '#2d70e3';
const LABEL_FG = '#ffffff';

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
    if (s.startsWith('{') && s.endsWith('}')) {
      const obj = {};
      const inner = s.slice(1, -1).trim();
      if (!inner) return obj;
      for (const part of inner.split(',')) {
        const colon = part.indexOf(':');
        if (colon < 0) continue;
        const k = part.slice(0, colon).trim();
        const v = part.slice(colon + 1).trim();
        obj[k] = parseScalar(v);
      }
      return obj;
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

function loadSourceIds() {
  const data = parseSimpleYaml(readFileSync(SOURCE_MANIFEST, 'utf-8'));
  const map = new Map();
  for (const [batchId, batch] of Object.entries(data.batches ?? {})) {
    for (const f of batch.files ?? []) {
      if (!f?.id || !f?.path) continue;
      map.set(`${batchId}/${f.id}`, resolve(SOURCE_DIR, f.path));
    }
  }
  return map;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHighlightSvg(width, height, highlights, scale) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ];

  for (const h of highlights ?? []) {
    const box = h.box ?? {};
    const x = Math.round((box.x ?? 0) * scale);
    const y = Math.round((box.y ?? 0) * scale);
    const w = Math.round((box.w ?? 0) * scale);
    const hgt = Math.round((box.h ?? 0) * scale);
    if (w <= 0 || hgt <= 0) continue;

    const label = escapeXml(h.label ?? '');
    const fontSize = Math.max(11, Math.round(13 * scale));
    const padX = Math.round(6 * scale);
    const padY = Math.round(4 * scale);
    const labelW = Math.min(width - x, Math.max(60, label.length * fontSize * 0.55 + padX * 2));
    const labelH = fontSize + padY * 2;
    const labelY = Math.max(0, y - labelH - 2);

    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="4" ry="4" fill="${FILL}" stroke="${STROKE}" stroke-width="3"/>`,
    );
    if (label) {
      parts.push(
        `<rect x="${x}" y="${labelY}" width="${labelW}" height="${labelH}" rx="4" ry="4" fill="${LABEL_BG}"/>`,
        `<text x="${x + padX}" y="${labelY + labelH - padY - 2}" fill="${LABEL_FG}" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="600">${label}</text>`,
      );
    }
  }

  parts.push('</svg>');
  return parts.join('');
}

async function renderOne(id, meta, sourceIds) {
  const sourcePath = sourceIds.get(meta.source);
  if (!sourcePath) throw new Error(`${id}: unknown source id "${meta.source}"`);
  if (!existsSync(sourcePath)) throw new Error(`${id}: missing source file ${sourcePath}`);

  const crop = meta.crop ?? {};
  const { x = 0, y = 0, w = 0, h = 0 } = crop;
  if (w <= 0 || h <= 0) throw new Error(`${id}: invalid crop`);

  let pipeline = sharp(sourcePath).extract({ left: x, top: y, width: w, height: h });
  const croppedMeta = await pipeline.metadata();
  const cropW = croppedMeta.width ?? w;
  const cropH = croppedMeta.height ?? h;

  const maxWidth = meta.maxWidth ?? 900;
  const scale = cropW > maxWidth ? maxWidth / cropW : 1;
  const outW = Math.round(cropW * scale);
  const outH = Math.round(cropH * scale);

  if (scale < 1) {
    pipeline = pipeline.resize(outW, outH, { fit: 'fill' });
  }

  const baseBuf = await pipeline.png().toBuffer();
  const svg = buildHighlightSvg(outW, outH, meta.highlights, scale);
  const outPath = join(HQ_OUT_DIR, `${id}.png`);

  await sharp(baseBuf)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(outPath);

  return outPath;
}

async function main() {
  if (!existsSync(HQ_MANIFEST)) {
    console.error(`missing ${HQ_MANIFEST}`);
    process.exit(1);
  }

  mkdirSync(HQ_OUT_DIR, { recursive: true });
  const sourceIds = loadSourceIds();
  const hq = parseSimpleYaml(readFileSync(HQ_MANIFEST, 'utf-8'));
  const images = hq.images ?? {};

  const ids = Object.keys(images);
  if (!ids.length) {
    console.error('no images in hq manifest');
    process.exit(1);
  }

  for (const id of ids) {
    const out = await renderOne(id, images[id], sourceIds);
    console.log(`rendered ${id} → ${out}`);
  }

  console.log(`render-hq-visuals: ok (${ids.length} image(s))`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
