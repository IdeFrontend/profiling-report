/**
 * Sudu-inspired coverage-AA swimlane shaders (reimplemented in TS; no sudu-editor dep).
 * Coordinates in device pixels; uResolution is the framebuffer size.
 * No uDpr — CSS↔device conversion happens in JS before uniforms.
 * Interim: hard-rect Y bounds (no round-rect); analytical horizontal coverage from sudu.
 */

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
  float rawL = glToPixelX(translateScaleX(lX));
  float rawR = glToPixelX(translateScaleX(rX));
  // True fractional edges with 0.5 device-px inset per side → 1 device-px gap.
  float lPx = rawL + 0.5;
  float rPx = rawR - 0.5;
  if (rPx <= lPx) {
    lPx = rawL;
    rPx = max(rawR, rawL + 1.0e-4);
  }

  float screenY = glToPixelY(pos.y);
  // Expand to pixel bounds that overlap the (possibly inset) interval — sudu floor/ceil.
  float screenX = mix(floor(lPx), ceil(rPx), aTex.y);
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

in vec2 vScreenPos;
in vec2 vLrScreen;
out vec4 outColor;

void main() {
  // Sudu: lPx/rPx = event left/right inside the current device pixel.
  float lPx = max(vLrScreen.x, vScreenPos.x - 0.5);
  float rPx = min(vLrScreen.y, vScreenPos.x + 0.5);
  float inside = rPx - lPx;
  // Hard Y clip (round-rect deferred); premul source-over (not sudu additive a=1).
  float t = uYBounds.x;
  float b = uYBounds.y;
  float yOk = step(t, vScreenPos.y) * step(vScreenPos.y, b);
  float cov = inside * yOk;
  outColor = vec4(uColor.xyz * cov, uColor.w * cov);
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

/** Instanced cubic stroke in device pixels; uHalfWidth is device px. */
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
