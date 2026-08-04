<script setup lang="ts">
import { formatTime } from '../domain/formatTime';
import { t } from '../i18n';
import type { SelectedEvent, TimeDisplayUnit } from '../domain/types';

defineProps<{
  selected: SelectedEvent;
  unit: TimeDisplayUnit;
  locale?: string;
}>();
</script>

<template>
  <footer
    class="pr-detail"
    data-testid="detail-strip"
  >
    <div class="pr-detail__name">
      {{ selected.name }}
    </div>
    <div class="pr-detail__times">
      {{ t('start', locale) }} {{ formatTime(selected.startTime, unit) }}
      ·
      {{ t('dur', locale) }} {{ formatTime(selected.duration, unit) }}
    </div>
    <div class="pr-detail__end">
      {{ t('end', locale) }} {{ formatTime(selected.endTime, unit) }}
    </div>
  </footer>
</template>

<style scoped>
.pr-detail {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) auto auto;
  gap: 16px;
  align-items: center;
  padding: 8px 12px;
  background: #2a2a2a;
  border-top: 1px solid #3a3a3a;
  flex: 0 0 auto;
}

.pr-detail__name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-detail__times,
.pr-detail__end {
  font-variant-numeric: tabular-nums;
  color: #c0c0c0;
}

@media (max-width: 900px) {
  .pr-detail {
    grid-template-columns: 1fr;
  }
}
</style>
