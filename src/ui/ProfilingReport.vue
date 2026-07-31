<script setup lang="ts">
/**
 * Root host entry. Milestone 2: props/emits contract for failing UI tests.
 * Real timeline / panels land in UI-shell + view-model slices.
 */
import type { ReportCapability, ReportViewModel, SelectedEvent, SwimlaneModel } from '../core/types';

defineProps<{
  title?: string;
  source?: ArrayBuffer | Uint8Array;
  swimlaneModel?: SwimlaneModel;
  reportModel?: ReportViewModel;
  theme?: 'light' | 'dark';
  locale?: string;
  capabilities?: ReportCapability[];
}>();

defineEmits<{
  ready: [];
  select: [event: SelectedEvent | null];
  error: [error: { message: string; cause?: unknown }];
}>();
</script>

<template>
  <div
    class="pr-root"
    data-testid="profiling-report"
  >
    <p class="pr-root__title">
      {{ title ?? 'profiling-report' }}
    </p>
    <p class="pr-root__hint">
      Scaffold placeholder — timeline and panels land in later TDD slices.
    </p>
    <!-- Feature surfaces (absent until UI-shell slice — PR-UI-* / PR-E2E-* assert these):
    <div data-testid="swimlane" />
    <div data-testid="time-axis" />
    <div data-testid="stats-summary" />
    <div data-testid="pipe-occupancy" />
    <div data-testid="overview-charts" />
    <div data-testid="event-tooltip" />
    <div data-testid="detail-strip" />
    -->
  </div>
</template>

<style scoped>
.pr-root {
  box-sizing: border-box;
  min-height: 120px;
  padding: 16px;
  color: #e8e8e8;
  background: #303030;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.pr-root__title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}

.pr-root__hint {
  margin: 0;
  font-size: 13px;
  opacity: 0.75;
}
</style>
