/**
 * Sudu-inspired coverage-AA swimlane shaders (reimplemented in TS; no sudu-editor dep).
 * Coordinates in device pixels; uResolution is the framebuffer size.
 * No uDpr — CSS↔device conversion happens in JS before uniforms.
 * Analytical horizontal coverage (sudu) combined with SDF round-rect shape using min (Canvas radius parity).
 */

/**
 * Rounded-rect corner policy, in CSS px (single source of truth shared with the Canvas renderer):
 * an event gets minRR corner radius when its raw width (CSS px) is < rrSwitchThreshold, else maxRR.
 * Host code multiplies these by dpr and uploads them to the swim fragment shader's single `uRR`
 * vec3 uniform: the painted radii (minRR/maxRR) round to integer device px via `((x+0.5)|0)`,
 * while the switch threshold stays the exact float `rrSwitchThreshold * dpr`.
 */
export const minRR = 1;
export const maxRR = 2;
export const rrSwitchThreshold = 4;

/**
 * Isolated-event extension policy, in CSS px (single source of truth shared with the swim vertex
 * shader's `uExtendParameters` vec3 uniform): an event narrower than `extendTargetSizeCss` is
 * grown toward that target width, ramping in via per-side gap factors; no extension below
 * `extendMargin1Css`, full extension at/above `extendMargin2Css`.
 */
export const extendTargetSizeCss = 1;
export const extendMargin1Css = 2;
export const extendMargin2Css = 4;

/**
 * Tick density ladder (PR-EXPERIMENT), in DEVICE px: the inter-tick gap at which one tick
 * contributes alpha 1. Alpha = clamp(gap / g0), so a uniformly covered column converges to a
 * zoom-invariant plateau `1 - e^(-1/g0)` (no overflow), while separated ticks brighten toward
 * full as they pull apart. At equal spacing 2 ticks in a pixel are still brighter than 1.
 *
 * g0 = 0.75 px -> dense plateau ~0.74 (188 of 255), a tick ~0.75 px from its neighbour is full.
 * Smaller g0 -> brighter dense bands and a shorter distance to full brightness.
 */
export const tickGap0DevicePx = 0.75;

/**
 * Odd stripe multiplier for the Canvas thin-tick density alternate (matches
 * `TICK_ALTERNATE_FACTOR` in layout.ts). Canvas-only now: the WebGL pass encodes density
 * in alpha (no stipple), so this constant no longer reaches the swimlane shader.
 */
export const thinEventAlternateFactor = 0.4;

/** Scale a CSS-px corner/width value to integer device px: `* dpr`, then round `((x+0.5)|0)`. */
export function rrToDevicePx(cssPx: number, dpr: number): number {
  return (cssPx * dpr + 0.5) | 0;
}

export const SWIMLANE_VS = `#version 300 es
precision highp float;

uniform vec4 uSizePos;
uniform vec2 uResolution;
uniform vec3 uExtendParameters; // xyz = targetSize, margin1, margin2, all in device px (CSS px × dpr); targetSize 0 disables

in vec2 aPos;
in vec2 aTex;
in vec2 aData; // x = distance to prev event end, y = distance to next event start (event coords)

uniform float uTickGap0; // device px: inter-tick gap at which a tick contributes alpha 1

out vec2 vScreenPos;
out vec2 vLrScreen;
out float vTick; // 1.0 = zero-duration tick quad, 0.0 = durable interval
out float vTickA; // density alpha for ticks (unused when vTick == 0)

float translateScaleX(float x) { return x * uSizePos.x + uSizePos.z; }
float translateScaleY(float y) { return y * uSizePos.y + uSizePos.w; }
float glToPixelX(float x) { return (x + 1.0) * 0.5 * uResolution.x; }
float glToPixelY(float y) { return (1.0 - y) * 0.5 * uResolution.y; }
float pixelToGlX(float x) { return x * 2.0 / uResolution.x - 1.0; }

void main() {
  float lX = mix(aPos.x, aTex.x, aTex.y);
  float rX = mix(aTex.x, aPos.x, aTex.y);

  vec2 pos = vec2(translateScaleX(aPos.x), translateScaleY(aPos.y));
  // Exact event edges in device pixels — must reach every fragment via vLrScreen.
  float lPx = glToPixelX(translateScaleX(lX));
  float rPx = glToPixelX(translateScaleX(rX));

  // Gap to prev event end / next event start, in device pixels (distances, not positions,
  // so scale only — no translation, no clip-space offset).
  float gapPrevPx = aData.x * uSizePos.x * 0.5 * uResolution.x;
  float gapNextPx = aData.y * uSizePos.x * 0.5 * uResolution.x;

  // Branchless smooth extension of isolated thin events; parameters are a uniform
  // (targetSize, margin1, margin2 — device px = CSS px × dpr; targetSize 0 disables).
  float targetSize = uExtendParameters.x;
  float margin1 = uExtendParameters.y;
  float margin2 = uExtendParameters.z;
  float eventSize = rPx - lPx;
  float extendMax = max(0.0, (targetSize - eventSize) * 0.5);
  float factorL = clamp(
    (gapPrevPx - margin1) / (margin2 - margin1), 0.0, 1.0);
  float factorR = clamp(
    (gapNextPx - margin1) / (margin2 - margin1), 0.0, 1.0);
  // Per-side extension: each edge grows only as far as its own gap allows (no averaging,
  // so a tight neighbour is never encroached on).
  float extendedL = lPx - extendMax * factorL;
  float extendedR = rPx + extendMax * factorR;

  // Zero-duration ticks: alpha scales with the local inter-tick gap (no lower clamp at 0).
  // A uniformly covered column converges to 1 - e^(-1/g0) at any zoom (no overflow); ticks that
  // separate brighten toward full, so mid-zoom does not fall into a dim band. At equal spacing
  // N ticks in one pixel still accumulate 1-(1-alpha)^N (2 > 1, 3 > 2, smaller step).
  vTick = (rPx - lPx) <= 0.001 ? 1.0 : 0.0;
  float gapAvgPx = (gapPrevPx + gapNextPx) * 0.5;
  vTickA = clamp(gapAvgPx / max(uTickGap0, 0.05), 0.0, 1.0);

  float screenY = glToPixelY(pos.y);
  // [exp] geometry no longer encodes tick density: a duration-0 tick paints exactly one device
  // column centred on its timestamp; durables keep the exact extended span (+1 col if degenerate).
  float screenL = floor(extendedL);
  float screenR = ceil(extendedR);
  if (vTick > 0.5) {
    float tickC = (lPx + rPx) * 0.5;
    screenL = tickC - 0.5;
    screenR = tickC + 0.5;
  } else if (screenR <= screenL) {
    screenR = screenL + 1.0;
  }
  float screenX = mix(screenL, screenR, aTex.y);
  pos.x = pixelToGlX(screenX);


  vScreenPos = vec2(screenX, screenY);
  // Ticks: the snapped column is also their coverage (cov ~ 1 in that pixel). Durables: exact edges.
  vLrScreen = vTick > 0.5 ? vec2(screenL, screenR) : vec2(extendedL, extendedR);
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

export const SWIMLANE_FS = `#version 300 es
precision highp float;

uniform vec4 uColor;
uniform vec2 uYBounds; // top, bottom in device pixels (integer-snapped)
uniform vec3 uRR; // xy = min/max painted radii (device px, rounded in JS); z = exact switch threshold × dpr
uniform float uSrcOver; // 1.0 = premultiplied source-over (summary bars); 0.0 = additive (events)

in vec2 vScreenPos;
in vec2 vLrScreen;
in float vTick;
in float vTickA;
out vec4 outColor;

float sdRoundBox(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  float l = vLrScreen.x;
  float r = vLrScreen.y;
  
  // Sudu: lPx/rPx = event left/right inside the current device pixel.
  float lPx = max(l, vScreenPos.x - 0.5);
  float rPx = min(r, vScreenPos.x + 0.5);
  // compute precise event coverage
  float hCoverage = rPx - lPx;

  float t = uYBounds.x;
  float b = uYBounds.y;
  float w = max(r - l, 0.0);
  float h = max(b - t, 0.0);
  float rawW = r - l;
  // Corner policy is CSS-px; uRR carries the device-px threshold so the comparison holds at any dpr.
  float rad = min(min(w, h) * 0.5, rawW < uRR.z ? uRR.x : uRR.y);

  vec2 center = vec2((l + r) * 0.5, (t + b) * 0.5);
  vec2 halfSize = vec2(w * 0.5, h * 0.5);
  float dist = sdRoundBox(vScreenPos - center, halfSize, rad);
  float rrShape = clamp(0.5 - dist, 0.0, 1.0);
  // [exp] count-hit revert: old shader - analytical length AA for every quad.
  float cov = min(hCoverage, rrShape);
  // [exp] tick ladder: premultiplied output, one blend func for the whole interval pass
  // (ONE, ONE_MINUS_SRC_ALPHA). Durables emit alpha 0 -> the blend degenerates to additive.
  // Ticks emit alpha = c*cov -> overlaps accumulate source-over, converging to the lane
  // colour (never white) with a gap-driven ladder: 1-(1-c)^N.
  float tickK = vTick * vTickA; // 0 for durables
  float rgbK = uSrcOver > 0.5 ? cov : cov * mix(1.0, uColor.a * tickK, vTick);
  float alpha = uSrcOver > 0.5 ? uColor.a * cov : uColor.a * tickK * cov;
  outColor = vec4(uColor.xyz * rgbK, alpha);
}
`;

/** Simple solid fill for lane backgrounds / header (no coverage). */
export const SOLID_VS = `#version 300 es
precision highp float;
uniform vec4 uSizePos;
in vec2 aPos;
void main() {
  vec2 pos = vec2(aPos.x * uSizePos.x + uSizePos.z, aPos.y * uSizePos.y + uSizePos.w);
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

export const SOLID_FS = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 outColor;
void main() {
  outColor = uColor;
}
`;

/** Instanced cubic stroke in device pixels; uHalfWidth is device px (`dependencyStrokeWidth(dpr) / 2`, so full width = 2 CSS px). */
export const CURVE_VS = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec3 uView; // start/end relative to model.minTime, scrollY in device px
uniform float uHalfWidth;

layout(location = 0) in vec2 aStrip;
layout(location = 1) in vec2 aEnd0;
layout(location = 2) in vec2 aEnd1;
layout(location = 3) in vec3 aC0;
layout(location = 4) in vec3 aC1;

out vec3 vColor;
out float vSide;

void main() {
  float span = max(uView.y - uView.x, 1.0);
  vec2 p0 = vec2((aEnd0.x - uView.x) / span * uResolution.x, aEnd0.y - uView.z);
  vec2 p1 = vec2((aEnd1.x - uView.x) / span * uResolution.x, aEnd1.y - uView.z);
  float mag = max(24.0, abs(p1.x - p0.x) * 0.4);
  float pull = p1.x >= p0.x ? mag : -mag;
  vec2 c0 = vec2(p0.x + pull, p0.y);
  vec2 c1 = vec2(p1.x - pull, p1.y);
  float t = aStrip.x;
  float u = 1.0 - t;
  vec2 p = u * u * u * p0 + 3.0 * u * u * t * c0 + 3.0 * u * t * t * c1 + t * t * t * p1;
  vec2 dp = 3.0 * u * u * (c0 - p0) + 6.0 * u * t * (c1 - c0) + 3.0 * t * t * (p1 - c1);
  float dpLen = length(dp);
  vec2 n = dpLen > 1e-4 ? vec2(-dp.y, dp.x) / dpLen : vec2(0.0, 1.0);
  vec2 pos = p + n * aStrip.y * uHalfWidth;
  gl_Position = vec4(pos.x / uResolution.x * 2.0 - 1.0, 1.0 - pos.y / uResolution.y * 2.0, 0.0, 1.0);
  vColor = mix(aC0, aC1, t);
  vSide = aStrip.y;
}
`;

export const CURVE_FS = `#version 300 es
precision highp float;
in vec3 vColor;
in float vSide;
out vec4 outColor;
void main() {
  float a = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
  outColor = vec4(vColor * a, a);
}
`;

/**
 * Sudu text pipeline (ported from sudu-editor Shaders.java).
 * ClearType reads per-subpixel RGB coverage, mixes uBgColor → uColor with a pow-gamma,
 * and outputs alpha = 1.0 (opaque): the label background is baked in, so callers must pass
 * the exact solid backdrop color.
 */

/** Gamma correction tuned so WebGL re-color matches the Windows D2D reference. */
export const CLEARTYPE_TEXT_POW = 2.25;

/** Textured-quad VS: aPos local −1..1 → clip space via uSizePos; aTex → textureUV. */
export const TEXT_VS = `#version 300 es
precision highp float;
uniform vec4 uSizePos;
in vec2 aPos;
in vec2 aTex;
out vec2 textureUV;
void main() {
  vec2 pos = vec2(aPos.x * uSizePos.x + uSizePos.z, aPos.y * uSizePos.y + uSizePos.w);
  textureUV = aTex;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

/** ClearType text: per-subpixel RGB coverage, per-channel pow-gamma, mix bg→fg (alpha = 1). */
export const TEXT_CLEARTYPE_FS = `#version 300 es
precision highp float;
uniform vec4 uColor;
uniform vec4 uBgColor;
uniform vec2 uTextPow;
uniform sampler2D sDiffuse;
in vec2 textureUV;
out vec4 outColor;
void main() {
  vec3 textRGB = texture(sDiffuse, textureUV).rgb;
  vec3 textRGBp = vec3(
    pow(textRGB.x, uTextPow.x),
    pow(textRGB.y, uTextPow.x),
    pow(textRGB.z, uTextPow.x));
  vec3 mixColor = mix(uBgColor.rgb, uColor.rgb, textRGBp);
  outColor = vec4(mixColor, 1.0);
}
`;
