<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../../i18n';
import type { PipeOccupancyItem, ReportViewModel } from '../../domain/types';

const props = defineProps<{
  report: ReportViewModel | null | undefined;
  locale?: string;
}>();

type PipeSide = 'cube' | 'vector';

const COLOR: Record<string, string> = {
  cube: 'var(--pr-color-cube)',
  vector: 'var(--pr-color-vector)',
  mte1: 'var(--pr-color-mte1)',
  mte2: 'var(--pr-color-mte2)',
  mte3: 'var(--pr-color-mte3)',
  fixp: 'var(--pr-color-fixp)',
  scalar: 'var(--pr-color-scalar)',
  default: 'var(--pr-color-default)',
};

const hasSummary = computed(() => {
  const s = props.report?.summary;
  return Boolean(s && (s.opName || s.opType || s.taskDurationUs != null));
});

const showPipe = computed(() => (props.report?.pipeOccupancy?.length ?? 0) > 0);

const opType = computed(() => (props.report?.summary.opType ?? '').trim());

const isMix = computed(() => opType.value.toUpperCase() === 'MIX');

const defaultSide = computed<PipeSide>(() => {
  const raw = opType.value.toLowerCase();
  if (raw.includes('mix')) return 'cube';
  if (raw.includes('vector') || raw.includes('aiv') || raw.includes('vec')) return 'vector';
  if (raw.includes('cube') || raw.includes('aic')) return 'cube';
  return 'vector';
});

const pipeSide = ref<PipeSide>(defaultSide.value);

watch(defaultSide, (side) => {
  pipeSide.value = side;
});

function matchesSide(item: PipeOccupancyItem, side: PipeSide): boolean {
  return (item.side ?? side) === side;
}

const visiblePipes = computed(() => {
  const all = props.report?.pipeOccupancy ?? [];
  const side = isMix.value ? pipeSide.value : defaultSide.value;
  return all.filter((p) => matchesSide(p, side));
});

function formatDurationUs(us: number): string {
  if (us >= 1000) return `${(us / 1000).toFixed(2)} ms`;
  return `${us.toFixed(us >= 10 ? 2 : 5)} µs`;
}
</script>

<template>
  <aside
    class="pr-aside"
    data-testid="stats-aside"
  >
    <header class="pr-aside__head">
      <h3>{{ t('summary', locale) }}</h3>
      <p
        v-if="report?.summary.currentFreq != null"
        class="pr-aside__meta"
      >
        {{ t('freq', locale) }}: {{ report.summary.currentFreq }}
        <template v-if="report.summary.ratedFreq != null">
          / {{ report.summary.ratedFreq }}
        </template>
        <template v-if="report?.summary.opType">
          · {{ report.summary.opType }}
        </template>
      </p>
    </header>

    <div
      v-if="hasSummary"
      class="pr-cards"
      data-testid="stats-summary"
    >
      <div
        v-if="report?.summary.taskDurationUs != null"
        class="pr-card"
      >
        <div class="pr-card__label">
          {{ t('duration', locale) }}
        </div>
        <div class="pr-card__value">
          {{ formatDurationUs(report.summary.taskDurationUs) }}
        </div>
        <div
          v-if="report?.summary.opName"
          class="pr-card__sub"
        >
          {{ report.summary.opName }}
        </div>
      </div>
      <div
        v-if="report?.summary.opType"
        class="pr-card"
      >
        <div class="pr-card__label">
          {{ t('type', locale) }}
        </div>
        <div class="pr-card__value pr-card__value--sm">
          {{ report.summary.opType }}
        </div>
      </div>
    </div>

    <div
      v-if="showPipe"
      class="pr-panel pr-panel--pipe"
      data-testid="pipe-occupancy"
    >
      <h4>{{ t('pipeOccupancy', locale) }}</h4>
      <div
        v-if="isMix"
        class="pr-pipe-toggle"
        data-testid="pipe-side-toggle"
        role="group"
        :aria-label="t('pipeSide', locale)"
      >
        <button
          type="button"
          class="pr-pipe-toggle__btn"
          :class="{ 'pr-pipe-toggle__btn--active': pipeSide === 'cube' }"
          data-testid="pipe-side-cube"
          @click="pipeSide = 'cube'"
        >
          Cube
        </button>
        <button
          type="button"
          class="pr-pipe-toggle__btn"
          :class="{ 'pr-pipe-toggle__btn--active': pipeSide === 'vector' }"
          data-testid="pipe-side-vector"
          @click="pipeSide = 'vector'"
        >
          Vector
        </button>
      </div>
      <ul class="pr-pipe-list">
        <li
          v-for="pipe in visiblePipes"
          :key="`${pipe.id}-${pipe.side ?? 'x'}`"
          class="pr-pipe-row"
        >
          <span class="pr-pipe-row__label">{{ pipe.label }}</span>
          <span class="pr-pipe-row__track">
            <span
              class="pr-pipe-row__bar"
              :style="{
                width: `${Math.min(100, pipe.ratio * 100)}%`,
                background: COLOR[pipe.colorKey] ?? COLOR.default,
              }"
            />
          </span>
          <span class="pr-pipe-row__pct">{{ Math.round(pipe.ratio * 100) }}%</span>
        </li>
      </ul>
    </div>
  </aside>
</template>

<style scoped>
.pr-aside {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: auto;
  background: var(--pr-bg-panel);
  padding: 10px 12px;
}

.pr-aside__head h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.pr-aside__meta {
  margin: 4px 0 0;
  font-size: 11px;
  color: #a8a8a8;
}

.pr-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.pr-card {
  background: #262626;
  border: 1px solid #3a3a3a;
  border-radius: 2px;
  padding: 8px 10px;
}

.pr-card__label {
  font-size: 11px;
  color: #9a9a9a;
  margin-bottom: 4px;
}

.pr-card__value {
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.pr-card__value--sm {
  font-size: 14px;
}

.pr-card__sub {
  margin-top: 4px;
  font-size: 11px;
  color: #8a8a8a;
}

.pr-panel--pipe {
  background: transparent;
  border-radius: 0;
  padding: 4px 0 0;
}

.pr-panel--pipe h4 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
}

.pr-pipe-toggle {
  display: inline-flex;
  margin: 0 0 10px;
  border: 1px solid #3a3a3a;
  border-radius: 2px;
  overflow: hidden;
}

.pr-pipe-toggle__btn {
  appearance: none;
  border: 0;
  background: #1f1f1f;
  color: #b8b8b8;
  font-size: 11px;
  padding: 4px 10px;
  cursor: pointer;
}

.pr-pipe-toggle__btn--active {
  background: #2f4f4f;
  color: #f0f0f0;
}

.pr-pipe-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.pr-pipe-row {
  display: grid;
  grid-template-columns: 52px 1fr 36px;
  gap: 8px;
  align-items: center;
}

.pr-pipe-row__label {
  font-size: 11px;
  color: #c0c0c0;
}

.pr-pipe-row__track {
  display: block;
  height: 10px;
  background: #1f1f1f;
  border-radius: 1px;
  overflow: hidden;
}

.pr-pipe-row__bar {
  display: block;
  height: 100%;
  border-radius: 1px;
  min-width: 2px;
}

.pr-pipe-row__pct {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: #b8b8b8;
}
</style>
