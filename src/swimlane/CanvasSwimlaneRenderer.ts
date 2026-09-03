import type {
  DependencyMode,
  SwimEvent,
  SwimlaneModel,
  SwimlaneRenderer,
  SwimlaneViewWindow,
} from '../domain/types';
import { DEFAULT_DEPENDENCY_DEPTH, normalizeDependencyDepth } from '../domain/types';
import { eventFill, eventStateOf, labelColorOn } from '../domain/laneColors';
import {
  cubicControlPull,
  dependencyGraph,
  dependencyStrokeWidth,
  linkIntersectsTimeView,
  linkToScreen,
  type DependencyLink,
} from './dependencyLinks';
import {
  EMPTY_LAYOUT,
  eventPaintRect,
  LANE_FILL,
  LANE_GROUP_HEADER_FILL,
  LANE_HOVER_FILL,
  LANE_GROUP_HEADER_HEIGHT,
  LANE_HEIGHT,
  contentHeightFromLayout,
  eventBlockMetrics,
  eventEmphasis,
  eventLabelAnchor,
  eventScreenRect,
  findEvent,
  findLaidOutEvent,
  hitTestLayout,
  rebuildLayout,
  SELECTION_MUTED_FILL,
  SELECTION_MUTED_LABEL,
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
  ctx.lineWidth = dependencyStrokeWidth(dpr);
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

/**
 * Canvas2D overlay: labels and hover/selection state fills.
 * Used on top of WebGL interval fills (hybrid path).
 */
export class SwimlaneOverlayPainter {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private layout: SwimlaneLayout = EMPTY_LAYOUT;
  private view: SwimlaneViewWindow = { startTime: 0, endTime: 1, scrollY: 0 };
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private hoveredLaneId: string | null = null;
  private neighborIds = new Set<string>();
  private searchQuery = '';
  /** When false, selection does not mute non-neighbors (pinned-strip pass). */
  private selectionMuted = true;
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

  /** Same leaf-lane id the WebGL background pass uses for AC-07 row tint. */
  setHoveredLane(laneId: string | null): void {
    this.hoveredLaneId = laneId;
  }

  /** Renderer already walked the graph; overlay only mutes from these ids. */
  setNeighborIds(ids: Set<string>): void {
    this.neighborIds = ids;
  }

  setSelectionMuted(enabled: boolean): void {
    this.selectionMuted = enabled;
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query.trim().toLowerCase();
  }


  render(): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;
    ctx.clearRect(0, 0, this.width, this.height);

    const span = Math.max(1, this.view.endTime - this.view.startTime);
    const q = this.searchQuery;
    const hasSearch = q.length > 0;
    const hasSelection = this.selectionMuted && this.selectedId != null;
    const bright = this.neighborIds;
    const dpr = this.dpr;

    for (const item of this.layout.events) {
      if (item.summary) continue;
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
      const { alpha, muted } = eventEmphasis(
        matches,
        bright.has(item.id) || item.id === this.hoveredId,
        hasSearch,
        hasSelection,
      );

      // The GL pass laid down the resting fill at this block's own emphasis. Painting a
      // semi-transparent state fill on top of that would double-composite — Canvas
      // blends the same state over the lane background instead. Reset to the lane
      // fill first (hover tint when that row is hovered) so both backends agree.
      const state = eventStateOf(item.id, this.selectedId, this.hoveredId);
      const fill = eventFill(item.color, state);
      if (state !== 'normal') {
        const laneId = this.layout.lanes[item.laneIndex]?.thread.id;
        ctx.globalAlpha = 1;
        ctx.fillStyle =
          laneId != null && laneId === this.hoveredLaneId ? LANE_HOVER_FILL : LANE_FILL;
        roundRectPath(ctx, r.x, r.y, r.w, r.h, r.r);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fill;
        roundRectPath(ctx, r.x, r.y, r.w, r.h, r.r);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Same visibility as Canvas fills: search misses omit labels; muted events gray the rest.
      if (matches) {
        drawEventLabel(
          ctx,
          ev.name,
          r.x,
          r.y,
          r.w,
          r.h,
          this.width,
          alpha,
          muted ? SELECTION_MUTED_LABEL : labelColorOn(fill),
          dpr,
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
  private hoveredLaneId: string | null = null;
  private neighborIds = new Set<string>();
  private depLinks: DependencyLink[] = [];
  private depMode: DependencyMode = 'all';
  private depDepth = DEFAULT_DEPENDENCY_DEPTH;
  private paintDependencies = true;
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

  /** Leaf lane under the pointer — tints that row's background only (AC-07). */
  setHoveredLane(laneId: string | null): void {
    this.hoveredLaneId = laneId;
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

  /** When false, skip dependency curves and selection muting (pinned-strip pass). */
  setPaintDependencies(enabled: boolean): void {
    if (enabled === this.paintDependencies) return;
    this.paintDependencies = enabled;
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
    if (!this.paintDependencies) {
      this.neighborIds = new Set();
      this.depLinks = [];
      return;
    }
    const graph = dependencyGraph(this.layout, this.selectedId, this.depMode, this.depDepth);
    this.neighborIds = graph.ids;
    this.depLinks = graph.links;
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = LANE_FILL;
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
      const lane = this.layout.lanes[i]!;
      const y = (lane.y - this.view.scrollY) * dpr;
      const laneH = LANE_HEIGHT * dpr;
      if (y + laneH < 0 || y > this.height) continue;
      ctx.fillStyle = lane.thread.id === this.hoveredLaneId ? LANE_HOVER_FILL : LANE_FILL;
      ctx.fillRect(0, y, this.width, laneH);
      ctx.strokeStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.moveTo(0, y + laneH - 0.5);
      ctx.lineTo(this.width, y + laneH - 0.5);
      ctx.stroke();
    }

    const span = Math.max(1, this.view.endTime - this.view.startTime);
    const q = this.searchQuery;
    const hasSearch = q.length > 0;
    const hasSelection = this.paintDependencies && this.selectedId != null;
    const bright = this.neighborIds;
    const visible: {
      item: LaidOutEvent;
      x: number;
      y: number;
      w: number;
      h: number;
      matches: boolean;
      alpha: number;
      muted: boolean;
      /** Carried from the fill pass so the label can pick its contrast off what was painted. */
      fill: string;
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

      // Summary bars are gray, non-interactive: full opacity, no label, no ring.
      if (item.summary) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = item.color;
        roundRectPath(ctx, fr.x, fr.y, fr.w, fr.h, fr.r);
        ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }

      const matches = !hasSearch || ev.name.toLowerCase().includes(q);
      const { alpha, muted } = eventEmphasis(
        matches,
        bright.has(item.id) || item.id === this.hoveredId,
        hasSearch,
        hasSelection,
      );
      const state = eventStateOf(item.id, this.selectedId, this.hoveredId);
      const fill = muted ? SELECTION_MUTED_FILL : eventFill(item.color, state);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      roundRectPath(ctx, fr.x, fr.y, fr.w, fr.h, fr.r);
      ctx.fill();
      ctx.globalAlpha = 1;
      visible.push({
        item,
        x: fr.x,
        y: fr.y,
        w: fr.w,
        h: fr.h,
        matches,
        alpha,
        muted,
        fill,
      });
    }

    if (this.paintDependencies) {
      paintDependencyLinksDevice(ctx, this.depLinks, this.view, this.width, this.dpr);
    }

    for (const { item, x, y, w, h, matches, alpha, muted, fill } of visible) {
      if (matches) {
        drawEventLabel(
          ctx,
          item.event.name,
          x,
          y,
          w,
          h,
          this.width,
          alpha,
          muted ? SELECTION_MUTED_LABEL : labelColorOn(fill),
          dpr,
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
  LANE_FILL,
  LANE_GROUP_HEADER_FILL,
  LANE_GROUP_HEADER_HEIGHT,
  LANE_HOVER_FILL,
  LANE_HEIGHT,
  LANE_PAD_Y,
  EVENT_MARGIN,
  eventRadius,
  eventBlockMetrics,
  eventLabelAnchor,
} from './layout';
