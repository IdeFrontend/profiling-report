import type {
  DependencyMode,
  SwimEvent,
  SwimlaneModel,
  SwimlaneRenderer,
  SwimlaneViewWindow,
} from '../domain/types';
import { DEFAULT_DEPENDENCY_DEPTH, normalizeDependencyDepth } from '../domain/types';
import {
  cubicControlPull,
  DEP_STROKE_WIDTH,
  dependencyGraph,
  linkIntersectsTimeView,
  linkToScreen,
  type DependencyLink,
} from './dependencyLinks';
import {
  BAND_FILL,
  EMPTY_LAYOUT,
  eventPaintRect,
  eventRadius,
  LANE_GROUP_HEADER_FILL,
  LANE_GROUP_HEADER_HEIGHT,
  LANE_HEIGHT,
  contentHeightFromLayout,
  eventBlockMetrics,
  eventEmphasisDim,
  eventLabelAnchor,
  eventScreenRect,
  findEvent,
  findLaidOutEvent,
  hitTestLayout,
  rebuildLayout,
  showsProfilerStepBands,
  snapEventRect,
  type LaidOutEvent,
  type SwimlaneLayout,
} from './layout';

/** Device-pixel-snapped stroke path inset by half the (snapped) line width. */
function strokeRoundedEvent(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number; r: number },
  lineWidthDevice: number,
): void {
  const lw = Math.max(1, Math.round(lineWidthDevice));
  ctx.lineWidth = lw;
  roundRectPath(
    ctx,
    r.x + lw / 2,
    r.y + lw / 2,
    Math.max(1, r.w - lw),
    Math.max(1, r.h - lw),
    r.r,
  );
  ctx.stroke();
}

function drawEventLabel(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  viewW: number,
  alpha = 1,
  color = '#ffffff',
  dpr = 1,
): void {
  const anchor = eventLabelAnchor(x, w, viewW);
  if (!anchor) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `${Math.max(8, Math.round(10 * dpr))}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, anchor.cx, y + h / 2, anchor.maxWidth);
  ctx.restore();
}

/** Canvas 2D dependency curves in device pixels (Y scaled from layout CSS space). */
function paintDependencyLinksDevice(
  ctx: CanvasRenderingContext2D,
  links: readonly DependencyLink[],
  view: SwimlaneViewWindow,
  widthDevice: number,
  dpr: number,
): void {
  if (links.length === 0) return;
  ctx.lineWidth = Math.max(1, Math.round(DEP_STROKE_WIDTH));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const link of links) {
    if (!linkIntersectsTimeView(link, view)) continue;
    const { x0, y0, x1, y1 } = linkToScreen(link, view, widthDevice);
    const y0d = y0 * dpr;
    const y1d = y1 * dpr;
    const pull = cubicControlPull(x0, x1);
    const g = ctx.createLinearGradient(x0, y0d, x1, y1d);
    g.addColorStop(0, link.fromColor);
    g.addColorStop(1, link.toColor);
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, y0d);
    ctx.bezierCurveTo(x0 + pull, y0d, x1 - pull, y1d, x1, y1d);
    ctx.stroke();
  }
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function paintGroupBands(
  ctx: CanvasRenderingContext2D,
  layout: SwimlaneLayout,
  view: SwimlaneViewWindow,
  widthDevice: number,
  heightDevice: number,
  dpr = 1,
): void {
  const bands = layout.bands;
  if (!bands.length) return;
  const span = Math.max(1, view.endTime - view.startTime);
  for (const lane of layout.lanes) {
    if (!showsProfilerStepBands(lane)) continue;
    for (const band of bands) {
      if (band.startTime + band.duration < view.startTime || band.startTime > view.endTime) {
        continue;
      }
      const x = ((band.startTime - view.startTime) / span) * widthDevice;
      const w = Math.max(2, (band.duration / span) * widthDevice);
      const metrics = eventBlockMetrics(lane.y, view.scrollY);
      const y = metrics.y * dpr;
      const h = metrics.h * dpr;
      if (y + h < 0 || y > heightDevice) continue;
      const r = snapEventRect(x, y, w, h);
      ctx.fillStyle = BAND_FILL;
      roundRectPath(ctx, r.x, r.y, r.w, r.h, eventRadius(w / dpr, dpr));
      ctx.fill();
      drawEventLabel(ctx, band.name, r.x, r.y, r.w, r.h, widthDevice, 1, '#555555', dpr);
    }
  }
}

/**
 * Canvas2D overlay: labels, selection/hover strokes, cursor.
 * Used on top of WebGL interval fills (hybrid path).
 */
export class SwimlaneOverlayPainter {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private layout: SwimlaneLayout = EMPTY_LAYOUT;
  private view: SwimlaneViewWindow = { startTime: 0, endTime: 1, scrollY: 0 };
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private neighborIds = new Set<string>();
  private searchQuery = '';
  private width = 0;
  private height = 0;
  private dpr = 1;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  resize(devicePixelWidth: number, devicePixelHeight: number, dpr: number): void {
    this.width = Math.max(1, Math.floor(devicePixelWidth));
    this.height = Math.max(1, Math.floor(devicePixelHeight));
    this.dpr = dpr > 0 ? dpr : 1;
    if (this.canvas && this.ctx) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  setLayout(layout: SwimlaneLayout): void {
    if (layout === this.layout) return;
    this.layout = layout;
  }

  setView(view: SwimlaneViewWindow): void {
    this.view = { ...view };
  }

  setSelection(selectedId: string | null, hoveredId: string | null): void {
    this.hoveredId = hoveredId;
    this.selectedId = selectedId;
  }

  /** Renderer already walked the graph; overlay only dims from these ids. */
  setNeighborIds(ids: Set<string>): void {
    this.neighborIds = ids;
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query.trim().toLowerCase();
  }


  render(): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;
    ctx.clearRect(0, 0, this.width, this.height);

    // WebGL draws lane chrome + event fills; overlay adds band fills/labels + event strokes/labels.
    paintGroupBands(ctx, this.layout, this.view, this.width, this.height, this.dpr);

    const span = Math.max(1, this.view.endTime - this.view.startTime);
    const q = this.searchQuery;
    const hasSearch = q.length > 0;
    const hasSelection = this.selectedId != null;
    const bright = this.neighborIds;
    const dpr = this.dpr;

    for (const item of this.layout.events) {
      const ev = item.event;
      if (ev.startTime + ev.duration < this.view.startTime || ev.startTime > this.view.endTime) {
        continue;
      }
      const x = ((ev.startTime - this.view.startTime) / span) * this.width;
      const w = Math.max(2, (ev.duration / span) * this.width);
      const metrics = eventBlockMetrics(item.y, this.view.scrollY);
      const y = metrics.y * dpr;
      const h = metrics.h * dpr;
      if (y + h < 0 || y > this.height) continue;
      const r = eventPaintRect(x, y, w, h, dpr);

      const matches = !hasSearch || ev.name.toLowerCase().includes(q);
      const dim = eventEmphasisDim(matches, bright.has(item.id), hasSearch, hasSelection);

      if (item.id === this.selectedId) {
        ctx.strokeStyle = '#ffffff';
        strokeRoundedEvent(ctx, r, Math.round(2 * dpr));
      } else if (item.id === this.hoveredId) {
        ctx.strokeStyle = '#c8e0ff';
        strokeRoundedEvent(ctx, r, Math.round(1.5 * dpr));
      }

      // Same visibility as Canvas fills: search misses omit labels; selection dims the rest.
      if (matches) drawEventLabel(ctx, ev.name, r.x, r.y, r.w, r.h, this.width, dim, '#ffffff', dpr);
    }

    // Cursor is a DOM overlay under Card strips (SwimlaneView); not painted here.
  }

  dispose(): void {
    this.canvas = null;
    this.ctx = null;
    this.layout = EMPTY_LAYOUT;
    this.neighborIds = new Set();
  }
}

/** Canvas 2D SwimlaneRenderer (COMPONENTS). Fallback when WebGL2 is unavailable. */
export class CanvasSwimlaneRenderer implements SwimlaneRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private layout: SwimlaneLayout = EMPTY_LAYOUT;
  private view: SwimlaneViewWindow = { startTime: 0, endTime: 1, scrollY: 0 };
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private neighborIds = new Set<string>();
  private depLinks: DependencyLink[] = [];
  private depMode: DependencyMode = 'all';
  private depDepth = DEFAULT_DEPENDENCY_DEPTH;
  private searchQuery = '';
  private width = 0;
  private height = 0;
  private dpr = 1;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  resize(devicePixelWidth: number, devicePixelHeight: number, dpr: number): void {
    this.width = Math.max(1, Math.floor(devicePixelWidth));
    this.height = Math.max(1, Math.floor(devicePixelHeight));
    this.dpr = dpr > 0 ? dpr : 1;
    if (this.canvas) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      if (this.ctx) {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
  }

  setModel(model: SwimlaneModel): void {
    this.layout = rebuildLayout(model);
    this.refreshDepCache();
  }

  setView(view: SwimlaneViewWindow): void {
    this.view = { ...view };
  }

  setSelection(selectedId: string | null, hoveredId: string | null): void {
    this.hoveredId = hoveredId;
    if (selectedId === this.selectedId) return;
    this.selectedId = selectedId;
    this.refreshDepCache();
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query.trim().toLowerCase();
  }

  setDependencyMode(mode: DependencyMode): void {
    if (mode === this.depMode) return;
    this.depMode = mode;
    this.refreshDepCache();
  }

  setDependencyDepth(depth: number): void {
    const d = normalizeDependencyDepth(depth);
    if (d === this.depDepth) return;
    this.depDepth = d;
    this.refreshDepCache();
  }


  contentHeight(): number {
    return contentHeightFromLayout(this.layout);
  }

  getLayout(): SwimlaneLayout {
    return this.layout;
  }

  getNeighborIds(): Set<string> {
    return this.neighborIds;
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
    const graph = dependencyGraph(this.layout, this.selectedId, this.depMode, this.depDepth);
    this.neighborIds = graph.ids;
    this.depLinks = graph.links;
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(0, 0, this.width, this.height);

    const dpr = this.dpr;

    for (const header of this.layout.headers) {
      const headerTop = (header.y - this.view.scrollY) * dpr;
      const headerH = LANE_GROUP_HEADER_HEIGHT * dpr;
      if (headerTop + headerH > 0 && headerTop < this.height) {
        ctx.fillStyle = LANE_GROUP_HEADER_FILL;
        ctx.fillRect(0, headerTop, this.width, headerH);
        ctx.strokeStyle = '#3a3a3a';
        ctx.beginPath();
        ctx.moveTo(0, headerTop + headerH - 0.5);
        ctx.lineTo(this.width, headerTop + headerH - 0.5);
        ctx.stroke();
      }
    }

    for (let i = 0; i < this.layout.lanes.length; i++) {
      const y = (this.layout.lanes[i]!.y - this.view.scrollY) * dpr;
      const laneH = LANE_HEIGHT * dpr;
      if (y + laneH < 0 || y > this.height) continue;
      ctx.fillStyle = '#1f1f1f';
      ctx.fillRect(0, y, this.width, laneH);
      ctx.strokeStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.moveTo(0, y + laneH - 0.5);
      ctx.lineTo(this.width, y + laneH - 0.5);
      ctx.stroke();
    }

    paintGroupBands(ctx, this.layout, this.view, this.width, this.height, this.dpr);

    const span = Math.max(1, this.view.endTime - this.view.startTime);
    const q = this.searchQuery;
    const hasSearch = q.length > 0;
    const hasSelection = this.selectedId != null;
    const bright = this.neighborIds;
    const visible: {
      item: LaidOutEvent;
      x: number;
      y: number;
      w: number;
      h: number;
      r: number;
      matches: boolean;
      dim: number;
    }[] = [];

    for (const item of this.layout.events) {
      const ev = item.event;
      if (ev.startTime + ev.duration < this.view.startTime || ev.startTime > this.view.endTime) {
        continue;
      }
      const x = ((ev.startTime - this.view.startTime) / span) * this.width;
      const w = Math.max(2, (ev.duration / span) * this.width);
      const metrics = eventBlockMetrics(item.y, this.view.scrollY);
      const y = metrics.y * dpr;
      const h = metrics.h * dpr;
      if (y + h < 0 || y > this.height) continue;
      const fr = eventPaintRect(x, y, w, h, dpr);

      const matches = !hasSearch || ev.name.toLowerCase().includes(q);
      const dim = eventEmphasisDim(matches, bright.has(item.id), hasSearch, hasSelection);
      ctx.globalAlpha = dim;
      ctx.fillStyle = item.color;
      roundRectPath(ctx, fr.x, fr.y, fr.w, fr.h, fr.r);
      ctx.fill();
      ctx.globalAlpha = 1;
      visible.push({ item, x: fr.x, y: fr.y, w: fr.w, h: fr.h, r: fr.r, matches, dim });
    }

    paintDependencyLinksDevice(ctx, this.depLinks, this.view, this.width, this.dpr);

    for (const { item, x, y, w, h, r, matches, dim } of visible) {
      if (item.id === this.selectedId) {
        ctx.strokeStyle = '#ffffff';
        strokeRoundedEvent(ctx, { x, y, w, h, r }, Math.round(2 * dpr));
      } else if (item.id === this.hoveredId) {
        ctx.strokeStyle = '#c8e0ff';
        strokeRoundedEvent(ctx, { x, y, w, h, r }, Math.round(1.5 * dpr));
      }

      if (matches) drawEventLabel(ctx, item.event.name, x, y, w, h, this.width, dim, '#ffffff', dpr);
    }

    // Cursor is a DOM overlay under Card strips (SwimlaneView); not painted here.
  }

  dispose(): void {
    this.canvas = null;
    this.ctx = null;
    this.layout = EMPTY_LAYOUT;
    this.neighborIds = new Set();
    this.depLinks = [];
  }
}

export {
  LANE_GROUP_HEADER_FILL,
  LANE_GROUP_HEADER_HEIGHT,
  LANE_HEIGHT,
  LANE_PAD_Y,
  EVENT_MARGIN,
  eventRadius,
  eventBlockMetrics,
  eventLabelAnchor,
} from './layout';
