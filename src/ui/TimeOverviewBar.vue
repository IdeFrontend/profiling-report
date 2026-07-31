<script setup lang="ts">
import { computed, ref } from 'vue';
import { formatAxisTime } from '../core/formatTime';
import type { TimeDisplayUnit } from '../core/types';

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
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = props.minTime + (fullSpan.value * i) / n;
    return { t, label: formatAxisTime(t, props.timeUnit), pct: (i / n) * 100 };
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
      <span
        v-for="tick in ticks"
        :key="tick.t"
        class="pr-overview__tick"
        :style="{ left: `${tick.pct}%` }"
      >{{ tick.label }}</span>

      <!-- Invisible hit target between handles for pan (no blue brush fill) -->
      <div
        class="pr-overview__span"
        data-testid="time-overview-window"
        :style="{ left: `${leftPct}%`, width: `${widthPct}%` }"
        @pointerdown="onPointerDown($event, 'move')"
      />

      <button
        type="button"
        class="pr-overview__handle"
        data-testid="time-overview-handle-left"
        aria-label="Visible range start"
        :style="{ left: `calc(${leftPct}% - 3px)` }"
        @pointerdown="onPointerDown($event, 'left')"
      />
      <button
        type="button"
        class="pr-overview__handle"
        data-testid="time-overview-handle-right"
        aria-label="Visible range end"
        :style="{ left: `calc(${rightPct}% - 3px)` }"
        @pointerdown="onPointerDown($event, 'right')"
      />
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
}

.pr-overview__span {
  position: absolute;
  top: 0;
  bottom: 0;
  background: transparent;
  cursor: grab;
  z-index: 1;
}

.pr-overview__span:active {
  cursor: grabbing;
}

.pr-overview__handle {
  position: absolute;
  top: 10px;
  bottom: 0;
  width: 6px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 1px;
  background: #e8e8e8;
  cursor: ew-resize;
  z-index: 2;
  box-shadow: 0 0 0 1px #111;
}
</style>
