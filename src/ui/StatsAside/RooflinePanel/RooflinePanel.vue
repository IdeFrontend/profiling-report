<script setup lang="ts">
import { computed, ref } from 'vue';
import { t } from '../../../i18n';
import {
  ROOFLINE_CHART_H as H,
  ROOFLINE_CHART_W as W,
  ROOFLINE_MIX_TOP_INSET as MIX_TOP_INSET,
  ROOFLINE_OPS_GAP_FROM_PLOT as OPS_GAP_FROM_PLOT,
  ROOFLINE_PAD as PAD,
  ROOFLINE_TOPS_GAP_ABOVE_PLOT as TOPS_GAP_ABOVE_PLOT,
  ROOFLINE_X_TICK_BELOW_PLOT as X_TICK_BELOW_PLOT,
  ROOFLINE_Y_TICK_LABEL_DY as Y_TICK_LABEL_DY,
} from './rooflineLayout';
import type { RooflinePoint, RooflineViewModel } from '../../../domain/types';

const props = defineProps<{
  model: RooflineViewModel;
  locale?: string;
}>();

const X_MIN = 1e-4;
const X_MAX = 100;
const Y_MIN = 1e-4;
const Y_MAX = 10;

const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;
const plotBottomY = PAD.t + plotH;

const mixY = PAD.t + MIX_TOP_INSET;
/** Screen px — SVG display size matches viewBox 1:1. */
const AXIS_FONT_PX = 9;

const xTickY = plotBottomY + X_TICK_BELOW_PLOT;
const topsX = PAD.l;
const topsY = PAD.t - TOPS_GAP_ABOVE_PLOT - AXIS_FONT_PX;
const opsX = PAD.l + plotW + OPS_GAP_FROM_PLOT;
const opsY = plotBottomY;

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

/** Roof polyline points in plot space (log-clamped). */
const roofPoints = computed(() => {
  const ridge =
    (props.model.peakComputeTops * 1000) / Math.max(props.model.peakBandwidthGBs, 1e-12);
  const xs = [X_MIN, ridge, X_MAX].map((x) => clampLog(x, X_MIN, X_MAX));
  const unique = [...new Set(xs.map((x) => x.toPrecision(8)))].map(Number);
  return unique.map((x) => ({ x: xToPx(x), y: yToPx(roofPerf(x)) }));
});

const roofPath = computed(() => {
  const pts = roofPoints.value.map((p) => `${p.x},${p.y}`);
  return `M ${pts.join(' L ')}`;
});

/** Closed area under the roof for the sketch gradient wash (v930 detail-strip-raised). */
const roofAreaPath = computed(() => {
  const pts = roofPoints.value;
  if (pts.length < 2) return '';
  const bottom = PAD.t + plotH;
  const line = pts.map((p) => `${p.x},${p.y}`).join(' L ');
  const last = pts[pts.length - 1]!;
  const first = pts[0]!;
  return `M ${line} L ${last.x},${bottom} L ${first.x},${bottom} Z`;
});

/** Highest roof Y — gradient 0% must sit on the ridge, not the plot frame top. */
const roofTopY = computed(() => {
  const pts = roofPoints.value;
  if (!pts.length) return PAD.t;
  return Math.min(...pts.map((p) => p.y));
});

const xTicks = [1e-4, 1e-3, 1e-2, 1e-1, 1, 10, 100];
const yTicks = [1e-4, 1e-3, 1e-2, 1e-1, 1, 10];

function fmtTick(v: number): string {
  if (v >= 1) return String(v);
  // Sketch uses decimals (0.0001 / 0.001 / 0.01 / 0.1), not 1e-n.
  const digits = Math.max(0, -Math.floor(Math.log10(v)));
  return v.toFixed(digits);
}

function fmtVal(v: number): string {
  if (v >= 1) return v.toFixed(3);
  return v.toPrecision(3);
}

const mixParts = computed(() =>
  props.model.mixLabels.map((m, i) => ({
    id: m.id,
    label: m.label,
    percent: `${m.percent.toFixed(6)}%`,
    prefix: i === 0 ? '' : ', ',
  })),
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
    <div class="pr-roofline__card">
      <div class="pr-roofline__card-head">
        <span class="pr-roofline__chart-title">GM/L2</span>
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
      </div>
      <svg
        class="pr-roofline__svg"
        data-testid="roofline-chart"
        :width="W"
        :height="H"
        :style="{ width: `${W}px`, height: `${H}px` }"
        :viewBox="`0 0 ${W} ${H}`"
        role="img"
        :aria-label="t('roofline', locale)"
      >
        <defs>
          <!--
            Wash under roof (sampled detail-strip-raised):
            ~16% at ridge → slow fade → 0 at floor. y1 = ridge.
          -->
          <linearGradient
            id="pr-roofline-area"
            data-testid="roofline-area-gradient"
            gradientUnits="userSpaceOnUse"
            :x1="PAD.l"
            :y1="roofTopY"
            :x2="PAD.l"
            :y2="plotBottomY"
          >
            <stop
              offset="0%"
              stop-color="#3078f0"
              stop-opacity="0.16"
            />
            <stop
              offset="40%"
              stop-color="#3078f0"
              stop-opacity="0.1"
            />
            <stop
              offset="75%"
              stop-color="#3078f0"
              stop-opacity="0.05"
            />
            <stop
              offset="100%"
              stop-color="#3078f0"
              stop-opacity="0"
            />
          </linearGradient>
          <clipPath id="pr-roofline-plot-clip">
            <rect
              :x="PAD.l"
              :y="PAD.t"
              :width="plotW"
              :height="plotH"
            />
          </clipPath>
        </defs>
        <rect
          :x="PAD.l"
          :y="PAD.t"
          :width="plotW"
          :height="plotH"
          class="pr-roofline__frame"
        />
        <g
          class="pr-roofline__plot"
          clip-path="url(#pr-roofline-plot-clip)"
        >
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
            data-testid="roofline-area"
            class="pr-roofline__area"
            :d="roofAreaPath"
            fill="url(#pr-roofline-area)"
          />
          <path
            data-testid="roofline-roof"
            class="pr-roofline__roof"
            :d="roofPath"
            fill="none"
          />
        </g>
        <!-- Markers sit outside plot clip so edge circles are not cropped. -->
        <g class="pr-roofline__markers">
          <circle
            v-for="(rp, idx) in roofPoints"
            :key="`rv-${idx}`"
            class="pr-roofline__roof-vertex"
            :cx="rp.x"
            :cy="rp.y"
            r="4"
          />
          <g
            v-for="p in model.points"
            :key="p.id"
          >
            <circle
              data-testid="roofline-point"
              :cx="xToPx(p.intensity)"
              :cy="yToPx(p.performance)"
              r="4"
              class="pr-roofline__point"
              :class="{ 'pr-roofline__point--hollow': p.style === 'hollow' }"
              @mouseenter="hovered = p"
              @mouseleave="hovered = null"
            />
          </g>
        </g>
        <text
          v-if="mixParts.length"
          class="pr-roofline__mix"
          data-testid="roofline-mix"
          :x="PAD.l + plotW / 2"
          :y="mixY"
          text-anchor="middle"
        >
          <template
            v-for="part in mixParts"
            :key="part.id"
          >
            <tspan class="pr-roofline__mix-name">{{ part.prefix }}{{ part.label }}</tspan>
            <tspan class="pr-roofline__mix-pct">&nbsp;({{ part.percent }})</tspan>
          </template>
        </text>
        <text
          v-for="tick in xTicks"
          :key="`xt-${tick}`"
          class="pr-roofline__tick"
          :x="xToPx(tick)"
          :y="xTickY"
          text-anchor="middle"
        >{{ fmtTick(tick) }}</text>
        <text
          v-for="tick in yTicks"
          :key="`yt-${tick}`"
          class="pr-roofline__tick"
          :x="PAD.l - 4"
          :y="yToPx(tick) + Y_TICK_LABEL_DY"
          text-anchor="end"
        >{{ fmtTick(tick) }}</text>
        <!-- Ops/Byte: bottom grid line, 3px right of plot. -->
        <text
          class="pr-roofline__axis pr-roofline__axis--x"
          :x="opsX"
          :y="opsY"
          text-anchor="start"
          dominant-baseline="middle"
        >Ops/Byte</text>
        <!-- TOps/s: ends at left grid line, 9px above plot top. -->
        <text
          class="pr-roofline__axis pr-roofline__axis--y"
          :x="topsX"
          :y="topsY"
          text-anchor="end"
          dominant-baseline="hanging"
        >TOps/s</text>
      </svg>
    </div>
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
/* Title sits on aside; raised chart card is one uniform grey. */
.pr-roofline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.pr-roofline__title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: #ffffff;
}

/* Whole card (header + plot + tick gutters) — sketch uniform #262626. */
.pr-roofline__card {
  display: flex;
  flex-direction: column;
  gap: 8px; /* 6px under GM/L2 before plot (was 2px) */
  min-width: 0;
  padding: 6px 8px 4px;
  border-radius: 8px;
  background: #262626;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.pr-roofline__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px;
  min-width: 0;
}

.pr-roofline__chart-title {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
}

.pr-roofline__legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  min-width: 0;
  font-size: 11px;
  line-height: 1.2;
  color: #9a9a9a;
}

.pr-roofline__leg-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #9a9a9a;
}

.pr-roofline__leg-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #3078f0;
  border: 1.5px solid #3078f0;
  box-sizing: border-box;
}

.pr-roofline__leg-dot--hollow {
  background: transparent;
}

.pr-roofline__svg {
  /* Sketch-native W×H — fixed px so SVG text/strokes do not scale with aside width. */
  flex-shrink: 0;
  display: block;
  overflow: visible;
}

.pr-roofline__frame {
  fill: #262626;
  stroke: none;
}

.pr-roofline__grid line {
  stroke: #4a5568;
  stroke-width: 0.5;
}

.pr-roofline__area {
  stroke: none;
  pointer-events: none;
}

.pr-roofline__roof {
  stroke: #3078f0;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.pr-roofline__roof-vertex {
  fill: #262626;
  stroke: #3078f0;
  stroke-width: 1.75;
  pointer-events: none;
}

.pr-roofline__point {
  fill: #3078f0;
  stroke: #3078f0;
  cursor: pointer;
}

.pr-roofline__point--hollow {
  fill: #262626;
  stroke-width: 1.75;
}

.pr-roofline__tick {
  fill: #999999;
  font-size: 9px;
}

.pr-roofline__axis {
  fill: #999999;
  font-size: 9px;
}

.pr-roofline__mix {
  font-size: 10px;
}

/* Sketch mix is two-tone: names #999, percents #fff. */
.pr-roofline__mix-name {
  fill: #999999;
}

.pr-roofline__mix-pct {
  fill: #ffffff;
}

.pr-roofline__tip {
  font-size: 11px;
  color: #d0d8e0;
  min-height: 1.2em;
}
</style>
