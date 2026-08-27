<script setup lang="ts">
import { formatDisplayTime, formatTime } from '../../domain/formatTime';
import { t } from '../../i18n';
import type { SwimEvent, TimeScaleUnit } from '../../domain/types';

withDefaults(
  defineProps<{
    event: SwimEvent;
    stylePos: { left: string; top: string };
    timeScaleUnit: TimeScaleUnit;
    /** Display origin (usually model.minTime); start/end are relative to this. */
    timeOrigin?: number;
    locale?: string;
  }>(),
  { timeOrigin: 0 },
);
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
    <div>{{ t('start', locale) }}: {{ formatDisplayTime(event.startTime, timeOrigin, timeScaleUnit) }}</div>
    <div>{{ t('dur', locale) }}: {{ formatTime(event.duration, timeScaleUnit) }}</div>
    <div>
      {{ t('end', locale) }}:
      {{ formatDisplayTime(event.startTime + event.duration, timeOrigin, timeScaleUnit) }}
    </div>
  </div>
</template>

<style scoped>
.pr-tooltip {
  position: fixed;
  z-index: 20;
  pointer-events: none;
  padding: 8px 10px;
  background: #2a2a2a;
  border: 1px solid #555;
  border-radius: 2px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 1.45;
  min-width: 180px;
}

.pr-tooltip__name {
  font-weight: 600;
  margin-bottom: 4px;
}
</style>
