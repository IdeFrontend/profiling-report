<script setup lang="ts">
import {
  EVENT_TIME_SIGNIFICANT_DIGITS,
  formatDisplayTimeAuto,
  formatTimeAuto,
} from '../../domain/formatTime';
import { t } from '../../i18n';
import type { SwimEvent } from '../../domain/types';

withDefaults(
  defineProps<{
    event: SwimEvent;
    stylePos: { left: string; top: string };
    /** Display origin (usually model.minTime); start/end are relative to this. */
    timeOrigin?: number;
    locale?: string;
  }>(),
  { timeOrigin: 0 },
);

const displayOpts = { significantDigits: EVENT_TIME_SIGNIFICANT_DIGITS };
</script>

<template>
  <div
    class="pr-tooltip"
    data-testid="event-tooltip"
    :style="stylePos"
  >
    <div class="pr-tooltip__name">
      {{ event.name }}
    </div>
    <div>
      {{ t('start', locale) }}:
      {{ formatDisplayTimeAuto(event.startTime, timeOrigin, displayOpts) }}
    </div>
    <div>{{ t('dur', locale) }}: {{ formatTimeAuto(event.duration, displayOpts) }}</div>
    <div>
      {{ t('end', locale) }}:
      {{ formatDisplayTimeAuto(event.startTime + event.duration, timeOrigin, displayOpts) }}
    </div>
  </div>
</template>

<style scoped>
.pr-tooltip {
  position: fixed;
  z-index: 20;
  pointer-events: none;
  box-sizing: border-box;
  padding: 8px 10px;
  background: var(--pr-surface-raised, #363636);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
  font-size: 12px;
  line-height: 1.45;
  min-width: 180px;
}

.pr-tooltip__name {
  font-weight: 600;
  margin-bottom: 4px;
}
</style>
