/**
 * Sudu-inspired coverage-AA swimlane shaders (reimplemented in TS; no sudu-editor dep).
 * VS snaps interval edges to pixel bounds; FS uses a rounded-rect SDF for coverage.
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
  float lPx = glToPixelX(translateScaleX(lX));
  float rPx = glToPixelX(translateScaleX(rX));

  float screenX = glToPixelX(pos.x);
  float screenY = glToPixelY(pos.y);

  // Extend left/right edge to pixel bounds for AA fringe
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
uniform vec2 uYBounds; // top, bottom in CSS pixels
uniform float uRadius;

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
  float rad = min(uRadius, min(w, h) * 0.5);

  vec2 center = vec2((l + r) * 0.5, (t + b) * 0.5);
  vec2 halfSize = vec2(w * 0.5, h * 0.5);
  float dist = sdRoundBox(vScreenPos - center, halfSize, rad);

  // Approximate pixel coverage from signed distance
  float coverage = clamp(0.5 - dist, 0.0, 1.0);
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
