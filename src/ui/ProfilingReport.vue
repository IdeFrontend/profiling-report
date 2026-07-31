<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { adaptRep, parseRep } from '../core/adapters';
import type {
  ReportCapability,
  ReportViewModel,
  SelectedEvent,
  SwimEvent,
  SwimlaneModel,
  SwimThread,
} from '../core/types';

const props = defineProps<{
  title?: string;
  source?: ArrayBuffer | Uint8Array;
  swimlaneModel?: SwimlaneModel;
  reportModel?: ReportViewModel;
  theme?: 'light' | 'dark';
  locale?: string;
  capabilities?: ReportCapability[];
}>();

const emit = defineEmits<{
  ready: [];
  select: [event: SelectedEvent | null];
  error: [error: { message: string; cause?: unknown }];
}>();

const internalSwim = ref<SwimlaneModel | null>(null);
const internalReport = ref<ReportViewModel | null>(null);
const loadError = ref<string | null>(null);
const hovered = ref<SwimEvent | null>(null);
const selected = ref<SelectedEvent | null>(null);
const tooltipStyle = ref({ left: '0px', top: '0px' });

const COLOR: Record<string, string> = {
  cube: '#007084',
  vector: '#007464',
  mte1: '#885C00',
  mte2: '#985000',
  mte3: '#A44830',
  fixp: '#586C0C',
  scalar: '#38702C',
  default: '#3860A8',
};

const swim = computed(() => props.swimlaneModel ?? internalSwim.value);
const report = computed(() => props.reportModel ?? internalReport.value);

const hasSummary = computed(() => {
  const s = report.value?.summary;
  return Boolean(s && (s.opName || s.opType || s.taskDurationUs != null));
});

const showPipe = computed(() => (report.value?.pipeOccupancy?.length ?? 0) > 0);
const showOverview = computed(() => (report.value?.overviewSeries?.length ?? 0) > 0);

const timeSpan = computed(() => {
  const m = swim.value;
  if (!m) return { min: 0, max: 1 };
  const min = m.minTime;
  const max = m.maxTime > m.minTime ? m.maxTime : m.minTime + 1;
  return { min, max };
});

function formatNs(ns: number): string {
  const ms = ns / 1e6;
  return `${ms.toFixed(3)} ms`;
}

function loadFromSource(source: ArrayBuffer | Uint8Array) {
  try {
    const adapted = adaptRep(parseRep(source));
    internalSwim.value = adapted.swimlaneModel;
    internalReport.value = adapted.reportModel;
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
    emit('ready');
  }
});

watch(
  () => props.source,
  (src) => {
    if (src) loadFromSource(src);
  },
);

function eventLeft(ev: SwimEvent): string {
  const { min, max } = timeSpan.value;
  return `${((ev.startTime - min) / (max - min)) * 100}%`;
}

function eventWidth(ev: SwimEvent): string {
  const { min, max } = timeSpan.value;
  const pct = (ev.duration / (max - min)) * 100;
  return `${Math.max(pct, 0.15)}%`;
}

/** Shorter bars stack above longer ones so nested markers stay hoverable/clickable. */
function eventZIndex(ev: SwimEvent): number {
  const { min, max } = timeSpan.value;
  const span = max - min || 1;
  return Math.max(1, Math.round(1000 - (ev.duration / span) * 1000));
}

function colorForThread(thread: SwimThread): string {
  const n = thread.name.toUpperCase();
  if (n.includes('PIPE_V') || n.includes('VEC')) return COLOR.vector;
  if (n.includes('PIPE_S') || n.includes('SCALAR')) return COLOR.scalar;
  if (n.includes('MTE1')) return COLOR.mte1;
  if (n.includes('MTE2')) return COLOR.mte2;
  if (n.includes('MTE3')) return COLOR.mte3;
  if (n.includes('FIX')) return COLOR.fixp;
  if (n.includes('CUBE')) return COLOR.cube;
  return COLOR.default;
}

function onEventClick(ev: SwimEvent) {
  const payload: SelectedEvent = {
    id: ev.id,
    name: ev.name,
    startTime: ev.startTime,
    duration: ev.duration,
    endTime: ev.startTime + ev.duration,
    args: ev.args,
  };
  selected.value = payload;
  emit('select', payload);
}

function onEventEnter(ev: SwimEvent, e: MouseEvent) {
  hovered.value = ev;
  tooltipStyle.value = {
    left: `${e.clientX + 12}px`,
    top: `${e.clientY + 12}px`,
  };
}

function onEventMove(e: MouseEvent) {
  if (!hovered.value) return;
  tooltipStyle.value = {
    left: `${e.clientX + 12}px`,
    top: `${e.clientY + 12}px`,
  };
}

function onEventLeave() {
  hovered.value = null;
}

const axisTicks = computed(() => {
  const { min, max } = timeSpan.value;
  const ticks = 5;
  return Array.from({ length: ticks + 1 }, (_, i) => {
    const t = min + ((max - min) * i) / ticks;
    return { t, label: formatNs(t) };
  });
});
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

    <div class="pr-layout">
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
        </div>

        <div
          class="pr-swimlane"
          data-testid="swimlane"
        >
          <template
            v-for="proc in swim?.processes ?? []"
            :key="proc.id"
          >
            <div class="pr-process">
              <div class="pr-process__name">
                {{ proc.name }}
              </div>
              <div
                v-for="thread in proc.threads"
                :key="thread.id"
                class="pr-lane"
              >
                <div class="pr-lane__label">
                  {{ thread.name }}
                </div>
                <div class="pr-lane__track">
                  <button
                    v-for="ev in thread.events"
                    :key="ev.id"
                    type="button"
                    class="pr-event"
                    :data-testid="`swim-event-${ev.id}`"
                    :style="{
                      left: eventLeft(ev),
                      width: eventWidth(ev),
                      zIndex: eventZIndex(ev),
                      background: colorForThread(thread),
                    }"
                    :title="ev.name"
                    @click="onEventClick(ev)"
                    @mouseenter="onEventEnter(ev, $event)"
                    @mousemove="onEventMove"
                    @mouseleave="onEventLeave"
                  >
                    <span class="pr-event__label">{{ ev.name }}</span>
                  </button>
                </div>
              </div>
            </div>
          </template>
          <p
            v-if="!(swim?.processes?.length)"
            class="pr-empty"
          >
            No timeline events
          </p>
        </div>

        <div
          v-if="showOverview"
          data-testid="overview-charts"
          class="pr-overview"
        >
          Overview charts
        </div>
      </section>

      <aside class="pr-aside">
        <div
          v-if="hasSummary"
          class="pr-panel"
          data-testid="stats-summary"
        >
          <h3>Report summary</h3>
          <dl>
            <div v-if="report?.summary.opName">
              <dt>Op</dt>
              <dd>{{ report.summary.opName }}</dd>
            </div>
            <div v-if="report?.summary.opType">
              <dt>Type</dt>
              <dd>{{ report.summary.opType }}</dd>
            </div>
            <div v-if="report?.summary.taskDurationUs != null">
              <dt>Duration</dt>
              <dd>{{ report.summary.taskDurationUs }} µs</dd>
            </div>
            <div v-if="report?.summary.currentFreq != null">
              <dt>Freq</dt>
              <dd>{{ report.summary.currentFreq }} / {{ report.summary.ratedFreq }}</dd>
            </div>
          </dl>
          <!-- Interim I-Q6a: no compute / BW / avg util tiles -->
        </div>

        <div
          v-if="showPipe"
          class="pr-panel"
          data-testid="pipe-occupancy"
        >
          <h3>PIPE occupancy</h3>
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
      <span>{{ formatNs(selected.startTime) }} → {{ formatNs(selected.endTime) }}</span>
      <span>dur {{ formatNs(selected.duration) }}</span>
    </footer>

    <div
      v-if="hovered"
      class="pr-tooltip"
      data-testid="event-tooltip"
      :style="tooltipStyle"
    >
      <div>{{ hovered.name }}</div>
      <div>start {{ formatNs(hovered.startTime) }}</div>
      <div>dur {{ formatNs(hovered.duration) }}</div>
      <div>end {{ formatNs(hovered.startTime + hovered.duration) }}</div>
    </div>
  </div>
</template>

<style scoped>
.pr-root {
  --pr-bg-panel: #303030;
  --pr-bg-deep: #202830;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  grid-template-columns: 1fr minmax(200px, 280px);
  gap: 12px;
  min-height: 200px;
}

.pr-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  background: var(--pr-bg-panel);
  border-radius: 4px;
  padding: 8px;
}

.pr-time-axis {
  display: flex;
  justify-content: space-between;
  opacity: 0.8;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  border-bottom: 1px solid #444;
  padding-bottom: 4px;
}

.pr-swimlane {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
  max-height: 420px;
}

.pr-process__name {
  font-weight: 600;
  margin-bottom: 4px;
}

.pr-lane {
  display: grid;
  grid-template-columns: minmax(120px, 28%) 1fr;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.pr-lane__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.9;
  font-size: 11px;
}

.pr-lane__track {
  position: relative;
  height: 22px;
  overflow: hidden;
  background: #1a1a1a;
  border-radius: 2px;
}

.pr-event {
  position: absolute;
  top: 2px;
  bottom: 2px;
  margin: 0;
  padding: 0 4px;
  border: none;
  border-radius: 2px;
  color: #fff;
  cursor: pointer;
  overflow: hidden;
  text-align: left;
}

.pr-event__label {
  font-size: 10px;
  white-space: nowrap;
}

.pr-empty {
  opacity: 0.6;
  margin: 12px 0;
}

.pr-aside {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
}
</style>
