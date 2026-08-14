import type { SwimEvent, SwimlaneBand, SwimlaneModel, SwimlaneViewWindow, SwimThread } from '../domain/types';
import { colorForThread } from '../domain/laneColors';
import { walkVisibleRows } from '../domain/swimTree';

export const LANE_HEIGHT = 22;
export const LANE_PAD_Y = 3;
/** Matches `.pr-gutter__group` height so canvas lanes align with gutter labels. */
export const LANE_GROUP_HEADER_HEIGHT = 28;
/** Corner radius for event blocks (Canvas fills/strokes + WebGL SDF fills). */
export const EVENT_RADIUS = 5;
/** Fill for ProfilerStep-style group bands (v930 sketch ~#2c2c2c on #1f1f1f lanes). */
export const BAND_FILL = '#2c2c2c';

/** Max quads per mesh (ushort indices: 65536 / 4 vertices). */
export const MAX_QUADS_PER_MESH = 0x1_00_00 / 4;

export interface FlatLane {
  thread: SwimThread;
  y: number;
  color: string;
  /** Nested folder row: reserves height, no events painted. */
  folder?: boolean;
  depth: number;
}

export interface GroupHeader {
  id: string;
  name: string;
  y: number;
}

export interface LaidOutEvent {
  id: string;
  event: SwimEvent;
  laneIndex: number;
  y: number;
  color: string;
}

export interface SwimlaneLayout {
  lanes: FlatLane[];
  headers: GroupHeader[];
  events: LaidOutEvent[];
  /** Shared phase bands; empty when model omits them. */
  bands: SwimlaneBand[];
}

/** Folder rows and depth-0 spacer leaves (通信 / 储存HBM) show ProfilerStep bands. */
export function showsProfilerStepBands(lane: FlatLane): boolean {
  return lane.folder === true || (lane.depth === 0 && lane.thread.events.length === 0);
}

export function contentHeightFromLayout(layout: SwimlaneLayout): number {
  if (layout.headers.length === 0 && layout.lanes.length === 0) {
    return LANE_GROUP_HEADER_HEIGHT + LANE_HEIGHT;
  }
  let bottom = 0;
  for (const h of layout.headers) {
    bottom = Math.max(bottom, h.y + LANE_GROUP_HEADER_HEIGHT);
  }
  for (const l of layout.lanes) {
    bottom = Math.max(bottom, l.y + LANE_HEIGHT);
  }
  return bottom;
}

export function contentHeightFromModel(model: SwimlaneModel | null): number {
  if (!model) return 120;
  const rows = walkVisibleRows(model);
  let h = 0;
  for (const row of rows) {
    h += row.kind === 'header' ? LANE_GROUP_HEADER_HEIGHT : LANE_HEIGHT;
  }
  return Math.max(120, h || LANE_GROUP_HEADER_HEIGHT + LANE_HEIGHT);
}

export function rebuildLayout(model: SwimlaneModel | null): SwimlaneLayout {
  const lanes: FlatLane[] = [];
  const headers: GroupHeader[] = [];
  const events: LaidOutEvent[] = [];
  const bands = model?.bands ?? [];
  if (!model) return { lanes, headers, events, bands };

  let y = 0;
  for (const row of walkVisibleRows(model)) {
    if (row.kind === 'header') {
      headers.push({ id: row.process.id, name: row.process.name, y });
      y += LANE_GROUP_HEADER_HEIGHT;
      continue;
    }
    const thread = row.thread;
    const color = colorForThread(thread.name);
    if (row.kind === 'folder') {
      lanes.push({ thread, y, color, folder: true, depth: row.depth });
      y += LANE_HEIGHT;
      continue;
    }
    lanes.push({ thread, y, color, depth: row.depth });
    const sorted = [...thread.events].sort((a, b) => b.duration - a.duration);
    for (const ev of sorted) {
      events.push({ id: ev.id, event: ev, laneIndex: lanes.length - 1, y, color });
    }
    y += LANE_HEIGHT;
  }
  return { lanes, headers, events, bands };
}

/** Event block height and Y, vertically centered in the lane between row dividers. */
export function eventBlockMetrics(laneY: number, scrollY: number): { y: number; h: number } {
  const h = LANE_HEIGHT - LANE_PAD_Y * 2;
  // -0.5: optical nudge so bars sit centered against the 1px gutter-aligned divider.
  return { y: laneY - scrollY + (LANE_HEIGHT - h) / 2 - 0.5, h };
}

/** Content-space Y of an event block's vertical midpoint (pre-scroll). */
export function eventLinkContentY(laneY: number): number {
  return laneY + LANE_HEIGHT / 2 - 0.5;
}

/**
 * Horizontal label anchor: center in the on-screen intersection of the event rect.
 * Fully visible → center of the event; clipped → center of the visible portion.
 * Returns null when the visible width is too narrow for a label.
 */
export function eventLabelAnchor(
  x: number,
  w: number,
  viewW: number,
): { cx: number; maxWidth: number } | null {
  const left = Math.max(0, x);
  const right = Math.min(viewW, x + w);
  const visibleW = right - left;
  if (visibleW <= 40) return null;
  return { cx: (left + right) / 2, maxWidth: Math.max(8, visibleW - 8) };
}

export function eventScreenRect(
  item: LaidOutEvent,
  view: SwimlaneViewWindow,
  width: number,
): { x: number; y: number; w: number; h: number } {
  const span = Math.max(1, view.endTime - view.startTime);
  const x = ((item.event.startTime - view.startTime) / span) * width;
  const w = Math.max(2, (item.event.duration / span) * width);
  const { y, h } = eventBlockMetrics(item.y, view.scrollY);
  return { x, y, w, h };
}

/** Prefer shorter nested events (same as Canvas MVP). */
export function hitTestLayout(
  layout: SwimlaneLayout,
  view: SwimlaneViewWindow,
  width: number,
  x: number,
  y: number,
): string | null {
  const contentY = y + view.scrollY;
  const lane = layout.lanes.find((l) => contentY >= l.y && contentY < l.y + LANE_HEIGHT);
  if (!lane || lane.folder) return null;
  const laneIndex = layout.lanes.indexOf(lane);
  const span = Math.max(1, view.endTime - view.startTime);
  const candidates: { id: string; duration: number }[] = [];
  for (const item of layout.events) {
    if (item.laneIndex !== laneIndex) continue;
    const ev = item.event;
    if (ev.startTime + ev.duration < view.startTime || ev.startTime > view.endTime) continue;
    const ex = ((ev.startTime - view.startTime) / span) * width;
    const ew = Math.max(2, (ev.duration / span) * width);
    const { y: ey, h: eh } = eventBlockMetrics(item.y, view.scrollY);
    if (x >= ex && x <= ex + ew && y >= ey && y <= ey + eh) {
      candidates.push({ id: item.id, duration: ev.duration });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.duration - b.duration);
  return candidates[0]!.id;
}

export function findLaidOutEvent(layout: SwimlaneLayout, id: string): LaidOutEvent | undefined {
  return layout.events.find((e) => e.id === id);
}

export function findEvent(layout: SwimlaneLayout, id: string): SwimEvent | null {
  return findLaidOutEvent(layout, id)?.event ?? null;
}

/** Encode [start,end] relative to base for float32 VBOs; keep end > start after fround. */
export function encodeIntervalPair(
  start: number,
  duration: number,
  base: number,
): [number, number] {
  const f0 = Math.fround(start - base);
  let f1 = Math.fround(start + duration - base);
  if (!(f1 > f0)) {
    // Float32 collapsed a short/large-magnitude interval — nudge end by ≥1ns (rel).
    f1 = Math.fround(f0 + Math.max(1, Math.fround(duration) || 1));
    if (!(f1 > f0)) f1 = f0 + 1;
  }
  return [f0, f1];
}

/** Canvas/WebGL fill+label opacity: search miss → 0.25, non-emphasized when selection → ×0.45.
 * Callers pass `isSelected=true` for the clicked event and its laid-out dep neighbors. */
export function eventEmphasisDim(
  matchesSearch: boolean,
  isSelected: boolean,
  hasSearch: boolean,
  hasSelection: boolean,
): number {
  return (hasSearch && !matchesSearch ? 0.25 : 1) * (hasSelection && !isSelected ? 0.45 : 1);
}

/** Parse `#RRGGBB` → RGB in 0..1. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = Number.parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}
