<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { CanvasSwimlaneRenderer, LANE_GROUP_HEADER_HEIGHT, LANE_HEIGHT } from '../swimlane/CanvasSwimlaneRenderer';
import type { SwimEvent, SwimlaneModel, SwimlaneViewWindow } from '../core/types';

const props = defineProps<{
  model: SwimlaneModel | null;
  view: SwimlaneViewWindow;
  selectedEventId: string | null;
  hoveredEventId: string | null;
  searchQuery: string;
  lanes: { id: string; name: string }[];
}>();

const emit = defineEmits<{
  select: [event: SwimEvent | null];
  hover: [event: SwimEvent | null, clientX: number, clientY: number];
  cursor: [payload: { time: number; xRatio: number } | null];
  pan: [deltaTime: number];
  zoom: [factor: number, anchorTime: number];
  'scroll-y': [scrollY: number];
  'set-playhead': [time: number];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const wrapRef = ref<HTMLDivElement | null>(null);
/** Drives scroll height without letting canvas `style.height` feed flex layout. */
const sizerHeight = ref(120);
const renderer = new CanvasSwimlaneRenderer();
let attached = false;
let attachedModel: SwimlaneModel | null = null;
let dragging = false;
let lastX = 0;
let downX = 0;
let lastW = 0;
let lastH = 0;
let resizeObserver: ResizeObserver | null = null;
/** Local scroll accumulator so rapid wheel events do not drop deltas waiting on props. */
let localScrollY = 0;

function contentHeight(): number {
  return Math.max(120, LANE_GROUP_HEADER_HEIGHT + (props.lanes.length || 1) * LANE_HEIGHT);
}

function maxScrollY(): number {
  const viewH = wrapRef.value?.clientHeight ?? 0;
  return Math.max(0, contentHeight() - viewH);
}

function clampScrollY(y: number): number {
  return Math.min(maxScrollY(), Math.max(0, y));
}

function sync(): void {
  if (!props.model) return;
  if (props.model !== attachedModel) {
    renderer.setModel(props.model);
    attachedModel = props.model;
  }
  renderer.setView(props.view);
  renderer.setSelection(props.selectedEventId, props.hoveredEventId);
  renderer.setSearchQuery(props.searchQuery);
  renderer.render();
}

function resize(): void {
  const wrap = wrapRef.value;
  const canvas = canvasRef.value;
  if (!wrap || !canvas) return;
  if (!attached) {
    renderer.attach(canvas);
    attached = true;
  }
  const contentH = contentHeight();
  const w = Math.max(1, wrap.clientWidth);
  const viewH = wrap.clientHeight || 0;
  const h = Math.max(contentH, viewH);
  sizerHeight.value = h;
  if (w !== lastW || h !== lastH) {
    lastW = w;
    lastH = h;
    renderer.resize(w, h);
  }
  sync();
  const maxY = maxScrollY();
  if (localScrollY > maxY) {
    localScrollY = maxY;
    emit('scroll-y', localScrollY);
  }
}

onMounted(() => {
  resize();
  if (wrapRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(wrapRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  renderer.dispose();
});

watch(
  () => props.model,
  () => {
    attachedModel = null;
    resize();
  },
);

watch(
  () => props.lanes.length,
  () => {
    resize();
  },
);

watch(
  () => [props.view, props.selectedEventId, props.hoveredEventId, props.searchQuery],
  () => {
    localScrollY = props.view.scrollY;
    sync();
  },
  { deep: true },
);

function timeAtX(x: number): number {
  const span = Math.max(1, props.view.endTime - props.view.startTime);
  const w = wrapRef.value?.clientWidth || 1;
  return props.view.startTime + (x / w) * span;
}

function onPointerDown(e: PointerEvent): void {
  dragging = true;
  lastX = e.clientX;
  downX = e.clientX;
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
}

function onPointerMove(e: PointerEvent): void {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const w = Math.max(1, rect.width);
  const time = timeAtX(x);

  renderer.setCursorX(x);
  renderer.render();
  emit('cursor', { time, xRatio: x / w });

  if (dragging) {
    const span = Math.max(1, props.view.endTime - props.view.startTime);
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    const deltaTime = -(dx / w) * span;
    emit('pan', deltaTime);
    emit('hover', null, e.clientX, e.clientY);
    return;
  }

  const id = renderer.hitTest(x, y);
  const ev = id ? renderer.findEvent(id) : null;
  emit('hover', ev, e.clientX, e.clientY);
}

function onPointerUp(e: PointerEvent): void {
  dragging = false;
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const time = timeAtX(x);
  emit('set-playhead', time);
  if (Math.abs(e.clientX - downX) > 4) return;
  const id = renderer.hitTest(x, y);
  emit('select', id ? renderer.findEvent(id) : null);
}

function onPointerLeave(): void {
  dragging = false;
  renderer.setCursorX(null);
  renderer.render();
  emit('cursor', null);
  emit('hover', null, 0, 0);
}

function onWheel(e: WheelEvent): void {
  e.preventDefault();
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  if (e.ctrlKey || e.metaKey) {
    const factor = e.deltaY > 0 ? 1 / 1.15 : 1.15;
    emit('zoom', factor, timeAtX(x));
  } else {
    localScrollY = clampScrollY(localScrollY + e.deltaY);
    emit('scroll-y', localScrollY);
  }
}

defineExpose({ eventScreenRect: (id: string) => renderer.eventScreenRect(id), renderer });
</script>

<template>
  <div
    ref="wrapRef"
    class="pr-swim-canvas-wrap"
    data-testid="swimlane"
  >
    <div
      class="pr-swim-canvas-sizer"
      aria-hidden="true"
      :style="{ height: `${sizerHeight}px` }"
    />
    <canvas
      ref="canvasRef"
      class="pr-swim-canvas"
      data-testid="swimlane-canvas"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerLeave"
      @wheel="onWheel"
    />
  </div>
</template>

<style scoped>
.pr-swim-canvas-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 160px;
  overflow: hidden;
  background: #1a1a1a;
}

.pr-swim-canvas-sizer {
  width: 100%;
  pointer-events: none;
}

.pr-swim-canvas {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  cursor: crosshair;
  touch-action: none;
}
</style>
