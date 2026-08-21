<script setup lang="ts">
import { computed } from 'vue';
import type { GutterLane } from './gutterTypes';

const props = defineProps<{
  lane: GutterLane;
  depth: number;
  collapsedIds?: string[];
}>();

const emit = defineEmits<{
  toggle: [id: string];
}>();

const collapsed = computed(() => new Set(props.collapsedIds ?? []));
const isFolder = computed(() => props.lane.children !== undefined);
const isCollapsed = computed(() => collapsed.value.has(props.lane.id));
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
      <span
        class="pr-gutter__chevron"
        :class="isCollapsed ? 'pr-gutter__chevron--right' : 'pr-gutter__chevron--down'"
        aria-hidden="true"
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
      @toggle="(id) => emit('toggle', id)"
    />
  </template>
  <div
    v-else-if="!isFolder"
    class="pr-gutter__lane"
    :style="{ paddingLeft: pad }"
    :data-testid="`gutter-lane-${lane.id}`"
  >
    <span
      class="pr-gutter__name"
      :title="lane.name"
    >{{ lane.name }}</span>
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
.pr-gutter__chevron {
  box-sizing: border-box;
  flex: 0 0 10px;
  width: 10px;
  height: 10px;
  display: inline-block;
  position: relative;
  color: #a8a8a8;
}

.pr-gutter__chevron::before {
  content: '';
  position: absolute;
  box-sizing: border-box;
  border-style: solid;
  border-color: currentColor;
  border-width: 0 1.2px 1.2px 0;
  width: 5px;
  height: 5px;
}

.pr-gutter__chevron--down::before {
  top: 1px;
  left: 2px;
  transform: rotate(45deg);
}

.pr-gutter__chevron--right::before {
  top: 2px;
  left: 1px;
  transform: rotate(-45deg);
}

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
}

.pr-gutter__lane--folder {
  cursor: pointer;
}

.pr-gutter__lane--folder:hover {
  background: #252525;
}

.pr-gutter__lane-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
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

.pr-gutter__util:not(.pr-gutter__util--empty)::after {
  content: '';
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
