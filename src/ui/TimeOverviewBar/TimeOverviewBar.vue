<script setup lang="ts">
import { computed, ref } from 'vue';
import { formatAxisTime } from '../../domain/formatTime';
import type { TimeDisplayUnit } from '../../domain/types';

const props = defineProps<{
  minTime: number;
  maxTime: number;
  startTime: number;
  endTime: number;
  timeUnit: TimeDisplayUnit;
}>();

const emit = defineEmits<{
  'update:window': [window: { startTime: number; endTime: number }];
}>();

const rootRef = ref<HTMLElement | null>(null);
type DragMode = 'move' | 'left' | 'right' | null;
let dragMode: DragMode = null;
let dragOriginX = 0;
let dragStart = 0;
let dragEnd = 0;

const fullSpan = computed(() => Math.max(1, props.maxTime - props.minTime));

const leftPct = computed(
  () => ((props.startTime - props.minTime) / fullSpan.value) * 100,
);
const rightPct = computed(
  () => ((props.endTime - props.minTime) / fullSpan.value) * 100,
);
const widthPct = computed(() => Math.max(0.4, rightPct.value - leftPct.value));

const ticks = computed(() => {
  const n = 9;
  const step = fullSpan.value / n;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = props.minTime + step * i;
    const outside = t < props.startTime - 1e-9 || t > props.endTime + 1e-9;
    return {
      t,
      label: formatAxisTime(t, props.timeUnit, step),
      pct: (i / n) * 100,
      outside,
    };
  });
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

function onPointerDown(e: PointerEvent, mode: DragMode) {
  if (!mode) return;
  dragMode = mode;
  dragOriginX = e.clientX;
  dragStart = props.startTime;
  dragEnd = props.endTime;
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

function onPointerMove(e: PointerEvent) {
  if (!dragMode || !rootRef.value) return;
  const rect = rootRef.value.getBoundingClientRect();
  const dxRatio = (e.clientX - dragOriginX) / Math.max(1, rect.width);
  const dt = dxRatio * fullSpan.value;
  if (dragMode === 'move') {
    emit('update:window', clampWindow(dragStart + dt, dragEnd + dt));
  } else if (dragMode === 'left') {
    emit('update:window', clampWindow(dragStart + dt, dragEnd));
  } else if (dragMode === 'right') {
    emit('update:window', clampWindow(dragStart, dragEnd + dt));
  }
}

function onPointerUp() {
  dragMode = null;
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
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
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

      <span
        v-for="tick in ticks"
        :key="tick.t"
        class="pr-overview__tick"
        :class="{ 'pr-overview__tick--muted': tick.outside }"
        :style="{ left: `${tick.pct}%` }"
      >{{ tick.label }}</span>

      <div
        class="pr-overview__span"
        data-testid="time-overview-window"
        :style="{ left: `${leftPct}%`, width: `${widthPct}%` }"
        @pointerdown="onPointerDown($event, 'move')"
      />

      <!-- Flag handles: 1px stem + outward top tab (VISUAL_SPEC) -->
      <button
        type="button"
        class="pr-overview__handle pr-overview__handle--left"
        data-testid="time-overview-handle-left"
        aria-label="Visible range start"
        :style="{ left: `${leftPct}%` }"
        @pointerdown="onPointerDown($event, 'left')"
      >
        <span class="pr-overview__handle-tab" aria-hidden="true" />
        <span class="pr-overview__handle-stem" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="pr-overview__handle pr-overview__handle--right"
        data-testid="time-overview-handle-right"
        aria-label="Visible range end"
        :style="{ left: `${rightPct}%` }"
        @pointerdown="onPointerDown($event, 'right')"
      >
        <span class="pr-overview__handle-tab" aria-hidden="true" />
        <span class="pr-overview__handle-stem" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.pr-overview {
  flex: 0 0 auto;
  padding: 2px 0 0;
  background: transparent;
  user-select: none;
}

.pr-overview__track {
  position: relative;
  height: 28px;
  border-bottom: 1px solid #4a4a4a;
  cursor: default;
  overflow: visible;
}

.pr-overview__dim {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.35);
  pointer-events: none;
  z-index: 0;
}

.pr-overview__dim--left {
  left: 0;
}

.pr-overview__tick {
  position: absolute;
  top: 2px;
  transform: translateX(-50%);
  font-size: 10px;
  color: #c8c8c8;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1;
}

.pr-overview__tick--muted {
  color: #666;
}

.pr-overview__span {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.06);
  cursor: grab;
  z-index: 1;
}

.pr-overview__span:active {
  cursor: grabbing;
}

/*
 * Flag handle: thin white stem + outward top tab.
 * Hit area is wider than the stem for usability.
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
  top: 6px;
  bottom: 0;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
  background: #ffffff;
  pointer-events: none;
}

.pr-overview__handle-tab {
  position: absolute;
  top: 1px;
  width: 10px;
  height: 6px;
  background: #ffffff;
  border-radius: 1px;
  pointer-events: none;
}

.pr-overview__handle--left .pr-overview__handle-tab {
  right: 50%;
  margin-right: -0.5px;
}

.pr-overview__handle--right .pr-overview__handle-tab {
  left: 50%;
  margin-left: -0.5px;
}
</style>
