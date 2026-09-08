<script setup lang="ts">
import { computed } from 'vue';
import type { OverviewSeries } from '../../../domain/types';
import { t } from '../../../i18n';
import { areaPathFromVertices, stepAfterVertices, strokePathFromVertices } from './stepPath';

const props = withDefaults(
  defineProps<{
    series: OverviewSeries[];
    /** Visible swimlane window (canonical ns). */
    startTime: number;
    endTime: number;
    /** Match TimelineView / Swimlane gutter column width. */
    gutterWidth?: number;
    locale?: string;
  }>(),
  { gutterWidth: 280, locale: 'zh-CN' },
);

/** v930: single overview track paint height (CSS px). */
const TRACK_H = 16;
const VIEW_W = 1000;

const sectionTitle = computed(() => t('overviewStats', props.locale));

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
    return { ...s, maxV, color: colorForName(s.id) };
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
</script>

<template>
  <div
    data-testid="overview-charts"
    class="pr-overview-charts"
    role="group"
    :aria-label="sectionTitle"
    :style="{ '--pr-overview-gutter': `${gutterWidth}px` }"
  >
    <div class="pr-overview-header">
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
      :data-series-id="track.id"
    >
      <div class="pr-overview-gutter-cell">
        <span class="pr-overview-label">{{ track.label }}</span>
      </div>
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
</template>

<style scoped>
.pr-overview-charts {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  min-height: 0;
  background: var(--pr-bg-deep, #1f1f1f);
  border-bottom: 1px solid var(--pr-divider, #3a3a3a);
  padding-bottom: 4px;
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

/* v930: 16px chart + 8px gap between tracks */
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
</style>
