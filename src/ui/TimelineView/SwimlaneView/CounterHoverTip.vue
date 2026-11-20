<script setup lang="ts">
import type { CSSProperties } from 'vue';

export type CounterTipRow = { label: string; value: string };

defineProps<{
  /** Pipe / lane / process name — tip header (parity with EventTooltip event name). */
  name: string;
  /** One row per numeric `ph:C` arg on the sample (data-driven; no domain parsers). */
  rows: CounterTipRow[];
  stylePos: CSSProperties;
}>();
</script>

<template>
  <div
    class="pr-tooltip pr-counter-hover-tip"
    data-testid="counter-hover-tooltip"
    :style="stylePos"
  >
    <div
      class="pr-counter-hover-tip__title"
      data-testid="counter-hover-name"
    >
      {{ name }}
    </div>
    <div
      v-for="(row, i) in rows"
      :key="`${row.label}-${i}`"
      class="pr-counter-hover-tip__row"
      data-testid="counter-hover-row"
    >
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

.pr-counter-hover-tip__title {
  font-weight: 600;
  color: #e8e8e8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  color: #e8e8e8;
  white-space: nowrap;
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
