<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { loadReportSource } from '../core/adapters';
import { formatTime } from '../core/formatTime';
import { t } from '../core/i18n';
import {
  applyWindow,
  createViewState,
  panBy,
  zoomAt,
  zoomToFitWindow,
} from '../core/viewState';
import { withDerivedUtilizations } from '../core/utilization';
import type {
  ReportCapability,
  ReportViewModel,
  SelectedEvent,
  SwimEvent,
  SwimlaneModel,
  SwimlaneViewState,
  TimeDisplayUnit,
} from '../core/types';
import ReportToolbar from './ReportToolbar.vue';
import SwimlaneCanvas from './SwimlaneCanvas.vue';
import './tokens.css';

const props = defineProps<{
  title?: string;
  source?: ArrayBuffer | Uint8Array;
  swimlaneModel?: SwimlaneModel;
  reportModel?: ReportViewModel;
  theme?: 'light' | 'dark';
  locale?: string;
  timeUnit?: TimeDisplayUnit;
  capabilities?: ReportCapability[];
}>();

const emit = defineEmits<{
  ready: [];
  select: [event: SelectedEvent | null];
  error: [error: { message: string; cause?: unknown }];
}>();

const COLOR: Record<string, string> = {
  cube: 'var(--pr-color-cube)',
  vector: 'var(--pr-color-vector)',
  mte1: 'var(--pr-color-mte1)',
  mte2: 'var(--pr-color-mte2)',
  mte3: 'var(--pr-color-mte3)',
  fixp: 'var(--pr-color-fixp)',
  scalar: 'var(--pr-color-scalar)',
  default: 'var(--pr-color-default)',
};

const internalSwim = ref<SwimlaneModel | null>(null);
const internalReport = ref<ReportViewModel | null>(null);
const loadError = ref<string | null>(null);
const viewState = ref<SwimlaneViewState>(createViewState(null));
const hovered = ref<SwimEvent | null>(null);
const selected = ref<SelectedEvent | null>(null);
const tooltipStyle = ref({ left: '0px', top: '0px' });
const localTimeUnit = ref<TimeDisplayUnit>(props.timeUnit ?? 'ms');

const swim = computed(() => {
  const raw = props.swimlaneModel ?? internalSwim.value;
  return raw ? withDerivedUtilizations(raw) : null;
});
const report = computed(() => props.reportModel ?? internalReport.value);
const unit = computed<TimeDisplayUnit>(() => localTimeUnit.value);

const hasSummary = computed(() => {
  const s = report.value?.summary;
  return Boolean(s && (s.opName || s.opType || s.taskDurationUs != null));
});

const showPipe = computed(() => (report.value?.pipeOccupancy?.length ?? 0) > 0);
const showOverview = computed(() => (report.value?.overviewSeries?.length ?? 0) > 0);
const asideAvailable = computed(() => hasSummary.value || showPipe.value);

const lanes = computed(() => {
  const out: { id: string; name: string; utilization: number }[] = [];
  for (const p of swim.value?.processes ?? []) {
    for (const t of p.threads) {
      out.push({ id: t.id, name: t.name, utilization: t.utilization ?? 0 });
    }
  }
  return out;
});

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
  return Array.from({ length: ticks + 1 }, (_, i) => {
    const tm = startTime + ((endTime - startTime) * i) / ticks;
    return { t: tm, label: formatTime(tm, unit.value) };
  });
});

function resetViewFromModel(model: SwimlaneModel | null, showAside: boolean): void {
  const next = createViewState(model);
  next.asideVisible = showAside;
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
    loadError.value = cause instanceof Error ? cause.message : String(cause);
    emit('error', { message: loadError.value, cause });
  }
}

onMounted(() => {
  if (props.source) {
    loadFromSource(props.source);
  } else if (props.swimlaneModel || props.reportModel) {
    resetViewFromModel(props.swimlaneModel ?? null, asideHasContent(props.reportModel));
    emit('ready');
  }
});

watch(
  () => props.source,
  (src) => {
    if (src) loadFromSource(src);
  },
);

watch(
  () => props.swimlaneModel,
  (m) => {
    if (m && !props.source) resetViewFromModel(m, asideHasContent(props.reportModel ?? report.value));
  },
);

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
  viewState.value = { ...viewState.value, scrollY };
}

function onSearch(q: string) {
  viewState.value = { ...viewState.value, searchQuery: q };
}

function onAside(visible: boolean) {
  viewState.value = { ...viewState.value, asideVisible: visible };
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
  >
    <header class="pr-header">
      <h2 class="pr-title">
        {{ title ?? report?.summary.opName ?? 'profiling-report' }}
      </h2>
      <p
        v-if="loadError"
        class="pr-error"
        data-testid="load-error"
      >
        {{ loadError }}
      </p>
    </header>

    <ReportToolbar
      :search-query="viewState.searchQuery"
      :aside-visible="viewState.asideVisible"
      :aside-available="asideAvailable"
      :zoom-percent="zoomPercent"
      :time-unit="unit"
      :locale="locale"
      @update:search-query="onSearch"
      @update:aside-visible="onAside"
      @update:time-unit="onTimeUnit"
      @update:zoom-percent="onZoomPercent"
      @zoom-to-fit="onZoomToFit"
      @zoom-in="onZoomIn"
      @zoom-out="onZoomOut"
    />

    <div
      class="pr-layout"
      :class="{ 'pr-layout--no-aside': !(viewState.asideVisible && asideAvailable) }"
    >
      <section class="pr-main">
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
            v-if="viewState.playheadTime != null"
            class="pr-playhead"
            data-testid="playhead"
            :style="{
              left: `${((viewState.playheadTime - viewState.startTime) / Math.max(1, viewState.endTime - viewState.startTime)) * 100}%`,
            }"
          />
        </div>

        <div class="pr-swim-row">
          <div
            class="pr-gutter"
            data-testid="lane-gutter"
          >
            <div
              v-for="lane in lanes"
              :key="lane.id"
              class="pr-gutter__lane"
            >
              <span class="pr-gutter__name">{{ lane.name }}</span>
              <span
                class="pr-gutter__util"
                data-testid="lane-util"
                :title="`${Math.round(lane.utilization * 100)}%`"
              >
                <span
                  class="pr-gutter__util-bar"
                  :style="{ width: `${Math.min(100, lane.utilization * 100)}%` }"
                />
              </span>
            </div>
          </div>
          <SwimlaneCanvas
            :model="swim"
            :view="viewState"
            :selected-event-id="viewState.selectedEventId"
            :hovered-event-id="viewState.hoveredEventId"
            :search-query="viewState.searchQuery"
            :lanes="lanes"
            @select="onSelect"
            @hover="onHover"
            @pan="onPan"
            @zoom="onZoom"
            @scroll-y="onScrollY"
          />
        </div>

        <div
          v-if="showOverview"
          data-testid="overview-charts"
          class="pr-overview"
        >
          Overview charts
        </div>
      </section>

      <aside
        v-if="viewState.asideVisible && asideAvailable"
        class="pr-aside"
      >
        <div
          v-if="hasSummary"
          class="pr-panel"
          data-testid="stats-summary"
        >
          <h3>{{ t('summary', locale) }}</h3>
          <dl>
            <div v-if="report?.summary.opName">
              <dt>{{ t('op', locale) }}</dt>
              <dd>{{ report.summary.opName }}</dd>
            </div>
            <div v-if="report?.summary.opType">
              <dt>{{ t('type', locale) }}</dt>
              <dd>{{ report.summary.opType }}</dd>
            </div>
            <div v-if="report?.summary.taskDurationUs != null">
              <dt>{{ t('duration', locale) }}</dt>
              <dd>{{ report.summary.taskDurationUs }} µs</dd>
            </div>
            <div v-if="report?.summary.currentFreq != null">
              <dt>{{ t('freq', locale) }}</dt>
              <dd>{{ report.summary.currentFreq }} / {{ report.summary.ratedFreq }}</dd>
            </div>
          </dl>
        </div>

        <div
          v-if="showPipe"
          class="pr-panel"
          data-testid="pipe-occupancy"
        >
          <h3>{{ t('pipeOccupancy', locale) }}</h3>
          <ul class="pr-pipe-list">
            <li
              v-for="pipe in report?.pipeOccupancy ?? []"
              :key="pipe.id"
              class="pr-pipe-row"
            >
              <span class="pr-pipe-row__label">{{ pipe.label }}</span>
              <span
                class="pr-pipe-row__bar"
                :style="{
                  width: `${Math.min(100, pipe.ratio * 100)}%`,
                  background: COLOR[pipe.colorKey] ?? COLOR.default,
                }"
              />
              <span class="pr-pipe-row__pct">{{ (pipe.ratio * 100).toFixed(1) }}%</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>

    <footer
      v-if="selected"
      class="pr-detail"
      data-testid="detail-strip"
    >
      <strong>{{ selected.name }}</strong>
      <span>{{ formatTime(selected.startTime, unit) }} → {{ formatTime(selected.endTime, unit) }}</span>
      <span>{{ t('dur', locale) }} {{ formatTime(selected.duration, unit) }}</span>
    </footer>

    <div
      v-if="hovered"
      class="pr-tooltip"
      data-testid="event-tooltip"
      :style="tooltipStyle"
    >
      <div>{{ hovered.name }}</div>
      <div>{{ t('start', locale) }} {{ formatTime(hovered.startTime, unit) }}</div>
      <div>{{ t('dur', locale) }} {{ formatTime(hovered.duration, unit) }}</div>
      <div>{{ t('end', locale) }} {{ formatTime(hovered.startTime + hovered.duration, unit) }}</div>
    </div>
  </div>
</template>

<style scoped>
.pr-root {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  height: 100%;
  min-height: 240px;
  padding: 12px;
  color: #e8e8e8;
  background: var(--pr-bg-deep);
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 13px;
}

.pr-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 0 0 auto;
}

.pr-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.pr-error {
  margin: 0;
  color: #f88;
}

.pr-layout {
  display: grid;
  grid-template-columns: 1fr minmax(220px, 320px);
  gap: 12px;
  flex: 1 1 auto;
  min-height: 0;
}

.pr-layout--no-aside {
  grid-template-columns: 1fr;
}

.pr-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  min-height: 0;
  background: var(--pr-bg-panel);
  border-radius: 4px;
  padding: 8px;
}

.pr-time-axis {
  position: relative;
  display: flex;
  justify-content: space-between;
  opacity: 0.8;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  border-bottom: 1px solid #444;
  padding-bottom: 4px;
  min-height: 20px;
}

.pr-playhead {
  position: absolute;
  top: 0;
  bottom: -4px;
  width: 2px;
  background: var(--pr-playhead);
  pointer-events: none;
  transform: translateX(-1px);
}

.pr-swim-row {
  display: grid;
  grid-template-columns: minmax(140px, 22%) 1fr;
  gap: 8px;
  align-items: stretch;
  flex: 1 1 auto;
  min-height: 0;
}

.pr-gutter {
  display: flex;
  flex-direction: column;
  font-size: 11px;
  opacity: 0.9;
  overflow: auto;
  min-height: 0;
}

.pr-gutter__lane {
  display: grid;
  grid-template-columns: 1fr 36px;
  gap: 6px;
  align-items: center;
  height: 28px;
}

.pr-gutter__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-gutter__util {
  display: block;
  height: 6px;
  background: #1a1a1a;
  border-radius: 2px;
  overflow: hidden;
}

.pr-gutter__util-bar {
  display: block;
  height: 100%;
  background: var(--pr-color-vector);
  border-radius: 2px;
  min-width: 0;
}

.pr-aside {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
}

.pr-panel {
  background: var(--pr-bg-panel);
  border-radius: 4px;
  padding: 10px 12px;
}

.pr-panel h3 {
  margin: 0 0 8px;
  font-size: 13px;
}

.pr-panel dl {
  margin: 0;
  display: grid;
  gap: 6px;
}

.pr-panel dl > div {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px;
}

.pr-panel dt {
  opacity: 0.7;
}

.pr-panel dd {
  margin: 0;
}

.pr-pipe-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pr-pipe-row {
  display: grid;
  grid-template-columns: 56px 1fr 48px;
  gap: 8px;
  align-items: center;
}

.pr-pipe-row__bar {
  height: 10px;
  border-radius: 2px;
  justify-self: start;
  min-width: 2px;
}

.pr-pipe-row__pct {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
}

.pr-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 10px;
  background: var(--pr-bg-panel);
  border-radius: 4px;
}

.pr-tooltip {
  position: fixed;
  z-index: 20;
  pointer-events: none;
  padding: 8px 10px;
  background: #111;
  border: 1px solid #555;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  font-size: 12px;
}

@media (max-width: 800px) {
  .pr-layout {
    grid-template-columns: 1fr;
  }

  .pr-swim-row {
    grid-template-columns: 1fr;
  }
}
</style>
