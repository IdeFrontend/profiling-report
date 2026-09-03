import type { SwimEvent, SwimlaneBand, SwimlaneModel, SwimlaneViewWindow, SwimThread } from '../domain/types';
import { colorForThread } from '../domain/laneColors';
import { filterCollapsedTree, walkVisibleRows } from '../domain/swimTree';
import { maxRR, minRR, rrSwitchThreshold, rrToDevicePx } from './shaders';

export const LANE_HEIGHT = 22;
export const LANE_PAD_Y = 3;
/** Matches `.pr-gutter__group` height so canvas lanes align with gutter labels. */
export const LANE_GROUP_HEADER_HEIGHT = 40;
/** Card / root group-header strip across gutter + swimlane (`rgb(42, 42, 42)`). */
export const LANE_GROUP_HEADER_FILL = '#2a2a2a';
/** Card strip hover fill (`rgb(50, 50, 50)`); DOM only — canvas headers stay static. */
export const LANE_GROUP_HEADER_HOVER = '#323232';
/** Default lane row fill (`rgb(31, 31, 31)`); matches `.pr-gutter__lane`. */
export const LANE_FILL = '#1f1f1f';
/**
 * Hovered lane row fill (AC-07), the value both UCD crops sample and the same
 * `--pr-surface-raised` the gutter row uses. Painted into the row background by the
 * renderers rather than composited over them: a DOM band would tint the events it
 * crossed, and a lifted fill on an event already means hover on that event (AC-08).
 */
export const LANE_HOVER_FILL = '#363636';
/** Half of 1 device-px gap between abutting event fills (inset per side after CSS→device scale). */
export const EVENT_MARGIN_DEVICE = 0.5;

/** Corner policy is CSS px (shared with the WebGL shader): minRR below rrSwitchThreshold CSS-px
 * raw width, else maxRR, then ×dpr and rounded to integer device px. */
export function eventRadius(widthCssPx: number, dpr = 1): number {
  const rCss = widthCssPx < rrSwitchThreshold ? minRR : maxRR;
  return rrToDevicePx(rCss, dpr);
}

/** Snap a value onto the integer device-pixel grid. */
export function snapDevicePx(v: number): number {
  return Math.round(v);
}

/** Snap a device-pixel rect so all four edges are integers. Min size = 1 device px. */
export function snapEventRect(
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } {
  const x0 = snapDevicePx(x);
  const y0 = snapDevicePx(y);
  const x1 = snapDevicePx(x + w);
  const y1 = snapDevicePx(y + h);
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

/**
 * Paint rect for event fills/strokes in device pixels: 1 device-px gap, then integer snap.
 * `x,y,w,h` must already be in device pixels. Hit-testing keeps the full (uninset) interval.
 */
export function eventPaintRect(
  x: number,
  y: number,
  w: number,
  h: number,
  dpr = 1,
): { x: number; y: number; w: number; h: number; r: number } {
  const snapped = snapEventRect(
    x + EVENT_MARGIN_DEVICE,
    y,
    Math.max(0, w - EVENT_MARGIN_DEVICE * 2),
    h,
  );
  // `w` is device px; convert to CSS px (÷ dpr) for the corner decision.
  return { ...snapped, r: eventRadius(w / dpr, dpr) };
}

/** @deprecated Use EVENT_MARGIN_DEVICE — kept as alias for older call sites during migration. */
export const EVENT_MARGIN = EVENT_MARGIN_DEVICE;

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
  /** 0..1 opacity during a collapse/expand tween (default 1, fully opaque). */
  alpha?: number;
}

/**
 * In-flight collapse/expand tween applied to a layout built from the **expanded**
 * model. `visible` = 1 fully expanded, 0 fully collapsed; `hiddenHeight` = px of
 * descendant content hidden at full collapse. Consumed by renderers + DOM gutter.
 */
export interface CollapseAnimState {
  groupId: string;
  visible: number;
  hiddenHeight: number;
}

/**
 * Content-space Y of the group's top edge (`Card` header or folder lane) and the fold
 * line just below it. Both -1 when `groupId` is absent from the layout.
 */
export function groupEdges(
  layout: SwimlaneLayout,
  groupId: string,
): { top: number; foldY: number } | null {
  const header = layout.headers.find((h) => h.id === groupId);
  if (header) return { top: header.y, foldY: header.y + LANE_GROUP_HEADER_HEIGHT };
  const lane = layout.lanes.find((l) => l.thread.id === groupId);
  if (lane) return { top: lane.y, foldY: lane.y + LANE_HEIGHT };
  return null;
}

/** Content-space Y just below the group header (Card) or folder row. -1 when absent. */
export function groupBottomY(layout: SwimlaneLayout, groupId: string): number {
  return groupEdges(layout, groupId)?.foldY ?? -1;
}

/**
 * Slide + fade the collapse. Two regions, so a **nested** folder's rows tuck into the
 * parent group lane (never past it into the lanes above) while only the rows *after*
 * the subtree close the gap:
 * - **Subtree rows** (`foldY ≤ y < foldY + hiddenHeight`): slide toward the group's
 *   top edge and fade to `visible` — they end exactly on the parent lane, then vanish.
 * - **Rows after the subtree** (`y ≥ foldY + hiddenHeight`): shift up by
 *   `hiddenHeight × (1 − visible)` to close the gap, staying opaque.
 * Pure — returns a new layout; renderers hold the expanded base and call this per frame.
 */
export function applyCollapseAnim(
  layout: SwimlaneLayout,
  state: CollapseAnimState | null,
): SwimlaneLayout {
  if (!state || state.hiddenHeight <= 0 || state.visible >= 1) return layout;
  const edges = groupEdges(layout, state.groupId);
  if (!edges) return layout;

  const visible = state.visible;
  const shift = state.hiddenHeight * (1 - visible);
  const subtreeEnd = edges.foldY + state.hiddenHeight;

  const lanes = layout.lanes.map((l) => {
    if (l.y < edges.foldY) return l; // parent + above: untouched
    if (l.y < subtreeEnd) {
      // Collapsing subtree: tuck toward the parent top, fade out.
      return {
        ...l,
        y: edges.top + (l.y - edges.top) * visible,
        alpha: Math.max(0, Math.min(1, visible)),
      };
    }
    // Rows after the subtree: close the gap, stay opaque.
    return { ...l, y: l.y - shift };
  });
  const headers = layout.headers.map((h) => (h.y < edges.foldY ? h : { ...h, y: h.y - shift }));

  // Events track their lane's animated Y (a lane's events all share that lane's `y`).
  const events = layout.events.map((e) => {
    const lane = lanes[e.laneIndex];
    return lane && e.y !== lane.y ? { ...e, y: lane.y } : e;
  });
  const eventsById = new Map(events.map((e) => [e.id, e]));
  const lanesByTid = new Map(lanes.map((l) => [l.thread.id, l]));
  const eventsByLane: LaidOutEvent[][] = lanes.map(() => []);
  for (const e of events) eventsByLane[e.laneIndex]?.push(e);

  return { ...layout, lanes, headers, events, eventsById, lanesByTid, eventsByLane };
}

/**
 * Exact px of lane rows hidden when `expandedIds` → `collapsedIds` (folder/Card subtree
 * rows only, no header bands, no `contentHeightFromModel` 120px floor). Used to size a
 * collapse/expand tween so the shift and the fade region line up with the true content.
 */
export function collapseHiddenHeight(
  model: SwimlaneModel | null,
  expandedIds: readonly string[],
  collapsedIds: readonly string[],
): number {
  if (!model) return 0;
  const rowHeight = (m: SwimlaneModel): number =>
    walkVisibleRows(m).reduce((n, r) => n + (r.kind === 'header' ? 0 : LANE_HEIGHT), 0);
  return Math.max(0, rowHeight(filterCollapsedTree(model, expandedIds)) - rowHeight(filterCollapsedTree(model, collapsedIds)));
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
  const skipHeaders = model.skipCardHeaders === true;
  const rows = walkVisibleRows(model);
  let h = 0;
  for (const row of rows) {
    if (row.kind === 'header') {
      if (!skipHeaders) h += LANE_GROUP_HEADER_HEIGHT;
      continue;
    }
    h += LANE_HEIGHT;
  }
  return Math.max(skipHeaders ? LANE_HEIGHT : 120, h || LANE_GROUP_HEADER_HEIGHT + LANE_HEIGHT);
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
  /** Sticky pin strip: flat leaf rows only — no Card header chrome. */
  const skipHeaders = model.skipCardHeaders === true;
  for (const row of walkVisibleRows(model)) {
    if (row.kind === 'header') {
      if (skipHeaders) continue;
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
    const sorted = [...thread.events].sort((a, b) => a.startTime - b.startTime);
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
  widthDevice: number,
  dpr = 1,
): { x: number; y: number; w: number; h: number } {
  const span = Math.max(1, view.endTime - view.startTime);
  const x = ((item.event.startTime - view.startTime) / span) * widthDevice;
  const w = Math.max(2 * dpr, (item.event.duration / span) * widthDevice);
  const m = eventBlockMetrics(item.y, view.scrollY);
  return { x, y: m.y * dpr, w, h: m.h * dpr };
}

/** Leaf lane id under canvas-local CSS Y, or null on folders / empty. */
export function leafLaneIdAtPoint(
  layout: SwimlaneLayout,
  view: SwimlaneViewWindow,
  y: number,
): string | null {
  const contentY = y + view.scrollY;
  const lane = layout.lanes.find((l) => contentY >= l.y && contentY < l.y + LANE_HEIGHT);
  if (!lane || lane.folder) return null;
  return lane.thread.id;
}

/** Prefer shorter nested events (same as Canvas MVP). `width`/`x`/`y` are device pixels. */
export function hitTestLayout(
  layout: SwimlaneLayout,
  view: SwimlaneViewWindow,
  widthDevice: number,
  x: number,
  y: number,
  dpr = 1,
): string | null {
  const contentYCss = y / dpr + view.scrollY;
  const lane = layout.lanes.find((l) => contentYCss >= l.y && contentYCss < l.y + LANE_HEIGHT);
  if (!lane || lane.folder) return null;
  const laneIndex = layout.lanes.indexOf(lane);
  const span = Math.max(1, view.endTime - view.startTime);
  const candidates: { id: string; duration: number }[] = [];
  for (const item of layout.eventsByLane[laneIndex] ?? []) {
    const ev = item.event;
    if (ev.startTime + ev.duration < view.startTime || ev.startTime > view.endTime) continue;
    const ex = ((ev.startTime - view.startTime) / span) * widthDevice;
    const ew = Math.max(2 * dpr, (ev.duration / span) * widthDevice);
    const m = eventBlockMetrics(item.y, view.scrollY);
    const ey = m.y * dpr;
    const eh = m.h * dpr;
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

/**
 * Auto-selected target edge time for a hovered target event (directional): the target's
 * start when it follows the anchor, its end when it precedes it. Null when overlapping or same id.
 */
export function eventMeasureTargetTime(anchor: SwimEvent, target: SwimEvent): number | null {
  if (anchor.id === target.id) return null;
  const aStart = anchor.startTime;
  const aEnd = anchor.startTime + anchor.duration;
  const tStart = target.startTime;
  const tEnd = target.startTime + target.duration;
  if (aStart < tEnd && tStart < aEnd) return null;
  if (tStart >= aEnd) return tStart;
  if (tEnd <= aStart) return tEnd;
  return null;
}

export interface AltMeasureGap {
  deltaNs: number;
  /** Anchor edge (start or end) used as the measurement origin. */
  anchorRefTime: number;
  targetTime: number;
  gapStartTime: number;
  gapEndTime: number;
  /** Lane Y of the earlier (gapStart) side. */
  leftLaneY: number;
  /** Lane Y of the later (gapEnd) side. */
  rightLaneY: number;
  sameLane: boolean;
  targetEventId: string | null;
}

/** Time-only Alt-measure gap; null when target lies inside/touching the anchor span. */
export function computeAltMeasureDelta(
  anchor: SwimEvent,
  targetTime: number,
): {
  anchorRefTime: number;
  deltaNs: number;
  gapStartTime: number;
  gapEndTime: number;
} | null {
  const aStart = anchor.startTime;
  const aEnd = anchor.startTime + anchor.duration;
  let anchorRefTime: number;
  let deltaNs: number;
  if (targetTime > aEnd) {
    anchorRefTime = aEnd;
    deltaNs = targetTime - aEnd;
  } else if (targetTime < aStart) {
    anchorRefTime = aStart;
    deltaNs = aStart - targetTime;
  } else {
    return null;
  }
  return {
    anchorRefTime,
    deltaNs,
    gapStartTime: Math.min(anchorRefTime, targetTime),
    gapEndTime: Math.max(anchorRefTime, targetTime),
  };
}

/**
 * Measurement gap between an anchored event and a target point (an event edge or a free cursor).
 * Null when the anchor is missing or the target lies inside/touching the anchor span.
 */
export function computeAltMeasureGap(
  layout: SwimlaneLayout,
  anchorId: string,
  targetTime: number,
  targetEventId: string | null,
): AltMeasureGap | null {
  const anchorItem = layout.eventsById.get(anchorId);
  if (!anchorItem) return null;
  const times = computeAltMeasureDelta(anchorItem.event, targetTime);
  if (!times) return null;

  const targetItem = targetEventId ? layout.eventsById.get(targetEventId) : undefined;
  const anchorIsLeft = times.anchorRefTime <= targetTime;
  const leftLaneY = anchorIsLeft ? anchorItem.y : (targetItem?.y ?? anchorItem.y);
  const rightLaneY = anchorIsLeft ? (targetItem?.y ?? anchorItem.y) : anchorItem.y;

  return {
    deltaNs: times.deltaNs,
    anchorRefTime: times.anchorRefTime,
    targetTime,
    gapStartTime: times.gapStartTime,
    gapEndTime: times.gapEndTime,
    leftLaneY,
    rightLaneY,
    sameLane: targetItem ? targetItem.laneIndex === anchorItem.laneIndex : true,
    targetEventId: targetEventId ?? null,
  };
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

/** Solid dark-gray fill for events muted by an active selection (non-selected, non-neighbor). */
export const SELECTION_MUTED_FILL = '#2C2C2C';
/** Label text color on muted gray blocks. */
export const SELECTION_MUTED_LABEL = '#969696';

export interface EventEmphasis {
  /** Opacity under search: 0.25 when the name misses the query, else 1. */
  alpha: number;
  /** True when an active selection mutes this event to solid gray. */
  muted: boolean;
}

/** Canvas/WebGL fill+label emphasis. Search miss → alpha 0.25; an active selection mutes
 * non-selected, non-neighbor events to solid gray (`SELECTION_MUTED_FILL`). Callers pass
 * `keepBright=true` for the selection, its laid-out dep neighbors, and the hovered block —
 * a light hover fill with a dark label washed by a dim is what made hovered-but-not-selected
 * blocks unreadable, so hover must keep its color. */
export function eventEmphasis(
  matchesSearch: boolean,
  keepBright: boolean,
  hasSearch: boolean,
  hasSelection: boolean,
): EventEmphasis {
  return {
    alpha: hasSearch && !matchesSearch ? 0.25 : 1,
    muted: hasSelection && !keepBright,
  };
}

/** Parse `#RRGGBB` → RGB in 0..1. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = Number.parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}
