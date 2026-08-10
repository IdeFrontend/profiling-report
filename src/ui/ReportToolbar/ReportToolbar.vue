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
        <svg
          class="pr-toolbar__search-icon"
          data-testid="search-magnifier"
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
        >
          <circle
            cx="6.5"
            cy="6.5"
            r="4.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
          />
          <path
            d="M10 10l3.5 3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
        </svg>
        <input
          data-testid="search-input"
          type="search"
          :value="searchQuery"
          :placeholder="t('searchPlaceholder', locale)"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        >
      </label>

      <div
        class="pr-toolbar__zoom pr-toolbar__zoom-pill"
        data-testid="zoom-pill"
      >
        <button
          type="button"
          data-testid="zoom-out"
          class="pr-toolbar__zoom-btn"
          :title="t('zoomOut', locale)"
          @click="emit('zoom-out')"
        >
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            aria-hidden="true"
          >
            <circle
              cx="6.5"
              cy="6.5"
              r="4.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.3"
            />
            <path
              d="M10 10l3.2 3.2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
            <path
              d="M4.5 6.5h4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <input
          data-testid="zoom-slider"
          class="pr-toolbar__slider"
          type="range"
          min="0"
          max="100"
          :value="zoomPercent"
          :style="{ '--pr-zoom-fill': `${zoomPercent}%` }"
          @input="emit('update:zoomPercent', Number(($event.target as HTMLInputElement).value))"
        >
        <button
          type="button"
          data-testid="zoom-in"
          class="pr-toolbar__zoom-btn"
          :title="t('zoomIn', locale)"
          @click="emit('zoom-in')"
        >
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            aria-hidden="true"
          >
            <circle
              cx="6.5"
              cy="6.5"
              r="4.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.3"
            />
            <path
              d="M10 10l3.2 3.2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
            <path
              d="M4.5 6.5h4M6.5 4.5v4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>

      <button
        type="button"
        data-testid="zoom-to-fit"
        class="pr-toolbar__icon-btn"
        :title="t('zoomFit', locale)"
        @click="emit('zoom-to-fit')"
      >
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
        >
          <path
            d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <rect
            x="5"
            y="5"
            width="6"
            height="6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
          />
        </svg>
      </button>

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
        <svg
          class="pr-toolbar__caliper"
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M2 2h2v12H2V2zm4 0h1.5v4H8V2h1.5v4H11V2H12.5v5.5H8.5V14H7V7.5H2.5V6H7V2zm7 7h1.5v5H13V9z"
          />
        </svg>
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
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
        >
          <rect
            x="2"
            y="2"
            width="12"
            height="12"
            rx="1"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
          />
          <path
            d="M10 2v12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.pr-chrome {
  --pr-toolbar-h: 28px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding: 4px 8px;
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

/* Search pill — ReportToolbar.spec Visual */
.pr-toolbar__search {
  position: relative;
  display: flex;
  align-items: center;
  height: var(--pr-toolbar-h);
}

.pr-toolbar__search-icon {
  position: absolute;
  left: 10px;
  color: #9a9a9a;
  pointer-events: none;
  display: block;
}

.pr-toolbar__search input {
  box-sizing: border-box;
  width: 190px;
  height: var(--pr-toolbar-h);
  padding: 0 12px 0 32px;
  border: 0;
  border-radius: 4px;
  background: #2a2a2a;
  color: #e0e0e0;
  font-size: 12px;
}

.pr-toolbar__search input::placeholder {
  color: #808080;
}

.pr-toolbar__search input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

/* Zoom compound pill */
.pr-toolbar__zoom-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: var(--pr-toolbar-h);
  padding: 0 4px;
  border-radius: 4px;
  background: #363636;
}

.pr-toolbar__zoom-btn {
  margin: 0;
  padding: 4px 6px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #c8c8c8;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.pr-toolbar__zoom-btn:hover {
  color: #fff;
}

.pr-toolbar__slider {
  width: 100px;
  height: 16px;
  margin: 0 2px;
  background: transparent;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

.pr-toolbar__slider::-webkit-slider-runnable-track {
  height: 2px;
  border-radius: 1px;
  background: linear-gradient(
    to right,
    #e8e8e8 0%,
    #e8e8e8 var(--pr-zoom-fill, 50%),
    #2a2a2a var(--pr-zoom-fill, 50%),
    #2a2a2a 100%
  );
}

.pr-toolbar__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  margin-top: -4px;
  border-radius: 50%;
  background: #c8c8c8;
  border: 0;
  box-shadow: none;
}

.pr-toolbar__slider::-moz-range-track {
  height: 2px;
  border-radius: 1px;
  background: #2a2a2a;
}

.pr-toolbar__slider::-moz-range-progress {
  height: 2px;
  border-radius: 1px;
  background: #e8e8e8;
}

.pr-toolbar__slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #c8c8c8;
  border: 0;
}

/* Square action icon buttons */
.pr-toolbar__icon-btn {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: #c8c8c8;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.pr-toolbar__icon-btn:hover {
  background: #2a2a2a;
  border-color: #4a4a4a;
  color: #fff;
}

.pr-toolbar__icon-btn--on {
  border-color: #317af7;
  color: #317af7;
  background: #1e3a5f;
}

.pr-toolbar__caliper {
  display: block;
}

.pr-toolbar__unit {
  display: flex;
  align-items: center;
  height: var(--pr-toolbar-h);
}

.pr-toolbar__unit select {
  box-sizing: border-box;
  height: var(--pr-toolbar-h);
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: #2a2a2a;
  color: #e0e0e0;
  font-size: 12px;
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
