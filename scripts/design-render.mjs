#!/usr/bin/env node
// Render one design screen from arkUIDSL.json to a self-contained html.
//   npm run design:render -- <Screen> [<designRoot>]
// Writes <designRoot>/<Screen>/_rebuilt.html. The renderer is the reference
// implementation of the DSL: absolute bbox positioning, #AARRGGBB -> rgba(),
// ancestor clipping + group opacity (flat DOM), text above bars, white-space:pre,
// layout margins ignored, the full-page annotation dim skipped.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ROOT = resolve(ROOT, 'docs/ui/source/1130');

const args = process.argv.slice(2);
const screen = args.find((a) => !a.startsWith('--'));
const rootArg = args.filter((a) => !a.startsWith('--'))[1] ?? DEFAULT_ROOT;
if (!screen) {
  console.error('usage: npm run design:render -- <Screen> [<designRoot>]');
  process.exit(2);
}
const base = `${rootArg.replace(/[\\/]$/, '')}/${screen}/`;
const dsl = JSON.parse(readFileSync(base + 'arkUIDSL.json', 'utf-8'));

// #AARRGGBB (Figma alpha-first) -> rgba() (browser alpha-last).
function dslColor(hex) {
  if (!hex || !hex.startsWith('#')) return hex;
  const h = hex.slice(1);
  if (h.length === 8) {
    const a = parseInt(h.slice(0, 2), 16) / 255;
    return `rgba(${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${parseInt(h.slice(6, 8), 16)},${+a.toFixed(3)})`;
  }
  return hex;
}
function dslGradient(g) {
  return String(g).replace(/#[0-9A-Fa-f]{8}/g, (m) => dslColor(m));
}
const enumVal = {
  Center: 'center', Top: 'flex-start', Bottom: 'flex-end', Left: 'left', Right: 'right',
  SpaceBetween: 'space-between', Start: 'start', Middle: 'middle', 'Flex-start': 'flex-start',
};

const out = [];
let z = 0;
let rendered = 0;
// The full-page annotation dim is not rendered by the stock html — skip it here too.
function isDim(s, bbox) {
  return bbox && bbox[0] <= 0 && bbox[1] <= 0 && bbox[2] >= 1919 && bbox[3] >= 1079 &&
    (s.backgroundColor || '').toUpperCase() === '#66262626';
}
// Floating UI paints above the app (and above the chart axis texts it overlaps).
const FLOATING = new Set(['文字标注', '提示悬浮', '深色模式/下拉菜单 面板', '报告统计', '滚动条', '顶部菜单栏', '底部栏/Dark', '菜单']);
let currentLayer = 'app';
// Intrinsic raster size (PNG IHDR / SVG width+height) — used to decide fill vs natural.
function intrinsicSize(src) {
  try {
    const buf = readFileSync(base + src);
    if (buf.readUInt32BE(0) === 0x89504e47) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    const head = buf.toString('utf-8', 0, 400);
    const w = head.match(/<svg[^>]*\bwidth="([\d.]+)"/);
    const h = head.match(/<svg[^>]*\bheight="([\d.]+)"/);
    if (w && h) return [parseFloat(w[1]), parseFloat(h[1])];
  } catch { /* unreadable — treat as fill */ }
  return null;
}
function hasRadius(s) {
  const r = s.borderRadius;
  if (typeof r === 'object' && r) return r.topLeft > 0 || r.topRight > 0 || r.bottomLeft > 0 || r.bottomRight > 0;
  return r > 0;
}
function clipInset(clip, bbox) {
  const [x1, y1, x2, y2] = bbox;
  const t = Math.max(0, clip[1] - y1);
  const r = Math.max(0, x2 - clip[2]);
  const b = Math.max(0, y2 - clip[3]);
  const l = Math.max(0, clip[0] - x1);
  return (t || r || b || l) ? `clip-path:inset(${t}px ${r}px ${b}px ${l}px)` : null;
}
function walk(n, layer, texts, clips, parentOp) {
  if (!n || typeof n !== 'object') return;
  const s = n.styles || {};
  const m = n.meta || {};
  if (FLOATING.has(m.octoName)) layer = 'float';
  if (m.bbox && !isDim(s, m.bbox)) {
    const isText = n.componentName === 'Text' && typeof n.content === 'string';
    if (isText === texts && layer === currentLayer) {
      rendered++;
      const [x1, y1, x2, y2] = m.bbox;
      // ancestor clips (flat DOM loses overflow clipping of rounded containers)
      let visible = true;
      const cuts = [];
      for (const cl of clips) {
        if (cl[0] >= x2 || cl[2] <= x1 || cl[1] >= y2 || cl[3] <= y1) { visible = false; break; }
        const cut = clipInset(cl, m.bbox);
        if (cut) cuts.push(cut);
      }
      if (visible) {
      z++;
      const css = [
        `position:absolute`,
        `left:${x1}px`, `top:${y1}px`,
        `width:${s.width ?? x2 - x1}px`, `height:${s.height ?? y2 - y1}px`,
        `z-index:${z}`,
      ];
      // every style attribute, verbatim
      if (s.backgroundColor) css.push(`background-color:${dslColor(s.backgroundColor)}`);
      if (s.linearGradient) css.push(`background-image:${dslGradient(s.linearGradient)}`);
      if (s.borderRadius != null) {
        if (typeof s.borderRadius === 'object')
          css.push(`border-radius:${s.borderRadius.topLeft}px ${s.borderRadius.topRight}px ${s.borderRadius.bottomRight}px ${s.borderRadius.bottomLeft}px`);
        else css.push(`border-radius:${s.borderRadius}px`);
      }
      if (s.border) css.push(`border:${s.border.width ?? 1}px ${(s.border.style ?? 'solid').toLowerCase()} ${dslColor(s.border.color) ?? '#000'}`);
      for (const side of ['borderLeft', 'borderRight', 'borderTop', 'borderBottom']) {
        const b = s[side];
        if (b) css.push(`border-${side.slice(6).toLowerCase()}:${b.width ?? 1}px ${(b.style ?? 'solid').toLowerCase()} ${dslColor(b.color) ?? '#000'}`);
      }
      if (s.boxShadow) css.push(`box-shadow:${s.boxShadow}`);
      if (s.filter) css.push(`filter:${s.filter}`);
      if (s.backdropFilter) css.push(`backdrop-filter:${s.backdropFilter}`, `-webkit-backdrop-filter:${s.backdropFilter}`);
      // flat DOM: ancestor group opacity must be multiplied down the tree
      const eff = parentOp * (s.opacity ?? 1);
      if (eff !== 1) css.push(`opacity:${eff}`);
      if (s.overflow) css.push(`overflow:${s.overflow}`);
      if (s.padding) css.push(`padding:${s.padding.top ?? 0}px ${s.padding.right ?? 0}px ${s.padding.bottom ?? 0}px ${s.padding.left ?? 0}px`);
      // No marginTop/marginLeft: they are auto-layout offsets already baked into the absolute bbox.
      if (s.alignItems) css.push(`display:flex`, `align-items:${enumVal[s.alignItems] ?? s.alignItems}`);
      if (s.justifyContent) css.push(`display:flex`, `justify-content:${enumVal[s.justifyContent] ?? s.justifyContent}`);
      if (s.position) css.push(`position:${s.position}`);
      if (s.space != null && s.space !== 0) css.push(`gap:${s.space}px`);
      if (s.top != null) css.push(`inset-block-start:${s.top}px`);
      if (s.left != null) css.push(`inset-inline-start:${s.left}px`);
      for (const cut of cuts) css.push(cut);

      if (isText) {
        css.push(
          `font-size:${s.fontSize ?? 12}px`,
          `color:${dslColor(s.fontColor) ?? '#fff'}`,
          `font-weight:${s.fontWeight ?? 400}`,
          `line-height:${s.lineHeight ?? s.fontSize ?? 12}px`,
          `text-align:${String(s.textAlign ?? 'start').toLowerCase()}`,
          // The stock html uses white-space:pre (no wrapping) for single-line texts
          // and pre-wrap for multiline ones — bbox width must not reflow them.
          `white-space:${n.content.includes('\n') ? 'pre-wrap' : 'pre'}`,
        );
        if (s.verticalAlign && s.verticalAlign !== 'Top') css.push(`display:flex`, `align-items:${enumVal[s.verticalAlign] ?? 'flex-start'}`);
        out.push(`<div style="${css.join(';')}">${n.content.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`);
      } else if (n.componentName === 'Image' && n.src) {
        const [iw, ih] = intrinsicSize(n.src) || [null, null];
        if (iw && ih && iw < (x2 - x1) / 2 && ih < (y2 - y1) / 2) {
          // tiny raster tile in a large box: natural size, centered, no-repeat (stock does this)
          css.push(
            `background-image:url('${n.src}')`,
            `background-repeat:no-repeat`,
            `background-position:center`,
            `background-size:auto`,
          );
          out.push(`<div style="${css.join(';')}"></div>`);
        } else {
          css.push(`object-fit:fill`);
          out.push(`<img style="${css.join(';')}" src="${n.src}" />`);
        }
      } else {
        out.push(`<div style="${css.join(';')}"></div>`);
      }
      }
    }
  }
  // rounded containers clip their descendants (flat DOM loses overflow clipping)
  const childClips = hasRadius(s) && m.bbox ? [...clips, m.bbox] : clips;
  for (const c of n.children || []) walk(c, layer, texts, childClips, parentOp * (s.opacity ?? 1));
}
// Four passes: app shapes < app texts < floating shapes < floating texts.
for (const layer of ['app', 'float']) {
  currentLayer = layer;
  walk(dsl.ui, 'app', false, [], 1);
  walk(dsl.ui, 'app', true, [], 1);
}

const root = dsl.ui?.styles || {};
const W = root.width || 1920, H = root.height || 1080;
// the icon font is optional (the sanitizer drops it when no text uses its glyphs)
const iconFont = `${base}../_shared/fonts/HMSymbolVF.ttf`;
const iconFace = existsSync(iconFont)
  ? "@font-face { font-family: 'HMSymbolVF'; src: url('../_shared/fonts/HMSymbolVF.ttf') format('truetype'); }\n"
  : '';
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'HarmonyOS Sans SC'; src: url('../_shared/fonts/HarmonyOS_Sans_SC_Medium.woff2') format('woff2'); }
${iconFace}* { box-sizing: border-box; margin: 0; padding: 0; }
html { overflow: hidden; }
body { width: ${W}px; height: ${H}px; background: #16181A; font-family: 'HarmonyOS Sans SC', sans-serif; position: relative; overflow: hidden; }
</style></head><body>${out.join('\n')}</body></html>`;
writeFileSync(base + '_rebuilt.html', html);
console.log(`rendered: ${rendered} / nodes in dsl: ${out.length}`);
