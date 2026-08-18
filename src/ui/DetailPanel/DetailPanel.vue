<script setup lang="ts">
import { t } from '../../i18n';
import type { DependencyNeighbors } from '../../domain/dependencies';
import type { SelectedEvent, TimeDisplayUnit } from '../../domain/types';
import DetailSummary from './DetailSummary/DetailSummary.vue';
import DetailParameter from './DetailParameter/DetailParameter.vue';
import DetailRelevant from './DetailRelevant/DetailRelevant.vue';

defineProps<{
  selected: SelectedEvent;
  unit: TimeDisplayUnit;
  locale?: string;
  /** Omitted when the report carries no dependency data — the column hides. */
  neighbors?: DependencyNeighbors;
  level?: number;
}>();

const emit = defineEmits<{
  close: [];
  'update:level': [level: number];
}>();
</script>

<template>
  <footer
    class="pr-detail-panel"
    data-testid="detail-panel"
  >
    <header class="pr-detail-panel__head">
      <span class="pr-detail-panel__tab">{{ t('details', locale) }}</span>
      <button
        type="button"
        class="pr-detail-panel__close"
        data-testid="detail-panel-close"
        :aria-label="t('closePanel', locale)"
        :title="t('closePanel', locale)"
        @click="emit('close')"
      >
        ×
      </button>
    </header>

    <div class="pr-detail-panel__body">
      <DetailSummary
        :selected="selected"
        :unit="unit"
        :locale="locale"
      />
      <DetailParameter
        :args="selected.args"
        :locale="locale"
      />
      <DetailRelevant
        v-if="neighbors"
        :current-name="selected.name"
        :neighbors="neighbors"
        :level="level ?? -1"
        :locale="locale"
        @update:level="emit('update:level', $event)"
      />
    </div>
  </footer>
</template>

<style scoped>
.pr-detail-panel {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  /* Fixed dock height: a content-sized panel grows and shrinks with every
     selection, which shifts the whole timeline above it. Sketch proportion is
     ~230px, and each column scrolls inside that. */
  height: 232px;
  max-height: 45vh;
  background: var(--pr-bg-panel, #262626);
  border-top: 1px solid #3a3a3a;
}

.pr-detail-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px 0;
  border-bottom: 1px solid #3a3a3a;
}

.pr-detail-panel__tab {
  padding-bottom: 6px;
  /* Sketch marks the active tab with a light rule, not the playhead blue. */
  border-bottom: 2px solid #e8e8e8;
  font-size: 13px;
  font-weight: 600;
}

.pr-detail-panel__close {
  border: 0;
  background: transparent;
  color: #b0b0b0;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.pr-detail-panel__close:hover {
  color: #f0f0f0;
}

.pr-detail-panel__body {
  display: grid;
  /* Sketch widths: narrow identity card, widest parameter list, then the graph. */
  grid-template-columns: minmax(200px, 0.8fr) minmax(240px, 1.5fr) minmax(280px, 1.2fr);
  gap: 0;
  align-items: stretch;
  padding: 8px 12px 12px;
  min-height: 0;
  overflow: auto;
}

@media (max-width: 900px) {
  .pr-detail-panel__body {
    grid-template-columns: 1fr;
    overflow: auto;
  }
}
</style>
