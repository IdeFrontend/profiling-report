<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { buildAxisRulerTicks } from '../../domain/axisRuler';
import { formatDisplayTime, formatTime } from '../../domain/formatTime';
import {
  DEFAULT_DEPENDENCY_DEPTH,
  type DependencyMode,
  type MeasureRange,
  type SwimEvent,
  type SwimlaneModel,
  type SwimlaneViewState,
  type TimeDisplayUnit,
} from '../../domain/types';
import { GUTTER_WIDTH_DEFAULT } from '../panelResize';
import { normalizeMeasureRange } from '../../domain/viewState';
import TimeOverviewBar from './TimeOverviewBar/TimeOverviewBar.vue';
import AxisRuler from './TimeAxis/AxisRuler/AxisRuler.vue';
import CursorTimestamp from './TimeAxis/CursorTimestamp/CursorTimestamp.vue';
import type { GutterGroup } from './SwimlaneView/LaneGutter/LaneGutter.vue';
import SwimlaneView from './SwimlaneView/SwimlaneView.vue';
import type { ReportFontFamily } from '../fontStack';
import {
  CURSOR_LABEL_MIN_WIDTH_PX,
  MEASURE_ARROW_HEAD_PX,
  MEASURE_OUTSIDE_LABEL_GAP_PX,
  cursorLabelOverlapsMeasureChrome,
  estimateAxisLabelWidth,
} from './cursorMeasureOverlap';
import {
  bindWindowPointerDrag,
  measureResizeMinSpan,
  resizeMeasureEdge,
  type MeasureResizeEdge,
} from './measureEdgeResize';

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
    fontFamily?: ReportFontFamily;
  }>(),
  {
    dependencyMode: 'all',
    dependencyDepth: DEFAULT_DEPENDENCY_DEPTH,
    fontFamily: 'system',
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
  'focus-measure': [];
}>();

const timeAxisRef = ref<HTMLElement | null>(null);
const timeAxisWidth = ref(0);
const measureLabelRef = ref<HTMLElement | null>(null);
const measureLabelWidth = ref(0);
const swimlaneRef = ref<{
  gutterRoot: HTMLElement | null;
  magnetizeAtClient?: (
    clientX: number,
    clientY: number,
  ) => { time: number; xRatio: number; eventId?: string | null } | null;
  clearEdgeSnapHighlight?: () => void;
} | null>(null);
const localGutterWidth = ref(props.gutterWidth ?? GUTTER_WIDTH_DEFAULT);
/** Pointer is over the viewport time axis — keep cursor lifted above ticks. */
const axisHovering = ref(false);
/** Swimlane appear/clear tween: hide Δt arrow + label (borders/fades still animate). */
const suppressMeasureDt = ref(false);

/** Pads (2) + heads + shaft–label gaps — min width for inline Δt. */
const MEASURE_ARROW_CHROME_PX =
  2 + 2 * MEASURE_ARROW_HEAD_PX + 2 * MEASURE_OUTSIDE_LABEL_GAP_PX;
/** Pads (2) + heads — below this, heads overlap; hide heads + shaft. */
const MEASURE_HEADS_MIN_PX = 2 + 2 * MEASURE_ARROW_HEAD_PX;

watch(
  () => props.gutterWidth,
  (w) => {
    if (w != null) localGutterWidth.value = w;
  },
);

function onGutterWidth(w: number) {
  localGutterWidth.value = w;
  emit('update:gutterWidth', w);
}

const viewportRuler = computed(() =>
  buildAxisRulerTicks({
    rangeStart: props.view.startTime,
    rangeEnd: props.view.endTime,
    origin: props.bounds.minTime,
    timeUnit: props.unit,
    widthPx: timeAxisWidth.value,
  }),
);

/** Measure range as % of the viewport span — clamped; true edges only when in view. */
const measureAxis = computed(() => {
  const range = props.view.measureRange;
  if (!props.view.measureMode || !range) return null;
  const viewStart = props.view.startTime;
  const viewEnd = props.view.endTime;
  const span = Math.max(1, viewEnd - viewStart);
  const start = Math.min(range.startTime, range.endTime);
  const end = Math.max(range.startTime, range.endTime);
  if (!(end > start)) return null;
  const label = formatTime(end - start, props.unit);
  const visStart = Math.max(viewStart, start);
  const visEnd = Math.min(viewEnd, end);
  if (!(visEnd > visStart)) {
    // Fully outside: park a one-sided chevron + Δt at the near view edge (no edge bar).
    if (end <= viewStart) {
      return {
        placement: 'offscreen-left' as const,
        left: 0,
        right: 0,
        width: 0,
        showLeft: false,
        showRight: false,
        label,
      };
    }
    if (start >= viewEnd) {
      return {
        placement: 'offscreen-right' as const,
        left: 100,
        right: 100,
        width: 0,
        showLeft: false,
        showRight: false,
        label,
      };
    }
    return null;
  }
  const left = ((visStart - viewStart) / span) * 100;
  const width = ((visEnd - visStart) / span) * 100;
  return {
    placement: 'visible' as const,
    left,
    right: left + width,
    width,
    showLeft: start >= viewStart,
    showRight: end <= viewEnd,
    label,
  };
});

/** Inline label, outside label + arrow, offscreen cue, or outside label with no connector. */
const measureArrowLayout = computed(() => {
  if (suppressMeasureDt.value) return null;
  const axis = measureAxis.value;
  if (!axis) return null;
  if (axis.placement === 'offscreen-left') {
    return {
      mode: 'offscreen' as const,
      side: 'left' as const,
      style: { left: '0%' },
    };
  }
  if (axis.placement === 'offscreen-right') {
    return {
      mode: 'offscreen' as const,
      side: 'right' as const,
      style: { left: '100%' },
    };
  }
  const style = { left: `${axis.left}%`, width: `${axis.width}%` };
  const axisW = timeAxisWidth.value;
  if (axisW <= 0) {
    return { mode: 'inline' as const, style };
  }
  const rangePx = (axis.width / 100) * axisW;
  const labelW = measureLabelWidth.value || estimateAxisLabelWidth(axis.label);
  const minFit = MEASURE_ARROW_CHROME_PX + labelW;
  if (rangePx >= minFit) {
    return { mode: 'inline' as const, style };
  }
  const rightPx = (axis.right / 100) * axisW;
  const side =
    rightPx + MEASURE_OUTSIDE_LABEL_GAP_PX + labelW <= axisW
      ? ('right' as const)
      : ('left' as const);
  const mode = rangePx < MEASURE_HEADS_MIN_PX ? ('shaft' as const) : ('outside' as const);
  return { mode, side, style };
});

/** Lift cursor time pill above the axis when hovering the axis or covering measure chrome. */
const cursorLabelAbove = computed(() => {
  if (axisHovering.value && props.cursor) return true;
  const axis = measureAxis.value;
  const layout = measureArrowLayout.value;
  const cursor = props.cursor;
  const axisW = timeAxisWidth.value;
  if (!axis || !layout || !cursor || axisW <= 0) return false;
  const cursorLabel = formatDisplayTime(cursor.time, props.bounds.minTime, props.unit);
  const cursorLabelW = estimateAxisLabelWidth(cursorLabel, CURSOR_LABEL_MIN_WIDTH_PX);
  const dtLabelW = measureLabelWidth.value || estimateAxisLabelWidth(axis.label);
  const dtPlacement =
    layout.mode === 'inline'
      ? ({ mode: 'inline' } as const)
      : ({ mode: layout.mode, side: layout.side } as const);
  return cursorLabelOverlapsMeasureChrome({
    axisW,
    cursorXRatio: cursor.xRatio,
    cursorLabelW,
    measureLeftPct: axis.left,
    measureRightPct: axis.right,
    dtLabelW,
    dtPlacement,
  });
});

watch(
  () => [measureAxis.value?.label, measureArrowLayout.value?.mode] as const,
  async () => {
    await nextTick();
    const el = measureLabelRef.value;
    measureLabelWidth.value = el ? el.offsetWidth : 0;
  },
  { flush: 'post' },
);

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

/** Measure drag on the viewport time axis (same interaction as swimlane measure). */
let measureAnchorTime: number | null = null;
let measureGestureActive = false;
let resizeEdge: MeasureResizeEdge | null = null;
let resizeFixedOther = 0;
let unbindResizeDrag: (() => void) | null = null;
let unbindCreateDrag: (() => void) | null = null;

function timeAtAxisX(clientX: number): number {
  const el = timeAxisRef.value;
  if (!el) return props.view.startTime;
  const rect = el.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
  const span = Math.max(1, props.view.endTime - props.view.startTime);
  return props.view.startTime + ratio * span;
}

function xRatioAtViewTime(time: number): number {
  const span = Math.max(1, props.view.endTime - props.view.startTime);
  return Math.min(1, Math.max(0, (time - props.view.startTime) / span));
}

function pointerTimeAtClient(clientX: number, clientY: number): { time: number; xRatio: number } {
  const mag = swimlaneRef.value?.magnetizeAtClient?.(clientX, clientY);
  if (mag?.eventId) return { time: mag.time, xRatio: xRatioAtViewTime(mag.time) };
  const el = timeAxisRef.value;
  if (!el) return { time: timeAtAxisX(clientX), xRatio: 0 };
  const rect = el.getBoundingClientRect();
  const xRatio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
  return { time: timeAtAxisX(clientX), xRatio };
}

function emitCursorAtAxisX(clientX: number) {
  const el = timeAxisRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const xRatio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
  emit('cursor', {
    time: timeAtAxisX(clientX),
    xRatio,
  });
}

function endMeasureResize() {
  unbindResizeDrag?.();
  unbindResizeDrag = null;
  resizeEdge = null;
  swimlaneRef.value?.clearEdgeSnapHighlight?.();
}

function endMeasureCreate() {
  unbindCreateDrag?.();
  unbindCreateDrag = null;
  measureGestureActive = false;
  measureAnchorTime = null;
  swimlaneRef.value?.clearEdgeSnapHighlight?.();
}

function emitResizedRange(clientX: number, clientY: number) {
  if (!resizeEdge) return;
  const axisW = timeAxisWidth.value || timeAxisRef.value?.clientWidth || 1;
  const { time } = pointerTimeAtClient(clientX, clientY);
  const next = resizeMeasureEdge({
    edge: resizeEdge,
    time,
    fixedOther: resizeFixedOther,
    viewStart: props.view.startTime,
    viewEnd: props.view.endTime,
    minSpan: measureResizeMinSpan(props.view.startTime, props.view.endTime, axisW),
  });
  emit('update:measure-range', next);
  const edgeTime = resizeEdge === 'left' ? next.startTime : next.endTime;
  const span = Math.max(1, props.view.endTime - props.view.startTime);
  const xRatio = (edgeTime - props.view.startTime) / span;
  emit('cursor', {
    time: edgeTime,
    xRatio: Math.min(1, Math.max(0, xRatio)),
  });
}

/** Stick axis cursor timestamp to a measure bar while the hit pad owns the pointer. */
function emitCursorAtAxisEdge(edge: MeasureResizeEdge) {
  const axis = measureAxis.value;
  const range = props.view.measureRange;
  if (!axis || !range) return;
  const start = Math.min(range.startTime, range.endTime);
  const end = Math.max(range.startTime, range.endTime);
  emit('cursor', {
    time: edge === 'left'
      ? Math.max(props.view.startTime, start)
      : Math.min(props.view.endTime, end),
    xRatio: (edge === 'left' ? axis.left : axis.right) / 100,
  });
}

function isMeasureAxisBarEl(t: EventTarget | null): boolean {
  return !!(t as HTMLElement | null)?.closest?.('.pr-measure-axis-bar');
}

/** Click Δt pill → parent animates viewport to center the measure range. */
function onMeasureLabelActivate(e?: Event) {
  e?.stopPropagation();
  e?.preventDefault();
  if (!props.view.measureRange) return;
  emit('focus-measure');
}

function onMeasureLabelPointerDown(e: PointerEvent) {
  // Keep axis create-drag from starting when pressing the pill.
  e.stopPropagation();
}

function onMeasureBarPointerDown(e: PointerEvent, edge: MeasureResizeEdge) {
  if (e.button !== 0 || !props.view.measureMode) return;
  // Offscreen cue bars are not resizable (true edge is outside the view).
  if (measureAxis.value?.placement !== 'visible') return;
  const range = props.view.measureRange;
  if (!range) return;
  const start = Math.min(range.startTime, range.endTime);
  const end = Math.max(range.startTime, range.endTime);
  endMeasureCreate();
  endMeasureResize();
  resizeEdge = edge;
  resizeFixedOther = edge === 'left' ? end : start;
  emitCursorAtAxisEdge(edge);
  unbindResizeDrag = bindWindowPointerDrag({
    onMove: emitResizedRange,
    onEnd: endMeasureResize,
  });
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  e.stopPropagation();
  e.preventDefault();
}

function onMeasureBarPointerEnter(_e: PointerEvent, edge: MeasureResizeEdge) {
  axisHovering.value = true;
  emitCursorAtAxisEdge(edge);
}

function onMeasureBarPointerLeave(e: PointerEvent) {
  if (resizeEdge || measureGestureActive) return;
  if (isMeasureAxisBarEl(e.relatedTarget)) return;
  // Still on the time axis — keep a lifted cursor at the pointer.
  const related = e.relatedTarget as Node | null;
  if (related && timeAxisRef.value?.contains(related)) {
    emitCursorAtAxisX(e.clientX);
    return;
  }
  axisHovering.value = false;
  emit('cursor', null);
}

function onAxisPointerEnter(e: PointerEvent) {
  axisHovering.value = true;
  if (resizeEdge || measureGestureActive) return;
  if (isMeasureAxisBarEl(e.target)) return;
  emitCursorAtAxisX(e.clientX);
}

function onAxisPointerLeave(e: PointerEvent) {
  if (isMeasureAxisBarEl(e.relatedTarget)) return;
  axisHovering.value = false;
  if (resizeEdge || measureGestureActive) return;
  emit('cursor', null);
}

function onAxisPointerDown(e: PointerEvent) {
  if (e.button !== 0 || !props.view.measureMode) return;
  if (resizeEdge) return;
  if ((e.target as HTMLElement | null)?.closest?.('.pr-measure-axis-bar')) return;
  endMeasureCreate();
  endMeasureResize();
  measureGestureActive = true;
  measureAnchorTime = timeAtAxisX(e.clientX);
  axisHovering.value = true;
  emitCursorAtAxisX(e.clientX);
  emit('update:measure-range', normalizeMeasureRange(measureAnchorTime, measureAnchorTime));
  unbindCreateDrag = bindWindowPointerDrag({
    onMove: (clientX, clientY) => {
      if (!measureGestureActive || measureAnchorTime == null) return;
      const { time, xRatio } = pointerTimeAtClient(clientX, clientY);
      emit('update:measure-range', normalizeMeasureRange(measureAnchorTime, time));
      emit('cursor', { time, xRatio });
    },
    onEnd: endMeasureCreate,
  });
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  e.preventDefault();
}

function onAxisPointerMove(e: PointerEvent) {
  // Create/resize measure drags are driven by window listeners (survive release over Card strips).
  if (resizeEdge || measureGestureActive) return;
  if (isMeasureAxisBarEl(e.target)) return;
  axisHovering.value = true;
  emitCursorAtAxisX(e.clientX);
}

function onAxisPointerUp() {
  endMeasureCreate();
  endMeasureResize();
}

watch(
  () => props.view.measureMode,
  (mode) => {
    if (!mode) onAxisPointerUp();
  },
);

onBeforeUnmount(() => {
  endMeasureCreate();
  endMeasureResize();
});

defineExpose({
  get gutterRoot() {
    return swimlaneRef.value?.gutterRoot ?? null;
  },
});
</script>

<template>
  <div
    class="pr-main-swim"
    data-testid="timeline-view"
    :style="{ '--pr-gutter-width': `${localGutterWidth}px` }"
  >
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
        @pointerenter="onAxisPointerEnter"
        @pointerleave="onAxisPointerLeave"
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
          :label="formatDisplayTime(cursor.time, bounds.minTime, unit)"
          :label-above="cursorLabelAbove"
        />
        <template v-if="measureAxis">
          <div
            v-if="measureAxis.showLeft"
            class="pr-measure-axis-bar pr-measure-axis-bar--left"
            data-testid="measure-axis-bar-left"
            :style="{ left: `${measureAxis.left}%` }"
            @pointerdown="onMeasureBarPointerDown($event, 'left')"
            @pointerenter="onMeasureBarPointerEnter($event, 'left')"
            @pointerleave="onMeasureBarPointerLeave"
          />
          <div
            v-if="measureAxis.showRight"
            class="pr-measure-axis-bar pr-measure-axis-bar--right"
            data-testid="measure-axis-bar-right"
            :style="{ left: `${measureAxis.right}%` }"
            @pointerdown="onMeasureBarPointerDown($event, 'right')"
            @pointerenter="onMeasureBarPointerEnter($event, 'right')"
            @pointerleave="onMeasureBarPointerLeave"
          />
          <div
            v-if="measureArrowLayout"
            class="pr-measure-arrow"
            data-testid="measure-arrow"
            :class="{
              'pr-measure-arrow--outside':
                measureArrowLayout.mode === 'outside' || measureArrowLayout.mode === 'shaft',
              'pr-measure-arrow--shaft': measureArrowLayout.mode === 'shaft',
              'pr-measure-arrow--outside-right':
                (measureArrowLayout.mode === 'outside' || measureArrowLayout.mode === 'shaft') &&
                measureArrowLayout.side === 'right',
              'pr-measure-arrow--outside-left':
                (measureArrowLayout.mode === 'outside' || measureArrowLayout.mode === 'shaft') &&
                measureArrowLayout.side === 'left',
              'pr-measure-arrow--offscreen': measureArrowLayout.mode === 'offscreen',
              'pr-measure-arrow--offscreen-left':
                measureArrowLayout.mode === 'offscreen' && measureArrowLayout.side === 'left',
              'pr-measure-arrow--offscreen-right':
                measureArrowLayout.mode === 'offscreen' && measureArrowLayout.side === 'right',
              'pr-measure-arrow--no-left-head': !measureAxis.showLeft,
              'pr-measure-arrow--no-right-head': !measureAxis.showRight,
            }"
            :style="measureArrowLayout.style"
          >
            <!--
              Flex: tip pad 1px | head | shaft | 4px | label | 4px | shaft | head
              Shaft negative margin pulls into chevron so the line meets the arms.
              Outside: label parked outside; arrow spans the bars (or no connector when too narrow).
              Offscreen: one head pointing off-view + Δt just inside the near edge (no edge bar).
            -->
            <svg
              v-if="measureAxis.showLeft || measureAxis.placement === 'offscreen-left'"
              class="pr-measure-arrow__head"
              data-testid="measure-arrow-head"
              :viewBox="`0 0 ${MEASURE_ARROW_HEAD_PX} 10`"
              :width="MEASURE_ARROW_HEAD_PX"
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
            <div
              v-if="measureArrowLayout.mode !== 'offscreen'"
              class="pr-measure-arrow__shaft pr-measure-arrow__shaft--left"
              data-testid="measure-arrow-shaft"
            />
            <span
              ref="measureLabelRef"
              class="pr-measure-arrow__label"
              data-testid="measure-label"
              role="button"
              tabindex="0"
              title="Focus measure range"
              @pointerdown="onMeasureLabelPointerDown"
              @click="onMeasureLabelActivate"
              @keydown.enter.prevent="onMeasureLabelActivate"
              @keydown.space.prevent="onMeasureLabelActivate"
            >{{ measureAxis.label }}</span>
            <div
              v-if="measureArrowLayout.mode !== 'offscreen'"
              class="pr-measure-arrow__shaft pr-measure-arrow__shaft--right"
              data-testid="measure-arrow-shaft"
            />
            <svg
              v-if="measureAxis.showRight || measureAxis.placement === 'offscreen-right'"
              class="pr-measure-arrow__head"
              data-testid="measure-arrow-head"
              :viewBox="`0 0 ${MEASURE_ARROW_HEAD_PX} 10`"
              :width="MEASURE_ARROW_HEAD_PX"
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
      :font-family="fontFamily"
      :gutter-width="localGutterWidth"
      :cursor-x-ratio="cursor?.xRatio ?? null"
      @update:scroll-y="emit('update:scrollY', $event)"
      @update:gutter-width="onGutterWidth"
      @toggle-group="emit('toggle-group', $event)"
      @select="emit('select', $event)"
      @hover="(ev, x, y) => emit('hover', ev, x, y)"
      @cursor="emit('cursor', $event)"
      @set-playhead="emit('set-playhead', $event)"
      @pan="emit('pan', $event)"
      @zoom="(f, a) => emit('zoom', f, a)"
      @update:measure-range="emit('update:measure-range', $event)"
      @suppress-measure-dt="suppressMeasureDt = $event"
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

.pr-swim-row.pr-swim-row--head,
.pr-swim-row.pr-swim-row--overview {
  flex: 0 0 auto;
  /* Above aside resize (z-index 6) so edge handles / cursor pill win at the seam. */
  position: relative;
  z-index: 7;
  overflow: visible;
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
  /* Visible so raised cursor / outside Δt pills are not clipped; AxisRuler clips itself. */
  overflow: visible;
}

.pr-time-axis--measure {
  cursor: col-resize;
  touch-action: none;
}

/* Measure range edge handles on the viewport time axis (v930/task-measure-mode). */
.pr-measure-axis-bar {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 9px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: col-resize;
  pointer-events: auto;
  touch-action: none;
  z-index: 5;
  transform: translateX(-50%);
}

.pr-measure-axis-bar::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: var(--pr-playhead, #3078f0);
}

.pr-measure-arrow {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 1px;
  pointer-events: none;
  z-index: 4;
  color: rgba(49, 122, 247, 1);
}

.pr-measure-arrow__shaft {
  flex: 1 1 0;
  min-width: 0;
  height: 1.5px;
  background: currentColor;
  position: relative;
  z-index: 0;
}

.pr-measure-arrow__shaft--left {
  /* Pull into left chevron toward tip; 4px clear before label. */
  margin-left: -6px;
  margin-right: 4px;
}

.pr-measure-arrow__shaft--right {
  margin-left: 4px;
  margin-right: -6px;
}

.pr-measure-arrow__head {
  flex: 0 0 auto;
  display: block;
  overflow: visible;
  position: relative;
  z-index: 1;
}

.pr-measure-arrow__label {
  flex: 0 0 auto;
  padding: 1px 8px;
  border-radius: 3px;
  background: rgba(49, 122, 247, 1);
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  position: relative;
  z-index: 2;
  pointer-events: auto;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.pr-measure-arrow__label:hover,
.pr-measure-arrow__label:focus-visible {
  background: rgba(77, 148, 255, 1);
  outline: none;
}

/* Label outside the range; arrow still spans the bars. */
.pr-measure-arrow--outside {
  overflow: visible;
}

.pr-measure-arrow--outside .pr-measure-arrow__shaft--left {
  margin-right: 0;
}

.pr-measure-arrow--outside .pr-measure-arrow__shaft--right {
  margin-left: 0;
}

.pr-measure-arrow--outside .pr-measure-arrow__label {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

.pr-measure-arrow--outside-right .pr-measure-arrow__label {
  left: 100%;
  margin-left: 4px;
}

.pr-measure-arrow--outside-left .pr-measure-arrow__label {
  right: 100%;
  margin-right: 4px;
  transform: translateY(-50%);
}

/* Too narrow for heads: hide chevrons and shaft; outside Δt label only. */
.pr-measure-arrow--shaft .pr-measure-arrow__head,
.pr-measure-arrow--shaft .pr-measure-arrow__shaft {
  display: none;
}

/* Clipped true edge: no arrowhead; shaft meets the view edge cleanly. */
.pr-measure-arrow--no-left-head .pr-measure-arrow__shaft--left {
  margin-left: 0;
}

.pr-measure-arrow--no-right-head .pr-measure-arrow__shaft--right {
  margin-right: 0;
}

/* Fully off-screen: one chevron + Δt parked just inside the near view edge. */
.pr-measure-arrow--offscreen {
  overflow: visible;
  width: auto;
  padding: 0 1px;
}

.pr-measure-arrow--offscreen-left .pr-measure-arrow__label {
  margin-left: 4px;
}

.pr-measure-arrow--offscreen-right {
  transform: translateX(-100%);
}

.pr-measure-arrow--offscreen-right .pr-measure-arrow__label {
  margin-right: 4px;
}

.pr-gutter--axis-spacer {
  border-bottom: 1px solid #3a3a3a;
  background: #1f1f1f;
  border-right: 1px solid #3a3a3a;
}

.pr-swim-row.pr-swim-row--overview .pr-gutter--axis-spacer {
  border-bottom: none;
}

.pr-overview-charts {
  flex: 0 0 auto;
  padding: 8px 12px;
  color: #888;
}
</style>
