<script setup lang="ts">
import type { SelectedEvent, TimeDisplayUnit } from '../../domain/types';
import DetailSummary from './DetailSummary/DetailSummary.vue';
import DetailParameter from './DetailParameter/DetailParameter.vue';
import DetailRelevant from './DetailRelevant/DetailRelevant.vue';

defineProps<{
  selected: SelectedEvent;
  unit: TimeDisplayUnit;
  locale?: string;
}>();
</script>

<template>
  <footer
    class="pr-detail-panel"
    data-testid="detail-panel"
  >
    <DetailSummary
      :selected="selected"
      :unit="unit"
      :locale="locale"
    />
    <DetailParameter />
    <DetailRelevant />
  </footer>
</template>

<style scoped>
.pr-detail-panel {
  display: grid;
  grid-template-columns: minmax(200px, 0.9fr) minmax(220px, 1.1fr) minmax(280px, 1.4fr);
  gap: 0;
  align-items: stretch;
  flex: 0 0 auto;
  min-height: 0;
  background: #2a2a2a;
  border-top: 1px solid #3a3a3a;
}

@media (max-width: 900px) {
  .pr-detail-panel {
    grid-template-columns: 1fr;
  }
}
</style>
