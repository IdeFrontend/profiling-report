<script setup lang="ts">
/**
 * Right-pane SASS listing: plain metrics table (no Sudu).
 * Sketch columns: # · Address · Assembly · Instructions Executed · Sampling Stall · Warp Occupancy.
 */
import { nextTick, ref } from 'vue';
import type { SourceFileModel } from '../../domain/types';
import { SOURCE_TAB_EDITOR_FONT } from './sourceFonts';
import SourceMetricsTable from './SourceMetricsTable.vue';

/** Match Sudu’s default line box for 12px JetBrains Mono (~1.5× font size). */
const ROW_H = Math.round(SOURCE_TAB_EDITOR_FONT.size * 1.5);

defineProps<{
  file: SourceFileModel;
  currentLine?: number | null;
  correlatedLines?: number[];
  matchLines?: number[];
  dimZeroFor?: string | null;
}>();

const emit = defineEmits<{
  'update:currentLine': [line: number];
}>();

const rootEl = ref<HTMLElement | null>(null);

function onRowClick(line: number) {
  emit('update:currentLine', line);
}

function setLine(line: number) {
  void nextTick(() => {
    const row = rootEl.value?.querySelector<HTMLElement>(`tr[data-line="${line}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  });
}

function scrollToTop() {
  const scroll = rootEl.value?.querySelector<HTMLElement>('[data-testid="source-metrics-scroll"]');
  if (scroll) scroll.scrollTop = 0;
  setLine(1);
}

defineExpose({ setLine, scrollToTop });
</script>

<template>
  <div
    ref="rootEl"
    class="pr-asm-table-pane"
    data-testid="asm-table-pane"
  >
    <SourceMetricsTable
      :file="file"
      :current-line="currentLine ?? null"
      :correlated-lines="correlatedLines"
      :match-lines="matchLines"
      :dim-zero-for="dimZeroFor"
      :row-height-css="ROW_H"
      :filler-rows="0"
      :show-header="true"
      :show-line-numbers="true"
      @row-click="onRowClick"
    />
  </div>
</template>

<style scoped>
.pr-asm-table-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
}
</style>
