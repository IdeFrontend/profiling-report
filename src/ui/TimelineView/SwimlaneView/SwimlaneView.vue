<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  DEFAULT_DEPENDENCY_DEPTH,
  type DependencyMode,
  type MeasureRange,
  type SwimEvent,
  type SwimlaneModel,
  type SwimlaneViewState,
} from '../../../domain/types';
import {
  LANE_GROUP_HEADER_FILL,
  LANE_GROUP_HEADER_HEIGHT,
  LANE_GROUP_HEADER_HOVER,
  LANE_HEIGHT,
  layoutHeaders,
} from '../../../swimlane/layout';
import { buildPinnedSwimModel, resolvePinnedGutterLanes } from './pinnedLanes';
import {
  GUTTER_WIDTH_DEFAULT,
  GUTTER_WIDTH_MAX,
  GUTTER_WIDTH_MIN,
  startHorizontalResize,
} from '../../panelResize';
import Chevron from '../../Chevron.vue';
import LaneGutter, { type GutterGroup } from './LaneGutter/LaneGutter.vue';
import LaneGutterNode from './LaneGutter/LaneGutterNode.vue';
import SwimlaneCanvas from './SwimlaneCanvas/SwimlaneCanvas.vue';

const props = withDefaults(
  defineProps<{
    groups: GutterGroup[];
    collapsedIds: string[];
    /** Leaf lane ids in pin order; sticky strip when non-empty. */
    pinnedLaneIds?: string[];
    model: SwimlaneModel | null;
    view: SwimlaneViewState;
    selectedEventId: string | null;
    hoveredEventId: string | null;
    searchQuery: string;
    measureMode?: boolean;
    measureRange?: MeasureRange | null;
    dependencyMode?: DependencyMode;
    dependencyDepth?: number;
    preferRenderer?: 'auto' | 'webgl' | 'canvas';
    gutterWidth?: number;
    /** Shared playhead x from parent (axis hover + canvas); drives the swim vertical bar. */
    cursorXRatio?: number | null;
    /** True when the cursor is magnetized to an event edge (gray the swim vertical bar). */
    cursorSnapped?: boolean;
    locale?: string;
  }>(),
  {
    dependencyMode: 'all',
    dependencyDepth: DEFAULT_DEPENDENCY_DEPTH,
    cursorXRatio: null,
    cursorSnapped: false,
  },
);

const emit = defineEmits<{
  'update:scrollY': [scrollY: number];
  'update:gutterWidth': [width: number];
  'toggle-group': [groupId: string];
  'pin-lane': [laneId: string];
  'unpin-lane': [laneId: string];
  select: [event: SwimEvent | null];
  hover: [event: SwimEvent | null, clientX: number, clientY: number];
  cursor: [payload: { time: number; xRatio: number; snapped?: boolean } | null];
  pan: [deltaTime: number];
  zoom: [factor: number, anchorTime: number];
  'set-playhead': [time: number];
  'update:measure-range': [range: MeasureRange | null];
  'suppress-measure-dt': [suppress: boolean];
}>();

const gutterRef = ref<{ root: HTMLElement | null } | null>(null);
type CanvasExpose = {
  handleWheel: (e: WheelEvent) => void;
  magnetizeAtClient: (
    clientX: number,
    clientY: number,
  ) => { time: number; xPx: number; xRatio: number; eventId: string | null } | null;
  magnetizeAtClientLocal: (
    clientX: number,
    clientY: number,
  ) => { time: number; xPx: number; xRatio: number; eventId: string | null } | null;
  clearEdgeSnapHighlight: () => void;
};
const canvasRef = ref<CanvasExpose | null>(null);
const pinnedCanvasRef = ref<CanvasExpose | null>(null);
const pinnedStripRef = ref<HTMLElement | null>(null);
const bodyRef = ref<HTMLElement | null>(null);
const bodyViewportH = ref(0);
const localGutterWidth = ref(props.gutterWidth ?? GUTTER_WIDTH_DEFAULT);
/** Swimlane mouse-follow bar; synced from canvas emits and parent `cursorXRatio` (axis hover). */
const cursorXRatio = ref<number | null>(props.cursorXRatio ?? null);
/** Gray the swim vertical bar while the cursor is magnetized to an event edge. */
const cursorSnapped = ref(props.cursorSnapped ?? false);

watch(
  () => props.cursorXRatio,
  (v) => {
    cursorXRatio.value = v ?? null;
  },
);

watch(
  () => props.cursorSnapped,
  (v) => {
    cursorSnapped.value = v ?? false;
  },
);

watch(
  () => props.gutterWidth,
  (w) => {
    if (w != null) localGutterWidth.value = w;
  },
);

const collapsed = computed(() => new Set(props.collapsedIds));

const pinnedLaneIds = computed(() => props.pinnedLaneIds ?? []);
const pinnedRows = computed(() => resolvePinnedGutterLanes(props.groups, pinnedLaneIds.value));
const pinnedModel = computed(() => buildPinnedSwimModel(props.model, pinnedLaneIds.value));
const pinnedStripHeight = computed(() => pinnedRows.value.length * LANE_HEIGHT);
const pinnedView = computed(() => ({
  startTime: props.view.startTime,
  endTime: props.view.endTime,
  scrollY: 0,
}));

/** Leaf under canvas pointer — gutter header `#252525` only (not pushpin). */
const hoveredLaneId = ref<string | null>(null);

function onLaneHover(id: string | null): void {
  hoveredLaneId.value = id;
}

/** Card header Y from the same row walk as the canvas, without an event-layout rebuild. */
const cardHeaders = computed(() =>
  layoutHeaders(props.model).map((h) => ({
    id: h.id,
    name: h.name,
    y: h.y,
    expanded: !collapsed.value.has(h.id),
  })),
);

const visibleCardStrips = computed(() => {
  const scrollY = props.view.scrollY;
  // 0 until ResizeObserver / mount measures the body; show all and let overflow:hidden clip.
  const viewportH = bodyViewportH.value > 0 ? bodyViewportH.value : Number.POSITIVE_INFINITY;
  return cardHeaders.value
    .map((h) => ({
      ...h,
      top: h.y - scrollY,
    }))
    .filter((h) => h.top + LANE_GROUP_HEADER_HEIGHT > 0 && h.top < viewportH);
});

let bodyResizeObserver: ResizeObserver | null = null;

onMounted(() => {
  const el = bodyRef.value;
  if (!el) return;
  const sync = () => {
    bodyViewportH.value = el.clientHeight;
  };
  sync();
  bodyResizeObserver = new ResizeObserver(sync);
  bodyResizeObserver.observe(el);
});

onUnmounted(() => {
  bodyResizeObserver?.disconnect();
  bodyResizeObserver = null;
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

function onCursor(payload: { time: number; xRatio: number; snapped?: boolean } | null) {
  cursorXRatio.value = payload?.xRatio ?? null;
  cursorSnapped.value = payload?.snapped ?? false;
  emit('cursor', payload);
}

/** Strips own the header hit target; clear immediately (do not wait for canvas leave). */
function clearCursor() {
  if (cursorXRatio.value == null && !cursorSnapped.value) return;
  cursorXRatio.value = null;
  cursorSnapped.value = false;
  emit('cursor', null);
}

/** Keep scroll/zoom working over full-width Card chrome. */
function onStripWheel(e: WheelEvent) {
  canvasRef.value?.handleWheel(e);
}

/** Magnet follows the canvas under the pointer (pin strip ↔ body). */
function magnetizeAtClient(clientX: number, clientY: number) {
  const strip = pinnedStripRef.value;
  if (strip) {
    const r = strip.getBoundingClientRect();
    if (clientY >= r.top && clientY < r.bottom) {
      canvasRef.value?.clearEdgeSnapHighlight();
      return pinnedCanvasRef.value?.magnetizeAtClientLocal(clientX, clientY) ?? null;
    }
  }
  pinnedCanvasRef.value?.clearEdgeSnapHighlight();
  return canvasRef.value?.magnetizeAtClientLocal(clientX, clientY) ?? null;
}

function clearEdgeSnapHighlight() {
  canvasRef.value?.clearEdgeSnapHighlight();
  pinnedCanvasRef.value?.clearEdgeSnapHighlight();
}

defineExpose({
  get gutterRoot() {
    return gutterRef.value?.root ?? null;
  },
  magnetizeAtClient,
  clearEdgeSnapHighlight,
});
</script>

<template>
  <div
    class="pr-swim-stack"
    :style="{ '--pr-gutter-width': `${localGutterWidth}px` }"
  >
    <div
      v-if="pinnedRows.length"
      ref="pinnedStripRef"
      class="pr-pinned-strip"
      data-testid="pinned-strip"
      :style="{ height: `${pinnedStripHeight}px` }"
    >
      <div
        class="pr-pinned-strip__gutter"
        data-testid="pinned-gutter"
      >
        <LaneGutterNode
          v-for="row in pinnedRows"
          :key="`pin-${row.lane.id}`"
          :lane="row.lane"
          :depth="row.depth"
          :pinned-lane-ids="pinnedLaneIds"
          :hovered-lane-id="hoveredLaneId"
          :locale="locale"
          @pin-lane="emit('pin-lane', $event)"
          @unpin-lane="emit('unpin-lane', $event)"
        />
      </div>
      <SwimlaneCanvas
        v-if="pinnedModel"
        ref="pinnedCanvasRef"
        class="pr-pinned-strip__canvas"
        data-testid="pinned-canvas"
        :model="pinnedModel"
        :view="pinnedView"
        :selected-event-id="selectedEventId"
        :hovered-event-id="hoveredEventId"
        :search-query="searchQuery"
        :measure-mode="measureMode"
        :measure-range="measureRange"
        :show-dependencies="false"
        :prefer-renderer="preferRenderer ?? 'auto'"
        :cursor-x-ratio="cursorXRatio"
        :cursor-snapped="cursorSnapped"
        :magnetize-at-client="magnetizeAtClient"
        @select="emit('select', $event)"
        @hover="(ev, x, y) => emit('hover', ev, x, y)"
        @lane-hover="onLaneHover"
        @cursor="onCursor"
        @set-playhead="emit('set-playhead', $event)"
        @pan="emit('pan', $event)"
        @zoom="(f, a) => emit('zoom', f, a)"
        @update:measure-range="emit('update:measure-range', $event)"
        @suppress-measure-dt="emit('suppress-measure-dt', $event)"
      />
    </div>

    <div
      ref="bodyRef"
      class="pr-swim-row pr-swim-row--body"
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
        :pinned-lane-ids="pinnedLaneIds"
        :hovered-lane-id="hoveredLaneId"
        :locale="locale"
        @scroll="onGutterScroll"
        @toggle-group="emit('toggle-group', $event)"
        @pin-lane="emit('pin-lane', $event)"
        @unpin-lane="emit('unpin-lane', $event)"
      />
      <SwimlaneCanvas
        ref="canvasRef"
        :model="model"
        :view="view"
        :selected-event-id="selectedEventId"
        :hovered-event-id="hoveredEventId"
        :search-query="searchQuery"
        :measure-mode="measureMode"
        :measure-range="measureRange"
        :dependency-mode="dependencyMode"
        :dependency-depth="dependencyDepth"
        :prefer-renderer="preferRenderer ?? 'auto'"
        :cursor-x-ratio="cursorXRatio"
        :cursor-snapped="cursorSnapped"
        :magnetize-at-client="magnetizeAtClient"
        @select="emit('select', $event)"
        @hover="(ev, x, y) => emit('hover', ev, x, y)"
        @lane-hover="onLaneHover"
        @cursor="onCursor"
        @set-playhead="emit('set-playhead', $event)"
        @pan="emit('pan', $event)"
        @zoom="(f, a) => emit('zoom', f, a)"
        @scroll-y="onScrollY"
        @update:measure-range="emit('update:measure-range', $event)"
        @suppress-measure-dt="emit('suppress-measure-dt', $event)"
      />

      <div
        class="pr-card-strips"
        data-testid="card-strips"
        :style="{
          '--pr-card-header-fill': LANE_GROUP_HEADER_FILL,
          '--pr-card-header-hover': LANE_GROUP_HEADER_HOVER,
        }"
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
          @pointerenter="clearCursor"
          @click="emit('toggle-group', strip.id)"
          @wheel="onStripWheel"
        >
          <span class="pr-card-strip__label">
            <Chevron
              class="pr-card-strip__chevron"
              :expanded="strip.expanded"
            />
            <span class="pr-card-strip__name">{{ strip.name }}</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pr-swim-stack {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.pr-pinned-strip {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: minmax(0, var(--pr-gutter-width, 280px)) minmax(80px, 1fr);
  gap: 0;
  align-items: stretch;
  min-width: 0;
  z-index: 6;
  border-bottom: 1px solid #555;
  background: #1f1f1f;
}

.pr-pinned-strip__gutter {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: #1f1f1f;
  border-right: 1px solid #3a3a3a;
  font-size: 11px;
  color: #b0b0b0;
}

.pr-pinned-strip__canvas {
  min-width: 0;
  min-height: 0;
}

.pr-swim-row {
  display: grid;
  /*
   * Gutter caps at --pr-gutter-width; track keeps a non-zero floor so the chart
   * cannot collapse when main is narrower than the gutter token.
   */
  grid-template-columns: minmax(0, var(--pr-gutter-width, 280px)) minmax(80px, 1fr);
  gap: 0;
  align-items: stretch;
  min-width: 0;
  min-height: 0;
}

.pr-swim-row--body {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* Pin to used gutter column so the handle stays on the seam when the column shrinks. */
/*
 * Pin to the used gutter column so the handle stays on the seam when the column
 * shrinks below --pr-gutter-width. Abspos grid children treat a lone
 * `grid-column: 1` end line as `auto` (= container padding edge), so the line
 * pair must be explicit (`1 / 2`) or `right: 0` parks on the far track edge.
 */
.pr-gutter-resize {
  grid-column: 1 / 2;
  grid-row: 1;
  position: absolute;
  top: 0;
  bottom: 0;
  left: auto;
  right: 0;
  width: 5px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: ew-resize;
  z-index: 5;
  transform: translateX(50%);
}

.pr-gutter-resize:hover,
.pr-gutter-resize:active {
  background: rgba(49, 122, 247, 0.35);
}

.pr-card-strips {
  grid-column: 1 / -1;
  grid-row: 1;
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 8;
  overflow: hidden;
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
  background: var(--pr-card-header-fill);
  color: #e8e8e8;
  font: inherit;
  cursor: pointer;
  pointer-events: auto;
  /* Same column formula as the swim row so the label tracks the used gutter. */
  display: grid;
  grid-template-columns: minmax(0, var(--pr-gutter-width, 280px)) minmax(80px, 1fr);
  align-items: stretch;
  text-align: left;
}

.pr-card-strip:hover {
  background: var(--pr-card-header-hover);
}

.pr-card-strip__label {
  box-sizing: border-box;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
}

.pr-card-strip__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
}
</style>
