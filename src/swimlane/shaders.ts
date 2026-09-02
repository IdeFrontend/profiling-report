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

/** Scale a CSS-px corner/width value to integer device px: `* dpr`, then round `((x+0.5)|0)`. */
export function rrToDevicePx(cssPx: number, dpr: number): number {
  return (cssPx * dpr + 0.5) | 0;
}

export const SWIMLANE_VS = `#version 300 es
precision highp float;

uniform vec4 uSizePos;
uniform vec2 uResolution;

in vec2 aPos;
in vec2 aTex;

out vec2 vScreenPos;
out vec2 vLrScreen;

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

  float screenX = glToPixelX(pos.x);
  float screenY = glToPixelY(pos.y);
  // Extend this vertex's edge to the left/right pixel bound (sudu).
  screenX = mix(floor(screenX), ceil(screenX), aTex.y);
  pos.x = pixelToGlX(screenX);

  vScreenPos = vec2(screenX, screenY);
  vLrScreen = vec2(lPx, rPx);
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

export const SWIMLANE_FS = `#version 300 es
precision highp float;

uniform vec4 uColor;
uniform vec2 uYBounds; // top, bottom in device pixels (integer-snapped)
uniform vec3 uRR; // xy = min/max painted radii (device px, rounded in JS); z = exact switch threshold × dpr

in vec2 vScreenPos;
in vec2 vLrScreen;
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
  // for wide events horizontal event coverage equals to round-rect-coverage on edges 
  // for very thin events round-rect-coverage provide brighter inaccurate results
  // using min
  float cov = min(hCoverage, rrShape);
  // Straight RGB × coverage with constant alpha 1.0: the additive blend (ONE, ONE, ONE, ONE)
  // therefore adds each event's full cov·dim·rgb (SRC_ALPHA ≡ ONE), so pixels accumulate all event
  // coverage across lanes with no quadratic dim.
  outColor = vec4(uColor.xyz * cov, 1.0);
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
