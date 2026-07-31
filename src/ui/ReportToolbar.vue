<script setup lang="ts">
import type { TimeDisplayUnit } from '../core/types';
import { t } from '../core/i18n';

defineProps<{
  searchQuery: string;
  asideVisible: boolean;
  asideAvailable: boolean;
  zoomPercent: number;
  timeUnit: TimeDisplayUnit;
  locale?: string;
}>();

const emit = defineEmits<{
  'update:searchQuery': [value: string];
  'update:asideVisible': [value: boolean];
  'update:timeUnit': [value: TimeDisplayUnit];
  'zoom-to-fit': [];
  'zoom-in': [];
  'zoom-out': [];
  'update:zoomPercent': [value: number];
}>();
</script>

<template>
  <div
    class="pr-toolbar"
    data-testid="report-toolbar"
  >
    <label class="pr-toolbar__search">
      <span class="pr-toolbar__sr">{{ t('searchLabel', locale) }}</span>
      <input
        data-testid="search-input"
        type="search"
        :value="searchQuery"
        :placeholder="t('searchPlaceholder', locale)"
        @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
      >
    </label>
    <div class="pr-toolbar__zoom">
      <button
        type="button"
        data-testid="zoom-out"
        :title="t('zoomOut', locale)"
        @click="emit('zoom-out')"
      >
        −
      </button>
      <input
        data-testid="zoom-slider"
        type="range"
        min="0"
        max="100"
        :value="zoomPercent"
        @input="emit('update:zoomPercent', Number(($event.target as HTMLInputElement).value))"
      >
      <button
        type="button"
        data-testid="zoom-in"
        :title="t('zoomIn', locale)"
        @click="emit('zoom-in')"
      >
        +
      </button>
      <button
        type="button"
        data-testid="zoom-to-fit"
        @click="emit('zoom-to-fit')"
      >
        {{ t('zoomFit', locale) }}
      </button>
    </div>
    <label class="pr-toolbar__unit">
      <span class="pr-toolbar__sr">{{ t('timeUnit', locale) }}</span>
      <select
        data-testid="time-unit"
        :value="timeUnit"
        @change="emit('update:timeUnit', ($event.target as HTMLSelectElement).value as TimeDisplayUnit)"
      >
        <option value="ms">ms</option>
        <option value="us">µs</option>
        <option value="ns">ns</option>
      </select>
    </label>
    <button
      v-if="asideAvailable"
      type="button"
      data-testid="toggle-aside"
      :aria-pressed="asideVisible"
      @click="emit('update:asideVisible', !asideVisible)"
    >
      {{ t('stats', locale) }}
    </button>
  </div>
</template>

<style scoped>
.pr-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding: 6px 8px;
  background: var(--pr-bg-panel, #303030);
  border-radius: 4px;
}

.pr-toolbar__search input,
.pr-toolbar__unit select {
  min-width: 140px;
  padding: 4px 8px;
  border: 1px solid #555;
  border-radius: 3px;
  background: #1a1a1a;
  color: inherit;
}

.pr-toolbar__unit select {
  min-width: 64px;
}

.pr-toolbar__zoom {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pr-toolbar button {
  padding: 4px 10px;
  border: 1px solid #555;
  border-radius: 3px;
  background: #252525;
  color: inherit;
  cursor: pointer;
}

.pr-toolbar__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
