<script setup lang="ts">
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

export type CounterTipRow = {
  label: string;
  value: string;
  /** Series swatch — set on every row for multi-series tips (OverviewCharts parity). */
  color?: string;
};

const props = withDefaults(
  defineProps<{
    /** One row per numeric `ph:C` arg on the sample (data-driven; no domain parsers). */
    rows: CounterTipRow[];
    stylePos: CSSProperties;
    /** Formatted sample time (relative to swim origin); shown as a Sample Time row above args. */
    sampleTimeLabel?: string | null;
    /**
     * Arg-key label of the hovered series — that tip row gets OverviewCharts
     * `is-active` bold (swatches stay on every series row).
     */
    activeLabel?: string | null;
  }>(),
  { sampleTimeLabel: null, activeLabel: null },
);

/** Multi-series chrome when any row carries a legend color (OverviewCharts parity). */
const keyed = computed(() => props.rows.some((r) => !!r.color));
</script>

<template>
  <div
    class="pr-tooltip pr-counter-hover-tip"
    :class="{ 'pr-counter-hover-tip--keyed': keyed }"
    data-testid="counter-hover-tooltip"
    :style="stylePos"
  >
    <!-- No title — lane/folder name duplicates the series row(s). -->
    <div
      v-if="sampleTimeLabel"
      class="pr-counter-hover-tip__time"
      data-testid="counter-hover-time"
    >
      <span class="pr-counter-hover-tip__name">Sample Time</span>
      <span class="pr-counter-hover-tip__value">{{ sampleTimeLabel }}</span>
    </div>
    <div
      v-for="(row, i) in rows"
      :key="`${row.label}-${i}`"
      class="pr-counter-hover-tip__row"
      :class="{ 'is-active': activeLabel != null && row.label === activeLabel }"
      data-testid="counter-hover-row"
      :data-active="activeLabel != null && row.label === activeLabel ? 'true' : undefined"
    >
      <span
        v-if="keyed"
        class="pr-counter-hover-tip__swatch"
        :style="{ background: row.color || '#fff' }"
      />
      <span class="pr-counter-hover-tip__name">{{ row.label }}</span>
      <span class="pr-counter-hover-tip__value">{{ row.value }}</span>
    </div>
  </div>
</template>

<!--
  Unscoped: Teleport → body (same pattern as OverviewCharts value tip). Scoped
  selectors can fail to paint position/color on the teleported node in prod, so
  the tip mounts invisibly while canvas counter-hover still fires.
-->
<style>
.pr-counter-hover-tip.pr-tooltip {
  position: fixed;
  z-index: 1000;
  pointer-events: none;
  box-sizing: border-box;
  padding: 8px 10px;
  background: var(--pr-surface-raised, #363636);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
  color: #b3b3b3;
  font-size: 12px;
  line-height: 1.45;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  animation: pr-counter-tip-in 120ms ease;
}

/** Sample Time — flush left (no swatch column indent); OverviewCharts parity. */
.pr-counter-hover-tip__time {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.pr-counter-hover-tip__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.pr-counter-hover-tip--keyed .pr-counter-hover-tip__row {
  grid-template-columns: 8px minmax(0, 1fr) auto;
  gap: 8px;
}

.pr-counter-hover-tip__swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.pr-counter-hover-tip__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-counter-hover-tip__value {
  font-variant-numeric: tabular-nums;
  color: #e8e8e8;
  white-space: nowrap;
}

.pr-counter-hover-tip__row.is-active {
  color: #e8e8e8;
  font-weight: 700;
}

@keyframes pr-counter-tip-in {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
