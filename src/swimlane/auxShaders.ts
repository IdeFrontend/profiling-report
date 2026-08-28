/** Profiling-report helpers: lane chrome fills and dependency curve strokes. */

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
