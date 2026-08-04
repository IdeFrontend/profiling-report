import type { SwimEvent, SwimlaneModel, SwimlaneRenderer, SwimlaneViewWindow } from '../domain/types';
import {
  LANE_GROUP_HEADER_HEIGHT,
  LANE_HEIGHT,
  LANE_PAD_Y,
  MAX_QUADS_PER_MESH,
  contentHeightFromLayout,
  eventScreenRect,
  findEvent,
  findLaidOutEvent,
  hexToRgb,
  hitTestLayout,
  rebuildLayout,
  type FlatLane,
  type LaidOutEvent,
  type SwimlaneLayout,
} from './layout';
import { SOLID_FS, SOLID_VS, SWIMLANE_FS, SWIMLANE_VS } from './shaders';

interface GlProgram {
  program: WebGLProgram;
  aPos: number;
  aTex: number;
  uSizePos: WebGLUniformLocation;
  uResolution: WebGLUniformLocation | null;
  uColor: WebGLUniformLocation;
}

interface MeshChunk {
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  ibo: WebGLBuffer;
  indexCount: number;
}

interface LaneMeshes {
  color: [number, number, number];
  chunks: MeshChunk[];
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
  };
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

/**
 * WebGL2 coverage-AA interval backend (Sudu-inspired; no sudu-editor dependency).
 * Draws background, lane stripes, and interval fills. Labels/selection use overlay.
 */
export class WebGlSwimlaneRenderer implements SwimlaneRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private swimProg: GlProgram | null = null;
  private solidProg: GlProgram | null = null;
  private unitQuad: MeshChunk | null = null;
  private laneMeshes: LaneMeshes[] = [];
  private layout: SwimlaneLayout = { lanes: [], headers: [], events: [] };
  private view: SwimlaneViewWindow = { startTime: 0, endTime: 1, scrollY: 0 };
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
    this.unitQuad = createUnitQuad(gl);
    this.resize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height);
    return true;
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    const gl = this.gl;
    const canvas = this.canvas;
    if (!gl || !canvas) return;
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.floor(this.width * this.dpr);
    canvas.height = Math.floor(this.height * this.dpr);
    canvas.style.width = `${this.width}px`;
    canvas.style.height = `${this.height}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  setModel(model: SwimlaneModel): void {
    this.layout = rebuildLayout(model);
    this.rebuildMeshes();
  }

  setView(view: SwimlaneViewWindow): void {
    this.view = { ...view };
  }

  setSelection(_selectedId: string | null, _hoveredId: string | null): void {}

  setSearchQuery(_query: string): void {}

  /** Cursor is drawn on the Canvas overlay; no-op here. */
  setCursorX(_x: number | null): void {}

  contentHeight(): number {
    return contentHeightFromLayout(this.layout);
  }

  eventScreenRect(eventId: string): { x: number; y: number; w: number; h: number } | null {
    const item = findLaidOutEvent(this.layout, eventId);
    if (!item) return null;
    return eventScreenRect(item, this.view, this.width);
  }

  hitTest(x: number, y: number): string | null {
    return hitTestLayout(this.layout, this.view, this.width, x, y);
  }

  findEvent(id: string): SwimEvent | null {
    return findEvent(this.layout, id);
  }

  getLayout(): SwimlaneLayout {
    return this.layout;
  }

  render(): void {
    const gl = this.gl;
    const swim = this.swimProg;
    const solid = this.solidProg;
    const unit = this.unitQuad;
    if (!gl || !swim || !solid || !unit) return;

    const cssW = this.width;
    const cssH = this.height;
    // Shaders use CSS-pixel resolution for coverage math (Sudu clientRect).
    const resX = cssW;
    const resY = cssH;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0x25 / 255, 0x25 / 255, 0x25 / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Background stripes (no blend)
    gl.disable(gl.BLEND);
    gl.useProgram(solid.program);

    for (const header of this.layout.headers) {
      const headerTop = header.y - this.view.scrollY;
      if (headerTop + LANE_GROUP_HEADER_HEIGHT > 0 && headerTop < cssH) {
        this.drawSolidRect(solid, unit, 0, headerTop, cssW, LANE_GROUP_HEADER_HEIGHT, [0x2a / 255, 0x2a / 255, 0x2a / 255]);
      }
    }

    for (let i = 0; i < this.layout.lanes.length; i++) {
      const lane = this.layout.lanes[i]!;
      const y = lane.y - this.view.scrollY;
      if (y + LANE_HEIGHT < 0 || y > cssH) continue;
      const c = i % 2 === 0 ? 0x2a / 255 : 0x26 / 255;
      this.drawSolidRect(solid, unit, 0, y, cssW, LANE_HEIGHT, [c, c, c]);
    }

    // Coverage-AA intervals (Sudu blendAddSrcA ≈ SRC_ALPHA, ONE)
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE);
    gl.useProgram(swim.program);
    if (swim.uResolution) gl.uniform2f(swim.uResolution, resX, resY);

    const span = Math.max(1, this.view.endTime - this.view.startTime);
    const sx = 2 / span;
    const px = -1 - (this.view.startTime * 2) / span;

    for (let i = 0; i < this.laneMeshes.length; i++) {
      const lane = this.layout.lanes[i];
      const meshes = this.laneMeshes[i];
      if (!lane || !meshes) continue;

      const top = lane.y - this.view.scrollY + LANE_PAD_Y;
      const bandH = LANE_HEIGHT - LANE_PAD_Y * 2;
      if (top + bandH < 0 || top > cssH) continue;

      const sy = bandH / cssH;
      const py = 1 - (top * 2 + bandH) / cssH;
      const [r, g, b] = meshes.color;

      gl.uniform4f(swim.uSizePos, sx, sy, px, py);
      gl.uniform4f(swim.uColor, r, g, b, 1);

      for (const chunk of meshes.chunks) {
        gl.bindVertexArray(chunk.vao);
        gl.drawElements(gl.TRIANGLES, chunk.indexCount, gl.UNSIGNED_SHORT, 0);
      }
    }

    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  dispose(): void {
    this.disposeMeshes();
    const gl = this.gl;
    if (gl) {
      if (this.unitQuad) this.deleteChunk(this.unitQuad);
      if (this.swimProg) gl.deleteProgram(this.swimProg.program);
      if (this.solidProg) gl.deleteProgram(this.solidProg.program);
    }
    this.unitQuad = null;
    this.swimProg = null;
    this.solidProg = null;
    this.gl = null;
    this.canvas = null;
    this.layout = { lanes: [], headers: [], events: [] };
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
    const cssH = this.height;
    const cssW = this.width;
    // Map local x,y ∈ [-1,1] to CSS pixel rect
    const sx = w / cssW;
    const sy = h / cssH;
    const px = -1 + (2 * x + w) / cssW;
    const py = 1 - (2 * y + h) / cssH;
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
        pairs.push(item.event.startTime, item.event.startTime + item.event.duration);
      }
      const chunks: MeshChunk[] = [];
      for (let off = 0; off < pairs.length / 2; off += MAX_QUADS_PER_MESH) {
        const count = Math.min(MAX_QUADS_PER_MESH, pairs.length / 2 - off);
        const slice = new Float32Array(pairs.slice(off * 2, (off + count) * 2));
        chunks.push(createChunk(gl, slice, count));
      }
      return { color: hexToRgb(lane.color), chunks };
    });
  }

  private disposeMeshes(): void {
    for (const lane of this.laneMeshes) {
      for (const c of lane.chunks) this.deleteChunk(c);
    }
    this.laneMeshes = [];
  }

  private deleteChunk(chunk: MeshChunk): void {
    const gl = this.gl;
    if (!gl) return;
    gl.deleteVertexArray(chunk.vao);
    gl.deleteBuffer(chunk.vbo);
    gl.deleteBuffer(chunk.ibo);
  }
}
