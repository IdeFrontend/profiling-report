<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { loadReportSource } from '../../adapters';
import {
  applyWindow,
  clearMeasure,
  createViewState,
  measureFocusWindow,
  panBy,
  pinLane,
  setMeasureMode,
  setMeasureRange,
  spanFromZoomPercent,
  unpinLane,
  zoomAt,
  zoomPercentFromSpan,
  zoomToFitWindow,
} from '../../domain/viewState';
import {
  DEFAULT_DEPENDENCY_DEPTH,
  normalizeDependencyDepth,
  type AdaptedReport,
  type DependencyMode,
  type MeasureRange,
  type ReportCapability,
  type ReportOperator,
  type ReportViewModel,
  type SelectedEvent,
  type SwimEvent,
  type SwimlaneModel,
  type SwimlaneViewState,
  type SwimThread,
  type TimeScaleUnit,
  type TimeDisplayMode,
  type ViewFullCsvPayload,
} from '../../domain/types';
import { buildCannbotPayload } from '../../domain/cannbot';
import type { CannbotPayload, CannbotReportMeta, CannbotScope } from '../../domain/cannbot';
import { hasDependencies, neighborsOf } from '../../domain/dependencies';
import { resolveTimeUnitFromVisibleRange, resolveClockFreqMHz } from '../../domain/formatTime';
import { colorVarForLaneName } from '../../domain/laneColors';
import { leafRowCount } from '../../swimlane/layout';
import {
  collectLeafEventsFromModel,
  filterCollapsedTree,
} from '../../domain/swimTree';
import { t } from '../../i18n';
import DetailPanel from '../DetailPanel/DetailPanel.vue';
import EventTooltip from '../EventTooltip/EventTooltip.vue';
import {
  ASIDE_WIDTH_DEFAULT,
  fitPanelWidths,
  GUTTER_WIDTH_DEFAULT,
} from '../panelResize';
import ReportLayout from '../ReportLayout/ReportLayout.vue';
import ReportToolbar from '../ReportToolbar/ReportToolbar.vue';
import StatsAside from '../StatsAside/StatsAside.vue';
import type { GutterLane } from '../TimelineView/SwimlaneView/LaneGutter/gutterTypes';
import { animateViewWindow } from '../TimelineView/animateViewWindow';
import TimelineView from '../TimelineView/TimelineView.vue';
import '../tokens.css';

const props = withDefaults(defineProps<{
  title?: string;
  source?: ArrayBuffer | Uint8Array;
  swimlaneModel?: SwimlaneModel;
  reportModel?: ReportViewModel;
  /** cannbot payload 元信息（.rep 文件名 / 绝对路径 / id / 采集时间），宿主提供。 */
  reportMeta?: CannbotReportMeta;
  theme?: 'light' | 'dark';
  locale?: string;
  timeDisplayMode?: TimeDisplayMode;
  dependencyMode?: DependencyMode;
  dependencyDepth?: number;
  /** Force swimlane backend for perf A/B (`auto` prefers WebGL2). */
  preferRenderer?: 'auto' | 'webgl' | 'canvas';
  /** Feature gate. Omit and the adapter's own capabilities (derived from the loaded
   *  source) apply; pass an array to override them. Exposed as a data attribute for
   *  CSS/test hooking and read by the aside. */
  capabilities?: ReportCapability[];
}>(), {
  dependencyMode: 'all',
  dependencyDepth: DEFAULT_DEPENDENCY_DEPTH,
});

const emit = defineEmits<{
  ready: [];
  select: [event: SelectedEvent | null];
  error: [error: { message: string; cause?: unknown }];
  'view-full-csv': [payload: ViewFullCsvPayload];
  'open-hardware-details': [];
  'open-pipe-details': [];
  'cannbot-request': [payload: CannbotPayload];
}>();

const internalSwim = ref<SwimlaneModel | null>(null);
const internalReport = ref<ReportViewModel | null>(null);
const internalCapabilities = ref<ReportCapability[] | null>(null);
const loadError = ref<string | null>(null);
const viewState = ref<SwimlaneViewState>(createViewState(null));
const hovered = ref<SwimEvent | null>(null);
const selected = ref<SelectedEvent | null>(null);
/** Raw model event behind `selected` — the dependency walk needs its EventRefs. */
const selectedEvent = ref<SwimEvent | null>(null);
const tooltipStyle = ref({ left: '0px', top: '0px' });
const localTimeDisplayMode = ref<TimeDisplayMode>(props.timeDisplayMode ?? 'time');
const localDependencyMode = ref<DependencyMode>(props.dependencyMode);
const localDependencyDepth = ref(normalizeDependencyDepth(props.dependencyDepth));
const cursor = ref<{ time: number; xRatio: number; snapped?: boolean } | null>(null);
const timelineRef = ref<{ gutterRoot: HTMLElement | null } | null>(null);
const layoutRef = ref<{ rootEl: HTMLElement | null } | null>(null);
/** Session-only panel sizes (not persisted). User drag updates preferred; fit clamps actual. */
const preferredGutterWidth = ref(GUTTER_WIDTH_DEFAULT);
const preferredAsideWidth = ref(ASIDE_WIDTH_DEFAULT);
const gutterWidth = ref(GUTTER_WIDTH_DEFAULT);
const asideWidth = ref(ASIDE_WIDTH_DEFAULT);
const dockExpanded = ref(false);
let layoutResizeObserver: ResizeObserver | null = null;
/** Process / group ids with child lanes collapsed in gutter + canvas. */
const collapsedGroupIds = ref<string[]>([]);
/** Multi-operator packs: selector options + adapted reports (empty for single-op). */
const operators = ref<ReportOperator[]>([]);
/** Shallow: avoid deep-proxying every swim event in every operator pack. */
const operatorReports = shallowRef<Record<string, AdaptedReport>>({});
const selectedOperatorId = ref<string | null>(null);

const swim = computed(() => props.swimlaneModel ?? internalSwim.value);
const report = computed(() => props.reportModel ?? internalReport.value);
/** Host-managed mode has no adapter to ask, so adapter flags must not survive the switch. */
const hostManaged = computed(() => props.swimlaneModel != null || props.reportModel != null);
/** Host prop wins; otherwise the ones the adapter derived from the loaded source. */
const caps = computed<ReportCapability[]>(() => {
  if (props.capabilities) return props.capabilities;
  if (hostManaged.value) return [];
  return internalCapabilities.value ?? [];
});
const viewportTimeScaleUnit = computed<TimeScaleUnit>(() =>
  resolveTimeUnitFromVisibleRange(viewState.value.endTime - viewState.value.startTime),
);
const clockFreqMHz = computed(() => resolveClockFreqMHz(report.value?.summary));

const showOverview = computed(() => (report.value?.overviewSeries?.length ?? 0) > 0);
/** Toolbar toggle + initial asideVisible share this gate (includes CSV-only reports). */
const asideAvailable = computed(() => reportHasAsideContent(report.value));
const showAside = computed(() => viewState.value.asideVisible && asideAvailable.value);
const showTimeline = computed(() => loadError.value == null && swim.value != null);

function toGutterLane(thread: SwimThread): GutterLane {
  const lane: GutterLane = {
    id: thread.id,
    name: thread.name,
    utilization: thread.utilization,
    color: colorVarForLaneName(thread.name),
    categoryKey: thread.categoryKey,
  };
  if (thread.children !== undefined) {
    lane.children = thread.children.map(toGutterLane);
  } else {
    lane.rowCount = leafRowCount(thread);
  }
  return lane;
}

const laneGroups = computed(() =>
  (swim.value?.processes ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    lanes: p.threads.map(toGutterLane),
  })),
);

/** Swim model with collapsed Cards/folders pruned so canvas row heights match gutter. */
const displaySwim = computed((): SwimlaneModel | null => {
  const m = swim.value;
  if (!m) return null;
  return filterCollapsedTree(m, collapsedGroupIds.value);
});

const bounds = computed(() => {
  const m = swim.value;
  if (!m) return { minTime: 0, maxTime: 1 };
  return {
    minTime: m.minTime,
    maxTime: m.maxTime > m.minTime ? m.maxTime : m.minTime + 1,
  };
});

/** Log zoom: 0 = fit, 100 = min window (same floor as Ctrl+wheel / zoomAt). */
const zoomPercent = computed(() =>
  zoomPercentFromSpan(
    viewState.value.endTime - viewState.value.startTime,
    bounds.value.maxTime - bounds.value.minTime,
  ),
);

let cancelViewWindowAnim: () => void = () => {};

function stopViewWindowAnim() {
  cancelViewWindowAnim();
  cancelViewWindowAnim = () => {};
}

function animateToWindow(window: { startTime: number; endTime: number; scrollY: number }) {
  stopViewWindowAnim();
  const from = {
    startTime: viewState.value.startTime,
    endTime: viewState.value.endTime,
  };
  const scrollY = window.scrollY;
  cancelViewWindowAnim = animateViewWindow({
    from,
    to: { startTime: window.startTime, endTime: window.endTime },
    onUpdate: (w) => {
      viewState.value = applyWindow(viewState.value, {
        ...w,
        scrollY,
      });
    },
    onDone: () => {
      cancelViewWindowAnim = () => {};
    },
  });
}

function onFocusMeasure() {
  const range = viewState.value.measureRange;
  if (!range) return;
  const target = measureFocusWindow(range, bounds.value, viewState.value.scrollY);
  animateToWindow(target);
}

function resetPanelWidthsToDefaults(): void {
  preferredGutterWidth.value = GUTTER_WIDTH_DEFAULT;
  preferredAsideWidth.value = ASIDE_WIDTH_DEFAULT;
  gutterWidth.value = GUTTER_WIDTH_DEFAULT;
  asideWidth.value = ASIDE_WIDTH_DEFAULT;
}

function resetViewFromModel(
  model: SwimlaneModel | null,
  showAsidePanel: boolean,
  opts?: { preservePanelWidths?: boolean },
): void {
  stopViewWindowAnim();
  const next = createViewState(model);
  next.asideVisible = showAsidePanel;
  viewState.value = next;
  selected.value = null;
  selectedEvent.value = null;
  hovered.value = null;
  // Operator switches keep session gutter/aside preferences; fresh loads reset them.
  if (!opts?.preservePanelWidths) resetPanelWidthsToDefaults();
  const fromMeta = model?.metadata?.defaultCollapsedIds;
  collapsedGroupIds.value = Array.isArray(fromMeta)
    ? fromMeta.filter((id): id is string => typeof id === 'string')
    : [];
  if (showTimeline.value) void bindLayoutFit();
}

function stopLayoutFitObserver(): void {
  layoutResizeObserver?.disconnect();
  layoutResizeObserver = null;
}

function applyLayoutFit(): void {
  const el = layoutRef.value?.rootEl;
  if (!el) return;
  const hostWidth = el.clientWidth;
  if (!(hostWidth > 0)) return;
  const next = fitPanelWidths(hostWidth, {
    asideVisible: showAside.value,
    preferredGutter: preferredGutterWidth.value,
    preferredAside: preferredAsideWidth.value,
  });
  if (next.gutterWidth !== gutterWidth.value) gutterWidth.value = next.gutterWidth;
  if (next.asideWidth !== asideWidth.value) asideWidth.value = next.asideWidth;
}

async function bindLayoutFit(): Promise<void> {
  stopLayoutFitObserver();
  await nextTick();
  const el = layoutRef.value?.rootEl;
  if (!el) return;
  applyLayoutFit();
  if (typeof ResizeObserver === 'undefined') return;
  layoutResizeObserver = new ResizeObserver(() => {
    applyLayoutFit();
  });
  layoutResizeObserver.observe(el);
}

function onGutterWidth(w: number): void {
  preferredGutterWidth.value = w;
  gutterWidth.value = w;
}

function onAsideWidth(w: number): void {
  preferredAsideWidth.value = w;
  asideWidth.value = w;
  // Re-fit so a drag that would starve the track is clamped in the same turn.
  applyLayoutFit();
}

function onToggleGroup(groupId: string): void {
  const set = new Set(collapsedGroupIds.value);
  if (set.has(groupId)) set.delete(groupId);
  else set.add(groupId);
  collapsedGroupIds.value = [...set];
  // Keep scroll within new content height
  const el = timelineRef.value?.gutterRoot;
  if (el) {
    viewState.value = { ...viewState.value, scrollY: Math.min(viewState.value.scrollY, el.scrollHeight) };
  }
}

function onPinLane(laneId: string): void {
  viewState.value = pinLane(viewState.value, laneId);
}

function onUnpinLane(laneId: string): void {
  viewState.value = unpinLane(viewState.value, laneId);
}

/**
 * Aside has content when any of: duration card, I/O bandwidth cards,
 * pipe occupancy, compute/memory CSV tables, roofline points, or hardware details are present.
 * Name/type alone do not open the aside (DATA-33a). Must stay in sync with StatsAside.
 */
function reportHasAsideContent(rm: ReportViewModel | null | undefined): boolean {
  if (!rm) return false;
  const hasDuration = rm.summary.taskDurationUs != null;
  const hasBandwidth = (rm.bandwidthCards ?? []).length > 0;
  const hasPipe = rm.pipeOccupancy.length > 0;
  const hasComputeTables = rm.computeTables.length > 0;
  const hasMemoryTables = rm.memoryTables.length > 0;
  const hasRoofline = (rm.roofline?.points?.length ?? 0) > 0;
  const hasHardware = (rm.hardwareDetails?.sections.length ?? 0) > 0;
  const hasTopology = (rm.memoryTopology?.edges.some((e) => e.label) ?? false);
  return (
    hasDuration ||
    hasBandwidth ||
    hasPipe ||
    hasComputeTables ||
    hasMemoryTables ||
    hasRoofline ||
    hasHardware ||
    hasTopology
  );
}

function loadFromSource(source: ArrayBuffer | Uint8Array) {
  try {
    const adapted = loadReportSource(source);
    operators.value = adapted.operators ?? [];
    operatorReports.value = adapted.operatorReports ?? {};
    selectedOperatorId.value = adapted.selectedOperatorId ?? null;
    internalSwim.value = adapted.swimlaneModel;
    internalReport.value = adapted.reportModel;
    internalCapabilities.value = adapted.capabilities ?? null;
    resetViewFromModel(adapted.swimlaneModel, reportHasAsideContent(adapted.reportModel));
    loadError.value = null;
    emit('ready');
  } catch (cause) {
    operators.value = [];
    operatorReports.value = {};
    selectedOperatorId.value = null;
    internalSwim.value = null;
    internalReport.value = null;
    internalCapabilities.value = null;
    selected.value = null;
    selectedEvent.value = null;
    hovered.value = null;
    viewState.value = createViewState(null);
    loadError.value = cause instanceof Error ? cause.message : String(cause);
    emit('error', { message: loadError.value, cause });
  }
}

/** Swap the swimlane/report to another packaged operator without re-parsing the container. */
function onOperatorChange(id: string) {
  const rep = operatorReports.value[id];
  if (!rep || id === selectedOperatorId.value) return;
  selectedOperatorId.value = id;
  internalSwim.value = rep.swimlaneModel;
  internalReport.value = rep.reportModel;
  internalCapabilities.value = rep.capabilities ?? null;
  // Viewport/selection reset like a fresh load, but keep aside open/closed and panel widths.
  resetViewFromModel(rep.swimlaneModel, viewState.value.asideVisible, {
    preservePanelWidths: true,
  });
}

/** Parse before first paint when `source` is already available (avoids empty→loaded height jump). */
watch(
  () => props.source,
  (src) => {
    if (src) {
      loadFromSource(src);
      return;
    }
    // Source removed: drop what the adapter derived, or its flags outlive the report.
    operators.value = [];
    operatorReports.value = {};
    selectedOperatorId.value = null;
    internalSwim.value = null;
    internalReport.value = null;
    internalCapabilities.value = null;
  },
  { immediate: true },
);

watch(
  () => props.swimlaneModel,
  (m) => {
    if (m && !props.source) {
      resetViewFromModel(m, reportHasAsideContent(props.reportModel ?? report.value));
    }
  },
);

watch(
  showTimeline,
  (show) => {
    if (show) void bindLayoutFit();
    else stopLayoutFitObserver();
  },
);

watch(showAside, () => {
  applyLayoutFit();
});

onMounted(() => {
  window.addEventListener('keydown', onMeasureKeydown);
  if (props.source) return;
  if (props.swimlaneModel || props.reportModel) {
    resetViewFromModel(props.swimlaneModel ?? null, reportHasAsideContent(props.reportModel));
    emit('ready');
  }
});

onBeforeUnmount(() => {
  cancelViewWindowAnim();
  stopLayoutFitObserver();
  window.removeEventListener('keydown', onMeasureKeydown);
});

function onMeasureKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && (viewState.value.measureMode || viewState.value.measureRange)) {
    viewState.value = clearMeasure(viewState.value);
  }
}

/**
 * Effective display mode: host prop when set, else the toolbar's local choice.
 * Clamp `'cycles'` → `'time'` only when OpBasicInfo freq is missing — never treat
 * an omitted host prop as an explicit `'time'` write (that would wipe a toolbar
 * cycles selection on every freq change, e.g. operator switch / report reload).
 */
watch(
  [() => props.timeDisplayMode, clockFreqMHz],
  ([mode, freq]) => {
    if (mode != null) {
      localTimeDisplayMode.value = mode === 'cycles' && freq == null ? 'time' : mode;
      return;
    }
    if (localTimeDisplayMode.value === 'cycles' && freq == null) {
      localTimeDisplayMode.value = 'time';
    }
  },
  { immediate: true },
);

watch(
  () => props.dependencyMode,
  (m) => {
    if (m) localDependencyMode.value = m;
  },
);

watch(
  () => props.dependencyDepth,
  (d) => {
    if (d != null) localDependencyDepth.value = normalizeDependencyDepth(d);
  },
);

function onSelect(ev: SwimEvent | null) {
  if (!ev) {
    selected.value = null;
    selectedEvent.value = null;
    viewState.value = { ...viewState.value, selectedEventId: null };
    emit('select', null);
    return;
  }
  const payload: SelectedEvent = {
    id: ev.id,
    name: ev.name,
    startTime: ev.startTime,
    duration: ev.duration,
    endTime: ev.startTime + ev.duration,
    args: ev.args,
  };
  selected.value = payload;
  selectedEvent.value = ev;
  viewState.value = { ...viewState.value, selectedEventId: ev.id };
  emit('select', payload);
}

function onHover(ev: SwimEvent | null, clientX: number, clientY: number) {
  hovered.value = ev;
  viewState.value = { ...viewState.value, hoveredEventId: ev?.id ?? null };
  if (ev) {
    tooltipStyle.value = {
      left: `${clientX + 12}px`,
      top: `${clientY + 12}px`,
    };
  }
}

function onCursor(payload: { time: number; xRatio: number; snapped?: boolean } | null) {
  cursor.value = payload;
}

function onSetPlayhead(time: number) {
  viewState.value = { ...viewState.value, playheadTime: time };
}

function onOverviewWindow(window: { startTime: number; endTime: number }) {
  stopViewWindowAnim();
  viewState.value = applyWindow(viewState.value, {
    ...window,
    scrollY: viewState.value.scrollY,
  });
}

function onScrollY(scrollY: number) {
  viewState.value = { ...viewState.value, scrollY: Math.max(0, scrollY) };
}

function onPan(deltaTime: number) {
  stopViewWindowAnim();
  viewState.value = applyWindow(
    viewState.value,
    panBy(viewState.value, deltaTime, bounds.value),
  );
}

function onZoom(factor: number, anchorTime: number) {
  stopViewWindowAnim();
  viewState.value = applyWindow(
    viewState.value,
    zoomAt(viewState.value, factor, anchorTime, bounds.value),
  );
}

function onZoomToFit() {
  animateToWindow(zoomToFitWindow(swim.value));
}

function onZoomIn() {
  const mid = (viewState.value.startTime + viewState.value.endTime) / 2;
  onZoom(1.25, mid);
}

function onZoomOut() {
  const mid = (viewState.value.startTime + viewState.value.endTime) / 2;
  onZoom(1 / 1.25, mid);
}

function onZoomPercent(pct: number) {
  stopViewWindowAnim();
  const full = bounds.value.maxTime - bounds.value.minTime;
  const span = spanFromZoomPercent(pct, full);
  const mid = (viewState.value.startTime + viewState.value.endTime) / 2;
  let startTime = mid - span / 2;
  let endTime = mid + span / 2;
  if (startTime < bounds.value.minTime) {
    startTime = bounds.value.minTime;
    endTime = startTime + span;
  }
  if (endTime > bounds.value.maxTime) {
    endTime = bounds.value.maxTime;
    startTime = endTime - span;
  }
  viewState.value = applyWindow(viewState.value, {
    startTime,
    endTime,
    scrollY: viewState.value.scrollY,
  });
}

function onSearch(q: string) {
  viewState.value = { ...viewState.value, searchQuery: q };
}

function onAside(visible: boolean) {
  viewState.value = { ...viewState.value, asideVisible: visible };
}

function onCannbot(scope: CannbotScope) {
  emit('cannbot-request', buildCannbotPayload(scope, report.value, props.reportMeta));
}

function onMeasureMode(enabled: boolean) {
  viewState.value = setMeasureMode(viewState.value, enabled);
}

function onMeasureRange(range: MeasureRange | null) {
  viewState.value = setMeasureRange(viewState.value, range);
}

function onTimeDisplayMode(mode: TimeDisplayMode) {
  localTimeDisplayMode.value = mode;
}

function onDependencyMode(mode: DependencyMode) {
  localDependencyMode.value = mode;
}

function onDependencyDepth(depth: number) {
  localDependencyDepth.value = normalizeDependencyDepth(depth);
}

/**
 * Detail-dock neighbours of the selection, walked over the same
 * `SwimEvent.dependencies` refs the swimlane curves use, with the same mode and
 * depth. The cheap `hasDependencies` scan gates it so reports with no edges never
 * pay for the lane index.
 *
 * `undefined` (not an empty pair) so DetailPanel hides the column entirely.
 */
const dependencyNeighbors = computed(() => {
  const ev = selectedEvent.value;
  if (!ev || !hasDependencies(swim.value)) return undefined;
  // One hop: the dock lists what this event directly waits on and feeds. Depth is a
  // 显示控制 setting for the swimlane graph and deliberately does not reach here.
  return neighborsOf(swim.value, ev, localDependencyMode.value, DEFAULT_DEPENDENCY_DEPTH);
});

/** Used by component tests to select an event without canvas pointer geometry. */
function selectEventById(eventId: string) {
  const ev = swim.value
    ? collectLeafEventsFromModel(swim.value).find((e) => e.id === eventId)
    : undefined;
  onSelect(ev ?? null);
}

defineExpose({ selectEventById, viewState, selectedOperatorId });
</script>

<template>
  <div
    class="pr-root"
    data-testid="profiling-report"
    :data-theme="theme ?? 'dark'"
    :data-capabilities="caps.join(',')"
  >
    <ReportToolbar
      v-if="!showTimeline"
      :title="title"
      :search-query="viewState.searchQuery"
      :aside-visible="viewState.asideVisible"
      :aside-available="asideAvailable"
      :zoom-percent="zoomPercent"
      :time-display-mode="localTimeDisplayMode"
      :clock-freq-m-hz="clockFreqMHz"
      :dependency-mode="localDependencyMode"
      :dependency-depth="localDependencyDepth"
      :locale="locale"
      :measure-mode="viewState.measureMode"
      :operators="operators"
      :selected-operator-id="selectedOperatorId"
      @update:search-query="onSearch"
      @update:selected-operator-id="onOperatorChange"
      @update:aside-visible="onAside"
      @update:time-display-mode="onTimeDisplayMode"
      @update:dependency-mode="onDependencyMode"
      @update:dependency-depth="onDependencyDepth"
      @update:zoom-percent="onZoomPercent"
      @update:measure-mode="onMeasureMode"
      @zoom-to-fit="onZoomToFit"
      @zoom-in="onZoomIn"
      @zoom-out="onZoomOut"
    />

    <p
      v-if="loadError"
      class="pr-error"
      data-testid="load-error"
    >
      {{ loadError }}
    </p>

    <p
      v-else-if="!showTimeline"
      class="pr-error"
      data-testid="no-timeline"
    >
      {{ t('noTimeline', locale) }}
    </p>

    <ReportLayout
      v-else
      ref="layoutRef"
      :show-aside="showAside"
      :aside-width="asideWidth"
      :locale="locale"
      @update:aside-width="onAsideWidth"
    >
      <template #main>
        <ReportToolbar
          :title="title"
          :search-query="viewState.searchQuery"
          :aside-visible="viewState.asideVisible"
          :aside-available="asideAvailable"
          :zoom-percent="zoomPercent"
          :time-display-mode="localTimeDisplayMode"
          :clock-freq-m-hz="clockFreqMHz"
          :dependency-depth="localDependencyDepth"
          :locale="locale"
          :measure-mode="viewState.measureMode"
          :operators="operators"
          :selected-operator-id="selectedOperatorId"
          @update:search-query="onSearch"
          @update:selected-operator-id="onOperatorChange"
          @update:aside-visible="onAside"
          @update:time-display-mode="onTimeDisplayMode"
          @update:dependency-depth="onDependencyDepth"
          @update:zoom-percent="onZoomPercent"
          @update:measure-mode="onMeasureMode"
          @zoom-to-fit="onZoomToFit"
          @zoom-in="onZoomIn"
          @zoom-out="onZoomOut"
        />
        <TimelineView
          ref="timelineRef"
          :bounds="bounds"
          :view="viewState"
          :time-scale-unit="viewportTimeScaleUnit"
          :dependency-mode="localDependencyMode"
          :dependency-depth="localDependencyDepth"
          :groups="laneGroups"
          :collapsed-ids="collapsedGroupIds"
          :pinned-lane-ids="viewState.pinnedLaneIds"
          :display-swim="displaySwim"
          :pin-source-model="swim"
          :cursor="cursor"
          :show-overview-charts="showOverview"
          :gutter-width="gutterWidth"
          :prefer-renderer="preferRenderer ?? 'auto'"
          :locale="locale"
          @update:gutter-width="onGutterWidth"
          @update:scroll-y="onScrollY"
          @update:window="onOverviewWindow"
          @toggle-group="onToggleGroup"
          @pin-lane="onPinLane"
          @unpin-lane="onUnpinLane"
          @select="onSelect"
          @hover="onHover"
          @cursor="onCursor"
          @set-playhead="onSetPlayhead"
          @pan="onPan"
          @zoom="onZoom"
          @update:measure-range="onMeasureRange"
          @focus-measure="onFocusMeasure"
        />
      </template>

      <template #aside>
        <StatsAside
          :report="report"
          :locale="locale"
          :capabilities="caps"
          @close="onAside(false)"
          @view-full-csv="emit('view-full-csv', $event)"
          @open-hardware-details="emit('open-hardware-details')"
          @open-pipe-details="emit('open-pipe-details')"
          @open-cannbot="onCannbot"
        />
      </template>
    </ReportLayout>

    <Transition name="pr-dock">
      <DetailPanel
        v-if="selected && showTimeline"
        :selected="selected"
        :time-display-mode="localTimeDisplayMode"
        :clock-freq-m-hz="clockFreqMHz"
        :time-origin="bounds.minTime"
        :locale="locale"
        :neighbors="dependencyNeighbors"
        :dependency-mode="localDependencyMode"
        :expanded="dockExpanded"
        @close="onSelect(null)"
        @update:expanded="dockExpanded = $event"
        @update:dependency-mode="onDependencyMode"
      />
    </Transition>

    <EventTooltip
      v-if="hovered && showTimeline"
      :event="hovered"
      :style-pos="tooltipStyle"
      :time-display-mode="localTimeDisplayMode"
      :clock-freq-m-hz="clockFreqMHz"
      :time-origin="bounds.minTime"
      :locale="locale"
    />
  </div>
</template>

<style scoped>
.pr-root {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  height: 100%;
  min-height: 240px;
  padding: 0;
  color: #e8e8e8;
  background: var(--pr-bg-deep);
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 12px;
  overflow: hidden;
}

.pr-error {
  margin: 0;
  padding: 6px 10px;
  color: #f88;
  flex: 0 0 auto;
}
</style>
