<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { loadReportSource } from '../../adapters';
import {
  applyWindow,
  clearMeasure,
  createViewState,
  panBy,
  setMeasureMode,
  setMeasureRange,
  zoomAt,
  zoomToFitWindow,
} from '../../domain/viewState';
import type {
  MeasureRange,
  ReportCapability,
  ReportViewModel,
  SelectedEvent,
  SwimEvent,
  SwimlaneModel,
  SwimlaneViewState,
  SwimThread,
  TimeDisplayUnit,
  DependencyMode,
  ViewFullCsvPayload,
} from '../../domain/types';
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
  GUTTER_WIDTH_DEFAULT,
} from '../panelResize';
import ReportLayout from '../ReportLayout/ReportLayout.vue';
import ReportToolbar from '../ReportToolbar/ReportToolbar.vue';
import StatsAside from '../StatsAside/StatsAside.vue';
import type { GutterLane } from '../TimelineView/SwimlaneView/LaneGutter/gutterTypes';
import TimelineView from '../TimelineView/TimelineView.vue';
import '../tokens.css';

const props = defineProps<{
  title?: string;
  source?: ArrayBuffer | Uint8Array;
  swimlaneModel?: SwimlaneModel;
  reportModel?: ReportViewModel;
  theme?: 'light' | 'dark';
  locale?: string;
  timeUnit?: TimeDisplayUnit;
  dependencyMode?: DependencyMode;
  /** Force swimlane backend for perf A/B (`auto` prefers WebGL2). */
  preferRenderer?: 'auto' | 'webgl' | 'canvas';
  /** Future feature-gate: controls which sub-panels/tabs are rendered. Currently exposed
   *  as a data attribute for CSS/test hooking; intended to drive conditional sections
   *  (roofline, memory diagram, etc.) once those views land. */
  capabilities?: ReportCapability[];
}>();

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
const loadError = ref<string | null>(null);
const viewState = ref<SwimlaneViewState>(createViewState(null));
const hovered = ref<SwimEvent | null>(null);
const selected = ref<SelectedEvent | null>(null);
const tooltipStyle = ref({ left: '0px', top: '0px' });
const localTimeUnit = ref<TimeDisplayUnit>(props.timeUnit ?? 'ms');
const localDependencyMode = ref<DependencyMode>(props.dependencyMode ?? 'all');
const cursor = ref<{ time: number; xRatio: number } | null>(null);
const timelineRef = ref<{ gutterRoot: HTMLElement | null } | null>(null);
/** Session-only panel widths (not persisted). */
const gutterWidth = ref(GUTTER_WIDTH_DEFAULT);
const asideWidth = ref(ASIDE_WIDTH_DEFAULT);
/** Process / group ids with child lanes collapsed in gutter + canvas. */
const collapsedGroupIds = ref<string[]>([]);

const swim = computed(() => props.swimlaneModel ?? internalSwim.value);
const report = computed(() => props.reportModel ?? internalReport.value);
const unit = computed<TimeDisplayUnit>(() => localTimeUnit.value);
const depMode = computed<DependencyMode>(() => localDependencyMode.value);

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

/** Cursor MM:SS.mmm unit — finer than toolbar ms when the trace span is sub-ms. */
/** 0 = fit (full span); 100 = max zoom (~1/100 of full span). */
const zoomPercent = computed(() => {
  const full = bounds.value.maxTime - bounds.value.minTime;
  const span = Math.max(1, viewState.value.endTime - viewState.value.startTime);
  if (span >= full) return 0;
  const ratio = full / span;
  return Math.min(100, Math.round((Math.log2(ratio) / Math.log2(100)) * 100));
});

function resetViewFromModel(model: SwimlaneModel | null, showAsidePanel: boolean): void {
  const next = createViewState(model);
  next.asideVisible = showAsidePanel;
  viewState.value = next;
  selected.value = null;
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
 * Aside has content when any of: duration card, pipe occupancy,
 * compute/memory CSV tables, roofline points, or hardware details are present.
 * Name/type alone do not open the aside (I-Q6a). Must stay in sync with StatsAside.
 */
function reportHasAsideContent(rm: ReportViewModel | null | undefined): boolean {
  if (!rm) return false;
  const hasDuration = rm.summary.taskDurationUs != null;
  const hasPipe = rm.pipeOccupancy.length > 0;
  const hasComputeTables = rm.computeTables.length > 0;
  const hasMemoryTables = rm.memoryTables.length > 0;
  const hasRoofline = (rm.roofline?.points?.length ?? 0) > 0;
  const hasHardware = (rm.hardwareDetails?.sections.length ?? 0) > 0;
  return (
    hasDuration ||
    hasPipe ||
    hasComputeTables ||
    hasMemoryTables ||
    hasRoofline ||
    hasHardware
  );
}

function loadFromSource(source: ArrayBuffer | Uint8Array) {
  try {
    const adapted = loadReportSource(source);
    internalSwim.value = adapted.swimlaneModel;
    internalReport.value = adapted.reportModel;
    resetViewFromModel(adapted.swimlaneModel, reportHasAsideContent(adapted.reportModel));
    loadError.value = null;
    emit('ready');
  } catch (cause) {
    internalSwim.value = null;
    internalReport.value = null;
    selected.value = null;
    hovered.value = null;
    viewState.value = createViewState(null);
    loadError.value = cause instanceof Error ? cause.message : String(cause);
    emit('error', { message: loadError.value, cause });
  }
}

/** Parse before first paint when `source` is already available (avoids empty→loaded height jump). */
watch(
  () => props.source,
  (src) => {
    if (src) loadFromSource(src);
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

function onSelect(ev: SwimEvent | null) {
  if (!ev) {
    selected.value = null;
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
  viewState.value = applyWindow(viewState.value, {
    ...window,
    scrollY: viewState.value.scrollY,
  });
}

function onScrollY(scrollY: number) {
  viewState.value = { ...viewState.value, scrollY: Math.max(0, scrollY) };
}

function onPan(deltaTime: number) {
  viewState.value = applyWindow(
    viewState.value,
    panBy(viewState.value, deltaTime, bounds.value),
  );
}

function onZoom(factor: number, anchorTime: number) {
  viewState.value = applyWindow(
    viewState.value,
    zoomAt(viewState.value, factor, anchorTime, bounds.value),
  );
}

function onZoomToFit() {
  viewState.value = applyWindow(viewState.value, zoomToFitWindow(swim.value));
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
  const full = bounds.value.maxTime - bounds.value.minTime;
  const ratio = 2 ** ((pct / 100) * Math.log2(100));
  const span = Math.max(1, full / Math.max(1, ratio));
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

/** Used by component tests to select an event without canvas pointer geometry. */
function selectEventById(eventId: string) {
  const ev = swim.value
    ? collectLeafEventsFromModel(swim.value).find((e) => e.id === eventId)
    : undefined;
  onSelect(ev ?? null);
}

defineExpose({ selectEventById, viewState });
</script>

<template>
  <div
    class="pr-root"
    data-testid="profiling-report"
    :data-theme="theme ?? 'dark'"
    :data-capabilities="(capabilities ?? []).join(',')"
  >
    <ReportToolbar
      v-if="!showTimeline"
      :title="title"
      :search-query="viewState.searchQuery"
      :aside-visible="viewState.asideVisible"
      :aside-available="asideAvailable"
      :zoom-percent="zoomPercent"
      :time-unit="unit"
      :dependency-mode="depMode"
      :locale="locale"
      :measure-mode="viewState.measureMode"
      @update:search-query="onSearch"
      @update:aside-visible="onAside"
      @update:time-unit="onTimeUnit"
      @update:dependency-mode="onDependencyMode"
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
          :dependency-mode="depMode"
          :locale="locale"
          :measure-mode="viewState.measureMode"
          @update:search-query="onSearch"
          @update:aside-visible="onAside"
          @update:time-unit="onTimeUnit"
          @update:dependency-mode="onDependencyMode"
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
          :dependency-mode="depMode"
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
        />
      </template>

      <template #aside>
        <StatsAside
          :report="report"
          :locale="locale"
          :capabilities="capabilities"
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
