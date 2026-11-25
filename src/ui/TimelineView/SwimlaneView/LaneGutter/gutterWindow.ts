import {
  COUNTER_LANE_HEIGHT,
  flatLaneHeight,
  LANE_GROUP_HEADER_HEIGHT,
  LANE_HEIGHT,
  type CollapseAnimState,
} from '../../../../swimlane/layout';
import type { GutterGroup, GutterLane } from './gutterTypes';

/** Window Card groups once the tree is wider than a typical two-Card report. */
export const GUTTER_VIRTUALIZE_AFTER_GROUPS = 16;
/** Same overscan as SwimlaneView Card strips (`PR-SWIMVIEW-050`). */
export const GUTTER_ROW_OVERSCAN_PX = 240;

const EMPTY_ID_SET: ReadonlySet<string> = new Set();

export function asIdSet(v?: readonly string[] | ReadonlySet<string>): ReadonlySet<string> {
  if (!v) return EMPTY_ID_SET;
  if (v instanceof Set) return v;
  return new Set(v);
}

/** Rest height of one gutter row. Matches LaneGutterNode (collapsed counter folders are 26px). */
function gutterRowHeight(lane: GutterLane, collapsed: ReadonlySet<string>): number {
  if (lane.children !== undefined) {
    if (lane.counterFolder && collapsed.has(lane.id)) return COUNTER_LANE_HEIGHT;
    return LANE_HEIGHT;
  }
  return flatLaneHeight(lane);
}

function subtreeHeight(lanes: readonly GutterLane[], collapsed: ReadonlySet<string>): number {
  let h = 0;
  for (const lane of lanes) {
    const folder = lane.children !== undefined;
    h += gutterRowHeight(lane, collapsed);
    if (folder && !collapsed.has(lane.id) && lane.children?.length) {
      h += subtreeHeight(lane.children, collapsed);
    }
  }
  return h;
}

export type GutterGroupBand = {
  group: GutterGroup;
  y: number;
  h: number;
};

function laneTreeHas(lanes: readonly GutterLane[], id: string): boolean {
  for (const lane of lanes) {
    if (lane.id === id) return true;
    if (lane.children?.length && laneTreeHas(lane.children, id)) return true;
  }
  return false;
}

/** Nested counter-folder tween adds the 4px keep the node puts back on the wrapper. */
function counterKeepOf(lanes: readonly GutterLane[], id: string): number {
  for (const lane of lanes) {
    if (lane.id === id) return lane.counterFolder ? COUNTER_LANE_HEIGHT - LANE_HEIGHT : 0;
    if (lane.children?.length && laneTreeHas(lane.children, id)) return counterKeepOf(lane.children, id);
  }
  return 0;
}

/**
 * Card band height. An in-flight `collapseAnim` replaces the rest body (card
 * wrapper) or shrinks/grows the nested folder inside it, matching the DOM height
 * the canvas rows already use. `collapsedIds` stay at the pre-tween set until
 * the animation ends.
 */
function bandHeight(
  group: GutterGroup,
  collapsed: ReadonlySet<string>,
  anim?: CollapseAnimState | null,
): number {
  const restBody = collapsed.has(group.id) ? 0 : subtreeHeight(group.lanes, collapsed);
  let body = restBody;
  if (anim && anim.hiddenHeight > 0 && anim.visible < 1) {
    if (anim.groupId === group.id) {
      body = anim.hiddenHeight * anim.visible;
    } else if (!collapsed.has(group.id) && laneTreeHas(group.lanes, anim.groupId)) {
      const keep = counterKeepOf(group.lanes, anim.groupId);
      const span = anim.hiddenHeight + keep;
      body = collapsed.has(anim.groupId)
        ? restBody + span * anim.visible
        : restBody - span * (1 - anim.visible);
    }
  }
  return LANE_GROUP_HEADER_HEIGHT + Math.max(0, body);
}

/** Content-Y bands for each Card group (header + expanded descendants). */
export function gutterGroupBands(
  groups: readonly GutterGroup[],
  collapsed: ReadonlySet<string>,
  anim?: CollapseAnimState | null,
): GutterGroupBand[] {
  const out: GutterGroupBand[] = [];
  let y = 0;
  for (const group of groups) {
    const h = bandHeight(group, collapsed, anim);
    out.push({ group, y, h });
    y += h;
  }
  return out;
}

export type GutterMount =
  | { kind: 'spacer'; h: number }
  | { kind: 'group'; group: GutterGroup };

export function shouldVirtualizeGutter(groupCount: number, viewH: number): boolean {
  return viewH > 0 && groupCount > GUTTER_VIRTUALIZE_AFTER_GROUPS;
}

/**
 * Mount only Card groups that intersect `[scrollY, scrollY + viewH]` plus overscan.
 * Consecutive misses become one spacer so scrollHeight stays honest.
 */
export function windowGutterGroups(
  bands: readonly GutterGroupBand[],
  scrollY: number,
  viewH: number,
  overscan = GUTTER_ROW_OVERSCAN_PX,
  keepGroupId?: string | null,
): GutterMount[] {
  if (viewH <= 0 || bands.length === 0) {
    return bands.map((b) => ({ kind: 'group' as const, group: b.group }));
  }
  const top = scrollY - overscan;
  const bottom = scrollY + viewH + overscan;
  const out: GutterMount[] = [];
  let spacer = 0;
  const flush = (): void => {
    if (spacer <= 0) return;
    out.push({ kind: 'spacer', h: spacer });
    spacer = 0;
  };
  for (const b of bands) {
    const keep = keepGroupId != null && b.group.id === keepGroupId;
    if (!keep && (b.y + b.h < top || b.y > bottom)) {
      spacer += b.h;
    } else {
      flush();
      out.push({ kind: 'group', group: b.group });
    }
  }
  flush();
  return out;
}
