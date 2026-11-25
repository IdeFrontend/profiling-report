<script setup lang="ts">
import { computed, ref } from 'vue';
import { LANE_GROUP_HEADER_HEIGHT, type CollapseAnimState } from '../../../../swimlane/layout';
import LaneGutterNode from './LaneGutterNode.vue';
import type { GutterGroup, GutterLane } from './gutterTypes';
import {
  asIdSet,
  gutterGroupBands,
  shouldVirtualizeGutter,
  windowGutterGroups,
} from './gutterWindow';

export type { GutterGroup, GutterLane };

const props = defineProps<{
  groups: GutterGroup[];
  /** Card or nested folder ids whose descendants are hidden. */
  collapsedIds?: string[];
  /** Leaf lane ids currently pinned (filled pushpin). */
  pinnedLaneIds?: string[];
  /** Lane under canvas/gutter hover — row highlight only (does not show pushpin). */
  hoveredLaneId?: string | null;
  locale?: string;
  /** In-flight lane collapse/expand tween (see layout.CollapseAnimState). */
  collapseAnim?: CollapseAnimState | null;
  /** Content-space lane scroll (parent chrome scroll minus the overview pad). Enables group windowing. */
  scrollY?: number;
  /** Body viewport height in CSS px. 0 / omitted → mount every group. */
  viewportHeight?: number;
}>();

const emit = defineEmits<{
  scroll: [];
  'toggle-group': [groupId: string];
  'pin-lane': [laneId: string];
  'unpin-lane': [laneId: string];
  'lane-hover': [laneId: string | null];
  'context-menu': [payload: { x: number; y: number; laneId: string }];
}>();

const root = ref<HTMLElement | null>(null);

/** Card spacer is 40px and non-interactive; skip its layout when it is off-screen. */
const groupCullStyle = {
  contentVisibility: 'auto' as const,
  containIntrinsicSize: `auto ${LANE_GROUP_HEADER_HEIGHT}px`,
};

const collapsed = computed(() => asIdSet(props.collapsedIds));
const pinned = computed(() => asIdSet(props.pinnedLaneIds));

const bands = computed(() =>
  gutterGroupBands(props.groups, collapsed.value, props.collapseAnim),
);
/** Card group that holds keyboard focus — stays mounted past the overscan. */
const focusedGroupId = ref<string | null>(null);
const mounted = computed(() => {
  const viewH = props.viewportHeight ?? 0;
  if (!shouldVirtualizeGutter(bands.value.length, viewH)) {
    return bands.value.map((b) => ({ kind: 'group' as const, group: b.group }));
  }
  return windowGutterGroups(bands.value, props.scrollY ?? 0, viewH, undefined, focusedGroupId.value);
});

function onGutterFocusIn(e: FocusEvent): void {
  const el = (e.target as HTMLElement | null)?.closest?.('[data-gutter-card]');
  focusedGroupId.value = el?.getAttribute('data-gutter-card') ?? null;
}

function onGutterFocusOut(e: FocusEvent): void {
  const next = e.relatedTarget as Node | null;
  const host = e.currentTarget as HTMLElement;
  if (next && host.contains(next)) return;
  focusedGroupId.value = null;
}

function isCollapsed(id: string): boolean {
  return collapsed.value.has(id);
}

/** Height/opacity of the collapsible wrapper while its group is animating. */
function collapseStyle(id: string): Record<string, string> | undefined {
  const anim = props.collapseAnim;
  if (!anim || anim.groupId !== id || anim.hiddenHeight <= 0) return undefined;
  return {
    height: `${Math.max(0, anim.hiddenHeight * anim.visible)}px`,
    opacity: `${Math.max(0, Math.min(1, anim.visible))}`,
    overflow: 'hidden',
  };
}

defineExpose({ root });
</script>

<template>
  <div
    ref="root"
    class="pr-gutter"
    data-testid="lane-gutter"
    @scroll="emit('scroll')"
    @focusin="onGutterFocusIn"
    @focusout="onGutterFocusOut"
  >
    <template
      v-for="(slice, i) in mounted"
      :key="slice.kind === 'spacer' ? `spacer-${i}` : slice.group.id"
    >
      <div
        v-if="slice.kind === 'spacer'"
        class="pr-gutter__window-spacer"
        data-testid="gutter-window-spacer"
        :style="{ height: `${slice.h}px`, flex: `0 0 ${slice.h}px` }"
        aria-hidden="true"
      />
      <template v-else>
        <!-- Card chrome (label/click) lives on SwimlaneView full-width strips. -->
        <div
          class="pr-gutter__group"
          :data-testid="`gutter-group-${slice.group.id}`"
          :style="groupCullStyle"
          aria-hidden="true"
        />
        <div
          class="pr-gutter__collapse"
          :data-testid="`gutter-collapse-${slice.group.id}`"
          :data-gutter-card="slice.group.id"
          :style="collapseStyle(slice.group.id)"
        >
          <template v-if="!isCollapsed(slice.group.id)">
            <LaneGutterNode
              v-for="lane in slice.group.lanes"
              :key="lane.id"
              :lane="lane"
              :depth="0"
              :collapsed-ids="collapsed"
              :pinned-lane-ids="pinned"
              :hovered-lane-id="hoveredLaneId"
              :locale="locale"
              :util-midline-percent="slice.group.utilMidlinePercent"
              :collapse-anim="collapseAnim"
              @toggle="(id) => emit('toggle-group', id)"
              @pin-lane="(id) => emit('pin-lane', id)"
              @unpin-lane="(id) => emit('unpin-lane', id)"
              @lane-hover="(id) => emit('lane-hover', id)"
              @context-menu="(payload) => emit('context-menu', payload)"
            />
          </template>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.pr-gutter {
  position: relative;
  display: flex;
  flex-direction: column;
  font-size: 11px;
  color: #b0b0b0;
  /* Wheel is forwarded to the canvas; hide native overflow so labels stay row-aligned. */
  overflow: hidden;
  /* Dock mount shrinks this viewport; without this the browser scroll-anchors
   * and bumps scrollTop (timeline jumps under a live marquee far from edges). */
  overflow-anchor: none;
  scrollbar-width: none;
  -ms-overflow-style: none;
  min-height: 0;
  background: #1f1f1f;
  border-right: 1px solid #3a3a3a;
  padding: 0;
}

.pr-gutter::-webkit-scrollbar {
  display: none;
}

.pr-gutter__group {
  box-sizing: border-box;
  flex: 0 0 40px;
  height: 40px;
  min-height: 40px;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  border-bottom: 1px solid #3a3a3a;
  background: transparent;
  pointer-events: none;
}

/* Wraps a Card's (or folder's) descendant rows so the collapse tween can animate
   height + opacity; `overflow: hidden` is applied inline only while animating so the
   pin tooltip is not clipped at rest. */
.pr-gutter__window-spacer {
  flex-shrink: 0;
  pointer-events: none;
}

.pr-gutter__collapse {
  flex: 0 0 auto;
  min-width: 0;
}
</style>
