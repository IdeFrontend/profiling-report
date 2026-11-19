<script setup lang="ts">
import PrIcon from '../../PrIcon.vue';
import type { DiffTone } from '../../../domain/metricDiff';

withDefaults(
  defineProps<{
    /** 'increase' = red up arrow, 'decrease' = green down arrow. */
    tone: DiffTone;
    /** Unsigned delta text with the source unit already attached (e.g. '5%'). */
    text: string;
    /** Screen-reader direction word (i18n). */
    directionLabel: string;
  }>(),
  {},
);
</script>

<template>
  <span
    class="pr-diff"
    :class="`pr-diff--${tone}`"
    data-testid="stats-diff"
  >
    <span
      class="pr-diff__badge"
      aria-hidden="true"
    >
      <PrIcon :name="tone === 'increase' ? 'diff-up' : 'diff-down'" />
    </span>
    <span class="pr-diff__text">{{ text }}</span>
    <span class="pr-field-sr">{{ directionLabel }}</span>
  </span>
</template>

<style scoped>
/*
 * Mockup 1130 方案一 (baseline-compare.jpeg): a 12px circle badge tinted with
 * the tone color at 20% over the card gradient, a flat arrow glyph inside, and
 * the unsigned delta in the muted tab color on the value's baseline.
 */
.pr-diff {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: 5px;
  line-height: 1;
  white-space: nowrap;
}

.pr-diff__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  line-height: 0;
}

.pr-diff--increase .pr-diff__badge {
  background: rgba(231, 67, 74, 0.2);
  color: #e7434a;
}

.pr-diff--decrease .pr-diff__badge {
  background: rgba(136, 200, 88, 0.2);
  color: #88c858;
}

.pr-diff__badge .pr-icon {
  flex: 0 0 8px;
  width: 8px;
  height: 8px;
}

.pr-diff__text {
  font-size: 13px;
  color: #b3b3b3;
}
</style>
