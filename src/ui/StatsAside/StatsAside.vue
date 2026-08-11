<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../../i18n';
import type { PipeOccupancyItem, ReportCapability, ReportViewModel } from '../../domain/types';
import CsvFieldListPanel from './CsvFieldListPanel/CsvFieldListPanel.vue';
import HardwareDetailsPanel from './HardwareDetailsPanel/HardwareDetailsPanel.vue';
import RooflinePanel from './RooflinePanel/RooflinePanel.vue';

const props = defineProps<{
  report: ReportViewModel | null | undefined;
  locale?: string;
  capabilities?: ReportCapability[];
}>();

const emit = defineEmits<{
  close: [];
  'open-hardware-details': [];
  'view-full-csv': [payload: { fileName: string; text: string }];
  'open-pipe-details': [];
}>();

type PipeSide = 'cube' | 'vector';
type AsideMode = 'summary' | 'pipe' | 'compute' | 'memory';
/** Overlay for I-Q7a hardware; CSV drill-downs use mode tabs. */
type AsideSurface = 'modes' | 'hardware';

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

const hasSummary = computed(() => props.report?.summary.taskDurationUs != null);

const showPipe = computed(() => (props.report?.pipeOccupancy?.length ?? 0) > 0);
const showCompute = computed(() => (props.report?.computeTables?.length ?? 0) > 0);
const showMemory = computed(() => (props.report?.memoryTables?.length ?? 0) > 0);

const availableModes = computed(() => {
  const modes: AsideMode[] = [];
  if (hasSummary.value) modes.push('summary');
  if (showPipe.value) modes.push('pipe');
  if (showCompute.value) modes.push('compute');
  if (showMemory.value) modes.push('memory');
  return modes;
});

const mode = ref<AsideMode>('summary');
const asideSurface = ref<AsideSurface>('modes');

watch(
  availableModes,
  (modes) => {
    if (!modes.includes(mode.value)) {
      mode.value = modes[0] ?? 'summary';
    }
  },
  { immediate: true },
);

const showRoofline = computed(() => (props.report?.roofline?.points?.length ?? 0) > 0);
const hasHardwareDetails = computed(
  () => (props.report?.hardwareDetails?.sections.length ?? 0) > 0,
);

const summary = computed(() => props.report?.summary);

const durationSecondary = computed(() => {
  const s = summary.value;
  if (!s) return null;
  if (s.blockDim != null && s.blockDim !== '') {
    return t('iterationsPerCore', props.locale).replace('{n}', String(s.blockDim));
  }
  if (s.opName) return s.opName;
  return null;
});

const hasMeta = computed(() => {
  const s = summary.value;
  return Boolean(
    s && (s.coreCount != null || s.currentFreq != null || s.npuArchLabel),
  );
});

const showMore = computed(
  () => hasMeta.value || (props.capabilities ?? []).includes('hardwareDetails'),
);

const opType = computed(() => (props.report?.summary.opType ?? '').trim());
const isMix = computed(() => opType.value.toUpperCase() === 'MIX');

function resolveKnownSide(raw: string): PipeSide | null {
  const v = raw.toLowerCase();
  if (!v || v.includes('mix')) return null;
  if (v.includes('vector') || v.includes('aiv') || v.includes('vec')) return 'vector';
  if (v.includes('cube') || v.includes('aic')) return 'cube';
  return null;
}

const knownSide = computed(() => resolveKnownSide(opType.value));
const pipeSide = ref<PipeSide>('cube');

watch(
  () => [isMix.value, knownSide.value] as const,
  ([mix, side]) => {
    if (mix) pipeSide.value = 'cube';
    else if (side) pipeSide.value = side;
  },
  { immediate: true },
);

function matchesSide(item: PipeOccupancyItem, side: PipeSide): boolean {
  return (item.side ?? side) === side;
}

const visiblePipes = computed(() => {
  const all = props.report?.pipeOccupancy ?? [];
  if (isMix.value) return all.filter((p) => matchesSide(p, pipeSide.value));
  if (knownSide.value == null) return all;
  return all.filter((p) => matchesSide(p, knownSide.value!));
});

function formatDurationUs(us: number): string {
  if (us >= 1000) return `${(us / 1000).toFixed(2)} ms`;
  return `${us.toFixed(us >= 10 ? 2 : 5)} µs`;
}

function modeLabel(m: AsideMode): string {
  if (m === 'summary') return t('modeSummary', props.locale);
  if (m === 'pipe') return t('modePipe', props.locale);
  if (m === 'compute') return t('modeCompute', props.locale);
  return t('modeMemory', props.locale);
}

function formatPipeAbsolute(v: number): string {
  if (Math.abs(v) >= 100) return v.toFixed(2);
  if (Math.abs(v) >= 1) return v.toFixed(2);
  return v.toFixed(5);
}

const PIPE_SCALE = [0, 20, 40, 60, 80, 100] as const;

const headerTitle = computed(() =>
  asideSurface.value === 'hardware'
    ? t('hardwareDetails', props.locale)
    : t('summary', props.locale),
);

function openHardware() {
  if (hasHardwareDetails.value) asideSurface.value = 'hardware';
  emit('open-hardware-details');
}

function openPipeDetails() {
  if (showCompute.value) mode.value = 'compute';
  emit('open-pipe-details');
}

function backToModes() {
  asideSurface.value = 'modes';
}
</script>

<template>
  <aside
    class="pr-aside"
    data-testid="stats-aside"
  >
    <header class="pr-aside__head">
      <div class="pr-aside__title-row">
        <button
          v-if="asideSurface !== 'modes'"
          type="button"
          class="pr-aside__back"
          data-testid="stats-aside-back"
          :aria-label="t('back', locale)"
          :title="t('back', locale)"
          @click="backToModes"
        >
          ←
        </button>
        <span
          v-else
          class="pr-aside__icon"
          aria-hidden="true"
        >▦</span>
        <h3>{{ headerTitle }}</h3>
        <button
          type="button"
          class="pr-aside__close"
          data-testid="stats-aside-close"
          :aria-label="t('closePanel', locale)"
          :title="t('closePanel', locale)"
          @click="emit('close')"
        >
          ×
        </button>
      </div>
      <p
        v-if="asideSurface === 'modes' && (hasMeta || showMore)"
        class="pr-aside__meta"
        :data-testid="hasMeta ? 'stats-aside-meta' : undefined"
      >
        <span
          v-if="summary?.coreCount != null"
          class="pr-aside__meta-seg"
        >{{ t('coreCount', locale) }}: {{ summary.coreCount }}{{ t('coreUnit', locale) }}</span>
        <span
          v-if="summary?.currentFreq != null"
          class="pr-aside__meta-seg"
        >{{ t('aicFreq', locale) }}: {{ summary.currentFreq }}</span>
        <span
          v-if="summary?.npuArchLabel"
          class="pr-aside__meta-seg"
        >{{ t('npuArch', locale) }}: {{ summary.npuArchLabel }}</span>
        <button
          v-if="showMore"
          type="button"
          class="pr-aside__more"
          data-testid="stats-aside-more"
          @click="openHardware"
        >
          {{ t('more', locale) }}
        </button>
      </p>
    </header>

    <div
      v-if="asideSurface === 'hardware' && report?.hardwareDetails"
      class="pr-aside__detail"
      data-testid="stats-hardware-details"
    >
      <HardwareDetailsPanel
        :model="report.hardwareDetails"
        :locale="locale"
      />
    </div>

    <template v-else>
      <nav
        v-if="availableModes.length > 1"
        class="pr-aside__modes"
        data-testid="aside-modes"
        role="tablist"
      >
        <button
          v-for="m in availableModes"
          :key="m"
          type="button"
          role="tab"
          class="pr-aside__mode"
          :class="{ 'pr-aside__mode--active': mode === m }"
          :data-testid="`aside-mode-${m}`"
          :aria-selected="mode === m"
          @click="mode = m"
        >
          {{ modeLabel(m) }}
        </button>
      </nav>

      <div
        v-if="mode === 'summary' && hasSummary"
        class="pr-cards"
        data-testid="stats-summary"
      >
        <div
          class="pr-card"
          data-testid="stats-duration-card"
        >
          <div class="pr-card__label">
            {{ t('duration', locale) }}
          </div>
          <div class="pr-card__value">
            {{ formatDurationUs(report!.summary.taskDurationUs!) }}
          </div>
          <div
            class="pr-card__bar-track"
            data-testid="stats-duration-bar"
          >
            <span class="pr-card__bar-fill pr-card__bar-fill--duration" />
          </div>
          <div
            v-if="durationSecondary"
            class="pr-card__sub"
            data-testid="stats-duration-secondary"
          >
            {{ durationSecondary }}
          </div>
        </div>
      </div>

      <div
        v-if="mode === 'pipe' && showPipe"
        class="pr-panel pr-panel--pipe"
        data-testid="pipe-occupancy"
      >
        <div class="pr-pipe-head">
          <h4>{{ t('pipeOccupancy', locale) }}</h4>
          <button
            type="button"
            class="pr-pipe-details"
            data-testid="pipe-details"
            @click="openPipeDetails"
          >
            {{ t('details', locale) }}
          </button>
        </div>
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
        <div
          class="pr-pipe-scale"
          data-testid="pipe-scale"
        >
          <span class="pr-pipe-scale__spacer" />
          <div class="pr-pipe-scale__axis">
            <span
              v-for="tick in PIPE_SCALE"
              :key="tick"
              class="pr-pipe-scale__tick"
            >{{ tick }}%</span>
          </div>
          <span class="pr-pipe-scale__pct-spacer" />
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
                class="pr-pipe-row__hatch"
                aria-hidden="true"
              />
              <span
                class="pr-pipe-row__bar"
                :style="{
                  width: `${Math.min(100, Math.max(0, pipe.ratio * 100))}%`,
                  background: COLOR[pipe.colorKey] ?? COLOR.default,
                }"
              >
                <span
                  v-if="pipe.absoluteValue != null"
                  class="pr-pipe-row__abs"
                  data-testid="pipe-absolute"
                >{{ formatPipeAbsolute(pipe.absoluteValue) }}</span>
              </span>
            </span>
            <span class="pr-pipe-row__pct">{{ Math.round(pipe.ratio * 100) }}%</span>
          </li>
        </ul>
      </div>

      <div
        v-if="mode === 'compute' && showCompute"
        data-testid="stats-compute"
        class="pr-aside__detail"
      >
        <h4 class="pr-aside__detail-title">
          {{ t('computeAnalysis', locale) }}
        </h4>
        <CsvFieldListPanel
          :tables="report?.computeTables ?? []"
          :csv-texts="report?.csvTexts ?? {}"
          :locale="locale"
          @view-full-csv="emit('view-full-csv', $event)"
        />
      </div>

      <div
        v-if="mode === 'memory' && showMemory"
        data-testid="stats-memory"
        class="pr-aside__detail"
      >
        <h4 class="pr-aside__detail-title">
          {{ t('memoryAnalysis', locale) }}
        </h4>
        <CsvFieldListPanel
          :tables="report?.memoryTables ?? []"
          :csv-texts="report?.csvTexts ?? {}"
          :locale="locale"
          @view-full-csv="emit('view-full-csv', $event)"
        />
      </div>

      <div
        v-if="showRoofline && report?.roofline"
        class="pr-panel pr-panel--roofline"
        data-testid="stats-roofline"
      >
        <RooflinePanel
          :model="report.roofline"
          :locale="locale"
        />
      </div>
    </template>
  </aside>
</template>

<style scoped>
.pr-aside {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1 1 auto;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  background: var(--pr-bg-panel);
  padding: 10px 12px;
}

.pr-aside__head h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  flex: 1;
}

.pr-aside__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pr-aside__icon {
  font-size: 12px;
  color: #8ab4c8;
  line-height: 1;
}

.pr-aside__back {
  appearance: none;
  border: 0;
  background: transparent;
  color: #a8a8a8;
  font-size: 16px;
  line-height: 1;
  padding: 0 4px 0 0;
  cursor: pointer;
}

.pr-aside__back:hover {
  color: #e8e8e8;
}

.pr-aside__close {
  appearance: none;
  border: 0;
  background: transparent;
  color: #a8a8a8;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
  cursor: pointer;
}

.pr-aside__close:hover {
  color: #f0f0f0;
}

.pr-aside__meta {
  margin: 4px 0 0;
  font-size: 11px;
  color: #a8a8a8;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.pr-aside__more {
  appearance: none;
  border: 0;
  background: transparent;
  color: #6cb6ff;
  font-size: 11px;
  padding: 0;
  cursor: pointer;
}

.pr-aside__more:hover {
  text-decoration: underline;
}

.pr-aside__modes {
  display: flex;
  flex-wrap: nowrap;
  gap: 0;
  border-bottom: 1px solid #3a3a3a;
  overflow-x: auto;
  scrollbar-width: none;
}

.pr-aside__modes::-webkit-scrollbar {
  display: none;
}

.pr-aside__mode {
  appearance: none;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #9a9a9a;
  font-size: 12px;
  padding: 6px 10px;
  margin-bottom: -1px;
  border-radius: 0;
  cursor: pointer;
  white-space: nowrap;
}

.pr-aside__mode:hover {
  color: #d0d0d0;
}

.pr-aside__mode--active {
  background: transparent;
  color: #f0f0f0;
  border-bottom-color: var(--pr-playhead, #3078f0);
  border-color: transparent;
  border-bottom-color: var(--pr-playhead, #3078f0);
}

.pr-aside__detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
}

.pr-aside__detail-title {
  margin: 4px 0 2px;
  font-size: 12px;
  font-weight: 600;
  color: #e0e0e0;
}

.pr-cards {
  display: grid;
  grid-template-columns: 1fr;
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

.pr-card__bar-track {
  margin-top: 8px;
  height: 6px;
  background: #1a1a1a;
  border-radius: 1px;
  overflow: hidden;
}

.pr-card__bar-fill {
  display: block;
  height: 100%;
  border-radius: 1px;
  min-width: 2px;
}

.pr-card__bar-fill--duration {
  width: 12%;
  background: var(--pr-color-duration-bar);
}

.pr-card__sub {
  margin-top: 6px;
  font-size: 11px;
  color: #8a8a8a;
}

.pr-panel--pipe {
  background: transparent;
  border-radius: 0;
  padding: 4px 0 0;
}

.pr-pipe-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.pr-panel--pipe h4 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
}

.pr-pipe-details {
  appearance: none;
  border: 0;
  background: transparent;
  color: #6cb6ff;
  font-size: 11px;
  padding: 0;
  cursor: pointer;
}

.pr-pipe-details:hover {
  text-decoration: underline;
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

.pr-pipe-scale {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) minmax(40px, auto);
  gap: 8px;
  margin-bottom: 4px;
  font-size: 10px;
  color: #8a8a8a;
}

.pr-pipe-scale__axis {
  display: flex;
  justify-content: space-between;
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
  grid-template-columns: 72px minmax(0, 1fr) minmax(40px, auto);
  gap: 8px;
  align-items: center;
}

.pr-pipe-row__label {
  font-size: 11px;
  color: #c0c0c0;
}

.pr-pipe-row__track {
  position: relative;
  display: block;
  height: 14px;
  background: #1f1f1f;
  border-radius: 1px;
  overflow: hidden;
}

.pr-pipe-row__hatch {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    -45deg,
    #2a2a2a,
    #2a2a2a 2px,
    #1f1f1f 2px,
    #1f1f1f 4px
  );
  opacity: 0.9;
}

.pr-pipe-row__bar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  height: 100%;
  border-radius: 1px;
  min-width: 2px;
  padding: 0 4px;
  box-sizing: border-box;
}

.pr-pipe-row__abs {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: #f0f0f0;
  white-space: nowrap;
  line-height: 1;
}

.pr-pipe-row__pct {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: #b8b8b8;
}
</style>
