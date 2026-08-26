import type {
  DependencyMode,
  SwimEvent,
  SwimlaneModel,
  SwimlaneRenderer,
  SwimlaneViewWindow,
} from '../domain/types';
import { SYSTEM_CANVAS_LABEL_FONT } from '../ui/fontStack';
import { DEFAULT_DEPENDENCY_DEPTH, normalizeDependencyDepth } from '../domain/types';
import { dependencyGraph, paintDependencyLinks, type DependencyLink } from './dependencyLinks';
import {
  BAND_FILL,
  EMPTY_LAYOUT,
  EVENT_RADIUS,
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
  type LaidOutEvent,
  type SwimlaneLayout,
} from './layout';

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
  font: string = SYSTEM_CANVAS_LABEL_FONT,
): void {
  const anchor = eventLabelAnchor(x, w, viewW);
  if (!anchor) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, anchor.cx, y + h / 2, anchor.maxWidth);
  ctx.restore();
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
  width: number,
  height: number,
  labelFont: string = SYSTEM_CANVAS_LABEL_FONT,
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
      const x = ((band.startTime - view.startTime) / span) * width;
      const w = Math.max(2, (band.duration / span) * width);
      const { y, h } = eventBlockMetrics(lane.y, view.scrollY);
      if (y + h < 0 || y > height) continue;
      ctx.fillStyle = BAND_FILL;
      roundRectPath(ctx, x, y, w, h, EVENT_RADIUS);
      ctx.fill();
      drawEventLabel(ctx, band.name, x, y, w, h, width, 1, '#555555', labelFont);
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
  private labelFont: string = SYSTEM_CANVAS_LABEL_FONT;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    if (this.canvas && this.ctx) {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      this.canvas.width = Math.floor(this.width * dpr);
      this.canvas.height = Math.floor(this.height * dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  setLabelFont(font: string): void {
    this.labelFont = font;
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;
    ctx.clearRect(0, 0, this.width, this.height);

    // WebGL draws lane chrome + event fills; overlay adds band fills/labels + event strokes/labels.
    paintGroupBands(ctx, this.layout, this.view, this.width, this.height, this.labelFont);

    const span = Math.max(1, this.view.endTime - this.view.startTime);
    const q = this.searchQuery;
    const hasSearch = q.length > 0;
    const hasSelection = this.selectedId != null;
    const bright = this.neighborIds;

    for (const item of this.layout.events) {
      const ev = item.event;
      if (ev.startTime + ev.duration < this.view.startTime || ev.startTime > this.view.endTime) {
        continue;
      }
      const x = ((ev.startTime - this.view.startTime) / span) * this.width;
      const w = Math.max(2, (ev.duration / span) * this.width);
      const { y, h } = eventBlockMetrics(item.y, this.view.scrollY);
      if (y + h < 0 || y > this.height) continue;

      const matches = !hasSearch || ev.name.toLowerCase().includes(q);
      const dim = eventEmphasisDim(matches, bright.has(item.id), hasSearch, hasSelection);

      if (item.id === this.selectedId) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, EVENT_RADIUS);
        ctx.stroke();
      } else if (item.id === this.hoveredId) {
        ctx.strokeStyle = '#c8e0ff';
        ctx.lineWidth = 1.5;
        roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, EVENT_RADIUS);
        ctx.stroke();
      }

      // Same visibility as Canvas fills: search misses omit labels; selection dims the rest.
      if (matches) {
        drawEventLabel(ctx, ev.name, x, y, w, h, this.width, dim, '#ffffff', this.labelFont);
      }
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
  private labelFont: string = SYSTEM_CANVAS_LABEL_FONT;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    if (this.canvas) {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      this.canvas.width = Math.floor(this.width * dpr);
      this.canvas.height = Math.floor(this.height * dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      if (this.ctx) {
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  setLabelFont(font: string): void {
    this.labelFont = font;
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
    return eventScreenRect(item, this.view, this.width);
  }

  hitTest(x: number, y: number): string | null {
    return hitTestLayout(this.layout, this.view, this.width, x, y);
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

    for (const header of this.layout.headers) {
      const headerTop = header.y - this.view.scrollY;
      if (headerTop + LANE_GROUP_HEADER_HEIGHT > 0 && headerTop < this.height) {
        ctx.fillStyle = LANE_GROUP_HEADER_FILL;
        ctx.fillRect(0, headerTop, this.width, LANE_GROUP_HEADER_HEIGHT);
        ctx.strokeStyle = '#3a3a3a';
        ctx.beginPath();
        ctx.moveTo(0, headerTop + LANE_GROUP_HEADER_HEIGHT - 0.5);
        ctx.lineTo(this.width, headerTop + LANE_GROUP_HEADER_HEIGHT - 0.5);
        ctx.stroke();
      }
    }

    for (let i = 0; i < this.layout.lanes.length; i++) {
      const y = this.layout.lanes[i]!.y - this.view.scrollY;
      if (y + LANE_HEIGHT < 0 || y > this.height) continue;
      ctx.fillStyle = '#1f1f1f';
      ctx.fillRect(0, y, this.width, LANE_HEIGHT);
      ctx.strokeStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.moveTo(0, y + LANE_HEIGHT - 0.5);
      ctx.lineTo(this.width, y + LANE_HEIGHT - 0.5);
      ctx.stroke();
    }

    paintGroupBands(ctx, this.layout, this.view, this.width, this.height, this.labelFont);

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
      const { y, h } = eventBlockMetrics(item.y, this.view.scrollY);
      if (y + h < 0 || y > this.height) continue;

      const matches = !hasSearch || ev.name.toLowerCase().includes(q);
      const dim = eventEmphasisDim(matches, bright.has(item.id), hasSearch, hasSelection);
      ctx.globalAlpha = dim;
      ctx.fillStyle = item.color;
      roundRectPath(ctx, x, y, w, h, EVENT_RADIUS);
      ctx.fill();
      ctx.globalAlpha = 1;
      visible.push({ item, x, y, w, h, matches, dim });
    }

    paintDependencyLinks(ctx, this.depLinks, this.view, this.width);

    for (const { item, x, y, w, h, matches, dim } of visible) {
      if (item.id === this.selectedId) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, EVENT_RADIUS);
        ctx.stroke();
      } else if (item.id === this.hoveredId) {
        ctx.strokeStyle = '#c8e0ff';
        ctx.lineWidth = 1.5;
        roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, EVENT_RADIUS);
        ctx.stroke();
      }

      if (matches) {
        drawEventLabel(
          ctx,
          item.event.name,
          x,
          y,
          w,
          h,
          this.width,
          dim,
          '#ffffff',
          this.labelFont,
        );
      }
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
  EVENT_RADIUS,
  eventBlockMetrics,
  eventLabelAnchor,
} from './layout';
