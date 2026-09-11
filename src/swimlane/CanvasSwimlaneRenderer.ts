import type {
  DependencyMode,
  SwimEvent,
  SwimlaneModel,
  SwimlaneRenderer,
  SwimlaneViewWindow,
} from '../domain/types';
import { DEFAULT_DEPENDENCY_DEPTH, normalizeDependencyDepth } from '../domain/types';
import { taskCountLabel } from '../i18n';
import { eventFill, eventStateOf, labelColorOn } from '../domain/laneColors';
import {
  cubicControlPull,
  dependencyGraph,
  dependencyStrokeWidth,
  depLinksForCollapsePaint,
  linkIntersectsTimeView,
  linkToScreen,
  type DependencyLink,
} from './dependencyLinks';
import {
  collapseAlpha,
  collapseClosedHeight,
  collapseShiftY,
  collapsePaintState,
  collectCollapseSummaries,
  collapseFoldsFromLayout,
  EMPTY_LAYOUT,
  eventPaintRect,
  IDLE_COLLAPSE,
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
  SUMMARY_LABEL_COLOR,
  type CollapseAnimState,
  type CollapseTransform,
  type LaidOutEvent,
  type SwimlaneLayout,
} from './layout';
import { EVENT_LABEL_FONT_CSS_PX, centeredTextBaseline, fitEventLabel } from './textAtlas';

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
  ctx.font = `400 ${Math.max(8, Math.round(EVENT_LABEL_FONT_CSS_PX * dpr))}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  const fit = fitEventLabel(ctx, name, anchor.maxWidth);
  if (fit.kind === 'skip') {
    ctx.restore();
    return;
  }
  const { baselineY, baseline } = centeredTextBaseline(ctx.measureText(fit.text), y + h / 2);
  ctx.textBaseline = baseline;
  if (fit.kind === 'shrink') {
    // Horizontal-only shrink around the label center; vertical metrics are untouched.
    ctx.translate(anchor.cx, baselineY);
    ctx.scale(fit.scaleX, 1);
    ctx.fillText(fit.text, 0, 0);
  } else {
    ctx.fillText(fit.text, anchor.cx, baselineY);
  }
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

/** Paint folder summary bars (rest-collapsed α=1 and tween ghosts). */
function paintCollapseSummaries(
  ctx: CanvasRenderingContext2D,
  items: readonly LaidOutEvent[],
  collapse: CollapseTransform,
  view: SwimlaneViewWindow,
  width: number,
  height: number,
  dpr: number,
  selectedId: string | null,
  hoveredId: string | null,
): void {
  if (items.length === 0) return;
  const span = Math.max(1, view.endTime - view.startTime);
  for (const item of items) {
    const ev = item.event;
    const alpha = item.alpha ?? 1;
    if (alpha <= 0) continue;
    if (ev.startTime + ev.duration < view.startTime || ev.startTime > view.endTime) continue;
    const x = ((ev.startTime - view.startTime) / span) * width;
    const w = Math.max(2, (ev.duration / span) * width);
    const metrics = eventBlockMetrics(collapseShiftY(item.y, collapse), view.scrollY);
    const y = metrics.y * dpr;
    const h = metrics.h * dpr;
    if (y + h < 0 || y > height) continue;
    const fr = eventPaintRect(x, y, w, h, dpr);
    const eventState = eventStateOf(item.id, selectedId, hoveredId);
    const fill = eventFill(item.color, eventState);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    roundRectPath(ctx, fr.x, fr.y, fr.w, fr.h, fr.r);
    ctx.fill();
    drawEventLabel(
      ctx,
      taskCountLabel(ev.taskCount ?? 0),
      fr.x,
      fr.y,
      fr.w,
      fr.h,
      width,
      alpha,
      SUMMARY_LABEL_COLOR,
      dpr,
    );
    ctx.globalAlpha = 1;
  }
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
  private collapse: CollapseTransform = IDLE_COLLAPSE;
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private hoveredLaneId: string | null = null;
  private neighborIds = new Set<string>();
  private searchQuery = '';
  /** When false, skip selection gray-muting (tests / overlays that opt out). */
  private selectionMuted = true;
  /** When false, the WebGL backend owns event labels (ClearType); overlay skips them. */
  private drawEventLabels = true;
  private width = 0;
  private height = 0;
  private dpr = 1;
  /** Full collapse state — ghost summaryEvents painted during the tween. */
  private collapseState: CollapseAnimState | null = null;
  private collapsedIds: readonly string[] = [];
  private summaryCache = new Map<string, SwimEvent[]>();
  private paintSummaries: readonly LaidOutEvent[] = [];

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
    this.summaryCache.clear();
    this.refreshCollapse();
  }

  setCollapsedIds(ids: readonly string[]): void {
    if (ids === this.collapsedIds || (ids.length === this.collapsedIds.length && ids.every((id, i) => id === this.collapsedIds[i]))) {
      return;
    }
    this.collapsedIds = ids;
    this.refreshCollapse();
  }

  /** Per-frame collapse/expand transform (see layout.collapseFoldsFromLayout). */
  setCollapseAnim(state: CollapseAnimState | null): void {
    this.collapseState = state;
    this.refreshCollapse();
  }

  private refreshCollapse(): void {
    this.collapse = collapseFoldsFromLayout(this.layout, this.collapsedIds, this.collapseState);
    this.paintSummaries = collectCollapseSummaries(
      this.layout,
      this.collapsedIds,
      this.collapseState,
      this.summaryCache,
    );
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

  /** WebGL ClearType path draws its own event labels; overlay must not double-draw. */
  setDrawEventLabels(enabled: boolean): void {
    this.drawEventLabels = enabled;
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

    for (let i = 0; i < this.layout.lanes.length; i++) {
      const lane = this.layout.lanes[i]!;
      if (collapseAlpha(lane.y, this.collapse) <= 0) continue;
      for (const item of this.layout.eventsByLane[i] ?? []) {
      const ev = item.event;
      if (ev.startTime + ev.duration < this.view.startTime || ev.startTime > this.view.endTime) {
        continue;
      }
      const laneY = collapseShiftY(item.y, this.collapse);
      const laneAlpha = collapseAlpha(item.y, this.collapse);
      if (laneAlpha <= 0) continue;
      const x = ((ev.startTime - this.view.startTime) / span) * this.width;
      const w = Math.max(2, (ev.duration / span) * this.width);
      const metrics = eventBlockMetrics(laneY, this.view.scrollY);
      const y = metrics.y * dpr;
      const h = metrics.h * dpr;
      if (y + h < 0 || y > this.height) continue;
      const r = eventPaintRect(x, y, w, h, dpr);

      // Summary bars: the GL pass painted the resting gray (source-over); repaint the
      // hover lift and draw the dimmed task-count label. Never dimmed/selected/ringed.
      if (item.summary) {
        const state = eventStateOf(item.id, this.selectedId, this.hoveredId);
        const fill = eventFill(item.color, state);
        if (state !== 'normal') {
          const laneId = this.layout.lanes[item.laneIndex]?.thread.id;
          ctx.globalAlpha = 1;
          ctx.fillStyle =
            laneId != null && laneId === this.hoveredLaneId ? LANE_HOVER_FILL : LANE_FILL;
          roundRectPath(ctx, r.x, r.y, r.w, r.h, r.r);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = fill;
          roundRectPath(ctx, r.x, r.y, r.w, r.h, r.r);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        drawEventLabel(
          ctx,
          taskCountLabel(ev.taskCount ?? 0),
          r.x,
          r.y,
          r.w,
          r.h,
          this.width,
          1,
          SUMMARY_LABEL_COLOR,
          dpr,
        );
        continue;
      }

      const matches = !hasSearch || ev.name.toLowerCase().includes(q);
      const { alpha: emphAlpha, muted } = eventEmphasis(
        matches,
        bright.has(item.id) || item.id === this.hoveredId,
        hasSearch,
        hasSelection,
      );
      const alpha = emphAlpha * laneAlpha;

      // The GL pass laid down the resting fill at this block's own emphasis. Painting a
      // semi-transparent state fill on top of that would double-composite — Canvas
      // blends the same state over the lane background instead. Reset to the lane
      // fill first (hover tint when that row is hovered) so both backends agree.
      const state = eventStateOf(item.id, this.selectedId, this.hoveredId);
      const fill = eventFill(item.color, state);
      if (state !== 'normal') {
        const laneId = this.layout.lanes[item.laneIndex]?.thread.id;
        ctx.globalAlpha = laneAlpha;
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
      // When the WebGL backend owns labels (ClearType), non-resting blocks still get their label
      // here: the opaque state fill painted above covers the GL label, and the label's contrast
      // must match that fill.
      if (matches && (this.drawEventLabels || state !== 'normal')) {
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
    }

    // Folder summary ghosts / rest-collapsed bars (PR-RENDER-028 / PR-RENDER-047).
    paintCollapseSummaries(
      ctx,
      this.paintSummaries,
      this.collapse,
      this.view,
      this.width,
      this.height,
      dpr,
      this.selectedId,
      this.hoveredId,
    );

    // Cursor is a DOM overlay under Card strips (SwimlaneView); not painted here.
  }

  dispose(): void {
    this.canvas = null;
    this.ctx = null;
    this.layout = EMPTY_LAYOUT;
    this.collapse = IDLE_COLLAPSE;
    this.collapseState = null;
    this.collapsedIds = [];
    this.summaryCache.clear();
    this.paintSummaries = [];
    this.neighborIds = new Set();
  }
}

/** Canvas 2D SwimlaneRenderer (COMPONENTS). Fallback when WebGL2 is unavailable. */
export class CanvasSwimlaneRenderer implements SwimlaneRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  /** Expanded layout the collapse tween interpolates from; paint uses this + `collapse`. */
  private baseLayout: SwimlaneLayout = EMPTY_LAYOUT;
  private layout: SwimlaneLayout = EMPTY_LAYOUT;
  /** Shifted layout for hit-test / magnetize / eventScreenRect (matches paint). */
  private hitLayout: SwimlaneLayout = EMPTY_LAYOUT;
  private view: SwimlaneViewWindow = { startTime: 0, endTime: 1, scrollY: 0 };
  private collapse: CollapseTransform = IDLE_COLLAPSE;
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
  private collapseState: CollapseAnimState | null = null;
  private collapsedIds: readonly string[] = [];
  private summaryCache = new Map<string, SwimEvent[]>();
  private paintSummaries: readonly LaidOutEvent[] = [];

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
    this.baseLayout = rebuildLayout(model);
    this.layout = this.baseLayout;
    this.collapsedIds = [];
    this.summaryCache.clear();
    this.collapseState = null;
    this.collapse = IDLE_COLLAPSE;
    this.hitLayout = this.baseLayout;
    this.paintSummaries = [];
    this.refreshDepCache();
  }

  setCollapsedIds(ids: readonly string[]): void {
    if (ids === this.collapsedIds || (ids.length === this.collapsedIds.length && ids.every((id, i) => id === this.collapsedIds[i]))) {
      return;
    }
    this.collapsedIds = ids;
    this.refreshCollapse();
  }

  /** Per-frame collapse/expand transform applied inline in `render` (no layout rebuild). */
  setCollapseAnim(state: CollapseAnimState | null): void {
    this.collapseState = state;
    this.refreshCollapse();
  }

  private refreshCollapse(): void {
    const next = collapsePaintState(
      this.baseLayout,
      this.collapsedIds,
      this.collapseState,
      this.summaryCache,
    );
    this.collapse = next.collapse;
    this.hitLayout = next.hitLayout;
    this.paintSummaries = next.hitLayout.summaryExtras ?? [];
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

  /** When false, skip dependency curves (pinned-strip pass). Selection muting still applies. */
  setPaintDependencies(enabled: boolean): void {
    if (enabled === this.paintDependencies) return;
    this.paintDependencies = enabled;
    this.refreshDepCache();
  }


  contentHeight(): number {
    return Math.max(0, contentHeightFromLayout(this.baseLayout) - collapseClosedHeight(this.collapse));
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

  /** Cached curve geometry; empty when `setPaintDependencies(false)` (pinned-strip pass). */
  getDepLinks(): readonly DependencyLink[] {
    return this.depLinks;
  }

  eventScreenRect(eventId: string): { x: number; y: number; w: number; h: number } | null {
    const item = findLaidOutEvent(this.hitLayout, eventId);
    if (!item) return null;
    return eventScreenRect(item, this.view, this.width, this.dpr, this.collapse);
  }

  hitTest(x: number, y: number): string | null {
    return hitTestLayout(this.hitLayout, this.view, this.width, x, y, this.dpr);
  }

  findEvent(id: string): SwimEvent | null {
    return findEvent(this.hitLayout, id);
  }

  private refreshDepCache(): void {
    // Neighbor ids drive selection muting on every surface (including the pinned strip).
    // Curves stay body-only: drop link geometry when paintDependencies is false.
    const graph = dependencyGraph(this.layout, this.selectedId, this.depMode, this.depDepth);
    this.neighborIds = graph.ids;
    this.depLinks = this.paintDependencies ? graph.links : [];
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = LANE_FILL;
    ctx.fillRect(0, 0, this.width, this.height);

    const dpr = this.dpr;

    for (const header of this.layout.headers) {
      const headerTop = (collapseShiftY(header.y, this.collapse) - this.view.scrollY) * dpr;
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
      const laneAlpha = collapseAlpha(lane.y, this.collapse);
      if (laneAlpha <= 0) continue;
      const y = (collapseShiftY(lane.y, this.collapse) - this.view.scrollY) * dpr;
      const laneH = lane.rowCount * LANE_HEIGHT * dpr;
      if (y + laneH < 0 || y > this.height) continue;
      ctx.globalAlpha = laneAlpha;
      ctx.fillStyle = lane.thread.id === this.hoveredLaneId ? LANE_HOVER_FILL : LANE_FILL;
      ctx.fillRect(0, y, this.width, laneH);
      ctx.strokeStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.moveTo(0, y + laneH - 0.5);
      ctx.lineTo(this.width, y + laneH - 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

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
      alpha: number;
      muted: boolean;
      /** Carried from the fill pass so the label can pick its contrast off what was painted. */
      fill: string;
    }[] = [];

    for (let i = 0; i < this.layout.lanes.length; i++) {
      if (collapseAlpha(this.layout.lanes[i]!.y, this.collapse) <= 0) continue;
      for (const item of this.layout.eventsByLane[i] ?? []) {
      const ev = item.event;
      if (ev.startTime + ev.duration < this.view.startTime || ev.startTime > this.view.endTime) {
        continue;
      }
      const x = ((ev.startTime - this.view.startTime) / span) * this.width;
      const w = Math.max(2, (ev.duration / span) * this.width);
      const metrics = eventBlockMetrics(collapseShiftY(item.y, this.collapse), this.view.scrollY);
      const y = metrics.y * dpr;
      const h = metrics.h * dpr;
      if (y + h < 0 || y > this.height) continue;
      const fr = eventPaintRect(x, y, w, h, dpr);

      // Summary bars: gray fill with a hover lift and a dimmed task-count label;
      // never dimmed by search/selection or selected/ringed. Click-to-expand is the host's job.
      if (item.summary) {
        const state = eventStateOf(item.id, this.selectedId, this.hoveredId);
        const fill = eventFill(item.color, state);
        ctx.globalAlpha = 1;
        ctx.fillStyle = fill;
        roundRectPath(ctx, fr.x, fr.y, fr.w, fr.h, fr.r);
        ctx.fill();
        ctx.globalAlpha = 1;
        drawEventLabel(
          ctx,
          taskCountLabel(ev.taskCount ?? 0),
          fr.x,
          fr.y,
          fr.w,
          fr.h,
          this.width,
          1,
          SUMMARY_LABEL_COLOR,
          dpr,
        );
        continue;
      }

      const matches = !hasSearch || ev.name.toLowerCase().includes(q);
      const { alpha: emphAlpha, muted } = eventEmphasis(
        matches,
        bright.has(item.id) || item.id === this.hoveredId,
        hasSearch,
        hasSelection,
      );
      const alpha = emphAlpha * collapseAlpha(item.y, this.collapse);
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
    }

    paintCollapseSummaries(
      ctx,
      this.paintSummaries,
      this.collapse,
      this.view,
      this.width,
      this.height,
      dpr,
      this.selectedId,
      this.hoveredId,
    );

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

    // Dependency curves draw above event labels.
    if (this.paintDependencies) {
      paintDependencyLinksDevice(
        ctx,
        depLinksForCollapsePaint(this.depLinks, this.collapse),
        this.view,
        this.width,
        this.dpr,
      );
    }

    // Cursor is a DOM overlay under Card strips (SwimlaneView); not painted here.
  }

  dispose(): void {
    this.canvas = null;
    this.ctx = null;
    this.baseLayout = EMPTY_LAYOUT;
    this.layout = EMPTY_LAYOUT;
    this.hitLayout = EMPTY_LAYOUT;
    this.collapse = IDLE_COLLAPSE;
    this.collapseState = null;
    this.collapsedIds = [];
    this.summaryCache.clear();
    this.paintSummaries = [];
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
