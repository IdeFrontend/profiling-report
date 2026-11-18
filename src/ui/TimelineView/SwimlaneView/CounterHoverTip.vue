<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';
import { t } from '../../../i18n';

const props = withDefaults(
  defineProps<{
    utilization: number;
    usingKb?: number | null;
    stylePos: CSSProperties;
    locale?: string;
  }>(),
  { usingKb: null, locale: undefined },
);

const utilLabel = computed(() => t('counterTipUtilization', props.locale));
const usingLabel = computed(() => t('counterTipUsing', props.locale));

const utilValue = computed(() => {
  const n = Number.isFinite(props.utilization) ? props.utilization : 0;
  return `${formatUtil(n)}%`;
});

const usingValue = computed(() => {
  if (props.usingKb == null || !Number.isFinite(props.usingKb)) return null;
  return `${formatKb(props.usingKb)} KB`;
});

/** Utilization % — short; integers stay bare. */
function formatUtil(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(2)));
}

/**
 * Using KB — fewer display digits than producer floats (was toPrecision(6)).
 * Cap at 2 decimal places; strip trailing zeros.
 */
function formatKb(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(2)));
}
</script>

<template>
  <div
    class="pr-tooltip pr-counter-hover-tip"
    data-testid="counter-hover-tooltip"
    :style="stylePos"
  >
    <div
      class="pr-counter-hover-tip__row"
      data-testid="counter-hover-util"
    >
      <span class="pr-counter-hover-tip__name">{{ utilLabel }}</span>
      <span class="pr-counter-hover-tip__value">{{ utilValue }}</span>
    </div>
    <div
      v-if="usingValue"
      class="pr-counter-hover-tip__row"
      data-testid="counter-hover-using"
    >
      <span class="pr-counter-hover-tip__name">{{ usingLabel }}</span>
      <span class="pr-counter-hover-tip__value">{{ usingValue }}</span>
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

.pr-counter-hover-tip__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.pr-counter-hover-tip__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-counter-hover-tip__value {
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: #e8e8e8;
}

@keyframes pr-counter-tip-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pr-counter-hover-tip.pr-tooltip {
    animation: none;
  }
}

/* Teleported value-dot — OverviewCharts parity (fixed so parent overflow cannot crop it). */
.pr-counter-hover-dot {
  position: fixed;
  z-index: 999;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
  transform: translate(-50%, -50%);
  pointer-events: none;
  box-sizing: border-box;
}
</style>
