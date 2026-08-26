/**
 * Event-label glyph atlas (Sudu-inspired).
 * - ClearType: opaque canvas `{ alpha: false }` → RGB LCD coverage for WebGL CT shader
 *   (white text on black; Sudu `JsCanvas` cleartype path).
 * - Gray: alpha canvas → colored glyphs for Canvas2D device-pixel blit.
 */

/** CSS px — same as the former overlay `fillText` font. Raster size is `round(10 * dpr)`. */
export const EVENT_LABEL_CSS_PX = 10;
/** Sudu `WebGraphics.cleartypeTextPow`. */
export const CLEARTYPE_TEXT_POW = 2.25;
/** Sudu `WebGraphics.grayscaleTextPow`. */
export const GRAYSCALE_TEXT_POW = 0.625;

const FONT_FAMILY = 'ui-sans-serif, system-ui, sans-serif';
/** Slightly heavier than regular so 10px labels stay readable on colored fills. */
const FONT_WEIGHT = 600;

export type LabelRasterMode = 'cleartype' | 'gray';

export type LabelSprite = {
  canvas: HTMLCanvasElement;
  /** Device-pixel glyph width (including pad). */
  width: number;
  /** Device-pixel glyph height (including pad). */
  height: number;
  mode: LabelRasterMode;
};

export type LabelBlitDest = {
  /** Device-pixel dest x (left of sprite). */
  dx: number;
  /** Device-pixel dest y (top of sprite). */
  dy: number;
  /** Device-pixel clip left within the destination. */
  clipX: number;
  /** Device-pixel clip width. */
  clipW: number;
};

const cache = new Map<string, LabelSprite>();
let cacheDpr = 0;

function fontCss(fontPx: number): string {
  return `${FONT_WEIGHT} ${fontPx}px ${FONT_FAMILY}`;
}

export function clearEventLabelAtlas(): void {
  cache.clear();
  cacheDpr = 0;
}

export function eventLabelDeviceFontPx(dpr: number): number {
  return Math.max(1, Math.round(EVENT_LABEL_CSS_PX * dpr));
}

function cacheKey(name: string, mode: LabelRasterMode, color: string, dpr: number): string {
  // ClearType is always white-on-black coverage; color is applied in the CT shader.
  return mode === 'cleartype'
    ? `ct|${dpr.toFixed(4)}|${name}`
    : `gray|${dpr.toFixed(4)}|${color}|${name}`;
}

/** Integer device-pixel dest + clip. Sprite is centered on `(cx, cy)` CSS. */
export function eventLabelBlitDest(
  cx: number,
  cy: number,
  spriteW: number,
  spriteH: number,
  maxWidth: number,
  dpr: number,
): LabelBlitDest {
  const clipW = Math.max(1, Math.round(maxWidth * dpr));
  return {
    dx: Math.round(cx * dpr - spriteW / 2),
    dy: Math.round(cy * dpr - spriteH / 2),
    clipX: Math.round(cx * dpr - clipW / 2),
    clipW,
  };
}

/**
 * Rasterize a label. ClearType uses an opaque canvas so the browser writes LCD
 * subpixel coverage into RGB (Sudu `JsCanvas` cleartype path).
 */
export function rasterizeEventLabel(
  name: string,
  dpr: number,
  mode: LabelRasterMode = 'gray',
  color = '#ffffff',
): LabelSprite | null {
  if (!name) return null;
  if (dpr !== cacheDpr) {
    cache.clear();
    cacheDpr = dpr;
  }
  const key = cacheKey(name, mode, color, dpr);
  const hit = cache.get(key);
  if (hit) return hit;

  const fontPx = eventLabelDeviceFontPx(dpr);
  const cleartype = mode === 'cleartype';
  const canvas = document.createElement('canvas');
  // Prefer opaque buffer for true LCD RGB; fall back when the env ignores `{ alpha: false }` (jsdom).
  const ctx = cleartype
    ? (canvas.getContext('2d', { alpha: false }) ?? canvas.getContext('2d'))
    : canvas.getContext('2d');
  if (!ctx) return null;

  ctx.font = fontCss(fontPx);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const metrics = ctx.measureText(name);
  const ascent = metrics.actualBoundingBoxAscent || fontPx * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fontPx * 0.2;
  const pad = Math.max(2, Math.ceil(dpr));
  canvas.width = Math.max(1, Math.ceil(metrics.width) + pad * 2);
  canvas.height = Math.max(1, Math.ceil(ascent + descent) + pad * 2);

  // Re-apply after resize (resets state).
  ctx.font = fontCss(fontPx);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (cleartype) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
  }
  ctx.fillText(name, pad, Math.round(pad + ascent));

  const sprite: LabelSprite = {
    canvas,
    width: canvas.width,
    height: canvas.height,
    mode,
  };
  cache.set(key, sprite);
  return sprite;
}

/**
 * Paint a gray (alpha) atlas sprite onto a CSS-transformed 2D context.
 * Dest is snapped to the device-pixel grid so fractional browser zoom stays crisp.
 */
export function blitEventLabelGray(
  ctx: CanvasRenderingContext2D,
  name: string,
  cx: number,
  cy: number,
  maxWidth: number,
  dpr: number,
  alpha = 1,
  color = '#ffffff',
): void {
  const sprite = rasterizeEventLabel(name, dpr, 'gray', color);
  if (!sprite) return;
  const dest = eventLabelBlitDest(cx, cy, sprite.width, sprite.height, maxWidth, dpr);
  const cssW = sprite.width / dpr;
  const cssH = sprite.height / dpr;
  const dxCss = dest.dx / dpr;
  const dyCss = dest.dy / dpr;
  const clipXCss = dest.clipX / dpr;
  const clipWCss = dest.clipW / dpr;

  ctx.save();
  ctx.beginPath();
  ctx.rect(clipXCss, dyCss, clipWCss, cssH);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite.canvas, dxCss, dyCss, cssW, cssH);
  ctx.restore();
}
