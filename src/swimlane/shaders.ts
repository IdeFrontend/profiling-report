/**
 * Sudu-inspired coverage-AA swimlane shaders (reimplemented in TS; no sudu-editor dep).
 * VS snaps interval edges to the device-pixel grid; FS uses a rounded-rect SDF with
 * device-pixel coverage so fractional browser zoom stays crisp.
 */

export const SWIMLANE_VS = `#version 300 es
precision highp float;

uniform vec4 uSizePos;
uniform vec2 uResolution;
uniform float uDpr;

in vec2 aPos;
in vec2 aTex;

out vec2 vScreenPos;
out vec2 vLrScreen;

float translateScaleX(float x) { return x * uSizePos.x + uSizePos.z; }
float translateScaleY(float y) { return y * uSizePos.y + uSizePos.w; }
float glToPixelX(float x) { return (x + 1.0) * 0.5 * uResolution.x; }
float glToPixelY(float y) { return (1.0 - y) * 0.5 * uResolution.y; }
float pixelToGlX(float x) { return x * 2.0 / uResolution.x - 1.0; }

// Snap CSS px onto the device-pixel grid (matches snapCssPx in layout.ts).
float snapDev(float css) { return floor(css * uDpr + 0.5) / uDpr; }

void main() {
  float lX = mix(aPos.x, aTex.x, aTex.y);
  float rX = mix(aTex.x, aPos.x, aTex.y);

  vec2 pos = vec2(translateScaleX(aPos.x), translateScaleY(aPos.y));
  float lPx = snapDev(glToPixelX(translateScaleX(lX)));
  float rPx = snapDev(glToPixelX(translateScaleX(rX)));
  // 1 device-px gap after the right edge so abutting intervals do not fuse visually.
  rPx = max(lPx + 1.0 / uDpr, rPx - 1.0 / uDpr);

  float screenY = glToPixelY(pos.y);
  float screenX = mix(lPx, rPx, aTex.y);
  pos.x = pixelToGlX(screenX);

  vScreenPos = vec2(screenX, screenY);
  vLrScreen = vec2(lPx, rPx);
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

export const SWIMLANE_FS = `#version 300 es
precision highp float;

uniform vec4 uColor;
uniform vec2 uYBounds; // top, bottom in CSS pixels (device-snapped)
uniform float uDpr;

in vec2 vScreenPos;
in vec2 vLrScreen;
out vec4 outColor;

// Rounded-box SDF (Inigo Quilez). Negative = inside.
float sdRoundBox(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  float l = vLrScreen.x;
  float r = vLrScreen.y;
  float t = uYBounds.x;
  float b = uYBounds.y;
  float w = max(r - l, 0.0);
  float h = max(b - t, 0.0);
  // Width-dependent corner radius, matching eventRadius in layout.ts: <4px -> 1px, else 2px.
  float rad = min(w < 4.0 ? 1.0 : 2.0, min(w, h) * 0.5);

  vec2 center = vec2((l + r) * 0.5, (t + b) * 0.5);
  vec2 halfSize = vec2(w * 0.5, h * 0.5);
  float dist = sdRoundBox(vScreenPos - center, halfSize, rad);

  // Coverage in device pixels (~0.5 device px fringe) so fractional dpr stays sharp.
  float coverage = clamp(0.5 - dist * uDpr, 0.0, 1.0);
  // Premultiplied RGB + alpha: uColor.xyz is already RGB*emphasis, uColor.w is
  // Canvas-equivalent globalAlpha (search/selection dim). Coverage AA on top.
  float a = uColor.w * coverage;
  outColor = vec4(uColor.xyz * coverage, a);
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

/** Textured quad for label sprites (Sudu Text0 / TextClearType). */
export const TEXT_VS = `#version 300 es
precision highp float;
uniform vec4 uSizePos;
in vec2 aPos;
in vec2 aTex;
out vec2 vUV;
void main() {
  vec2 pos = vec2(aPos.x * uSizePos.x + uSizePos.z, aPos.y * uSizePos.y + uSizePos.w);
  vUV = aTex;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

/** Sudu psCodeTextClearType — RGB LCD coverage × pow, mix(bg, fg). Opaque out. */
export const TEXT_CT_FS = `#version 300 es
precision highp float;
uniform vec4 uColor;
uniform vec4 uBgColor;
uniform float uTextPow;
uniform sampler2D sDiffuse;
in vec2 vUV;
out vec4 outColor;
void main() {
  vec3 textRGB = texture(sDiffuse, vUV).rgb;
  vec3 textRGBp = vec3(
    pow(textRGB.x, uTextPow),
    pow(textRGB.y, uTextPow),
    pow(textRGB.z, uTextPow));
  outColor = vec4(mix(uBgColor.rgb, uColor.rgb, textRGBp), 1.0);
}
`;

/** Sudu psCodeText — grayscale/alpha coverage × pow, mix(bg, fg). */
export const TEXT_GRAY_FS = `#version 300 es
precision highp float;
uniform vec4 uColor;
uniform vec4 uBgColor;
uniform float uTextPow;
uniform sampler2D sDiffuse;
in vec2 vUV;
out vec4 outColor;
void main() {
  float t = texture(sDiffuse, vUV).a;
  float text = pow(t, uTextPow);
  outColor = mix(uBgColor, uColor, text);
}
`;

/** Instanced cubic stroke: VS evaluates the same S-curve as cubicControlPull, extrudes a 2px strip. */
export const CURVE_VS = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec3 uView; // start/end relative to model.minTime, scrollY
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
