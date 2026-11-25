<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { t } from '../../../i18n';
import {
  FIXED_TIP_OFFSET_PX,
  placeFixedTip,
} from '../../placeFixedTip';
import {
  ROOFLINE_CHART_H as H,
  ROOFLINE_CHART_W as W,
  ROOFLINE_OPS_GAP_FROM_PLOT as OPS_GAP_FROM_PLOT,
  ROOFLINE_PAD as PAD,
  ROOFLINE_TOPS_GAP_ABOVE_PLOT as TOPS_GAP_ABOVE_PLOT,
  ROOFLINE_X_TICK_BELOW_PLOT as X_TICK_BELOW_PLOT,
  ROOFLINE_Y_TICK_LABEL_DY as Y_TICK_LABEL_DY,
} from './rooflineLayout';
import type { RooflinePoint, RooflineSeries, RooflineViewModel } from '../../../domain/types';

const props = defineProps<{
  model: RooflineViewModel;
  locale?: string;
}>();

const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;
const plotBottomY = PAD.t + plotH;

const xTickY = plotBottomY + X_TICK_BELOW_PLOT;
/** Left edge of TOps/s matches the aside title / AIV / AIC (not end-anchored at the plot). */
const topsX = 0;
/**
 * Mix + TOps/s share one alphabetic baseline just above the plot (PR-ROOF-002b).
 * Do **not** move mix inside the plot (`PAD.t + inset`) — that was reverted.
 * Avoid `hanging`: browsers disagree on it for CSS-styled / multi-tspan text.
 */
const topsY = PAD.t - TOPS_GAP_ABOVE_PLOT;
const mixY = topsY;
const opsX = PAD.l + plotW + OPS_GAP_FROM_PLOT;
const opsY = plotBottomY;

/**
 * Hover tip follows EventTooltip / StatsAside card tips: teleported `position: fixed`
 * beside the pointer so the aside cannot crop it and the chart no longer reserves a
 * bottom text band (PR-ROOF-004). Dismiss on leave, aside scroll, window resize, and
 * `pointercancel` matches StatsAside's `closeTip` contract so a fixed box cannot strand.
 */
const rootEl = ref<HTMLElement | null>(null);
const tipId = useId();
const hoveredId = ref<string | null>(null);
const tipPos = ref<{ left: string; top: string } | null>(null);
/**
 * placeFixedTip estimate. Width is the tip max-width. Height covers a wrapped
 * emulate label (48-char symbol + level + PC → up to 3 name lines) plus the
 * two value lines: 12px × 1.45 × 5 + 4px name margin + 8×2 pad + 1×2 border = 109.
 * ponytail: estimate, not a measured box. Upgrade: place from the tip's offsetHeight
 * after mount if labels grow past three lines.
 */
const TIP_EST_W = 280;
const TIP_EST_H = 112;
let asideScrollEl: Element | null = null;

/** Experimental: legend hover → emphasize that series' roof on the plot. */
const legendHoverId = ref<string | null>(null);
/**
 * Sketch (report-stats-duration-source): filled rounded-square knees on the
 * roof ridges; measured points off the lines are filled circles.
 */
const KNEE = 8;
const KNEE_RX = 2;
const POINT_R = 4;

const hasPoints = computed(() => (props.model.points?.length ?? 0) > 0);

/**
 * Normalize series for draw. Hosts may still pass the interim M2 shape
 * (`peakComputeTops` / `peakBandwidthGBs` on the root, no `series`).
 */
const seriesList = computed((): RooflineSeries[] => {
  const listed = props.model.series;
  if (listed && listed.length > 0) return listed;
  const legacy = props.model as RooflineViewModel & {
    peakComputeTops?: number;
    peakBandwidthGBs?: number;
  };
  if (
    legacy.peakComputeTops != null &&
    legacy.peakComputeTops > 0 &&
    legacy.peakBandwidthGBs != null &&
    legacy.peakBandwidthGBs > 0
  ) {
    return [
      {
        id: 'legacy',
        group: 'aic',
        label: 'Peak',
        color: '#E53935',
        peakComputeTops: legacy.peakComputeTops,
        peakBandwidthGBs: legacy.peakBandwidthGBs,
        slopeStyle: 'solid',
      },
    ];
  }
  return [];
});

const aivSeries = computed(() => seriesList.value.filter((s) => s.group === 'aiv'));
const aicSeries = computed(() => seriesList.value.filter((s) => s.group === 'aic'));
/** Shared legend columns so nth AIV / AIC swatches share a vertical edge. */
const legendColCount = computed(() =>
  Math.max(aivSeries.value.length, aicSeries.value.length, 1),
);
const legendGridStyle = computed(() => ({
  gridTemplateColumns: `28px repeat(${legendColCount.value}, max-content)`,
}));

/** Paint highlighted roof last so it sits above siblings. */
const roofDrawOrder = computed(() => {
  const list = [...seriesList.value];
  const id = legendHoverId.value;
  if (!id) return list;
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) return list;
  const [hit] = list.splice(i, 1);
  list.push(hit!);
  return list;
});

function roofHighlightClass(id: string): Record<string, boolean> {
  const hover = legendHoverId.value;
  return {
    'pr-roofline__roof-g--lit': hover === id,
    'pr-roofline__roof-g--dim': hover != null && hover !== id,
  };
}

/** Log domain from points + roofs. */
const domains = computed(() => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of props.model.points) {
    if (p.intensity > 0) xs.push(p.intensity);
    if (p.performance > 0) ys.push(p.performance);
  }
  for (const s of seriesList.value) {
    if (s.peakComputeTops > 0) ys.push(s.peakComputeTops);
    if (s.peakBandwidthGBs > 0 && s.peakComputeTops > 0) {
      const ridge = (s.peakComputeTops * 1000) / s.peakBandwidthGBs;
      if (ridge > 0) xs.push(ridge);
    }
  }
  // Data-driven decade floors/ceils — no hard cap. Force ≥1 decade of span so a
  // lone power-of-ten value cannot collapse the log map to NaN. 1e-3 / 1e-4 are
  // empty-data fallbacks only; real samples keep their own decade.
  const xMin = xs.length ? niceFloor(Math.min(...xs)) : 1e-3;
  let xMax = niceCeil(xs.length ? Math.max(...xs) : 1);
  if (xMax <= xMin) xMax = xMin * 10;
  const yMin = ys.length ? niceFloor(Math.min(...ys)) : 1e-4;
  let yMax = niceCeil(ys.length ? Math.max(...ys) : 1);
  if (yMax <= yMin) yMax = yMin * 10;
  return { xMin, xMax, yMin, yMax };
});

function niceFloor(v: number): number {
  if (!(v > 0)) return 1e-3;
  return 10 ** Math.floor(Math.log10(v));
}

function niceCeil(v: number): number {
  if (!(v > 0)) return 1;
  return 10 ** Math.ceil(Math.log10(v));
}

function clampLog(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function xToPx(intensity: number): number {
  const { xMin, xMax } = domains.value;
  const v = clampLog(intensity, xMin, xMax);
  const t = (Math.log10(v) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin));
  return PAD.l + t * plotW;
}

function yToPx(perf: number): number {
  const { yMin, yMax } = domains.value;
  const v = clampLog(perf, yMin, yMax);
  const t = (Math.log10(v) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin));
  return PAD.t + (1 - t) * plotH;
}

/** Roof TOps/s at intensity: min(p_peak, b_peak_GBs * I / 1000). */
function roofPerf(s: RooflineSeries, intensity: number): number {
  const bwLimited = (s.peakBandwidthGBs * intensity) / 1000;
  return Math.min(s.peakComputeTops, bwLimited);
}

function roofSegments(s: RooflineSeries): { slope: string; plateau: string; ridgeX: number; ridgeY: number } {
  const { xMin, xMax } = domains.value;
  const ridge = clampLog(
    (s.peakComputeTops * 1000) / Math.max(s.peakBandwidthGBs, 1e-12),
    xMin,
    xMax,
  );
  const yRidge = yToPx(roofPerf(s, ridge));
  const xRidge = xToPx(ridge);
  const slope = `M ${xToPx(xMin)},${yToPx(roofPerf(s, xMin))} L ${xRidge},${yRidge}`;
  const plateau = `M ${xRidge},${yRidge} L ${xToPx(xMax)},${yToPx(roofPerf(s, xMax))}`;
  return { slope, plateau, ridgeX: xRidge, ridgeY: yRidge };
}

/** Closed area under the topmost roof for the wash (highest plateau). */
const roofAreaPath = computed(() => {
  const series = seriesList.value;
  if (!series.length) return '';
  const top = series.reduce((a, b) => (b.peakComputeTops > a.peakComputeTops ? b : a));
  const { xMin, xMax } = domains.value;
  const ridge = clampLog(
    (top.peakComputeTops * 1000) / Math.max(top.peakBandwidthGBs, 1e-12),
    xMin,
    xMax,
  );
  const pts = [
    { x: xToPx(xMin), y: yToPx(roofPerf(top, xMin)) },
    { x: xToPx(ridge), y: yToPx(roofPerf(top, ridge)) },
    { x: xToPx(xMax), y: yToPx(roofPerf(top, xMax)) },
  ];
  const bottom = PAD.t + plotH;
  const line = pts.map((p) => `${p.x},${p.y}`).join(' L ');
  return `M ${line} L ${pts[2]!.x},${bottom} L ${pts[0]!.x},${bottom} Z`;
});

const roofTopY = computed(() => {
  if (!seriesList.value.length) return PAD.t;
  return Math.min(...seriesList.value.map((s) => roofSegments(s).ridgeY));
});

const xTicks = computed(() => logTicks(domains.value.xMin, domains.value.xMax));
const yTicks = computed(() => logTicks(domains.value.yMin, domains.value.yMax));

function logTicks(min: number, max: number): number[] {
  const out: number[] = [];
  const start = Math.ceil(Math.log10(min) - 1e-9);
  const end = Math.floor(Math.log10(max) + 1e-9);
  for (let e = start; e <= end; e++) out.push(10 ** e);
  return out.length > 0 ? out : [min, max];
}

function fmtTick(v: number): string {
  if (v >= 1000) return `${v / 1000}K`.replace('.0K', 'K');
  if (v >= 1) return String(v);
  if (v >= 0.001) return v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
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

/** Resolve by id so a model replace keeps the tip on the same point (PR-ROOF-004). */
const hoveredPoint = computed((): RooflinePoint | null => {
  const id = hoveredId.value;
  if (!id) return null;
  return props.model.points.find((pt) => pt.id === id) ?? null;
});

function closePointTip() {
  hoveredId.value = null;
  tipPos.value = null;
}

function placeTip(e: MouseEvent) {
  const { left, top } = placeFixedTip({
    x: e.clientX,
    y: e.clientY,
    tipW: TIP_EST_W,
    tipH: TIP_EST_H,
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
    offset: FIXED_TIP_OFFSET_PX,
  });
  tipPos.value = { left: `${left}px`, top: `${top}px` };
}

function onPointEnter(e: MouseEvent, p: RooflinePoint) {
  hoveredId.value = p.id;
  placeTip(e);
}

function onPointMove(e: MouseEvent) {
  if (hoveredId.value) placeTip(e);
}

function onPointLeave() {
  closePointTip();
}

function bindAsideScroll(el: HTMLElement | null) {
  if (asideScrollEl) {
    asideScrollEl.removeEventListener('scroll', closePointTip);
    asideScrollEl = null;
  }
  if (!el) return;
  const parent = el.closest('.pr-aside__body');
  if (!parent) return;
  asideScrollEl = parent;
  asideScrollEl.addEventListener('scroll', closePointTip, { passive: true });
}

watch(rootEl, (el) => bindAsideScroll(el), { flush: 'post' });
/** Point id gone (block switch / empty model) — do not resurrect the tip later. */
watch(hoveredPoint, (p) => {
  if (!p && hoveredId.value) closePointTip();
});
watch(hasPoints, (ok) => {
  if (!ok) closePointTip();
});

/** StatsAside calls this when the drill-in surface changes (tip is on `body`, above the overlay). */
defineExpose({ closePointTip });

onMounted(() => window.addEventListener('resize', closePointTip));
onBeforeUnmount(() => {
  window.removeEventListener('resize', closePointTip);
  bindAsideScroll(null);
});
</script>

<template>
  <div
    v-if="hasPoints"
    ref="rootEl"
    class="pr-roofline"
    data-testid="roofline-panel"
  >
    <div class="pr-roofline__card">
      <div class="pr-roofline__card-head">
        <!--
          Scroll on a wrapper, not the grid: overflow-x:auto + overflow-y:hidden
          on a height:auto box lets the classic H-scrollbar eat the row height and
          clip AIV/AIC to an empty track (PR-ROOF-006).
        -->
        <div
          class="pr-roofline__legend-scroll"
          data-testid="roofline-legend"
        >
          <div
            class="pr-roofline__legend"
            :style="legendGridStyle"
          >
            <template v-if="aivSeries.length">
              <span class="pr-roofline__leg-head">AIV:</span>
              <span
                v-for="s in aivSeries"
                :key="s.id"
                class="pr-roofline__leg-item"
                :class="{ 'pr-roofline__leg-item--lit': legendHoverId === s.id }"
                data-testid="roofline-leg-item"
                :data-series-id="s.id"
                @mouseenter="legendHoverId = s.id"
                @mouseleave="legendHoverId = null"
              >
                <span
                  class="pr-roofline__leg-swatch"
                  :style="{ background: s.color }"
                />
                {{ s.label }}
              </span>
              <span
                v-for="n in Math.max(0, legendColCount - aivSeries.length)"
                :key="`aiv-pad-${n}`"
                class="pr-roofline__leg-pad"
                aria-hidden="true"
              />
            </template>
            <template v-if="aicSeries.length">
              <span class="pr-roofline__leg-head">AIC:</span>
              <span
                v-for="s in aicSeries"
                :key="s.id"
                class="pr-roofline__leg-item"
                :class="{ 'pr-roofline__leg-item--lit': legendHoverId === s.id }"
                data-testid="roofline-leg-item"
                :data-series-id="s.id"
                @mouseenter="legendHoverId = s.id"
                @mouseleave="legendHoverId = null"
              >
                <span
                  class="pr-roofline__leg-swatch"
                  :style="{ background: s.color }"
                />
                {{ s.label }}
              </span>
              <span
                v-for="n in Math.max(0, legendColCount - aicSeries.length)"
                :key="`aic-pad-${n}`"
                class="pr-roofline__leg-pad"
                aria-hidden="true"
              />
            </template>
          </div>
        </div>
      </div>
      <svg
        class="pr-roofline__svg"
        data-testid="roofline-chart"
        :width="W"
        :height="H"
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
          <g
            v-for="s in roofDrawOrder"
            :key="s.id"
            class="pr-roofline__roof-g"
            :class="roofHighlightClass(s.id)"
            data-testid="roofline-roof"
            :data-series-id="s.id"
          >
            <path
              class="pr-roofline__roof"
              :class="{ 'pr-roofline__roof--dashed': s.slopeStyle === 'dashed' }"
              :d="roofSegments(s).slope"
              fill="none"
              :stroke="s.color"
            />
            <path
              class="pr-roofline__roof"
              :class="{ 'pr-roofline__roof--dashed': s.slopeStyle === 'dashed' }"
              :d="roofSegments(s).plateau"
              fill="none"
              :stroke="s.color"
            />
          </g>
        </g>
        <!-- Markers sit outside plot clip so edge marks are not cropped. -->
        <g class="pr-roofline__markers">
          <!-- Measured points (off the roofs): filled/hollow circles, series color. -->
          <circle
            v-for="p in model.points"
            :key="p.id"
            data-testid="roofline-point"
            class="pr-roofline__point"
            :class="{ 'pr-roofline__point--hollow': p.style === 'hollow' }"
            :cx="xToPx(p.intensity)"
            :cy="yToPx(p.performance)"
            :r="POINT_R"
            :fill="p.style === 'hollow' ? '#262626' : p.color"
            :stroke="p.color"
            :aria-describedby="hoveredId === p.id ? tipId : undefined"
            @mouseenter="onPointEnter($event, p)"
            @mousemove="onPointMove"
            @mouseleave="onPointLeave"
            @pointerleave="onPointLeave"
            @pointercancel="onPointLeave"
          />
          <!-- Roof ridge knees (on the lines): filled rounded squares like legend. -->
          <rect
            v-for="s in roofDrawOrder"
            :key="`knee-${s.id}`"
            data-testid="roofline-knee"
            class="pr-roofline__knee"
            :class="roofHighlightClass(s.id)"
            :data-series-id="s.id"
            :x="roofSegments(s).ridgeX - KNEE / 2"
            :y="roofSegments(s).ridgeY - KNEE / 2"
            :width="KNEE"
            :height="KNEE"
            :rx="KNEE_RX"
            :ry="KNEE_RX"
            :fill="s.color"
            :stroke="s.color"
            pointer-events="none"
          />
        </g>
        <text
          v-if="mixParts.length"
          class="pr-roofline__mix"
          data-testid="roofline-mix"
          :x="PAD.l + plotW / 2"
          :y="mixY"
          text-anchor="middle"
          dominant-baseline="alphabetic"
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
        <!-- TOps/s: left edge aligns with aside title / AIV / AIC; same baseline as mix. -->
        <text
          class="pr-roofline__axis pr-roofline__axis--y"
          :x="topsX"
          :y="topsY"
          text-anchor="start"
          dominant-baseline="alphabetic"
        >TOps/s</text>
      </svg>
    </div>
    <!--
      Teleported like EventTooltip / StatsAside card tips — aside overflow and the
      timeline stacking context must not crop a pointer-following box.
    -->
    <Teleport to="body">
      <div
        v-if="hoveredPoint && tipPos"
        :id="tipId"
        class="pr-tooltip pr-roofline-tip"
        role="tooltip"
        data-testid="roofline-tooltip"
        :style="tipPos"
      >
        <div class="pr-roofline-tip__name">
          {{ hoveredPoint.label }}
        </div>
        <div>{{ fmtVal(hoveredPoint.intensity) }} Ops/Byte</div>
        <div>{{ fmtVal(hoveredPoint.performance) }} TOps/s</div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Title sits on the aside section head; raised chart card is one uniform grey. */
.pr-roofline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

/* Whole card (header + plot + tick gutters) — sketch uniform #262626.
   Title / legend / SVG share the same horizontal inset (card pad only). */
.pr-roofline__card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 8px 8px 6px;
  border-radius: 8px;
  background: #262626;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.pr-roofline__card-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0;
  min-width: 0;
  width: 100%;
}

/*
 * Scrollport for a dense dtype×bandwidth legend (DATA-57a). Keep overflow off
 * the grid itself — a classic horizontal scrollbar on a height:auto grid eats
 * the row box and clips the labels to an empty track.
 */
.pr-roofline__legend-scroll {
  max-width: 100%;
  min-width: 0;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

/*
 * Chromium applies either scrollbar-* or ::-webkit-scrollbar, not both
 * (tokens.css). The webkit bar below is 8px, matching the grid padding.
 * Firefox has no webkit bar, so it gets scrollbar-width: thin only there.
 */
@supports not selector(::-webkit-scrollbar) {
  .pr-roofline__legend-scroll {
    scrollbar-width: thin;
  }
}

.pr-roofline__legend-scroll::-webkit-scrollbar {
  /* Keep equal to `.pr-roofline__legend` padding-bottom. */
  height: 8px;
}

.pr-roofline__legend-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 3px;
}

.pr-roofline__legend-scroll::-webkit-scrollbar-track {
  background: transparent;
}

/*
 * Top of the raised card (no in-card chart title). One grid for both rows so
 * the nth AIV / AIC swatches share a vertical edge. Width is intrinsic; the
 * scrollport above clamps to the card. Padding matches the 8px webkit bar
 * so an inset bar cannot clip the AIC row.
 */
.pr-roofline__legend {
  display: grid;
  column-gap: 10px;
  row-gap: 4px;
  align-items: center;
  width: max-content;
  padding-bottom: 8px;
  font-size: 12px;
  line-height: 1.2;
}

.pr-roofline__leg-head {
  color: #c4c4c4;
  font-weight: 400;
}

.pr-roofline__leg-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #8a8a8a;
  white-space: nowrap;
  cursor: pointer;
  max-width: 100%;
}

.pr-roofline__leg-item--lit {
  color: #d0d0d0;
}

.pr-roofline__leg-pad {
  /* Empty cell so a shorter row still advances the grid to the next row cleanly. */
  min-width: 0;
}

.pr-roofline__leg-swatch {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex: 0 0 auto;
}

.pr-roofline__svg {
  /* Intrinsic W×H via attributes + viewBox; CSS width tracks the card so a
     vertical scrollbar (or DPR rounding) cannot force a horizontal overflow. */
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  overflow: hidden;
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
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  transition: stroke-width 80ms ease, opacity 80ms ease;
}

.pr-roofline__roof--dashed {
  stroke-dasharray: 4 3;
  /* ponytail: round caps shrink the 3px gap by the stroke width, so the lit
     3.5px roof closes up and draws solid. butt keeps 4 on / 3 off.
     Upgrade: scale the dasharray with stroke-width if caps must stay round. */
  stroke-linecap: butt;
}

/* Experimental: legend hover dims other roofs and thickens the match. */
.pr-roofline__roof-g--dim {
  opacity: 0.28;
}

.pr-roofline__roof-g--lit .pr-roofline__roof {
  stroke-width: 3.5;
}

.pr-roofline__knee {
  stroke-width: 1.5;
  transition: opacity 80ms ease, stroke-width 80ms ease;
}

.pr-roofline__knee.pr-roofline__roof-g--dim {
  opacity: 0.28;
}

.pr-roofline__knee.pr-roofline__roof-g--lit {
  stroke-width: 2.5;
}

.pr-roofline__point {
  cursor: pointer;
  stroke-width: 1.5;
}

.pr-roofline__point--hollow {
  fill: #262626;
  stroke-width: 1.75;
}

.pr-roofline__tick {
  fill: #999999;
  font-size: 12px;
}

.pr-roofline__axis {
  fill: #999999;
  font-size: 12px;
}

.pr-roofline__mix {
  font-size: 12px;
}

/* Sketch mix is two-tone: names #999, percents #fff. */
.pr-roofline__mix-name {
  fill: #999999;
}

.pr-roofline__mix-pct {
  fill: #ffffff;
}
</style>

<!--
  Unscoped: Teleport → body (same as CounterHoverTip / overview value tip). Scoped
  selectors can fail to paint on the teleported node, so the tip would mount invisible.
-->
<style>
.pr-roofline-tip.pr-tooltip {
  position: fixed;
  z-index: 20;
  pointer-events: none;
  box-sizing: border-box;
  padding: 8px 10px;
  background: var(--pr-surface-raised, #363636);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
  color: #e8e8e8;
  font-size: 12px;
  line-height: 1.45;
  min-width: 180px;
  max-width: 280px;
  animation: pr-roofline-tip-in 120ms ease;
}

@keyframes pr-roofline-tip-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pr-roofline-tip.pr-tooltip {
    animation: none;
  }
}

.pr-roofline-tip__name {
  font-weight: 600;
  margin-bottom: 4px;
  color: #ffffff;
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
