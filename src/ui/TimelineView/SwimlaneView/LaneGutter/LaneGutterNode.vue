<script setup lang="ts">
import { computed, ref } from 'vue';
import Chevron from '../../../Chevron.vue';
import PinIcon from '../../../PinIcon.vue';
import type { GutterLane } from './gutterTypes';

const props = defineProps<{
  lane: GutterLane;
  depth: number;
  collapsedIds?: string[];
  pinnedLaneIds?: string[];
  /** Leaf id under canvas (or external) hover — shows pin + row highlight. */
  hoveredLaneId?: string | null;
}>();

const emit = defineEmits<{
  toggle: [id: string];
  'pin-lane': [id: string];
  'unpin-lane': [id: string];
}>();

const collapsed = computed(() => new Set(props.collapsedIds ?? []));
const pinned = computed(() => new Set(props.pinnedLaneIds ?? []));
const isFolder = computed(() => props.lane.children !== undefined);
const isCollapsed = computed(() => collapsed.value.has(props.lane.id));
const isPinned = computed(() => pinned.value.has(props.lane.id));
const pinPointerHover = ref(false);
const laneExternallyHovered = computed(
  () => !isFolder.value && props.hoveredLaneId != null && props.hoveredLaneId === props.lane.id,
);
/** Leaf/folder share the same indent; pin is absolute at gutter left. */
const pad = computed(() => `${24 + props.depth * 14}px`);
/** Thick: folders or depth-0 leaves (通信/储存HBM); thin: pipe leaves under Core. */
const utilSizeClass = computed(() =>
  isFolder.value || props.depth === 0 ? 'pr-gutter__util--thick' : 'pr-gutter__util--thin',
);

const UTIL_RED = '#733234';
const UTIL_GRAY = '#5c5c5c';

function pctLabel(util: number): string {
  return `${Math.round(util * 100)}%`;
}

/** Sketch: only red (&lt;50%) or gray (≥50%) — no pipe-category tint. */
function fillColor(util: number): string {
  return util < 0.5 ? UTIL_RED : UTIL_GRAY;
}

function onPinClick(e: MouseEvent) {
  e.stopPropagation();
  if (isPinned.value) emit('unpin-lane', props.lane.id);
  else emit('pin-lane', props.lane.id);
}
</script>

<template>
  <button
    v-if="isFolder"
    type="button"
    class="pr-gutter__lane pr-gutter__lane--folder"
    :style="{ paddingLeft: pad }"
    :data-testid="`gutter-folder-${lane.id}`"
    :aria-expanded="!isCollapsed"
    @click="emit('toggle', lane.id)"
  >
    <span class="pr-gutter__lane-main">
      <Chevron
        class="pr-gutter__chevron"
        :expanded="!isCollapsed"
      />
      <span
        class="pr-gutter__name"
        :title="lane.name"
      >{{ lane.name }}</span>
    </span>
    <span
      v-if="lane.utilization != null"
      class="pr-gutter__util"
      :class="utilSizeClass"
      data-testid="lane-util"
    >
      <span
        class="pr-gutter__util-fill"
        :style="{
          width: `${Math.min(100, Math.max(0, lane.utilization * 100))}%`,
          background: fillColor(lane.utilization),
        }"
      />
      <span
        class="pr-gutter__util-mid"
        aria-hidden="true"
      />
      <span
        v-if="utilSizeClass === 'pr-gutter__util--thick'"
        class="pr-gutter__util-pct"
      >{{ pctLabel(lane.utilization) }}</span>
    </span>
    <span
      v-else
      class="pr-gutter__util pr-gutter__util--empty"
      :class="utilSizeClass"
      aria-hidden="true"
    />
  </button>
  <template v-if="isFolder && !isCollapsed">
    <LaneGutterNode
      v-for="child in lane.children"
      :key="child.id"
      :lane="child"
      :depth="depth + 1"
      :collapsed-ids="collapsedIds"
      :pinned-lane-ids="pinnedLaneIds"
      :hovered-lane-id="hoveredLaneId"
      @toggle="(id) => emit('toggle', id)"
      @pin-lane="(id) => emit('pin-lane', id)"
      @unpin-lane="(id) => emit('unpin-lane', id)"
    />
  </template>
  <div
    v-else-if="!isFolder"
    class="pr-gutter__lane"
    :class="{ 'pr-gutter__lane--lane-hover': laneExternallyHovered }"
    :style="{ paddingLeft: pad }"
    :data-testid="`gutter-lane-${lane.id}`"
  >
    <button
      type="button"
      class="pr-gutter__pin"
      data-testid="lane-pin"
      :aria-label="'置顶'"
      :aria-pressed="isPinned"
      @click="onPinClick"
      @pointerenter="pinPointerHover = true"
      @pointerleave="pinPointerHover = false"
      @focus="pinPointerHover = true"
      @blur="pinPointerHover = false"
    >
      <PinIcon :filled="isPinned || pinPointerHover" />
      <span
        v-if="pinPointerHover"
        class="pr-gutter__pin-tip"
        role="tooltip"
      >置顶</span>
    </button>
    <span class="pr-gutter__lane-main">
      <span
        class="pr-gutter__name"
        :title="lane.name"
      >{{ lane.name }}</span>
    </span>
    <span
      v-if="lane.utilization != null"
      class="pr-gutter__util"
      :class="utilSizeClass"
      data-testid="lane-util"
    >
      <span
        class="pr-gutter__util-fill"
        :style="{
          width: `${Math.min(100, Math.max(0, lane.utilization * 100))}%`,
          background: fillColor(lane.utilization),
        }"
      />
      <span
        class="pr-gutter__util-mid"
        aria-hidden="true"
      />
      <span
        v-if="utilSizeClass === 'pr-gutter__util--thick'"
        class="pr-gutter__util-pct"
      >{{ pctLabel(lane.utilization) }}</span>
    </span>
    <span
      v-else
      class="pr-gutter__util pr-gutter__util--empty"
      :class="utilSizeClass"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.pr-gutter__lane {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px;
  gap: 6px;
  align-items: center;
  flex: 0 0 22px;
  height: 22px;
  min-height: 22px;
  padding: 0 8px 0 24px;
  border-bottom: 1px solid #3a3a3a;
  width: 100%;
  margin: 0;
  border-left: 0;
  border-right: 0;
  border-top: 0;
  background: #1f1f1f;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: default;
  position: relative;
}

.pr-gutter__lane--folder {
  cursor: pointer;
}

.pr-gutter__lane:hover,
.pr-gutter__lane--lane-hover {
  background: #252525;
}

.pr-gutter__lane-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.pr-gutter__pin {
  box-sizing: border-box;
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  flex: 0 0 10px;
  width: 10px;
  height: 10px;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  visibility: hidden;
  opacity: 0;
}

.pr-gutter__lane:hover .pr-gutter__pin,
.pr-gutter__lane--lane-hover .pr-gutter__pin,
.pr-gutter__pin:focus-visible {
  visibility: visible;
  opacity: 1;
}

.pr-gutter__pin-tip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 6px);
  transform: translateX(-50%);
  z-index: 2;
  padding: 4px 8px;
  background: #2a2a2a;
  border: 1px solid #555;
  border-radius: 2px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 1.2;
  color: #e8e8e8;
  white-space: nowrap;
  pointer-events: none;
}

.pr-gutter__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 400;
  color: #b0b0b0;
}

.pr-gutter__util {
  position: relative;
  display: block;
  box-sizing: border-box;
  width: 110px;
  background: repeating-linear-gradient(
    -45deg,
    #3a3a3a 0,
    #3a3a3a 1px,
    #2a2a2a 1px,
    #2a2a2a 4px
  );
  border-radius: 2px;
  overflow: hidden;
}

.pr-gutter__util-mid {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  border-left: 1px dashed rgba(255, 255, 255, 0.1);
  pointer-events: none;
  z-index: 1;
}

.pr-gutter__util--thick {
  height: 16px;
}

.pr-gutter__util--thin {
  height: 8px;
}

.pr-gutter__util--empty {
  background: transparent;
}

.pr-gutter__util-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  min-width: 0;
  border-radius: 0;
}

.pr-gutter__util-pct {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #b0b0b0;
  line-height: 1;
  pointer-events: none;
  z-index: 2;
}
</style>
