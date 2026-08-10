<script setup lang="ts">
import { computed, ref } from 'vue';
import { t } from '../../i18n';
import type { RooflinePoint, RooflineViewModel } from '../../domain/types';

const props = defineProps<{
  model: RooflineViewModel;
  locale?: string;
}>();

const X_MIN = 1e-4;
const X_MAX = 100;
const Y_MIN = 1e-4;
const Y_MAX = 10;

const W = 320;
const H = 220;
const PAD = { l: 48, r: 12, t: 28, b: 36 };

const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

const hovered = ref<RooflinePoint | null>(null);

const hasPoints = computed(() => (props.model.points?.length ?? 0) > 0);

function clampLog(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function xToPx(intensity: number): number {
  const v = clampLog(intensity, X_MIN, X_MAX);
  const t = (Math.log10(v) - Math.log10(X_MIN)) / (Math.log10(X_MAX) - Math.log10(X_MIN));
  return PAD.l + t * plotW;
}

function yToPx(perf: number): number {
  const v = clampLog(perf, Y_MIN, Y_MAX);
  const t = (Math.log10(v) - Math.log10(Y_MIN)) / (Math.log10(Y_MAX) - Math.log10(Y_MIN));
  return PAD.t + (1 - t) * plotH;
}

/** I-Q11d: roof TOps/s at intensity. */
function roofPerf(intensity: number): number {
  const bwLimited = (props.model.peakBandwidthGBs * intensity) / 1000;
  return Math.min(props.model.peakComputeTops, bwLimited);
}

const roofPath = computed(() => {
  const ridge =
    (props.model.peakComputeTops * 1000) / Math.max(props.model.peakBandwidthGBs, 1e-12);
  const xs = [X_MIN, ridge, X_MAX].map((x) => clampLog(x, X_MIN, X_MAX));
  const unique = [...new Set(xs.map((x) => x.toPrecision(8)))].map(Number);
  const pts = unique.map((x) => `${xToPx(x)},${yToPx(roofPerf(x))}`);
  return `M ${pts.join(' L ')}`;
});

const xTicks = [1e-4, 1e-3, 1e-2, 1e-1, 1, 10, 100];
const yTicks = [1e-4, 1e-3, 1e-2, 1e-1, 1, 10];

function fmtTick(v: number): string {
  if (v >= 1) return String(v);
  return v.toExponential(0).replace('e-0', 'e-').replace('e+', 'e');
}

function fmtVal(v: number): string {
  if (v >= 1) return v.toFixed(3);
  return v.toPrecision(3);
}

const mixText = computed(() =>
  props.model.mixLabels.map((m) => `${m.label} (${m.percent.toFixed(2)}%)`).join('  '),
);

const tooltipText = computed(() => {
  const p = hovered.value;
  if (!p) return '';
  return `${p.label}: ${fmtVal(p.intensity)} Ops/Byte, ${fmtVal(p.performance)} TOps/s`;
});
</script>

<template>
  <div
    v-if="hasPoints"
    class="pr-roofline"
    data-testid="roofline-panel"
  >
    <h4 class="pr-roofline__title">
      {{ t('roofline', locale) }}
    </h4>
    <div class="pr-roofline__legend">
      <span
        v-for="p in model.points"
        :key="p.id"
        class="pr-roofline__leg-item"
      >
        <span
          class="pr-roofline__leg-dot"
          :class="{ 'pr-roofline__leg-dot--hollow': p.style === 'hollow' }"
        />
        {{ p.label }}
      </span>
    </div>
    <svg
      class="pr-roofline__svg"
      data-testid="roofline-chart"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="t('roofline', locale)"
    >
      <!-- plot frame -->
      <rect
        :x="PAD.l"
        :y="PAD.t"
        :width="plotW"
        :height="plotH"
        class="pr-roofline__frame"
      />
      <g class="pr-roofline__grid">
        <line
          v-for="tick in xTicks"
          :key="`xg-${tick}`"
          :x1="xToPx(tick)"
          :x2="xToPx(tick)"
          :y1="PAD.t"
          :y2="PAD.t + plotH"
        />
        <line
          v-for="tick in yTicks"
          :key="`yg-${tick}`"
          :x1="PAD.l"
          :x2="PAD.l + plotW"
          :y1="yToPx(tick)"
          :y2="yToPx(tick)"
        />
      </g>
      <path
        data-testid="roofline-roof"
        class="pr-roofline__roof"
        :d="roofPath"
        fill="none"
      />
      <text
        v-if="mixText"
        class="pr-roofline__mix"
        data-testid="roofline-mix"
        :x="PAD.l + plotW - 4"
        :y="PAD.t + 12"
        text-anchor="end"
      >{{ mixText }}</text>
      <g
        v-for="p in model.points"
        :key="p.id"
      >
        <circle
          data-testid="roofline-point"
          :cx="xToPx(p.intensity)"
          :cy="yToPx(p.performance)"
          r="5"
          class="pr-roofline__point"
          :class="{ 'pr-roofline__point--hollow': p.style === 'hollow' }"
          @mouseenter="hovered = p"
          @mouseleave="hovered = null"
        />
      </g>
      <!-- axes labels -->
      <text
        v-for="tick in xTicks"
        :key="`xt-${tick}`"
        class="pr-roofline__tick"
        :x="xToPx(tick)"
        :y="H - 8"
        text-anchor="middle"
      >{{ fmtTick(tick) }}</text>
      <text
        v-for="tick in yTicks"
        :key="`yt-${tick}`"
        class="pr-roofline__tick"
        :x="PAD.l - 6"
        :y="yToPx(tick) + 3"
        text-anchor="end"
      >{{ fmtTick(tick) }}</text>
      <text
        class="pr-roofline__axis"
        :x="PAD.l + plotW / 2"
        :y="H - 1"
        text-anchor="middle"
      >Ops/Byte</text>
      <text
        class="pr-roofline__axis"
        :x="12"
        :y="PAD.t + plotH / 2"
        text-anchor="middle"
        transform-origin="12 center"
        :transform="`rotate(-90 12 ${PAD.t + plotH / 2})`"
      >TOps/s</text>
    </svg>
    <div
      v-if="hovered"
      class="pr-roofline__tip"
      data-testid="roofline-tooltip"
    >
      {{ tooltipText }}
    </div>
  </div>
</template>

<style scoped>
.pr-roofline {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.pr-roofline__title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.pr-roofline__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 11px;
  color: #b0b8c0;
}

.pr-roofline__leg-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.pr-roofline__leg-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3a8cff;
  border: 1.5px solid #3a8cff;
}

.pr-roofline__leg-dot--hollow {
  background: transparent;
}

.pr-roofline__svg {
  width: 100%;
  height: auto;
  display: block;
}

.pr-roofline__frame {
  fill: transparent;
  stroke: #4a5560;
  stroke-width: 1;
}

.pr-roofline__grid line {
  stroke: #3a424a;
  stroke-width: 0.5;
}

.pr-roofline__roof {
  stroke: #3a8cff;
  stroke-width: 2.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.pr-roofline__point {
  fill: #3a8cff;
  stroke: #3a8cff;
  cursor: pointer;
}

.pr-roofline__point--hollow {
  fill: var(--pr-bg-panel, #303030);
  stroke-width: 2;
}

.pr-roofline__tick {
  fill: #8a929a;
  font-size: 8px;
}

.pr-roofline__axis {
  fill: #a0a8b0;
  font-size: 9px;
}

.pr-roofline__mix {
  fill: #c8d0d8;
  font-size: 8px;
}

.pr-roofline__tip {
  font-size: 11px;
  color: #d0d8e0;
  min-height: 1.2em;
}
</style>
