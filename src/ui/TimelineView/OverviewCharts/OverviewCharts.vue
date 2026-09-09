<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { overviewSeriesStroke } from '../../../domain/laneColors';
import type { OverviewSeries } from '../../../domain/types';
import { t } from '../../../i18n';
import Chevron from '../../Chevron.vue';
import PinIcon from '../../PinIcon.vue';
import {
  LANE_GROUP_HEADER_FILL,
  LANE_GROUP_HEADER_HOVER,
  LANE_HOVER_FILL,
} from '../../../swimlane/layout';
import {
  areaPathFromVertices,
  stepAfterVertices,
  stepValueAt,
  strokePathFromVertices,
} from './stepPath';
import { OVERVIEW_HEADER_H, OVERVIEW_LANE_H, OVERVIEW_TRACK_GAP, OVERVIEW_TRACK_H, OVERVIEW_Y_MAX } from './overviewLayout';

const props = withDefaults(
  defineProps<{
    series: OverviewSeries[];
    /** Visible swimlane window (canonical ns). */
    startTime: number;
    endTime: number;
    /** Match TimelineView / Swimlane gutter column width. */
    gutterWidth?: number;
    locale?: string;
    /** Series ids currently pinned (filled pushpin + sticky strip). */
    pinnedOverviewIds?: string[];
    /**
     * `section` — scrollable 统计分析 block (header + series).
     * `strip` — sticky duplicates below pinned lanes (no header; pins always visible).
     */
    variant?: 'section' | 'strip';
    /** When true, drag creates measure on the swimlane — do not pan from overview. */
    measureMode?: boolean;
    /** Controlled collapse (section variant); omit for internal default expanded. */
    collapsed?: boolean;
  }>(),
  {
    gutterWidth: 280,
    locale: 'zh-CN',
    pinnedOverviewIds: () => [],
    variant: 'section',
    measureMode: false,
    collapsed: undefined,
  },
);

const emit = defineEmits<{
  'pin-overview': [seriesId: string];
  'unpin-overview': [seriesId: string];
  cursor: [payload: { time: number; xRatio: number; snapped?: boolean } | null];
  /** Forward to SwimlaneCanvas.handleWheel (scroll / trackpad pan / Ctrl+zoom). */
  wheel: [event: WheelEvent];
  /** Horizontal drag-pan (same sign as swimlane canvas). */
  pan: [deltaTime: number];
  'update:collapsed': [collapsed: boolean];
}>();

const VIEW_W = 1000;
const TRACK_H = OVERVIEW_TRACK_H;

const sectionTitle = computed(() => t('overviewStats', props.locale));
const pinLabel = computed(() => t('pin', props.locale));
const pinned = computed(() => new Set(props.pinnedOverviewIds ?? []));
const isStrip = computed(() => props.variant === 'strip');
const pinHoverId = ref<string | null>(null);
const hoverSeriesId = ref<string | null>(null);
/** Local ns under chart pointer — tip/dot without waiting for parent echo. */
const hoverTimeNs = ref<number | null>(null);
/** Local x ratio for the value dot (full 24px lane hit target, not parent echo). */
const hoverXRatio = ref<number | null>(null);
const tipPos = ref({ left: '0px', top: '0px' });
/** Per-track paint boxes in viewport coords — dots are teleported so overview `transform` cannot clip them. */
const paintRectsById = ref<Record<string, { left: number; top: number; width: number; height: number }>>(
  {},
);
/** Chart-column drag-pan (mirrors SwimlaneCanvas: 4px gate before pan emits). */
const dragging = ref(false);
const PAN_DRAG_THRESHOLD_PX = 4;
let lastDragX = 0;
let dragOriginX = 0;
let panArmed = false;

/** Internal collapse when parent does not control `collapsed`. */
const localCollapsed = ref(false);
const isCollapsed = computed(() =>
  props.collapsed !== undefined ? props.collapsed : localCollapsed.value,
);

watch(
  () => props.collapsed,
  (v) => {
    if (v !== undefined) localCollapsed.value = v;
  },
);

function toggleCollapsed() {
  const next = !isCollapsed.value;
  localCollapsed.value = next;
  emit('update:collapsed', next);
}

/** Map counter name → bright stroke hex (fill uses same at ~0.45 opacity). */
function colorForName(name: string): string {
  return overviewSeriesStroke(name);
}

const x0 = computed(() => props.startTime);
const x1 = computed(() => {
  const span = props.endTime - props.startTime;
  return span > 0 ? props.endTime : props.startTime + 1;
});

const tracks = computed(() => {
  const xSpan = x1.value - x0.value;
  const toX = (t: number) => ((t - x0.value) / xSpan) * VIEW_W;
  const toY = (v: number) => TRACK_H * (1 - Math.min(OVERVIEW_Y_MAX, Math.max(0, v)) / OVERVIEW_Y_MAX);
  return props.series.map((s) => {
    const verts = stepAfterVertices(s.points, x0.value, x1.value);
    return {
      ...s,
      color: colorForName(s.id),
      isPinned: pinned.value.has(s.id),
      areaD: areaPathFromVertices(verts, TRACK_H, toX, toY),
      strokeD: strokePathFromVertices(verts, toX, toY),
    };
  });
});

function onPinClick(seriesId: string, isPinned: boolean, e: MouseEvent) {
  e.stopPropagation();
  if (isPinned) emit('unpin-overview', seriesId);
  else emit('pin-overview', seriesId);
}

function timeAtClientX(clientX: number, el: HTMLElement): { time: number; xRatio: number } {
  const rect = el.getBoundingClientRect();
  const xRatio = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
  const time = x0.value + xRatio * (x1.value - x0.value);
  return { time, xRatio };
}

/** Chart column only — gutter labels must not drive the playhead. */
function updateChartHover(seriesId: string, e: PointerEvent) {
  const el = e.currentTarget as HTMLElement;
  const { time, xRatio } = timeAtClientX(e.clientX, el);
  hoverSeriesId.value = seriesId;
  hoverTimeNs.value = time;
  hoverXRatio.value = xRatio;
  tipPos.value = { left: `${e.clientX + 12}px`, top: `${e.clientY + 12}px` };
  const root = el.closest('.pr-overview-charts');
  const next: Record<string, { left: number; top: number; width: number; height: number }> = {};
  if (root) {
    for (const trackEl of root.querySelectorAll<HTMLElement>('[data-series-id]')) {
      const id = trackEl.getAttribute('data-series-id');
      const paint = trackEl.querySelector('.pr-overview-paint') as HTMLElement | null;
      if (!id || !paint) continue;
      const r = paint.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      next[id] = { left: r.left, top: r.top, width: r.width, height: r.height };
    }
  }
  paintRectsById.value = next;
  emit('cursor', { time, xRatio, snapped: false });
}

function onChartPointerDown(e: PointerEvent) {
  if (e.button !== 0 || props.measureMode) return;
  dragging.value = true;
  panArmed = false;
  dragOriginX = e.clientX;
  lastDragX = e.clientX;
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
}

function onChartPointerMove(seriesId: string, e: PointerEvent) {
  if (dragging.value && !props.measureMode) {
    if (!panArmed) {
      if (Math.abs(e.clientX - dragOriginX) <= PAN_DRAG_THRESHOLD_PX) {
        updateChartHover(seriesId, e);
        return;
      }
      panArmed = true;
      lastDragX = e.clientX;
    }
    const el = e.currentTarget as HTMLElement;
    const w = Math.max(1, el.getBoundingClientRect().width);
    const span = Math.max(1, x1.value - x0.value);
    const dx = e.clientX - lastDragX;
    lastDragX = e.clientX;
    if (dx !== 0) emit('pan', -(dx / w) * span);
  }
  updateChartHover(seriesId, e);
}

function onChartPointerUp(e: PointerEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  panArmed = false;
  try {
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  } catch {
    /* already released */
  }
  // Leave is ignored while dragging; after release outside a chart column, drop tip + playhead.
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const root = (e.currentTarget as HTMLElement).closest('.pr-overview-charts');
  if (!under || !root?.contains(under) || !under.closest?.('.pr-overview-chart-col')) {
    clearTipOnly();
    emit('cursor', null);
  }
}

function clearTipOnly() {
  hoverSeriesId.value = null;
  hoverTimeNs.value = null;
  hoverXRatio.value = null;
  paintRectsById.value = {};
}

function onChartPointerLeave(e: PointerEvent) {
  if (dragging.value) return;
  const next = e.relatedTarget as Element | null;
  const root = (e.currentTarget as HTMLElement).closest('.pr-overview-charts');
  if (next && root?.contains(next)) {
    // Another chart column — keep tip ownership until its move handler runs.
    if (next.closest?.('.pr-overview-chart-col')) return;
    // Header track / gutter — keep or clear playhead; drop tip/dot.
    clearTipOnly();
    if (next.closest?.('.pr-overview-gutter-cell')) {
      emit('cursor', null);
    }
    return;
  }
  clearTipOnly();
  emit('cursor', null);
}

/**
 * Empty chart-column band under the axis (统计分析 header row) — drive playhead with
 * real xRatio so the stem stays continuous; no series tip/dot.
 */
function onHeaderTrackPointerMove(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement;
  const { time, xRatio } = timeAtClientX(e.clientX, el);
  clearTipOnly();
  emit('cursor', { time, xRatio, snapped: false });
}

function onHeaderTrackPointerLeave(e: PointerEvent) {
  const next = e.relatedTarget as Element | null;
  const root = (e.currentTarget as HTMLElement).closest('.pr-overview-charts');
  if (next && root?.contains(next) && next.closest?.('.pr-overview-chart-col')) return;
  if (next && root?.contains(next) && !next.closest?.('.pr-overview-gutter-cell')) return;
  emit('cursor', null);
}

/** Parent forwards to SwimlaneCanvas.handleWheel (PyPTO scroll / pan / zoom). */
function onChartsWheel(e: WheelEvent) {
  e.preventDefault();
  emit('wheel', e);
}

type TipRow = {
  id: string;
  label: string;
  color: string;
  value: number | null;
};

const tipRows = computed((): TipRow[] => {
  if (hoverSeriesId.value == null) return [];
  const time = hoverTimeNs.value;
  if (time == null) return [];
  return tracks.value.map((tr) => ({
    id: tr.id,
    label: tr.label,
    color: tr.color,
    value: stepValueAt(tr.points, time),
  }));
});

const showTip = computed(
  () => hoverSeriesId.value != null && tipRows.value.some((r) => r.value != null),
);

function dotTopPercent(value: number): number {
  return (1 - Math.min(OVERVIEW_Y_MAX, Math.max(0, value)) / OVERVIEW_Y_MAX) * 100;
}

type ValueDot = {
  id: string;
  active: boolean;
  style: { left: string; top: string; background: string };
};

/** Fixed-position dots for every track (avoids transform clipping). */
const valueDots = computed((): ValueDot[] => {
  const xRatio = hoverXRatio.value;
  if (hoverSeriesId.value == null || xRatio == null) return [];
  const rects = paintRectsById.value;
  const out: ValueDot[] = [];
  for (const row of tipRows.value) {
    if (row.value == null) continue;
    const rect = rects[row.id];
    if (!rect || rect.width <= 0 || rect.height <= 0) continue;
    const yPct = dotTopPercent(row.value) / 100;
    out.push({
      id: row.id,
      active: row.id === hoverSeriesId.value,
      style: {
        left: `${rect.left + xRatio * rect.width}px`,
        top: `${rect.top + yPct * rect.height}px`,
        background: row.color,
      },
    });
  }
  return out;
});
</script>

<template>
  <div
    :data-testid="isStrip ? 'pinned-overview-charts' : 'overview-charts'"
    class="pr-overview-charts"
    :class="{
      'pr-overview-charts--strip': isStrip,
      'pr-overview-charts--collapsed': !isStrip && isCollapsed,
    }"
    role="group"
    :aria-label="isStrip ? undefined : sectionTitle"
    :style="{
      '--pr-overview-gutter': `${gutterWidth}px`,
      '--pr-overview-header-fill': LANE_GROUP_HEADER_FILL,
      '--pr-overview-header-hover': LANE_GROUP_HEADER_HOVER,
      '--pr-overview-lane-hover': LANE_HOVER_FILL,
      '--pr-overview-header-h': `${OVERVIEW_HEADER_H}px`,
      '--pr-overview-lane-h': `${OVERVIEW_LANE_H}px`,
      '--pr-overview-track-h': `${OVERVIEW_TRACK_H}px`,
      '--pr-overview-track-gap': `${OVERVIEW_TRACK_GAP}px`,
    }"
    @wheel="onChartsWheel"
  >
    <div
      v-if="!isStrip"
      class="pr-overview-header"
      data-testid="overview-header"
      role="button"
      tabindex="0"
      :aria-expanded="!isCollapsed"
      :aria-label="sectionTitle"
      @click="toggleCollapsed"
      @keydown.enter.prevent="toggleCollapsed"
      @keydown.space.prevent="toggleCollapsed"
    >
      <div class="pr-overview-gutter-cell pr-overview-gutter-cell--header">
        <Chevron
          class="pr-overview-chevron"
          :expanded="!isCollapsed"
        />
        <span class="pr-overview-header-label">{{ sectionTitle }}</span>
      </div>
      <div
        class="pr-overview-header-track"
        data-testid="overview-header-track"
        aria-hidden="true"
        @pointermove="onHeaderTrackPointerMove"
        @pointerleave="onHeaderTrackPointerLeave"
      />
    </div>

    <template v-if="isStrip || !isCollapsed">
      <div
        v-for="track in tracks"
        :key="track.id"
        class="pr-overview-track"
        :class="{ 'pr-overview-track--pinned': track.isPinned }"
        :data-series-id="track.id"
      >
        <div class="pr-overview-gutter-cell">
          <button
            type="button"
            class="pr-overview-pin"
            data-testid="overview-pin"
            :aria-label="pinLabel"
            :aria-pressed="track.isPinned"
            @click="onPinClick(track.id, track.isPinned, $event)"
            @pointerenter="pinHoverId = track.id"
            @pointerleave="pinHoverId = null"
            @focus="pinHoverId = track.id"
            @blur="pinHoverId = null"
          >
            <PinIcon :filled="track.isPinned || pinHoverId === track.id" />
            <span
              v-if="pinHoverId === track.id"
              class="pr-overview-pin-tip"
              role="tooltip"
            >{{ pinLabel }}</span>
          </button>
          <span class="pr-overview-label">{{ track.label }}</span>
        </div>
        <div
          class="pr-overview-chart-col"
          data-testid="overview-chart-col"
          @pointerdown="onChartPointerDown"
          @pointermove="onChartPointerMove(track.id, $event)"
          @pointerup="onChartPointerUp"
          @pointercancel="onChartPointerUp"
          @pointerleave="onChartPointerLeave"
        >
          <!-- 8px top gap is intentional empty hit area; paint sits in the bottom 16px. -->
          <div class="pr-overview-paint">
            <svg
              class="pr-overview-svg"
              :viewBox="`0 0 ${VIEW_W} ${TRACK_H}`"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                class="pr-overview-fill"
                :d="track.areaD"
                :fill="track.color"
              />
              <path
                class="pr-overview-stroke"
                :d="track.strokeD"
                :stroke="track.color"
                fill="none"
              />
            </svg>
          </div>
        </div>
      </div>
    </template>

    <Teleport to="body">
      <div
        v-if="showTip"
        class="pr-tooltip pr-overview-value-tip"
        data-testid="overview-value-tooltip"
        :style="tipPos"
      >
        <div
          v-for="row in tipRows"
          :key="row.id"
          class="pr-overview-value-tip__row"
          :class="{ 'is-active': row.id === hoverSeriesId }"
          :data-series-id="row.id"
        >
          <span
            class="pr-overview-value-tip__swatch"
            :style="{ background: row.color }"
          />
          <span class="pr-overview-value-tip__name">{{ row.label }}</span>
          <span class="pr-overview-value-tip__value">{{
            row.value == null ? '—' : row.value
          }}</span>
        </div>
      </div>
      <!-- Fixed outside the transformed overview stack so v≈0 is not clipped. -->
      <div
        v-for="dot in valueDots"
        :key="dot.id"
        class="pr-overview-value-dot"
        :class="{ 'is-active': dot.active }"
        data-testid="overview-value-dot"
        :data-series-id="dot.id"
        :style="dot.style"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.pr-overview-charts {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  min-height: 0;
  background: var(--pr-bg-deep, #1f1f1f);
  border-bottom: 1px solid var(--pr-divider, #3a3a3a);
}

.pr-overview-charts--strip {
  z-index: 6;
}

.pr-overview-header,
.pr-overview-track {
  display: grid;
  grid-template-columns: minmax(0, var(--pr-overview-gutter, 280px)) minmax(80px, 1fr);
  align-items: center;
  min-width: 0;
  box-sizing: border-box;
}

.pr-overview-header {
  height: var(--pr-overview-header-h, 40px);
  min-height: var(--pr-overview-header-h, 40px);
  background: var(--pr-overview-header-fill, #2a2a2a);
  border-bottom: 1px solid var(--pr-divider, #3a3a3a);
  color: #e6e6e6;
  cursor: pointer;
  user-select: none;
}

.pr-overview-header:hover {
  background: var(--pr-overview-header-hover, #323232);
}

.pr-overview-track {
  height: var(--pr-overview-lane-h, 24px);
  min-height: var(--pr-overview-lane-h, 24px);
  /* Inset line — not border-bottom — so the chart column keeps the full 24px hit
     target and the seam belongs to the track above (no tip flicker between series). */
  box-shadow: inset 0 -1px 0 var(--pr-divider, #3a3a3a);
}

/* Same whole-lane chrome as swim rows (LANE_HOVER_FILL / --pr-surface-raised). */
.pr-overview-track:hover {
  background: var(--pr-overview-lane-hover, var(--pr-surface-raised, #363636));
}

.pr-overview-track:hover .pr-overview-label {
  color: #fff;
}

.pr-overview-gutter-cell {
  display: flex;
  align-items: center;
  position: relative;
  padding: 0 12px 0 28px;
  min-width: 0;
  border-right: 1px solid var(--pr-divider, #3a3a3a);
  box-sizing: border-box;
  height: 100%;
}

.pr-overview-gutter-cell--header {
  padding-left: 8px;
  gap: 6px;
  /* Card strips have no gutter seam — keep the 统计分析 header continuous. */
  border-right: none;
}

.pr-overview-pin {
  box-sizing: border-box;
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  visibility: hidden;
  opacity: 0;
}

.pr-overview-track:hover .pr-overview-pin,
.pr-overview-track--pinned .pr-overview-pin,
.pr-overview-charts--strip .pr-overview-pin,
.pr-overview-pin:focus-visible {
  visibility: visible;
  opacity: 1;
}

.pr-overview-pin-tip {
  position: absolute;
  left: 0;
  bottom: calc(100% + 6px);
  z-index: 2;
  padding: 4px 8px;
  background: var(--pr-surface-raised, #363636);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
  font-size: 12px;
  line-height: 1.2;
  color: #e8e8e8;
  white-space: nowrap;
  pointer-events: none;
}

.pr-overview-chevron {
  flex: 0 0 auto;
}

.pr-overview-header-label {
  font-size: 14px;
  font-weight: 700;
  line-height: 22px;
  color: #e6e6e6;
  white-space: nowrap;
}

.pr-overview-label {
  font-size: 11px;
  color: var(--pr-tab-inactive, #b3b3b3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pr-overview-header-track {
  height: 100%;
  touch-action: none;
  /* Inherit the header's hand cursor — full strip is the collapse hit target. */
  cursor: pointer;
}

.pr-overview-chart-col {
  position: relative;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  box-sizing: border-box;
  /* Top 8px of the 24px lane is empty but still the hit target for this series. */
  touch-action: none;
  cursor: default;
}

.pr-overview-paint {
  position: relative;
  flex: 0 0 var(--pr-overview-track-h, 16px);
  height: var(--pr-overview-track-h, 16px);
  min-height: var(--pr-overview-track-h, 16px);
  pointer-events: none;
}

.pr-overview-svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.pr-overview-fill {
  fill-opacity: 0.45;
}

.pr-overview-stroke {
  stroke-width: 1.25;
  stroke-linejoin: miter;
  stroke-linecap: butt;
  vector-effect: non-scaling-stroke;
}
</style>

<style>
/* Teleported tip — match EventTooltip chrome (unscoped). */
.pr-overview-value-tip.pr-tooltip {
  position: fixed;
  z-index: 20;
  pointer-events: none;
  box-sizing: border-box;
  padding: 8px 10px;
  background: var(--pr-surface-raised, #363636);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
  font-size: 12px;
  line-height: 1.45;
  min-width: 140px;
  color: #b3b3b3;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pr-overview-value-tip__row {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.pr-overview-value-tip__swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.pr-overview-value-tip__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-overview-value-tip__value {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.pr-overview-value-tip__row.is-active {
  color: #e8e8e8;
  font-weight: 700;
}

/* Teleported value-dot — fixed so overview translateY / parent overflow cannot crop it. */
.pr-overview-value-dot {
  position: fixed;
  z-index: 19;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
  transform: translate(-50%, -50%);
  pointer-events: none;
  box-sizing: border-box;
}

.pr-overview-value-dot.is-active {
  width: 10px;
  height: 10px;
  border-width: 2px;
  z-index: 20;
}
</style>
