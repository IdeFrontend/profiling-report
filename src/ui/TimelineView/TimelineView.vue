<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { buildAxisRulerTicks } from '../../domain/axisRuler';
import {
  formatCursorTime,
  formatTime,
  resolveCursorTimeUnit,
} from '../../domain/formatTime';
import {
  DEFAULT_DEPENDENCY_DEPTH,
  type DependencyMode,
  type MeasureRange,
  type SwimEvent,
  type SwimlaneModel,
  type SwimlaneViewState,
  type TimeDisplayUnit,
} from '../../domain/types';
import {
  GUTTER_WIDTH_DEFAULT,
  GUTTER_WIDTH_MAX,
  GUTTER_WIDTH_MIN,
  startHorizontalResize,
} from '../panelResize';
import { normalizeMeasureRange } from '../../domain/viewState';
import TimeOverviewBar from './TimeOverviewBar/TimeOverviewBar.vue';
import AxisRuler from './TimeAxis/AxisRuler/AxisRuler.vue';
import CursorTimestamp from './TimeAxis/CursorTimestamp/CursorTimestamp.vue';
import type { GutterGroup } from './SwimlaneView/LaneGutter/LaneGutter.vue';
import SwimlaneView from './SwimlaneView/SwimlaneView.vue';

const props = withDefaults(
  defineProps<{
    bounds: { minTime: number; maxTime: number };
    view: SwimlaneViewState;
    unit: TimeDisplayUnit;
    dependencyMode?: DependencyMode;
    dependencyDepth?: number;
    groups: GutterGroup[];
    collapsedIds: string[];
    displaySwim: SwimlaneModel | null;
    cursor: { time: number; xRatio: number } | null;
    showOverviewCharts?: boolean;
    gutterWidth?: number;
    preferRenderer?: 'auto' | 'webgl' | 'canvas';
  }>(),
  {
    dependencyMode: 'all',
    dependencyDepth: DEFAULT_DEPENDENCY_DEPTH,
  },
);

const emit = defineEmits<{
  'update:gutterWidth': [width: number];
  'update:scrollY': [scrollY: number];
  'update:window': [window: { startTime: number; endTime: number }];
  'toggle-group': [groupId: string];
  select: [event: SwimEvent | null];
  hover: [event: SwimEvent | null, clientX: number, clientY: number];
  cursor: [payload: { time: number; xRatio: number } | null];
  pan: [deltaTime: number];
  zoom: [factor: number, anchorTime: number];
  'set-playhead': [time: number];
  'update:measure-range': [range: MeasureRange | null];
}>();

const timeAxisRef = ref<HTMLElement | null>(null);
const timeAxisWidth = ref(0);
const swimlaneRef = ref<{ gutterRoot: HTMLElement | null } | null>(null);
const localGutterWidth = ref(props.gutterWidth ?? GUTTER_WIDTH_DEFAULT);

watch(
  () => props.gutterWidth,
  (w) => {
    if (w != null) localGutterWidth.value = w;
  },
);

const cursorTimeUnit = computed(() =>
  resolveCursorTimeUnit(props.bounds.maxTime - props.bounds.minTime, props.unit),
);

const viewportRuler = computed(() =>
  buildAxisRulerTicks({
    rangeStart: props.view.startTime,
    rangeEnd: props.view.endTime,
    origin: props.bounds.minTime,
    timeUnit: props.unit,
    widthPx: timeAxisWidth.value,
  }),
);

/** Measure range as % of the viewport span — independent of measured axis width. */
const measureAxis = computed(() => {
  const range = props.view.measureRange;
  if (!props.view.measureMode || !range) return null;
  const span = Math.max(1, props.view.endTime - props.view.startTime);
  const start = Math.min(range.startTime, range.endTime);
  const end = Math.max(range.startTime, range.endTime);
  if (!(end > start)) return null;
  const left = ((start - props.view.startTime) / span) * 100;
  const width = ((end - start) / span) * 100;
  return {
    left,
    right: left + width,
    width,
    label: formatTime(end - start, props.unit),
  };
});

watch(
  timeAxisRef,
  (el, _prev, onCleanup) => {
    if (!el || typeof ResizeObserver === 'undefined') {
      if (el) timeAxisWidth.value = el.clientWidth || 0;
      return;
    }
    const sync = () => {
      timeAxisWidth.value = el.clientWidth || 0;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  },
  { flush: 'post' },
);

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

/** Measure drag on the viewport time axis (same interaction as swimlane measure). */
let measureAnchorTime: number | null = null;
let measureGestureActive = false;

function timeAtAxisX(clientX: number): number {
  const el = timeAxisRef.value;
  if (!el) return props.view.startTime;
  const rect = el.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
  const span = Math.max(1, props.view.endTime - props.view.startTime);
  return props.view.startTime + ratio * span;
}

function onAxisPointerDown(e: PointerEvent) {
  if (e.button !== 0 || !props.view.measureMode) return;
  measureGestureActive = true;
  measureAnchorTime = timeAtAxisX(e.clientX);
  emit('update:measure-range', normalizeMeasureRange(measureAnchorTime, measureAnchorTime));
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  e.preventDefault();
}

function onAxisPointerMove(e: PointerEvent) {
  if (!measureGestureActive || measureAnchorTime == null) return;
  emit('update:measure-range', normalizeMeasureRange(measureAnchorTime, timeAtAxisX(e.clientX)));
}

function onAxisPointerUp() {
  measureGestureActive = false;
  measureAnchorTime = null;
}

watch(
  () => props.view.measureMode,
  (mode) => {
    if (!mode) onAxisPointerUp();
  },
);

defineExpose({
  get gutterRoot() {
    return swimlaneRef.value?.gutterRoot ?? null;
  },
});
</script>

<template>
  <div
    class="pr-main-swim"
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
    <div class="pr-swim-row pr-swim-row--overview">
      <div
        class="pr-gutter pr-gutter--axis-spacer"
        aria-hidden="true"
      />
      <TimeOverviewBar
        :min-time="bounds.minTime"
        :max-time="bounds.maxTime"
        :start-time="view.startTime"
        :end-time="view.endTime"
        :time-unit="unit"
        @update:window="emit('update:window', $event)"
      />
    </div>

    <div class="pr-swim-row pr-swim-row--head">
      <div
        class="pr-gutter pr-gutter--axis-spacer"
        aria-hidden="true"
      />
      <div
        ref="timeAxisRef"
        class="pr-time-axis"
        data-testid="time-axis"
        :class="{ 'pr-time-axis--measure': view.measureMode }"
        @pointerdown="onAxisPointerDown"
        @pointermove="onAxisPointerMove"
        @pointerup="onAxisPointerUp"
        @pointercancel="onAxisPointerUp"
      >
        <AxisRuler
          :majors="viewportRuler.majors"
          :minors="viewportRuler.minors"
        />
        <CursorTimestamp
          v-if="cursor"
          :x-ratio="cursor.xRatio"
          :label="formatCursorTime(cursor.time - bounds.minTime, cursorTimeUnit)"
        />
        <template v-if="measureAxis">
          <div
            class="pr-measure-axis-bar pr-measure-axis-bar--left"
            data-testid="measure-axis-bar-left"
            :style="{ left: `${measureAxis.left}%` }"
          />
          <div
            class="pr-measure-axis-bar pr-measure-axis-bar--right"
            data-testid="measure-axis-bar-right"
            :style="{ left: `${measureAxis.right}%` }"
          />
          <div
            class="pr-measure-arrow"
            data-testid="measure-arrow"
            :style="{ left: `${measureAxis.left}%`, width: `${measureAxis.width}%` }"
          >
            <!--
              Absolute geometry (px):
              - heads start 1px from bars (tip–bar gap)
              - tip vertex inset in SVG so miter stays sharp without eating the gap
              - shaft reaches ~where arm gap ≈ stroke, so it meets the arms
            -->
            <svg
              class="pr-measure-arrow__head pr-measure-arrow__head--left"
              data-testid="measure-arrow-head"
              viewBox="0 0 9 10"
              width="9"
              height="10"
              aria-hidden="true"
            >
              <path
                d="M8 1.5 L2 5 L8 8.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="butt"
                stroke-linejoin="miter"
                stroke-miterlimit="8"
              />
            </svg>
            <div class="pr-measure-arrow__shaft" />
            <svg
              class="pr-measure-arrow__head pr-measure-arrow__head--right"
              data-testid="measure-arrow-head"
              viewBox="0 0 9 10"
              width="9"
              height="10"
              aria-hidden="true"
            >
              <path
                d="M1 1.5 L7 5 L1 8.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="butt"
                stroke-linejoin="miter"
                stroke-miterlimit="8"
              />
            </svg>
            <span
              class="pr-measure-arrow__label"
              data-testid="measure-label"
            >{{ measureAxis.label }}</span>
          </div>
        </template>
      </div>
    </div>

    <SwimlaneView
      ref="swimlaneRef"
      :groups="groups"
      :collapsed-ids="collapsedIds"
      :model="displaySwim"
      :view="view"
      :selected-event-id="view.selectedEventId"
      :hovered-event-id="view.hoveredEventId"
      :search-query="view.searchQuery"
      :measure-mode="view.measureMode"
      :measure-range="view.measureRange"
      :time-unit="unit"
      :dependency-mode="dependencyMode"
      :dependency-depth="dependencyDepth"
      :prefer-renderer="preferRenderer ?? 'auto'"
      @update:scroll-y="emit('update:scrollY', $event)"
      @toggle-group="emit('toggle-group', $event)"
      @select="emit('select', $event)"
      @hover="(ev, x, y) => emit('hover', ev, x, y)"
      @cursor="emit('cursor', $event)"
      @set-playhead="emit('set-playhead', $event)"
      @pan="emit('pan', $event)"
      @zoom="(f, a) => emit('zoom', f, a)"
      @update:measure-range="emit('update:measure-range', $event)"
    />

    <div
      v-if="showOverviewCharts"
      data-testid="overview-charts"
      class="pr-overview-charts"
    >
      Overview charts
    </div>
  </div>
</template>

<style scoped>
.pr-main-swim {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
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
  z-index: 6;
  transform: translateX(-50%);
}

.pr-gutter-resize:hover,
.pr-gutter-resize:active {
  background: rgba(49, 122, 247, 0.35);
}

.pr-swim-row {
  display: grid;
  grid-template-columns: var(--pr-gutter-width, 280px) 1fr;
  gap: 0;
  align-items: stretch;
  min-height: 0;
}

.pr-swim-row.pr-swim-row--head,
.pr-swim-row.pr-swim-row--overview {
  flex: 0 0 auto;
}

.pr-swim-row.pr-swim-row--overview {
  align-items: stretch;
}

.pr-time-axis {
  position: relative;
  height: 20px;
  color: #c8c8c8;
  border-bottom: 1px solid #3a3a3a;
  flex: 0 0 auto;
  overflow: hidden;
}

.pr-time-axis--measure {
  cursor: col-resize;
  touch-action: none;
}

/* Measure range markers on the viewport time axis (v930/task-measure-mode). */
.pr-measure-axis-bar {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--pr-playhead, #3078f0);
  pointer-events: none;
  z-index: 3;
  transform: translateX(-0.5px);
}

.pr-measure-arrow {
  position: absolute;
  top: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 4;
  color: rgba(49, 122, 247, 1);
}

.pr-measure-arrow__shaft {
  position: absolute;
  top: 50%;
  /* Head at 1px, tip at SVG x=2 → arm gap≈1.5px near SVG x=3.3 → abs ~4.3px */
  left: 4px;
  right: 4px;
  height: 1.5px;
  background: currentColor;
  transform: translateY(-50%);
  z-index: 0;
}

.pr-measure-arrow__head {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: block;
  overflow: visible;
  z-index: 1;
}

.pr-measure-arrow__head--left {
  left: 1px;
}

.pr-measure-arrow__head--right {
  right: 1px;
}

.pr-measure-arrow__label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 1px 8px;
  border-radius: 3px;
  background: var(--pr-playhead, #3078f0);
  color: #ffffff;
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  z-index: 2;
}

.pr-gutter--axis-spacer {
  border-bottom: 1px solid #3a3a3a;
  background: #1f1f1f;
  border-right: 1px solid #3a3a3a;
}

.pr-swim-row.pr-swim-row--overview .pr-gutter--axis-spacer {
  border-bottom: 1px solid #4a4a4a;
}

.pr-overview-charts {
  flex: 0 0 auto;
  padding: 8px 12px;
  color: #888;
}

@media (max-width: 900px) {
  .pr-swim-row {
    grid-template-columns: 1fr;
  }

  .pr-swim-row--head {
    display: block;
  }

  .pr-gutter--axis-spacer {
    display: none;
  }

  .pr-gutter-resize {
    display: none;
  }
}
</style>
