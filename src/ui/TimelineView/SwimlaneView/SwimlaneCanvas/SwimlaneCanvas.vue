<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  DEFAULT_DEPENDENCY_DEPTH,
  type DependencyMode,
  type MeasureRange,
  type SwimEvent,
  type SwimlaneModel,
  type SwimlaneViewWindow,
  type TimeDisplayUnit,
} from '../../../../domain/types';
import { normalizeMeasureRange } from '../../../../domain/viewState';
import { WebGlSwimlaneRenderer } from '../../../../swimlane/WebGlSwimlaneRenderer';
import { contentHeightFromModel } from '../../../../swimlane/layout';
import { CanvasSwimlaneRenderer, SwimlaneOverlayPainter } from '../../../../swimlane/CanvasSwimlaneRenderer';

const props = withDefaults(
  defineProps<{
    model: SwimlaneModel | null;
    view: SwimlaneViewWindow;
    selectedEventId: string | null;
    hoveredEventId: string | null;
    searchQuery: string;
    measureMode?: boolean;
    measureRange?: MeasureRange | null;
    timeUnit?: TimeDisplayUnit;
    dependencyMode?: DependencyMode;
    dependencyDepth?: number;
    /** Force backend for perf A/B. Default auto prefers WebGL2 when available. */
    preferRenderer?: 'auto' | 'webgl' | 'canvas';
  }>(),
  {
    dependencyMode: 'all',
    dependencyDepth: DEFAULT_DEPENDENCY_DEPTH,
  },
);

const emit = defineEmits<{
  select: [event: SwimEvent | null];
  hover: [event: SwimEvent | null, clientX: number, clientY: number];
  cursor: [payload: { time: number; xRatio: number } | null];
  pan: [deltaTime: number];
  zoom: [factor: number, anchorTime: number];
  'scroll-y': [scrollY: number];
  'set-playhead': [time: number];
  'update:measureRange': [range: MeasureRange | null];
}>();

const wrapRef = ref<HTMLDivElement | null>(null);
const glCanvasRef = ref<HTMLCanvasElement | null>(null);
const overlayCanvasRef = ref<HTMLCanvasElement | null>(null);
const fallbackCanvasRef = ref<HTMLCanvasElement | null>(null);
const sizerHeight = ref(120);
const useWebGl = ref(false);

type Backend = CanvasSwimlaneRenderer | WebGlSwimlaneRenderer;

let backend: Backend = new CanvasSwimlaneRenderer();
const overlay = new SwimlaneOverlayPainter();
let attached = false;
let attachedModel: SwimlaneModel | null = null;
let dragging = false;
let lastX = 0;
let downX = 0;
let measureAnchorTime: number | null = null;
/** True from measure pointerdown until pointerup — survives external Esc/toolbar cancel. */
let measureGestureActive = false;
let lastW = 0;
let lastH = 0;
let resizeObserver: ResizeObserver | null = null;
let raf = 0;
/** Local scroll accumulator so rapid wheel events do not drop deltas waiting on props. */
let localScrollY = 0;

function modelContentHeight(): number {
  return contentHeightFromModel(props.model);
}

function maxScrollY(): number {
  const viewH = wrapRef.value?.clientHeight ?? 0;
  return Math.max(0, modelContentHeight() - viewH);
}

function clampScrollY(y: number): number {
  return Math.min(maxScrollY(), Math.max(0, y));
}

function schedulePaint(): void {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    backend.render();
    if (useWebGl.value) overlay.render();
  });
}

/** Paint in the same turn (after buffer resize) so the canvas never shows a cleared frame. */
function flushPaint(): void {
  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  backend.render();
  if (useWebGl.value) overlay.render();
}

function applyViewState(forceModel = false): void {
  if (!props.model) return;
  if (forceModel || props.model !== attachedModel) {
    backend.setModel(props.model);
    attachedModel = props.model;
  }
  backend.setView(props.view);
  backend.setDependencyMode?.(props.dependencyMode);
  backend.setDependencyDepth?.(props.dependencyDepth);
  backend.setSelection(props.selectedEventId, props.hoveredEventId);
  backend.setSearchQuery(props.searchQuery);
  if (useWebGl.value) {
    overlay.setLayout(backend.getLayout());
    overlay.setView(props.view);
    overlay.setSelection(props.selectedEventId, props.hoveredEventId);
    overlay.setNeighborIds(backend.getNeighborIds());
    overlay.setSearchQuery(props.searchQuery);
  }
}

function sync(forceModel = false): void {
  applyViewState(forceModel);
  schedulePaint();
}

function resize(): void {
  const wrap = wrapRef.value;
  if (!wrap) return;

  const contentH = modelContentHeight();
  const w = Math.max(1, wrap.clientWidth);
  const viewH = wrap.clientHeight || 0;
  // Sizer tracks full content for layout; drawing surface is the visible viewport only.
  sizerHeight.value = Math.max(contentH, viewH);
  const h = Math.max(1, viewH || lastH || contentH);

  if (!attached) {
    const prefer = props.preferRenderer ?? 'auto';
    const tryWebGl = prefer !== 'canvas';
    if (
      tryWebGl &&
      glCanvasRef.value &&
      overlayCanvasRef.value &&
      WebGlSwimlaneRenderer.isSupported(glCanvasRef.value)
    ) {
      const glBackend = new WebGlSwimlaneRenderer();
      if (glBackend.attach(glCanvasRef.value)) {
        backend = glBackend;
        overlay.attach(overlayCanvasRef.value);
        useWebGl.value = true;
        attached = true;
      }
    }
    if (!attached && prefer !== 'webgl' && fallbackCanvasRef.value) {
      backend = new CanvasSwimlaneRenderer();
      backend.attach(fallbackCanvasRef.value);
      useWebGl.value = false;
      attached = true;
    }
    // prefer=webgl but attach failed → canvas fallback
    if (!attached && fallbackCanvasRef.value) {
      backend = new CanvasSwimlaneRenderer();
      backend.attach(fallbackCanvasRef.value);
      useWebGl.value = false;
      attached = true;
    }
  }

  if (!attached) return;

  const sizeChanged = w !== lastW || h !== lastH;
  if (sizeChanged) {
    lastW = w;
    lastH = h;
    backend.resize(w, h);
    if (useWebGl.value) overlay.resize(w, h);
  }
  applyViewState();
  // Buffer resize clears pixels; paint before the browser paints this frame (no blink).
  if (sizeChanged) flushPaint();
  else schedulePaint();
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
  if (raf) cancelAnimationFrame(raf);
  backend.dispose();
  overlay.dispose();
});

watch(
  () => props.model,
  () => {
    attachedModel = null;
    resize();
  },
);

watch(
  () => [props.view, props.selectedEventId, props.hoveredEventId, props.searchQuery, props.dependencyMode, props.dependencyDepth],
  () => {
    localScrollY = props.view.scrollY;
    sync();
  },
  { deep: true },
);

function abortMeasureDrag(): void {
  measureAnchorTime = null;
  dragging = false;
}

watch(
  () => props.measureMode,
  (mode) => {
    if (!mode) abortMeasureDrag();
  },
);

watch(
  () => props.measureRange,
  (range) => {
    if (range == null) abortMeasureDrag();
  },
);

function timeAtX(x: number): number {
  const span = Math.max(1, props.view.endTime - props.view.startTime);
  const w = wrapRef.value?.clientWidth || 1;
  return props.view.startTime + (x / w) * span;
}

function xAtTime(t: number): number {
  const span = Math.max(1, props.view.endTime - props.view.startTime);
  const w = wrapRef.value?.clientWidth || 1;
  return ((t - props.view.startTime) / span) * w;
}

const measureGeometry = computed(() => {
  const range = props.measureRange;
  if (!range) return null;
  const start = Math.min(range.startTime, range.endTime);
  const end = Math.max(range.startTime, range.endTime);
  if (!(end > start)) return null;
  const left = xAtTime(start);
  const right = xAtTime(end);
  return { left, right, width: Math.max(1, right - left) };
});

function activeCanvas(): HTMLCanvasElement | null {
  return useWebGl.value ? overlayCanvasRef.value : fallbackCanvasRef.value;
}

function onPointerDown(e: PointerEvent): void {
  dragging = true;
  lastX = e.clientX;
  downX = e.clientX;
  const canvas = activeCanvas();
  if (props.measureMode && canvas) {
    const rect = canvas.getBoundingClientRect();
    measureGestureActive = true;
    measureAnchorTime = timeAtX(e.clientX - rect.left);
    emit('update:measureRange', normalizeMeasureRange(measureAnchorTime, measureAnchorTime));
  } else {
    measureGestureActive = false;
    measureAnchorTime = null;
  }
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
}

function onPointerMove(e: PointerEvent): void {
  const target = activeCanvas();
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const w = Math.max(1, rect.width);
  const time = timeAtX(x);

  schedulePaint();
  emit('cursor', { time, xRatio: x / w });

  if (dragging) {
    if (measureGestureActive) {
      if (props.measureMode && measureAnchorTime != null) {
        emit('update:measureRange', normalizeMeasureRange(measureAnchorTime, time));
      }
      emit('hover', null, e.clientX, e.clientY);
      return;
    }
    const span = Math.max(1, props.view.endTime - props.view.startTime);
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    emit('pan', -(dx / w) * span);
    emit('hover', null, e.clientX, e.clientY);
    return;
  }

  const id = backend.hitTest(x, y);
  emit('hover', id ? backend.findEvent(id) : null, e.clientX, e.clientY);
}

function onPointerUp(e: PointerEvent): void {
  const wasMeasuring = measureGestureActive;
  dragging = false;
  measureAnchorTime = null;
  measureGestureActive = false;
  const target = activeCanvas();
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  emit('set-playhead', timeAtX(x));
  if (wasMeasuring) return;
  if (Math.abs(e.clientX - downX) > 4) return;
  const id = backend.hitTest(x, y);
  emit('select', id ? backend.findEvent(id) : null);
}

function onPointerLeave(): void {
  // Keep measure drag alive under pointer capture; clear anchor only on pointerup / cancel.
  if (measureGestureActive) {
    schedulePaint();
    emit('cursor', null);
    emit('hover', null, 0, 0);
    return;
  }
  dragging = false;
  measureAnchorTime = null;
  schedulePaint();
  emit('cursor', null);
  emit('hover', null, 0, 0);
}

function onWheel(e: WheelEvent): void {
  e.preventDefault();
  const target = activeCanvas();
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  if (e.ctrlKey || e.metaKey) {
    emit('zoom', e.deltaY > 0 ? 1 / 1.15 : 1.15, timeAtX(x));
  } else {
    localScrollY = clampScrollY(localScrollY + e.deltaY);
    emit('scroll-y', localScrollY);
  }
}

defineExpose({
  eventScreenRect: (id: string) => backend.eventScreenRect(id),
  renderer: () => backend,
  useWebGl,
  /** Card strips sit above the canvas; SwimlaneView forwards wheel here. */
  handleWheel: onWheel,
});
</script>

<template>
  <div
    ref="wrapRef"
    class="pr-swim-canvas-wrap"
    data-testid="swimlane"
    :class="{ 'pr-swim-canvas-wrap--measure': measureMode }"
    :data-renderer="useWebGl ? 'webgl' : 'canvas'"
  >
    <div
      class="pr-swim-canvas-sizer"
      aria-hidden="true"
      :style="{ height: `${sizerHeight}px` }"
    />
    <canvas
      ref="glCanvasRef"
      class="pr-swim-canvas pr-swim-canvas--gl"
      data-testid="swimlane-webgl"
    />
    <canvas
      ref="overlayCanvasRef"
      class="pr-swim-canvas pr-swim-canvas--overlay"
      :data-testid="useWebGl ? 'swimlane-canvas' : 'swimlane-overlay'"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerLeave"
      @wheel="onWheel"
    />
    <canvas
      v-show="!useWebGl"
      ref="fallbackCanvasRef"
      class="pr-swim-canvas"
      :data-testid="useWebGl ? 'swimlane-fallback' : 'swimlane-canvas'"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerLeave"
      @wheel="onWheel"
    />
    <template v-if="measureMode && measureGeometry">
      <div
        class="pr-measure-fade pr-measure-fade--left"
        data-testid="measure-fade-left"
        :style="{ width: `${measureGeometry.left}px` }"
      />
      <div
        class="pr-measure-fade pr-measure-fade--right"
        data-testid="measure-fade-right"
        :style="{ left: `${measureGeometry.right}px`, right: '0' }"
      />
      <div
        class="pr-measure-border pr-measure-border--left"
        data-testid="measure-border-left"
        :style="{ left: `${measureGeometry.left}px` }"
      />
      <div
        class="pr-measure-border pr-measure-border--right"
        data-testid="measure-border-right"
        :style="{ left: `${measureGeometry.right}px` }"
      />
    </template>
  </div>
</template>

<style scoped>
.pr-swim-canvas-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 160px;
  overflow: hidden;
  background: #1f1f1f;
}

.pr-swim-canvas-wrap--measure .pr-swim-canvas {
  cursor: col-resize;
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
  z-index: 0;
}

.pr-swim-canvas--gl {
  pointer-events: none;
  z-index: 0;
}

.pr-swim-canvas--overlay {
  z-index: 2;
  background: transparent;
}

.pr-swim-canvas-wrap[data-renderer='canvas'] .pr-swim-canvas--gl,
.pr-swim-canvas-wrap[data-renderer='canvas'] .pr-swim-canvas--overlay {
  display: none;
  pointer-events: none;
}

/* Measure mode (M2): fade outside the selection + gray swimlane borders.
 * Blue bars + Δt arrow live on the time axis (TimelineView). */
.pr-measure-fade {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  pointer-events: none;
  z-index: 3;
}

.pr-measure-fade--left {
  left: 0;
}

.pr-measure-fade--right {
  right: 0;
}

.pr-measure-border {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #4c4c4c;
  pointer-events: none;
  z-index: 3;
  transform: translateX(-0.5px);
}
</style>
