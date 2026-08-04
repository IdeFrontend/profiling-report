/**
 * Sudu-inspired coverage-AA swimlane shaders (reimplemented in TS; no sudu-editor dep).
 * VS snaps interval edges to pixel bounds; FS multiplies RGB by sub-pixel coverage.
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

  // Extend left/right edge to pixel bounds
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
in vec2 vScreenPos;
in vec2 vLrScreen;
out vec4 outColor;

void main() {
  float lPx = max(vLrScreen.x, vScreenPos.x - 0.5);
  float rPx = min(vLrScreen.y, vScreenPos.x + 0.5);
  float inside = rPx - lPx;
  outColor = vec4(uColor.xyz * inside, 1.0);
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
