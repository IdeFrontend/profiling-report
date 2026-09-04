import {
  DEFAULT_DEPENDENCY_DEPTH,
  normalizeDependencyDepth,
  type DependencyMode,
  type SwimEvent,
  type SwimlaneModel,
  type SwimlaneRenderer,
  type SwimlaneViewWindow,
} from '../domain/types';
import {
  EMPTY_LAYOUT,
  LANE_FILL,
  LANE_GROUP_HEADER_FILL,
  LANE_HOVER_FILL,
  LANE_GROUP_HEADER_HEIGHT,
  LANE_HEIGHT,
  MAX_QUADS_PER_MESH,
  contentHeightFromLayout,
  encodeIntervalPair,
  eventBlockMetrics,
  eventEmphasis,
  eventLabelAnchor,
  eventPaintRect,
  eventScreenRect,
  findEvent,
  findLaidOutEvent,
  hexToRgb,
  hitTestLayout,
  rebuildLayout,
  SELECTION_MUTED_FILL,
  SELECTION_MUTED_LABEL,
  snapEventRect,
  type FlatLane,
  type LaidOutEvent,
  type SwimlaneLayout,
} from './layout';
import { dependencyGraph, dependencyStrokeWidth, glLinkTime, type DependencyLink } from './dependencyLinks';
import { CLEARTYPE_TEXT_POW, CURVE_FS, CURVE_VS, SOLID_FS, SOLID_VS, SWIMLANE_FS, SWIMLANE_VS, TEXT_CLEARTYPE_FS, TEXT_VS, minRR, maxRR, rrSwitchThreshold, rrToDevicePx } from './shaders';
import { TextAtlas, EVENT_LABEL_FONT_CSS_PX } from './textAtlas';

interface GlProgram {
  program: WebGLProgram;
  aPos: number;
  aTex: number;
  uSizePos: WebGLUniformLocation;
  uResolution: WebGLUniformLocation | null;
  uColor: WebGLUniformLocation;
  uYBounds: WebGLUniformLocation | null;
  uRR: WebGLUniformLocation | null;
}

interface MeshChunk {
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  ibo: WebGLBuffer;
  indexCount: number;
}

interface EmphasisLayer {
  rgb: [number, number, number];
  dim: number;
  chunks: MeshChunk[];
}

interface CurveProgram {
  program: WebGLProgram;
  uResolution: WebGLUniformLocation;
  uView: WebGLUniformLocation;
  uHalfWidth: WebGLUniformLocation;
}

interface TextProgram {
  program: WebGLProgram;
  uSizePos: WebGLUniformLocation;
  uColor: WebGLUniformLocation;
  uBgColor: WebGLUniformLocation;
  uTextPow: WebGLUniformLocation;
  sDiffuse: WebGLUniformLocation;
}

const CURVE_SEGMENTS = 24;
const CURVE_STRIP_VERTS = (CURVE_SEGMENTS + 1) * 2;
const CURVE_INSTANCE_FLOATS = 10;

interface LaneMeshes {
  color: [number, number, number];
  chunks: MeshChunk[];
  /** When search and/or selection is active: per-emphasis mesh layers (Canvas parity). */
  emphasisLayers: EmphasisLayer[] | null;
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('createShader failed');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? 'compile error';
    gl.deleteShader(sh);
    throw new Error(log);
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): GlProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const program = gl.createProgram();
  if (!program) throw new Error('createProgram failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, 'aPos');
  if (vsSrc.includes('aTex')) gl.bindAttribLocation(program, 1, 'aTex');
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'link error';
    gl.deleteProgram(program);
    throw new Error(log);
  }
  const uSizePos = gl.getUniformLocation(program, 'uSizePos');
  const uColor = gl.getUniformLocation(program, 'uColor');
  if (!uSizePos || !uColor) throw new Error('missing uniforms');
  return {
    program,
    aPos: gl.getAttribLocation(program, 'aPos'),
    aTex: gl.getAttribLocation(program, 'aTex'),
    uSizePos,
    uResolution: gl.getUniformLocation(program, 'uResolution'),
    uColor,
    uYBounds: gl.getUniformLocation(program, 'uYBounds'),
    uRR: gl.getUniformLocation(program, 'uRR'),
  };
}

function linkCurveProgram(gl: WebGL2RenderingContext): CurveProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, CURVE_VS);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, CURVE_FS);
  const program = gl.createProgram();
  if (!program) throw new Error('createProgram failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'link error';
    gl.deleteProgram(program);
    throw new Error(log);
  }
  const uResolution = gl.getUniformLocation(program, 'uResolution');
  const uView = gl.getUniformLocation(program, 'uView');
  const uHalfWidth = gl.getUniformLocation(program, 'uHalfWidth');
  if (!uResolution || !uView || !uHalfWidth) throw new Error('missing curve uniforms');
  return { program, uResolution, uView, uHalfWidth };
}

function linkTextProgram(gl: WebGL2RenderingContext, fsSrc: string): TextProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, TEXT_VS);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const program = gl.createProgram();
  if (!program) throw new Error('createProgram failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.bindAttribLocation(program, 1, 'aTex');
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'link error';
    gl.deleteProgram(program);
    throw new Error(log);
  }
  const uSizePos = gl.getUniformLocation(program, 'uSizePos');
  const uColor = gl.getUniformLocation(program, 'uColor');
  const uBgColor = gl.getUniformLocation(program, 'uBgColor');
  const uTextPow = gl.getUniformLocation(program, 'uTextPow');
  const sDiffuse = gl.getUniformLocation(program, 'sDiffuse');
  if (!uSizePos || !uColor || !uBgColor || !uTextPow || !sDiffuse) {
    throw new Error('missing text uniforms');
  }
  return { program, uSizePos, uColor, uBgColor, uTextPow, sDiffuse };
}

/** Sudu setVbSquare: encode opposite edge in aTex. */
function setVbSquare(p: number, x0: number, x1: number, vb: Float32Array): void {
  // x1,-1, x0,1 | x1,1, x0,1 | x0,-1, x1,0 | x0,1, x1,0
  vb[p] = x1;
  vb[p + 1] = -1;
  vb[p + 2] = x0;
  vb[p + 3] = 1;
  vb[p + 4] = x1;
  vb[p + 5] = 1;
  vb[p + 6] = x0;
  vb[p + 7] = 1;
  vb[p + 8] = x0;
  vb[p + 9] = -1;
  vb[p + 10] = x1;
  vb[p + 11] = 0;
  vb[p + 12] = x0;
  vb[p + 13] = 1;
  vb[p + 14] = x1;
  vb[p + 15] = 0;
}

function createChunk(
  gl: WebGL2RenderingContext,
  pairs: Float32Array,
  pairCount: number,
): MeshChunk {
  const numSquares = Math.min(pairCount, MAX_QUADS_PER_MESH);
  const vb = new Float32Array(numSquares * 16);
  const ib = new Uint16Array(numSquares * 6);
  for (let i = 0; i < numSquares; i++) {
    setVbSquare(i * 16, pairs[i * 2]!, pairs[i * 2 + 1]!, vb);
    const n = i * 4;
    const p = i * 6;
    ib[p] = n;
    ib[p + 1] = n + 1;
    ib[p + 2] = n + 2;
    ib[p + 3] = n + 1;
    ib[p + 4] = n + 2;
    ib[p + 5] = n + 3;
  }

  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  const ibo = gl.createBuffer();
  if (!vao || !vbo || !ibo) throw new Error('buffer alloc failed');

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vb, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ib, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  return { vao, vbo, ibo, indexCount: numSquares * 6 };
}

function createChunksFromPairs(gl: WebGL2RenderingContext, pairs: number[]): MeshChunk[] {
  const chunks: MeshChunk[] = [];
  for (let off = 0; off < pairs.length / 2; off += MAX_QUADS_PER_MESH) {
    const count = Math.min(MAX_QUADS_PER_MESH, pairs.length / 2 - off);
    const slice = new Float32Array(pairs.slice(off * 2, (off + count) * 2));
    chunks.push(createChunk(gl, slice, count));
  }
  return chunks;
}

function createUnitQuad(gl: WebGL2RenderingContext): MeshChunk {
  // Full local rect y∈[-1,1], x∈[-1,1] for solid fills via uSizePos
  const vb = new Float32Array([
    -1, -1, 1, -1, -1, 1, 1, 1,
  ]);
  const ib = new Uint16Array([0, 1, 2, 1, 2, 3]);
  const vao = gl.createVertexArray()!;
  const vbo = gl.createBuffer()!;
  const ibo = gl.createBuffer()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vb, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ib, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, vbo, ibo, indexCount: 6 };
}

/** Textured unit quad (aPos + aTex). V is flipped in UVs (sudu): screen top samples canvas row 0,
 * since the atlas uploads the OffscreenCanvas without UNPACK_FLIP_Y. */
function createTextQuad(gl: WebGL2RenderingContext): MeshChunk {
  const vb = new Float32Array([
    -1, -1, 0, 1, // bottom-left  → v=1 (canvas bottom row)
    1, -1, 1, 1, // bottom-right → v=1
    -1, 1, 0, 0, // top-left     → v=0 (canvas top row)
    1, 1, 1, 0, // top-right    → v=0
  ]);
  const ib = new Uint16Array([0, 1, 2, 1, 2, 3]);
  const vao = gl.createVertexArray()!;
  const vbo = gl.createBuffer()!;
  const ibo = gl.createBuffer()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vb, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ib, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, vbo, ibo, indexCount: 6 };
}

/**
 * WebGL2 coverage-AA interval backend (Sudu-inspired; no sudu-editor dependency).
 * Draws uniform lane backgrounds, row dividers, rounded coverage-AA interval fills, and instanced
 * dependency polylines. Labels/selection use overlay.
 */
export class WebGlSwimlaneRenderer implements SwimlaneRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private swimProg: GlProgram | null = null;
  private solidProg: GlProgram | null = null;
  private curveProg: CurveProgram | null = null;
  private unitQuad: MeshChunk | null = null;
  private textProgCT: TextProgram | null = null;
  private textQuad: MeshChunk | null = null;
  private atlas: TextAtlas | null = null;
  private curveVao: WebGLVertexArrayObject | null = null;
  private curveStripBuf: WebGLBuffer | null = null;
  private curveInstanceBuf: WebGLBuffer | null = null;
  private curveCount = 0;
  /** Bumped in `refreshDepCache`; Playwright reads `data-dep-graph-gen` on the canvas. */
  private depGraphGen = 0;
  private laneMeshes: LaneMeshes[] = [];
  private layout: SwimlaneLayout = EMPTY_LAYOUT;
  private view: SwimlaneViewWindow = { startTime: 0, endTime: 1, scrollY: 0 };
  /** Subtracted from event times before float32 upload (model.minTime). */
  private timeBase = 0;
  private searchQuery = '';
  private selectedId: string | null = null;
  private hoveredLaneId: string | null = null;
  private depMode: DependencyMode = 'all';
  private depDepth = DEFAULT_DEPENDENCY_DEPTH;
  private paintDependencies = true;
  private neighborIds = new Set<string>();
  private depLinks: DependencyLink[] = [];
  private width = 0;
  private height = 0;
  private dpr = 1;

  static isSupported(canvas: HTMLCanvasElement = document.createElement('canvas')): boolean {
    try {
      return Boolean(canvas.getContext('webgl2'));
    } catch {
      return false;
    }
  }

  attach(canvas: HTMLCanvasElement): boolean {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) return false;
    this.canvas = canvas;
    this.gl = gl;
    this.swimProg = linkProgram(gl, SWIMLANE_VS, SWIMLANE_FS);
    this.solidProg = linkProgram(gl, SOLID_VS, SOLID_FS);
    this.curveProg = linkCurveProgram(gl);
    this.unitQuad = createUnitQuad(gl);
    this.initCurveBuffers(gl);
    // ClearType labels are an optional enhancement: degrade to the Canvas2D overlay when the
    // opaque-2D atlas is unavailable or the text program fails to link.
    this.atlas = TextAtlas.isSupported() ? new TextAtlas() : null;
    if (this.atlas) {
      try {
        this.textProgCT = linkTextProgram(gl, TEXT_CLEARTYPE_FS);
        this.textQuad = createTextQuad(gl);
      } catch {
        this.atlas = null;
        this.textProgCT = null;
        this.textQuad = null;
      }
    }
    return true;
  }

  resize(devicePixelWidth: number, devicePixelHeight: number, dpr: number): void {
    const nextDpr = dpr > 0 ? dpr : 1;
    const dprChanged = nextDpr !== this.dpr;
    this.width = Math.max(1, Math.floor(devicePixelWidth));
    this.height = Math.max(1, Math.floor(devicePixelHeight));
    this.dpr = nextDpr;
    const gl = this.gl;
    const canvas = this.canvas;
    if (!gl || !canvas) return;
    canvas.width = this.width;
    canvas.height = this.height;
    gl.viewport(0, 0, this.width, this.height);
    // Curve Y is baked into the instance buffer as `link.y0 * dpr`; re-upload so a browser-zoom
    // dpr change (which also changes scrollY's device-px offset) keeps curves on their anchors.
    if (dprChanged) this.rebuildCurveInstances();
  }

  setModel(model: SwimlaneModel): void {
    this.layout = rebuildLayout(model);
    this.timeBase = model?.minTime ?? 0;
    this.refreshDepCache();
    this.rebuildMeshes();
    this.rebuildCurveInstances();
  }

  setView(view: SwimlaneViewWindow): void {
    this.view = { ...view };
  }

  setSelection(selectedId: string | null, _hoveredId: string | null): void {
    if (selectedId === this.selectedId) return;
    this.selectedId = selectedId;
    this.refreshDepCache();
    this.rebuildEmphasisSplit();
    this.rebuildCurveInstances();
  }

  /** Leaf lane under the pointer — tints that row's background only (AC-07). */
  setHoveredLane(laneId: string | null): void {
    this.hoveredLaneId = laneId;
  }

  setSearchQuery(query: string): void {
    const q = query.trim().toLowerCase();
    if (q === this.searchQuery) return;
    this.searchQuery = q;
    this.rebuildEmphasisSplit();
  }

  setDependencyMode(mode: DependencyMode): void {
    if (mode === this.depMode) return;
    this.depMode = mode;
    this.refreshDepCache();
    this.rebuildEmphasisSplit();
    this.rebuildCurveInstances();
  }

  setDependencyDepth(depth: number): void {
    const d = normalizeDependencyDepth(depth);
    if (d === this.depDepth) return;
    this.depDepth = d;
    this.refreshDepCache();
    this.rebuildEmphasisSplit();
    this.rebuildCurveInstances();
  }

  setPaintDependencies(enabled: boolean): void {
    if (enabled === this.paintDependencies) return;
    this.paintDependencies = enabled;
    this.refreshDepCache();
    this.rebuildEmphasisSplit();
    this.rebuildCurveInstances();
  }

  contentHeight(): number {
    return contentHeightFromLayout(this.layout);
  }

  eventScreenRect(eventId: string): { x: number; y: number; w: number; h: number } | null {
    const item = findLaidOutEvent(this.layout, eventId);
    if (!item) return null;
    return eventScreenRect(item, this.view, this.width, this.dpr);
  }

  hitTest(x: number, y: number): string | null {
    return hitTestLayout(this.layout, this.view, this.width, x, y, this.dpr);
  }

  findEvent(id: string): SwimEvent | null {
    return findEvent(this.layout, id);
  }

  private refreshDepCache(): void {
    this.depGraphGen += 1;
    if (!this.paintDependencies) {
      this.neighborIds = new Set();
      this.depLinks = [];
      return;
    }
    const graph = dependencyGraph(this.layout, this.selectedId, this.depMode, this.depDepth);
    this.neighborIds = graph.ids;
    this.depLinks = graph.links;
  }

  getLayout(): SwimlaneLayout {
    return this.layout;
  }

  getNeighborIds(): Set<string> {
    return this.neighborIds;
  }

  /** True when this backend rasterizes + draws ClearType labels itself (overlay must skip them). */
  hasClearTypeLabels(): boolean {
    return this.atlas != null && this.textProgCT != null && this.textQuad != null;
  }

  render(): void {
    const gl = this.gl;
    const swim = this.swimProg;
    const solid = this.solidProg;
    const unit = this.unitQuad;
    if (!gl || !swim || !solid || !unit) return;

    const devW = this.width;
    const devH = this.height;
    const dpr = this.dpr;

    gl.viewport(0, 0, devW, devH);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0x25 / 255, 0x25 / 255, 0x25 / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Uniform lane chrome + 1px dividers aligned with LaneGutter borders (no blend)
    gl.disable(gl.BLEND);
    gl.useProgram(solid.program);
    const laneBg = hexToRgb(LANE_FILL);
    const laneHoverBg = hexToRgb(LANE_HOVER_FILL);
    const headerBg = hexToRgb(LANE_GROUP_HEADER_FILL);
    const divider = 0x3a / 255;

    for (const header of this.layout.headers) {
      const headerTop = (header.y - this.view.scrollY) * dpr;
      const headerH = LANE_GROUP_HEADER_HEIGHT * dpr;
      if (headerTop + headerH > 0 && headerTop < devH) {
        this.drawSolidRect(solid, unit, 0, headerTop, devW, headerH, headerBg);
        this.drawSolidRect(solid, unit, 0, headerTop + headerH - 1, devW, 1, [
          divider,
          divider,
          divider,
        ]);
      }
    }

    for (let i = 0; i < this.layout.lanes.length; i++) {
      const lane = this.layout.lanes[i]!;
      const y = (lane.y - this.view.scrollY) * dpr;
      const laneH = LANE_HEIGHT * dpr;
      if (y + laneH < 0 || y > devH) continue;
      const bg = lane.thread.id === this.hoveredLaneId ? laneHoverBg : laneBg;
      this.drawSolidRect(solid, unit, 0, y, devW, laneH, bg);
      this.drawSolidRect(solid, unit, 0, y + laneH - 1, devW, 1, [divider, divider, divider]);
    }

    // Coverage-AA intervals (analytical X) — additive (ONE, ONE, ONE, ONE): the FS emits straight
    // RGB × cov with alpha constant 1.0, so SRC_ALPHA ≡ ONE and each event adds full cov·dim·rgb.
    // Safe because events within one lane never nest/intersect (mutually exclusive spans); each
    // device pixel accumulates the coverage of all events across lanes.
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
    gl.useProgram(swim.program);
    if (swim.uResolution) gl.uniform2f(swim.uResolution, devW, devH);
    // Corner policy is CSS px (shaders.minRR/maxRR/rrSwitchThreshold). Painted radii (uRR.xy)
    // scale ×dpr and round to integer device px; the comparison threshold (uRR.z) stays unrounded
    // so the `rawW < 4 CSS px` cutoff matches the true CSS boundary, not a rounded device px.
    if (swim.uRR)
      gl.uniform3f(
        swim.uRR,
        rrToDevicePx(minRR, this.dpr),
        rrToDevicePx(maxRR, this.dpr),
        rrSwitchThreshold * this.dpr,
      );

    const span = Math.max(1, this.view.endTime - this.view.startTime);
    // aPos times are relative to timeBase (see encodeIntervalPair).
    const sx = 2 / span;
    const px = -1 + (2 * (this.timeBase - this.view.startTime)) / span;

    for (let i = 0; i < this.laneMeshes.length; i++) {
      const lane = this.layout.lanes[i];
      const meshes = this.laneMeshes[i];
      if (!lane || !meshes) continue;

      const { y: topRaw, h: bandHRaw } = eventBlockMetrics(lane.y, this.view.scrollY);
      const top = topRaw * dpr;
      const bandH = bandHRaw * dpr;
      const snapped = snapEventRect(0, top, 1, bandH);
      const topSnapped = snapped.y;
      const bandHSnapped = snapped.h;
      if (topSnapped + bandHSnapped < 0 || topSnapped > devH) continue;

      const sy = bandHSnapped / devH;
      const py = 1 - (topSnapped * 2 + bandHSnapped) / devH;

      gl.uniform4f(swim.uSizePos, sx, sy, px, py);
      if (swim.uYBounds) gl.uniform2f(swim.uYBounds, topSnapped, topSnapped + bandHSnapped);

      const drawChunks = (chunks: MeshChunk[], rgb: [number, number, number], dim: number): void => {
        // Premul RGB × dim + alpha dim — matches Canvas globalAlpha on fills.
        gl.uniform4f(swim.uColor, rgb[0] * dim, rgb[1] * dim, rgb[2] * dim, dim);
        for (const chunk of chunks) {
          gl.bindVertexArray(chunk.vao);
          gl.drawElements(gl.TRIANGLES, chunk.indexCount, gl.UNSIGNED_SHORT, 0);
        }
      };

      if (meshes.emphasisLayers) {
        for (const layer of meshes.emphasisLayers) {
          drawChunks(layer.chunks, layer.rgb, layer.dim);
        }
      } else {
        drawChunks(meshes.chunks, meshes.color, 1);
      }
    }

    this.drawEventLabels();

    // Curves draw last, above event labels — re-enable blend (labels render opaque with no blend).
    if (this.paintDependencies) {
      gl.enable(gl.BLEND);
      this.drawDependencyCurves(gl);
    }

    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);

    // Playwright PR-E2E-007: jsdom never reaches render(), so unit tests cannot assert this.
    const out = this.canvas;
    if (out) {
      out.dataset.depCurves = String(this.curveCount);
      out.dataset.depGraphGen = String(this.depGraphGen);
    }
  }

  dispose(): void {
    this.disposeMeshes();
    const gl = this.gl;
    if (gl) {
      if (this.unitQuad) this.deleteChunk(this.unitQuad);
      if (this.curveVao) gl.deleteVertexArray(this.curveVao);
      if (this.curveStripBuf) gl.deleteBuffer(this.curveStripBuf);
      if (this.curveInstanceBuf) gl.deleteBuffer(this.curveInstanceBuf);
      if (this.swimProg) gl.deleteProgram(this.swimProg.program);
      if (this.solidProg) gl.deleteProgram(this.solidProg.program);
      if (this.curveProg) gl.deleteProgram(this.curveProg.program);
      if (this.textProgCT) gl.deleteProgram(this.textProgCT.program);
      if (this.textQuad) this.deleteChunk(this.textQuad);
      this.atlas?.dispose(gl);
    }
    this.unitQuad = null;
    this.curveVao = null;
    this.curveStripBuf = null;
    this.curveInstanceBuf = null;
    this.curveCount = 0;
    this.swimProg = null;
    this.solidProg = null;
    this.curveProg = null;
    this.textProgCT = null;
    this.textQuad = null;
    this.atlas = null;
    this.gl = null;
    this.canvas = null;
    this.layout = EMPTY_LAYOUT;
    this.neighborIds = new Set();
    this.depLinks = [];
  }

  private drawEventLabels(): void {
    const gl = this.gl;
    const prog = this.textProgCT;
    const quad = this.textQuad;
    const atlas = this.atlas;
    if (!gl || !prog || !quad || !atlas) return;

    const devW = this.width;
    const devH = this.height;
    const dpr = this.dpr;
    const span = Math.max(1, this.view.endTime - this.view.startTime);
    const q = this.searchQuery;
    const hasSearch = q.length > 0;
    const hasSelection = this.paintDependencies && this.selectedId != null;
    const bright = this.neighborIds;
    // Lane backgrounds — the event fill composites over these, not the clear color. The
    // hovered row's chrome is `LANE_HOVER_FILL`, so its label backdrop must match that too.
    const laneBg = 0x1f / 255;
    const laneHoverBg = 0x36 / 255;
    const fontPx = Math.max(8, Math.round(EVENT_LABEL_FONT_CSS_PX * dpr));

    gl.disable(gl.BLEND);
    gl.useProgram(prog.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(prog.sDiffuse, 0);
    gl.uniform2f(prog.uTextPow, CLEARTYPE_TEXT_POW, 0);
    gl.enable(gl.SCISSOR_TEST);

    for (const item of this.layout.events) {
      const ev = item.event;
      if (ev.startTime + ev.duration < this.view.startTime || ev.startTime > this.view.endTime) {
        continue;
      }
      const x = ((ev.startTime - this.view.startTime) / span) * devW;
      const w = Math.max(2, (ev.duration / span) * devW);
      const m = eventBlockMetrics(item.y, this.view.scrollY);
      const y = m.y * dpr;
      const h = m.h * dpr;
      if (y + h < 0 || y > devH) continue;
      const r = eventPaintRect(x, y, w, h, dpr);
      const matches = !hasSearch || ev.name.toLowerCase().includes(q);
      if (!matches) continue;
      const { muted } = eventEmphasis(matches, bright.has(item.id), hasSearch, hasSelection);
      const anchor = eventLabelAnchor(r.x, r.w, devW);
      if (!anchor) continue;
      const glyph = atlas.get(gl, ev.name, fontPx, anchor.maxWidth);
      if (!glyph) continue;

      const lane = this.layout.lanes[item.laneIndex];
      if (!lane) continue;
      // ClearType is opaque (alpha = 1), so bake the composited backdrop into uBgColor. The fill
      // pass blends additively (ONE,ONE): a fully covered event pixel is `bg + rgb`, so the
      // label's solid backdrop must use that same formula (clamped) to sit invisibly on the fill.
      // `bg` is the hovered row's chrome when this event's lane is the hovered row; a muted
      // (non-selected, non-neighbor) event swaps in `SELECTION_MUTED_FILL`/`SELECTION_MUTED_LABEL`.
      const [lr, lg, lb] = muted ? hexToRgb(SELECTION_MUTED_FILL) : hexToRgb(lane.color);
      const bg = lane.thread.id === this.hoveredLaneId ? laneHoverBg : laneBg;
      const fr = Math.min(1, bg + lr);
      const fg = Math.min(1, bg + lg);
      const fb = Math.min(1, bg + lb);
      gl.uniform4f(prog.uBgColor, fr, fg, fb, 1);
      if (muted) {
        const [mr, mg, mb] = hexToRgb(SELECTION_MUTED_LABEL);
        gl.uniform4f(prog.uColor, mr, mg, mb, 1);
      } else {
        gl.uniform4f(prog.uColor, 1, 1, 1, 1);
      }

      const cy = r.y + r.h / 2;
      const gx = anchor.cx - glyph.width / 2;
      const gy = cy - glyph.height / 2;
      gl.uniform4f(
        prog.uSizePos,
        glyph.width / devW,
        glyph.height / devH,
        -1 + (2 * gx + glyph.width) / devW,
        1 - (2 * gy + glyph.height) / devH,
      );
      // Clip the opaque label quad to its event's fill rect. WebGL scissor uses bottom-left
      // origin; clamp to the viewport so out-of-range clipped events stay valid.
      const sLeft = Math.max(0, Math.floor(r.x));
      const sTop = Math.max(0, Math.floor(r.y));
      const sRight = Math.min(devW, Math.ceil(r.x + r.w));
      const sBottom = Math.min(devH, Math.ceil(r.y + r.h));
      if (sRight > sLeft && sBottom > sTop) {
        gl.scissor(sLeft, devH - sBottom, sRight - sLeft, sBottom - sTop);
      }
      gl.bindTexture(gl.TEXTURE_2D, glyph.texture);
      gl.bindVertexArray(quad.vao);
      gl.drawElements(gl.TRIANGLES, quad.indexCount, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
    gl.disable(gl.SCISSOR_TEST);
  }

  private drawSolidRect(
    prog: GlProgram,
    unit: MeshChunk,
    x: number,
    y: number,
    w: number,
    h: number,
    rgb: [number, number, number],
  ): void {
    const gl = this.gl!;
    const devW = this.width;
    const devH = this.height;
    const sx = w / devW;
    const sy = h / devH;
    const px = -1 + (2 * x + w) / devW;
    const py = 1 - (2 * y + h) / devH;
    gl.uniform4f(prog.uSizePos, sx, sy, px, py);
    gl.uniform4f(prog.uColor, rgb[0], rgb[1], rgb[2], 1);
    gl.bindVertexArray(unit.vao);
    gl.drawElements(gl.TRIANGLES, unit.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  private rebuildMeshes(): void {
    const gl = this.gl;
    if (!gl) return;
    this.disposeMeshes();

    const byLane = new Map<number, LaidOutEvent[]>();
    for (const ev of this.layout.events) {
      const list = byLane.get(ev.laneIndex) ?? [];
      list.push(ev);
      byLane.set(ev.laneIndex, list);
    }

    this.laneMeshes = this.layout.lanes.map((lane: FlatLane, idx: number) => {
      const events = byLane.get(idx) ?? [];
      const pairs: number[] = [];
      for (const item of events) {
        const [a, b] = encodeIntervalPair(item.event.startTime, item.event.duration, this.timeBase);
        pairs.push(a, b);
      }
      return {
        color: hexToRgb(lane.color),
        chunks: createChunksFromPairs(gl, pairs),
        emphasisLayers: null,
      };
    });
    this.rebuildEmphasisSplit();
  }

  /** Split lane meshes by Canvas-equivalent emphasis (search alpha × selection gray muting). */
  private rebuildEmphasisSplit(): void {
    const gl = this.gl;
    this.disposeEmphasisSplit();
    const q = this.searchQuery;
    const sel = this.selectedId;
    if (!gl || (!q && !sel)) return;

    const hasSearch = q.length > 0;
    const hasSelection = this.paintDependencies && sel != null;
    const bright = this.neighborIds;
    const mutedRgb = hexToRgb(SELECTION_MUTED_FILL);
    const byLane = new Map<number, LaidOutEvent[]>();
    for (const ev of this.layout.events) {
      const list = byLane.get(ev.laneIndex) ?? [];
      list.push(ev);
      byLane.set(ev.laneIndex, list);
    }

    for (let idx = 0; idx < this.laneMeshes.length; idx++) {
      const meshes = this.laneMeshes[idx]!;
      const events = byLane.get(idx) ?? [];
      const byKey = new Map<string, { rgb: [number, number, number]; dim: number; pairs: number[] }>();
      for (const item of events) {
        const matches = !hasSearch || item.event.name.toLowerCase().includes(q);
        const { alpha, muted } = eventEmphasis(matches, bright.has(item.id), hasSearch, hasSelection);
        const rgb = muted ? mutedRgb : meshes.color;
        const key = `${muted ? 1 : 0}|${alpha}`;
        let bucket = byKey.get(key);
        if (!bucket) {
          bucket = { rgb, dim: alpha, pairs: [] };
          byKey.set(key, bucket);
        }
        const [a, b] = encodeIntervalPair(item.event.startTime, item.event.duration, this.timeBase);
        bucket.pairs.push(a, b);
      }
      // Dimmer layers first so full-bright selection/matches paint on top.
      meshes.emphasisLayers = [...byKey.values()]
        .sort((a, b) => a.dim - b.dim)
        .map(({ rgb, dim, pairs }) => ({ rgb, dim, chunks: createChunksFromPairs(gl, pairs) }));
    }
  }

  private disposeEmphasisSplit(): void {
    for (const lane of this.laneMeshes) {
      if (lane.emphasisLayers) {
        for (const layer of lane.emphasisLayers) {
          for (const c of layer.chunks) this.deleteChunk(c);
        }
        lane.emphasisLayers = null;
      }
    }
  }

  private disposeMeshes(): void {
    this.disposeEmphasisSplit();
    for (const lane of this.laneMeshes) {
      for (const c of lane.chunks) this.deleteChunk(c);
    }
    this.laneMeshes = [];
  }

  private initCurveBuffers(gl: WebGL2RenderingContext): void {
    const strip = new Float32Array(CURVE_STRIP_VERTS * 2);
    let p = 0;
    for (let i = 0; i <= CURVE_SEGMENTS; i++) {
      const t = i / CURVE_SEGMENTS;
      strip[p++] = t;
      strip[p++] = -1;
      strip[p++] = t;
      strip[p++] = 1;
    }
    const vao = gl.createVertexArray();
    const stripBuf = gl.createBuffer();
    const instanceBuf = gl.createBuffer();
    if (!vao || !stripBuf || !instanceBuf) throw new Error('curve buffer alloc failed');
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, stripBuf);
    gl.bufferData(gl.ARRAY_BUFFER, strip, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf);
    gl.bufferData(gl.ARRAY_BUFFER, 0, gl.DYNAMIC_DRAW);
    const stride = CURVE_INSTANCE_FLOATS * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 8);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 3, gl.FLOAT, false, stride, 28);
    gl.vertexAttribDivisor(4, 1);
    gl.bindVertexArray(null);
    this.curveVao = vao;
    this.curveStripBuf = stripBuf;
    this.curveInstanceBuf = instanceBuf;
  }

  private rebuildCurveInstances(): void {
    const gl = this.gl;
    const buf = this.curveInstanceBuf;
    if (!gl || !buf) return;
    const links = this.depLinks;
    this.curveCount = links.length;
    const dpr = this.dpr;
    const data = new Float32Array(links.length * CURVE_INSTANCE_FLOATS);
    for (let i = 0; i < links.length; i++) {
      const link = links[i]!;
      const c0 = hexToRgb(link.fromColor);
      const c1 = hexToRgb(link.toColor);
      const o = i * CURVE_INSTANCE_FLOATS;
      data[o] = glLinkTime(link.t0, this.timeBase);
      data[o + 1] = link.y0 * dpr;
      data[o + 2] = glLinkTime(link.t1, this.timeBase);
      data[o + 3] = link.y1 * dpr;
      data[o + 4] = c0[0];
      data[o + 5] = c0[1];
      data[o + 6] = c0[2];
      data[o + 7] = c1[0];
      data[o + 8] = c1[1];
      data[o + 9] = c1[2];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  }

  private drawDependencyCurves(gl: WebGL2RenderingContext): void {
    const prog = this.curveProg;
    const vao = this.curveVao;
    if (!prog || !vao || this.curveCount === 0) return;
    // CURVE_FS emits premultiplied color ({vColor*a, a}), so curves need premultiplied
    // source-over (ONE, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA).
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(prog.program);
    gl.uniform2f(prog.uResolution, this.width, this.height);
    gl.uniform3f(
      prog.uView,
      this.view.startTime - this.timeBase,
      this.view.endTime - this.timeBase,
      this.view.scrollY * this.dpr,
    );
    gl.uniform1f(prog.uHalfWidth, dependencyStrokeWidth(this.dpr) / 2);
    gl.bindVertexArray(vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, CURVE_STRIP_VERTS, this.curveCount);
  }

  private deleteChunk(chunk: MeshChunk): void {
    const gl = this.gl;
    if (!gl) return;
    gl.deleteVertexArray(chunk.vao);
    gl.deleteBuffer(chunk.vbo);
    gl.deleteBuffer(chunk.ibo);
  }
}
