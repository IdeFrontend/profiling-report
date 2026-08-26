<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
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
import {
  canvasLabelFont,
  HARMONYOS_CANVAS_LABEL_FONT,
  type ReportFontFamily,
} from '../../../../ui/fontStack';
import { WebGlSwimlaneRenderer } from '../../../../swimlane/WebGlSwimlaneRenderer';
import { contentHeightFromModel, findExactEdgeMatches, LANE_HEIGHT, nearestEventEdgeAtPoint, projectExactEdgeMarks, type ExactEdgeMatch } from '../../../../swimlane/layout';
import { CanvasSwimlaneRenderer, SwimlaneOverlayPainter } from '../../../../swimlane/CanvasSwimlaneRenderer';
import {
  bindWindowPointerDrag,
  measureResizeMinSpan,
  resizeMeasureEdge,
  type MeasureResizeEdge,
} from '../../measureEdgeResize';
import { animateViewWindow, prefersReducedMotion } from '../../animateViewWindow';

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
    fontFamily?: ReportFontFamily;
  }>(),
  {
    dependencyMode: 'all',
    dependencyDepth: DEFAULT_DEPENDENCY_DEPTH,
    fontFamily: 'system',
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
  /** Hide axis Δt arrow/label during appear/clear (view↔range) tweens only. */
  'suppress-measure-dt': [suppress: boolean];
}>();

const wrapRef = ref<HTMLDivElement | null>(null);
const glCanvasRef = ref<HTMLCanvasElement | null>(null);
const overlayCanvasRef = ref<HTMLCanvasElement | null>(null);
const fallbackCanvasRef = ref<HTMLCanvasElement | null>(null);
const sizerHeight = ref(120);
const useWebGl = ref(false);
/** Bumped on size change so measure overlay computeds re-read track width. */
const resizeTick = ref(0);

type Backend = CanvasSwimlaneRenderer | WebGlSwimlaneRenderer;

let backend: Backend = new CanvasSwimlaneRenderer();
const overlay = new SwimlaneOverlayPainter();
let attached = false;
let attachedModel: SwimlaneModel | null = null;
let dragging = false;
let lastX = 0;
let downX = 0;
/** Client Y for magnet during window-level measure create/resize. */
let lastPointerClientY = 0;
let measureAnchorTime: number | null = null;
/** True once freeform create has crossed the 4px threshold (until pointerup). */
let measureGestureActive = false;
/** Measure-mode press waiting for click-vs-drag resolution. */
let measureCreatePending = false;
/** Freeform create ran this press (survives window onEnd clearing gesture). */
let measureDragOccurred = false;
/**
 * True from measure pointerdown until pointerup — survives Esc/toolbar abort so
 * the same press cannot pan or select.
 */
let measurePressActive = false;
const MEASURE_DRAG_THRESHOLD_PX = 4;
/** Magnet snap to nearest in-lane event start/end. */
const EVENT_EDGE_MAGNET_PX = 10;
/** Fast snap when clicking an event while a prior measure range exists. */
const MEASURE_SNAP_DURATION_MS = 180;
const suppressMeasurePreview = ref(false);
/** Live magnet highlight on the snapped event edge (block-height blue stem). */
const edgeSnapHighlight = ref<{ x: number; y: number; h: number } | null>(null);
/** Committed exact-match marks; projected each frame from a cached match set. */
const measureExactEdgeMarks = shallowRef<
  { eventId: string; edge: 'start' | 'end'; time: number; x: number; y: number; h: number }[]
>([]);
/** View-invariant matches for the current measureRange + layout; rescanned only when those change. */
let cachedExactEdgeMatches: ExactEdgeMatch[] = [];
let cachedExactEdgeMatchKey = '';
let cancelMeasureSnap: (() => void) | null = null;
let resizeEdge: MeasureResizeEdge | null = null;
/** Which measure border currently owns the pointer (for stuck cursor + zoom anchor). */
let hoveredMeasureEdge: MeasureResizeEdge | null = null;
let resizeFixedOther = 0;
let unbindResizeDrag: (() => void) | null = null;
let unbindCreateDrag: (() => void) | null = null;
let lastW = 0;
let lastH = 0;
/** Single CSS-pixel width for pointer→time, xRatio, and renderer layout. */
let trackWidth = 1;
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
  if (!props.model) {
    cachedExactEdgeMatches = [];
    cachedExactEdgeMatchKey = '';
    measureExactEdgeMarks.value = [];
    return;
  }
  const modelChanged = forceModel || props.model !== attachedModel;
  if (modelChanged) {
    backend.setModel(props.model);
    attachedModel = props.model;
    cachedExactEdgeMatchKey = ''; // layout identity changed — rescan matches
  }
  backend.setView(props.view);
  backend.setDependencyMode?.(props.dependencyMode);
  backend.setDependencyDepth?.(props.dependencyDepth);
  backend.setSelection(props.selectedEventId, props.hoveredEventId);
  backend.setSearchQuery(props.searchQuery);
  const labelFont = canvasLabelFont(props.fontFamily);
  if (backend instanceof CanvasSwimlaneRenderer) {
    backend.setLabelFont(labelFont);
  }
  if (useWebGl.value) {
    overlay.setLayout(backend.getLayout());
    overlay.setView(props.view);
    overlay.setSelection(props.selectedEventId, props.hoveredEventId);
    overlay.setNeighborIds(backend.getNeighborIds());
    overlay.setSearchQuery(props.searchQuery);
    overlay.setLabelFont(labelFont);
  }
  refreshMeasureExactEdgeMarks(modelChanged);
}

/**
 * Keep blue event-edge marks aligned with setView during Δt-focus / zoom.
 * Matching events are scanned once per settled measureRange+layout; each frame only re-projects x/y.
 * Skip the scan while a range tween or freeform create-drag is in flight — mid values are floats
 * that cannot hit exact edges (wasteful full scans); refresh on settle in onDone / create end.
 */
function refreshMeasureExactEdgeMarks(forceRescan = false): void {
  if (!props.measureMode || !props.measureRange || !props.model) {
    cachedExactEdgeMatches = [];
    cachedExactEdgeMatchKey = '';
    measureExactEdgeMarks.value = [];
    return;
  }
  // Range is moving — hide marks; do not key/scan on interpolating bounds.
  if (cancelMeasureSnap != null || measureGestureActive) {
    measureExactEdgeMarks.value = [];
    return;
  }
  const start = Math.min(props.measureRange.startTime, props.measureRange.endTime);
  const end = Math.max(props.measureRange.startTime, props.measureRange.endTime);
  if (!(end > start)) {
    cachedExactEdgeMatches = [];
    cachedExactEdgeMatchKey = '';
    measureExactEdgeMarks.value = [];
    return;
  }
  const w = syncTrackWidth();
  if (w <= 0) {
    measureExactEdgeMarks.value = [];
    return;
  }
  const key = `${start}:${end}`;
  if (forceRescan || key !== cachedExactEdgeMatchKey) {
    cachedExactEdgeMatchKey = key;
    cachedExactEdgeMatches = findExactEdgeMatches(backend.getLayout(), start, end);
  }
  const viewportH = wrapRef.value?.clientHeight || 0;
  measureExactEdgeMarks.value = projectExactEdgeMarks(
    cachedExactEdgeMatches,
    {
      startTime: props.view.startTime,
      endTime: props.view.endTime,
      scrollY: props.view.scrollY,
    },
    w,
    viewportH > 0 ? viewportH : Infinity,
  );
}

function sync(forceModel = false): void {
  applyViewState(forceModel);
  schedulePaint();
}

/** Repaint after HarmonyOS woff2 faces arrive (DOM reflows via CSS; canvas does not). */
function scheduleHarmonyFontRepaint(): void {
  if (props.fontFamily !== 'harmony' || typeof document === 'undefined' || !document.fonts) return;
  void document.fonts.load(HARMONYOS_CANVAS_LABEL_FONT).then(() => sync());
}

function resize(): void {
  const wrap = wrapRef.value;
  if (!wrap) return;

  const contentH = modelContentHeight();
  const w = syncTrackWidth();
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
    resizeTick.value += 1;
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

onMounted(async () => {
  await nextTick();
  resize();
  scheduleHarmonyFontRepaint();
  if (wrapRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(wrapRef.value);
  }
});

onBeforeUnmount(() => {
  cancelMeasureSnapAnim();
  endMeasureCreate();
  endMeasureResize();
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

watch(
  () => props.fontFamily,
  () => {
    sync();
    scheduleHarmonyFontRepaint();
  },
);

/** Drop live magnet stem when the time window moves (zoom / pan / Δt focus anim). */
watch(
  () => [props.view.startTime, props.view.endTime] as const,
  () => {
    edgeSnapHighlight.value = null;
  },
);

function cancelMeasureSnapAnim(): void {
  cancelMeasureSnap?.();
  cancelMeasureSnap = null;
  emit('suppress-measure-dt', false);
}

function runMeasureRangeTween(
  from: MeasureRange,
  to: MeasureRange,
  opts: { suppressDt: boolean; clearWhenDone?: boolean },
): void {
  emit('suppress-measure-dt', opts.suppressDt);
  cancelMeasureSnap = animateViewWindow({
    from,
    to,
    durationMs: MEASURE_SNAP_DURATION_MS,
    onUpdate: (w) => emit('update:measureRange', normalizeMeasureRange(w.startTime, w.endTime)),
    onDone: () => {
      cancelMeasureSnap = null;
      emit('suppress-measure-dt', false);
      if (opts.clearWhenDone) {
        emit('update:measureRange', null);
      } else {
        refreshMeasureExactEdgeMarks(true);
      }
    },
  });
}

function abortMeasureDrag(): void {
  // Unbind create/resize updates but keep measurePressActive / measureGestureActive
  // until pointerup so a mid-gesture Esc/toolbar cancel does not pan or select.
  cancelMeasureSnapAnim();
  unbindCreateDrag?.();
  unbindCreateDrag = null;
  measureAnchorTime = null;
  measureCreatePending = false;
  dragging = false;
  suppressMeasurePreview.value = false;
  hoveredMeasureEdge = null;
  endMeasureResize();
}

function endMeasureResize(): void {
  unbindResizeDrag?.();
  unbindResizeDrag = null;
  resizeEdge = null;
  suppressMeasurePreview.value = false;
}

function endMeasureCreate(): void {
  unbindCreateDrag?.();
  unbindCreateDrag = null;
  measureAnchorTime = null;
  measureGestureActive = false;
  measureCreatePending = false;
  measurePressActive = false;
  dragging = false;
  suppressMeasurePreview.value = false;
}

function beginMeasureCreateFromDown(): void {
  if (!wrapRef.value || measureGestureActive) return;
  cancelMeasureSnapAnim();
  const rect = wrapRef.value.getBoundingClientRect();
  measureCreatePending = false;
  measureGestureActive = true;
  measureDragOccurred = true;
  suppressMeasurePreview.value = true;
  // Use last known Y from pointer; downX is client X — magnetize at down.
  const local = localFromClient(downX, lastPointerClientY);
  const mag = local
    ? magnetizeLocal(local.x, local.y)
    : { time: timeAtX(downX - rect.left), xPx: downX - rect.left, xRatio: 0, eventId: null };
  measureAnchorTime = mag.time;
  emit(
    'update:measureRange',
    normalizeMeasureRange(measureAnchorTime, measureAnchorTime),
  );
}

function onCreateDragMove(clientX: number, clientY: number): void {
  lastPointerClientY = clientY;
  if (measureCreatePending) {
    if (Math.abs(clientX - downX) <= MEASURE_DRAG_THRESHOLD_PX) return;
    beginMeasureCreateFromDown();
  }
  emitCreateRange(clientX, clientY);
}

/** Window pointerup: stop listening; leave press flags for canvas `pointerup`. */
function onCreateDragEnd(): void {
  unbindCreateDrag?.();
  unbindCreateDrag = null;
  if (measureGestureActive) {
    measureAnchorTime = null;
    measureGestureActive = false;
    dragging = false;
    suppressMeasurePreview.value = false;
    refreshMeasureExactEdgeMarks(true);
  }
}

function emitResizedRange(clientX: number, clientY: number) {
  if (!resizeEdge || !wrapRef.value) return;
  lastPointerClientY = clientY;
  const local = localFromClient(clientX, clientY);
  const mag = local
    ? magnetizeLocal(local.x, local.y)
    : (() => {
        const rect = wrapRef.value!.getBoundingClientRect();
        const t = timeAtX(clientX - rect.left);
        return { time: t, xPx: clientX - rect.left, xRatio: 0, eventId: null };
      })();
  const w = syncTrackWidth();
  const next = resizeMeasureEdge({
    edge: resizeEdge,
    time: mag.time,
    fixedOther: resizeFixedOther,
    viewStart: props.view.startTime,
    viewEnd: props.view.endTime,
    minSpan: measureResizeMinSpan(props.view.startTime, props.view.endTime, w),
  });
  emit('update:measureRange', next);
  const edgeTime = resizeEdge === 'left' ? next.startTime : next.endTime;
  const span = Math.max(1, props.view.endTime - props.view.startTime);
  const xRatio = (edgeTime - props.view.startTime) / span;
  emit('cursor', {
    time: edgeTime,
    xRatio: Math.min(1, Math.max(0, xRatio)),
  });
}

function emitCreateRange(clientX: number, clientY: number) {
  if (!measureGestureActive || measureAnchorTime == null || !wrapRef.value) return;
  lastPointerClientY = clientY;
  const local = localFromClient(clientX, clientY);
  const mag = local
    ? magnetizeLocal(local.x, local.y)
    : { time: timeAtX(clientX - wrapRef.value.getBoundingClientRect().left), xPx: 0, xRatio: 0, eventId: null };
  emit('update:measureRange', normalizeMeasureRange(measureAnchorTime, mag.time));
  emit('cursor', { time: mag.time, xRatio: mag.xRatio });
}

/** Snap to event borders; tween from prior range or (if none) from the visible window. */
function snapMeasureToEvent(ev: SwimEvent): void {
  const to = normalizeMeasureRange(ev.startTime, ev.startTime + ev.duration);
  cancelMeasureSnapAnim();
  if (prefersReducedMotion()) {
    emit('update:measureRange', to);
    return;
  }
  const prev = props.measureRange;
  const viewSpan = normalizeMeasureRange(props.view.startTime, props.view.endTime);
  let from: MeasureRange;
  let suppressDt = false;
  if (prev) {
    from = normalizeMeasureRange(prev.startTime, prev.endTime);
    if (!(from.endTime > from.startTime)) {
      from = viewSpan;
      suppressDt = true;
    } else if (from.startTime === viewSpan.startTime && from.endTime === viewSpan.endTime) {
      suppressDt = true;
    }
  } else {
    from = viewSpan;
    suppressDt = true;
  }
  if (from.startTime === to.startTime && from.endTime === to.endTime) {
    emit('update:measureRange', to);
    return;
  }
  runMeasureRangeTween(from, to, { suppressDt });
}

function clearMeasureRange(): void {
  cancelMeasureSnapAnim();
  const prev = props.measureRange;
  if (!prev) {
    emit('update:measureRange', null);
    return;
  }
  const from = normalizeMeasureRange(prev.startTime, prev.endTime);
  if (!(from.endTime > from.startTime) || prefersReducedMotion()) {
    emit('update:measureRange', null);
    return;
  }
  const to = normalizeMeasureRange(props.view.startTime, props.view.endTime);
  // Already spans (or exceeds) the visible window — nothing to expand into.
  if (from.startTime <= to.startTime && from.endTime >= to.endTime) {
    emit('update:measureRange', null);
    return;
  }
  runMeasureRangeTween(from, to, { suppressDt: true, clearWhenDone: true });
}

/** Stick playhead cursor to a measure edge while the hit pad owns the pointer. */
function emitCursorAtMeasureEdge(edge: MeasureResizeEdge) {
  const geo = measureGeometry.value;
  const range = props.measureRange;
  if (!geo || !range || !wrapRef.value) return;
  const w = syncTrackWidth();
  const start = Math.min(range.startTime, range.endTime);
  const end = Math.max(range.startTime, range.endTime);
  const x = edge === 'left' ? geo.left : geo.right;
  emit('cursor', {
    time: edge === 'left'
      ? Math.max(props.view.startTime, start)
      : Math.min(props.view.endTime, end),
    xRatio: x / w,
  });
}

/** Time of the measure border currently under the pointer (zoom anchor). */
function stuckMeasureEdgeTime(): number | null {
  const edge = hoveredMeasureEdge ?? resizeEdge;
  const range = props.measureRange;
  if (!edge || !range) return null;
  const start = Math.min(range.startTime, range.endTime);
  const end = Math.max(range.startTime, range.endTime);
  return edge === 'left'
    ? Math.max(props.view.startTime, start)
    : Math.min(props.view.endTime, end);
}

function isMeasureBorderEl(t: EventTarget | null): boolean {
  return !!(t as HTMLElement | null)?.closest?.('.pr-measure-border');
}

function onMeasureBorderPointerDown(e: PointerEvent, edge: MeasureResizeEdge) {
  if (e.button !== 0 || !props.measureMode) return;
  const range = props.measureRange;
  if (!range) return;
  const start = Math.min(range.startTime, range.endTime);
  const end = Math.max(range.startTime, range.endTime);
  endMeasureCreate();
  endMeasureResize();
  cancelMeasureSnapAnim();
  hoveredMeasureEdge = edge;
  resizeEdge = edge;
  resizeFixedOther = edge === 'left' ? end : start;
  suppressMeasurePreview.value = true;
  emitCursorAtMeasureEdge(edge);
  unbindResizeDrag = bindWindowPointerDrag({
    onMove: emitResizedRange,
    onEnd: endMeasureResize,
  });
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  e.stopPropagation();
  e.preventDefault();
}

function onMeasureBorderPointerEnter(_e: PointerEvent, edge: MeasureResizeEdge) {
  hoveredMeasureEdge = edge;
  emitCursorAtMeasureEdge(edge);
}

function onMeasureBorderPointerLeave(e: PointerEvent) {
  if (resizeEdge || measureGestureActive || measureCreatePending || measurePressActive) return;
  if (isMeasureBorderEl(e.relatedTarget)) return;
  // Onto canvas: drop border zoom stick; canvas pointermove owns cursor next.
  if ((e.relatedTarget as HTMLElement | null)?.closest?.('.pr-swim-canvas')) {
    hoveredMeasureEdge = null;
    return;
  }
  hoveredMeasureEdge = null;
  emit('cursor', null);
}

watch(
  () => props.measureRange,
  (range) => {
    if (range == null) abortMeasureDrag();
    refreshMeasureExactEdgeMarks(true);
  },
);

watch(
  () => props.measureMode,
  (mode) => {
    if (!mode) abortMeasureDrag();
    refreshMeasureExactEdgeMarks(true);
  },
);

function readTrackWidth(): number {
  const wrap = wrapRef.value;
  if (wrap) {
    const wrapW = wrap.getBoundingClientRect().width || wrap.clientWidth;
    if (wrapW > 0) return Math.max(1, wrapW);
  }
  const canvas = activeCanvas();
  if (canvas) {
    return Math.max(1, canvas.getBoundingClientRect().width);
  }
  return Math.max(1, trackWidth);
}

function syncTrackWidth(): number {
  trackWidth = readTrackWidth();
  return trackWidth;
}

function timeAtX(x: number): number {
  const span = Math.max(1, props.view.endTime - props.view.startTime);
  const w = syncTrackWidth();
  return props.view.startTime + (x / w) * span;
}

function xAtTime(t: number): number {
  const span = Math.max(1, props.view.endTime - props.view.startTime);
  const w = syncTrackWidth();
  return ((t - props.view.startTime) / span) * w;
}

/** Magnetize local canvas coords; updates live edge snap highlight. */
function magnetizeLocal(
  localX: number,
  localY: number,
): { time: number; xPx: number; xRatio: number; eventId: string | null } {
  const w = syncTrackWidth();
  const hit = nearestEventEdgeAtPoint(
    backend.getLayout(),
    props.view,
    w,
    localX,
    localY,
    EVENT_EDGE_MAGNET_PX,
  );
  if (!hit) {
    edgeSnapHighlight.value = null;
    return { time: timeAtX(localX), xPx: localX, xRatio: localX / w, eventId: null };
  }
  const item = backend.getLayout().eventsById.get(hit.eventId);
  edgeSnapHighlight.value = item
    ? { x: hit.xPx, y: item.y - props.view.scrollY, h: LANE_HEIGHT }
    : null;
  return { time: hit.time, xPx: hit.xPx, xRatio: hit.xPx / w, eventId: hit.eventId };
}

/** Hover/select target: magnetized edge event wins, else spatial hitTest. */
function eventAtPointer(localX: number, localY: number, magnetEventId: string | null) {
  if (magnetEventId) {
    const ev = backend.findEvent(magnetEventId);
    if (ev) return ev;
  }
  const id = backend.hitTest(localX, localY);
  return id ? backend.findEvent(id) : null;
}

function localFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
  const target = activeCanvas() ?? wrapRef.value;
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/** Window-level measure drag from the axis — magnetize when pointer is over the canvas. */
function magnetizeAtClient(clientX: number, clientY: number) {
  const local = localFromClient(clientX, clientY);
  if (!local) {
    edgeSnapHighlight.value = null;
    return null;
  }
  return magnetizeLocal(local.x, local.y);
}

function clearEdgeSnapHighlight() {
  edgeSnapHighlight.value = null;
}

/** Fade bands outside the visible selection (persists when range is fully off-screen). */
const measureFadeGeometry = computed(() => {
  void resizeTick.value;
  const range = props.measureRange;
  if (!range) return null;
  const start = Math.min(range.startTime, range.endTime);
  const end = Math.max(range.startTime, range.endTime);
  if (!(end > start)) return null;
  const viewStart = props.view.startTime;
  const viewEnd = props.view.endTime;
  const w = syncTrackWidth();
  if (end <= viewStart) {
    return { leftWidth: w, rightLeft: w };
  }
  if (start >= viewEnd) {
    return { leftWidth: 0, rightLeft: 0 };
  }
  const visStart = Math.max(viewStart, start);
  const visEnd = Math.min(viewEnd, end);
  return {
    leftWidth: xAtTime(visStart),
    rightLeft: xAtTime(visEnd),
  };
});

const measureGeometry = computed(() => {
  void resizeTick.value;
  const range = props.measureRange;
  if (!range) return null;
  const start = Math.min(range.startTime, range.endTime);
  const end = Math.max(range.startTime, range.endTime);
  if (!(end > start)) return null;
  const viewStart = props.view.startTime;
  const viewEnd = props.view.endTime;
  const visStart = Math.max(viewStart, start);
  const visEnd = Math.min(viewEnd, end);
  if (!(visEnd > visStart)) return null;
  const left = xAtTime(visStart);
  const right = xAtTime(visEnd);
  return {
    left,
    right,
    width: Math.max(1, right - left),
    showLeft: start >= viewStart,
    showRight: end <= viewEnd,
  };
});

/** Gray event-edge preview while hovering in measure mode (no fades). */
const measurePreviewGeometry = computed(() => {
  void resizeTick.value;
  if (!props.measureMode || suppressMeasurePreview.value || !props.model) return null;
  const id = props.hoveredEventId;
  if (!id) return null;
  // Depend on view so x positions update when the window pans/zooms.
  void props.view.startTime;
  void props.view.endTime;
  const ev = backend.findEvent(id);
  if (!ev) return null;
  const start = ev.startTime;
  const end = ev.startTime + ev.duration;
  if (!(end > start)) return null;
  const viewStart = props.view.startTime;
  const viewEnd = props.view.endTime;
  const showLeft = start >= viewStart && start <= viewEnd;
  const showRight = end >= viewStart && end <= viewEnd;
  if (!showLeft && !showRight) return null;
  return {
    left: xAtTime(start),
    right: xAtTime(end),
    showLeft,
    showRight,
  };
});

function activeCanvas(): HTMLCanvasElement | null {
  return useWebGl.value ? overlayCanvasRef.value : fallbackCanvasRef.value;
}

function onPointerDown(e: PointerEvent): void {
  lastX = e.clientX;
  downX = e.clientX;
  lastPointerClientY = e.clientY;
  measureDragOccurred = false;
  if (props.measureMode && activeCanvas()) {
    endMeasureCreate();
    endMeasureResize();
    measurePressActive = true;
    measureCreatePending = true;
    measureGestureActive = false;
    unbindCreateDrag = bindWindowPointerDrag({
      onMove: onCreateDragMove,
      onEnd: onCreateDragEnd,
    });
  } else {
    endMeasureCreate();
  }
  dragging = true;
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
}

function onPointerMove(e: PointerEvent): void {
  const target = activeCanvas();
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const w = syncTrackWidth();
  lastPointerClientY = e.clientY;

  schedulePaint();
  const mag = magnetizeLocal(x, y);
  emit('cursor', { time: mag.time, xRatio: mag.xRatio });

  if (dragging) {
    // Measure create is driven by window listeners (release over Card strips still ends).
    if (measureGestureActive || measureCreatePending || measurePressActive) {
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

  emit('hover', eventAtPointer(x, y, mag.eventId), e.clientX, e.clientY);
}

function onPointerUp(e: PointerEvent): void {
  const didFreeform = measureDragOccurred;
  const wasPending = measureCreatePending && !didFreeform;
  const wasMeasurePress = measurePressActive;
  endMeasureCreate();
  measureDragOccurred = false;
  const target = activeCanvas();
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const mag = magnetizeLocal(x, y);
  emit('set-playhead', mag.time);
  if (wasMeasurePress || props.measureMode) {
    if (
      props.measureMode &&
      wasPending &&
      !didFreeform &&
      Math.abs(e.clientX - downX) <= MEASURE_DRAG_THRESHOLD_PX
    ) {
      const ev = eventAtPointer(x, y, mag.eventId);
      if (ev) {
        snapMeasureToEvent(ev);
        emit('select', ev);
      } else {
        clearMeasureRange();
        emit('select', null);
      }
    }
    return;
  }
  if (Math.abs(e.clientX - downX) > MEASURE_DRAG_THRESHOLD_PX) return;
  emit('select', eventAtPointer(x, y, mag.eventId));
}

function onPointerLeave(e: PointerEvent): void {
  // Keep measure drag alive under pointer capture; clear anchor only on pointerup / cancel.
  if (measureGestureActive || measureCreatePending || measurePressActive) {
    schedulePaint();
    edgeSnapHighlight.value = null;
    emit('cursor', null);
    emit('hover', null, 0, 0);
    return;
  }
  // Measure borders sit above the canvas; they stick the cursor — do not clear on the way there.
  if (isMeasureBorderEl(e.relatedTarget)) {
    schedulePaint();
    emit('hover', null, 0, 0);
    return;
  }
  dragging = false;
  measureAnchorTime = null;
  edgeSnapHighlight.value = null;
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
  const y = e.clientY - rect.top;
  if (e.ctrlKey || e.metaKey) {
    const mag = magnetizeLocal(x, y);
    const anchor = stuckMeasureEdgeTime() ?? mag.time;
    emit('zoom', e.deltaY > 0 ? 1 / 1.15 : 1.15, anchor);
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
  magnetizeAtClient,
  clearEdgeSnapHighlight,
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
    <template v-if="measureMode && measureFadeGeometry">
      <div
        class="pr-measure-fade pr-measure-fade--left"
        data-testid="measure-fade-left"
        :style="{ width: `${measureFadeGeometry.leftWidth}px` }"
      />
      <div
        class="pr-measure-fade pr-measure-fade--right"
        data-testid="measure-fade-right"
        :style="{ left: `${measureFadeGeometry.rightLeft}px`, right: '0' }"
      />
    </template>
    <template v-if="measureMode && measureGeometry">
      <div
        v-if="measureGeometry.showLeft"
        class="pr-measure-border pr-measure-border--left"
        data-testid="measure-border-left"
        :style="{ left: `${measureGeometry.left}px` }"
        @pointerdown="onMeasureBorderPointerDown($event, 'left')"
        @pointerenter="onMeasureBorderPointerEnter($event, 'left')"
        @pointerleave="onMeasureBorderPointerLeave"
        @wheel="onWheel"
      />
      <div
        v-if="measureGeometry.showRight"
        class="pr-measure-border pr-measure-border--right"
        data-testid="measure-border-right"
        :style="{ left: `${measureGeometry.right}px` }"
        @pointerdown="onMeasureBorderPointerDown($event, 'right')"
        @pointerenter="onMeasureBorderPointerEnter($event, 'right')"
        @pointerleave="onMeasureBorderPointerLeave"
        @wheel="onWheel"
      />
    </template>
    <template v-if="measureMode && measurePreviewGeometry">
      <div
        v-if="measurePreviewGeometry.showLeft"
        class="pr-measure-border pr-measure-border--preview"
        data-testid="measure-preview-left"
        :style="{ left: `${measurePreviewGeometry.left}px` }"
      />
      <div
        v-if="measurePreviewGeometry.showRight"
        class="pr-measure-border pr-measure-border--preview"
        data-testid="measure-preview-right"
        :style="{ left: `${measurePreviewGeometry.right}px` }"
      />
    </template>
    <div
      v-if="edgeSnapHighlight"
      class="pr-measure-edge-mark pr-measure-edge-mark--snap"
      data-testid="measure-edge-snap"
      :style="{
        left: `${edgeSnapHighlight.x}px`,
        top: `${edgeSnapHighlight.y}px`,
        height: `${edgeSnapHighlight.h}px`,
      }"
    />
    <div
      v-for="(mark, i) in measureExactEdgeMarks"
      :key="`${mark.eventId}-${mark.edge}-${i}`"
      class="pr-measure-edge-mark pr-measure-edge-mark--exact"
      data-testid="measure-edge-exact"
      :style="{
        left: `${mark.x}px`,
        top: `${mark.y}px`,
        height: `${mark.h}px`,
      }"
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
  width: 9px;
  background: transparent;
  cursor: col-resize;
  pointer-events: auto;
  touch-action: none;
  z-index: 3;
  transform: translateX(-50%);
}

.pr-measure-border::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
  background: #4c4c4c;
}

.pr-measure-border:hover::before,
.pr-measure-border:active::before {
  width: 2px;
}

.pr-measure-border--preview {
  pointer-events: none;
  cursor: default;
  z-index: 2;
}

/* Event-edge marks: 1px live snap stem; 2px committed exact-match (full lane height). */
.pr-measure-edge-mark {
  position: absolute;
  width: 1px;
  transform: translateX(-50%);
  background: var(--pr-playhead, #3078f0);
  pointer-events: none;
  z-index: 4;
}

.pr-measure-edge-mark--exact {
  width: 2px;
}

.pr-measure-edge-mark--snap {
  z-index: 5;
}
</style>
