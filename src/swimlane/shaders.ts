/**
 * Swimlane interval shaders from sudu-editor
 * (`demo-test-scenes/.../swimlane/SwimlaneShader.java`).
 *
 * VS matches sudu (floor/ceil horizontal edge snap). FS is hardened: sudu's
 * `rgb × inside` coverage with alpha=1 reads as two dim semi-tone edge lines under
 * source-over blend; geometry already snaps to pixels so FS outputs solid fill.
 */

export const SWIMLANE_VS = `#version 300 es
precision highp float;
vec2 pixelPos(vec2 pos, vec2 resolution) { return vec2((pos.x + 1.0) * 0.5 * resolution.x, (1.0 - pos.y) * 0.5 * resolution.y); }

uniform vec4 uSizePos;
uniform vec2 uResolution;
uniform vec2 uParameters;
in vec2 vPos, vTex;
out vec2 screenPos;
out vec2 lrScreen;

float translateScaleX(float x) { return x * uSizePos.x + uSizePos.z; }
float translateScaleY(float y) { return y * uSizePos.y + uSizePos.w; }

float glToPixelX(float x) { return (x + 1.0) * 0.5 * uResolution.x; }
float glToPixelY(float y) { return (1.0 - y) * 0.5 * uResolution.y; }
float pixelToGlX(float x) { return x * 2.0 / uResolution.x - 1.0; }
float pixelToGlY(float y) { return 1.0 - y * 2.0 / uResolution.y; }

vec2 glToPixel(vec2 gl) { return vec2(glToPixelX(gl.x), glToPixelY(gl.y)); }
vec2 pixelToGl(vec2 px) { return vec2(pixelToGlX(px.x), pixelToGlY(px.y)); }

void main() {
  float lX = mix(vPos.x, vTex.x, vTex.y);
  float rX = mix(vTex.x, vPos.x, vTex.y);

  vec2 pos = vec2(translateScaleX(vPos.x), translateScaleY(vPos.y));
  float lPx = glToPixelX(translateScaleX(lX));
  float rPx = glToPixelX(translateScaleX(rX));

  float screenX = glToPixelX(pos.x);
  float screenY = glToPixelY(pos.y);

  // extend left/right edge to left/right pixel bound
  screenX = mix(floor(screenX), ceil(screenX), vTex.y);
  // convert back to gl space
  pos.x = pixelToGlX(screenX);

  screenPos = vec2(screenX, screenY);
  lrScreen = vec2(floor(lPx + 0.5), ceil(rPx - 0.5));
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

export const SWIMLANE_FS = `#version 300 es
precision highp float;

layout(location = 0) out vec4 outColor;
uniform vec4 uColor;
in vec2 screenPos;
in vec2 lrScreen;
void main() {
  // VS snaps geometry to pixel bounds; solid fill avoids sudu FS coverage dimming
  // (rgb*inside, a=1) which shows as two semi-tone edge lines with source-over.
  if (screenPos.x < lrScreen.x || screenPos.x >= lrScreen.y) discard;
  outColor = vec4(uColor.xyz, 1.0);
}
`;
