<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../../i18n';

const props = withDefaults(
  defineProps<{
    utilization: number;
    usingKb?: number | null;
    stylePos: { left: string; top: string; position?: string; zIndex?: number | string };
    locale?: string;
  }>(),
  { usingKb: null, locale: undefined },
);

const utilText = computed(() => {
  const n = Number.isFinite(props.utilization) ? props.utilization : 0;
  return t('counterTipUtilization', props.locale).replace('{n}', formatNum(n));
});

const usingText = computed(() => {
  if (props.usingKb == null || !Number.isFinite(props.usingKb)) return null;
  return t('counterTipUsing', props.locale).replace('{n}', formatNum(props.usingKb));
});

function formatNum(n: number): string {
  // Keep producer precision for small KB fractions (e.g. 0.04) without trailing noise.
  if (Number.isInteger(n)) return String(n);
  const s = n.toPrecision(6);
  return String(Number(s));
}
</script>

<template>
  <div
    class="pr-tooltip pr-counter-hover-tip"
    data-testid="counter-hover-tooltip"
    :style="stylePos"
  >
    <div data-testid="counter-hover-util">{{ utilText }}</div>
    <div
      v-if="usingText"
      data-testid="counter-hover-using"
    >
      {{ usingText }}
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
  color: #e6e6e6;
  font-size: 12px;
  line-height: 1.45;
  min-width: 120px;
  animation: pr-counter-tip-in 120ms ease;
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
</style>
