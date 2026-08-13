<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  DEFAULT_DEPENDENCY_DEPTH,
  type DependencyMode,
  type MeasureRange,
  type SwimEvent,
  type SwimlaneModel,
  type SwimlaneViewState,
  type TimeDisplayUnit,
} from '../../../domain/types';
import { LANE_GROUP_HEADER_HEIGHT, LANE_HEIGHT } from '../../../swimlane/layout';
import {
  GUTTER_WIDTH_DEFAULT,
  GUTTER_WIDTH_MAX,
  GUTTER_WIDTH_MIN,
  startHorizontalResize,
} from '../../panelResize';
import LaneGutter, { type GutterGroup, type GutterLane } from './LaneGutter/LaneGutter.vue';
import SwimlaneCanvas from './SwimlaneCanvas/SwimlaneCanvas.vue';

const props = withDefaults(
  defineProps<{
    groups: GutterGroup[];
    collapsedIds: string[];
    model: SwimlaneModel | null;
    view: SwimlaneViewState;
    selectedEventId: string | null;
    hoveredEventId: string | null;
    searchQuery: string;
    measureMode?: boolean;
    measureRange?: MeasureRange | null;
    timeUnit?: TimeDisplayUnit;
    dependencyMode?: DependencyMode;
    dependencyDepth?: number;
    preferRenderer?: 'auto' | 'webgl' | 'canvas';
    gutterWidth?: number;
  }>(),
  {
    dependencyMode: 'all',
    dependencyDepth: DEFAULT_DEPENDENCY_DEPTH,
  },
);

const emit = defineEmits<{
  'update:scrollY': [scrollY: number];
  'update:gutterWidth': [width: number];
  'toggle-group': [groupId: string];
  select: [event: SwimEvent | null];
  hover: [event: SwimEvent | null, clientX: number, clientY: number];
  cursor: [payload: { time: number; xRatio: number } | null];
  pan: [deltaTime: number];
  zoom: [factor: number, anchorTime: number];
  'set-playhead': [time: number];
  'update:measure-range': [range: MeasureRange | null];
}>();

const gutterRef = ref<{ root: HTMLElement | null } | null>(null);
const localGutterWidth = ref(props.gutterWidth ?? GUTTER_WIDTH_DEFAULT);
/** Swimlane mouse-follow bar (DOM above Card strips). */
const cursorXRatio = ref<number | null>(null);

watch(
  () => props.gutterWidth,
  (w) => {
    if (w != null) localGutterWidth.value = w;
  },
);

const collapsed = computed(() => new Set(props.collapsedIds));

function laneStackHeight(lanes: GutterLane[]): number {
  let h = 0;
  for (const lane of lanes) {
    h += LANE_HEIGHT;
    if (lane.children !== undefined && !collapsed.value.has(lane.id)) {
      h += laneStackHeight(lane.children);
    }
  }
  return h;
}

/** Card headers aligned with canvas layout Y (content coords). */
const cardHeaders = computed(() => {
  const out: { id: string; name: string; y: number; expanded: boolean }[] = [];
  let y = 0;
  for (const group of props.groups) {
    out.push({
      id: group.id,
      name: group.name,
      y,
      expanded: !collapsed.value.has(group.id),
    });
    y += LANE_GROUP_HEADER_HEIGHT;
    if (!collapsed.value.has(group.id)) {
      y += laneStackHeight(group.lanes);
    }
  }
  return out;
});

const visibleCardStrips = computed(() => {
  const scrollY = props.view.scrollY;
  // Body height unknown here; keep strips with any overlap of a generous viewport.
  return cardHeaders.value
    .map((h) => ({
      ...h,
      top: h.y - scrollY,
    }))
    .filter((h) => h.top + LANE_GROUP_HEADER_HEIGHT > 0 && h.top < 4000);
});

watch(
  () => props.view.scrollY,
  (y) => {
    const el = gutterRef.value?.root;
    if (el && Math.abs(el.scrollTop - y) > 0.5) {
      el.scrollTop = y;
    }
  },
);

function onScrollY(scrollY: number) {
  emit('update:scrollY', Math.max(0, scrollY));
}

function onGutterScroll(): void {
  const el = gutterRef.value?.root;
  if (!el) return;
  if (Math.abs(el.scrollTop - props.view.scrollY) > 0.5) {
    onScrollY(el.scrollTop);
  }
}

let gutterResizeSession: ReturnType<typeof startHorizontalResize> | null = null;

function onGutterResizePointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  gutterResizeSession = startHorizontalResize({
    startClientX: e.clientX,
    startWidth: localGutterWidth.value,
    min: GUTTER_WIDTH_MIN,
    max: GUTTER_WIDTH_MAX,
    direction: 1,
    onChange: (w) => {
      localGutterWidth.value = w;
      emit('update:gutterWidth', w);
    },
  });
  e.preventDefault();
}

function onGutterResizePointerMove(e: PointerEvent) {
  gutterResizeSession?.move(e.clientX);
}

function onGutterResizePointerUp() {
  gutterResizeSession?.end();
  gutterResizeSession = null;
}

function onCursor(payload: { time: number; xRatio: number } | null) {
  cursorXRatio.value = payload?.xRatio ?? null;
  emit('cursor', payload);
}

defineExpose({
  get gutterRoot() {
    return gutterRef.value?.root ?? null;
  },
});
</script>

<template>
  <div
    class="pr-swim-row pr-swim-row--body"
    :style="{ '--pr-gutter-width': `${localGutterWidth}px` }"
  >
    <button
      type="button"
      class="pr-gutter-resize"
      data-testid="gutter-resize-handle"
      aria-label="Resize lane gutter"
      @pointerdown="onGutterResizePointerDown"
      @pointermove="onGutterResizePointerMove"
      @pointerup="onGutterResizePointerUp"
      @pointercancel="onGutterResizePointerUp"
    />

    <LaneGutter
      ref="gutterRef"
      :groups="groups"
      :collapsed-ids="collapsedIds"
      @scroll="onGutterScroll"
      @toggle-group="emit('toggle-group', $event)"
    />
    <SwimlaneCanvas
      :model="model"
      :view="view"
      :selected-event-id="selectedEventId"
      :hovered-event-id="hoveredEventId"
      :search-query="searchQuery"
      :measure-mode="measureMode"
      :measure-range="measureRange"
      :time-unit="timeUnit"
      :dependency-mode="dependencyMode"
      :dependency-depth="dependencyDepth"
      :prefer-renderer="preferRenderer ?? 'auto'"
      @select="emit('select', $event)"
      @hover="(ev, x, y) => emit('hover', ev, x, y)"
      @cursor="onCursor"
      @set-playhead="emit('set-playhead', $event)"
      @pan="emit('pan', $event)"
      @zoom="(f, a) => emit('zoom', f, a)"
      @scroll-y="onScrollY"
      @update:measure-range="emit('update:measure-range', $event)"
    />

    <div
      class="pr-card-strips"
      data-testid="card-strips"
    >
      <button
        v-for="strip in visibleCardStrips"
        :key="strip.id"
        type="button"
        class="pr-card-strip"
        :data-testid="`card-strip-${strip.id}`"
        :aria-expanded="strip.expanded"
        :aria-label="strip.name"
        :style="{ top: `${strip.top}px` }"
        @click="emit('toggle-group', strip.id)"
      >
        <span
          class="pr-card-strip__label"
          :style="{ width: `var(--pr-gutter-width, ${localGutterWidth}px)` }"
        >
          <span
            class="pr-card-strip__chevron"
            :class="strip.expanded ? 'pr-card-strip__chevron--down' : 'pr-card-strip__chevron--right'"
            aria-hidden="true"
          />
          <span class="pr-card-strip__name">{{ strip.name }}</span>
        </span>
      </button>
    </div>

    <!-- Above Card strips; measure borders stay in canvas under strips. -->
    <div
      class="pr-swim-cursor-layer"
      data-testid="swim-cursor-layer"
      aria-hidden="true"
    >
      <div
        v-if="cursorXRatio != null"
        class="pr-swim-cursor"
        data-testid="swim-cursor"
        :style="{ left: `${cursorXRatio * 100}%` }"
      />
    </div>
  </div>
</template>

<style scoped>
.pr-swim-row {
  display: grid;
  grid-template-columns: var(--pr-gutter-width, 280px) 1fr;
  gap: 0;
  align-items: stretch;
  min-height: 0;
}

.pr-swim-row--body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}

.pr-gutter-resize {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--pr-gutter-width, 280px);
  width: 5px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: ew-resize;
  z-index: 5;
  transform: translateX(-50%);
}

.pr-gutter-resize:hover,
.pr-gutter-resize:active {
  background: rgba(49, 122, 247, 0.35);
}

.pr-card-strips {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 8;
  overflow: hidden;
}

.pr-swim-cursor-layer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: var(--pr-gutter-width, 280px);
  pointer-events: none;
  z-index: 9;
  overflow: hidden;
}

.pr-swim-cursor {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #317af7;
  transform: translateX(-0.5px);
}

.pr-card-strip {
  position: absolute;
  left: 0;
  right: 0;
  height: 28px;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0;
  border-bottom: 1px solid #3a3a3a;
  background: rgb(42, 42, 42);
  color: #e8e8e8;
  font: inherit;
  cursor: pointer;
  pointer-events: auto;
  display: flex;
  align-items: stretch;
  text-align: left;
}

.pr-card-strip:hover {
  background: rgb(50, 50, 50);
}

.pr-card-strip__label {
  box-sizing: border-box;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  min-width: 0;
}

.pr-card-strip__chevron {
  box-sizing: border-box;
  flex: 0 0 10px;
  width: 10px;
  height: 10px;
  display: inline-block;
  position: relative;
  color: #a8a8a8;
}

.pr-card-strip__chevron::before {
  content: '';
  position: absolute;
  box-sizing: border-box;
  border-style: solid;
  border-color: currentColor;
  border-width: 0 1.2px 1.2px 0;
  width: 5px;
  height: 5px;
}

.pr-card-strip__chevron--down::before {
  top: 1px;
  left: 2px;
  transform: rotate(45deg);
}

.pr-card-strip__chevron--right::before {
  top: 2px;
  left: 1px;
  transform: rotate(-45deg);
}

.pr-card-strip__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
}

@media (max-width: 900px) {
  .pr-swim-row {
    grid-template-columns: 1fr;
  }

  .pr-gutter-resize {
    display: none;
  }
}
</style>
