<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref, shallowRef, watch } from 'vue';
import {
  DEFAULT_DEPENDENCY_DEPTH,
  type DependencyMode,
  type MeasureRange,
  type OverviewSeries,
  type SwimEvent,
  type SwimlaneModel,
  type SwimlaneViewState,
} from '../../../domain/types';
import {
  collapseShiftY,
  collapseTransformFromModel,
  LANE_GROUP_HEADER_FILL,
  LANE_GROUP_HEADER_HEIGHT,
  LANE_GROUP_HEADER_HOVER,
  LANE_HEIGHT,
  layoutHeaders,
  visualContentHeight,
  type CollapseAnimState,
} from '../../../swimlane/layout';
import {
  ALT_MEASURE_FIND_EVENT_KEY,
  ALT_MEASURE_SHARED_KEY,
  clearAltMeasureShared,
  createAltMeasureShared,
} from './altMeasureShared';
import { findEventInModel } from '../../../domain/swimTree';
import { buildPinnedSwimModel, resolvePinnedGutterLanes } from './pinnedLanes';
import {
  GUTTER_WIDTH_DEFAULT,
  GUTTER_WIDTH_MAX,
  GUTTER_WIDTH_MIN,
  startHorizontalResize,
} from '../../panelResize';
import Chevron from '../../Chevron.vue';
import type { GutterMetric } from '../../../domain/gutterMetrics';
import OverviewCharts from '../OverviewCharts/OverviewCharts.vue';
import {
  OVERVIEW_HEADER_H,
  OVERVIEW_LANE_H,
} from '../OverviewCharts/overviewLayout';
import LaneGutter, { type GutterGroup } from './LaneGutter/LaneGutter.vue';
import LaneGutterNode from './LaneGutter/LaneGutterNode.vue';
import CardMetricSelect from './CardMetricSelect.vue';
import SwimlaneCanvas from './SwimlaneCanvas/SwimlaneCanvas.vue';
import { animateProgress, prefersReducedMotion } from '../animateViewWindow';
import { gutterMetricLabel, t } from '../../../i18n';

const props = withDefaults(
  defineProps<{
    groups: GutterGroup[];
    collapsedIds: string[];
    /** Leaf lane ids in pin order; sticky strip when non-empty. */
    pinnedLaneIds?: string[];
    /** Full swim model for the scrolling body; collapse is paint-only. */
    model: SwimlaneModel | null;
    /**
     * Unfiltered swim model for the pinned strip. Defaults to `model`.
     * Pass the full tree so pins survive ancestor collapse.
     */
    pinSourceModel?: SwimlaneModel | null;
    /** Full overview series; sticky strip filters by pinnedOverviewIds. */
    overviewSeries?: OverviewSeries[];
    /** When false, hide scrollable + sticky overview charts. */
    showOverviewCharts?: boolean;
    /** Overview series ids in pin order (PyPTO counter pin). */
    pinnedOverviewIds?: string[];
    view: SwimlaneViewState;
    selectedEventId: string | null;
    hoveredEventId: string | null;
    multiSelectedIds?: string[];
    searchQuery: string;
    measureMode?: boolean;
    measureRange?: MeasureRange | null;
    dependencyMode?: DependencyMode;
    dependencyDepth?: number;
    preferRenderer?: 'auto' | 'webgl' | 'canvas';
    gutterWidth?: number;
    /** Per-Card selected gutter metric (parent-owned). */
    gutterMetricByCard?: Record<string, GutterMetric>;
    /** Per-Card available metrics; omit or empty → hide selector on that Card. */
    gutterMetricOptionsByCard?: Record<string, GutterMetric[]>;
    /** Shared playhead x from parent (axis hover + canvas); drives the swim vertical bar. */
    cursorXRatio?: number | null;
    /** True when the cursor is magnetized to an event edge (gray the swim vertical bar). */
    cursorSnapped?: boolean;
    locale?: string;
    /** In-flight lane collapse/expand tween (see layout.CollapseAnimState). */
    collapseAnim?: CollapseAnimState | null;
  }>(),
  {
    dependencyMode: 'all',
    dependencyDepth: DEFAULT_DEPENDENCY_DEPTH,
    cursorXRatio: null,
    cursorSnapped: false,
    collapseAnim: null,
    overviewSeries: () => [],
    pinnedOverviewIds: () => [],
    showOverviewCharts: true,
    multiSelectedIds: () => [],
  },
);

const emit = defineEmits<{
  'update:scrollY': [scrollY: number];
  'update:gutterWidth': [width: number];
  'toggle-group': [groupId: string];
  'context-menu': [payload: { x: number; y: number; laneId: string; target?: SwimEvent | null }];
  'pin-lane': [laneId: string];
  'unpin-lane': [laneId: string];
  'hover-lane': [laneId: string | null];
  'pin-overview': [seriesId: string];
  'unpin-overview': [seriesId: string];
  select: [event: SwimEvent | null];
  'multi-select': [events: SwimEvent[]];
  'multi-select-preview': [ids: string[] | SwimEvent[] | null];
  'multi-select-span': [span: MeasureRange | null];
  hover: [event: SwimEvent | null, clientX: number, clientY: number];
  cursor: [payload: { time: number; xRatio: number; snapped?: boolean } | null];
  pan: [deltaTime: number];
  zoom: [factor: number, anchorTime: number];
  'set-playhead': [time: number];
  'update:measure-range': [range: MeasureRange | null];
  'suppress-measure-dt': [suppress: boolean];
  'update:gutter-metric': [payload: { cardId: string; metric: GutterMetric }];
}>();

const gutterRef = ref<{ root: HTMLElement | null } | null>(null);
type CanvasExpose = {
  handleWheel: (e: WheelEvent) => void;
  magnetizeAtClient: (
    clientX: number,
    clientY: number,
  ) => { time: number; xPx: number; xRatio: number; eventId: string | null } | null;
  magnetizeAtClientLocal: (
    clientX: number,
    clientY: number,
  ) => { time: number; xPx: number; xRatio: number; eventId: string | null } | null;
  clearEdgeSnapHighlight: () => void;
  altMeasureBridgeEndpoint?: () => { clientX: number; clientY: number; time: number } | null;
};
const canvasRef = ref<CanvasExpose | null>(null);
const pinnedCanvasRef = ref<CanvasExpose | null>(null);
const pinnedStripRef = ref<HTMLElement | null>(null);
const stackRef = ref<HTMLElement | null>(null);
const bodyRef = ref<HTMLElement | null>(null);
const bodyViewportH = ref(0);
/** Imperative lane scroll during wheel ease — avoids cloning parent viewState every frame. */
const liveScrollY = ref(props.view.scrollY);
let gutterScrollSync = false;
let gutterScrollSyncRaf = 0;
/** True between an in-flight canvas `scroll-y` and its settle emit. */
let canvasLiveScroll = false;
const localGutterWidth = ref(props.gutterWidth ?? GUTTER_WIDTH_DEFAULT);
const localMultiSelectedIds = shallowRef<string[]>(props.multiSelectedIds ?? []);
/**
 * Live marquee coverage from either canvas. Shared so the pinned strip dims with the
 * body while a body marquee is in flight (and vice versa); `null` restores the commit.
 */
const livePreviewIds = shallowRef<string[] | null>(null);
const paintMultiSelectedIds = computed(
  () => livePreviewIds.value ?? localMultiSelectedIds.value,
);
/** Clear single-select paint while a live preview owns brightness (PR-CANVAS-085). */
const paintSelectedEventId = computed(() =>
  livePreviewIds.value != null ? null : props.selectedEventId,
);
/** Keep the local mirror in sync with parent-driven updates (marquee commit).
 * Without this, `localMultiSelectedIds` only catches the initial value and any
 * `update-multi-selected` toggle — a `view.multiSelectedIds` swap in the parent
 * (the marquee commit path) never reaches the canvas, so `setMultiSelection` is
 * called with a stale `[]` and the post-release dim disappears. */
watch(
  () => props.multiSelectedIds,
  (v) => {
    if (v) localMultiSelectedIds.value = v;
  },
);
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

const pinnedLaneIds = computed(() => props.pinnedLaneIds ?? []);
const pinnedOverviewIds = computed(() => props.pinnedOverviewIds ?? []);
const pinnedRows = computed(() => resolvePinnedGutterLanes(props.groups, pinnedLaneIds.value));
const pinnedModel = computed(() =>
  buildPinnedSwimModel(props.pinSourceModel ?? props.model, pinnedLaneIds.value),
);
/** Sticky overview tracks in pin order (skip ids missing from current series). */
const pinnedOverviewSeries = computed(() => {
  const byId = new Map((props.overviewSeries ?? []).map((s) => [s.id, s]));
  return pinnedOverviewIds.value
    .map((id) => byId.get(id))
    .filter((s): s is OverviewSeries => s != null);
});

/** Scrollable 统计分析 block (all series); scrolls away with lanes unless pinned copies stay sticky. */
const scrollOverviewSeries = computed(() =>
  props.showOverviewCharts !== false && (props.overviewSeries?.length ?? 0) > 0
    ? (props.overviewSeries ?? [])
    : [],
);

const overviewCollapsed = ref(false);
/** 1 = tracks fully open, 0 = fully closed (tweened like Card gutter collapse). */
const overviewAnimVisible = ref(1);
let cancelOverviewAnim: () => void = () => {};

const overviewHiddenHeight = computed(
  () => scrollOverviewSeries.value.length * OVERVIEW_LANE_H,
);

const overviewContentPad = computed(() => {
  const n = scrollOverviewSeries.value.length;
  if (n <= 0) return 0;
  return OVERVIEW_HEADER_H + overviewHiddenHeight.value * overviewAnimVisible.value;
});

function clampScrollAfterOverviewCollapse(): void {
  // Pad shrinks up to N×24px; keep scrollY inside the new content height.
  void nextTick(() => {
    const el = gutterRef.value?.root;
    if (!el) return;
    const maxY = Math.max(0, el.scrollHeight - el.clientHeight);
    if (props.view.scrollY > maxY) emit('update:scrollY', maxY);
  });
}

function onOverviewCollapsedUpdate(nextCollapsed: boolean): void {
  cancelOverviewAnim();
  const height = overviewHiddenHeight.value;
  const from = overviewAnimVisible.value;
  const to = nextCollapsed ? 0 : 1;
  overviewCollapsed.value = nextCollapsed;

  const finish = (v: number) => {
    overviewAnimVisible.value = v;
    if (v < from) clampScrollAfterOverviewCollapse();
  };

  if (height <= 0 || prefersReducedMotion() || from === to) {
    finish(to);
    return;
  }

  cancelOverviewAnim = animateProgress({
    from,
    to,
    durationMs: 200,
    onUpdate: (v) => {
      overviewAnimVisible.value = v;
    },
    onDone: () => {
      finish(to);
    },
  });
}


/** Shared Alt-measure session so pin-strip ↔ body can measure across sticky and scroll lanes. */
const altMeasureShared = createAltMeasureShared();
provide(ALT_MEASURE_SHARED_KEY, altMeasureShared);

// Collapse / pin changes reshuffle which lanes are visible — drop the session entirely.
watch(
  [() => props.collapsedIds, () => props.pinnedLaneIds],
  () => {
    if (altMeasureShared.anchorId) clearAltMeasureShared(altMeasureShared);
  },
);

provide(ALT_MEASURE_FIND_EVENT_KEY, (id: string) => {
  return (
    findEventInModel(props.pinSourceModel ?? props.model, id) ??
    findEventInModel(props.model, id) ??
    findEventInModel(pinnedModel.value, id)
  );
});

/** Dashed vertical bridging pin-strip ↔ body when Alt-measure endpoints span both surfaces. */
const altMeasureCrossBridge = computed(() => {
  void altMeasureShared.anchorId;
  void altMeasureShared.target;
  void altMeasureShared.pinned;
  void altMeasureShared.altKeyHeld;
  void liveScrollY.value;
  void props.view.startTime;
  void props.view.endTime;
  void pinnedStripHeight.value;
  // Overview collapse tweens paddingTop inside the body — height unchanged, so
  // bodyViewportH / ResizeObserver do not fire; still reproject the bridge.
  void overviewContentPad.value;
  // Re-read client rects after gutter / body resize (sticks re-project; bridge must follow).
  void localGutterWidth.value;
  void bodyViewportH.value;
  if (!pinnedRows.value.length) return null;
  const strip = pinnedCanvasRef.value?.altMeasureBridgeEndpoint?.() ?? null;
  const body = canvasRef.value?.altMeasureBridgeEndpoint?.() ?? null;
  const stack = stackRef.value;
  if (!strip || !body || !stack) return null;
  const sr = stack.getBoundingClientRect();
  // Prefer later-edge X (matches same-canvas cross-lane vertX); fall back to mean if equal.
  const vert = strip.time >= body.time ? strip : body;
  const y1 = strip.clientY - sr.top;
  const y2 = body.clientY - sr.top;
  return {
    left: vert.clientX - sr.left,
    top: Math.min(y1, y2),
    height: Math.abs(y2 - y1),
  };
});
const pinnedStripHeight = computed(() =>
  pinnedRows.value.reduce((h, row) => h + (row.lane.rowCount ?? 1) * LANE_HEIGHT, 0),
);
/** Sticky overview strip height (N × OVERVIEW_LANE_H) — drives enter/leave CSS tween. */
const pinnedOverviewHeight = computed(
  () => pinnedOverviewSeries.value.length * OVERVIEW_LANE_H,
);
const pinnedView = computed(() => ({
  startTime: props.view.startTime,
  endTime: props.view.endTime,
  scrollY: 0,
}));
/** Body canvas gets the same slim window (with scrollY) so Vue does not deep-walk viewState. */
const bodyView = computed(() => ({
  startTime: props.view.startTime,
  endTime: props.view.endTime,
  scrollY: props.view.scrollY,
}));

/** Lane under canvas or gutter pointer — whole-row highlight (not pushpin). */
const hoveredLaneId = ref<string | null>(null);

function onLaneHover(id: string | null): void {
  hoveredLaneId.value = id;
  emit('hover-lane', id);
}

/** Card header Y from the same row walk as the canvas, shifted by rest + in-flight folds. */
const cardHeaders = computed(() => {
  const fold = collapseTransformFromModel(
    props.model,
    props.collapsedIds,
    props.collapseAnim ?? null,
  );
  return layoutHeaders(props.model).map((h) => ({
    id: h.id,
    name: h.name,
    y: collapseShiftY(h.y, fold),
    expanded: !collapsed.value.has(h.id),
  }));
});

const visibleCardStrips = computed(() => {
  const pad = overviewContentPad.value;
  return cardHeaders.value.map((h) => ({
    ...h,
    top: h.y + pad,
  }));
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
  cancelOverviewAnim();
  if (canvasLiveScroll) emit('update:scrollY', liveScrollY.value);
  if (gutterScrollSyncRaf) cancelAnimationFrame(gutterScrollSyncRaf);
  bodyResizeObserver?.disconnect();
  bodyResizeObserver = null;
});

watch(
  () => props.view.scrollY,
  (y) => {
    if (canvasLiveScroll) return;
    liveScrollY.value = y;
    setGutterScrollTop(y);
  },
);

/** Native gutter `scrollTop` clamps as the collapse wrapper shrinks; canvas paint must too. */
function maxBodyScrollY(): number {
  const h = visualContentHeight(props.model, props.collapsedIds ?? [], props.collapseAnim ?? null);
  return Math.max(0, h + overviewContentPad.value - (bodyViewportH.value || 0));
}

function clampLiveScrollToContent(): void {
  const maxY = maxBodyScrollY();
  if (liveScrollY.value <= maxY) return;
  liveScrollY.value = maxY;
  setGutterScrollTop(maxY);
}

watch(
  () => [props.collapseAnim, props.collapsedIds, overviewContentPad.value, bodyViewportH.value] as const,
  () => {
    clampLiveScrollToContent();
  },
);

function setGutterScrollTop(y: number): void {
  const el = gutterRef.value?.root;
  if (!el || Math.abs(el.scrollTop - y) <= 0.5) return;
  gutterScrollSync = true;
  el.scrollTop = y;
  if (gutterScrollSyncRaf) cancelAnimationFrame(gutterScrollSyncRaf);
  // Native `scroll` from this assignment can fire after this turn; keep the echo
  // gated until the next frame so it cannot restart a live-scroll session.
  gutterScrollSyncRaf = requestAnimationFrame(() => {
    gutterScrollSyncRaf = 0;
    gutterScrollSync = false;
  });
}

function onScrollY(scrollY: number, settled?: boolean) {
  const y = Math.max(0, scrollY);
  liveScrollY.value = y;
  setGutterScrollTop(y);
  if (settled) {
    canvasLiveScroll = false;
    emit('update:scrollY', y);
    return;
  }
  canvasLiveScroll = true;
}

function onUpdateMultiSelected(newIds: string[]) {
  localMultiSelectedIds.value = newIds;
}

function previewPayloadIds(payload: string[] | SwimEvent[]): string[] {
  if (payload.length === 0) return [];
  return typeof payload[0] === 'string'
    ? (payload as string[])
    : (payload as SwimEvent[]).map((e) => e.id);
}

function onMultiSelectPreview(payload: string[] | SwimEvent[] | null) {
  if (payload == null) {
    livePreviewIds.value = null;
  } else {
    const ids = previewPayloadIds(payload);
    const prev = livePreviewIds.value;
    if (
      prev == null ||
      prev.length !== ids.length ||
      prev.some((id, i) => id !== ids[i])
    ) {
      livePreviewIds.value = ids;
    }
  }
  emit('multi-select-preview', payload);
}

function onGutterScroll(): void {
  if (gutterScrollSync) return;
  const el = gutterRef.value?.root;
  if (!el) return;
  if (Math.abs(el.scrollTop - liveScrollY.value) > 0.5) {
    onScrollY(el.scrollTop, true);
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

/** Card strips, overview, and gutter: same wheel as the events canvas.
 * Native gutter overflow must not compositor-scroll ahead of `setView`. */
function onStripWheel(e: WheelEvent) {
  canvasRef.value?.handleWheel(e);
}

/** OverviewCharts sits above the canvas — same wheel gestures as the swimlane. */
function onOverviewWheel(e: WheelEvent) {
  canvasRef.value?.handleWheel(e);
}

/** Magnet follows the canvas under the pointer (pin strip ↔ body). */
function magnetizeAtClient(clientX: number, clientY: number) {
  const strip = pinnedStripRef.value;
  if (strip) {
    const r = strip.getBoundingClientRect();
    if (clientY >= r.top && clientY < r.bottom) {
      canvasRef.value?.clearEdgeSnapHighlight();
      return pinnedCanvasRef.value?.magnetizeAtClientLocal(clientX, clientY) ?? null;
    }
  }
  pinnedCanvasRef.value?.clearEdgeSnapHighlight();
  return canvasRef.value?.magnetizeAtClientLocal(clientX, clientY) ?? null;
}

function clearEdgeSnapHighlight() {
  canvasRef.value?.clearEdgeSnapHighlight();
  pinnedCanvasRef.value?.clearEdgeSnapHighlight();
}


function metricOptionsForCard(cardId: string): GutterMetric[] {
  return props.gutterMetricOptionsByCard?.[cardId] ?? [];
}

function selectedMetricForCard(cardId: string): GutterMetric | undefined {
  return props.gutterMetricByCard?.[cardId];
}

function onMetricChange(cardId: string, metric: GutterMetric) {
  emit('update:gutter-metric', { cardId, metric });
}

/** Collapse/expand only when the activation target is the strip itself — not the metric select. */
function onCardStripActivate(cardId: string, e: Event) {
  const t = e.target;
  if (t instanceof Element && t.closest('.pr-metric-select')) return;
  emit('toggle-group', cardId);
}

defineExpose({
  get gutterRoot() {
    return gutterRef.value?.root ?? null;
  },
  magnetizeAtClient,
  clearEdgeSnapHighlight,
  /** Test/debug: shared Alt-measure session (pin strip ↔ body). */
  altMeasureShared,
});
</script>

<template>
  <div
    ref="stackRef"
    class="pr-swim-stack"
    :style="{ '--pr-gutter-width': `${localGutterWidth}px` }"
  >
    <div
      v-if="altMeasureCrossBridge"
      class="pr-alt-measure-cross-bridge"
      data-testid="alt-measure-cross-bridge"
      :style="{
        left: `${altMeasureCrossBridge.left}px`,
        top: `${altMeasureCrossBridge.top}px`,
        height: `${altMeasureCrossBridge.height}px`,
      }"
    />
    <Transition name="pr-pinned-overview">
      <div
        v-if="pinnedOverviewSeries.length"
        class="pr-pinned-overview"
        data-testid="pinned-overview-wrap"
        :style="{ '--pr-pinned-overview-h': `${pinnedOverviewHeight}px` }"
      >
        <OverviewCharts
          variant="strip"
          :series="pinnedOverviewSeries"
          :pinned-overview-ids="pinnedOverviewIds"
          :start-time="view.startTime"
          :end-time="view.endTime"
          :gutter-width="localGutterWidth"
          :locale="locale"
          :measure-mode="measureMode"
          @pin-overview="emit('pin-overview', $event)"
          @unpin-overview="emit('unpin-overview', $event)"
          @cursor="onCursor"
          @wheel="onOverviewWheel"
          @pan="emit('pan', $event)"
        />
      </div>
    </Transition>

    <Transition name="pr-pinned">
      <div
        v-if="pinnedRows.length"
        ref="pinnedStripRef"
        class="pr-pinned-strip"
        data-testid="pinned-strip"
        :style="{ '--pr-pinned-h': `${pinnedStripHeight}px` }"
      >
        <div
          class="pr-pinned-strip__gutter"
          data-testid="pinned-gutter"
        >
          <LaneGutterNode
            v-for="row in pinnedRows"
            :key="`pin-${row.lane.id}`"
            :lane="row.lane"
            :depth="row.depth"
            :pinned-lane-ids="pinnedLaneIds"
            :hovered-lane-id="hoveredLaneId"
            :locale="locale"
            :util-midline-percent="row.utilMidlinePercent"
            @pin-lane="emit('pin-lane', $event)"
            @unpin-lane="emit('unpin-lane', $event)"
            @lane-hover="onLaneHover"
            @context-menu="emit('context-menu', $event)"
          />
        </div>
        <SwimlaneCanvas
          v-if="pinnedModel"
          ref="pinnedCanvasRef"
          class="pr-pinned-strip__canvas"
          data-testid="pinned-canvas"
          :model="pinnedModel"
          :view="pinnedView"
          :selected-event-id="paintSelectedEventId"
          :hovered-event-id="hoveredEventId"
          :hovered-lane-id="hoveredLaneId"
          :search-query="searchQuery"
          :measure-mode="measureMode"
          :measure-range="measureRange"
          :show-dependencies="false"
          :prefer-renderer="preferRenderer ?? 'auto'"
          :cursor-x-ratio="cursorXRatio"
          :cursor-snapped="cursorSnapped"
          :resolve-magnetize="magnetizeAtClient"
          alt-measure-role="strip"
          :pinned-lane-ids="pinnedLaneIds"
          :multi-selected-ids="paintMultiSelectedIds"
          @select="emit('select', $event)"
          @multi-select="emit('multi-select', $event)"
          @multi-select-preview="onMultiSelectPreview"
          @multi-select-span="emit('multi-select-span', $event)"
          @hover="(ev, x, y) => emit('hover', ev, x, y)"
          @lane-hover="onLaneHover"
          @cursor="onCursor"
          @set-playhead="emit('set-playhead', $event)"
          @pan="emit('pan', $event)"
          @zoom="(f, a) => emit('zoom', f, a)"
          @update:measure-range="emit('update:measure-range', $event)"
          @suppress-measure-dt="emit('suppress-measure-dt', $event)"
          @context-menu="emit('context-menu', $event)"
          @toggle-group="emit('toggle-group', $event)"
          @update-multi-selected="onUpdateMultiSelected"
        />
      </div>
    </Transition>

    <div
      ref="bodyRef"
      class="pr-swim-row pr-swim-row--body"
    >
      <OverviewCharts
        v-if="scrollOverviewSeries.length"
        class="pr-body-overview"
        :style="{ transform: `translateY(${-liveScrollY}px)` }"
        :series="scrollOverviewSeries"
        :pinned-overview-ids="pinnedOverviewIds"
        :start-time="view.startTime"
        :end-time="view.endTime"
        :gutter-width="localGutterWidth"
        :locale="locale"
        :measure-mode="measureMode"
        :collapsed="overviewCollapsed"
        :collapse-visible="overviewAnimVisible"
        :collapse-hidden-height="overviewHiddenHeight"
        @pin-overview="emit('pin-overview', $event)"
        @unpin-overview="emit('unpin-overview', $event)"
        @cursor="onCursor"
        @wheel="onOverviewWheel"
        @pan="emit('pan', $event)"
        @update:collapsed="onOverviewCollapsedUpdate"
      />

      <button
        type="button"
        class="pr-gutter-resize"
        data-testid="gutter-resize-handle"
        :aria-label="t('resizeLaneGutter', locale)"
        @pointerdown="onGutterResizePointerDown"
        @pointermove="onGutterResizePointerMove"
        @pointerup="onGutterResizePointerUp"
        @pointercancel="onGutterResizePointerUp"
      />

      <LaneGutter
        ref="gutterRef"
        class="pr-body-gutter"
        :style="{ paddingTop: `${overviewContentPad}px` }"
        :groups="groups"
        :collapsed-ids="collapsedIds"
        :pinned-lane-ids="pinnedLaneIds"
        :hovered-lane-id="hoveredLaneId"
        :locale="locale"
        :collapse-anim="collapseAnim"
        @scroll="onGutterScroll"
        @wheel.prevent="onStripWheel"
        @toggle-group="emit('toggle-group', $event)"
        @pin-lane="emit('pin-lane', $event)"
        @unpin-lane="emit('unpin-lane', $event)"
        @lane-hover="onLaneHover"
        @context-menu="emit('context-menu', $event)"
      />
      <SwimlaneCanvas
        ref="canvasRef"
        :model="model"
        :view="bodyView"
        :content-top-pad="overviewContentPad"
        :selected-event-id="paintSelectedEventId"
        :hovered-event-id="hoveredEventId"
        :hovered-lane-id="hoveredLaneId"
        :search-query="searchQuery"
        :measure-mode="measureMode"
        :measure-range="measureRange"
        :dependency-mode="dependencyMode"
        :dependency-depth="dependencyDepth"
        :prefer-renderer="preferRenderer ?? 'auto'"
        :cursor-x-ratio="cursorXRatio"
        :cursor-snapped="cursorSnapped"
        :resolve-magnetize="magnetizeAtClient"
        :alt-measure-role="pinnedLaneIds.length ? 'body' : 'solo'"
        :pinned-lane-ids="pinnedLaneIds"
        :collapse-anim="collapseAnim"
        :collapsed-ids="collapsedIds"
        :multi-selected-ids="paintMultiSelectedIds"
        @select="emit('select', $event)"
        @multi-select="emit('multi-select', $event)"
        @multi-select-preview="onMultiSelectPreview"
        @multi-select-span="emit('multi-select-span', $event)"
        @hover="(ev, x, y) => emit('hover', ev, x, y)"
        @lane-hover="onLaneHover"
        @cursor="onCursor"
        @set-playhead="emit('set-playhead', $event)"
        @pan="emit('pan', $event)"
        @zoom="(f, a) => emit('zoom', f, a)"
        @scroll-y="onScrollY"
        @update:measure-range="emit('update:measure-range', $event)"
        @suppress-measure-dt="emit('suppress-measure-dt', $event)"
        @context-menu="emit('context-menu', $event)"
        @toggle-group="emit('toggle-group', $event)"
        @update-multi-selected="onUpdateMultiSelected"
      />

      <div
        class="pr-card-strips"
        data-testid="card-strips"
        :style="{
          '--pr-card-header-fill': LANE_GROUP_HEADER_FILL,
          '--pr-card-header-hover': LANE_GROUP_HEADER_HOVER,
          transform: `translateY(${-liveScrollY}px)`,
        }"
      >
        <div
          v-for="strip in visibleCardStrips"
          :key="strip.id"
          role="button"
          tabindex="0"
          class="pr-card-strip"
          :data-testid="`card-strip-${strip.id}`"
          :aria-expanded="strip.expanded"
          :aria-label="strip.name"
          :style="{ top: `${strip.top}px`, height: `${LANE_GROUP_HEADER_HEIGHT}px` }"
          @pointerenter="clearCursor"
          @click="onCardStripActivate(strip.id, $event)"
          @keydown.enter.prevent="onCardStripActivate(strip.id, $event)"
          @keydown.space.prevent="onCardStripActivate(strip.id, $event)"
          @wheel="onStripWheel"
        >
          <span class="pr-card-strip__label">
            <Chevron
              class="pr-card-strip__chevron"
              :expanded="strip.expanded"
            />
            <span class="pr-card-strip__name">{{ strip.name }}</span>
            <CardMetricSelect
              v-if="strip.expanded && metricOptionsForCard(strip.id).length > 0"
              :model-value="selectedMetricForCard(strip.id) ?? metricOptionsForCard(strip.id)[0]!"
              :options="metricOptionsForCard(strip.id)"
              :ariaLabel="t('gutterMetricFor', locale).replace('{name}', strip.name)"
              :label-of="(m) => gutterMetricLabel(m as GutterMetric, locale)"
              @update:model-value="onMetricChange(strip.id, $event as GutterMetric)"
            />
          </span>
        </div>
      </div>
    </div>
    <div
      v-if="cursorXRatio != null"
      class="pr-stack-cursor-layer"
      data-testid="stack-cursor"
      aria-hidden="true"
    >
      <div
        class="pr-stack-cursor"
        :class="{ 'pr-stack-cursor--snapped': cursorSnapped }"
        :style="{ left: `${cursorXRatio * 100}%` }"
      />
    </div>
  </div>
</template>

<style scoped>
.pr-swim-stack {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/** Pin↔body Alt-measure vertical — spans sticky strip and scroll body.
 * z-index 9 matches in-canvas Alt-measure / swim cursor so Card strips (8) cannot
 * punch gaps in the dashed bridge. */
.pr-alt-measure-cross-bridge {
  position: absolute;
  z-index: 9;
  width: 0;
  border-left: 2px dashed rgba(49, 122, 247, 1);
  transform: translateX(-50%);
  pointer-events: none;
}

.pr-pinned-strip {
  box-sizing: border-box;
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: minmax(0, var(--pr-gutter-width, 280px)) minmax(80px, 1fr);
  gap: 0;
  align-items: stretch;
  min-width: 0;
  /* Enter/leave collapse the strip via `--pr-pinned-h` (0 ↔ N·LANE_HEIGHT). */
  height: var(--pr-pinned-h, 0px);
  transition: height 200ms ease;
  overflow: hidden;
  z-index: 6;
  border-bottom: 1px solid #555;
  background: #1f1f1f;
}

.pr-pinned-strip.pr-pinned-enter-from,
.pr-pinned-strip.pr-pinned-leave-to {
  height: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pr-pinned-strip {
    transition: none;
  }
}

.pr-pinned-overview {
  box-sizing: border-box;
  flex: 0 0 auto;
  /* Same enter/leave / incremental-height pattern as `.pr-pinned-strip`. */
  height: var(--pr-pinned-overview-h, 0px);
  transition: height 200ms ease;
  overflow: hidden;
  z-index: 6;
  /* No wrapper border — last overview track inset uses --pr-divider (#3a3a3a),
     matching swimlane / gutter lane seams (not the brighter #555 pin-strip chrome). */
  background: #1f1f1f;
}

.pr-pinned-overview.pr-pinned-overview-enter-from,
.pr-pinned-overview.pr-pinned-overview-leave-to {
  height: 0;
}

.pr-pinned-overview-enter-active,
.pr-pinned-overview-leave-active {
  pointer-events: none;
}

.pr-pinned-overview :deep(.pr-overview-charts) {
  /* Strip height is driven by the wrapper; drop the charts root border so the
     seam is only the track divider (same color as lane separators). */
  border-bottom: none;
}

@media (prefers-reduced-motion: reduce) {
  .pr-pinned-overview {
    transition: none;
  }
}

.pr-pinned-strip__gutter {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: #1f1f1f;
  border-right: 1px solid #3a3a3a;
  font-size: 11px;
  color: #b0b0b0;
}

.pr-pinned-strip__canvas {
  min-width: 0;
  min-height: 0;
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

.pr-swim-row--body {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.pr-body-overview {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  will-change: transform;
}

.pr-body-gutter {
  box-sizing: border-box;
}

/* Pin to used gutter column so the handle stays on the seam when the column shrinks. */
/*
 * Pin to the used gutter column so the handle stays on the seam when the column
 * shrinks below --pr-gutter-width. Abspos grid children treat a lone
 * `grid-column: 1` end line as `auto` (= container padding edge), so the line
 * pair must be explicit (`1 / 2`) or `right: 0` parks on the far track edge.
 */
.pr-gutter-resize {
  grid-column: 1 / 2;
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
  height: 40px;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0;
  border-bottom: 1px solid #3a3a3a;
  background: var(--pr-card-header-fill);
  color: #e6e6e6;
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
  font-size: 14px;
  font-weight: 700;
  line-height: 22px;
  letter-spacing: 0;
}

/* Full-height playhead over the chart column (above overview z-index 4) so the
 * line stays continuous through 统计分析 header/tracks down to the swim bottom. */
.pr-stack-cursor-layer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: var(--pr-gutter-width, 280px);
  pointer-events: none;
  z-index: 9;
  overflow: hidden;
}

.pr-stack-cursor {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #317af7;
}

.pr-stack-cursor--snapped {
  background: #4c4c4c;
}
</style>
