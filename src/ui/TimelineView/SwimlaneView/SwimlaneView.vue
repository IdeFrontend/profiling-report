<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  DEFAULT_DEPENDENCY_DEPTH,
  type DependencyMode,
  type MeasureRange,
  type SwimEvent,
  type SwimlaneModel,
  type SwimlaneViewState,
  type TimeDisplayUnit,
} from '../../../domain/types';
import {
  LANE_GROUP_HEADER_FILL,
  LANE_GROUP_HEADER_HEIGHT,
  LANE_GROUP_HEADER_HOVER,
  layoutHeaders,
} from '../../../swimlane/layout';
import {
  GUTTER_WIDTH_DEFAULT,
  GUTTER_WIDTH_MAX,
  GUTTER_WIDTH_MIN,
  startHorizontalResize,
} from '../../panelResize';
import Chevron from '../../Chevron.vue';
import LaneGutter, { type GutterGroup } from './LaneGutter/LaneGutter.vue';
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
    /** Shared playhead x from parent (axis hover + canvas); drives the swim vertical bar. */
    cursorXRatio?: number | null;
    /** True when the cursor is magnetized to an event edge (gray the swim vertical bar). */
    cursorSnapped?: boolean;
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
const canvasRef = ref<{
  handleWheel: (e: WheelEvent) => void;
  magnetizeAtClient: (
    clientX: number,
    clientY: number,
  ) => { time: number; xPx: number; xRatio: number; eventId: string | null } | null;
  clearEdgeSnapHighlight: () => void;
} | null>(null);
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

defineExpose({
  get gutterRoot() {
    return gutterRef.value?.root ?? null;
  },
  magnetizeAtClient: (clientX: number, clientY: number) =>
    canvasRef.value?.magnetizeAtClient(clientX, clientY) ?? null,
  clearEdgeSnapHighlight: () => canvasRef.value?.clearEdgeSnapHighlight(),
});
</script>

<template>
  <div
    ref="bodyRef"
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
      ref="canvasRef"
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
      :cursor-x-ratio="cursorXRatio"
      :cursor-snapped="cursorSnapped"
      @select="emit('select', $event)"
      @hover="(ev, x, y) => emit('hover', ev, x, y)"
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
</template>

<style scoped>
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
.pr-gutter-resize {
  grid-column: 1;
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
