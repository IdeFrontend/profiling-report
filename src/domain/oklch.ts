/**
 * OKLCH ⇄ sRGB, so interaction states can be perceptual offsets from a base fill.
 *
 * Björn Ottosson's OKLab matrices (https://bottosson.github.io/posts/oklab/). Worth the
 * arithmetic rather than blending toward white in sRGB — which is what this replaces —
 * because `L` is perceptually uniform: one `+0.14` is the same apparent step on every
 * lane colour, where an sRGB blend lifts the dark greens far more than the oranges.
 *
 * Not delegated to CSS `oklch(from …)`, which computes the identical thing in one line,
 * because event fills are painted into a canvas (and in the WebGL path, a vertex
 * attribute) where there is no element to read a computed style back from.
 */

export interface Oklch {
  /** Perceptual lightness, 0 (black) … 1 (white). */
  L: number;
  /** Chroma, 0 (grey) upward; the sRGB gamut runs out somewhere around 0.33. */
  C: number;
  /** Hue angle in radians. Meaningless at C = 0, and preserved rather than normalised. */
  h: number;
}

const HEX6 = /^#[0-9a-f]{6}$/i;

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** `#rrggbb` → OKLCH, or null if the string is not a 6-digit hex colour. */
export function hexToOklch(hex: string): Oklch | null {
  if (!HEX6.test(hex)) return null;
  const n = Number.parseInt(hex.slice(1), 16);
  const r = srgbToLinear(((n >> 16) & 0xff) / 255);
  const g = srgbToLinear(((n >> 8) & 0xff) / 255);
  const b = srgbToLinear((n & 0xff) / 255);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(a, bb), h: Math.atan2(bb, a) };
}

/** OKLCH → linear sRGB, unclamped: components outside 0…1 mean out of gamut. */
function toLinearRgb(L: number, C: number, h: number): [number, number, number] {
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Under an 8-bit quantum, so we do not hunt for precision the output cannot show. */
const GAMUT_EPS = 0.5 / 255;

function inGamut([r, g, b]: [number, number, number]): boolean {
  return (
    r >= -GAMUT_EPS && r <= 1 + GAMUT_EPS && g >= -GAMUT_EPS && g <= 1 + GAMUT_EPS &&
    b >= -GAMUT_EPS && b <= 1 + GAMUT_EPS
  );
}

/**
 * OKLCH → `#rrggbb`, holding lightness and hue and giving up chroma when the request
 * falls outside sRGB — which lifting a saturated fill by +0.38 routinely does.
 *
 * Per-channel clipping would be shorter, but it slides the hue: clipping blue on an
 * orange leaves the other two untouched and the block drifts yellow, so a lane's colour
 * would stop being recognisable in exactly the state meant to draw the eye to it.
 */
export function oklchToHex({ L, C, h }: Oklch): string {
  const lightness = Math.min(1, Math.max(0, L));
  let rgb = toLinearRgb(lightness, C, h);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = C;
    // 16 halvings takes the interval under an 8-bit quantum for any real chroma.
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(toLinearRgb(lightness, mid, h))) lo = mid;
      else hi = mid;
    }
    rgb = toLinearRgb(lightness, lo, h);
  }
  const byte = (c: number): string =>
    Math.round(Math.min(1, Math.max(0, linearToSrgb(c))) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${byte(rgb[0])}${byte(rgb[1])}${byte(rgb[2])}`;
}
