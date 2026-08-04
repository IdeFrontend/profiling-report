<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { loadReportSource } from '../../adapters';
import { buildAxisRulerTicks } from '../../domain/axisRuler';
import {
  formatCursorTime,
  resolveCursorTimeUnit,
} from '../../domain/formatTime';
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
import AxisRuler from '../AxisRuler/AxisRuler.vue';
import DetailStrip from '../DetailStrip/DetailStrip.vue';
import EventTooltip from '../EventTooltip/EventTooltip.vue';
import LaneGutter from '../LaneGutter/LaneGutter.vue';
import {
  ASIDE_WIDTH_DEFAULT,
  GUTTER_WIDTH_DEFAULT,
  GUTTER_WIDTH_MAX,
  GUTTER_WIDTH_MIN,
  startHorizontalResize,
} from '../panelResize';
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
const timeAxisRef = ref<HTMLElement | null>(null);
const timeAxisWidth = ref(0);
/** Session-only panel widths (not persisted). */
const gutterWidth = ref(GUTTER_WIDTH_DEFAULT);
const asideWidth = ref(ASIDE_WIDTH_DEFAULT);
/** Process / group ids with child lanes collapsed in gutter + canvas. */
const collapsedGroupIds = ref<string[]>([]);

const swim = computed(() => props.swimlaneModel ?? internalSwim.value);
const report = computed(() => props.reportModel ?? internalReport.value);
const unit = computed<TimeDisplayUnit>(() => localTimeUnit.value);

const showOverview = computed(() => (report.value?.overviewSeries?.length ?? 0) > 0);
/** Toolbar toggle + initial asideVisible share this gate (includes CSV-only reports). */
const asideAvailable = computed(() => reportHasAsideContent(report.value));
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

/** Swim model with collapsed groups' threads removed so canvas row heights match gutter. */
const displaySwim = computed((): SwimlaneModel | null => {
  const m = swim.value;
  if (!m) return null;
  if (collapsedGroupIds.value.length === 0) return m;
  const collapsed = new Set(collapsedGroupIds.value);
  return {
    ...m,
    processes: m.processes.map((p) =>
      collapsed.has(p.id) ? { ...p, threads: [] } : p,
    ),
  };
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
const cursorTimeUnit = computed(() =>
  resolveCursorTimeUnit(bounds.value.maxTime - bounds.value.minTime, unit.value),
);

/** 0 = fit (full span); 100 = max zoom (~1/100 of full span). */
const zoomPercent = computed(() => {
  const full = bounds.value.maxTime - bounds.value.minTime;
  const span = Math.max(1, viewState.value.endTime - viewState.value.startTime);
  if (span >= full) return 0;
  const ratio = full / span;
  return Math.min(100, Math.round((Math.log2(ratio) / Math.log2(100)) * 100));
});

const viewportRuler = computed(() => {
  const { startTime, endTime } = viewState.value;
  return buildAxisRulerTicks({
    rangeStart: startTime,
    rangeEnd: endTime,
    origin: bounds.value.minTime,
    timeUnit: unit.value,
    widthPx: timeAxisWidth.value,
  });
});

function resetViewFromModel(model: SwimlaneModel | null, showAsidePanel: boolean): void {
  const next = createViewState(model);
  next.asideVisible = showAsidePanel;
  viewState.value = next;
  selected.value = null;
  hovered.value = null;
  collapsedGroupIds.value = [];
}

function onToggleGroup(groupId: string): void {
  const set = new Set(collapsedGroupIds.value);
  if (set.has(groupId)) set.delete(groupId);
  else set.add(groupId);
  collapsedGroupIds.value = [...set];
  // Keep scroll within new content height
  const el = gutterRef.value?.root;
  if (el) {
    viewState.value = { ...viewState.value, scrollY: Math.min(viewState.value.scrollY, el.scrollHeight) };
  }
}

/**
 * Aside has content when any of: summary fields, pipe occupancy,
 * compute CSV tables, or memory CSV tables are present.
 * Must stay in sync with StatsAside section visibility.
 */
function reportHasAsideContent(rm: ReportViewModel | null | undefined): boolean {
  if (!rm) return false;
  const s = rm.summary;
  const hasSummary = Boolean(s && (s.opName || s.opType || s.taskDurationUs != null));
  const hasPipe = rm.pipeOccupancy.length > 0;
  const hasComputeTables = rm.computeTables.length > 0;
  const hasMemoryTables = rm.memoryTables.length > 0;
  return hasSummary || hasPipe || hasComputeTables || hasMemoryTables;
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

watch(
  timeAxisRef,
  (el, _prev, onCleanup) => {
    if (!el || typeof ResizeObserver === 'undefined') {
      if (el) timeAxisWidth.value = el.clientWidth || 0;
      return;
    }
    const sync = () => {
      timeAxisWidth.value = el.clientWidth || 0;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  },
  { flush: 'post' },
);

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

let gutterResizeSession: ReturnType<typeof startHorizontalResize> | null = null;

function onGutterResizePointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  gutterResizeSession = startHorizontalResize({
    startClientX: e.clientX,
    startWidth: gutterWidth.value,
    min: GUTTER_WIDTH_MIN,
    max: GUTTER_WIDTH_MAX,
    direction: 1,
    onChange: (w) => {
      gutterWidth.value = w;
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
      :aside-width="asideWidth"
      @update:aside-width="asideWidth = $event"
    >
      <template #main>
        <div
          class="pr-main-swim"
          :style="{ '--pr-gutter-width': `${gutterWidth}px` }"
        >
          <button
            type="button"
            class="pr-gutter-resize"
            data-testid="gutter-resize-handle"
            aria-label="Resize lane gutter"
            @pointerdown="onGutterResizePointerDown"
            @pointermove="onGutterResizePointerMove"
            @pointerup="onGutterResizePointerUp"
            @pointercancel="onGutterResizePointerUp"
          />
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
              ref="timeAxisRef"
              class="pr-time-axis"
              data-testid="time-axis"
            >
              <AxisRuler
                :majors="viewportRuler.majors"
                :minors="viewportRuler.minors"
              />
              <div
                v-if="cursor"
                class="pr-cursor"
                data-testid="cursor-line"
                :style="{ left: `${cursor.xRatio * 100}%` }"
              >
                <span
                  class="pr-cursor__label"
                  data-testid="cursor-label"
                >{{ formatCursorTime(cursor.time - bounds.minTime, cursorTimeUnit) }}</span>
              </div>
            </div>
          </div>

          <div class="pr-swim-row pr-swim-row--body">
            <LaneGutter
              ref="gutterRef"
              :groups="laneGroups"
              :collapsed-ids="collapsedGroupIds"
              @scroll="onGutterScroll"
              @toggle-group="onToggleGroup"
            />
            <SwimlaneCanvas
              :model="displaySwim"
              :view="viewState"
              :selected-event-id="viewState.selectedEventId"
              :hovered-event-id="viewState.hoveredEventId"
              :search-query="viewState.searchQuery"
              :measure-mode="viewState.measureMode"
              :measure-range="viewState.measureRange"
              :time-unit="unit"
              :prefer-renderer="preferRenderer ?? 'auto'"
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
  height: 20px;
  color: #c8c8c8;
  border-bottom: 1px solid #3a3a3a;
  flex: 0 0 auto;
  overflow: hidden;
}

.pr-gutter--axis-spacer {
  border-bottom: 1px solid #3a3a3a;
  background: #2a2a2a;
  border-right: 1px solid #3a3a3a;
}

.pr-cursor {
  position: absolute;
  top: 0;
  /* Extend through axis border-bottom so the stem meets the canvas line (no 1px gap). */
  bottom: -1px;
  width: 1px;
  background: #317af7;
  pointer-events: none;
  z-index: 5;
  /*
   * left = xRatio% places the left edge at cursor x.
   * Canvas stroke uses x+0.5 so it covers [x, x+1] — same column. Do not translateX(-0.5).
   */
}

.pr-cursor__label {
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
  padding: 1px 8px;
  min-width: 72px;
  box-sizing: border-box;
  text-align: center;
  background: #317af7;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  border-radius: 4px;
  line-height: 1.35;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}

.pr-main-swim {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
}

.pr-gutter-resize {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--pr-gutter-width, 280px);
  width: 5px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: ew-resize;
  z-index: 6;
  transform: translateX(-50%);
}

.pr-gutter-resize:hover,
.pr-gutter-resize:active {
  background: rgba(49, 122, 247, 0.35);
}

.pr-swim-row {
  display: grid;
  grid-template-columns: var(--pr-gutter-width, 280px) 1fr;
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

  .pr-gutter-resize {
    display: none;
  }
}
</style>
