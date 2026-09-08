<script setup lang="ts">
import { computed } from 'vue';
import type { OverviewSeries } from '../../../domain/types';

const props = defineProps<{
  series: OverviewSeries[];
  /** Shared time window (ns); defaults to series min/max. */
  startTime?: number;
  endTime?: number;
}>();

const WIDTH = 640;
const ROW_H = 56;
const PAD_L = 56;
const PAD_R = 8;
const PAD_T = 6;
const PAD_B = 6;

const SERIES_COLORS: Record<string, { stroke: string; fill: string }> = {
  cube: { stroke: 'var(--pr-color-overview-cube, #3078f0)', fill: 'rgba(48, 120, 240, 0.35)' },
  vector: { stroke: 'var(--pr-color-card-bar-secondary, #5ed8a8)', fill: 'rgba(94, 216, 168, 0.35)' },
};

const t0 = computed(() => {
  if (props.startTime != null) return props.startTime;
  let min = Number.POSITIVE_INFINITY;
  for (const s of props.series) {
    for (const p of s.points) min = Math.min(min, p.t);
  }
  return Number.isFinite(min) ? min : 0;
});

const t1 = computed(() => {
  if (props.endTime != null) return props.endTime;
  let max = Number.NEGATIVE_INFINITY;
  for (const s of props.series) {
    for (const p of s.points) max = Math.max(max, p.t);
  }
  return Number.isFinite(max) && max > t0.value ? max : t0.value + 1;
});

function pathFor(series: OverviewSeries): string {
  const pts = series.points;
  if (pts.length === 0) return '';
  const span = Math.max(t1.value - t0.value, 1);
  const plotW = WIDTH - PAD_L - PAD_R;
  const plotH = ROW_H - PAD_T - PAD_B;
  const x = (t: number) => PAD_L + ((t - t0.value) / span) * plotW;
  const y = (v: number) => PAD_T + plotH * (1 - Math.max(0, Math.min(100, v)) / 100);
  let d = `M ${x(pts[0]!.t)} ${y(0)} L ${x(pts[0]!.t)} ${y(pts[0]!.v)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${x(pts[i]!.t)} ${y(pts[i]!.v)}`;
  }
  const last = pts[pts.length - 1]!;
  d += ` L ${x(last.t)} ${y(0)} Z`;
  return d;
}

function colorsFor(id: string) {
  return SERIES_COLORS[id] ?? { stroke: 'var(--pr-color-default, #606060)', fill: 'rgba(96,96,96,0.3)' };
}
</script>

<template>
  <div
    class="pr-overview-charts-panel"
    data-testid="overview-charts"
  >
    <div class="pr-overview-charts-title">统计分析</div>
    <div
      v-for="s in series"
      :key="s.id"
      class="pr-overview-charts-row"
      :data-series-id="s.id"
    >
      <div class="pr-overview-charts-label">{{ s.label }}</div>
      <svg
        class="pr-overview-charts-svg"
        :viewBox="`0 0 ${WIDTH} ${ROW_H}`"
        preserveAspectRatio="none"
        role="img"
        :aria-label="s.label"
      >
        <path
          :d="pathFor(s)"
          :fill="colorsFor(s.id).fill"
          :stroke="colorsFor(s.id).stroke"
          stroke-width="1.25"
        />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.pr-overview-charts-panel {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px 10px;
  background: var(--pr-bg-deep, #1f1f1f);
  border-top: 1px solid var(--pr-divider, #3a3a3a);
}

.pr-overview-charts-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--pr-tab-inactive, #b3b3b3);
  margin-bottom: 2px;
}

.pr-overview-charts-row {
  display: grid;
  grid-template-columns: 56px 1fr;
  align-items: stretch;
  gap: 8px;
  min-height: 48px;
}

.pr-overview-charts-label {
  font-size: 12px;
  color: var(--pr-tab-inactive, #b3b3b3);
  display: flex;
  align-items: center;
}

.pr-overview-charts-svg {
  width: 100%;
  height: 48px;
  display: block;
}
</style>
