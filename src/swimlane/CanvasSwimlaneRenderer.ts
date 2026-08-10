import type { SwimEvent, SwimlaneModel, SwimlaneRenderer, SwimlaneViewWindow } from '../domain/types';
import {
  EVENT_RADIUS,
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
): void {
  const anchor = eventLabelAnchor(x, w, viewW);
  if (!anchor) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
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

/**
 * Canvas2D overlay: labels, selection/hover strokes, cursor.
 * Used on top of WebGL interval fills (hybrid path).
 */
export class SwimlaneOverlayPainter {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private layout: SwimlaneLayout = { lanes: [], headers: [], events: [] };
  private view: SwimlaneViewWindow = { startTime: 0, endTime: 1, scrollY: 0 };
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private searchQuery = '';
  private cursorX: number | null = null;
  private width = 0;
  private height = 0;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height);
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
    this.layout = layout;
  }

  setView(view: SwimlaneViewWindow): void {
    this.view = { ...view };
  }

  setSelection(selectedId: string | null, hoveredId: string | null): void {
    this.selectedId = selectedId;
    this.hoveredId = hoveredId;
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query.trim().toLowerCase();
  }

  setCursorX(x: number | null): void {
    this.cursorX = x;
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;
    ctx.clearRect(0, 0, this.width, this.height);

    const span = Math.max(1, this.view.endTime - this.view.startTime);
    const q = this.searchQuery;
    const hasSearch = q.length > 0;
    const hasSelection = this.selectedId != null;

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
      const dim = eventEmphasisDim(matches, item.id === this.selectedId, hasSearch, hasSelection);

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
      if (matches) drawEventLabel(ctx, ev.name, x, y, w, h, this.width, dim);
    }

    if (this.cursorX != null && this.cursorX >= 0 && this.cursorX <= this.width) {
      ctx.strokeStyle = '#317AF7';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.cursorX + 0.5, 0);
      ctx.lineTo(this.cursorX + 0.5, this.height);
      ctx.stroke();
    }
  }

  dispose(): void {
    this.canvas = null;
    this.ctx = null;
    this.layout = { lanes: [], headers: [], events: [] };
  }
}

/** Canvas 2D SwimlaneRenderer (COMPONENTS). Fallback when WebGL2 is unavailable. */
export class CanvasSwimlaneRenderer implements SwimlaneRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private layout: SwimlaneLayout = { lanes: [], headers: [], events: [] };
  private view: SwimlaneViewWindow = { startTime: 0, endTime: 1, scrollY: 0 };
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private searchQuery = '';
  private cursorX: number | null = null;
  private width = 0;
  private height = 0;

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height);
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
  }

  setView(view: SwimlaneViewWindow): void {
    this.view = { ...view };
  }

  setSelection(selectedId: string | null, hoveredId: string | null): void {
    this.selectedId = selectedId;
    this.hoveredId = hoveredId;
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query.trim().toLowerCase();
  }

  setCursorX(x: number | null): void {
    this.cursorX = x;
  }

  contentHeight(): number {
    return contentHeightFromLayout(this.layout);
  }

  getLayout(): SwimlaneLayout {
    return this.layout;
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

  render(): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#252525';
    ctx.fillRect(0, 0, this.width, this.height);

    for (const header of this.layout.headers) {
      const headerTop = header.y - this.view.scrollY;
      if (headerTop + LANE_GROUP_HEADER_HEIGHT > 0 && headerTop < this.height) {
        ctx.fillStyle = '#2a2a2a';
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
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, y, this.width, LANE_HEIGHT);
      ctx.strokeStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.moveTo(0, y + LANE_HEIGHT - 0.5);
      ctx.lineTo(this.width, y + LANE_HEIGHT - 0.5);
      ctx.stroke();
    }

    const span = Math.max(1, this.view.endTime - this.view.startTime);
    const q = this.searchQuery;
    const hasSearch = q.length > 0;
    const hasSelection = this.selectedId != null;

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
      const dim = eventEmphasisDim(matches, item.id === this.selectedId, hasSearch, hasSelection);
      ctx.globalAlpha = dim;
      ctx.fillStyle = item.color;
      roundRectPath(ctx, x, y, w, h, EVENT_RADIUS);
      ctx.fill();

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

      if (matches) drawEventLabel(ctx, ev.name, x, y, w, h, this.width, dim);
      ctx.globalAlpha = 1;
    }

    if (this.cursorX != null && this.cursorX >= 0 && this.cursorX <= this.width) {
      ctx.save();
      // Match CursorTimestamp `.pr-cursor` (#317AF7); +0.5 aligns stroke with CSS left-edge at x.
      ctx.strokeStyle = '#317AF7';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.cursorX + 0.5, 0);
      ctx.lineTo(this.cursorX + 0.5, this.height);
      ctx.stroke();
      ctx.restore();
    }
  }

  dispose(): void {
    this.canvas = null;
    this.ctx = null;
    this.layout = { lanes: [], headers: [], events: [] };
  }
}

export {
  LANE_GROUP_HEADER_HEIGHT,
  LANE_HEIGHT,
  LANE_PAD_Y,
  EVENT_RADIUS,
  eventBlockMetrics,
  eventLabelAnchor,
} from './layout';
