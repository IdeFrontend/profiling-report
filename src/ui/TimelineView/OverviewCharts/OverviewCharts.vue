<script setup lang="ts">
import { computed, ref } from 'vue';
import type { OverviewSeries } from '../../../domain/types';
import { t } from '../../../i18n';
import PinIcon from '../../PinIcon.vue';
import {
  areaPathFromVertices,
  stepAfterVertices,
  stepValueAt,
  strokePathFromVertices,
} from './stepPath';
import { OVERVIEW_TRACK_H } from './overviewLayout';

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
    /** Shared playhead x (0…1) — vertical cursor over chart tracks. */
    cursorXRatio?: number | null;
    /** Gray the cursor when magnetized on the swimlane. */
    cursorSnapped?: boolean;
    /** Canonical ns under the cursor (for value tooltips). */
    cursorTime?: number | null;
  }>(),
  {
    gutterWidth: 280,
    locale: 'zh-CN',
    pinnedOverviewIds: () => [],
    variant: 'section',
    cursorXRatio: null,
    cursorSnapped: false,
    cursorTime: null,
  },
);

const emit = defineEmits<{
  'pin-overview': [seriesId: string];
  'unpin-overview': [seriesId: string];
  cursor: [payload: { time: number; xRatio: number; snapped?: boolean } | null];
  'scroll-y-delta': [delta: number];
}>();

const VIEW_W = 1000;
const TRACK_H = OVERVIEW_TRACK_H;

const sectionTitle = computed(() => t('overviewStats', props.locale));
const pinLabel = computed(() => t('pin', props.locale));
const pinned = computed(() => new Set(props.pinnedOverviewIds ?? []));
const isStrip = computed(() => props.variant === 'strip');
const pinHoverId = ref<string | null>(null);
const hoverSeriesId = ref<string | null>(null);
const tipPos = ref({ left: '0px', top: '0px' });

/** Map counter name → stroke CSS color (fill uses same with opacity). */
function colorForName(name: string): string {
  const key = name.toLowerCase();
  if (key === 'cube') return 'var(--pr-color-overview-cube)';
  if (key === 'vector') return 'var(--pr-color-vector)';
  if (key === 'scalar') return 'var(--pr-color-scalar)';
  if (key === 'mte1') return 'var(--pr-color-mte1)';
  if (key === 'mte2') return 'var(--pr-color-mte2)';
  if (key === 'mte3') return 'var(--pr-color-mte3)';
  if (key === 'fixp' || key === 'fixpipe') return 'var(--pr-color-fixp)';
  if (key.includes('通信') || key === 'comm' || key === 'communication') {
    return 'var(--pr-color-mov)';
  }
  return 'var(--pr-color-default)';
}

const x0 = computed(() => props.startTime);
const x1 = computed(() => {
  const span = props.endTime - props.startTime;
  return span > 0 ? props.endTime : props.startTime + 1;
});

const tracks = computed(() =>
  props.series.map((s) => {
    const maxV = Math.max(0, ...s.points.map((p) => p.v), 1);
    return {
      ...s,
      maxV,
      color: colorForName(s.id),
      isPinned: pinned.value.has(s.id),
    };
  }),
);

function pathHelpers(maxV: number) {
  const xSpan = x1.value - x0.value;
  const toX = (t: number) => ((t - x0.value) / xSpan) * VIEW_W;
  const toY = (v: number) => TRACK_H * (1 - v / maxV);
  return { toX, toY };
}

function areaPath(points: { t: number; v: number }[], maxV: number): string {
  const verts = stepAfterVertices(points, x0.value, x1.value);
  const { toX, toY } = pathHelpers(maxV);
  return areaPathFromVertices(verts, TRACK_H, toX, toY);
}

function strokePath(points: { t: number; v: number }[], maxV: number): string {
  const verts = stepAfterVertices(points, x0.value, x1.value);
  const { toX, toY } = pathHelpers(maxV);
  return strokePathFromVertices(verts, toX, toY);
}

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

function onTrackPointerMove(seriesId: string, e: PointerEvent) {
  const chart = (e.currentTarget as HTMLElement).querySelector(
    '.pr-overview-svg',
  ) as HTMLElement | null;
  const el = chart ?? (e.currentTarget as HTMLElement);
  const { time, xRatio } = timeAtClientX(e.clientX, el);
  hoverSeriesId.value = seriesId;
  tipPos.value = { left: `${e.clientX + 12}px`, top: `${e.clientY + 12}px` };
  emit('cursor', { time, xRatio, snapped: false });
}

function onTrackPointerLeave() {
  hoverSeriesId.value = null;
}

function onChartsWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) return;
  if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
  e.preventDefault();
  emit('scroll-y-delta', e.deltaY);
}

const tipTrack = computed(() => {
  const id = hoverSeriesId.value;
  if (!id) return null;
  return tracks.value.find((tr) => tr.id === id) ?? null;
});

const tipValue = computed(() => {
  const track = tipTrack.value;
  const time = props.cursorTime;
  if (!track || time == null) return null;
  return stepValueAt(track.points, time);
});

const showTip = computed(() => tipTrack.value != null && tipValue.value != null);
</script>

<template>
  <div
    :data-testid="isStrip ? 'pinned-overview-charts' : 'overview-charts'"
    class="pr-overview-charts"
    :class="{ 'pr-overview-charts--strip': isStrip }"
    role="group"
    :aria-label="isStrip ? undefined : sectionTitle"
    :style="{ '--pr-overview-gutter': `${gutterWidth}px` }"
    @wheel="onChartsWheel"
  >
    <div
      v-if="!isStrip"
      class="pr-overview-header"
    >
      <div class="pr-overview-gutter-cell pr-overview-gutter-cell--header">
        <span
          class="pr-overview-chevron"
          aria-hidden="true"
        >▾</span>
        <span class="pr-overview-header-label">{{ sectionTitle }}</span>
      </div>
      <div
        class="pr-overview-header-track"
        aria-hidden="true"
      />
    </div>

    <div
      v-for="track in tracks"
      :key="track.id"
      class="pr-overview-track"
      :class="{ 'pr-overview-track--pinned': track.isPinned }"
      :data-series-id="track.id"
      @pointermove="onTrackPointerMove(track.id, $event)"
      @pointerleave="onTrackPointerLeave"
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
      <div class="pr-overview-chart-col">
        <svg
          class="pr-overview-svg"
          :viewBox="`0 0 ${VIEW_W} ${TRACK_H}`"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            class="pr-overview-fill"
            :d="areaPath(track.points, track.maxV)"
            :fill="track.color"
          />
          <path
            class="pr-overview-stroke"
            :d="strokePath(track.points, track.maxV)"
            :stroke="track.color"
            fill="none"
          />
        </svg>
      </div>
    </div>

    <div
      v-if="cursorXRatio != null"
      class="pr-overview-cursor-layer"
      aria-hidden="true"
    >
      <div
        class="pr-overview-cursor"
        data-testid="overview-cursor"
        :class="{ 'pr-overview-cursor--snapped': cursorSnapped }"
        :style="{ left: `${cursorXRatio * 100}%` }"
      />
    </div>

    <Teleport to="body">
      <div
        v-if="showTip && tipTrack"
        class="pr-tooltip pr-overview-value-tip"
        data-testid="overview-value-tooltip"
        :style="tipPos"
      >
        <div class="pr-tooltip__name">{{ tipTrack.label }}</div>
        <div>{{ tipValue }}</div>
      </div>
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
  padding-bottom: 4px;
}

.pr-overview-charts--strip {
  padding-top: 4px;
  padding-bottom: 4px;
  z-index: 6;
}

.pr-overview-header,
.pr-overview-track {
  display: grid;
  grid-template-columns: minmax(0, var(--pr-overview-gutter, 280px)) minmax(80px, 1fr);
  align-items: center;
  min-width: 0;
}

.pr-overview-header {
  height: 28px;
  min-height: 28px;
}

.pr-overview-track {
  height: 16px;
  min-height: 16px;
  margin-bottom: 8px;
}

.pr-overview-track:last-child {
  margin-bottom: 8px;
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
  padding-left: 12px;
  gap: 6px;
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
  font-size: 10px;
  color: #fff;
  line-height: 1;
}

.pr-overview-header-label {
  font-size: 12px;
  font-weight: 500;
  color: #fff;
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
}

.pr-overview-chart-col {
  position: relative;
  min-width: 0;
  height: 100%;
}

.pr-overview-svg {
  display: block;
  width: 100%;
  height: 16px;
  overflow: visible;
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

.pr-overview-cursor-layer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: var(--pr-overview-gutter, 280px);
  pointer-events: none;
  z-index: 9;
}

.pr-overview-cursor {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #317af7;
  transform: translateX(-50%);
}

.pr-overview-cursor--snapped {
  background: #4c4c4c;
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
  min-width: 120px;
  color: #e8e8e8;
}

.pr-overview-value-tip .pr-tooltip__name {
  font-weight: 600;
  margin-bottom: 4px;
}
</style>
