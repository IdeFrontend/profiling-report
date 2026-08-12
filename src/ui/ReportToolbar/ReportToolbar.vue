<script setup lang="ts">
import { ref } from 'vue';
import type { TimeDisplayUnit } from '../../domain/types';
import { MAX_DEPENDENCY_DEPTH, normalizeDependencyDepth } from '../../domain/types';
import { t } from '../../i18n';

defineProps<{
  searchQuery: string;
  asideVisible: boolean;
  asideAvailable: boolean;
  zoomPercent: number;
  timeUnit: TimeDisplayUnit;
  dependencyDepth: number;
  locale?: string;
  title?: string;
  measureMode?: boolean;
}>();

const emit = defineEmits<{
  'update:searchQuery': [value: string];
  'update:asideVisible': [value: boolean];
  'update:timeUnit': [value: TimeDisplayUnit];
  'update:dependencyDepth': [value: number];
  'update:measureMode': [value: boolean];
  'zoom-to-fit': [];
  'zoom-in': [];
  'zoom-out': [];
  'update:zoomPercent': [value: number];
}>();

function onDepthChange(event: Event) {
  // A cleared number input reads as '' — normalizeDependencyDepth turns that (and
  // anything unparsable) into the shared default rather than letting NaN through.
  const raw = (event.target as HTMLInputElement).value.trim();
  emit('update:dependencyDepth', normalizeDependencyDepth(raw === '' ? Number.NaN : Number(raw)));
}

const displayControlOpen = ref(false);

function toggleDisplayControl() {
  displayControlOpen.value = !displayControlOpen.value;
}

function closeDisplayControl() {
  displayControlOpen.value = false;
}
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

      <button
        type="button"
        class="pr-toolbar__icon-btn"
        data-testid="toggle-measure"
        :aria-pressed="measureMode"
        :aria-label="t('measure', locale)"
        :class="{ 'pr-toolbar__icon-btn--on': measureMode }"
        :title="t('measure', locale)"
        @click="emit('update:measureMode', !measureMode)"
      >
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
        >
          <path
            d="M2 5h12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
          />
          <path
            d="M4 5v6.5M12 5v6.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
          />
          <path
            d="M4 11.5h8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
          />
          <path
            d="M8 5v3.2"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
          />
        </svg>
      </button>

      <div class="pr-toolbar__display-wrap">
        <button
          type="button"
          class="pr-toolbar__icon-btn"
          data-testid="toggle-display-control"
          :aria-expanded="displayControlOpen"
          :aria-pressed="displayControlOpen"
          :class="{ 'pr-toolbar__icon-btn--on': displayControlOpen }"
          :title="t('displayControl', locale)"
          @click="toggleDisplayControl"
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <path
              d="M2 5.5L8 2.5l6 3-6 3-6-3z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linejoin="round"
            />
            <path
              d="M2 8l6 3 6-3"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linejoin="round"
            />
            <path
              d="M2 10.5l6 3 6-3"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <div
          v-if="displayControlOpen"
          class="pr-toolbar__display-control"
          data-testid="display-control"
          role="dialog"
          :aria-label="t('displayControl', locale)"
        >
          <div class="pr-toolbar__display-head">
            <span class="pr-toolbar__display-title">{{ t('displayControl', locale) }}</span>
            <button
              type="button"
              class="pr-toolbar__display-close"
              data-testid="display-control-close"
              :title="t('closePanel', locale)"
              @click="closeDisplayControl"
            >
              ×
            </button>
          </div>
          <label class="pr-toolbar__display-field">
            <span class="pr-toolbar__display-label">{{ t('taskDisplayUnit', locale) }}</span>
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
          <label class="pr-toolbar__display-field">
            <span class="pr-toolbar__display-label">
              {{ t('connectionLevel', locale) }}
              <span
                class="pr-toolbar__display-help"
                :title="t('connectionLevelHelp', locale)"
                aria-hidden="true"
              >?</span>
            </span>
            <input
              data-testid="dependency-depth"
              type="number"
              step="1"
              min="-1"
              :max="MAX_DEPENDENCY_DEPTH"
              :value="dependencyDepth"
              @change="onDepthChange"
            >
          </label>
        </div>
      </div>

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
  background: var(--pr-bg-deep, #1f1f1f);
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
  position: relative;
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
    #ffffff 0%,
    #ffffff var(--pr-zoom-fill, 50%),
    #1a1a1a var(--pr-zoom-fill, 50%),
    #1a1a1a 100%
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
  background: #1a1a1a;
}

.pr-toolbar__slider::-moz-range-progress {
  height: 2px;
  border-radius: 1px;
  background: #ffffff;
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
  border: 0;
  border-radius: 6px;
  background: #363636;
  color: #b3b3b3;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.pr-toolbar__icon-btn:hover,
.pr-toolbar__icon-btn:active,
.pr-toolbar__icon-btn--on,
.pr-toolbar__icon-btn[aria-pressed='true'],
.pr-toolbar__icon-btn[aria-expanded='true'] {
  background: #1e2a3e;
  color: #2d70e3;
}

.pr-toolbar__display-wrap {
  position: relative;
  display: inline-flex;
}

.pr-toolbar__display-control {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  box-sizing: border-box;
  min-width: 240px;
  padding: 20px 22px 22px;
  background: #363636;
  border: 1px solid #5e5e5e;
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
}

.pr-toolbar__display-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 20px;
}

.pr-toolbar__display-title {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  line-height: 1.2;
}

.pr-toolbar__display-close {
  appearance: none;
  margin: 0;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: #e6e6e6;
  font-size: 18px;
  font-weight: 300;
  line-height: 1;
  cursor: pointer;
}

.pr-toolbar__display-close:hover {
  color: #ffffff;
}

.pr-toolbar__display-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pr-toolbar__display-field + .pr-toolbar__display-field {
  margin-top: 16px;
}

.pr-toolbar__display-label {
  font-size: 12px;
  color: #b2b2b2;
  line-height: 1.2;
}

.pr-toolbar__display-help {
  display: inline-grid;
  place-items: center;
  width: 14px;
  height: 14px;
  margin-left: 4px;
  border: 1px solid #6a6a6a;
  border-radius: 50%;
  color: #a0a0a0;
  font-size: 11px;
  cursor: help;
  vertical-align: -2px;
}

.pr-toolbar__display-field select,
.pr-toolbar__display-field input[type='number'] {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  padding: 0 28px 0 12px;
  border: 0;
  border-radius: 6px;
  background-color: #404040;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5L6 8l3.5-3.5' fill='none' stroke='%23c8c8c8' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 12px;
  color: #ffffff;
  font-size: 12px;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.pr-toolbar__display-field input[type='number'] {
  padding-right: 12px;
  background-image: none;
  cursor: text;
}

.pr-toolbar__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
