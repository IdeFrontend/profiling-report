<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { loadReportSource } from '../../adapters';
import { formatAxisTime, formatCursorTime } from '../../domain/formatTime';
import { colorVarForLaneName } from '../../domain/laneColors';
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
  TimeDisplayUnit,
} from '../../domain/types';
import { t } from '../../i18n';
import SwimlaneCanvas from '../../swimlane/SwimlaneCanvas/SwimlaneCanvas.vue';
import DetailStrip from '../DetailStrip/DetailStrip.vue';
import EventTooltip from '../EventTooltip/EventTooltip.vue';
import LaneGutter from '../LaneGutter/LaneGutter.vue';
import ReportLayout from '../ReportLayout/ReportLayout.vue';
import ReportToolbar from '../ReportToolbar/ReportToolbar.vue';
import StatsAside from '../StatsAside/StatsAside.vue';
import TimeOverviewBar from '../TimeOverviewBar/TimeOverviewBar.vue';
import '../tokens.css';

const props = defineProps<{
  title?: string;
  source?: ArrayBuffer | Uint8Array;
  swimlaneModel?: SwimlaneModel;
  reportModel?: ReportViewModel;
  theme?: 'light' | 'dark';
  locale?: string;
  timeUnit?: TimeDisplayUnit;
  /** Future feature-gate: controls which sub-panels/tabs are rendered. Currently exposed
   *  as a data attribute for CSS/test hooking; intended to drive conditional sections
   *  (roofline, memory diagram, etc.) once those views land. */
  capabilities?: ReportCapability[];
}>();

const emit = defineEmits<{
  ready: [];
  select: [event: SelectedEvent | null];
  error: [error: { message: string; cause?: unknown }];
  'view-full-csv': [payload: { fileName: string; text: string }];
}>();

const internalSwim = ref<SwimlaneModel | null>(null);
const internalReport = ref<ReportViewModel | null>(null);
const loadError = ref<string | null>(null);
const viewState = ref<SwimlaneViewState>(createViewState(null));
const hovered = ref<SwimEvent | null>(null);
const selected = ref<SelectedEvent | null>(null);
const tooltipStyle = ref({ left: '0px', top: '0px' });
const localTimeUnit = ref<TimeDisplayUnit>(props.timeUnit ?? 'ms');
const cursor = ref<{ time: number; xRatio: number } | null>(null);
const gutterRef = ref<{ root: HTMLElement | null } | null>(null);

const swim = computed(() => props.swimlaneModel ?? internalSwim.value);
const report = computed(() => props.reportModel ?? internalReport.value);
const unit = computed<TimeDisplayUnit>(() => localTimeUnit.value);

const hasSummary = computed(() => {
  const s = report.value?.summary;
  return Boolean(s && (s.opName || s.opType || s.taskDurationUs != null));
});

const showPipe = computed(() => (report.value?.pipeOccupancy?.length ?? 0) > 0);
const showCompute = computed(() => (report.value?.computeTables?.length ?? 0) > 0);
const showMemory = computed(() => (report.value?.memoryTables?.length ?? 0) > 0);
const showOverview = computed(() => (report.value?.overviewSeries?.length ?? 0) > 0);
const asideAvailable = computed(
  () => hasSummary.value || showPipe.value || showCompute.value || showMemory.value,
);
const showAside = computed(() => viewState.value.asideVisible && asideAvailable.value);
const showTimeline = computed(() => loadError.value == null && swim.value != null);

const laneGroups = computed(() =>
  (swim.value?.processes ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    lanes: p.threads.map((thread) => ({
      id: thread.id,
      name: thread.name,
      utilization: thread.utilization,
      color: colorVarForLaneName(thread.name),
    })),
  })),
);

const bounds = computed(() => {
  const m = swim.value;
  if (!m) return { minTime: 0, maxTime: 1 };
  return {
    minTime: m.minTime,
    maxTime: m.maxTime > m.minTime ? m.maxTime : m.minTime + 1,
  };
});

/** 0 = fit (full span); 100 = max zoom (~1/100 of full span). */
const zoomPercent = computed(() => {
  const full = bounds.value.maxTime - bounds.value.minTime;
  const span = Math.max(1, viewState.value.endTime - viewState.value.startTime);
  if (span >= full) return 0;
  const ratio = full / span;
  return Math.min(100, Math.round((Math.log2(ratio) / Math.log2(100)) * 100));
});

const axisTicks = computed(() => {
  const { startTime, endTime } = viewState.value;
  const ticks = 5;
  const step = (endTime - startTime) / ticks;
  return Array.from({ length: ticks + 1 }, (_, i) => {
    const tm = startTime + step * i;
    return { t: tm, label: formatAxisTime(tm, unit.value, step) };
  });
});

function resetViewFromModel(model: SwimlaneModel | null, showAsidePanel: boolean): void {
  const next = createViewState(model);
  next.asideVisible = showAsidePanel;
  viewState.value = next;
  selected.value = null;
  hovered.value = null;
}

function asideHasContent(rm: ReportViewModel | null | undefined): boolean {
  if (!rm) return false;
  const s = rm.summary;
  const hasSum = Boolean(s && (s.opName || s.opType || s.taskDurationUs != null));
  return hasSum || (rm.pipeOccupancy?.length ?? 0) > 0;
}

function loadFromSource(source: ArrayBuffer | Uint8Array) {
  try {
    const adapted = loadReportSource(source);
    internalSwim.value = adapted.swimlaneModel;
    internalReport.value = adapted.reportModel;
    resetViewFromModel(adapted.swimlaneModel, asideHasContent(adapted.reportModel));
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
      resetViewFromModel(m, asideHasContent(props.reportModel ?? report.value));
    }
  },
);

onMounted(() => {
  window.addEventListener('keydown', onMeasureKeydown);
  if (props.source) return;
  if (props.swimlaneModel || props.reportModel) {
    resetViewFromModel(props.swimlaneModel ?? null, asideHasContent(props.reportModel));
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

function onScrollY(scrollY: number) {
  viewState.value = { ...viewState.value, scrollY: Math.max(0, scrollY) };
}

watch(
  () => viewState.value.scrollY,
  (y) => {
    const el = gutterRef.value?.root;
    if (el && Math.abs(el.scrollTop - y) > 0.5) {
      el.scrollTop = y;
    }
  },
);

function onGutterScroll(): void {
  const el = gutterRef.value?.root;
  if (!el) return;
  if (Math.abs(el.scrollTop - viewState.value.scrollY) > 0.5) {
    onScrollY(el.scrollTop);
  }
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

/** Used by component tests to select an event without canvas pointer geometry. */
function selectEventById(eventId: string) {
  const ev = swim.value?.processes
    .flatMap((p) => p.threads.flatMap((th) => th.events))
    .find((e) => e.id === eventId);
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
      :title="title"
      :search-query="viewState.searchQuery"
      :aside-visible="viewState.asideVisible"
      :aside-available="asideAvailable"
      :zoom-percent="zoomPercent"
      :time-unit="unit"
      :locale="locale"
      :measure-mode="viewState.measureMode"
      @update:search-query="onSearch"
      @update:aside-visible="onAside"
      @update:time-unit="onTimeUnit"
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
    >
      <template #main>
        <div class="pr-swim-row pr-swim-row--overview">
          <div
            class="pr-gutter pr-gutter--axis-spacer"
            aria-hidden="true"
          />
          <TimeOverviewBar
            :min-time="bounds.minTime"
            :max-time="bounds.maxTime"
            :start-time="viewState.startTime"
            :end-time="viewState.endTime"
            :time-unit="unit"
            @update:window="onOverviewWindow"
          />
        </div>

        <div class="pr-swim-row pr-swim-row--head">
          <div
            class="pr-gutter pr-gutter--axis-spacer"
            aria-hidden="true"
          />
          <div
            class="pr-time-axis"
            data-testid="time-axis"
          >
            <span
              v-for="tick in axisTicks"
              :key="tick.t"
              class="pr-time-axis__tick"
            >{{ tick.label }}</span>
            <div
              v-if="cursor"
              class="pr-cursor"
              data-testid="cursor-line"
              :style="{ left: `${cursor.xRatio * 100}%` }"
            >
              <span
                class="pr-cursor__label"
                data-testid="cursor-label"
              >{{ formatCursorTime(cursor.time) }}</span>
            </div>
          </div>
        </div>

        <div class="pr-swim-row pr-swim-row--body">
          <LaneGutter
            ref="gutterRef"
            :groups="laneGroups"
            @scroll="onGutterScroll"
          />
          <SwimlaneCanvas
            :model="swim"
            :view="viewState"
            :selected-event-id="viewState.selectedEventId"
            :hovered-event-id="viewState.hoveredEventId"
            :search-query="viewState.searchQuery"
            :measure-mode="viewState.measureMode"
            :measure-range="viewState.measureRange"
            :time-unit="unit"
            @select="onSelect"
            @hover="onHover"
            @cursor="onCursor"
            @set-playhead="onSetPlayhead"
            @pan="onPan"
            @zoom="onZoom"
            @scroll-y="onScrollY"
            @update:measure-range="onMeasureRange"
          />
        </div>

        <div
          v-if="showOverview"
          data-testid="overview-charts"
          class="pr-overview"
        >
          Overview charts
        </div>
      </template>

      <template #aside>
        <StatsAside
          :report="report"
          :locale="locale"
          @view-full-csv="emit('view-full-csv', $event)"
        />
      </template>
    </ReportLayout>

    <DetailStrip
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

.pr-time-axis {
  position: relative;
  display: flex;
  justify-content: space-between;
  color: #c8c8c8;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  border-bottom: 1px solid #3a3a3a;
  padding: 10px 8px 6px;
  min-height: 28px;
  flex: 0 0 auto;
}

.pr-gutter--axis-spacer {
  border-bottom: 1px solid #3a3a3a;
  background: #2a2a2a;
  border-right: 1px solid #3a3a3a;
}

.pr-cursor {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #3078f0;
  pointer-events: none;
  z-index: 5;
  transform: translateX(-0.5px);
}

.pr-cursor__label {
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
  padding: 1px 8px;
  background: #3078f0;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  border-radius: 4px;
  line-height: 1.35;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}

.pr-swim-row {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 0;
  align-items: stretch;
  min-height: 0;
}

.pr-swim-row.pr-swim-row--head,
.pr-swim-row.pr-swim-row--overview {
  flex: 0 0 auto;
}

.pr-swim-row.pr-swim-row--overview {
  align-items: stretch;
}

.pr-swim-row.pr-swim-row--overview .pr-gutter--axis-spacer {
  border-bottom: 1px solid #4a4a4a;
}

.pr-swim-row.pr-swim-row--body {
  flex: 1 1 auto;
  min-height: 0;
}

@media (max-width: 900px) {
  .pr-swim-row {
    grid-template-columns: 1fr;
  }

  .pr-swim-row--head {
    display: block;
  }

  .pr-gutter--axis-spacer {
    display: none;
  }
}
</style>
