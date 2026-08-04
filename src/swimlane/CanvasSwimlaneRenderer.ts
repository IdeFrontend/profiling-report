import type {
  SwimEvent,
  SwimlaneModel,
  SwimlaneRenderer,
  SwimlaneViewWindow,
  SwimThread,
} from '../core/types';
import { colorForThread } from '../core/laneColors';

export const LANE_HEIGHT = 22;
export const LANE_PAD_Y = 3;
/** Matches `.pr-gutter__group` height so canvas lanes align with gutter labels. */
export const LANE_GROUP_HEADER_HEIGHT = 28;
/** Corner radius for event blocks (sketch / design: rounded, not sharp). */
export const EVENT_RADIUS = 5;

interface FlatLane {
  thread: SwimThread;
  y: number;
  color: string;
}

interface LaidOutEvent {
  id: string;
  event: SwimEvent;
  laneIndex: number;
  y: number;
  color: string;
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

/** Canvas 2D SwimlaneRenderer (COMPONENTS). Layout + hit-test are independent of pixels. */
export class CanvasSwimlaneRenderer implements SwimlaneRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private model: SwimlaneModel | null = null;
  private view: SwimlaneViewWindow = { startTime: 0, endTime: 1, scrollY: 0 };
  private lanes: FlatLane[] = [];
  private events: LaidOutEvent[] = [];
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
    this.model = model;
    this.rebuildLayout();
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

  /** CSS-pixel x of mouse cursor within the canvas, or null when absent. */
  setCursorX(x: number | null): void {
    this.cursorX = x;
  }

  contentHeight(): number {
    return LANE_GROUP_HEADER_HEIGHT + this.lanes.length * LANE_HEIGHT;
  }

  /** Map event id → CSS-pixel rect in current view (for tests / overlays). */
  eventScreenRect(eventId: string): { x: number; y: number; w: number; h: number } | null {
    const item = this.events.find((e) => e.id === eventId);
    if (!item) return null;
    const span = Math.max(1, this.view.endTime - this.view.startTime);
    const x = ((item.event.startTime - this.view.startTime) / span) * this.width;
    const w = Math.max(2, (item.event.duration / span) * this.width);
    const y = item.y - this.view.scrollY + LANE_PAD_Y;
    const h = LANE_HEIGHT - LANE_PAD_Y * 2;
    return { x, y, w, h };
  }

  hitTest(x: number, y: number): string | null {
    const contentY = y + this.view.scrollY;
    const lane = this.lanes.find((l) => contentY >= l.y && contentY < l.y + LANE_HEIGHT);
    if (!lane) return null;
    const laneIndex = this.lanes.indexOf(lane);
    const span = Math.max(1, this.view.endTime - this.view.startTime);
    const candidates: { id: string; duration: number }[] = [];
    for (const item of this.events) {
      if (item.laneIndex !== laneIndex) continue;
      const ev = item.event;
      if (ev.startTime + ev.duration < this.view.startTime || ev.startTime > this.view.endTime) {
        continue;
      }
      const ex = ((ev.startTime - this.view.startTime) / span) * this.width;
      const ew = Math.max(2, (ev.duration / span) * this.width);
      const ey = item.y - this.view.scrollY + LANE_PAD_Y;
      const eh = LANE_HEIGHT - LANE_PAD_Y * 2;
      if (x >= ex && x <= ex + ew && y >= ey && y <= ey + eh) {
        candidates.push({ id: item.id, duration: ev.duration });
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.duration - b.duration);
    return candidates[0]!.id;
  }

  findEvent(id: string): SwimEvent | null {
    return this.events.find((e) => e.id === id)?.event ?? null;
  }

  render(): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#252525';
    ctx.fillRect(0, 0, this.width, this.height);

    // Spacer matching gutter process/group header ("Kernel")
    const headerTop = -this.view.scrollY;
    if (headerTop + LANE_GROUP_HEADER_HEIGHT > 0 && headerTop < this.height) {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, headerTop, this.width, LANE_GROUP_HEADER_HEIGHT);
      ctx.strokeStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.moveTo(0, headerTop + LANE_GROUP_HEADER_HEIGHT - 0.5);
      ctx.lineTo(this.width, headerTop + LANE_GROUP_HEADER_HEIGHT - 0.5);
      ctx.stroke();
    }

    // Alternating lane stripes (sketch-like density)
    for (let i = 0; i < this.lanes.length; i++) {
      const y = this.lanes[i]!.y - this.view.scrollY;
      if (y + LANE_HEIGHT < 0 || y > this.height) continue;
      ctx.fillStyle = i % 2 === 0 ? '#2a2a2a' : '#262626';
      ctx.fillRect(0, y, this.width, LANE_HEIGHT);
      ctx.strokeStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.moveTo(0, y + LANE_HEIGHT - 0.5);
      ctx.lineTo(this.width, y + LANE_HEIGHT - 0.5);
      ctx.stroke();
    }

    const span = Math.max(1, this.view.endTime - this.view.startTime);
    const q = this.searchQuery;
    const hasSelection = this.selectedId != null;

    for (const item of this.events) {
      const ev = item.event;
      if (ev.startTime + ev.duration < this.view.startTime || ev.startTime > this.view.endTime) {
        continue;
      }
      const x = ((ev.startTime - this.view.startTime) / span) * this.width;
      const w = Math.max(2, (ev.duration / span) * this.width);
      const y = item.y - this.view.scrollY + LANE_PAD_Y;
      const h = LANE_HEIGHT - LANE_PAD_Y * 2;
      if (y + h < 0 || y > this.height) continue;

      const matches = !q || ev.name.toLowerCase().includes(q);
      const dim =
        (q && !matches ? 0.25 : 1) * (hasSelection && item.id !== this.selectedId ? 0.45 : 1);
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

      if (w > 40 && matches) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(ev.name, x + 4, y + h - 6, Math.max(8, w - 8));
      }
      ctx.globalAlpha = 1;
    }

    // Mouse-following timestamp cursor — solid line (sketch)
    if (this.cursorX != null && this.cursorX >= 0 && this.cursorX <= this.width) {
      ctx.save();
      ctx.strokeStyle = '#3078F0';
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
    this.model = null;
    this.lanes = [];
    this.events = [];
  }

  private rebuildLayout(): void {
    this.lanes = [];
    this.events = [];
    if (!this.model) return;
    // Offset by group header so lane 0 lines up with first gutter label, not "Kernel"
    let y = LANE_GROUP_HEADER_HEIGHT;
    for (const proc of this.model.processes) {
      for (const thread of proc.threads) {
        const color = colorForThread(thread.name);
        this.lanes.push({ thread, y, color });
        // Shorter events later in list so hit-test sort still works; draw long first
        const sorted = [...thread.events].sort((a, b) => b.duration - a.duration);
        for (const ev of sorted) {
          this.events.push({ id: ev.id, event: ev, laneIndex: this.lanes.length - 1, y, color });
        }
        y += LANE_HEIGHT;
      }
    }
  }
}
