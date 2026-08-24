<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { loadReportSource } from '../../adapters';
import {
  applyWindow,
  clearMeasure,
  createViewState,
  measureFocusWindow,
  panBy,
  setMeasureMode,
  setMeasureRange,
  spanFromZoomPercent,
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
  type TimeDisplayUnit,
  type ViewFullCsvPayload,
} from '../../domain/types';
import { hasDependencies, neighborsOf } from '../../domain/dependencies';
import { colorVarForLaneName } from '../../domain/laneColors';
import {
  collectLeafEventsFromModel,
  filterCollapsedTree,
} from '../../domain/swimTree';
import { t } from '../../i18n';
import DetailPanel from '../DetailPanel/DetailPanel.vue';
import EventTooltip from '../EventTooltip/EventTooltip.vue';
import {
  ASIDE_WIDTH_DEFAULT,
  DOCK_HEIGHT_DEFAULT,
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
  theme?: 'light' | 'dark';
  locale?: string;
  timeUnit?: TimeDisplayUnit;
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
const localTimeUnit = ref<TimeDisplayUnit>(props.timeUnit ?? 'ms');
const localDependencyMode = ref<DependencyMode>(props.dependencyMode);
const localDependencyDepth = ref(normalizeDependencyDepth(props.dependencyDepth));
const cursor = ref<{ time: number; xRatio: number } | null>(null);
const timelineRef = ref<{ gutterRoot: HTMLElement | null } | null>(null);
/** Session-only panel sizes (not persisted). */
const gutterWidth = ref(GUTTER_WIDTH_DEFAULT);
const asideWidth = ref(ASIDE_WIDTH_DEFAULT);
const dockHeight = ref(DOCK_HEIGHT_DEFAULT);
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
const unit = computed<TimeDisplayUnit>(() => localTimeUnit.value);

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
  };
  if (thread.children !== undefined) {
    lane.children = thread.children.map(toGutterLane);
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

function resetViewFromModel(model: SwimlaneModel | null, showAsidePanel: boolean): void {
  stopViewWindowAnim();
  const next = createViewState(model);
  next.asideVisible = showAsidePanel;
  viewState.value = next;
  selected.value = null;
  selectedEvent.value = null;
  hovered.value = null;
  const fromMeta = model?.metadata?.defaultCollapsedIds;
  collapsedGroupIds.value = Array.isArray(fromMeta)
    ? fromMeta.filter((id): id is string => typeof id === 'string')
    : [];
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

/**
 * Aside has content when any of: duration card, I/O bandwidth cards,
 * pipe occupancy, compute/memory CSV tables, roofline points, or hardware details are present.
 * Name/type alone do not open the aside (I-Q6a). Must stay in sync with StatsAside.
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
  resetViewFromModel(rep.swimlaneModel, reportHasAsideContent(rep.reportModel));
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
  window.removeEventListener('keydown', onMeasureKeydown);
});

function onMeasureKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && (viewState.value.measureMode || viewState.value.measureRange)) {
    viewState.value = clearMeasure(viewState.value);
  }
}

watch(
  () => props.timeUnit,
  (u) => {
    if (u) localTimeUnit.value = u;
  },
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

function onCursor(payload: { time: number; xRatio: number } | null) {
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

function onMeasureMode(enabled: boolean) {
  viewState.value = setMeasureMode(viewState.value, enabled);
}

function onMeasureRange(range: MeasureRange | null) {
  viewState.value = setMeasureRange(viewState.value, range);
}

function onTimeUnit(u: TimeDisplayUnit) {
  localTimeUnit.value = u;
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
    <div
      class="pr-root__corner-wash"
      data-testid="corner-wash"
      aria-hidden="true"
    />
    <ReportToolbar
      v-if="!showTimeline"
      :title="title"
      :search-query="viewState.searchQuery"
      :aside-visible="viewState.asideVisible"
      :aside-available="asideAvailable"
      :zoom-percent="zoomPercent"
      :time-unit="unit"
      :dependency-mode="localDependencyMode"
      :dependency-depth="localDependencyDepth"
      :locale="locale"
      :measure-mode="viewState.measureMode"
      :operators="operators"
      :selected-operator-id="selectedOperatorId"
      @update:search-query="onSearch"
      @update:selected-operator-id="onOperatorChange"
      @update:aside-visible="onAside"
      @update:time-unit="onTimeUnit"
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
      :show-aside="showAside"
      :aside-width="asideWidth"
      @update:aside-width="asideWidth = $event"
    >
      <template #main>
        <ReportToolbar
          :title="title"
          :search-query="viewState.searchQuery"
          :aside-visible="viewState.asideVisible"
          :aside-available="asideAvailable"
          :zoom-percent="zoomPercent"
          :time-unit="unit"
          :dependency-depth="localDependencyDepth"
          :locale="locale"
          :measure-mode="viewState.measureMode"
          :operators="operators"
          :selected-operator-id="selectedOperatorId"
          @update:search-query="onSearch"
          @update:selected-operator-id="onOperatorChange"
          @update:aside-visible="onAside"
          @update:time-unit="onTimeUnit"
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
          :unit="unit"
          :dependency-mode="localDependencyMode"
          :dependency-depth="localDependencyDepth"
          :groups="laneGroups"
          :collapsed-ids="collapsedGroupIds"
          :display-swim="displaySwim"
          :cursor="cursor"
          :show-overview-charts="showOverview"
          :gutter-width="gutterWidth"
          :prefer-renderer="preferRenderer ?? 'auto'"
          @update:gutter-width="gutterWidth = $event"
          @update:scroll-y="onScrollY"
          @update:window="onOverviewWindow"
          @toggle-group="onToggleGroup"
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
        />
      </template>
    </ReportLayout>

    <DetailPanel
      v-if="selected && showTimeline"
      :selected="selected"
      :unit="unit"
      :locale="locale"
      :neighbors="dependencyNeighbors"
      :dependency-mode="localDependencyMode"
      :height="dockHeight"
      @close="onSelect(null)"
      @update:height="dockHeight = $event"
      @update:dependency-mode="onDependencyMode"
    />

    <EventTooltip
      v-if="hovered && showTimeline"
      :event="hovered"
      :style-pos="tooltipStyle"
      :unit="unit"
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

/** Top-left accent wash behind OP selector / tab strip (v930 sketch). */
.pr-root__corner-wash {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  width: 208px;
  height: 60px;
  background: linear-gradient(
    90deg,
    rgba(0, 90, 219, 0.1) 3.614%,
    rgba(0, 2, 172, 0) 76.501%
  );
  pointer-events: none;
}

.pr-error {
  margin: 0;
  padding: 6px 10px;
  color: #f88;
  flex: 0 0 auto;
}
</style>
