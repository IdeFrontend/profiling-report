import type {
  SwimEvent,
  SwimlaneModel,
  SwimlaneRenderer,
  SwimlaneViewWindow,
  SwimThread,
} from '../core/types';

export const LANE_HEIGHT = 22;
export const LANE_PAD_Y = 3;

const COLOR: Record<string, string> = {
  cube: '#007084',
  vector: '#007464',
  mte1: '#885C00',
  mte2: '#985000',
  mte3: '#A44830',
  fixp: '#586C0C',
  scalar: '#38702C',
  default: '#3860A8',
};

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

function colorForThread(name: string): string {
  const n = name.toUpperCase();
  if (n.includes('PIPE_V') || n.includes('VEC')) return COLOR.vector;
  if (n.includes('PIPE_S') || n.includes('SCALAR')) return COLOR.scalar;
  if (n.includes('MTE1')) return COLOR.mte1;
  if (n.includes('MTE2')) return COLOR.mte2;
  if (n.includes('MTE3')) return COLOR.mte3;
  if (n.includes('FIX')) return COLOR.fixp;
  if (n.includes('CUBE')) return COLOR.cube;
  return COLOR.default;
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

  contentHeight(): number {
    return this.lanes.length * LANE_HEIGHT;
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
    const candidates = this.events
      .map((item) => {
        const rect = this.eventScreenRect(item.id);
        if (!rect) return null;
        if (x < rect.x || x > rect.x + rect.w || y < rect.y || y > rect.y + rect.h) {
          return null;
        }
        return { id: item.id, duration: item.event.duration };
      })
      .filter((c): c is { id: string; duration: number } => c != null);
    if (candidates.length === 0) return null;
    // Prefer shorter events (nested markers)
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
      ctx.globalAlpha = q && !matches ? 0.25 : 1;
      ctx.fillStyle = item.color;
      ctx.fillRect(x, y, w, h);

      if (item.id === this.selectedId) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      } else if (item.id === this.hoveredId) {
        ctx.strokeStyle = '#c8e0ff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      }

      if (w > 40 && matches) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(ev.name, x + 4, y + h - 6, w - 8);
      }
      ctx.globalAlpha = 1;
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
    let y = 0;
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
