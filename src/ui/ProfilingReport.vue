<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { loadReportSource } from '../core/adapters';
import { formatAxisTime, formatCursorTime, formatTime } from '../core/formatTime';
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
import TimeOverviewBar from './TimeOverviewBar.vue';
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
const cursor = ref<{ time: number; xRatio: number } | null>(null);

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
  const out: { id: string; name: string; utilization: number; color: string }[] = [];
  for (const p of swim.value?.processes ?? []) {
    for (const t of p.threads) {
      out.push({
        id: t.id,
        name: t.name,
        utilization: t.utilization ?? 0,
        color: colorForLaneName(t.name),
      });
    }
  }
  return out;
});

function colorForLaneName(name: string): string {
  const n = name.toUpperCase();
  if (n.includes('PIPE_V') || n.includes('VEC')) return 'var(--pr-color-vector)';
  if (n.includes('PIPE_S') || n.includes('SCALAR')) return 'var(--pr-color-scalar)';
  if (n.includes('MTE1')) return 'var(--pr-color-mte1)';
  if (n.includes('MTE2')) return 'var(--pr-color-mte2)';
  if (n.includes('MTE3')) return 'var(--pr-color-mte3)';
  if (n.includes('FIX')) return 'var(--pr-color-fixp)';
  if (n.includes('CUBE')) return 'var(--pr-color-cube)';
  return '#6a6a6a';
}

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
    return { t: tm, label: formatAxisTime(tm, unit.value) };
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
  if (props.source) return;
  if (props.swimlaneModel || props.reportModel) {
    resetViewFromModel(props.swimlaneModel ?? null, asideHasContent(props.reportModel));
    emit('ready');
  }
});

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

function formatDurationUs(us: number): string {
  if (us >= 1000) return `${(us / 1000).toFixed(2)} ms`;
  return `${us.toFixed(us >= 10 ? 2 : 5)} µs`;
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

    <p
      v-if="loadError"
      class="pr-error"
      data-testid="load-error"
    >
      {{ loadError }}
    </p>

    <div
      class="pr-layout"
      :class="{ 'pr-layout--no-aside': !(viewState.asideVisible && asideAvailable) }"
    >
      <section class="pr-main">
        <!-- Total X-axis (full range) above detail axis — sketch / PyPTO layout -->
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
          <div
            class="pr-gutter"
            data-testid="lane-gutter"
          >
            <div class="pr-gutter__group">
              {{ t('kernel', locale) }}
            </div>
            <div
              v-for="lane in lanes"
              :key="lane.id"
              class="pr-gutter__lane"
            >
              <span
                class="pr-gutter__name"
                :title="lane.name"
              >{{ lane.name }}</span>
              <span class="pr-gutter__pct">{{ Math.round(lane.utilization * 100) }}%</span>
              <span
                class="pr-gutter__util"
                data-testid="lane-util"
              >
                <span
                  class="pr-gutter__util-bar"
                  :style="{
                    width: `${Math.min(100, lane.utilization * 100)}%`,
                    background: lane.color,
                  }"
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
            @cursor="onCursor"
            @set-playhead="onSetPlayhead"
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
        data-testid="stats-aside"
      >
        <header class="pr-aside__head">
          <h3>{{ t('summary', locale) }}</h3>
          <p
            v-if="report?.summary.currentFreq != null"
            class="pr-aside__meta"
          >
            {{ t('freq', locale) }}: {{ report.summary.currentFreq }}
            <template v-if="report.summary.ratedFreq != null">
              / {{ report.summary.ratedFreq }}
            </template>
            <template v-if="report?.summary.opType">
              · {{ report.summary.opType }}
            </template>
          </p>
        </header>

        <div
          v-if="hasSummary"
          class="pr-cards"
          data-testid="stats-summary"
        >
          <div
            v-if="report?.summary.taskDurationUs != null"
            class="pr-card"
          >
            <div class="pr-card__label">
              {{ t('duration', locale) }}
            </div>
            <div class="pr-card__value">
              {{ formatDurationUs(report.summary.taskDurationUs) }}
            </div>
            <div
              v-if="report?.summary.opName"
              class="pr-card__sub"
            >
              {{ report.summary.opName }}
            </div>
          </div>
          <div
            v-if="report?.summary.opType"
            class="pr-card"
          >
            <div class="pr-card__label">
              {{ t('type', locale) }}
            </div>
            <div class="pr-card__value pr-card__value--sm">
              {{ report.summary.opType }}
            </div>
          </div>
        </div>

        <div
          v-if="showPipe"
          class="pr-panel pr-panel--pipe"
          data-testid="pipe-occupancy"
        >
          <h4>{{ t('pipeOccupancy', locale) }}</h4>
          <ul class="pr-pipe-list">
            <li
              v-for="pipe in report?.pipeOccupancy ?? []"
              :key="pipe.id"
              class="pr-pipe-row"
            >
              <span class="pr-pipe-row__label">{{ pipe.label }}</span>
              <span class="pr-pipe-row__track">
                <span
                  class="pr-pipe-row__bar"
                  :style="{
                    width: `${Math.min(100, pipe.ratio * 100)}%`,
                    background: COLOR[pipe.colorKey] ?? COLOR.default,
                  }"
                />
              </span>
              <span class="pr-pipe-row__pct">{{ Math.round(pipe.ratio * 100) }}%</span>
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
      <div class="pr-detail__name">
        {{ selected.name }}
      </div>
      <div class="pr-detail__times">
        {{ formatTime(selected.startTime, 'ns') }}
        →
        {{ formatTime(selected.duration, 'ns') }}
      </div>
      <div class="pr-detail__end">
        {{ t('end', locale) }} {{ formatTime(selected.endTime, unit) }}
      </div>
    </footer>

    <div
      v-if="hovered"
      class="pr-tooltip"
      data-testid="event-tooltip"
      :style="tooltipStyle"
    >
      <div class="pr-tooltip__name">
        {{ hovered.name }}
      </div>
      <div>{{ t('start', locale) }}: {{ formatTime(hovered.startTime, 'ns') }}</div>
      <div>{{ t('dur', locale) }}: {{ formatTime(hovered.duration, 'ns') }}</div>
      <div>{{ t('end', locale) }}: {{ formatTime(hovered.startTime + hovered.duration, 'ns') }}</div>
    </div>
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

.pr-layout {
  display: grid;
  grid-template-columns: 1fr minmax(260px, 300px);
  gap: 0;
  flex: 1 1 auto;
  min-height: 0;
  border-top: 1px solid #3a3a3a;
}

.pr-layout--no-aside {
  grid-template-columns: 1fr;
}

.pr-main {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  min-height: 0;
  background: var(--pr-bg-panel);
  padding: 0;
  border-right: 1px solid #3a3a3a;
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

/* Higher specificity so head/overview keep flex-shrink; body takes remaining height. */
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

.pr-gutter {
  display: flex;
  flex-direction: column;
  font-size: 11px;
  color: #c8c8c8;
  overflow: auto;
  min-height: 0;
  background: #2a2a2a;
  border-right: 1px solid #3a3a3a;
  padding: 0 6px 0 8px;
}

.pr-gutter__group {
  padding: 6px 0 4px;
  font-weight: 600;
  color: #ddd;
  border-bottom: 1px solid #3a3a3a;
  margin-bottom: 2px;
}

.pr-gutter__lane {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px 40px;
  gap: 4px;
  align-items: center;
  height: 22px;
}

.pr-gutter__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-gutter__pct {
  text-align: right;
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
  font-size: 10px;
}

.pr-gutter__util {
  display: block;
  height: 6px;
  background: #1a1a1a;
  border-radius: 1px;
  overflow: hidden;
}

.pr-gutter__util-bar {
  display: block;
  height: 100%;
  border-radius: 1px;
  min-width: 0;
}

.pr-aside {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: auto;
  background: var(--pr-bg-panel);
  padding: 10px 12px;
}

.pr-aside__head h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.pr-aside__meta {
  margin: 4px 0 0;
  font-size: 11px;
  color: #a8a8a8;
}

.pr-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.pr-card {
  background: #262626;
  border: 1px solid #3a3a3a;
  border-radius: 2px;
  padding: 8px 10px;
}

.pr-card__label {
  font-size: 11px;
  color: #9a9a9a;
  margin-bottom: 4px;
}

.pr-card__value {
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.pr-card__value--sm {
  font-size: 14px;
}

.pr-card__sub {
  margin-top: 4px;
  font-size: 11px;
  color: #8a8a8a;
}

.pr-panel--pipe {
  background: transparent;
  border-radius: 0;
  padding: 4px 0 0;
}

.pr-panel--pipe h4 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
}

.pr-pipe-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.pr-pipe-row {
  display: grid;
  grid-template-columns: 52px 1fr 36px;
  gap: 8px;
  align-items: center;
}

.pr-pipe-row__label {
  font-size: 11px;
  color: #c0c0c0;
}

.pr-pipe-row__track {
  display: block;
  height: 10px;
  background: #1f1f1f;
  border-radius: 1px;
  overflow: hidden;
}

.pr-pipe-row__bar {
  display: block;
  height: 100%;
  border-radius: 1px;
  min-width: 2px;
}

.pr-pipe-row__pct {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: #b8b8b8;
}

.pr-detail {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) auto auto;
  gap: 16px;
  align-items: center;
  padding: 8px 12px;
  background: #2a2a2a;
  border-top: 1px solid #3a3a3a;
  flex: 0 0 auto;
}

.pr-detail__name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-detail__times,
.pr-detail__end {
  font-variant-numeric: tabular-nums;
  color: #c0c0c0;
}

.pr-tooltip {
  position: fixed;
  z-index: 20;
  pointer-events: none;
  padding: 8px 10px;
  background: #2a2a2a;
  border: 1px solid #555;
  border-radius: 2px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 1.45;
  min-width: 180px;
}

.pr-tooltip__name {
  font-weight: 600;
  margin-bottom: 4px;
}

@media (max-width: 900px) {
  .pr-layout {
    grid-template-columns: 1fr;
  }

  .pr-main {
    border-right: none;
  }

  .pr-swim-row {
    grid-template-columns: 1fr;
  }

  .pr-swim-row--head {
    display: block;
  }

  .pr-gutter--axis-spacer {
    display: none;
  }

  .pr-detail {
    grid-template-columns: 1fr;
  }
}
</style>

