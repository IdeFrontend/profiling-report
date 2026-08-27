<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  buildAxisRulerTicks,
  resolveTimeUnitFromAxisDensity,
} from '../../../domain/axisRuler';
import { t } from '../../../i18n';
import type { TimeDisplayMode } from '../../../domain/types';
import { bindWindowPointerDrag } from '../measureEdgeResize';
import AxisRuler from '../TimeAxis/AxisRuler/AxisRuler.vue';

const props = defineProps<{
  minTime: number;
  maxTime: number;
  startTime: number;
  endTime: number;
  locale?: string;
  timeDisplayMode: TimeDisplayMode;
  clockFreqMHz?: number;
}>();

const emit = defineEmits<{
  'update:window': [window: { startTime: number; endTime: number }];
}>();

const rootRef = ref<HTMLElement | null>(null);
const trackWidth = ref(0);
let resizeObserver: ResizeObserver | null = null;

type DragMode = 'move' | 'left' | 'right' | null;
let dragMode: DragMode = null;
let dragOriginX = 0;
let dragStart = 0;
let dragEnd = 0;
let unbindWindowDrag: (() => void) | null = null;

const fullSpan = computed(() => Math.max(1, props.maxTime - props.minTime));

const leftPct = computed(
  () => ((props.startTime - props.minTime) / fullSpan.value) * 100,
);
const rightPct = computed(
  () => ((props.endTime - props.minTime) / fullSpan.value) * 100,
);
const widthPct = computed(() => Math.max(0.4, rightPct.value - leftPct.value));

/** Overview unit from total span × width only — brush window must not affect it. */
const overviewTimeScaleUnit = computed(() =>
  resolveTimeUnitFromAxisDensity(fullSpan.value, trackWidth.value),
);

const ruler = computed(() =>
  buildAxisRulerTicks({
    rangeStart: props.minTime,
    rangeEnd: props.maxTime,
    origin: props.minTime,
    timeDisplayMode: props.timeDisplayMode,
    timeScaleUnit: overviewTimeScaleUnit.value,
    clockFreqMHz: props.clockFreqMHz,
    widthPx: trackWidth.value,
    muteOutside: { start: props.startTime, end: props.endTime },
  }),
);

onMounted(() => {
  const el = rootRef.value;
  if (!el) return;
  const sync = () => {
    trackWidth.value = el.clientWidth || 0;
  };
  sync();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(sync);
    resizeObserver.observe(el);
  }
});

onBeforeUnmount(() => {
  endDrag();
  resizeObserver?.disconnect();
  resizeObserver = null;
});

function clientToTime(clientX: number): number {
  const el = rootRef.value;
  if (!el) return props.minTime;
  const rect = el.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
  return props.minTime + ratio * fullSpan.value;
}

function clampWindow(start: number, end: number): { startTime: number; endTime: number } {
  const minSpan = Math.max(1, fullSpan.value / 500);
  let s = start;
  let e = end;
  if (e - s < minSpan) {
    const mid = (s + e) / 2;
    s = mid - minSpan / 2;
    e = mid + minSpan / 2;
  }
  if (s < props.minTime) {
    e += props.minTime - s;
    s = props.minTime;
  }
  if (e > props.maxTime) {
    s -= e - props.maxTime;
    e = props.maxTime;
  }
  s = Math.max(props.minTime, s);
  e = Math.min(props.maxTime, e);
  return { startTime: s, endTime: e };
}

function endDrag() {
  unbindWindowDrag?.();
  unbindWindowDrag = null;
  dragMode = null;
}

function applyDragMove(clientX: number) {
  if (!dragMode || !rootRef.value) return;
  const rect = rootRef.value.getBoundingClientRect();
  const dxRatio = (clientX - dragOriginX) / Math.max(1, rect.width);
  const dt = dxRatio * fullSpan.value;
  if (dragMode === 'move') {
    emit('update:window', clampWindow(dragStart + dt, dragEnd + dt));
  } else if (dragMode === 'left') {
    emit('update:window', clampWindow(dragStart + dt, dragEnd));
  } else if (dragMode === 'right') {
    emit('update:window', clampWindow(dragStart, dragEnd + dt));
  }
}

function onPointerDown(e: PointerEvent, mode: DragMode) {
  if (!mode || e.button !== 0) return;
  endDrag();
  dragMode = mode;
  dragOriginX = e.clientX;
  dragStart = props.startTime;
  dragEnd = props.endTime;
  unbindWindowDrag = bindWindowPointerDrag({
    onMove: applyDragMove,
    onEnd: endDrag,
  });
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  e.preventDefault();
  e.stopPropagation();
}

/** Click empty overview track → center window; drag between handles pans. */
function onTrackPointerDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('.pr-overview__handle, .pr-overview__span')) return;
  const span = props.endTime - props.startTime;
  const center = clientToTime(e.clientX);
  emit('update:window', clampWindow(center - span / 2, center + span / 2));
}
</script>

<template>
  <div
    class="pr-overview"
    data-testid="time-overview"
  >
    <div
      ref="rootRef"
      class="pr-overview__track"
      data-testid="time-overview-track"
      @pointerdown="onTrackPointerDown"
    >
      <!-- Dim outside selected window -->
      <div
        class="pr-overview__dim pr-overview__dim--left"
        :style="{ width: `${leftPct}%` }"
      />
      <div
        class="pr-overview__dim pr-overview__dim--right"
        :style="{ left: `${rightPct}%`, width: `${Math.max(0, 100 - rightPct)}%` }"
      />

      <AxisRuler
        :majors="ruler.majors"
        :minors="ruler.minors"
      />

      <div
        class="pr-overview__span"
        data-testid="time-overview-window"
        :style="{ left: `${leftPct}%`, width: `${widthPct}%` }"
        @pointerdown="onPointerDown($event, 'move')"
      />

      <!-- Flag handles: 1px stem + outward top tab (TimeOverviewBar.spec) -->
      <button
        type="button"
        class="pr-overview__handle pr-overview__handle--left"
        data-testid="time-overview-handle-left"
        :aria-label="t('visibleRangeStart', locale)"
        :style="{ left: `${leftPct}%` }"
        @pointerdown="onPointerDown($event, 'left')"
      >
        <span
          class="pr-overview__handle-tab"
          aria-hidden="true"
        />
        <span
          class="pr-overview__handle-stem"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        class="pr-overview__handle pr-overview__handle--right"
        data-testid="time-overview-handle-right"
        :aria-label="t('visibleRangeEnd', locale)"
        :style="{ left: `${rightPct}%` }"
        @pointerdown="onPointerDown($event, 'right')"
      >
        <span
          class="pr-overview__handle-tab"
          aria-hidden="true"
        />
        <span
          class="pr-overview__handle-stem"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.pr-overview {
  flex: 0 0 auto;
  padding: 0;
  background: transparent;
  user-select: none;
  overflow: visible;
}

.pr-overview__track {
  position: relative;
  height: 20px;
  background: var(--pr-bg-panel, #262626);
  border-bottom: 1px solid #4a4a4a;
  /* Clicking the track re-centers the window (onTrackPointerDown). */
  cursor: pointer;
  /* Visible so edge handles are not cropped L/R (also unclips Y; tabs stay in-track). AxisRuler clips tick text vs aside. */
  overflow: visible;
}

/* Opaque, not a black wash: the muted band is a named design value and the
   panes sit under the ruler, so ticks keep their normal color on top. */
.pr-overview__dim {
  position: absolute;
  top: 0;
  bottom: 0;
  background: var(--pr-axis-band-muted, #1b1b1b);
  pointer-events: none;
  z-index: 0;
}

.pr-overview__dim--left {
  left: 0;
}

.pr-overview__span {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.06);
  cursor: grab;
  z-index: 2;
}

.pr-overview__span:active {
  cursor: grabbing;
}

/*
 * Range handle: vertical white pill head + 1px stem.
 * Track is 20px; head is exactly 4×10 flush in the top strip (TimeOverviewBar.spec).
 */
.pr-overview__handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: ew-resize;
  z-index: 3;
  transform: translateX(-50%);
}

.pr-overview__handle-stem {
  position: absolute;
  top: 10px;
  bottom: 0;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
  background: #ffffff;
  pointer-events: none;
}

.pr-overview__handle-tab {
  position: absolute;
  top: 0;
  left: 50%;
  width: 4px;
  height: 10px;
  transform: translateX(-50%);
  background: #ffffff;
  border-radius: 2px;
  pointer-events: none;
}
</style>
