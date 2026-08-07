<script setup lang="ts">
import type { TimeDisplayUnit } from '../../domain/types';
import { t } from '../../i18n';

defineProps<{
  searchQuery: string;
  asideVisible: boolean;
  asideAvailable: boolean;
  zoomPercent: number;
  timeUnit: TimeDisplayUnit;
  locale?: string;
  title?: string;
  measureMode?: boolean;
}>();

const emit = defineEmits<{
  'update:searchQuery': [value: string];
  'update:asideVisible': [value: boolean];
  'update:timeUnit': [value: TimeDisplayUnit];
  'update:measureMode': [value: boolean];
  'zoom-to-fit': [];
  'zoom-in': [];
  'zoom-out': [];
  'update:zoomPercent': [value: number];
}>();
</script>

<template>
  <div
    class="pr-chrome"
    data-testid="report-toolbar"
  >
    <nav
      class="pr-tabs"
      data-testid="report-tabs"
      aria-label="report views"
    >
      <span class="pr-tabs__brand">{{ title || t('tabOp', locale) }}</span>
      <button
        type="button"
        class="pr-tabs__tab pr-tabs__tab--active"
        data-testid="tab-timeline"
      >
        {{ t('tabTimeline', locale) }}
      </button>
      <button
        type="button"
        class="pr-tabs__tab"
        disabled
        title="Phase 2"
      >
        {{ t('tabSource', locale) }}
      </button>
      <button
        type="button"
        class="pr-tabs__tab"
        disabled
        title="Phase 2"
      >
        {{ t('tabDetail', locale) }}
      </button>
      <button
        type="button"
        class="pr-tabs__tab"
        disabled
        title="Phase 2"
      >
        {{ t('tabCache', locale) }}
      </button>
    </nav>

    <div class="pr-toolbar">
      <label class="pr-toolbar__search">
        <span class="pr-toolbar__sr">{{ t('searchLabel', locale) }}</span>
        <span
          class="pr-toolbar__search-icon"
          aria-hidden="true"
        >⌕</span>
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
          class="pr-toolbar__icon-btn"
          :title="t('zoomOut', locale)"
          @click="emit('zoom-out')"
        >
          −
        </button>
        <input
          data-testid="zoom-slider"
          class="pr-toolbar__slider"
          type="range"
          min="0"
          max="100"
          :value="zoomPercent"
          @input="emit('update:zoomPercent', Number(($event.target as HTMLInputElement).value))"
        >
        <button
          type="button"
          data-testid="zoom-in"
          class="pr-toolbar__icon-btn"
          :title="t('zoomIn', locale)"
          @click="emit('zoom-in')"
        >
          +
        </button>
        <button
          type="button"
          data-testid="zoom-to-fit"
          class="pr-toolbar__text-btn"
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
        type="button"
        class="pr-toolbar__icon-btn"
        data-testid="toggle-measure"
        :aria-pressed="Boolean(measureMode)"
        :class="{ 'pr-toolbar__icon-btn--on': measureMode }"
        :title="t('measure', locale)"
        @click="emit('update:measureMode', !measureMode)"
      >
        ⟷
      </button>
      <button
        v-if="asideAvailable"
        type="button"
        class="pr-toolbar__icon-btn"
        data-testid="toggle-aside"
        :aria-pressed="asideVisible"
        :class="{ 'pr-toolbar__icon-btn--on': asideVisible }"
        :title="t('stats', locale)"
        @click="emit('update:asideVisible', !asideVisible)"
      >
        ▤
      </button>
    </div>
  </div>
</template>

<style scoped>
.pr-chrome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding: 0 8px;
  min-height: 36px;
  background: var(--pr-bg-panel, #303030);
  border-bottom: 1px solid #3a3a3a;
  flex: 0 0 auto;
}

.pr-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.pr-tabs__brand {
  margin-right: 8px;
  padding: 4px 8px;
  font-size: 12px;
  opacity: 0.85;
  border-right: 1px solid #4a4a4a;
}

.pr-tabs__tab {
  margin: 0;
  padding: 6px 12px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #b0b0b0;
  font-size: 12px;
  cursor: pointer;
}

.pr-tabs__tab:disabled {
  opacity: 0.4;
  cursor: default;
}

.pr-tabs__tab--active {
  color: #e8e8e8;
  border-bottom-color: var(--pr-playhead, #3078f0);
}

.pr-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.pr-toolbar__search {
  position: relative;
  display: flex;
  align-items: center;
}

.pr-toolbar__search-icon {
  position: absolute;
  left: 8px;
  opacity: 0.55;
  pointer-events: none;
  font-size: 12px;
}

.pr-toolbar__search input {
  width: 160px;
  padding: 4px 8px 4px 26px;
  border: 1px solid #4a4a4a;
  border-radius: 2px;
  background: #252525;
  color: inherit;
  font-size: 12px;
}

.pr-toolbar__unit select {
  padding: 3px 6px;
  border: 1px solid #4a4a4a;
  border-radius: 2px;
  background: #252525;
  color: inherit;
  font-size: 12px;
}

.pr-toolbar__zoom {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pr-toolbar__slider {
  width: 88px;
  accent-color: var(--pr-playhead, #3078f0);
}

.pr-toolbar__icon-btn,
.pr-toolbar__text-btn {
  margin: 0;
  padding: 2px 8px;
  min-width: 28px;
  min-height: 24px;
  border: 1px solid #4a4a4a;
  border-radius: 2px;
  background: #2a2a2a;
  color: #d0d0d0;
  font-size: 12px;
  cursor: pointer;
}

.pr-toolbar__icon-btn--on {
  border-color: var(--pr-playhead, #3078f0);
  color: #fff;
  background: #2a3850;
}

.pr-toolbar__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
