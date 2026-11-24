#!/usr/bin/env node
// Render one design screen from arkUIDSL.json to a self-contained html.
//   npm run design:render -- <Screen> [<designRoot>]
// Writes <designRoot>/<Screen>/_rebuilt.html. The renderer is the reference
// implementation of the DSL: absolute bbox positioning, #AARRGGBB -> rgba(),
// ancestor clipping + group opacity (flat DOM), text above bars, white-space:pre,
// layout margins ignored, the full-page annotation dim skipped.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
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
// The DSL comes from a downloaded export zip: escape every attribute value (a quote in a
// style/url would otherwise close the attribute and inject markup) and only load assets
// that stay inside the design root.
function escAttr(v) {
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const ROOT_ABS = resolve(rootArg);
function safeSrc(src) {
  if (!src || /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//') || /["'\\]/.test(src)) return null;
  for (const ch of src) if (ch.codePointAt(0) < 0x20) return null;
  const abs = resolve(base, src);
  return abs.startsWith(ROOT_ABS + sep) ? abs : null;
}
const enumVal = {
  Center: 'center', Top: 'flex-start', Bottom: 'flex-end', Left: 'left', Right: 'right',
  SpaceBetween: 'space-between', Start: 'start', Middle: 'middle', 'Flex-start': 'flex-start',
};

const out = [];
let z = 0;
let rendered = 0;
const PAGE_W = dsl.ui?.styles?.width || 1920;
const PAGE_H = dsl.ui?.styles?.height || 1080;
// The full-page annotation dim (#66262626) is not rendered by the stock html — skip it.
// A full-page mask Image IS rendered (it dims the app behind a modal), but modal nodes
// (octoName 弹窗 / 对话框) are raised into the floating layer so the mask never covers
// them — that is how the design's own screenshot composites (backdrop dimmed, dialog
// bright). The modal rule must not apply to the page root (its name contains 弹窗 too).
function isOverlay(n, s, bbox) {
  return bbox && bbox[0] <= 0 && bbox[1] <= 0 && bbox[2] >= PAGE_W - 1 && bbox[3] >= PAGE_H - 1 &&
    (s.backgroundColor || '').toUpperCase() === '#66262626';
}
// end-anchored: the modal containers are named 弹窗 / 深色模式/弹窗, while the mask is
// 弹窗遮罩/Dark — it must stay below the modal, so it must not match here
const MODAL_RE = /(弹窗|对话框)$/;
// Floating UI paints above the app (and above the chart axis texts it overlaps).
const FLOATING = new Set(['文字标注', '提示悬浮', '深色模式/下拉菜单 面板', '报告统计', '滚动条', '顶部菜单栏', '底部栏/Dark', '菜单']);
let currentLayer = 'app';
// Intrinsic raster size (PNG IHDR / SVG width+height) — used to decide fill vs natural.
function intrinsicSize(absPath) {
  try {
    const buf = readFileSync(absPath);
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
// 蒙版 (mask) groups hold both the invisible mask backdrop (an opaque fill rectangle,
// e.g. #C4C4C4 — the stock html never draws it) and real visible content (code lines,
// chips, translucent highlight bars; or whole chart viewports in the zoom screens).
// Rule: inside a 蒙版 whose subtree has no images, skip only the opaque leaf fills;
// everything else renders normally.
function subtreeHasImage(n) {
  let hasImage = false;
  (function scan(x) {
    if (!x || typeof x !== 'object' || hasImage) return;
    if (x.src) { hasImage = true; return; }
    for (const c of x.children || []) scan(c);
  })(n);
  return hasImage;
}
function isOpaqueFill(n) {
  if (n.src || typeof n.content === 'string') return false;
  if ((n.children || []).length) return false;
  const bg = (n.styles || {}).backgroundColor;
  if (!bg) return false;
  const h = bg.replace('#', '');
  if (h.length === 8) return parseInt(h.slice(0, 2), 16) === 255;
  return h.length === 6;
}
function walk(n, layer, texts, clips, parentOp, inMask = false) {
  if (!n || typeof n !== 'object') return;
  if (n.meta?.octoName === '蒙版') inMask = !subtreeHasImage(n);
  else if (inMask && isOpaqueFill(n)) return;
  const s = n.styles || {};
  const m = n.meta || {};
  if (FLOATING.has(m.octoName) || (n !== dsl.ui && MODAL_RE.test(m.octoName || ''))) layer = 'float';
  if (m.bbox && !isOverlay(n, s, m.bbox)) {
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
      // a full-page mask image carries its own alpha; its export background would
      // double-darken the backdrop (measured 8 vs the design's 22 on 930 dialogs)
      const isMaskImage = n.componentName === 'Image' && n.src && safeSrc(n.src) && m.bbox &&
        m.bbox[0] <= 0 && m.bbox[1] <= 0 && m.bbox[2] >= PAGE_W - 1 && m.bbox[3] >= PAGE_H - 1;
      if (s.backgroundColor && !isMaskImage) css.push(`background-color:${dslColor(s.backgroundColor)}`);
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
        const lineH = s.lineHeight ?? s.fontSize ?? 12;
        const boxH = s.height ?? y2 - y1;
        // The stock html wraps only when the box is taller than one line (height >
        // lineHeight ⇒ pre-wrap + word-break, like the export); a single-line box uses
        // pre so a too-narrow bbox never reflows the text.
        const wraps = boxH > lineH + 1;
        css.push(
          `font-size:${s.fontSize ?? 12}px`,
          `color:${dslColor(s.fontColor) ?? '#fff'}`,
          `font-weight:${s.fontWeight ?? 400}`,
          `line-height:${lineH}px`,
          `text-align:${String(s.textAlign ?? 'start').toLowerCase()}`,
          `white-space:${wraps ? 'pre-wrap' : 'pre'}`,
        );
        if (wraps) css.push(`word-break:break-word`);
        if (s.verticalAlign && s.verticalAlign !== 'Top') css.push(`display:flex`, `align-items:${enumVal[s.verticalAlign] ?? 'flex-start'}`);
        out.push(`<div style="${escAttr(css.join(';'))}">${n.content.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`);
      } else if (n.componentName === 'Image' && n.src) {
        const abs = safeSrc(n.src);
        if (abs) {
          const [iw, ih] = intrinsicSize(abs) || [null, null];
          if (iw && ih && iw < (x2 - x1) / 2 && ih < (y2 - y1) / 2) {
            // tiny raster tile in a large box: natural size, centered, no-repeat (stock does this)
            css.push(
              `background-image:url(${JSON.stringify(n.src)})`,
              `background-repeat:no-repeat`,
              `background-position:center`,
              `background-size:auto`,
            );
            out.push(`<div style="${escAttr(css.join(';'))}"></div>`);
          } else {
            css.push(`object-fit:fill`);
            out.push(`<img style="${escAttr(css.join(';'))}" src="${escAttr(n.src)}" />`);
          }
        } else {
          // asset outside the design root (or an unsafe URL): keep the box, never load it
          out.push(`<div style="${escAttr(css.join(';'))}"></div>`);
        }
      } else {
        out.push(`<div style="${escAttr(css.join(';'))}"></div>`);
      }
      }
    }
  }
  // rounded containers clip their descendants (flat DOM loses overflow clipping)
  const childClips = hasRadius(s) && m.bbox ? [...clips, m.bbox] : clips;
  for (const c of n.children || []) walk(c, layer, texts, childClips, parentOp * (s.opacity ?? 1), inMask);
}
// Four passes: app shapes < app texts < floating shapes < floating texts.
for (const layer of ['app', 'float']) {
  currentLayer = layer;
  walk(dsl.ui, 'app', false, [], 1);
  walk(dsl.ui, 'app', true, [], 1);
}

const W = PAGE_W, H = PAGE_H;
// the icon font is optional (the sanitizer drops it when no text uses its glyphs)
const iconFont = `${base}../_shared/fonts/HMSymbolVF.ttf`;
const iconFace = existsSync(iconFont)
  ? "@font-face { font-family: 'HMSymbolVF'; src: url('../_shared/fonts/HMSymbolVF.ttf') format('truetype'); }\n"
  : '';
const html = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file: data:; font-src file:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none'">
<style>
@font-face { font-family: 'HarmonyOS Sans SC'; src: url('../_shared/fonts/HarmonyOS_Sans_SC_Medium.woff2') format('woff2'); }
${iconFace}* { box-sizing: border-box; margin: 0; padding: 0; }
html { overflow: hidden; }
body { width: ${W}px; height: ${H}px; background: #16181A; font-family: 'HarmonyOS Sans SC', sans-serif; position: relative; overflow: hidden; }
</style></head><body>${out.join('\n')}</body></html>`;
writeFileSync(base + '_rebuilt.html', html);
console.log(`rendered: ${rendered} / nodes in dsl: ${out.length}`);
