import type { SwimEvent, SwimlaneBand, SwimlaneModel, SwimlaneViewWindow, SwimThread } from '../domain/types';
import { colorForThread } from '../domain/laneColors';
import { walkVisibleRows } from '../domain/swimTree';

export const LANE_HEIGHT = 22;
export const LANE_PAD_Y = 3;
/** Matches `.pr-gutter__group` height so canvas lanes align with gutter labels. */
export const LANE_GROUP_HEADER_HEIGHT = 28;
/** Card / root group-header strip across gutter + swimlane (`rgb(42, 42, 42)`). */
export const LANE_GROUP_HEADER_FILL = '#2a2a2a';
/** Card strip hover fill (`rgb(50, 50, 50)`); DOM only — canvas headers stay static. */
export const LANE_GROUP_HEADER_HOVER = '#323232';
/** Snap a CSS px value onto the device-pixel grid (crisp edges at fractional browser zoom). */
export function snapCssPx(v: number, dpr: number): number {
  return Math.round(v * dpr) / dpr;
}

/** Snap a CSS rect so all four edges land on device pixels. Min size = 1 device px. */
export function snapEventRect(
  x: number,
  y: number,
  w: number,
  h: number,
  dpr: number,
): { x: number; y: number; w: number; h: number } {
  const x0 = snapCssPx(x, dpr);
  const y0 = snapCssPx(y, dpr);
  const x1 = snapCssPx(x + w, dpr);
  const y1 = snapCssPx(y + h, dpr);
  const min = 1 / dpr;
  return { x: x0, y: y0, w: Math.max(min, x1 - x0), h: Math.max(min, y1 - y0) };
}

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
  eventsById: Map<string, LaidOutEvent>;
  lanesByTid: Map<string, FlatLane>;
  /** Events for each lane index (contiguous groups from rebuild); folders are `[]`. */
  eventsByLane: LaidOutEvent[][];
}

export const EMPTY_LAYOUT: SwimlaneLayout = {
  lanes: [],
  headers: [],
  events: [],
  bands: [],
  eventsById: new Map(),
  lanesByTid: new Map(),
  eventsByLane: [],
};

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

/**
 * Card header Y positions only — same row walk as `rebuildLayout`, without sorting/pushing events.
 * Use for DOM Card strips so collapse toggles are not O(events).
 */
export function layoutHeaders(model: SwimlaneModel | null): GroupHeader[] {
  if (!model) return [];
  const headers: GroupHeader[] = [];
  let y = 0;
  for (const row of walkVisibleRows(model)) {
    if (row.kind === 'header') {
      headers.push({ id: row.process.id, name: row.process.name, y });
      y += LANE_GROUP_HEADER_HEIGHT;
    } else {
      y += LANE_HEIGHT;
    }
  }
  return headers;
}

export function rebuildLayout(model: SwimlaneModel | null): SwimlaneLayout {
  if (!model) {
    return {
      lanes: [],
      headers: [],
      events: [],
      bands: [],
      eventsById: new Map(),
      lanesByTid: new Map(),
      eventsByLane: [],
    };
  }
  const lanes: FlatLane[] = [];
  const headers: GroupHeader[] = [];
  const events: LaidOutEvent[] = [];
  const eventsById = new Map<string, LaidOutEvent>();
  const lanesByTid = new Map<string, FlatLane>();
  const eventsByLane: LaidOutEvent[][] = [];
  const bands = model.bands ?? [];

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
      const lane: FlatLane = { thread, y, color, folder: true, depth: row.depth };
      lanes.push(lane);
      lanesByTid.set(thread.id, lane);
      eventsByLane.push([]);
      y += LANE_HEIGHT;
      continue;
    }
    const lane: FlatLane = { thread, y, color, depth: row.depth };
    lanes.push(lane);
    lanesByTid.set(thread.id, lane);
    const laneEvents: LaidOutEvent[] = [];
    const sorted = [...thread.events].sort((a, b) => b.duration - a.duration);
    for (const ev of sorted) {
      const item: LaidOutEvent = { id: ev.id, event: ev, laneIndex: lanes.length - 1, y, color };
      events.push(item);
      eventsById.set(ev.id, item);
      laneEvents.push(item);
    }
    eventsByLane.push(laneEvents);
    y += LANE_HEIGHT;
  }
  return { lanes, headers, events, bands, eventsById, lanesByTid, eventsByLane };
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
  for (const item of layout.eventsByLane[laneIndex] ?? []) {
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
  return layout.eventsById.get(id);
}

export function findEvent(layout: SwimlaneLayout, id: string): SwimEvent | null {
  return findLaidOutEvent(layout, id)?.event ?? null;
}

export type EventEdgeKind = 'start' | 'end';

export interface NearestEventEdge {
  time: number;
  edge: EventEdgeKind;
  eventId: string;
  xPx: number;
}

/** Magnet: nearest start/end on the leaf lane under (x,y), if within thresholdPx. */
export function nearestEventEdgeAtPoint(
  layout: SwimlaneLayout,
  view: SwimlaneViewWindow,
  width: number,
  x: number,
  y: number,
  thresholdPx: number,
): NearestEventEdge | null {
  const contentY = y + view.scrollY;
  const lane = layout.lanes.find((l) => contentY >= l.y && contentY < l.y + LANE_HEIGHT);
  if (!lane || lane.folder) return null;
  const laneIndex = layout.lanes.indexOf(lane);
  const span = Math.max(1, view.endTime - view.startTime);
  const w = Math.max(1, width);
  let best: NearestEventEdge | null = null;
  let bestDist = Infinity;
  for (const item of layout.eventsByLane[laneIndex] ?? []) {
    const ev = item.event;
    const end = ev.startTime + ev.duration;
    if (end < view.startTime || ev.startTime > view.endTime) continue;
    const startX = ((ev.startTime - view.startTime) / span) * w;
    const endX = ((end - view.startTime) / span) * w;
    for (const [edge, time, edgeX] of [
      ['start', ev.startTime, startX],
      ['end', end, endX],
    ] as const) {
      const dist = Math.abs(edgeX - x);
      if (dist > thresholdPx || dist >= bestDist) continue;
      bestDist = dist;
      best = { time, edge, eventId: item.id, xPx: edgeX };
    }
  }
  return best;
}

export interface ExactEdgeMatch {
  eventId: string;
  edge: EventEdgeKind;
  time: number;
  /** Content-space lane Y (pre-scroll); project with `view.scrollY` each frame. */
  laneY: number;
}

/** Idle gap between two adjacent events on a leaf lane (left end → right start). */
export interface HoverGap {
  leftEnd: number;
  rightStart: number;
  /** Content-space lane Y (pre-scroll); project with `view.scrollY` each frame. */
  laneY: number;
}

/**
 * Adjacent-event gap under the pointer (default mode hover measure).
 * Returns null when the pointer is over an event block, within the magnet edge band
 * of either neighbouring edge (magnet/tooltip wins when the gap is wide enough),
 * in the lane vertical padding above/below event blocks, on a folder/header, or when
 * no left-and-right pair brackets the pointer on this lane.
 * When the gap is narrower than 2×thresholdPx the edge band shrinks so a Δt overlay
 * can still appear in the middle of sub-pixel gaps at high zoom.
 */
export function findHoverGap(
  layout: SwimlaneLayout,
  view: SwimlaneViewWindow,
  width: number,
  x: number,
  y: number,
  thresholdPx: number,
): HoverGap | null {
  const contentY = y + view.scrollY;
  const lane = layout.lanes.find((l) => contentY >= l.y && contentY < l.y + LANE_HEIGHT);
  if (!lane || lane.folder) return null;
  const { y: blockY, h: blockH } = eventBlockMetrics(lane.y, view.scrollY);
  if (y < blockY || y > blockY + blockH) return null;
  // Tooltip wins when a visible block is under the pointer (same rule as hitTest).
  if (hitTestLayout(layout, view, width, x, y)) return null;
  const laneIndex = layout.lanes.indexOf(lane);
  const span = Math.max(1, view.endTime - view.startTime);
  const w = Math.max(1, width);
  const t = view.startTime + (x / w) * span;

  let leftEnd: number | null = null;
  let rightStart: number | null = null;
  for (const item of layout.eventsByLane[laneIndex] ?? []) {
    const ev = item.event;
    const end = ev.startTime + ev.duration;
    if (end <= t && (leftEnd == null || end > leftEnd)) leftEnd = end;
    if (ev.startTime >= t && (rightStart == null || ev.startTime < rightStart)) {
      rightStart = ev.startTime;
    }
  }
  if (leftEnd == null || rightStart == null) return null;
  if (!(leftEnd < rightStart)) return null;

  // Free zone for the event-edge magnet; shrink the band when the gap is narrower than 2×threshold.
  const xLeft = ((leftEnd - view.startTime) / span) * w;
  const xRight = ((rightStart - view.startTime) / span) * w;
  const gapPx = xRight - xLeft;
  const edgeBand = Math.min(thresholdPx, Math.max(0, gapPx / 2 - 0.5));
  if (Math.abs(xLeft - x) < edgeBand || Math.abs(xRight - x) < edgeBand) return null;

  return { leftEnd, rightStart, laneY: lane.y };
}

/** View-invariant: which event edges exactly equal a range bound (scan once per range/model). */
export function findExactEdgeMatches(
  layout: SwimlaneLayout,
  rangeStart: number,
  rangeEnd: number,
): ExactEdgeMatch[] {
  if (!(rangeEnd > rangeStart)) return [];
  const bounds = new Set([rangeStart, rangeEnd]);
  const out: ExactEdgeMatch[] = [];
  for (const item of layout.events) {
    const ev = item.event;
    const end = ev.startTime + ev.duration;
    if (bounds.has(ev.startTime)) {
      out.push({ eventId: item.id, edge: 'start', time: ev.startTime, laneY: item.y });
    }
    if (bounds.has(end)) {
      out.push({ eventId: item.id, edge: 'end', time: end, laneY: item.y });
    }
  }
  return out;
}

/** View-invariant: which event edges exactly equal a single time point (magnet snap). */
export function findExactEdgeMatchesAt(
  layout: SwimlaneLayout,
  time: number,
): ExactEdgeMatch[] {
  const out: ExactEdgeMatch[] = [];
  for (const item of layout.events) {
    const ev = item.event;
    if (ev.startTime === time) {
      out.push({ eventId: item.id, edge: 'start', time, laneY: item.y });
    }
    const end = ev.startTime + ev.duration;
    if (end === time) {
      out.push({ eventId: item.id, edge: 'end', time, laneY: item.y });
    }
  }
  return out;
}

/** Project cached matches into screen marks; optional viewportH culls off-screen rows. */
export function projectExactEdgeMarks(
  matches: ExactEdgeMatch[],
  view: SwimlaneViewWindow,
  width: number,
  viewportH = Infinity,
): { eventId: string; edge: EventEdgeKind; time: number; x: number; y: number; h: number }[] {
  if (matches.length === 0) return [];
  const span = Math.max(1, view.endTime - view.startTime);
  const w = Math.max(1, width);
  const out: { eventId: string; edge: EventEdgeKind; time: number; x: number; y: number; h: number }[] =
    [];
  for (const m of matches) {
    if (m.time < view.startTime || m.time > view.endTime) continue;
    const y = m.laneY - view.scrollY;
    const h = LANE_HEIGHT;
    if (y + h < 0 || y > viewportH) continue;
    out.push({
      eventId: m.eventId,
      edge: m.edge,
      time: m.time,
      x: ((m.time - view.startTime) / span) * w,
      y,
      h,
    });
  }
  return out;
}

/** Convenience: scan + project (tests / one-shots). Prefer split helpers under animation. */
export function measureRangeExactEdgeMarks(
  layout: SwimlaneLayout,
  view: SwimlaneViewWindow,
  width: number,
  rangeStart: number,
  rangeEnd: number,
  viewportH = Infinity,
): { eventId: string; edge: EventEdgeKind; time: number; x: number; y: number; h: number }[] {
  return projectExactEdgeMarks(
    findExactEdgeMatches(layout, rangeStart, rangeEnd),
    view,
    width,
    viewportH,
  );
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
