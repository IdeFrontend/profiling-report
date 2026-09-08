<script setup lang="ts">
import { computed } from 'vue';
import type { OverviewSeries } from '../../../domain/types';

const props = defineProps<{
  series: OverviewSeries[];
  /** Visible swimlane window (canonical ns). */
  startTime: number;
  endTime: number;
}>();

const TRACK_H = 36;
const PAD_Y = 2;

/** Map counter name → CSS color token (DATA-39a keeps raw names). */
function colorForName(name: string): string {
  const key = name.toLowerCase();
  if (key === 'cube') return 'var(--pr-color-overview-cube)';
  if (key === 'vector') return 'var(--pr-color-vector)';
  if (key === 'scalar') return 'var(--pr-color-scalar)';
  if (key === 'mte1') return 'var(--pr-color-mte1)';
  if (key === 'mte2') return 'var(--pr-color-mte2)';
  if (key === 'mte3') return 'var(--pr-color-mte3)';
  if (key === 'fixp' || key === 'fixpipe') return 'var(--pr-color-fixp)';
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

function areaPath(
  points: { t: number; v: number }[],
  maxV: number,
  width: number,
): string {
  if (points.length === 0 || width <= 0) return '';
  const xSpan = x1.value - x0.value;
  const h = TRACK_H - PAD_Y * 2;
  const toX = (t: number) => ((t - x0.value) / xSpan) * width;
  const toY = (v: number) => PAD_Y + h * (1 - v / maxV);
  const clipped = points.filter((p) => p.t >= x0.value - xSpan && p.t <= x1.value + xSpan);
  if (clipped.length === 0) return '';
  let d = `M ${toX(clipped[0]!.t)} ${TRACK_H}`;
  for (const p of clipped) {
    d += ` L ${toX(p.t)} ${toY(p.v)}`;
  }
  d += ` L ${toX(clipped[clipped.length - 1]!.t)} ${TRACK_H} Z`;
  return d;
}
</script>

<template>
  <div
    data-testid="overview-charts"
    class="pr-overview-charts"
    role="group"
    aria-label="Overview series"
  >
    <div
      v-for="track in tracks"
      :key="track.id"
      class="pr-overview-track"
      :data-series-id="track.id"
    >
      <div class="pr-overview-label">
        {{ track.label }}
      </div>
      <svg
        class="pr-overview-svg"
        :viewBox="`0 0 1000 ${TRACK_H}`"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          :d="areaPath(track.points, track.maxV, 1000)"
          :fill="track.color"
          fill-opacity="0.55"
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
}

.pr-overview-track {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: stretch;
  height: 36px;
  min-height: 36px;
}

.pr-overview-label {
  display: flex;
  align-items: center;
  padding: 0 8px;
  font-size: 11px;
  color: var(--pr-tab-inactive, #b3b3b3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pr-overview-svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
