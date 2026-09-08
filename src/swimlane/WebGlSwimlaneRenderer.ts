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
  collapseAlpha,
  collapseShiftY,
  collapseTransform,
  applyCollapseAnim,
  EMPTY_LAYOUT,
  IDLE_COLLAPSE,
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
  eventEmphasisDim,
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
  SUMMARY_EVENT_FILL,
  snapEventRect,
  type CollapseAnimState,
  type CollapseTransform,
  type FlatLane,
  type LaidOutEvent,
  type SwimlaneLayout,
} from './layout';
import { dependencyGraph, dependencyStrokeWidth, depLinksForCollapsePaint, glLinkTime, type DependencyLink } from './dependencyLinks';
import { CLEARTYPE_TEXT_POW, CURVE_FS, CURVE_VS, SOLID_FS, SOLID_VS, SWIMLANE_FS, SWIMLANE_VS, TEXT_CLEARTYPE_FS, TEXT_VS, extendMargin1Css, extendMargin2Css, extendTargetSizeCss, maxRR, minRR, rrSwitchThreshold, rrToDevicePx } from './shaders';
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
  uExtendParameters: WebGLUniformLocation | null;
  uSrcOver: WebGLUniformLocation | null;
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

interface SubRowMesh {
  /** Content-space Y of this sub-row's lane band (lane.y + rowIndex * LANE_HEIGHT). */
  y: number;
  chunks: MeshChunk[];
  /** When search and/or selection is active: per-emphasis mesh layers (Canvas parity). */
  emphasisLayers: EmphasisLayer[] | null;
}

interface LaneMeshes {
  color: [number, number, number];
  rows: SubRowMesh[];
  /** Collapsed-folder summary lane: drawn source-over (exact color), never additive. */
  summary?: boolean;
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
  if (vsSrc.includes('aData')) gl.bindAttribLocation(program, 2, 'aData');
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
    uExtendParameters: gl.getUniformLocation(program, 'uExtendParameters'),
    uSrcOver: gl.getUniformLocation(program, 'uSrcOver'),
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

/** Sudu setVbSquareWithGaps: 6 floats/vertex — adds gapPrev,gapNext per vertex (aData). */
export function setVbSquareWithGaps(
  p: number,
  x0: number,
  x1: number,
  gapPrev: number,
  gapNext: number,
  vb: Float32Array,
): void {
  // x1,-1, x0,1, gapPrev,gapNext | x1,1, x0,1, gapPrev,gapNext | x0,-1, x1,0, gapPrev,gapNext | x0,1, x1,0, gapPrev,gapNext
  vb[p] = x1;
  vb[p + 1] = -1;
  vb[p + 2] = x0;
  vb[p + 3] = 1;
  vb[p + 4] = gapPrev;
  vb[p + 5] = gapNext;
  vb[p + 6] = x1;
  vb[p + 7] = 1;
  vb[p + 8] = x0;
  vb[p + 9] = 1;
  vb[p + 10] = gapPrev;
  vb[p + 11] = gapNext;
  vb[p + 12] = x0;
  vb[p + 13] = -1;
  vb[p + 14] = x1;
  vb[p + 15] = 0;
  vb[p + 16] = gapPrev;
  vb[p + 17] = gapNext;
  vb[p + 18] = x0;
  vb[p + 19] = 1;
  vb[p + 20] = x1;
  vb[p + 21] = 0;
  vb[p + 22] = gapPrev;
  vb[p + 23] = gapNext;
}

/**
 * Build a swimlane mesh chunk from `pairs` (full lane of [x0,x1] intervals in event coords,
 * relative to timeBase), starting at pair offset `off`. Gaps are read straight from `pairs` via
 * the global index (`eventGapPrev` / `eventGapNext`) — no per-chunk copy or gap array is made,
 * so the only allocations are the vertex/index buffers themselves. The 6-float vertex format
 * (pos, uv, data) enables branchless extension in the vertex shader.
 */
function createChunk(
  gl: WebGL2RenderingContext,
  pairs: number[],
  off: number,
  pairCount: number,
): MeshChunk {
  const numSquares = Math.min(pairCount, MAX_QUADS_PER_MESH);
  const vb = new Float32Array(numSquares * 24);
  const ib = new Uint16Array(numSquares * 6);
  for (let i = 0; i < numSquares; i++) {
    const gi = off + i;
    setVbSquareWithGaps(
      i * 24,
      pairs[gi * 2]!,
      pairs[gi * 2 + 1]!,
      eventGapPrev(pairs, gi),
      eventGapNext(pairs, gi),
      vb,
    );
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
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 8);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ib, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  return { vao, vbo, ibo, indexCount: numSquares * 6 };
}

/** Edge fake-gap for the first/last event of a lane (model time units). A huge constant so an
 * isolated/thin edge event is treated as having plenty of empty space on the boundary side and
 * always saturates the extension margin. A degenerate `eventRange` (a single-event lane) would
 * otherwise suppress the extension. */
export const EDGE_GAP = 1e12;

/**
 * Distance from the previous event's end to event `gi`'s start, in event coords.
 *
 * `gi` indexes the **whole lane** (not a chunk), so the first event of any non-first chunk reads
 * a real gap back into the previous chunk's last event. Only the lane's true first event uses
 * `EDGE_GAP`. Scalar (no allocation) so the mesh-build loop can call it per event.
 */
export function eventGapPrev(pairs: number[], gi: number): number {
  return gi === 0 ? EDGE_GAP : pairs[gi * 2]! - pairs[gi * 2 - 1]!;
}

/**
 * Distance from event `gi`'s end to the next event's start, in event coords.
 *
 * `gi` indexes the **whole lane** (not a chunk), so the last event of any non-final chunk reads a
 * real gap forward into the next chunk's first event. Only the lane's true last event uses
 * `EDGE_GAP`. Scalar (no allocation) so the mesh-build loop can call it per event.
 */
export function eventGapNext(pairs: number[], gi: number): number {
  return gi * 2 + 2 >= pairs.length ? EDGE_GAP : pairs[gi * 2 + 2]! - pairs[gi * 2 + 1]!;
}

/**
 * Build mesh chunks from per-event encoded intervals. Each chunk reads its events (and their
 * gaps) straight from the full `pairs` array by global index, so boundary events resolve real
 * neighbors across the chunk split — `gapPrev` back and `gapNext` forward — with no per-chunk
 * copies or gap arrays.
 */
function createChunksFromPairs(gl: WebGL2RenderingContext, pairs: number[]): MeshChunk[] {
  const chunks: MeshChunk[] = [];
  const totalPairs = pairs.length / 2;
  for (let off = 0; off < totalPairs; off += MAX_QUADS_PER_MESH) {
    const count = Math.min(MAX_QUADS_PER_MESH, totalPairs - off);
    chunks.push(createChunk(gl, pairs, off, count));
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
  /** Expanded layout the collapse tween interpolates from; paint uses this + `collapse`. */
  private baseLayout: SwimlaneLayout = EMPTY_LAYOUT;
  private layout: SwimlaneLayout = EMPTY_LAYOUT;
  /** Shifted layout for hit-test / magnetize / eventScreenRect (matches paint). */
  private hitLayout: SwimlaneLayout = EMPTY_LAYOUT;
  private view: SwimlaneViewWindow = { startTime: 0, endTime: 1, scrollY: 0 };
  private collapse: CollapseTransform = IDLE_COLLAPSE;
  /** Subtracted from event times before float32 upload (model.minTime). */
  private timeBase = 0;
  private searchQuery = '';
  private selectedId: string | null = null;
  private hoveredLaneId: string | null = null;
  private depMode: DependencyMode = 'all';
  private depDepth = DEFAULT_DEPENDENCY_DEPTH;
  private paintDependencies = true;
  private neighborIds = new Set<string>();
  private multiIds = new Set<string>();
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
    // A dpr change also mints a new `fontPx` key for every label, so clear the atlas to free the
    // old-glyph textures now instead of leaving them to LRU eviction.
    if (dprChanged) {
      this.rebuildCurveInstances();
      this.atlas?.clear(gl);
    }
  }

  setModel(model: SwimlaneModel): void {
    this.baseLayout = rebuildLayout(model);
    this.layout = this.baseLayout;
    this.hitLayout = this.baseLayout;
    this.collapse = IDLE_COLLAPSE;
    this.timeBase = model?.minTime ?? 0;
    this.refreshDepCache();
    this.rebuildMeshes();
    this.rebuildCurveInstances();
    // A new model invalidates every cached label glyph (names/widths differ); free the GPU
    // textures now instead of waiting for the atlas LRU budget to evict them.
    if (this.gl) this.atlas?.clear(this.gl);
  }

  /** Per-frame collapse/expand transform applied inline in `render` (no mesh rebuild). */
  setCollapseAnim(state: CollapseAnimState | null): void {
    this.collapse = collapseTransform(this.baseLayout, state);
    this.hitLayout = state ? applyCollapseAnim(this.baseLayout, state) : this.baseLayout;
    // Endpoint Y / visibility change with the tween — refresh instance buffer.
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

  setMultiSelection(ids: string[]): void {
    if (ids.length === this.multiIds.size && ids.every((id) => this.multiIds.has(id))) return;
    this.multiIds = new Set(ids);
    this.rebuildEmphasisSplit();
  }

  contentHeight(): number {
    return contentHeightFromLayout(this.layout);
  }

  eventScreenRect(eventId: string): { x: number; y: number; w: number; h: number } | null {
    const item = findLaidOutEvent(this.hitLayout, eventId);
    if (!item) return null;
    return eventScreenRect(item, this.view, this.width, this.dpr);
  }

  hitTest(x: number, y: number): string | null {
    return hitTestLayout(this.hitLayout, this.view, this.width, x, y, this.dpr);
  }

  findEvent(id: string): SwimEvent | null {
    return findEvent(this.hitLayout, id);
  }

  private refreshDepCache(): void {
    this.depGraphGen += 1;
    // Neighbor ids drive selection muting on every surface (including the pinned strip).
    // Curves stay body-only: drop link geometry when paintDependencies is false.
    const graph = dependencyGraph(this.layout, this.selectedId, this.depMode, this.depDepth);
    this.neighborIds = graph.ids;
    this.depLinks = this.paintDependencies ? graph.links : [];
  }

  getLayout(): SwimlaneLayout {
    return this.hitLayout;
  }

  /** Expanded base layout for overlay paint (collapse applied via setCollapseAnim). */
  getBaseLayout(): SwimlaneLayout {
    return this.baseLayout;
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

    // Uniform lane chrome + 1px dividers aligned with LaneGutter borders.
    // Premultiplied alpha blending so collapseAlpha fades subtree chrome (matches Canvas).
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(solid.program);
    const laneBg = hexToRgb(LANE_FILL);
    const laneHoverBg = hexToRgb(LANE_HOVER_FILL);
    const headerBg = hexToRgb(LANE_GROUP_HEADER_FILL);
    const divider = 0x3a / 255;

    for (const header of this.layout.headers) {
      const headerTop = (collapseShiftY(header.y, this.collapse) - this.view.scrollY) * dpr;
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
      const y = (collapseShiftY(lane.y, this.collapse) - this.view.scrollY) * dpr;
      const laneH = lane.rowCount * LANE_HEIGHT * dpr;
      if (y + laneH < 0 || y > devH) continue;
      const alpha = collapseAlpha(lane.y, this.collapse);
      const bg = lane.thread.id === this.hoveredLaneId ? laneHoverBg : laneBg;
      this.drawSolidRect(solid, unit, 0, y, devW, laneH, bg, alpha);
      this.drawSolidRect(solid, unit, 0, y + laneH - 1, devW, 1, [divider, divider, divider], alpha);
    }

    // Coverage-AA intervals (analytical X) — additive (ONE, ONE, ONE, ONE): the FS emits straight
    // RGB × cov with alpha constant 1.0, so SRC_ALPHA ≡ ONE and each event adds full cov·dim·rgb.
    // Safe because each sub-row mesh is mutually exclusive (multi-row layout); each device pixel
    // accumulates the coverage of all events across lanes / sub-rows.
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
    gl.useProgram(swim.program);
    if (swim.uResolution) gl.uniform2f(swim.uResolution, devW, devH);
    // Extension params are CSS px (shaders.extendTargetSizeCss/extendMargin1Css/extendMargin2Css),
    // converted to device px (× dpr) so they track the browser's dpr; unless the uniform was
    // optimized out of an empty/legacy shader (then it stays null and extension is off).
    if (swim.uExtendParameters)
      gl.uniform3f(
        swim.uExtendParameters,
        extendTargetSizeCss * dpr,
        extendMargin1Css * dpr,
        extendMargin2Css * dpr,
      );
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
    if (swim.uSrcOver) gl.uniform1f(swim.uSrcOver, 0);

    const span = Math.max(1, this.view.endTime - this.view.startTime);
    // aPos times are relative to timeBase (see encodeIntervalPair).
    const sx = 2 / span;
    const px = -1 + (2 * (this.timeBase - this.view.startTime)) / span;

    for (let i = 0; i < this.laneMeshes.length; i++) {
      const lane = this.layout.lanes[i];
      const meshes = this.laneMeshes[i];
      if (!lane || !meshes) continue;
      const laneAlpha = collapseAlpha(lane.y, this.collapse);

      for (const row of meshes.rows) {
        const { y: topRaw, h: bandHRaw } = eventBlockMetrics(
          collapseShiftY(row.y, this.collapse),
          this.view.scrollY,
        );
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

        // Summary bars composite source-over so their exact fill lands without adding onto
        // the lane background (additive would lighten #2c2c2c to #4b4b4b over #1f1f1f).
        if (meshes.summary) {
          gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          if (swim.uSrcOver) gl.uniform1f(swim.uSrcOver, 1);
        }

        const drawChunks = (chunks: MeshChunk[], rgb: [number, number, number], dim: number): void => {
          // Premul RGB × dim + alpha dim — matches Canvas globalAlpha on fills.
          const a = dim * laneAlpha;
          gl.uniform4f(swim.uColor, rgb[0] * a, rgb[1] * a, rgb[2] * a, a);
          for (const chunk of chunks) {
            gl.bindVertexArray(chunk.vao);
            gl.drawElements(gl.TRIANGLES, chunk.indexCount, gl.UNSIGNED_SHORT, 0);
          }
        };

        if (row.emphasisLayers) {
          for (const layer of row.emphasisLayers) {
            drawChunks(layer.chunks, layer.rgb, layer.dim);
          }
        } else {
          drawChunks(row.chunks, meshes.color, 1);
        }

        if (meshes.summary) {
          gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
          if (swim.uSrcOver) gl.uniform1f(swim.uSrcOver, 0);
        }
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
    this.baseLayout = EMPTY_LAYOUT;
    this.layout = EMPTY_LAYOUT;
    this.hitLayout = EMPTY_LAYOUT;
    this.collapse = IDLE_COLLAPSE;
    this.neighborIds = new Set();
    this.multiIds = new Set();
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
    const hasSelection = this.selectedId != null;
    const hasMulti = this.multiIds.size > 0;
    const bright = this.neighborIds;
    // Lane backgrounds — the event fill composites over these, not the clear color. The
    // hovered row's chrome is `LANE_HOVER_FILL`, so its label backdrop must match that too.
    const laneBg = hexToRgb(LANE_FILL);
    const laneHoverBg = hexToRgb(LANE_HOVER_FILL);
    const fontPx = Math.max(8, Math.round(EVENT_LABEL_FONT_CSS_PX * dpr));

    gl.disable(gl.BLEND);
    gl.useProgram(prog.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(prog.sDiffuse, 0);
    gl.uniform2f(prog.uTextPow, CLEARTYPE_TEXT_POW, 0);
    gl.enable(gl.SCISSOR_TEST);

    for (const item of this.layout.events) {
      // Collapsed-folder summary bars carry their own dimmed "N tasks" label via the overlay
      // (`taskCountLabel` in `SUMMARY_LABEL_COLOR`); the ClearType pass must not rasterize `ev.name`
      // (empty for multi-task unions, the leaf title for a single-event union) over it with a
      // colored additive backdrop.
      if (item.summary) continue;
      const ev = item.event;
      if (ev.startTime + ev.duration < this.view.startTime || ev.startTime > this.view.endTime) {
        continue;
      }
      const x = ((ev.startTime - this.view.startTime) / span) * devW;
      const w = Math.max(2, (ev.duration / span) * devW);
      // Match interval fills: shift with the tween and skip fully-faded subtree rows so
      // ClearType titles do not linger on the expanded-base Y while blocks slide away.
      const labelAlpha = collapseAlpha(item.y, this.collapse);
      if (labelAlpha <= 0) continue;
      const m = eventBlockMetrics(collapseShiftY(item.y, this.collapse), this.view.scrollY);
      const y = m.y * dpr;
      const h = m.h * dpr;
      if (y + h < 0 || y > devH) continue;
      const r = eventPaintRect(x, y, w, h, dpr);
      const matches = !hasSearch || ev.name.toLowerCase().includes(q);
      if (!matches) continue;
      const { muted } = eventEmphasis(
        matches,
        bright.has(item.id) || this.multiIds.has(item.id),
        hasSearch,
        hasSelection || hasMulti,
      );
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
      const fr = Math.min(1, bg[0] + lr);
      const fg = Math.min(1, bg[1] + lg);
      const fb = Math.min(1, bg[2] + lb);
      gl.uniform4f(prog.uBgColor, fr, fg, fb, labelAlpha);
      if (muted) {
        const [mr, mg, mb] = hexToRgb(SELECTION_MUTED_LABEL);
        gl.uniform4f(prog.uColor, mr, mg, mb, labelAlpha);
      } else {
        gl.uniform4f(prog.uColor, 1, 1, 1, labelAlpha);
      }

      if (labelAlpha < 1) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      } else {
        gl.disable(gl.BLEND);
      }

      const cy = r.y + r.h / 2;
      // Snap the quad origin to device pixels: glyphs are drawn 1:1 with NEAREST sampling, so a
      // half-pixel origin (odd visible width or the event's -0.5 optical nudge) shifts the baked
      // ClearType subpixel RGB off the display grid and leaves the fringe colored/soft.
      const gx = Math.round(anchor.cx - glyph.width / 2);
      const gy = Math.round(cy - glyph.height / 2);
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
      // An event that barely intersects the viewport can clamp to an empty box; scissor() would
      // not be called, yet the draw below would still run with the previous event's (or the
      // prior frame's) scissor, leaking a label into a different event. Skip the draw entirely.
      if (sRight <= sLeft || sBottom <= sTop) continue;
      gl.scissor(sLeft, devH - sBottom, sRight - sLeft, sBottom - sTop);
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
    alpha = 1,
  ): void {
    const gl = this.gl!;
    const devW = this.width;
    const devH = this.height;
    const sx = w / devW;
    const sy = h / devH;
    const px = -1 + (2 * x + w) / devW;
    const py = 1 - (2 * y + h) / devH;
    gl.uniform4f(prog.uSizePos, sx, sy, px, py);
    // Premultiply so SRC_ALPHA blending fades toward the cleared background.
    gl.uniform4f(prog.uColor, rgb[0] * alpha, rgb[1] * alpha, rgb[2] * alpha, alpha);
    gl.bindVertexArray(unit.vao);
    gl.drawElements(gl.TRIANGLES, unit.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  private rebuildMeshes(): void {
    const gl = this.gl;
    if (!gl) return;
    this.disposeMeshes();

    const byRow = new Map<string, LaidOutEvent[]>();
    for (const ev of this.layout.events) {
      const key = `${ev.laneIndex}:${ev.rowIndex}`;
      const list = byRow.get(key) ?? [];
      list.push(ev);
      byRow.set(key, list);
    }

    this.laneMeshes = this.layout.lanes.map((lane: FlatLane, idx: number) => {
      const rows: SubRowMesh[] = [];
      const allEvents: LaidOutEvent[] = [];
      for (let r = 0; r < lane.rowCount; r++) {
        // layout.events is startTime-ordered per lane; grouping preserves that within a sub-row.
        const events = byRow.get(`${idx}:${r}`) ?? [];
        allEvents.push(...events);
        const pairs: number[] = [];
        for (const item of events) {
          const [a, b] = encodeIntervalPair(item.event.startTime, item.event.duration, this.timeBase);
          pairs.push(a, b);
        }
        rows.push({
          y: lane.y + r * LANE_HEIGHT,
          chunks: createChunksFromPairs(gl, pairs),
          emphasisLayers: null,
        });
      }
      // Folder lanes carry only summary bars — paint the whole mesh in the summary gray.
      const summary = allEvents.length > 0 && allEvents.every((e) => e.summary);
      return {
        color: hexToRgb(summary ? SUMMARY_EVENT_FILL : lane.color),
        rows,
        summary,
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
    const multi = this.multiIds;
    if (!gl || (!q && !sel && multi.size === 0)) return;

    const hasSearch = q.length > 0;
    const hasSelection = sel != null;
    const hasMulti = multi.size > 0;
    const bright = this.neighborIds;
    const byLane = new Map<number, Map<number, LaidOutEvent[]>>();
    for (const ev of this.layout.events) {
      let byRow = byLane.get(ev.laneIndex);
      if (!byRow) {
        byRow = new Map();
        byLane.set(ev.laneIndex, byRow);
      }
      const list = byRow.get(ev.rowIndex) ?? [];
      list.push(ev);
      byRow.set(ev.rowIndex, list);
    }

    for (let idx = 0; idx < this.laneMeshes.length; idx++) {
      const meshes = this.laneMeshes[idx]!;
      const byRow = byLane.get(idx);
      if (!byRow) continue;
      for (const [rowIndex, events] of byRow) {
        const row = meshes.rows[rowIndex];
        if (!row) continue;
        const byKey = new Map<string, { rgb: [number, number, number]; dim: number; pairs: number[] }>();
        for (const item of events) {
          if (item.summary) continue;
          const matches = !hasSearch || item.event.name.toLowerCase().includes(q);
          const keepBright = bright.has(item.id) || multi.has(item.id);
          const dim = eventEmphasisDim(matches, keepBright, hasSearch, hasSelection || hasMulti);
          const fill = dim < 1 ? SELECTION_MUTED_FILL : item.color;
          let entry = byKey.get(fill);
          if (!entry) {
            entry = { rgb: hexToRgb(fill), dim, pairs: [] };
            byKey.set(fill, entry);
          }
          const [a, b] = encodeIntervalPair(item.event.startTime, item.event.duration, this.timeBase);
          entry.pairs.push(a, b);
        }
        // Dimmer layers first so full-bright selection/matches paint on top. Rows with only
        // summary bars keep the base mesh full-bright.
        row.emphasisLayers =
          byKey.size === 0
            ? null
            : [...byKey.values()]
                .sort((a, b) => a.dim - b.dim)
                .map(({ rgb, dim, pairs }) => ({ rgb, dim, chunks: createChunksFromPairs(gl, pairs) }));
      }
    }
  }

  private disposeEmphasisSplit(): void {
    for (const lane of this.laneMeshes) {
      for (const row of lane.rows) {
        if (row.emphasisLayers) {
          for (const layer of row.emphasisLayers) {
            for (const c of layer.chunks) this.deleteChunk(c);
          }
          row.emphasisLayers = null;
        }
      }
    }
  }

  private disposeMeshes(): void {
    this.disposeEmphasisSplit();
    for (const lane of this.laneMeshes) {
      for (const row of lane.rows) {
        for (const c of row.chunks) this.deleteChunk(c);
      }
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
    const links = depLinksForCollapsePaint(this.depLinks, this.collapse);
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
