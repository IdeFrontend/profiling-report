<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import {
  DEFAULT_DEPENDENCY_DEPTH,
  type DependencyMode,
  type MeasureRange,
  type SwimEvent,
  type SwimlaneModel,
  type SwimlaneViewWindow,
} from '../../../../domain/types';
import { normalizeMeasureRange } from '../../../../domain/viewState';
import { formatTimeAuto } from '../../../../domain/formatTime';
import { WebGlSwimlaneRenderer } from '../../../../swimlane/WebGlSwimlaneRenderer';
import {
  computeAltMeasureDelta,
  computeAltMeasureGap,
  contentHeightFromModel,
  eventMeasureTargetTime,
  eventsIntersectingRect,
  findExactEdgeMatches,
  findExactEdgeMatchesAt,
  findHoverGap,
  LANE_HEIGHT,
  leafLaneIdAtPoint,
  nearestEventEdgeAtPoint,
  projectExactEdgeMarks,
  type ExactEdgeMatch,
  type HoverGap,
  type MarqueeRect,
} from '../../../../swimlane/layout';
import { CanvasSwimlaneRenderer, SwimlaneOverlayPainter } from '../../../../swimlane/CanvasSwimlaneRenderer';
import {
  bindWindowPointerDrag,
  measureResizeMinSpan,
  resizeMeasureEdge,
  type MeasureResizeEdge,
} from '../../measureEdgeResize';
import {
  measureLabelFitsInlineSpan,
} from '../../cursorMeasureOverlap';
import MeasureDtArrow from '../../MeasureDtArrow.vue';
import { animateViewWindow, prefersReducedMotion } from '../../animateViewWindow';
import {
  ALT_MEASURE_FIND_EVENT_KEY,
  ALT_MEASURE_SHARED_KEY,
  clearAltMeasureShared,
  createAltMeasureShared,
  type AltMeasureSurface,
  type AltMeasureTarget,
} from '../altMeasureShared';

const props = withDefaults(
  defineProps<{
    model: SwimlaneModel | null;
    view: SwimlaneViewWindow;
    selectedEventId: string | null;
    hoveredEventId: string | null;
    /** Marquee multi-selection; dims everything else in the renderer. */
    multiSelectedIds?: string[];
    searchQuery: string;
    measureMode?: boolean;
    measureRange?: MeasureRange | null;
    dependencyMode?: DependencyMode;
    dependencyDepth?: number;
    /** When false, skip dependency curves and selection dimming (pinned strip). */
    showDependencies?: boolean;
    /** Force backend for perf A/B. Default auto prefers WebGL2 when available. */
    preferRenderer?: 'auto' | 'webgl' | 'canvas';
    /** Shared playhead x from parent (axis hover + canvas); drives the swim vertical bar. */
    cursorXRatio?: number | null;
    /** Gray the swim vertical bar while magnetized to an event edge. */
    cursorSnapped?: boolean;
    /**
     * Parent override for client-space magnet (pin strip ↔ body). When set, measure
     * create/resize and expose use this instead of this canvas’s local layout.
     */
    resolveMagnetize?: (
      clientX: number,
      clientY: number,
    ) => { time: number; xPx: number; xRatio: number; eventId: string | null } | null;
    /**
     * Alt-measure surface role. Endpoints record which surface captured them so a
     * body click on a pinned lane stays on the body instance (not the sticky duplicate).
     */
    altMeasureRole?: 'body' | 'strip' | 'solo';
    /** Leaf lane ids currently in the sticky strip (informational; ownership uses surfaces). */
    pinnedLaneIds?: string[];
  }>(),
  {
    dependencyMode: 'all',
    dependencyDepth: DEFAULT_DEPENDENCY_DEPTH,
    showDependencies: true,
    cursorXRatio: null,
    cursorSnapped: false,
    altMeasureRole: 'solo',
    pinnedLaneIds: () => [],
    multiSelectedIds: () => [],
  },
);

const emit = defineEmits<{
  select: [event: SwimEvent | null];
  /** Marquee commit — every leaf event intersecting the rect. */
  'multi-select': [events: SwimEvent[]];
  /** Live marquee time extent for the axis Δt chrome; null when the drag ends or cancels. */
  'multi-select-span': [span: MeasureRange | null];
  hover: [event: SwimEvent | null, clientX: number, clientY: number];
  /** Leaf lane under pointer Y — gutter header highlight only (not pin). */
  'lane-hover': [laneId: string | null];
  cursor: [payload: { time: number; xRatio: number; snapped?: boolean } | null];
  pan: [deltaTime: number];
  zoom: [factor: number, anchorTime: number];
  'scroll-y': [scrollY: number];
  'set-playhead': [time: number];
  'update:measureRange': [range: MeasureRange | null];
  /** Hide axis Δt arrow/label during appear/clear (view↔range) tweens only. */
  'suppress-measure-dt': [suppress: boolean];
}>();

/**
 * Track-side half of the lane hover (AC-07); the gutter row is the other half.
 *
 * Held here rather than round-tripped through the parent because the renderers need it
 * on the same pointermove that emits it, and painted by them rather than laid over the
 * canvas as a DOM band: an overlay would tint the events it crosses, and hover on an
 * event already means something else (AC-08's lifted fill).
 */
const hoveredLaneId = ref<string | null>(null);

function emitLaneHover(localY: number | null): void {
  const id = localY == null ? null : leafLaneIdAtPoint(backend.getLayout(), props.view, localY);
  hoveredLaneId.value = id;
  backend.setHoveredLane?.(id);
  // Overlay underpaint must see the same hovered row as the GL background pass.
  if (useWebGl.value) overlay.setHoveredLane(id);
  emit('lane-hover', id);
}

const wrapRef = ref<HTMLDivElement | null>(null);
const glCanvasRef = ref<HTMLCanvasElement | null>(null);
const overlayCanvasRef = ref<HTMLCanvasElement | null>(null);
const fallbackCanvasRef = ref<HTMLCanvasElement | null>(null);
const sizerHeight = ref(120);
/** Pick backend before first paint so only that canvas set is mounted (no hidden siblings). */
function chooseWebGl(): boolean {
  const prefer = props.preferRenderer ?? 'auto';
  if (prefer === 'canvas') return false;
  return WebGlSwimlaneRenderer.isSupported();
}
const useWebGl = ref(chooseWebGl());
/** Bumped on size change so measure overlay computeds re-read track width. */
const resizeTick = ref(0);

type Backend = CanvasSwimlaneRenderer | WebGlSwimlaneRenderer;

let backend: Backend = new CanvasSwimlaneRenderer();
const overlay = new SwimlaneOverlayPainter();
let attached = false;
let attachedModel: SwimlaneModel | null = null;
let downX = 0;
/** Client Y for magnet during window-level measure create/resize. */
let lastPointerClientY = 0;
/** Last canvas-local pointer for hover-gap refresh on zoom/pan/scroll. */
let lastHoverLocalX: number | null = null;
let lastHoverLocalY: number | null = null;
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
/** Marquee (unmodified drag) multi-select — same 4px click-vs-drag gate as measure create. */
const marqueeRect = ref<MarqueeRect | null>(null);
/** Local anchor for the marquee; set on pointerdown. */
let marqueeAnchor: { x: number; y: number } | null = null;
/** Press waiting for the 4px threshold — still a click until it is crossed. */
let marqueePending = false;
/** True from marquee pointerdown until pointerup — suppresses tooltip / select. */
let marqueePressActive = false;
let unbindMarqueeDrag: (() => void) | null = null;
/** Magnet snap to nearest in-lane event start/end. */
const EVENT_EDGE_MAGNET_PX = 10;
/** Fast snap when clicking an event while a prior measure range exists. */
const MEASURE_SNAP_DURATION_MS = 180;
const suppressMeasurePreview = ref(false);
/** View-invariant matches for the snapped magnet edge; rescanned on each snap. */
let snapExactEdgeMatches: ExactEdgeMatch[] = [];
/** Memoize findExactEdgeMatchesAt — same snapped/anchor time must not rescan every move. */
let lastExactScanTime: number | null = null;
let lastExactScanMatches: ExactEdgeMatch[] = [];
/** Projected snap marks — blue bars at every event edge exactly equal to the snapped time. */
const snapExactEdgeMarks = shallowRef<
  { eventId: string; edge: 'start' | 'end'; time: number; x: number; y: number; h: number }[]
>([]);
/** Default-mode hover gap between adjacent events (measure overlay). */
const hoverGap = ref<HoverGap | null>(null);
/** Shared Alt-measure session (pin strip ↔ body) or a local fallback for standalone mounts. */
const altMeasure = inject(ALT_MEASURE_SHARED_KEY, null) ?? createAltMeasureShared();
const findAltMeasureEvent =
  inject(ALT_MEASURE_FIND_EVENT_KEY, null) ?? ((id: string) => backend.findEvent(id));
/** Committed exact-match marks; projected each frame from a cached match set. */
const measureExactEdgeMarks = shallowRef<
  { eventId: string; edge: 'start' | 'end'; time: number; x: number; y: number; h: number }[]
>([]);
/** View-invariant matches for the current measureRange + layout; rescanned only when those change. */
let cachedExactEdgeMatches: ExactEdgeMatch[] = [];
let cachedExactEdgeMatchKey = '';
let cancelMeasureSnap: (() => void) | null = null;
let resizeEdge: MeasureResizeEdge | null = null;
/** Active measure-border resize — hides gray stem so playhead owns the full-height line. */
const resizingBorder = ref<MeasureResizeEdge | null>(null);
/** Which measure border currently owns the pointer (for stuck cursor + zoom anchor). */
let hoveredMeasureEdge: MeasureResizeEdge | null = null;
let resizeFixedOther = 0;
let unbindResizeDrag: (() => void) | null = null;
let unbindCreateDrag: (() => void) | null = null;
let lastW = 0;
let lastH = 0;
/** Device-pixel buffer size from RO; stay 0 until a positive box arrives — no paint until then. */
let lastDeviceW = 0;
let lastDeviceH = 0;
let lastDpr = 0;
/** Single CSS-pixel width for pointer→time, xRatio, and CSS-space layout helpers. */
let trackWidth = 1;
let resizeObserver: ResizeObserver | null = null;
let raf = 0;
/** Local scroll accumulator so rapid wheel events do not drop deltas waiting on props. */
let localScrollY = 0;

function currentDpr(): number {
  return typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
}

/** Main canvas used for ResizeObserver device-pixel box (GL when active, else fallback). */
function mainCanvasEl(): HTMLCanvasElement | null {
  if (useWebGl.value) return glCanvasRef.value;
  return fallbackCanvasRef.value ?? glCanvasRef.value;
}

/**
 * Device-pixel buffer size from a ResizeObserver callback only.
 * Returns null when `entries` is missing/empty so callers do not invent a default size.
 */
function readDeviceBoxFromRo(
  entries: ResizeObserverEntry[],
  cssW: number,
  cssH: number,
  dpr: number,
): { deviceW: number; deviceH: number } | null {
  const main = mainCanvasEl();
  if (!main || entries.length === 0) return null;
  const entry = entries.find((e) => e.target === main) ?? entries[0];
  if (!entry) return null;

  const box = entry.devicePixelContentBoxSize?.[0];
  if (box && box.inlineSize > 0 && box.blockSize > 0) {
    const roW = Math.round(box.inlineSize);
    const roH = Math.round(box.blockSize);
    // Some test / headless envs report CSS px as devicePixelContentBoxSize.
    if (dpr > 1.05 && Math.abs(roW - cssW) <= 1 && Math.abs(roH - cssH) <= 1) {
      return {
        deviceW: Math.max(1, Math.round(cssW * dpr)),
        deviceH: Math.max(1, Math.round(cssH * dpr)),
      };
    }
    return { deviceW: Math.max(1, roW), deviceH: Math.max(1, roH) };
  }

  // RO fired but no devicePixelContentBoxSize (older engines): content box × dpr.
  const content = entry.contentBoxSize?.[0];
  if (content && content.inlineSize > 0 && content.blockSize > 0) {
    return {
      deviceW: Math.max(1, Math.round(content.inlineSize * dpr)),
      deviceH: Math.max(1, Math.round(content.blockSize * dpr)),
    };
  }
  return null;
}

function zeroBackingStores(): void {
  for (const c of [glCanvasRef.value, overlayCanvasRef.value, fallbackCanvasRef.value]) {
    if (!c) continue;
    if (c.width !== 0) c.width = 0;
    if (c.height !== 0) c.height = 0;
  }
}

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

function panHoverCaptureActive(): boolean {
  return (
    dragging &&
    !props.measureMode &&
    !measureGestureActive &&
    !measureCreatePending &&
    !measurePressActive
  );
}

function clearPanHoverCapture(): void {
  panCaptureHoverGap = null;
  panCaptureHoverEvent = null;
}

/** Snapshot hover gap + event hover at pointerdown; held until pointerup (pan capture). */
function capturePanHover(
  localX: number,
  localY: number,
  w: number,
  magEventId: string | null,
): void {
  if (props.measureMode) {
    clearPanHoverCapture();
    return;
  }
  lastHoverLocalX = localX;
  lastHoverLocalY = localY;
  panCaptureHoverEvent = eventAtPointer(localX, localY, magEventId);
  // Alt session owns the Δt chrome — never freeze a hover-gap under it.
  if (altMeasureSessionActive()) {
    panCaptureHoverGap = null;
    hoverGap.value = null;
    return;
  }
  panCaptureHoverGap = findHoverGap(
    backend.getLayout(),
    props.view,
    w,
    localX,
    localY,
    EVENT_EDGE_MAGNET_PX,
  );
  hoverGap.value = panCaptureHoverGap;
}

/** Restore live hover after pan capture ends. */
function restoreHoverAfterPanCapture(
  localX: number,
  localY: number,
  w: number,
  magEventId: string | null,
  clientX: number,
  clientY: number,
): void {
  clearPanHoverCapture();
  updateHoverGap(localX, localY, w);
  emit('hover', eventAtPointer(localX, localY, magEventId), clientX, clientY);
}

function altMeasureSessionActive(): boolean {
  return (
    altMeasure.anchorId != null &&
    !props.measureMode &&
    (altMeasure.altKeyHeld || altMeasure.pinned)
  );
}

function clearAltMeasure(): void {
  clearAltMeasureShared(altMeasure);
}

function onWindowKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight') altMeasure.altKeyHeld = true;
  if (e.key === 'Escape' && altMeasure.anchorId) clearAltMeasure();
}

function onWindowKeyUp(e: KeyboardEvent): void {
  if (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight') {
    altMeasure.altKeyHeld = false;
    // Pinned measure survives Alt release; ephemeral clears.
    if (!altMeasure.pinned) clearAltMeasure();
  }
}

/** Default-mode hover gap at canvas-local coords; stores position for view refresh. */
function updateHoverGap(localX: number, localY: number, w: number): void {
  lastHoverLocalX = localX;
  lastHoverLocalY = localY;
  if (props.measureMode || altMeasureSessionActive()) {
    hoverGap.value = null;
    return;
  }
  hoverGap.value = findHoverGap(
    backend.getLayout(),
    props.view,
    w,
    localX,
    localY,
    EVENT_EDGE_MAGNET_PX,
  );
}

/** Recompute hover gap after zoom/pan/scroll when the pointer is still over the canvas. */
function refreshHoverGapAtLastPointer(): void {
  if (
    props.measureMode ||
    altMeasureSessionActive() ||
    measureGestureActive ||
    measureCreatePending ||
    measurePressActive ||
    lastHoverLocalX == null ||
    lastHoverLocalY == null
  ) {
    hoverGap.value = null;
    return;
  }
  const w = Math.max(1, wrapRef.value?.clientWidth || 1);
  hoverGap.value = findHoverGap(
    backend.getLayout(),
    props.view,
    w,
    lastHoverLocalX,
    lastHoverLocalY,
    EVENT_EDGE_MAGNET_PX,
  );
}

function schedulePaint(): void {
  if (lastDeviceW < 1 || lastDeviceH < 1) return;
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    backend.render();
    if (useWebGl.value) overlay.render();
  });
}

/** Paint in the same turn (after buffer resize) so the canvas never shows a cleared frame. */
function flushPaint(): void {
  if (lastDeviceW < 1 || lastDeviceH < 1) return;
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
    snapExactEdgeMatches = [];
    snapExactEdgeMarks.value = [];
    invalidateExactMatchCache();
    return;
  }
  const modelChanged = forceModel || props.model !== attachedModel;
  if (modelChanged) {
    backend.setModel(props.model);
    attachedModel = props.model;
    cachedExactEdgeMatchKey = ''; // layout identity changed — rescan matches
    snapExactEdgeMatches = []; // lane Ys may have moved — drop live snap marks
    invalidateExactMatchCache();
  }
  backend.setView(props.view);
  backend.setDependencyMode?.(props.dependencyMode);
  backend.setDependencyDepth?.(props.dependencyDepth);
  backend.setPaintDependencies?.(props.showDependencies !== false);
  backend.setSelection(props.selectedEventId, props.hoveredEventId);
  backend.setSearchQuery(props.searchQuery);
  backend.setMultiSelection?.(props.multiSelectedIds);
  if (useWebGl.value) {
    overlay.setLayout(backend.getLayout());
    overlay.setView(props.view);
    overlay.setSelection(props.selectedEventId, props.hoveredEventId);
    overlay.setHoveredLane(hoveredLaneId.value);
    overlay.setNeighborIds(backend.getNeighborIds());
    overlay.setSelectionDim(props.showDependencies !== false);
    overlay.setSearchQuery(props.searchQuery);
    overlay.setMultiSelection(props.multiSelectedIds);
  }
  refreshMeasureExactEdgeMarks(modelChanged);
  refreshSnapExactEdgeMarks();
}

/**
 * Keep blue event-edge marks aligned with setView during Δt-focus / zoom.
 * Matching events are scanned once per settled measureRange+layout; each frame only re-projects x/y.
 * A range tween skips the scan (interpolating bounds cannot hit exact edges). A freeform
 * create-drag keeps the fixed anchor (start) border marker visible instead of clearing.
 */
function refreshMeasureExactEdgeMarks(forceRescan = false): void {
  if (!props.measureMode || !props.measureRange || !props.model) {
    cachedExactEdgeMatches = [];
    cachedExactEdgeMatchKey = '';
    measureExactEdgeMarks.value = [];
    return;
  }
  // Range tween in flight — interpolating bounds cannot hit exact edges; hide marks.
  if (cancelMeasureSnap != null) {
    measureExactEdgeMarks.value = [];
    return;
  }
  // Freeform create drag — keep the fixed anchor (start) border marker visible.
  if (measureGestureActive) {
    measureExactEdgeMarks.value = exactMarksAtTime(measureAnchorTime);
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

/** Re-project live magnet snap marks into screen bars for the current view window. */
function refreshSnapExactEdgeMarks(): void {
  if (snapExactEdgeMatches.length === 0) {
    snapExactEdgeMarks.value = [];
    return;
  }
  const w = syncTrackWidth();
  if (w <= 0) {
    snapExactEdgeMarks.value = [];
    return;
  }
  const viewportH = wrapRef.value?.clientHeight || 0;
  snapExactEdgeMarks.value = projectExactEdgeMarks(
    snapExactEdgeMatches,
    {
      startTime: props.view.startTime,
      endTime: props.view.endTime,
      scrollY: props.view.scrollY,
    },
    w,
    viewportH > 0 ? viewportH : Infinity,
  );
}

/** Project exact-match event-edge marks at one time point (null → none). */
function exactMarksAtTime(time: number | null) {
  if (time == null) return [];
  const w = syncTrackWidth();
  if (w <= 0) return [];
  const viewportH = wrapRef.value?.clientHeight || 0;
  return projectExactEdgeMarks(
    exactMatchesAt(time),
    {
      startTime: props.view.startTime,
      endTime: props.view.endTime,
      scrollY: props.view.scrollY,
    },
    w,
    viewportH > 0 ? viewportH : Infinity,
  );
}

function invalidateExactMatchCache(): void {
  lastExactScanTime = null;
  lastExactScanMatches = [];
}

function exactMatchesAt(time: number): ExactEdgeMatch[] {
  if (time === lastExactScanTime) return lastExactScanMatches;
  lastExactScanTime = time;
  lastExactScanMatches = findExactEdgeMatchesAt(backend.getLayout(), time);
  return lastExactScanMatches;
}

function ensureAttach(): void {
  if (attached) return;
  if (useWebGl.value) {
    const gl = glCanvasRef.value;
    const ov = overlayCanvasRef.value;
    if (!gl || !ov) return;
    const glBackend = new WebGlSwimlaneRenderer();
    if (glBackend.attach(gl)) {
      backend = glBackend;
      overlay.attach(ov);
      attached = true;
      zeroBackingStores();
      return;
    }
    // Probe passed but real attach failed — remount Canvas fallback next tick.
    useWebGl.value = false;
    return;
  }
  const fb = fallbackCanvasRef.value;
  if (!fb) return;
  backend = new CanvasSwimlaneRenderer();
  backend.attach(fb);
  attached = true;
  zeroBackingStores();
}

/**
 * Apply CSS layout bookkeeping always; apply device buffer + paint only after
 * ResizeObserver delivers a positive device-pixel box (no HTML 300×150 / css×dpr default).
 */
function resize(entries: ResizeObserverEntry[] | null = null): void {
  const wrap = wrapRef.value;
  if (!wrap) return;

  const contentH = modelContentHeight();
  const w = syncTrackWidth();
  const viewH = wrap.clientHeight || 0;
  sizerHeight.value = Math.max(contentH, viewH);
  const h = Math.max(1, viewH || lastH || contentH);
  const dpr = currentDpr();

  ensureAttach();
  if (!attached) return;

  let deviceW = lastDeviceW;
  let deviceH = lastDeviceH;
  if (entries && entries.length > 0) {
    const box = readDeviceBoxFromRo(entries, w, h, dpr);
    if (!box) return;
    deviceW = box.deviceW;
    deviceH = box.deviceH;
  } else if (lastDeviceW < 1 || lastDeviceH < 1) {
    // Wait for ResizeObserver — do not invent a buffer size.
    return;
  }

  const sizeChanged =
    w !== lastW ||
    h !== lastH ||
    deviceW !== lastDeviceW ||
    deviceH !== lastDeviceH ||
    dpr !== lastDpr;
  if (sizeChanged) {
    lastW = w;
    lastH = h;
    lastDeviceW = deviceW;
    lastDeviceH = deviceH;
    lastDpr = dpr;
    resizeTick.value += 1;
    backend.resize(deviceW, deviceH, dpr);
    if (useWebGl.value) overlay.resize(deviceW, deviceH, dpr);
  }
  applyViewState();
  if (sizeChanged) flushPaint();
  else schedulePaint();
  const maxY = maxScrollY();
  if (localScrollY > maxY) {
    localScrollY = maxY;
    emit('scroll-y', localScrollY);
  }
}

function bindResizeObserver(): void {
  resizeObserver?.disconnect();
  resizeObserver = null;
  const main = mainCanvasEl();
  if (!main || typeof ResizeObserver === 'undefined') return;
  resizeObserver = new ResizeObserver((entries) => resize(entries));
  try {
    resizeObserver.observe(main, { box: 'device-pixel-content-box' });
  } catch {
    resizeObserver.observe(main);
  }
}

onMounted(async () => {
  await nextTick();
  ensureAttach();
  if (!attached) {
    useWebGl.value = false;
    await nextTick();
    ensureAttach();
  }
  // Strip shares session with body — only body/solo owns window Alt/Esc listeners.
  if (props.altMeasureRole !== 'strip') {
    window.addEventListener('keydown', onWindowKeyDown);
    window.addEventListener('keyup', onWindowKeyUp);
  }
  window.addEventListener('keydown', onMarqueeKeydown);
  bindResizeObserver();
});

onBeforeUnmount(() => {
  if (props.altMeasureRole !== 'strip') {
    window.removeEventListener('keydown', onWindowKeyDown);
    window.removeEventListener('keyup', onWindowKeyUp);
  }
  cancelMeasureSnapAnim();
  endMeasureCreate();
  endMeasureResize();
  endMarquee();
  window.removeEventListener('keydown', onMarqueeKeydown);
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
  () => props.measureMode,
  (on) => {
    if (on) clearAltMeasure();
  },
);

watch(
  () => [props.view, props.selectedEventId, props.hoveredEventId, props.searchQuery, props.dependencyMode, props.dependencyDepth, props.showDependencies, props.multiSelectedIds],
  () => {
    localScrollY = props.view.scrollY;
    sync();
  },
  { deep: true },
);

/** Refresh snap marks + hover gap when the window moves (zoom / pan / scroll). */
watch(
  [() => props.view.startTime, () => props.view.endTime, () => props.view.scrollY],
  () => {
    // Pinned measure dismisses on any visible-range change; ephemeral keeps tracking.
    if (altMeasure.pinned) clearAltMeasure();
    refreshSnapExactEdgeMarks();
    refreshHoverGapAtLastPointer();
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
  suppressMeasurePreview.value = false;
  hoveredMeasureEdge = null;
  endMeasureResize();
}

function endMeasureResize(): void {
  unbindResizeDrag?.();
  unbindResizeDrag = null;
  resizeEdge = null;
  resizingBorder.value = null;
  suppressMeasurePreview.value = false;
}

function endMeasureCreate(): void {
  unbindCreateDrag?.();
  unbindCreateDrag = null;
  measureAnchorTime = null;
  measureGestureActive = false;
  measureCreatePending = false;
  measurePressActive = false;
  suppressMeasurePreview.value = false;
}

/** Drop the marquee gesture without committing (Escape, unmount, pointerup). */
function endMarquee(): void {
  unbindMarqueeDrag?.();
  unbindMarqueeDrag = null;
  marqueeAnchor = null;
  marqueePending = false;
  marqueePressActive = false;
  if (marqueeRect.value) emit('multi-select-span', null);
  marqueeRect.value = null;
}

/** Marquee time extent — the live Δt the axis chrome shows while dragging. */
function marqueeSpan(rect: MarqueeRect): MeasureRange {
  return normalizeMeasureRange(timeAtX(rect.x0), timeAtX(rect.x1));
}

function onMarqueeDragMove(clientX: number, clientY: number): void {
  const local = localFromClient(clientX, clientY);
  if (!local || !marqueeAnchor) return;
  if (marqueePending) {
    if (
      Math.abs(local.x - marqueeAnchor.x) <= MEASURE_DRAG_THRESHOLD_PX &&
      Math.abs(local.y - marqueeAnchor.y) <= MEASURE_DRAG_THRESHOLD_PX
    ) {
      return;
    }
    marqueePending = false;
  }
  const rect = {
    x0: marqueeAnchor.x,
    y0: marqueeAnchor.y,
    x1: local.x,
    y1: local.y,
  };
  marqueeRect.value = rect;
  emit('multi-select-span', marqueeSpan(rect));
  schedulePaint();
}

/**
 * Commit on pointerup: every leaf event intersecting the rect. A cancelled rect (or a
 * press that never crossed the 4px gate — that is a click) commits nothing.
 */
function onMarqueeDragEnd(): void {
  unbindMarqueeDrag?.();
  unbindMarqueeDrag = null;
  const rect = marqueeRect.value;
  marqueeAnchor = null;
  marqueePending = false;
  // Canvas `pointerup` bubbles to window first, so the flag is still set when it
  // decides whether to select — clear it only here, once the gesture is truly over.
  marqueePressActive = false;
  marqueeRect.value = null;
  if (!rect) return;
  const w = wrapRef.value?.clientWidth ?? 0;
  const events = eventsIntersectingRect(backend.getLayout(), props.view, w, rect).map(
    (item) => item.event,
  );
  // The root swaps the live drag span for the committed hull (or clears it on an empty commit).
  emit('multi-select-span', null);
  emit('multi-select', events);
}

function beginMarquee(localX: number, localY: number): void {
  endMeasureCreate();
  endMeasureResize();
  endMarquee();
  marqueeAnchor = { x: localX, y: localY };
  marqueePending = true;
  marqueePressActive = true;
  unbindMarqueeDrag = bindWindowPointerDrag({
    onMove: onMarqueeDragMove,
    onEnd: onMarqueeDragEnd,
  });
}

/** Escape during the drag cancels without committing; the press flag survives until pointerup. */
function onMarqueeKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || !marqueePressActive) return;
  unbindMarqueeDrag?.();
  unbindMarqueeDrag = null;
  marqueeAnchor = null;
  // Stay non-pending so the release is not mistaken for a click-select.
  marqueePending = false;
  if (marqueeRect.value) emit('multi-select-span', null);
  marqueeRect.value = null;
  schedulePaint();
}

function beginMeasureCreateFromDown(): void {
  if (!wrapRef.value || measureGestureActive) return;
  cancelMeasureSnapAnim();
  const rect = wrapRef.value.getBoundingClientRect();
  measureCreatePending = false;
  measureGestureActive = true;
  measureDragOccurred = true;
  suppressMeasurePreview.value = true;
  const mag =
    magnetizeAtClient(downX, lastPointerClientY) ?? {
      time: timeAtX(downX - rect.left),
      xPx: downX - rect.left,
      xRatio: 0,
      eventId: null,
    };
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
    suppressMeasurePreview.value = false;
    refreshMeasureExactEdgeMarks(true);
  }
}

function emitResizedRange(clientX: number, clientY: number) {
  if (!resizeEdge || !wrapRef.value) return;
  lastPointerClientY = clientY;
  const rect = wrapRef.value.getBoundingClientRect();
  const mag =
    magnetizeAtClient(clientX, clientY) ?? {
      time: timeAtX(clientX - rect.left),
      xPx: clientX - rect.left,
      xRatio: 0,
      eventId: null,
    };
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
  const snapped = mag.eventId != null;
  emit('cursor', {
    time: edgeTime,
    xRatio: Math.min(1, Math.max(0, xRatio)),
    snapped,
  });
}

function emitCreateRange(clientX: number, clientY: number) {
  if (!measureGestureActive || measureAnchorTime == null || !wrapRef.value) return;
  lastPointerClientY = clientY;
  const mag =
    magnetizeAtClient(clientX, clientY) ?? {
      time: timeAtX(clientX - wrapRef.value.getBoundingClientRect().left),
      xPx: 0,
      xRatio: 0,
      eventId: null,
    };
  emit('update:measureRange', normalizeMeasureRange(measureAnchorTime, mag.time));
  emit('cursor', { time: mag.time, xRatio: mag.xRatio, snapped: mag.eventId != null });
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

/** True when a time exactly matches a visible event start/end. */
function isTimeOnEventEdge(time: number): boolean {
  return exactMatchesAt(time).length > 0;
}

/** Stick playhead cursor to a measure edge while the hit pad owns the pointer. */
function emitCursorAtMeasureEdge(edge: MeasureResizeEdge, snapped?: boolean) {
  const geo = measureGeometry.value;
  const range = props.measureRange;
  if (!geo || !range || !wrapRef.value) return;
  const w = syncTrackWidth();
  const start = Math.min(range.startTime, range.endTime);
  const end = Math.max(range.startTime, range.endTime);
  const x = edge === 'left' ? geo.left : geo.right;
  const time =
    edge === 'left'
      ? Math.max(props.view.startTime, start)
      : Math.min(props.view.endTime, end);
  emit('cursor', {
    time,
    xRatio: x / w,
    ...(snapped !== undefined ? { snapped } : {}),
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
  const edgeTime = edge === 'left' ? start : end;
  const snapped = isTimeOnEventEdge(edgeTime);
  resizingBorder.value = edge;
  emitCursorAtMeasureEdge(edge, snapped);
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
  const range = props.measureRange;
  if (!range) {
    emitCursorAtMeasureEdge(edge);
    return;
  }
  const start = Math.min(range.startTime, range.endTime);
  const end = Math.max(range.startTime, range.endTime);
  const edgeTime = edge === 'left' ? start : end;
  emitCursorAtMeasureEdge(edge, isTimeOnEventEdge(edgeTime));
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
    invalidateExactMatchCache();
    snapExactEdgeMatches = [];
    snapExactEdgeMarks.value = [];
    return { time: timeAtX(localX), xPx: localX, xRatio: localX / w, eventId: null };
  }
  snapExactEdgeMatches = exactMatchesAt(hit.time);
  refreshSnapExactEdgeMarks();
  return { time: hit.time, xPx: hit.xPx, xRatio: hit.xPx / w, eventId: hit.eventId };
}

/** Hover/select target: magnetized edge event wins, else spatial hitTest (device px). */
function eventAtPointer(localX: number, localY: number, magnetEventId: string | null) {
  if (magnetEventId) {
    const ev = backend.findEvent(magnetEventId);
    if (ev) return ev;
  }
  const dpr = currentDpr();
  const id = backend.hitTest(localX * dpr, localY * dpr);
  return id ? backend.findEvent(id) : null;
}

function localFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
  const target = activeCanvas() ?? wrapRef.value;
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/** Local magnet only — used by SwimlaneView router (avoids override recursion). */
function magnetizeAtClientLocal(clientX: number, clientY: number) {
  const local = localFromClient(clientX, clientY);
  if (!local) {
    invalidateExactMatchCache();
    snapExactEdgeMatches = [];
    snapExactEdgeMarks.value = [];
    return null;
  }
  return magnetizeLocal(local.x, local.y);
}

/** Window-level measure drag / axis — optional parent override for cross-canvas magnet. */
function magnetizeAtClient(clientX: number, clientY: number) {
  if (props.resolveMagnetize) return props.resolveMagnetize(clientX, clientY);
  return magnetizeAtClientLocal(clientX, clientY);
}

function clearEdgeSnapHighlight() {
  invalidateExactMatchCache();
  snapExactEdgeMatches = [];
  snapExactEdgeMarks.value = [];
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

/** Default-mode hover gap measure: sticks + Δt arrow between two adjacent events. */
const gapMeasureGeometry = computed(() => {
  void resizeTick.value;
  const gap = hoverGap.value;
  if (props.measureMode || !gap || !props.model) return null;
  const viewStart = props.view.startTime;
  const viewEnd = props.view.endTime;
  const w = syncTrackWidth();

  const leftEnd = gap.leftEnd;
  const rightStart = gap.rightStart;
  if (!(rightStart > leftEnd)) return null;
  // Gap fully outside the view on one side — nothing to show.
  if (rightStart <= viewStart || leftEnd >= viewEnd) return null;

  const showLeft = leftEnd >= viewStart && leftEnd <= viewEnd;
  const showRight = rightStart >= viewStart && rightStart <= viewEnd;
  const visStart = Math.max(viewStart, leftEnd);
  const visEnd = Math.min(viewEnd, rightStart);
  if (!(visEnd > visStart)) return null;

  const left = xAtTime(leftEnd);
  const right = xAtTime(rightStart);
  const arrowLeft = xAtTime(visStart);
  const arrowRight = xAtTime(visEnd);

  const label = formatTimeAuto(rightStart - leftEnd);
  const top = gap.laneY - props.view.scrollY;

  const leftPct = (arrowLeft / w) * 100;
  const widthPct = ((arrowRight - arrowLeft) / w) * 100;
  const style = { left: `${leftPct}%`, width: `${widthPct}%` };
  const rangePx = arrowRight - arrowLeft;
  if (!measureLabelFitsInlineSpan(rangePx, label)) return null;

  return {
    left,
    right,
    top,
    height: LANE_HEIGHT,
    label,
    showLeft,
    showRight,
    arrowLayout: { mode: 'inline' as const, side: 'right' as const, style },
  };
});

/** CSS-pixel screen rect for an event (renderers report device-pixel rects scaled by dpr). */
function eventScreenRectCss(eventId: string): { x: number; y: number; w: number; h: number } | null {
  const rect = backend.eventScreenRect(eventId);
  if (!rect) return null;
  const dpr = currentDpr();
  return { x: rect.x / dpr, y: rect.y / dpr, w: rect.w / dpr, h: rect.h / dpr };
}

/** Normalized marquee rect in canvas px (null until the 4px threshold is crossed). */
const marqueeGeometry = computed(() => {
  const r = marqueeRect.value;
  if (!r) return null;
  return {
    left: Math.min(r.x0, r.x1),
    top: Math.min(r.y0, r.y1),
    width: Math.abs(r.x1 - r.x0),
    height: Math.abs(r.y1 - r.y0),
  };
});

/** Alt-measure anchor highlight while session active. */
const altMeasureAnchorHighlight = computed(() => {
  void resizeTick.value;
  // Track the view window so the highlight stays glued to the anchored event on scroll/pan/zoom.
  void props.view.startTime;
  void props.view.endTime;
  void props.view.scrollY;
  if (!altMeasureSessionActive() || !altMeasure.anchorId) return null;
  if (!ownsAltMeasureEndpoint(altMeasure.anchorId, altMeasure.anchorSurface)) return null;
  return eventScreenRectCss(altMeasure.anchorId);
});

/** Alt-measure target highlight while a non-anchor event is captured as target. */
const altMeasureTargetHighlight = computed(() => {
  void resizeTick.value;
  void props.view.startTime;
  void props.view.endTime;
  void props.view.scrollY;
  if (!altMeasureSessionActive()) return null;
  const target = altMeasure.target;
  if (!target || target.eventId === null || target.eventId === altMeasure.anchorId) return null;
  if (!ownsAltMeasureEndpoint(target.eventId, target.surface)) return null;
  // Touching / inside (Δt = 0) → overlay hidden; show anchor highlight only.
  const anchorEvent = altMeasure.anchorId ? findAltMeasureEvent(altMeasure.anchorId) : null;
  if (!anchorEvent || !computeAltMeasureDelta(anchorEvent, target.time)) return null;
  return eventScreenRectCss(target.eventId);
});

function thisAltMeasureSurface(): AltMeasureSurface {
  return props.altMeasureRole;
}

/**
 * True when this canvas should draw overlays for an endpoint — based on the surface
 * recorded at capture time (pinned strip vs body), not merely whether the lane is pinned.
 */
function ownsAltMeasureEndpoint(
  eventId: string | null,
  surface: AltMeasureSurface | null,
): boolean {
  if (surface == null || surface !== thisAltMeasureSurface()) return false;
  if (eventId != null && !backend.getLayout().eventsById.has(eventId)) return false;
  return true;
}

/** Alt measure overlay (default mode): anchor → event edge or free cursor; may be pinned. */
const altEventMeasureGeometry = computed(() => {
  void resizeTick.value;
  if (!altMeasureSessionActive() || !props.model) return null;
  const anchorId = altMeasure.anchorId;
  const target = altMeasure.target;
  if (!anchorId || !target) return null;

  const anchorEvent = findAltMeasureEvent(anchorId);
  if (!anchorEvent) return null;
  const times = computeAltMeasureDelta(anchorEvent, target.time);
  if (!times) return null;

  const layout = backend.getLayout();
  const ownsAnchor = ownsAltMeasureEndpoint(anchorId, altMeasure.anchorSurface);
  const ownsTargetEv =
    target.eventId != null && ownsAltMeasureEndpoint(target.eventId, target.surface);
  const freeCursor = target.eventId === null;

  const viewStart = props.view.startTime;
  const viewEnd = props.view.endTime;
  const w = syncTrackWidth();
  const { gapStartTime, gapEndTime, anchorRefTime, deltaNs } = times;

  if (gapEndTime <= viewStart || gapStartTime >= viewEnd) return null;

  const showLeft = gapStartTime >= viewStart && gapStartTime <= viewEnd;
  const showRight = gapEndTime >= viewStart && gapEndTime <= viewEnd;
  const visStart = Math.max(viewStart, gapStartTime);
  const visEnd = Math.min(viewEnd, gapEndTime);
  if (!(visEnd > visStart)) return null;

  const left = xAtTime(gapStartTime);
  const right = xAtTime(gapEndTime);
  const arrowLeft = xAtTime(visStart);
  const arrowRight = xAtTime(visEnd);
  const label = formatTimeAuto(deltaNs);
  const rangePx = arrowRight - arrowLeft;
  const leftPct = (arrowLeft / w) * 100;
  const widthPct = ((arrowRight - arrowLeft) / w) * 100;
  const style = { left: `${leftPct}%`, width: `${widthPct}%` };
  const arrowMode = measureLabelFitsInlineSpan(rangePx, label) ? ('inline' as const) : ('outside' as const);
  const arrowLayout = { mode: arrowMode, side: 'right' as const, style };

  // Free cursor: every surface paints the full-height line; stick + Δt stay on the anchor owner.
  if (freeCursor) {
    let showAnchor = false;
    let anchorLaneTop = 0;
    let showDt = false;
    if (ownsAnchor && layout.eventsById.has(anchorId)) {
      const gap = computeAltMeasureGap(layout, anchorId, target.time, null);
      if (gap) {
        showDt = true;
        anchorLaneTop = gap.leftLaneY - props.view.scrollY;
        showAnchor = gap.anchorRefTime >= viewStart && gap.anchorRefTime <= viewEnd;
      }
    }
    return {
      mode: 'cursor' as const,
      anchorLaneTop,
      anchorX: xAtTime(anchorRefTime),
      cursorX: xAtTime(target.time),
      showAnchor,
      showDt,
      label,
      showLeft,
      showRight,
      arrowLayout,
    };
  }

  // Full overlay only when every event endpoint this measure needs is owned here.
  const canFull =
    ownsAnchor &&
    ownsTargetEv &&
    layout.eventsById.has(anchorId) &&
    target.eventId != null &&
    layout.eventsById.has(target.eventId);

  if (canFull) {
    const gap = computeAltMeasureGap(layout, anchorId, target.time, target.eventId);
    if (!gap) return null;

    if (gap.sameLane) {
      const top = gap.leftLaneY - props.view.scrollY;
      return {
        mode: 'same' as const,
        top,
        height: LANE_HEIGHT,
        left,
        right,
        label,
        showLeft,
        showRight,
        arrowLayout,
      };
    }

    const leftLaneTop = gap.leftLaneY - props.view.scrollY;
    const rightLaneTop = gap.rightLaneY - props.view.scrollY;
    const laneCenterY = (y: number) => y + LANE_HEIGHT / 2;
    const vertX = right;

    return {
      mode: 'cross' as const,
      top: Math.min(leftLaneTop, rightLaneTop),
      height: Math.abs(rightLaneTop - leftLaneTop) + LANE_HEIGHT,
      left,
      right,
      label,
      showLeft,
      showRight,
      arrowLayout,
      crossLane: {
        leftLaneTop,
        rightLaneTop,
        vertX,
        leftCenterY: laneCenterY(leftLaneTop),
        rightCenterY: laneCenterY(rightLaneTop),
        horizLeftStart: left,
        horizLeftEnd: vertX,
        horizRightStart: vertX,
        horizRightEnd: right,
        horizRightY: laneCenterY(rightLaneTop),
      },
    };
  }

  // Split across surfaces: draw local stick (+ Δt when this surface owns the earlier edge).
  const ownsEarlier =
    (anchorRefTime <= target.time && ownsAnchor) ||
    (anchorRefTime > target.time && ownsTargetEv);
  const localEventId = ownsAnchor ? anchorId : ownsTargetEv ? target.eventId : null;
  if (!localEventId) return null;
  const localItem = layout.eventsById.get(localEventId);
  if (!localItem) return null;

  const stickTime = ownsAnchor ? anchorRefTime : target.time;
  const showStick = stickTime >= viewStart && stickTime <= viewEnd;

  return {
    mode: 'split' as const,
    top: localItem.y - props.view.scrollY,
    height: LANE_HEIGHT,
    left,
    right,
    stickX: xAtTime(stickTime),
    vertX: right,
    stickTime,
    showStick,
    showArrow: ownsEarlier,
    showHoriz:
      showStick && ownsEarlier && Math.abs(xAtTime(stickTime) - right) > 0.5,
    label,
    showLeft,
    showRight,
    arrowLayout,
  };
});

/** Client-space endpoint for SwimlaneView's pin↔body vertical bridge. */
function altMeasureBridgeEndpoint(): { clientX: number; clientY: number; time: number } | null {
  const g = altEventMeasureGeometry.value;
  // Keep the bridge when an edge is time-clipped (showStick false); stack clips overflow.
  if (!g || g.mode !== 'split' || !('stickX' in g)) return null;
  const wrap = wrapRef.value;
  if (!wrap) return null;
  const r = wrap.getBoundingClientRect();
  return {
    clientX: r.left + g.vertX,
    clientY: r.top + g.top + g.height / 2,
    time: g.stickTime,
  };
}

function activeCanvas(): HTMLCanvasElement | null {
  return useWebGl.value ? overlayCanvasRef.value : fallbackCanvasRef.value;
}

function onPointerDown(e: PointerEvent): void {
  downX = e.clientX;
  lastPointerClientY = e.clientY;
  measureDragOccurred = false;
  // Measure mode owns the unmodified drag; otherwise it starts a marquee.
  if (props.measureMode && activeCanvas()) {
    endMarquee();
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
    const local = localFromClient(e.clientX, e.clientY);
    if (local) beginMarquee(local.x, local.y);
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
  lastPointerClientY = e.clientY;

  // Marquee owns the press: no magnet, no cursor move, no tooltip (spec: suppress hover).
  if (marqueePressActive && !marqueePending) {
    emit('hover', null, e.clientX, e.clientY);
    return;
  }

  schedulePaint();
  const mag = magnetizeLocal(x, y);
  emit('cursor', { time: mag.time, xRatio: mag.xRatio, snapped: mag.eventId != null });

  if (dragging) {
    // Measure create is driven by window listeners (release over Card strips still ends).
    if (measureGestureActive || measureCreatePending || measurePressActive) {
      hoverGap.value = null;
      emit('hover', null, e.clientX, e.clientY);
      emitLaneHover(null);
      return;
    }
    const span = Math.max(1, props.view.endTime - props.view.startTime);
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    emit('pan', -(dx / w) * span);
    hoverGap.value = altMeasureSessionActive() ? null : panCaptureHoverGap;
    emit('hover', panCaptureHoverEvent, e.clientX, e.clientY);
    emitLaneHover(y);
    return;
  }

  // Sync modifier every move: missed Alt keyup (Alt+Tab / blur) must not leave ephemeral retargeting active.
  altMeasure.altKeyHeld = e.altKey;
  if (!e.altKey && !altMeasure.pinned && altMeasure.anchorId) clearAltMeasure();

  // Live target preview only while ephemeral (Alt held, not pinned).
  if (
    altMeasure.anchorId &&
    altMeasure.altKeyHeld &&
    !altMeasure.pinned &&
    !props.measureMode
  ) {
    hoverGap.value = null;
    const surface = thisAltMeasureSurface();
    const anchorEvent = findAltMeasureEvent(altMeasure.anchorId);
    if (mag.eventId && mag.eventId !== altMeasure.anchorId) {
      // Stuck to a border → explicit target edge.
      altMeasure.target = { eventId: mag.eventId, time: mag.time, surface };
    } else {
      const ev = eventAtPointer(x, y, null);
      if (ev && ev.id !== altMeasure.anchorId && anchorEvent) {
        // Hovering another event → auto edge by relation.
        const t = eventMeasureTargetTime(anchorEvent, ev);
        altMeasure.target = t != null ? { eventId: ev.id, time: t, surface } : null;
      } else {
        // Otherwise → free cursor target.
        altMeasure.target = { eventId: null, time: timeAtX(x), surface };
      }
    }
    // Keep normal event hover (tooltip); only the gap overlay stays suppressed.
    emit('hover', eventAtPointer(x, y, mag.eventId), e.clientX, e.clientY);
    emitLaneHover(y);
    return;
  }

  // Default-mode hover gap measure: free middle between adjacent events on the lane.
  updateHoverGap(x, y, w);

  emit('hover', eventAtPointer(x, y, mag.eventId), e.clientX, e.clientY);
  emitLaneHover(y);
}

function onPointerUp(e: PointerEvent): void {
  // A marquee that crossed the 4px gate (or was cancelled) never selects; the window
  // pointerup that follows commits it. A press still pending is a plain click.
  if (marqueePressActive && !marqueePending) return;
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
  const w = Math.max(1, rect.width);
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
  updateHoverGap(x, y, w);
  emit('hover', eventAtPointer(x, y, mag.eventId), e.clientX, e.clientY);
  if (Math.abs(e.clientX - downX) > MEASURE_DRAG_THRESHOLD_PX) return;

  if (e.altKey && !props.measureMode) {
    altMeasure.altKeyHeld = true;
    const ev = eventAtPointer(x, y, mag.eventId);
    const surface = thisAltMeasureSurface();
    if (!ev) {
      clearAltMeasure();
      return;
    }
    // Pinned: any Alt+click event becomes the new ephemeral anchor on this surface.
    if (altMeasure.pinned) {
      altMeasure.anchorId = ev.id;
      altMeasure.anchorSurface = surface;
      altMeasure.target = null;
      altMeasure.pinned = false;
      return;
    }
    // Ephemeral, no anchor yet → set anchor on this surface.
    if (!altMeasure.anchorId) {
      altMeasure.anchorId = ev.id;
      altMeasure.anchorSurface = surface;
      altMeasure.target = null;
      return;
    }
    // Ephemeral + same event on the same surface → no-op.
    if (altMeasure.anchorId === ev.id && altMeasure.anchorSurface === surface) return;
    // Same event id on the other surface → move the anchor here (instance switch).
    if (altMeasure.anchorId === ev.id) {
      altMeasure.anchorSurface = surface;
      altMeasure.target = null;
      return;
    }
    // Ephemeral + different event → pin with click-time target resolution.
    const anchorEvent = findAltMeasureEvent(altMeasure.anchorId);
    let nextTarget: AltMeasureTarget | null = null;
    if (mag.eventId === ev.id) {
      nextTarget = { eventId: ev.id, time: mag.time, surface };
    } else if (anchorEvent) {
      const t = eventMeasureTargetTime(anchorEvent, ev);
      nextTarget = t != null ? { eventId: ev.id, time: t, surface } : null;
    }
    if (!nextTarget) return;
    // Touching / inside (Δt = 0) cannot pin — leave ephemeral session unchanged.
    if (!anchorEvent || !computeAltMeasureDelta(anchorEvent, nextTarget.time)) return;
    altMeasure.target = nextTarget;
    altMeasure.pinned = true;
    return;
  }

  // Non-Alt click elsewhere clears a pinned (or lingering) Alt measure.
  if (altMeasure.pinned || altMeasure.anchorId) clearAltMeasure();
  emit('select', eventAtPointer(x, y, mag.eventId));
}

function onPointerLeave(e: PointerEvent): void {
  // Marquee is window-bound (like measure create): leaving the canvas keeps the rect alive.
  if (marqueePressActive && !marqueePending) {
    schedulePaint();
    snapExactEdgeMatches = [];
    snapExactEdgeMarks.value = [];
    emit('cursor', null);
    emit('hover', null, 0, 0);
    return;
  }
  // Keep measure drag alive under pointer capture; clear anchor only on pointerup / cancel.
  if (measureGestureActive || measureCreatePending || measurePressActive) {
    schedulePaint();
    snapExactEdgeMatches = [];
    snapExactEdgeMarks.value = [];
    emit('cursor', null);
    emit('hover', null, 0, 0);
    emitLaneHover(null);
    return;
  }
  // Measure borders sit above the canvas; they stick the cursor — do not clear on the way there.
  if (isMeasureBorderEl(e.relatedTarget)) {
    schedulePaint();
    emit('hover', null, 0, 0);
    emitLaneHover(null);
    return;
  }
  measureAnchorTime = null;
  invalidateExactMatchCache();
  snapExactEdgeMatches = [];
  snapExactEdgeMarks.value = [];
  lastHoverLocalX = null;
  lastHoverLocalY = null;
  hoverGap.value = null;
  // Shared strip↔body session: leave on one canvas must not blank the sibling's target mid-crossing.
  // Solo keeps clearing ephemeral live preview on leave.
  if (!altMeasure.pinned && props.altMeasureRole === 'solo') altMeasure.target = null;
  schedulePaint();
  emit('cursor', null);
  emit('hover', null, 0, 0);
  emitLaneHover(null);
}

/**
 * Wheel: Ctrl/Cmd zooms, Shift+wheel and two-finger horizontal trackpad scroll pan time
 * (drag is the marquee now), everything else scrolls lanes.
 */
function onWheel(e: WheelEvent): void {
  e.preventDefault();
  const target = activeCanvas();
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (!props.measureMode) {
    lastHoverLocalX = x;
    lastHoverLocalY = y;
  }
  if (e.ctrlKey || e.metaKey) {
    const mag = magnetizeLocal(x, y);
    const anchor = stuckMeasureEdgeTime() ?? mag.time;
    emit('zoom', e.deltaY > 0 ? 1 / 1.15 : 1.15, anchor);
    return;
  }
  // Trackpads report horizontal intent as deltaX; a mouse wheel needs Shift. Take the
  // dominant axis so the incidental deltaX on a vertical two-finger scroll still scrolls lanes.
  const panPx =
    Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
  if (panPx !== 0) {
    const span = Math.max(1, props.view.endTime - props.view.startTime);
    const w = Math.max(1, rect.width);
    emit('pan', (panPx / w) * span);
    return;
  }
  localScrollY = clampScrollY(localScrollY + e.deltaY);
  emit('scroll-y', localScrollY);
}

defineExpose({
  eventScreenRect: (id: string) => backend.eventScreenRect(id),
  renderer: () => backend,
  useWebGl,
  /** Card strips sit above the canvas; SwimlaneView forwards wheel here. */
  handleWheel: onWheel,
  magnetizeAtClient,
  magnetizeAtClientLocal,
  clearEdgeSnapHighlight,
  clearAltMeasure,
  altMeasureBridgeEndpoint,
});
</script>

<template>
  <div
    ref="wrapRef"
    class="pr-swim-canvas-wrap"
    data-testid="swimlane"
    :class="{
      'pr-swim-canvas-wrap--measure': measureMode,
      'pr-swim-canvas-wrap--over-event': hoveredEventId != null,
    }"
    :data-renderer="useWebGl ? 'webgl' : 'canvas'"
  >
    <div
      class="pr-swim-canvas-sizer"
      aria-hidden="true"
      :style="{ height: `${sizerHeight}px` }"
    />
    <template v-if="useWebGl">
      <canvas
        ref="glCanvasRef"
        class="pr-swim-canvas pr-swim-canvas--gl"
        data-testid="swimlane-webgl"
        width="0"
        height="0"
      />
      <canvas
        ref="overlayCanvasRef"
        class="pr-swim-canvas pr-swim-canvas--overlay"
        data-testid="swimlane-canvas"
        width="0"
        height="0"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="onPointerLeave"
        @wheel="onWheel"
      />
    </template>
    <canvas
      v-else
      ref="fallbackCanvasRef"
      class="pr-swim-canvas"
      data-testid="swimlane-canvas"
      width="0"
      height="0"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerLeave"
      @wheel="onWheel"
    />
    <div
      v-if="cursorXRatio != null"
      class="pr-swim-cursor"
      :class="{ 'pr-swim-cursor--snapped': cursorSnapped }"
      data-testid="swim-cursor"
      :style="{ left: `${cursorXRatio * 100}%` }"
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
        :class="{
          'pr-measure-border--dragging': resizingBorder === 'left',
        }"
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
        :class="{
          'pr-measure-border--dragging': resizingBorder === 'right',
        }"
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
      v-for="(mark, i) in snapExactEdgeMarks"
      :key="`snap-${mark.eventId}-${mark.edge}-${i}`"
      class="pr-measure-edge-mark pr-measure-edge-mark--snap"
      data-testid="measure-edge-snap"
      :style="{
        left: `${mark.x}px`,
        top: `${mark.y}px`,
        height: `${mark.h}px`,
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
    <div
      v-if="gapMeasureGeometry"
      class="pr-gap-measure"
      data-testid="gap-measure"
      :style="{
        top: `${gapMeasureGeometry.top}px`,
        height: `${gapMeasureGeometry.height}px`,
      }"
    >
      <div
        v-if="gapMeasureGeometry.showLeft"
        class="pr-gap-measure__stick pr-gap-measure__stick--left"
        data-testid="gap-measure-stick-left"
        :style="{ left: `${gapMeasureGeometry.left}px` }"
      />
      <div
        v-if="gapMeasureGeometry.showRight"
        class="pr-gap-measure__stick pr-gap-measure__stick--right"
        data-testid="gap-measure-stick-right"
        :style="{ left: `${gapMeasureGeometry.right}px` }"
      />
      <MeasureDtArrow
        :label="gapMeasureGeometry.label"
        :style="gapMeasureGeometry.arrowLayout.style"
        :mode="gapMeasureGeometry.arrowLayout.mode"
        :side="gapMeasureGeometry.arrowLayout.side"
        :show-left-head="gapMeasureGeometry.showLeft"
        :show-right-head="gapMeasureGeometry.showRight"
      />
    </div>
    <div
      v-if="altMeasureAnchorHighlight"
      class="pr-alt-measure-anchor"
      data-testid="alt-measure-anchor"
      :style="{
        left: `${altMeasureAnchorHighlight.x}px`,
        top: `${altMeasureAnchorHighlight.y}px`,
        width: `${altMeasureAnchorHighlight.w}px`,
        height: `${altMeasureAnchorHighlight.h}px`,
      }"
    />
    <div
      v-if="altMeasureTargetHighlight"
      class="pr-alt-measure-anchor"
      :class="{ 'pr-alt-measure-anchor--target': !altMeasure.pinned }"
      data-testid="alt-measure-target"
      :style="{
        left: `${altMeasureTargetHighlight.x}px`,
        top: `${altMeasureTargetHighlight.y}px`,
        width: `${altMeasureTargetHighlight.w}px`,
        height: `${altMeasureTargetHighlight.h}px`,
      }"
    />
    <template v-if="altEventMeasureGeometry">
      <div
        v-if="altEventMeasureGeometry.mode === 'same'"
        class="pr-gap-measure pr-alt-measure"
        data-testid="alt-event-measure"
        :style="{
          top: `${altEventMeasureGeometry.top}px`,
          height: `${altEventMeasureGeometry.height}px`,
        }"
      >
        <div
          v-if="altEventMeasureGeometry.showLeft"
          class="pr-gap-measure__stick pr-gap-measure__stick--left"
          data-testid="alt-measure-stick-left"
          :style="{ left: `${altEventMeasureGeometry.left}px` }"
        />
        <div
          v-if="altEventMeasureGeometry.showRight"
          class="pr-gap-measure__stick pr-gap-measure__stick--right"
          data-testid="alt-measure-stick-right"
          :style="{ left: `${altEventMeasureGeometry.right}px` }"
        />
        <MeasureDtArrow
          :label="altEventMeasureGeometry.label"
          :style="altEventMeasureGeometry.arrowLayout.style"
          :mode="altEventMeasureGeometry.arrowLayout.mode"
          :side="altEventMeasureGeometry.arrowLayout.side"
          :show-left-head="altEventMeasureGeometry.showLeft"
          :show-right-head="altEventMeasureGeometry.showRight"
        />
      </div>
      <div
        v-else-if="altEventMeasureGeometry.mode === 'cross'"
        class="pr-alt-measure pr-alt-measure--cross-lane"
        data-testid="alt-event-measure"
      >
        <div
          v-if="altEventMeasureGeometry.showLeft"
          class="pr-gap-measure__stick"
          data-testid="alt-measure-stick-left"
          :style="{
            left: `${altEventMeasureGeometry.left}px`,
            top: `${altEventMeasureGeometry.crossLane!.leftLaneTop}px`,
            height: `${LANE_HEIGHT}px`,
          }"
        />
        <div
          v-if="altEventMeasureGeometry.showRight"
          class="pr-gap-measure__stick"
          data-testid="alt-measure-stick-right"
          :style="{
            left: `${altEventMeasureGeometry.right}px`,
            top: `${altEventMeasureGeometry.crossLane!.rightLaneTop}px`,
            height: `${LANE_HEIGHT}px`,
          }"
        />
        <div
          class="pr-alt-measure__horiz"
          :style="{
            left: `${Math.min(altEventMeasureGeometry.crossLane!.horizLeftStart, altEventMeasureGeometry.crossLane!.horizLeftEnd)}px`,
            top: `${altEventMeasureGeometry.crossLane!.leftCenterY}px`,
            width: `${Math.abs(altEventMeasureGeometry.crossLane!.horizLeftEnd - altEventMeasureGeometry.crossLane!.horizLeftStart)}px`,
          }"
        />
        <div
          class="pr-alt-measure__horiz"
          :style="{
            left: `${Math.min(altEventMeasureGeometry.crossLane!.horizRightStart, altEventMeasureGeometry.crossLane!.horizRightEnd)}px`,
            top: `${altEventMeasureGeometry.crossLane!.rightCenterY}px`,
            width: `${Math.abs(altEventMeasureGeometry.crossLane!.horizRightEnd - altEventMeasureGeometry.crossLane!.horizRightStart)}px`,
          }"
        />
        <div
          class="pr-alt-measure__vertical"
          :style="{
            left: `${altEventMeasureGeometry.crossLane!.vertX}px`,
            top: `${Math.min(altEventMeasureGeometry.crossLane!.leftCenterY, altEventMeasureGeometry.crossLane!.rightCenterY)}px`,
            height: `${Math.abs(altEventMeasureGeometry.crossLane!.rightCenterY - altEventMeasureGeometry.crossLane!.leftCenterY)}px`,
          }"
        />
        <div
          class="pr-alt-measure__arrow-row"
          :style="{
            top: `${altEventMeasureGeometry.crossLane!.leftLaneTop}px`,
            height: `${LANE_HEIGHT}px`,
          }"
        >
          <MeasureDtArrow
            :label="altEventMeasureGeometry.label"
            :style="altEventMeasureGeometry.arrowLayout.style"
            :mode="altEventMeasureGeometry.arrowLayout.mode"
            :side="altEventMeasureGeometry.arrowLayout.side"
            :show-left-head="altEventMeasureGeometry.showLeft"
            :show-right-head="altEventMeasureGeometry.showRight"
          />
        </div>
      </div>
      <div
        v-else-if="altEventMeasureGeometry.mode === 'split'"
        class="pr-gap-measure pr-alt-measure"
        data-testid="alt-event-measure"
        :style="{
          top: `${altEventMeasureGeometry.top}px`,
          height: `${altEventMeasureGeometry.height}px`,
        }"
      >
        <div
          v-if="altEventMeasureGeometry.showStick"
          class="pr-gap-measure__stick"
          data-testid="alt-measure-stick-split"
          :style="{ left: `${altEventMeasureGeometry.stickX}px` }"
        />
        <div
          v-if="altEventMeasureGeometry.showHoriz"
          class="pr-alt-measure__horiz"
          data-testid="alt-measure-horiz-split"
          :style="{
            left: `${Math.min(altEventMeasureGeometry.stickX, altEventMeasureGeometry.vertX)}px`,
            top: `${LANE_HEIGHT / 2}px`,
            width: `${Math.abs(altEventMeasureGeometry.vertX - altEventMeasureGeometry.stickX)}px`,
          }"
        />
        <MeasureDtArrow
          v-if="altEventMeasureGeometry.showArrow"
          :label="altEventMeasureGeometry.label"
          :style="altEventMeasureGeometry.arrowLayout.style"
          :mode="altEventMeasureGeometry.arrowLayout.mode"
          :side="altEventMeasureGeometry.arrowLayout.side"
          :show-left-head="altEventMeasureGeometry.showLeft"
          :show-right-head="altEventMeasureGeometry.showRight"
        />
      </div>
      <div
        v-else-if="altEventMeasureGeometry.mode === 'cursor'"
        class="pr-alt-measure pr-alt-measure--cursor"
        data-testid="alt-event-measure"
      >
        <div
          class="pr-alt-measure__cursor-line"
          data-testid="alt-measure-cursor-line"
          :style="{ left: `${altEventMeasureGeometry.cursorX}px` }"
        />
        <div
          v-if="altEventMeasureGeometry.showAnchor"
          class="pr-gap-measure__stick"
          data-testid="alt-measure-stick-anchor"
          :style="{
            left: `${altEventMeasureGeometry.anchorX}px`,
            top: `${altEventMeasureGeometry.anchorLaneTop}px`,
            height: `${LANE_HEIGHT}px`,
          }"
        />
        <div
          v-if="altEventMeasureGeometry.showDt"
          class="pr-alt-measure__arrow-row"
          :style="{
            top: `${altEventMeasureGeometry.anchorLaneTop}px`,
            height: `${LANE_HEIGHT}px`,
          }"
        >
          <MeasureDtArrow
            :label="altEventMeasureGeometry.label"
            :style="altEventMeasureGeometry.arrowLayout.style"
            :mode="altEventMeasureGeometry.arrowLayout.mode"
            :side="altEventMeasureGeometry.arrowLayout.side"
            :show-left-head="altEventMeasureGeometry.showLeft"
            :show-right-head="altEventMeasureGeometry.showRight"
          />
        </div>
      </div>
    </template>
    <div
      v-if="marqueeGeometry"
      class="pr-marquee"
      data-testid="marquee-rect"
      :style="{
        left: `${marqueeGeometry.left}px`,
        top: `${marqueeGeometry.top}px`,
        width: `${marqueeGeometry.width}px`,
        height: `${marqueeGeometry.height}px`,
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

.pr-swim-canvas-sizer {
  width: 100%;
  pointer-events: none;
}

.pr-swim-canvas {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: block;
  cursor: default;
  touch-action: none;
  z-index: 0;
}

/* Events are painted into the canvas, so the hand comes from hover hit-test.
   Declared before measure: equal specificity, measure keeps col-resize. */
.pr-swim-canvas-wrap--over-event .pr-swim-canvas {
  cursor: pointer;
}

/* Measure mode: col-resize over empty canvas and events alike. */
.pr-swim-canvas-wrap--measure .pr-swim-canvas {
  cursor: col-resize;
}

.pr-swim-canvas--gl {
  pointer-events: none;
  z-index: 0;
}

.pr-swim-canvas--overlay {
  z-index: 2;
  background: transparent;
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

/* During resize the playhead (blue/gray) owns the full-height line. */
.pr-measure-border--dragging::before {
  display: none;
}

.pr-measure-border--preview {
  pointer-events: none;
  cursor: default;
  z-index: 2;
}

/* Full-height playhead bar — above event canvas, below blue edge marks. */
/* Above the Card strips (z-index 8 in SwimlaneView), which are opaque full-row
   buttons and otherwise punch a gap in the line at every Card header. The wrap's
   overflow: hidden still clips the bar to the chart column. */
.pr-swim-cursor {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #317af7;
  transform: translateX(-0.5px);
  pointer-events: none;
  z-index: 9;
}

.pr-swim-cursor--snapped {
  background: #4c4c4c;
}

/* Event-edge marks: 2px snap + committed exact-match bars (full lane height).
   Kept above .pr-swim-cursor so snap markers still paint on top of the playhead
   stem; both were raised together when the cursor moved above the Card strips. */
.pr-measure-edge-mark {
  position: absolute;
  width: 1px;
  transform: translateX(-50%);
  background: var(--pr-playhead, #3078f0);
  pointer-events: none;
  z-index: 10;
}

.pr-measure-edge-mark--exact {
  width: 2px;
}

.pr-measure-edge-mark--snap {
  width: 2px;
  z-index: 11;
}

/* Default-mode hover gap measure: lane-height overlay, non-interactive. */
.pr-gap-measure {
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 3;
}

.pr-gap-measure__stick {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
  background: rgba(49, 122, 247, 1);
}

/* Alt+hover event-to-event measure (default mode).
 * Same stacking as `.pr-swim-cursor` (z-index 9): Card strips are opaque at 8, and
 * neither the wrap nor the swim row creates a stacking context, so anything ≤8 is
 * punched out at every Card header — including the dashed cross-lane connector. */
.pr-alt-measure {
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 9;
}

.pr-alt-measure--cross-lane {
  top: 0;
  bottom: 0;
}

.pr-alt-measure-anchor {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid rgba(255, 180, 196, 0.95);
  border-radius: 5px;
  pointer-events: none;
  z-index: 9;
}

.pr-alt-measure-anchor--target {
  border-color: rgba(49, 122, 247, 0.95);
}

.pr-alt-measure--cursor {
  top: 0;
  bottom: 0;
}

.pr-alt-measure__cursor-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
  background: rgba(49, 122, 247, 1);
  pointer-events: none;
}

.pr-alt-measure__horiz {
  position: absolute;
  height: 1.5px;
  transform: translateY(-50%);
  background: rgba(49, 122, 247, 1);
}

.pr-alt-measure__vertical {
  position: absolute;
  width: 0;
  border-left: 2px dashed rgba(49, 122, 247, 1);
  transform: translateX(-50%);
  pointer-events: none;
}

.pr-alt-measure__arrow-row {
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
}

.pr-alt-measure--cross-lane .pr-gap-measure__stick,
.pr-alt-measure--cursor .pr-gap-measure__stick {
  top: auto;
  bottom: auto;
}

/* Marquee multi-select rect (v930/task-marquee): thin accent border over a wash. */
.pr-marquee {
  position: absolute;
  border: 1px solid rgba(66, 133, 244, 0.8);
  background: rgba(66, 133, 244, 0.15);
  pointer-events: none;
  /* Above the measure chrome, below the Card strips owned by SwimlaneView. */
  z-index: 6;
}
</style>
