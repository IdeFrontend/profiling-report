<script setup lang="ts">
import { formatTime } from '../../../domain/formatTime';
import { t } from '../../../i18n';
import type { SelectedEvent, TimeDisplayUnit } from '../../../domain/types';

defineProps<{
  selected: SelectedEvent;
  unit: TimeDisplayUnit;
  locale?: string;
}>();
</script>

<template>
  <div
    class="pr-detail-summary"
    data-testid="detail-summary"
  >
    <div class="pr-detail-summary__name">
      {{ selected.name }}
    </div>
    <div class="pr-detail-summary__times">
      <span>{{ t('start', locale) }}: {{ formatTime(selected.startTime, unit) }}</span>
    </div>
    <div class="pr-detail-summary__times">
      <span>{{ t('dur', locale) }}: {{ formatTime(selected.duration, unit) }}</span>
    </div>
    <div class="pr-detail-summary__end">
      {{ t('end', locale) }}: {{ formatTime(selected.endTime, unit) }}
    </div>
  </div>
</template>

<style scoped>
.pr-detail-summary {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) auto auto;
  gap: 12px;
  align-items: center;
  padding: 8px 12px;
  min-width: 0;
}

.pr-detail-summary__name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-detail-summary__times,
.pr-detail-summary__end {
  font-variant-numeric: tabular-nums;
  color: #c0c0c0;
}

@media (max-width: 900px) {
  .pr-detail-summary {
    grid-template-columns: 1fr;
  }
}
</style>
