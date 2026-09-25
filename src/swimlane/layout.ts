import type { SwimEvent, SwimlaneModel, SwimlaneViewWindow, SwimThread } from '../domain/types';
import { colorForThread } from '../domain/laneColors';
import { buildFolderSummaryEvents, isFolderNode, walkVisibleRows } from '../domain/swimTree';
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

/** Fill for collapsed-folder summary bars (gray). */
export const SUMMARY_EVENT_FILL = '#2c2c2c';
/** Dimmed foreground for summary bar task-count labels (matches old ProfilerStep labels). */
export const SUMMARY_LABEL_COLOR = '#555555';

/** Max quads per mesh (ushort indices: 65536 / 4 vertices). */
export const MAX_QUADS_PER_MESH = 0x1_00_00 / 4;

export interface FlatLane {
  thread: SwimThread;
  y: number;
  color: string;
  /** Nested folder row: reserves height, no events painted. */
  folder?: boolean;
  depth: number;
  /** Sub-rows for a leaf with overlapping events; 1 for folders and spacer leaves. */
  rowCount: number;
  /** 0..1 opacity during a collapse/expand tween (default 1, fully opaque). */
  alpha?: number;
}

/**
 * In-flight collapse/expand tween applied to a layout built from the **expanded**
 * model. `visible` = 1 fully expanded, 0 fully collapsed. `hiddenHeight` is the
 * **net** px of descendant lane rows this tween hides (`collapseHiddenHeight` from
 * the pre-toggle collapsed set to the post-toggle set) — not the full expanded
 * subtree when a nested folder is already rest-collapsed. Consumed by renderers
 * + DOM gutter.
 */
export interface CollapseAnimState {
  groupId: string;
  visible: number;
  hiddenHeight: number;
  /**
   * Folder-only: precomputed summary bars painted as ghosts at alpha `1 − visible`
   * while the expanded subtree fades with `visible` (dissolve / re-aggregate).
   */
  summaryEvents?: readonly SwimEvent[];
}

/** True when two tween payloads are the same fold (hover `sync` re-passes `null` every move). */
export function sameCollapseAnim(
  a: CollapseAnimState | null,
  b: CollapseAnimState | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.groupId === b.groupId &&
    a.visible === b.visible &&
    a.hiddenHeight === b.hiddenHeight &&
    a.summaryEvents === b.summaryEvents
  );
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
  if (lane) return { top: lane.y, foldY: lane.y + lane.rowCount * LANE_HEIGHT };
  return null;
}

/** Content-space Y just below the group header (Card) or folder row. -1 when absent. */
export function groupBottomY(layout: SwimlaneLayout, groupId: string): number {
  return groupEdges(layout, groupId)?.foldY ?? -1;
}

/**
 * One closed (or closing) group in content-space Y. Rest-collapsed folders use
 * `visible: 0`; the in-flight tween uses `CollapseAnimState.visible`. Nested **rest**
 * folds under a **rest** parent (and nested **anim** folds) are dropped — a Card
 * collapse swallows nested Cores. Nested rest folds under an **animating** parent
 * are kept so the inner shift/alpha stay continuous across the tween. The containing
 * parent is the **innermost** fold (last match by `foldY`), so a rest-collapsed
 * intermediate still swallows its own nested rest when an ancestor is animating.
 */
export interface CollapseFold {
  groupId: string;
  /** Fold line: content Y just below the group header/folder row. */
  foldY: number;
  /** Content Y of the group's top edge (header/folder row). */
  groupTop: number;
  /** Content Y just past the last subtree row at full expansion. */
  subtreeEnd: number;
  /** 0..1 visibility of this fold's subtree. */
  visible: number;
  /** Gap close amount for rows after this subtree (`hiddenHeight × (1 − visible)`). */
  shift: number;
  /** In-flight tween fold — nested rest folds are kept under this parent. */
  animating?: boolean;
}

/**
 * Per-frame collapse/expand transform, computed from the expanded base layout plus
 * rest-collapsed ids. Applied inline in the paint loops (no per-frame event clone).
 */
export interface CollapseTransform {
  active: boolean;
  /** Closed / closing groups, sorted by `foldY`. Empty when idle. */
  folds: readonly CollapseFold[];
}

export const IDLE_COLLAPSE: CollapseTransform = {
  active: false,
  folds: [],
};

/** Content-space Y span of a Card/folder's descendant rows on the expanded layout. */
export function groupSubtreeSpan(
  layout: SwimlaneLayout,
  groupId: string,
): { top: number; foldY: number; subtreeEnd: number } | null {
  const edges = groupEdges(layout, groupId);
  if (!edges) return null;
  const headerIdx = layout.headers.findIndex((h) => h.id === groupId);
  if (headerIdx >= 0) {
    const next = layout.headers[headerIdx + 1];
    return {
      top: edges.top,
      foldY: edges.foldY,
      subtreeEnd: next ? next.y : contentHeightFromLayout(layout),
    };
  }
  const li = layout.lanes.findIndex((l) => l.thread.id === groupId);
  if (li < 0) return null;
  const folder = layout.lanes[li]!;
  let end = edges.foldY;
  if (folder.folder) {
    for (let i = li + 1; i < layout.lanes.length; i++) {
      const l = layout.lanes[i]!;
      if (l.depth <= folder.depth) break;
      end = l.y + l.rowCount * LANE_HEIGHT;
    }
  }
  return { top: edges.top, foldY: edges.foldY, subtreeEnd: end };
}

function pruneNestedFolds(folds: CollapseFold[]): CollapseFold[] {
  if (folds.length <= 1) return folds;
  const sorted = folds
    .slice()
    .sort((a, b) => a.foldY - b.foldY || a.subtreeEnd - b.subtreeEnd);
  const out: CollapseFold[] = [];
  for (const f of sorted) {
    // Innermost containing fold: `out` is foldY-sorted, so the last match wins.
    let parent: CollapseFold | undefined;
    for (let i = out.length - 1; i >= 0; i--) {
      const p = out[i]!;
      if (f.foldY >= p.foldY && f.subtreeEnd <= p.subtreeEnd) {
        parent = p;
        break;
      }
    }
    if (parent) {
      // Keep inner rest folds under the in-flight tween, including visible=0 last frame.
      if (!(parent.animating && f.visible === 0 && !f.animating)) continue;
    }
    out.push(f);
  }
  return out;
}

function foldsFromSpans(
  spanOf: (id: string) => { top: number; foldY: number; subtreeEnd: number } | null,
  collapsedIds: readonly string[],
  anim: CollapseAnimState | null,
): CollapseTransform {
  const folds: CollapseFold[] = [];
  const animLive = anim && anim.hiddenHeight > 0 && anim.visible < 1 ? anim : null;
  for (const id of collapsedIds) {
    if (animLive && id === animLive.groupId) continue;
    const span = spanOf(id);
    if (!span) continue;
    const hidden = span.subtreeEnd - span.foldY;
    if (hidden <= 0) continue;
    folds.push({
      groupId: id,
      foldY: span.foldY,
      groupTop: span.top,
      subtreeEnd: span.subtreeEnd,
      visible: 0,
      shift: hidden,
    });
  }
  if (animLive) {
    const span = spanOf(animLive.groupId);
    if (span) {
      folds.push({
        groupId: animLive.groupId,
        foldY: span.foldY,
        groupTop: span.top,
        // Real subtree end, not `foldY + hiddenHeight` (net). Kept nested rest
        // folds sit inside this span; leftover rows must tuck/fade with the parent.
        subtreeEnd: span.subtreeEnd,
        visible: animLive.visible,
        shift: animLive.hiddenHeight * (1 - animLive.visible),
        animating: true,
      });
    }
  }
  const pruned = pruneNestedFolds(folds);
  if (pruned.length === 0) return IDLE_COLLAPSE;
  return { active: true, folds: pruned };
}

/** Rest-collapsed ids + in-flight tween as one multi-fold transform on the expanded layout. */
export function collapseFoldsFromLayout(
  layout: SwimlaneLayout,
  collapsedIds: readonly string[],
  anim: CollapseAnimState | null,
): CollapseTransform {
  return foldsFromSpans((id) => groupSubtreeSpan(layout, id), collapsedIds, anim);
}

/** Build the collapse transform for `state` only (or IDLE when settled / group absent). */
export function collapseTransform(
  layout: SwimlaneLayout,
  state: CollapseAnimState | null,
): CollapseTransform {
  return collapseFoldsFromLayout(layout, [], state);
}

interface GeoRow {
  id: string;
  y: number;
  h: number;
  kind: 'header' | 'folder' | 'leaf';
  depth: number;
}

function modelGeometry(model: SwimlaneModel): { rows: GeoRow[]; height: number } {
  const rows: GeoRow[] = [];
  let y = 0;
  const skipHeaders = model.skipCardHeaders === true;
  for (const row of walkVisibleRows(model)) {
    if (row.kind === 'header') {
      if (skipHeaders) continue;
      rows.push({ id: row.process.id, y, h: LANE_GROUP_HEADER_HEIGHT, kind: 'header', depth: -1 });
      y += LANE_GROUP_HEADER_HEIGHT;
      continue;
    }
    const h = (row.kind === 'folder' ? 1 : leafRowCount(row.thread)) * LANE_HEIGHT;
    rows.push({ id: row.thread.id, y, h, kind: row.kind, depth: row.depth });
    y += h;
  }
  return { rows, height: y };
}

function groupSubtreeFromGeo(
  geo: { rows: GeoRow[]; height: number },
  groupId: string,
): { top: number; foldY: number; subtreeEnd: number } | null {
  const i = geo.rows.findIndex((r) => r.id === groupId);
  if (i < 0) return null;
  const g = geo.rows[i]!;
  const foldY = g.y + g.h;
  if (g.kind === 'header') {
    const next = geo.rows.find((r, j) => j > i && r.kind === 'header');
    return { top: g.y, foldY, subtreeEnd: next ? next.y : geo.height };
  }
  if (g.kind !== 'folder') return { top: g.y, foldY, subtreeEnd: foldY };
  let end = foldY;
  for (let j = i + 1; j < geo.rows.length; j++) {
    const r = geo.rows[j]!;
    if (r.kind === 'header' || r.depth <= g.depth) break;
    end = r.y + r.h;
  }
  return { top: g.y, foldY, subtreeEnd: end };
}

/** Same folds as `collapseFoldsFromLayout`, from the model row walk (no event layout). */
export function collapseTransformFromModel(
  model: SwimlaneModel | null,
  collapsedIds: readonly string[] = [],
  anim: CollapseAnimState | null = null,
): CollapseTransform {
  if (!model) return IDLE_COLLAPSE;
  const geo = modelGeometry(model);
  return foldsFromSpans((id) => groupSubtreeFromGeo(geo, id), collapsedIds, anim);
}

/** Sum of fold gap-closes — subtract from expanded content height for the visual sizer. */
export function collapseClosedHeight(t: CollapseTransform): number {
  if (!t.active) return 0;
  let s = 0;
  for (const f of t.folds) s += f.shift;
  return s;
}

/**
 * Slide the collapse in two regions per fold (see `applyCollapseAnim`): subtree rows tuck
 * toward the group's top edge; rows after each subtree shift up to close that gap.
 */
function shiftByFolds(y: number, folds: readonly CollapseFold[]): number {
  let extraShift = 0;
  for (let i = 0; i < folds.length; i++) {
    const f = folds[i]!;
    if (y < f.foldY) return y - extraShift;
    if (y < f.subtreeEnd) {
      const nested: CollapseFold[] = [];
      for (let j = i + 1; j < folds.length; j++) {
        const g = folds[j]!;
        if (g.foldY >= f.foldY && g.subtreeEnd <= f.subtreeEnd) nested.push(g);
      }
      const inner = nested.length > 0 ? shiftByFolds(y, nested) : y;
      return f.groupTop - extraShift + (inner - f.groupTop) * f.visible;
    }
    extraShift += f.shift;
  }
  return y - extraShift;
}

export function collapseShiftY(y: number, t: CollapseTransform): number {
  if (!t.active || t.folds.length === 0) return y;
  return shiftByFolds(y, t.folds);
}

/** Fade any fold's collapsing subtree; min over all containing folds so a nested rest stays hidden. */
export function collapseAlpha(y: number, t: CollapseTransform): number {
  if (!t.active) return 1;
  let a = 1;
  for (const f of t.folds) {
    if (y >= f.foldY && y < f.subtreeEnd) a = Math.min(a, Math.max(0, Math.min(1, f.visible)));
  }
  return a;
}

/**
 * Slide + fade collapse. Per fold, two regions, so a **nested** folder's rows tuck into the
 * parent group lane (never past it into the lanes above) while only the rows *after*
 * the subtree close the gap:
 * - **Subtree rows** (`foldY ≤ y < subtreeEnd`): slide toward the group's
 *   top edge and fade to `visible` — they end exactly on the parent lane, then vanish.
 *   An animating parent uses the group's real subtree end (not the net `hiddenHeight`),
 *   so rows past a kept nested rest fold still tuck and fade.
 * - **Rows after the subtree** (`y ≥ subtreeEnd`): shift up by the fold's `shift`
 *   (`hiddenHeight × (1 − visible)` for the tween; full span when rest-collapsed),
 *   staying opaque.
 * Pure — returns a new layout with cloned events; renderers use `applyCollapseFolds`
 * (lanes/headers + summary extras only) on the hot path.
 */
export function applyCollapseTransform(
  layout: SwimlaneLayout,
  t: CollapseTransform,
): SwimlaneLayout {
  if (!t.active) return layout;

  const lanes = layout.lanes.map((l) => {
    const y = collapseShiftY(l.y, t);
    const alpha = collapseAlpha(l.y, t);
    if (y === l.y && alpha === 1) return l;
    const next: FlatLane = { ...l, y };
    if (alpha < 1) next.alpha = alpha;
    return next;
  });
  const headers = layout.headers.map((h) => {
    const y = collapseShiftY(h.y, t);
    return y === h.y ? h : { ...h, y };
  });

  const events = layout.events.map((e) => {
    const y = collapseShiftY(e.y, t);
    return y === e.y ? e : { ...e, y };
  });
  const eventsById = new Map(events.map((e) => [e.id, e]));
  const lanesByTid = new Map(lanes.map((l) => [l.thread.id, l]));
  const eventsByLane: LaidOutEvent[][] = lanes.map(() => []);
  for (const e of events) eventsByLane[e.laneIndex]?.push(e);

  return { ...layout, lanes, headers, events, eventsById, lanesByTid, eventsByLane };
}

export function applyCollapseAnim(
  layout: SwimlaneLayout,
  state: CollapseAnimState | null,
): SwimlaneLayout {
  const shifted = applyCollapseTransform(layout, collapseTransform(layout, state));
  return mergeCollapseSummaries(shifted, state);
}

/**
 * Ghost summary bars for the in-flight folder tween: laid out on the folder lane at
 * alpha `1 − visible`. Empty when there is nothing to paint.
 */
export function collapseGhostSummaries(
  layout: SwimlaneLayout,
  state: CollapseAnimState | null,
): LaidOutEvent[] {
  const summaries = state?.summaryEvents;
  if (!state || !summaries?.length) return [];
  const alpha = Math.max(0, Math.min(1, 1 - state.visible));
  if (alpha <= 0) return [];
  const laneIndex = layout.lanes.findIndex((l) => l.thread.id === state.groupId);
  if (laneIndex < 0) return [];
  const lane = layout.lanes[laneIndex]!;
  if (!lane.folder) return [];

  return [...summaries]
    .sort((a, b) => a.startTime - b.startTime)
    .map((ev) => ({
      id: ev.id,
      event: ev,
      laneIndex,
      y: lane.y,
      rowIndex: 0,
      color: SUMMARY_EVENT_FILL,
      summary: true as const,
      alpha,
    }));
}

/**
 * Merge ghost summaries into a (possibly shifted) layout for hit-test / getLayout.
 * Pure — returns `layout` unchanged when there is nothing to add.
 */
export function mergeCollapseSummaries(
  layout: SwimlaneLayout,
  state: CollapseAnimState | null,
): SwimlaneLayout {
  const ghosts = collapseGhostSummaries(layout, state);
  if (ghosts.length === 0) return layout;
  const laneIndex = ghosts[0]!.laneIndex;

  const events = layout.events.concat(ghosts);
  const eventsById = new Map(layout.eventsById);
  for (const g of ghosts) eventsById.set(g.id, g);
  const eventsByLane = layout.eventsByLane.map((laneEvts, i) =>
    i === laneIndex ? laneEvts.concat(ghosts) : laneEvts,
  );
  return { ...layout, events, eventsById, eventsByLane };
}

/**
 * Rest-collapsed folder summaries (α = 1) on the expanded layout; skips `skipGroupId`
 * and folders whose fold was pruned as nested (those extras would tuck onto the
 * parent row on top of that parent's own summaries).
 */
export function restFolderSummaries(
  layout: SwimlaneLayout,
  collapsedIds: readonly string[],
  skipGroupId: string | null,
  cache: Map<string, SwimEvent[]>,
  collapse: CollapseTransform = IDLE_COLLAPSE,
): LaidOutEvent[] {
  const keep = collapse.active ? new Set(collapse.folds.map((f) => f.groupId)) : null;
  const out: LaidOutEvent[] = [];
  for (const id of collapsedIds) {
    if (id === skipGroupId) continue;
    if (keep && !keep.has(id)) continue;
    const laneIndex = layout.lanes.findIndex((l) => l.thread.id === id);
    if (laneIndex < 0) continue;
    const lane = layout.lanes[laneIndex]!;
    if (!lane.folder) continue;
    let summaries = cache.get(id);
    if (!summaries) {
      summaries = buildFolderSummaryEvents(lane.thread);
      cache.set(id, summaries);
    }
    if (summaries.length === 0) continue;
    for (const ev of summaries) {
      out.push({
        id: ev.id,
        event: ev,
        laneIndex,
        y: lane.y,
        rowIndex: 0,
        color: SUMMARY_EVENT_FILL,
        summary: true,
        alpha: 1,
      });
    }
  }
  return out;
}

/** Rest-collapsed summaries plus in-flight tween ghosts. */
export function collectCollapseSummaries(
  layout: SwimlaneLayout,
  collapsedIds: readonly string[],
  anim: CollapseAnimState | null,
  cache: Map<string, SwimEvent[]>,
  collapse: CollapseTransform = collapseFoldsFromLayout(layout, collapsedIds, anim),
): LaidOutEvent[] {
  const skip = anim && anim.hiddenHeight > 0 && anim.visible < 1 ? anim.groupId : null;
  const rest = restFolderSummaries(layout, collapsedIds, skip, cache, collapse);
  const ghosts = collapseGhostSummaries(layout, anim);
  if (rest.length === 0) return ghosts;
  if (ghosts.length === 0) return rest;
  return rest.concat(ghosts);
}

/**
 * Paint-path collapse: shift lanes/headers and splice summary extras onto folder
 * `eventsByLane`. Does **not** clone `events` / `eventsById` (per-frame expand hitch).
 * Hit-test / `eventScreenRect` apply `collapseShiftY` to the unshifted event Y.
 */
export function applyCollapseFolds(
  layout: SwimlaneLayout,
  t: CollapseTransform,
  extras: readonly LaidOutEvent[] = [],
): SwimlaneLayout {
  if (!t.active && extras.length === 0) return layout;

  const lanes = t.active
    ? layout.lanes.map((l) => {
        const y = collapseShiftY(l.y, t);
        const alpha = collapseAlpha(l.y, t);
        if (y === l.y && alpha === 1) return l;
        const next: FlatLane = { ...l, y };
        if (alpha < 1) next.alpha = alpha;
        return next;
      })
    : layout.lanes;
  const headers = t.active
    ? layout.headers.map((h) => {
        const y = collapseShiftY(h.y, t);
        return y === h.y ? h : { ...h, y };
      })
    : layout.headers;
  const lanesByTid = t.active ? new Map(lanes.map((l) => [l.thread.id, l])) : layout.lanesByTid;

  let eventsByLane = layout.eventsByLane;
  let summaryById: Map<string, LaidOutEvent> | undefined;
  if (extras.length > 0) {
    const byLane = new Map<number, LaidOutEvent[]>();
    summaryById = new Map();
    for (const e of extras) {
      const list = byLane.get(e.laneIndex);
      if (list) list.push(e);
      else byLane.set(e.laneIndex, [e]);
      summaryById.set(e.id, e);
    }
    eventsByLane = layout.eventsByLane.map((laneEvts, i) => {
      const extra = byLane.get(i);
      return extra ? laneEvts.concat(extra) : laneEvts;
    });
  }

  return {
    ...layout,
    lanes,
    headers,
    lanesByTid,
    eventsByLane,
    collapse: t,
    summaryExtras: extras,
    summaryById,
  };
}

/** Renderer hot path: folds + extras + hit layout, no event clone. */
export function collapsePaintState(
  layout: SwimlaneLayout,
  collapsedIds: readonly string[],
  anim: CollapseAnimState | null,
  cache: Map<string, SwimEvent[]>,
): { collapse: CollapseTransform; hitLayout: SwimlaneLayout } {
  const collapse = collapseFoldsFromLayout(layout, collapsedIds, anim);
  const extras = collectCollapseSummaries(layout, collapsedIds, anim, cache, collapse);
  return { collapse, hitLayout: applyCollapseFolds(layout, collapse, extras) };
}

/**
 * Visible non-header row height for a collapse set. Each folder/leaf counts as
 * `LANE_HEIGHT` (same as the historical `filterCollapsedTree` + `walkVisibleRows`
 * tween sizing — overlapping multi-row leaves are ignored here on purpose).
 */
function visibleLaneRowHeight(model: SwimlaneModel, collapsedIds: readonly string[]): number {
  const collapsed = new Set(collapsedIds);
  let h = 0;
  const walk = (nodes: SwimThread[]): void => {
    for (const n of nodes) {
      h += LANE_HEIGHT;
      if (isFolderNode(n) && !collapsed.has(n.id)) walk(n.children ?? []);
    }
  };
  for (const p of model.processes) {
    if (collapsed.has(p.id)) continue;
    walk(p.threads);
  }
  return h;
}

/**
 * Exact px of lane rows hidden when `expandedIds` → `collapsedIds` (folder/Card subtree
 * rows only, no header bands, no `contentHeightFromModel` 120px floor). Callers pass this
 * **net** delta as `CollapseAnimState.hiddenHeight` so a parent tween does not double-count
 * a nested folder that is already rest-collapsed.
 */
export function collapseHiddenHeight(
  model: SwimlaneModel | null,
  expandedIds: readonly string[],
  collapsedIds: readonly string[],
): number {
  if (!model) return 0;
  return Math.max(0, visibleLaneRowHeight(model, expandedIds) - visibleLaneRowHeight(model, collapsedIds));
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
  /** Sub-row top (lane.y + rowIndex * LANE_HEIGHT); block is centered in this band. */
  y: number;
  /** Sub-row index within the leaf lane (0-based). */
  rowIndex: number;
  color: string;
  /** Collapsed-folder summary bar: gray, interactive (hover/label/click-to-expand), never selected/ringed. */
  summary?: boolean;
  /** 0..1 opacity for collapse-tween ghost summaries (default fully opaque). */
  alpha?: number;
}

export interface SwimlaneLayout {
  lanes: FlatLane[];
  headers: GroupHeader[];
  events: LaidOutEvent[];
  eventsById: Map<string, LaidOutEvent>;
  lanesByTid: Map<string, FlatLane>;
  /**
   * Events for each lane index (contiguous groups from rebuild). The viewer hot path
   * keeps the expanded base (folders are `[]` here); rest/ghost summaries are spliced
   * on by `applyCollapseFolds`. Hosts that pre-filter the tree still put summary bars
   * on collapsed folders in this array.
   */
  eventsByLane: LaidOutEvent[][];
  /** Longest leaf (non-summary) duration; left-span for `overlappingLaneRange`. */
  maxLeafDuration: number;
  /**
   * Paint-only collapse folds. When set, event `y` stays on the expanded base and
   * hit-test / `eventScreenRect` apply `collapseShiftY` (see `applyCollapseFolds`).
   */
  collapse?: CollapseTransform;
  /** Rest-collapsed + tween ghost summaries spliced onto folder `eventsByLane`. */
  summaryExtras?: readonly LaidOutEvent[];
  /** Id lookup for `summaryExtras` (not copied into `eventsById`). */
  summaryById?: Map<string, LaidOutEvent>;
  /**
   * Sorted start/end edge times for every base event, for O(log N + K) exact-edge
   * lookup (magnet snap / measure marks) instead of walking all events. Built once in
   * `rebuildLayout`; carried through collapse spreads. `summaryExtras` and any
   * collapse-ghost events appended to `events` are not indexed (scanned linearly).
   */
  edgeIndex?: EdgeTimeIndex;
}

/**
 * Edge-time index: three parallel typed arrays over 2×event edges, sorted by time.
 * `eventIndices` points into `layout.events`; `isEnd` marks end edges.
 *
 * Built once per `rebuildLayout` (~48–56 bytes/event across the source + sorted
 * arrays — ~12 MB for 125k events), so the query stays O(log N + K) with no per-frame
 * allocation. Amortized: it is rebuilt only when the layout identity changes, never on
 * pan/zoom/scroll.
 */
export interface EdgeTimeIndex {
  times: Float64Array;
  eventIndices: Uint32Array;
  isEnd: Uint8Array;
}

export const EMPTY_LAYOUT: SwimlaneLayout = {
  lanes: [],
  headers: [],
  events: [],
  eventsById: new Map(),
  lanesByTid: new Map(),
  eventsByLane: [],
  maxLeafDuration: 0,
};

/** event id → sub-row index (0-based). */
interface RowAssignment {
  rows: Map<string, number>;
  /** Number of sub-rows (≥ 1). */
  count: number;
}

/**
 * Memo of `computeRows` keyed on the events-array identity. No invalidation: mutating
 * `thread.events` in place after the first call (e.g. `push` / `sort`) leaves a stale
 * assignment. Safe for current producers because `chromeTraceToSwimlane` finishes
 * mutating during adaptation, before any layout.
 */
const rowCache = new WeakMap<readonly SwimEvent[], RowAssignment>();

/**
 * Greedy first-fit on `startTime` (longest `duration` first on ties): place each event
 * into the first sub-row whose last event ends at or before it (`end <= start` counts as
 * fitting — touching endpoints are siblings). Overlapping events land on distinct sub-rows.
 * `ponytail:` O(n·k) scan (n events, k sub-rows); fine because k ≤ n and lanes are small,
 * and the result is memoized per events-array. Upgrade to an interval tree if lanes grow
 * to stress-lane event counts.
 */
function computeRows(events: readonly SwimEvent[]): RowAssignment {
  const cached = rowCache.get(events);
  if (cached) return cached;
  const sorted = [...events].sort((a, b) => a.startTime - b.startTime || b.duration - a.duration);
  const rows = new Map<string, number>();
  const rowEnds: number[] = [];
  for (const ev of sorted) {
    if (rows.has(ev.id)) {
      throw new Error(`duplicate event id within lane: ${ev.id}`);
    }
    const end = ev.startTime + ev.duration;
    let row = -1;
    for (let i = 0; i < rowEnds.length; i++) {
      if (ev.startTime >= rowEnds[i]!) {
        row = i;
        rowEnds[i] = end;
        break;
      }
    }
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(end);
    }
    rows.set(ev.id, row);
  }
  const result: RowAssignment = { rows, count: Math.max(1, rowEnds.length) };
  rowCache.set(events, result);
  return result;
}

/** event id → sub-row index (0-based), by greedy first-fit on `startTime`. */
export function assignEventRows(events: SwimEvent[]): Map<string, number> {
  return computeRows(events).rows;
}

/** Number of sub-rows a leaf thread needs; 1 when it has no events (or no overlaps). */
export function leafRowCount(thread: SwimThread): number {
  if (thread.events.length === 0) return 1;
  return computeRows(thread.events).count;
}

/** Leaf events must already be `startTime` asc / longest `duration` first (adapter contract). */
function assertLeafEventsOrdered(events: readonly SwimEvent[]): void {
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1]!;
    const next = events[i]!;
    if (
      next.startTime < prev.startTime ||
      (next.startTime === prev.startTime && next.duration > prev.duration)
    ) {
      throw new Error(
        `leaf events must be sorted startTime asc, longest duration first (at ${next.id})`,
      );
    }
  }
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
    bottom = Math.max(bottom, l.y + l.rowCount * LANE_HEIGHT);
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
    // Folders are always one band (`rebuildLayout` hardcodes `rowCount: 1`); do not use
    // `leafRowCount` here — a folder that somehow carried events would desync DOM Card strips.
    h += (row.kind === 'folder' ? 1 : leafRowCount(row.thread)) * LANE_HEIGHT;
  }
  return Math.max(skipHeaders ? LANE_HEIGHT : 120, h || LANE_GROUP_HEADER_HEIGHT + LANE_HEIGHT);
}

/** Expanded `contentHeightFromModel` minus rest + in-flight fold closes (same 120px body floor). */
export function visualContentHeight(
  model: SwimlaneModel | null,
  collapsedIds: readonly string[] = [],
  anim: CollapseAnimState | null = null,
): number {
  const full = contentHeightFromModel(model);
  const closed = collapseClosedHeight(collapseTransformFromModel(model, collapsedIds, anim));
  if (closed <= 0) return full;
  const skip = model?.skipCardHeaders === true;
  return Math.max(skip ? LANE_HEIGHT : 120, full - closed);
}

/**
 * Card header Y positions only — same row walk as `rebuildLayout`. Folders contribute one
 * `LANE_HEIGHT`; leaves use `leafRowCount` (memoized on events-array identity — first call
 * is O(events); collapse toggles that keep leaf arrays by reference stay O(rows)).
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
      y += (row.kind === 'folder' ? 1 : leafRowCount(row.thread)) * LANE_HEIGHT;
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
      eventsById: new Map(),
      lanesByTid: new Map(),
      eventsByLane: [],
      maxLeafDuration: 0,
    };
  }
  const lanes: FlatLane[] = [];
  const headers: GroupHeader[] = [];
  const events: LaidOutEvent[] = [];
  const eventsById = new Map<string, LaidOutEvent>();
  const lanesByTid = new Map<string, FlatLane>();
  const eventsByLane: LaidOutEvent[][] = [];
  let maxLeafDuration = 0;

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
      const lane: FlatLane = { thread, y, color, folder: true, depth: row.depth, rowCount: 1 };
      lanes.push(lane);
      lanesByTid.set(thread.id, lane);
      const laneEvents: LaidOutEvent[] = [];
      // Collapsed folders carry gray summary bars (disjoint union of descendants).
      const summaries = [...(thread.summaryEvents ?? [])].sort(
        (a, b) => a.startTime - b.startTime,
      );
      for (const ev of summaries) {
        const item: LaidOutEvent = {
          id: ev.id,
          event: ev,
          laneIndex: lanes.length - 1,
          y,
          rowIndex: 0,
          color: SUMMARY_EVENT_FILL,
          summary: true,
        };
        events.push(item);
        eventsById.set(ev.id, item);
        laneEvents.push(item);
      }
      eventsByLane.push(laneEvents);
      y += LANE_HEIGHT;
      continue;
    }
    const rowCount = leafRowCount(thread);
    const lane: FlatLane = { thread, y, color, depth: row.depth, rowCount };
    lanes.push(lane);
    lanesByTid.set(thread.id, lane);
    const laneEvents: LaidOutEvent[] = [];
    const rowIndexById = assignEventRows(thread.events);
    // Trust adapter/host order (no defensive re-sort); WebGL gap math consumes eventsByLane as-is.
    assertLeafEventsOrdered(thread.events);
    for (const ev of thread.events) {
      const rowIndex = rowIndexById.get(ev.id);
      if (rowIndex === undefined) {
        throw new Error(`missing row assignment for event ${ev.id}`);
      }
      const item: LaidOutEvent = {
        id: ev.id,
        event: ev,
        laneIndex: lanes.length - 1,
        y: y + rowIndex * LANE_HEIGHT,
        rowIndex,
        color,
      };
      events.push(item);
      eventsById.set(ev.id, item);
      laneEvents.push(item);
      if (ev.duration > maxLeafDuration) maxLeafDuration = ev.duration;
    }
    eventsByLane.push(laneEvents);
    y += rowCount * LANE_HEIGHT;
  }
  return {
    lanes,
    headers,
    events,
    eventsById,
    lanesByTid,
    eventsByLane,
    maxLeafDuration,
    edgeIndex: buildEdgeIndex(events),
  };
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

/** Visible-width gate for event titles (`eventLabelAnchor`); paint-space px. */
export const EVENT_LABEL_MIN_VISIBLE_PX = 40;

/** True when the longest leaf can exceed `EVENT_LABEL_MIN_VISIBLE_PX` in this view. */
export function eventLabelsCanFit(maxDuration: number, span: number, viewW: number): boolean {
  return maxDuration > 0 && maxDuration * Math.max(1, viewW) > EVENT_LABEL_MIN_VISIBLE_PX * span;
}

/** First index in start-sorted `events` with `startTime >= t`. */
export function lowerBoundLaneStart(events: readonly LaidOutEvent[], t: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid]!.event.startTime < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index in start-sorted `events` with `startTime > t`. */
export function upperBoundLaneStart(events: readonly LaidOutEvent[], t: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid]!.event.startTime <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Index range of start-sorted leaf `eventsByLane` entries that can overlap `[startTime, endTime]`.
 * Left-span uses `maxDuration` so a long event that started before the window is included.
 * Folder lanes (spliced summaries) are not start-sorted — use `laneEventRange`.
 */
export function overlappingLaneRange(
  events: readonly LaidOutEvent[],
  startTime: number,
  endTime: number,
  maxDuration: number,
): readonly [number, number] {
  if (events.length === 0) return [0, 0];
  const lo = lowerBoundLaneStart(events, startTime - maxDuration);
  const hi = upperBoundLaneStart(events, endTime);
  return [lo, hi];
}

/** `overlappingLaneRange` for leaves; folder lanes walk in full (concat extras are unsorted). */
export function laneEventRange(
  lane: FlatLane,
  events: readonly LaidOutEvent[],
  startTime: number,
  endTime: number,
  maxDuration: number,
): readonly [number, number] {
  if (events.length === 0) return [0, 0];
  if (lane.folder) return [0, events.length];
  return overlappingLaneRange(events, startTime, endTime, maxDuration);
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
  if (visibleW <= EVENT_LABEL_MIN_VISIBLE_PX) return null;
  return { cx: (left + right) / 2, maxWidth: Math.max(8, visibleW - 8) };
}

export function eventScreenRect(
  item: LaidOutEvent,
  view: SwimlaneViewWindow,
  widthDevice: number,
  dpr = 1,
  collapse: CollapseTransform = IDLE_COLLAPSE,
): { x: number; y: number; w: number; h: number } {
  const span = Math.max(1, view.endTime - view.startTime);
  const x = ((item.event.startTime - view.startTime) / span) * widthDevice;
  const w = Math.max(2 * dpr, (item.event.duration / span) * widthDevice);
  const m = eventBlockMetrics(collapseShiftY(item.y, collapse), view.scrollY);
  return { x, y: m.y * dpr, w, h: m.h * dpr };
}

/** Leaf lane id under canvas-local CSS Y, or null on folders / empty. */
export function leafLaneIdAtPoint(
  layout: SwimlaneLayout,
  view: SwimlaneViewWindow,
  y: number,
): string | null {
  const hit = laneAtContentY(layout, y + view.scrollY);
  return hit && !hit.lane.folder ? hit.lane.thread.id : null;
}

/** Lane id (leaf or folder) under canvas-local CSS Y, or null on empty / header gap. */
export function laneIdAtPoint(
  layout: SwimlaneLayout,
  view: SwimlaneViewWindow,
  y: number,
): string | null {
  return laneAtContentY(layout, y + view.scrollY)?.lane.thread.id ?? null;
}

/**
 * Lane under content-space Y. Prefers the last matching leaf when collapse tucks a
 * subtree into its parent; otherwise the last matching folder. Skips `alpha === 0`.
 */
export function laneAtContentY(
  layout: SwimlaneLayout,
  contentY: number,
): { lane: FlatLane; index: number } | null {
  let leaf: FlatLane | undefined;
  let leafIndex = -1;
  let folder: FlatLane | undefined;
  let folderIndex = -1;
  for (let i = 0; i < layout.lanes.length; i++) {
    const l = layout.lanes[i]!;
    if (l.alpha === 0) continue;
    if (!(contentY >= l.y && contentY < l.y + l.rowCount * LANE_HEIGHT)) continue;
    if (l.folder) {
      folder = l;
      folderIndex = i;
    } else {
      leaf = l;
      leafIndex = i;
    }
  }
  if (leaf && leafIndex >= 0) return { lane: leaf, index: leafIndex };
  if (folder && folderIndex >= 0) return { lane: folder, index: folderIndex };
  return null;
}

/** Prefer shorter duration when multiple blocks share a pixel (tie-break only; sub-rows make true overlaps rare). `width`/`x`/`y` are device pixels. */
export function hitTestLayout(
  layout: SwimlaneLayout,
  view: SwimlaneViewWindow,
  widthDevice: number,
  x: number,
  y: number,
  dpr = 1,
): string | null {
  const contentYCss = y / dpr + view.scrollY;
  const hit = laneAtContentY(layout, contentYCss);
  if (!hit) return null;
  const { index: laneIndex } = hit;
  const span = Math.max(1, view.endTime - view.startTime);
  const fold = layout.collapse ?? IDLE_COLLAPSE;
  const candidates: { id: string; duration: number }[] = [];
  for (const item of layout.eventsByLane[laneIndex] ?? []) {
    if (item.alpha === 0) continue;
    if (!item.summary && collapseAlpha(item.y, fold) <= 0) continue;
    const ev = item.event;
    if (ev.startTime + ev.duration < view.startTime || ev.startTime > view.endTime) continue;
    const ex = ((ev.startTime - view.startTime) / span) * widthDevice;
    const ew = Math.max(2 * dpr, (ev.duration / span) * widthDevice);
    const m = eventBlockMetrics(collapseShiftY(item.y, fold), view.scrollY);
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

/** Folder id a summary bar belongs to, or null when `eventId` is not a summary event. */
export function summaryFolderId(layout: SwimlaneLayout, eventId: string): string | null {
  const item = layout.summaryById?.get(eventId) ?? layout.eventsById.get(eventId);
  if (!item?.summary) return null;
  return layout.lanes[item.laneIndex]?.thread.id ?? null;
}

export function findLaidOutEvent(layout: SwimlaneLayout, id: string): LaidOutEvent | undefined {
  return layout.summaryById?.get(id) ?? layout.eventsById.get(id);
}

/** Screen-space marquee rect (canvas CSS px); order-normalized by `eventsIntersectingRect`. */
export interface MarqueeRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Leaf events whose drawn block intersects the marquee rect, in layout order.
 * Folder rows hold no events, so Card header strips the rect passes over contribute none.
 * Paint-only collapse leaves `layout.events` expanded and unshifted; walk visible
 * `eventsByLane` (skip `alpha === 0` and folder lanes) and apply `collapseShiftY`
 * so the rect matches paint / hit-test. Only Y-overlapping lanes are scanned;
 * each of those bisects start-sorted events to the rect's time window (2px min
 * block width, left-span `maxLeafDuration`).
 */
export function eventsIntersectingRect(
  layout: SwimlaneLayout,
  view: SwimlaneViewWindow,
  width: number,
  rect: MarqueeRect,
): LaidOutEvent[] {
  const left = Math.min(rect.x0, rect.x1);
  const right = Math.max(rect.x0, rect.x1);
  const top = Math.min(rect.y0, rect.y1);
  const bottom = Math.max(rect.y0, rect.y1);
  const span = Math.max(1, view.endTime - view.startTime);
  const w = Math.max(1, width);
  const fold = layout.collapse ?? IDLE_COLLAPSE;
  // 2px min painted width: a zero-duration mark at `left - 2` still clips the rect.
  const t0 = view.startTime + ((left - 2) / w) * span;
  const t1 = view.startTime + (right / w) * span;
  const out: LaidOutEvent[] = [];
  for (let i = 0; i < layout.lanes.length; i++) {
    const lane = layout.lanes[i]!;
    // Folds already baked into `lane.y` / `lane.alpha` on hitLayout — do not
    // re-shift. Event items stay on the expanded Y and use `collapseShiftY`.
    if ((lane.alpha ?? 1) <= 0) continue;
    if (lane.folder) continue;
    const laneTop = lane.y - view.scrollY;
    const laneH = lane.rowCount * LANE_HEIGHT;
    if (laneTop + laneH < top - 1 || laneTop > bottom + 1) continue;
    const laneEvts = layout.eventsByLane[i];
    if (!laneEvts?.length) continue;
    const [lo, hi] = laneEventRange(lane, laneEvts, t0, t1, layout.maxLeafDuration);
    for (let j = lo; j < hi; j++) {
      const item = laneEvts[j]!;
      if (item.summary) continue;
      if (collapseAlpha(item.y, fold) <= 0) continue;
      const ev = item.event;
      const { y, h } = eventBlockMetrics(collapseShiftY(item.y, fold), view.scrollY);
      if (y > bottom || y + h < top) continue;
      const x = ((ev.startTime - view.startTime) / span) * w;
      const ew = Math.max(2, (ev.duration / span) * w);
      if (x > right || x + ew < left) continue;
      out.push(item);
    }
  }
  return out;
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

/** Magnet: nearest start/end on the lane under (x,y), if within thresholdPx (leaf or collapsed-folder summary bars). */
export function nearestEventEdgeAtPoint(
  layout: SwimlaneLayout,
  view: SwimlaneViewWindow,
  width: number,
  x: number,
  y: number,
  thresholdPx: number,
): NearestEventEdge | null {
  const contentY = y + view.scrollY;
  const hit = laneAtContentY(layout, contentY);
  if (!hit) return null;
  const lane = hit.lane;
  const laneIndex = hit.index;
  const rowIndex = Math.floor((contentY - lane.y) / LANE_HEIGHT);
  const span = Math.max(1, view.endTime - view.startTime);
  const w = Math.max(1, width);
  let best: NearestEventEdge | null = null;
  let bestDist = Infinity;
  for (const item of layout.eventsByLane[laneIndex] ?? []) {
    if (item.alpha === 0) continue;
    if (item.rowIndex !== rowIndex) continue;
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
 * in the lane vertical padding above/below event blocks, on a Card header, or when
 * no left-and-right pair brackets the pointer on this lane.
 * Applies to leaf lanes and collapsed-folder lanes that carry summary bars.
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
  const hit = laneAtContentY(layout, contentY);
  if (!hit) return null;
  const lane = hit.lane;
  const laneIndex = hit.index;
  const rowIndex = Math.floor((contentY - lane.y) / LANE_HEIGHT);
  const subRowY = lane.y + rowIndex * LANE_HEIGHT;
  const { y: blockY, h: blockH } = eventBlockMetrics(subRowY, view.scrollY);
  if (y < blockY || y > blockY + blockH) return null;
  // Tooltip wins when a visible block is under the pointer (same rule as hitTest).
  if (hitTestLayout(layout, view, width, x, y)) return null;
  const span = Math.max(1, view.endTime - view.startTime);
  const w = Math.max(1, width);
  const t = view.startTime + (x / w) * span;

  let leftEnd: number | null = null;
  let rightStart: number | null = null;
  for (const item of layout.eventsByLane[laneIndex] ?? []) {
    if (item.alpha === 0) continue;
    if (item.rowIndex !== rowIndex) continue;
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

  return { leftEnd, rightStart, laneY: subRowY };
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
  /** True when both ends share the same visual band Y (same leaf sub-row). */
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
  const anchorItem = findLaidOutEvent(layout, anchorId);
  if (!anchorItem) return null;
  const times = computeAltMeasureDelta(anchorItem.event, targetTime);
  if (!times) return null;

  const targetItem = targetEventId
    ? findLaidOutEvent(layout, targetEventId)
    : undefined;
  const fold = layout.collapse ?? IDLE_COLLAPSE;
  const anchorIsLeft = times.anchorRefTime <= targetTime;
  const anchorY = collapseShiftY(anchorItem.y, fold);
  const targetY = collapseShiftY(targetItem?.y ?? anchorItem.y, fold);
  const leftLaneY = anchorIsLeft ? anchorY : targetY;
  const rightLaneY = anchorIsLeft ? targetY : anchorY;

  return {
    deltaNs: times.deltaNs,
    anchorRefTime: times.anchorRefTime,
    targetTime,
    gapStartTime: times.gapStartTime,
    gapEndTime: times.gapEndTime,
    leftLaneY,
    rightLaneY,
    sameLane: targetItem ? leftLaneY === rightLaneY : true,
    targetEventId: targetEventId ?? null,
  };
}

/**
 * Visible laid-out events only. `hitLayout.events` stays the expanded array
 * (paint-only collapse does not clone it), so a full walk would rescan every
 * rest-collapsed descendant on pointermove magnet marks and marquee collection.
 */
function* iterLaidOutEvents(layout: SwimlaneLayout): Iterable<LaidOutEvent> {
  for (let i = 0; i < layout.lanes.length; i++) {
    const lane = layout.lanes[i]!;
    // `applyCollapseFolds` tucks hidden lanes and sets `alpha: 0` (do not re-run
    // `collapseAlpha` on the already-shifted `lane.y`).
    if ((lane.alpha ?? 1) <= 0) continue;
    const laneEvts = layout.eventsByLane[i];
    if (!laneEvts) continue;
    for (const item of laneEvts) {
      if (item.alpha === 0) continue;
      yield item;
    }
  }
}

function exactEdgeLaneY(layout: SwimlaneLayout, item: LaidOutEvent): number | null {
  const fold = layout.collapse ?? IDLE_COLLAPSE;
  if (!item.summary && collapseAlpha(item.y, fold) <= 0) return null;
  return collapseShiftY(item.y, fold);
}

export function findExactEdgeMatches(
  layout: SwimlaneLayout,
  rangeStart: number,
  rangeEnd: number,
): ExactEdgeMatch[] {
  if (!(rangeEnd > rangeStart)) return [];
  // Two bound times == two single-point scans; the per-point scan is O(log N + K).
  return findExactEdgeMatchesAt(layout, rangeStart).concat(
    findExactEdgeMatchesAt(layout, rangeEnd),
  );
}

/** First index in a sorted `Float64Array` whose value is `>= target`. */
function lowerBound(sorted: Float64Array, target: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Build the sorted edge-time index over a layout's base events (start + end each). */
function buildEdgeIndex(events: readonly LaidOutEvent[]): EdgeTimeIndex {
  const n = events.length;
  const len = n * 2;
  const times = new Float64Array(len);
  const eventIndices = new Uint32Array(len);
  const isEnd = new Uint8Array(len);
  for (let i = 0; i < n; i++) {
    const ev = events[i]!.event;
    times[i * 2] = ev.startTime;
    eventIndices[i * 2] = i;
    times[i * 2 + 1] = ev.startTime + ev.duration;
    eventIndices[i * 2 + 1] = i;
    isEnd[i * 2 + 1] = 1;
  }
  // Sort by edge time (TypedArray.sort compares values; compare the times they index).
  const order = new Uint32Array(len);
  for (let i = 0; i < len; i++) order[i] = i;
  order.sort((a, b) => times[a]! - times[b]!);
  const sortedTimes = new Float64Array(len);
  const sortedIdx = new Uint32Array(len);
  const sortedEnd = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const src = order[i]!;
    sortedTimes[i] = times[src]!;
    sortedIdx[i] = eventIndices[src]!;
    sortedEnd[i] = isEnd[src]!;
  }
  return { times: sortedTimes, eventIndices: sortedIdx, isEnd: sortedEnd };
}

/** Push the two edges of one item (if equal to `time` and not collapse-hidden). */
function collectItemEdges(
  layout: SwimlaneLayout,
  item: LaidOutEvent,
  time: number,
  out: ExactEdgeMatch[],
): void {
  if (item.alpha === 0) return;
  const laneY = exactEdgeLaneY(layout, item);
  if (laneY == null) return;
  const ev = item.event;
  if (ev.startTime === time) out.push({ eventId: item.id, edge: 'start', time, laneY });
  const end = ev.startTime + ev.duration;
  if (end === time) out.push({ eventId: item.id, edge: 'end', time, laneY });
}

/** View-invariant: which event edges exactly equal a single time point (magnet snap). */
export function findExactEdgeMatchesAt(
  layout: SwimlaneLayout,
  time: number,
): ExactEdgeMatch[] {
  const out: ExactEdgeMatch[] = [];
  const idx = layout.edgeIndex;
  if (!idx) {
    // No index (e.g. an EMPTY_LAYOUT clone): fall back to the full walk.
    for (const item of iterLaidOutEvents(layout)) collectItemEdges(layout, item, time, out);
    return out;
  }

  const { times, eventIndices, isEnd } = idx;
  let i = lowerBound(times, time);
  for (; i < times.length && times[i] === time; i++) {
    const item = layout.events[eventIndices[i]!];
    // Mirror `collectItemEdges`'s guard so a future collapse-opacity change (or a base
    // event ever gaining `alpha: 0`) keeps this branch equivalent to the full walk.
    if (!item || item.alpha === 0) continue;
    const laneY = exactEdgeLaneY(layout, item);
    if (laneY == null) continue;
    out.push({
      eventId: item.id,
      edge: isEnd[i] ? 'end' : 'start',
      time,
      laneY,
    });
  }

  // Collapse summaries/ghosts are not in the base index: paint-time extras live in
  // `summaryExtras`; `mergeCollapseSummaries` appends ghosts to `events` directly.
  const baseEventCount = eventIndices.length >> 1;
  for (const item of layout.summaryExtras ?? []) collectItemEdges(layout, item, time, out);
  for (let e = baseEventCount; e < layout.events.length; e++) {
    collectItemEdges(layout, layout.events[e]!, time, out);
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

/**
 * True when this event stays full-color under an active selection/search dim:
 * selection/dep-neighbor (`bright`), multi-selected, or hovered.
 */
export function isKeepBright(
  id: string,
  bright: ReadonlySet<string>,
  hoveredId: string | null,
  multiIds: ReadonlySet<string>,
): boolean {
  return bright.has(id) || multiIds.has(id) || id === hoveredId;
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
