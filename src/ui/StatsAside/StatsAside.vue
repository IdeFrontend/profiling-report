<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../../i18n';
import type {
  BandwidthSideRow,
  PipeOccupancyItem,
  ReportCapability,
  ReportViewModel,
} from '../../domain/types';
import { buildMemoryTopology, firstLabelledMemoryTopology } from '../../adapters/memoryTopology';
import CsvFieldListPanel from './CsvFieldListPanel/CsvFieldListPanel.vue';
import HardwareDetailsPanel from './HardwareDetailsPanel/HardwareDetailsPanel.vue';
import RooflinePanel from './RooflinePanel/RooflinePanel.vue';
import MemoryTopologyPanel from './MemoryTopologyPanel/MemoryTopologyPanel.vue';
import CannbotIcon from './CannbotIcon.vue';
import type { CannbotScope } from '../../domain/cannbot';

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
  'open-cannbot': [scope: CannbotScope];
}>();

type PipeSide = 'cube' | 'vector';
type AsideSurface = 'report' | 'compute' | 'memory' | 'hardware';

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

const hasDuration = computed(() => props.report?.summary.taskDurationUs != null);
const bandwidthCards = computed(() => props.report?.bandwidthCards ?? []);
const hasSummary = computed(() => hasDuration.value || bandwidthCards.value.length > 0);
const bandwidthView = computed(() =>
  bandwidthCards.value.map((card) => ({
    id: card.id,
    sides: card.sides.map((row) => ({
      side: row.side,
      score: bandwidthScore(row),
      sub: `${formatGBs(row.measuredGBs)} / ${formatGBs(row.peakGBs)} GB/s`,
    })),
  })),
);
const showPipe = computed(() => (props.report?.pipeOccupancy?.length ?? 0) > 0);
const showCompute = computed(() => (props.report?.computeTables?.length ?? 0) > 0);
const showMemory = computed(() => (props.report?.memoryTables?.length ?? 0) > 0);
const showRoofline = computed(() => (props.report?.roofline?.points?.length ?? 0) > 0);
const hasHardwareDetails = computed(
  () => (props.report?.hardwareDetails?.sections.length ?? 0) > 0,
);

const asideSurface = ref<AsideSurface>('report');
const selectedBlockId = ref('');

watch(
  () => props.report,
  (report) => {
    asideSurface.value = 'report';
    const tables = report?.memoryTables ?? [];
    const ids = tables.flatMap((t) => t.blockIds);
    selectedBlockId.value =
      ids.length === 0 ? '' : (firstLabelledMemoryTopology(tables)?.blockId ?? ids[0]!);
  },
  { immediate: true },
);

watch(
  () => [showCompute.value, showMemory.value] as const,
  ([compute, memory]) => {
    if (asideSurface.value === 'compute' && !compute) asideSurface.value = 'report';
    else if (asideSurface.value === 'memory' && !memory) asideSurface.value = 'report';
  },
);

const topologyModel = computed(() => {
  const tables = props.report?.memoryTables ?? [];
  if (tables.length > 0) {
    return selectedBlockId.value ? buildMemoryTopology(tables, selectedBlockId.value) : undefined;
  }
  return props.report?.memoryTopology;
});

const showTopology = computed(() => {
  const m = topologyModel.value;
  return Boolean(m && m.edges.some((e) => e.label != null && e.label !== ''));
});

const csvOnly = computed(
  () =>
    !hasSummary.value &&
    !showPipe.value &&
    !showRoofline.value &&
    !showTopology.value &&
    (showCompute.value || showMemory.value),
);

const summary = computed(() => props.report?.summary);

function numericBlockDim(blockDim: string | number | undefined): number | undefined {
  if (blockDim == null || blockDim === '') return undefined;
  const n = typeof blockDim === 'number' ? blockDim : Number(blockDim);
  return Number.isFinite(n) ? n : undefined;
}

/** HQ 32: Block Dim / core_count × 100%, clamped 0–100. Null when inputs missing. */
const durationCoreUtilPercent = computed(() => {
  const s = summary.value;
  const block = numericBlockDim(s?.blockDim);
  const cores = s?.coreCount;
  if (block == null || cores == null || cores <= 0) return null;
  return Math.min(100, Math.max(0, (block / cores) * 100));
});

const durationBarWidthPercent = computed(() => durationCoreUtilPercent.value ?? 15);

const durationSecondary = computed(() => {
  const s = summary.value;
  if (!s) return null;
  const block = numericBlockDim(s.blockDim);
  if (block != null && s.coreCount != null && s.coreCount > 0) {
    return t('iterationsPerCoreRatio', props.locale)
      .replace('{blockDim}', String(block))
      .replace('{coreCount}', String(s.coreCount));
  }
  if (s.blockDim != null && s.blockDim !== '') {
    return t('iterationsPerCore', props.locale).replace('{n}', String(s.blockDim));
  }
  if (s.opName) return s.opName;
  return null;
});

const hasMeta = computed(() => {
  const s = summary.value;
  return Boolean(s && (s.pid || s.opType || (s.blockDim != null && s.blockDim !== '')));
});

/** HQ 30–31: 更多 is always available on the report shell. */
const showMore = computed(() => asideSurface.value === 'report');

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

/** Sketch splits the number from a muted unit (`4.06` + `ms`). Display is 2 dp; title keeps full precision. */
function formatDurationParts(us: number): { value: string; unit: string; title: string } {
  if (us >= 1000) {
    const ms = us / 1000;
    return { value: ms.toFixed(2), unit: 'ms', title: `${ms} ms` };
  }
  return { value: us.toFixed(2), unit: 'µs', title: `${us} µs` };
}

const durationParts = computed(() => {
  const us = props.report?.summary.taskDurationUs;
  return us == null ? null : formatDurationParts(us);
});

function formatPipeAbsolute(v: number): string {
  if (Math.abs(v) >= 100) return v.toFixed(2);
  if (Math.abs(v) >= 1) return v.toFixed(2);
  return v.toFixed(5);
}

/** HQ 34: display measured/peak in GB/s (magnitude rounding). */
function formatGBs(gbs: number): string {
  if (gbs >= 10) return gbs.toFixed(1);
  if (gbs >= 0.01) return gbs.toFixed(2);
  if (gbs >= 0.001) return gbs.toFixed(3);
  return gbs.toFixed(4);
}

function bandwidthScore(row: BandwidthSideRow): number {
  if (!(row.peakGBs > 0)) return 0;
  return Math.min(100, Math.max(0, Math.round((row.measuredGBs / row.peakGBs) * 100)));
}

const PIPE_SCALE = [0, 20, 40, 60, 80, 100] as const;

const headerTitle = computed(() => {
  if (asideSurface.value === 'hardware') return t('hardwareDetails', props.locale);
  if (asideSurface.value === 'compute') return t('computeAnalysis', props.locale);
  if (asideSurface.value === 'memory') return t('memoryAnalysis', props.locale);
  return t('summary', props.locale);
});

function openHardware() {
  asideSurface.value = 'hardware';
  emit('open-hardware-details');
}

function openPipeDetails() {
  if (showCompute.value) asideSurface.value = 'compute';
  emit('open-pipe-details');
}

function openMemoryDetails() {
  if (showMemory.value) asideSurface.value = 'memory';
}

function backToReport() {
  asideSurface.value = 'report';
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
          v-if="asideSurface !== 'report'"
          type="button"
          class="pr-aside__back"
          data-testid="stats-aside-back"
          :aria-label="t('back', locale)"
          :title="t('back', locale)"
          @click="backToReport"
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <path
              d="M10 3.5L4.5 8 10 12.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M5 8h8"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <svg
          v-else
          class="pr-aside__icon"
          data-testid="stats-aside-icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path
            d="M2.5 2.5v11h11"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <polyline
            points="4.5,10.5 7,6.5 9,8.5 13.5,4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </svg>
        <h3 :title="headerTitle">
          {{ headerTitle }}
        </h3>
        <button
          type="button"
          class="pr-aside__close"
          data-testid="stats-aside-close"
          :aria-label="t('closePanel', locale)"
          :title="t('closePanel', locale)"
          @click="emit('close')"
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <path
              d="M4 4l8 8M12 4l-8 8"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
      <p
        v-if="asideSurface === 'report' && (hasMeta || showMore)"
        class="pr-aside__meta"
        :data-testid="hasMeta ? 'stats-aside-meta' : undefined"
      >
        <span
          v-if="summary?.pid"
          class="pr-aside__meta-seg"
        ><span class="pr-aside__meta-k">{{ t('process', locale) }}:</span><span class="pr-aside__meta-v">{{ summary.pid }}</span></span>
        <span
          v-if="summary?.opType"
          class="pr-aside__meta-seg"
        ><span class="pr-aside__meta-k">{{ t('opTypeLabel', locale) }}:</span><span class="pr-aside__meta-v">{{ summary.opType }}</span></span>
        <span
          v-if="summary?.blockDim != null && summary.blockDim !== ''"
          class="pr-aside__meta-seg"
        ><span class="pr-aside__meta-k">{{ t('blocks', locale) }}:</span><span class="pr-aside__meta-v">{{ summary.blockDim }}</span></span>
        <button
          v-if="showMore"
          type="button"
          class="pr-aside__more"
          data-testid="stats-aside-more"
          @click="openHardware"
        >
          {{ t('more', locale) }}
        </button>
        <button
          type="button"
          class="pr-cannbot"
          data-testid="cannbot-summary"
          :aria-label="t('cannbotAsk', locale)"
          :title="t('cannbotAsk', locale)"
          @click="emit('open-cannbot', 'summary')"
        >
          <CannbotIcon />
        </button>
      </p>
    </header>

    <div
      v-if="asideSurface === 'hardware'"
      class="pr-aside__detail"
      data-testid="stats-hardware-details"
    >
      <HardwareDetailsPanel
        v-if="hasHardwareDetails && report?.hardwareDetails"
        :model="report.hardwareDetails"
        :locale="locale"
      />
      <p
        v-else
        class="pr-hw-missing"
        data-testid="hardware-info-missing"
      >
        {{ t('hardwareInfoMissing', locale) }}
      </p>
    </div>

    <div
      v-else-if="asideSurface === 'compute' && showCompute"
      data-testid="stats-compute"
      class="pr-aside__detail"
    >
      <CsvFieldListPanel
        :tables="report?.computeTables ?? []"
        :csv-texts="report?.csvTexts ?? {}"
        :locale="locale"
        :show-block-switcher="false"
        :show-view-all="false"
      />
    </div>

    <div
      v-else-if="asideSurface === 'memory' && showMemory"
      data-testid="stats-memory"
      class="pr-aside__detail"
    >
      <CsvFieldListPanel
        :tables="report?.memoryTables ?? []"
        :csv-texts="report?.csvTexts ?? {}"
        :locale="locale"
        :selected-block-id="selectedBlockId"
        @update:selected-block-id="selectedBlockId = $event"
        @view-full-csv="emit('view-full-csv', $event)"
      />
    </div>

    <div
      v-else
      class="pr-aside__body"
    >
      <div
        v-if="hasSummary"
        class="pr-cards"
        data-testid="stats-summary"
      >
        <div
          v-if="hasDuration && durationParts"
          class="pr-card pr-card--top"
          data-testid="stats-duration-card"
        >
          <div class="pr-card__label">
            {{ t('duration', locale) }}
          </div>
          <div
            class="pr-card__value"
            :title="durationParts.title"
            data-testid="stats-duration-value"
          >
            <span class="pr-card__num">{{ durationParts.value }}</span>
            <span class="pr-card__unit">{{ durationParts.unit }}</span>
          </div>
          <div
            class="pr-card__bar-track"
            data-testid="stats-duration-bar"
          >
            <span
              class="pr-card__bar-hatch"
              aria-hidden="true"
            />
            <span
              class="pr-card__bar-fill pr-card__bar-fill--duration"
              :style="{ width: `${durationBarWidthPercent}%` }"
            />
          </div>
          <div
            v-if="durationSecondary"
            class="pr-card__sub"
            data-testid="stats-duration-secondary"
            :title="durationSecondary"
          >
            {{ durationSecondary }}
          </div>
        </div>
        <div
          v-if="hasDuration"
          class="pr-card pr-card--top pr-card--na"
          data-testid="stats-compute-card"
        >
          <div class="pr-card__label">
            {{ t('computePower', locale) }}
          </div>
          <div class="pr-card__value">
            {{ t('notAvailable', locale) }}
          </div>
        </div>
        <div
          v-if="hasDuration"
          class="pr-card pr-card--top pr-card--na"
          data-testid="stats-core-util-card"
        >
          <div class="pr-card__label">
            {{ t('avgCoreUtil', locale) }}
          </div>
          <div class="pr-card__value">
            {{ t('notAvailable', locale) }}
          </div>
        </div>
        <div
          v-for="card in bandwidthView"
          :key="card.id"
          class="pr-card pr-card--bw"
          :data-testid="`stats-bandwidth-${card.id}`"
        >
          <div class="pr-card__label">
            {{ t(card.id === 'input' ? 'inputBandwidth' : 'outputBandwidth', locale) }}
          </div>
          <div class="pr-bw-cols">
            <div
              v-for="row in card.sides"
              :key="row.side"
              class="pr-bw-col"
              :data-testid="`stats-bandwidth-${card.id}-${row.side}`"
            >
              <div class="pr-bw-col__head">
                <span
                  class="pr-card__value"
                  :data-testid="`stats-bandwidth-${card.id}-${row.side}-score`"
                >{{ row.score }}</span>
                <span class="pr-bw-col__side">{{ row.side }}</span>
              </div>
              <div class="pr-card__bar-track">
                <span
                  class="pr-card__bar-hatch"
                  aria-hidden="true"
                />
                <span
                  class="pr-card__bar-fill pr-card__bar-fill--bw"
                  :style="{ width: `${row.score}%` }"
                  :data-testid="`stats-bandwidth-${card.id}-${row.side}-bar`"
                />
              </div>
              <div
                class="pr-card__sub"
                :title="row.sub"
              >
                {{ row.sub }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="showRoofline && report?.roofline"
        class="pr-stack-section"
        data-testid="stats-roofline"
      >
        <RooflinePanel
          :model="report.roofline"
          :locale="locale"
        />
      </div>

      <div
        v-if="showPipe"
        class="pr-stack-section"
        data-testid="pipe-occupancy"
      >
        <div class="pr-stack-section__head">
          <h4>{{ t('computeAnalysis', locale) }}</h4>
          <div class="pr-pipe-head__actions">
            <button
              v-if="showCompute"
              type="button"
              class="pr-cannbot"
              data-testid="cannbot-compute"
              :aria-label="t('cannbotAsk', locale)"
              :title="t('cannbotAsk', locale)"
              @click="emit('open-cannbot', 'compute')"
            >
              <CannbotIcon />
            </button>
            <button
              type="button"
              class="pr-pipe-details"
              data-testid="pipe-details"
              @click="openPipeDetails"
            >
              {{ t('details', locale) }}
            </button>
          </div>
        </div>
        <div class="pr-panel pr-panel--pipe">
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
          <div class="pr-pipe-chart">
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
            </div>
            <ul class="pr-pipe-list">
              <li
                v-for="pipe in visiblePipes"
                :key="`${pipe.id}-${pipe.side ?? 'x'}`"
                class="pr-pipe-row"
                :style="{ '--pr-pipe': COLOR[pipe.colorKey] ?? COLOR.default }"
              >
                <span class="pr-pipe-row__label">{{ pipe.label }}</span>
                <span class="pr-pipe-row__track">
                  <span
                    class="pr-pipe-row__hatch"
                    aria-hidden="true"
                  />
                  <span
                    class="pr-pipe-row__bar"
                    :style="{ width: `${Math.min(100, Math.max(0, pipe.ratio * 100))}%` }"
                  />
                  <span
                    class="pr-pipe-row__grid"
                    aria-hidden="true"
                  />
                  <span
                    v-if="pipe.absoluteValue != null"
                    class="pr-pipe-row__abs"
                    data-testid="pipe-absolute"
                  >{{ formatPipeAbsolute(pipe.absoluteValue) }}</span>
                  <span class="pr-pipe-row__pct">{{ Math.round(pipe.ratio * 100) }}%</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div
        v-if="showTopology || (showMemory && !csvOnly)"
        class="pr-stack-section"
        :data-testid="showTopology ? 'stats-topology' : 'stats-memory-entry'"
      >
        <div class="pr-stack-section__head">
          <h4>{{ t('memoryAnalysis', locale) }}</h4>
          <div class="pr-pipe-head__actions">
            <button
              v-if="showMemory"
              type="button"
              class="pr-cannbot"
              data-testid="cannbot-memory"
              :aria-label="t('cannbotAsk', locale)"
              :title="t('cannbotAsk', locale)"
              @click="emit('open-cannbot', 'memory')"
            >
              <CannbotIcon />
            </button>
            <button
              v-if="showMemory"
              type="button"
              class="pr-pipe-details"
              data-testid="topology-details"
              @click="openMemoryDetails"
            >
              {{ t('details', locale) }}
            </button>
          </div>
        </div>
        <div
          v-if="showTopology"
          class="pr-panel pr-panel--topo"
        >
          <MemoryTopologyPanel
            :model="topologyModel"
            :locale="locale"
          />
        </div>
      </div>

      <template v-if="csvOnly">
        <div
          v-if="showCompute"
          data-testid="stats-compute"
          class="pr-aside__detail"
        >
          <div class="pr-aside__detail-head">
            <h4 class="pr-aside__detail-title">
              {{ t('computeAnalysis', locale) }}
            </h4>
            <button
              type="button"
              class="pr-cannbot"
              data-testid="cannbot-compute"
              :aria-label="t('cannbotAsk', locale)"
              :title="t('cannbotAsk', locale)"
              @click="emit('open-cannbot', 'compute')"
            >
              <CannbotIcon />
            </button>
          </div>
          <CsvFieldListPanel
            :tables="report?.computeTables ?? []"
            :csv-texts="report?.csvTexts ?? {}"
            :locale="locale"
            :show-block-switcher="false"
            :show-view-all="false"
          />
        </div>
        <div
          v-if="showMemory"
          data-testid="stats-memory"
          class="pr-aside__detail"
        >
          <div class="pr-aside__detail-head">
            <h4 class="pr-aside__detail-title">
              {{ t('memoryAnalysis', locale) }}
            </h4>
            <button
              type="button"
              class="pr-cannbot"
              data-testid="cannbot-memory"
              :aria-label="t('cannbotAsk', locale)"
              :title="t('cannbotAsk', locale)"
              @click="emit('open-cannbot', 'memory')"
            >
              <CannbotIcon />
            </button>
          </div>
          <CsvFieldListPanel
            :tables="report?.memoryTables ?? []"
            :csv-texts="report?.csvTexts ?? {}"
            :locale="locale"
            :selected-block-id="selectedBlockId"
            @update:selected-block-id="selectedBlockId = $event"
            @view-full-csv="emit('view-full-csv', $event)"
          />
        </div>
      </template>
    </div>
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
  overflow: hidden;
  background: var(--pr-bg-aside);
  padding: 10px 12px;
}

.pr-aside__head {
  flex-shrink: 0;
}

.pr-aside__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.pr-aside__head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #ffffff;
}

.pr-aside__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pr-aside__icon {
  flex-shrink: 0;
  color: #e6e6e6;
}

.pr-aside__back,
.pr-aside__close {
  appearance: none;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #e6e6e6;
  line-height: 0;
  cursor: pointer;
}

.pr-aside__back:hover,
.pr-aside__close:hover {
  color: #ffffff;
}

.pr-aside__meta {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 16px;
  color: #999999;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}

.pr-aside__meta-seg {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.pr-aside__meta-k {
  color: #8a8a8a;
}

.pr-aside__meta-v {
  color: #d0d0d0;
}

.pr-aside__more,
.pr-pipe-details {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.pr-aside__more {
  color: #8a8a8a;
  font-size: 12px;
}

.pr-pipe-details {
  color: #e6e6e6;
  font-size: 12px;
}

.pr-aside__more:hover {
  color: #d0d0d0;
  text-decoration: underline;
}

.pr-pipe-details:hover {
  color: #ffffff;
  text-decoration: underline;
}

.pr-pipe-head__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pr-cannbot {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 2px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  opacity: 0.85;
}

.pr-cannbot:hover {
  opacity: 1;
}

.pr-aside__meta .pr-cannbot {
  margin-left: auto;
}

.pr-aside__detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
}

.pr-aside > .pr-aside__detail {
  flex: 1 1 auto;
  overflow: hidden;
}

.pr-hw-missing {
  margin: 0;
  padding: 16px 8px;
  font-size: 12px;
  color: #9a9a9a;
  text-align: center;
}

.pr-aside__detail-title {
  margin: 4px 0 2px;
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
}

.pr-aside__detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 4px 0 2px;
}

.pr-aside__detail-head .pr-aside__detail-title {
  margin: 0;
}

/*
 * Sketch: 3+2 grid on six columns; bottom pad only so tile edges align with
 * stack islands below (horizontal edges share the aside body column).
 */
.pr-cards {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  padding: 0 0 8px;
  border-radius: 0;
  background: var(--pr-bg-aside);
}

.pr-card {
  min-width: 0;
  /* detail-strip-raised samples: TR ≈ #272f31 → BL #252525 */
  background: linear-gradient(225deg, #272f31 0%, #262b2c 35%, #252525 72%);
  box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.04);
  border: 0;
  border-radius: 8px;
  padding: 12px 14px;
}

.pr-card--top {
  grid-column: span 2;
}

.pr-card--bw {
  grid-column: span 3;
}

.pr-card--na {
  display: flex;
  flex-direction: column;
}

.pr-card--na .pr-card__value {
  flex: 1 1 auto;
  align-items: center;
  color: #8a8a8a;
}

.pr-card__label {
  font-size: 11px;
  color: #999999;
  margin-bottom: 6px;
}

.pr-card__value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  color: #ececec;
}

.pr-card__num {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-card__unit {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 500;
  color: #868686;
}

.pr-card__bar-track {
  position: relative;
  margin-top: 8px;
  height: 8px;
  background: var(--pr-bg-aside);
  border-radius: 999px;
  overflow: hidden;
}

.pr-card__bar-hatch {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: repeating-linear-gradient(
    -45deg,
    #2a2a2a 0 2px,
    #1f1f1f 2px 4px
  );
}

.pr-card__bar-fill {
  position: relative;
  z-index: 1;
  display: block;
  height: 100%;
  border-radius: inherit;
  min-width: 2px;
}

.pr-card__bar-fill--duration {
  background: var(--pr-color-duration-bar);
}

.pr-card__bar-fill--bw {
  min-width: 0;
  background: var(--pr-color-bandwidth-bar);
}

.pr-bw-cols {
  display: flex;
  gap: 8px;
}

.pr-bw-col {
  flex: 1 1 0;
  min-width: 0;
}

.pr-bw-col__head {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.pr-bw-col__side {
  font-size: 11px;
  color: #999999;
}

.pr-card__sub {
  margin-top: 6px;
  font-size: 11px;
  color: #8a8a8a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Section titles sit on the aside shell; grey islands wrap chart bodies only. */
.pr-stack-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.pr-stack-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pr-stack-section__head h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.pr-panel--pipe,
.pr-panel--topo {
  background: var(--pr-bg-panel);
  border-radius: 4px;
  padding: 10px;
}

.pr-panel--pipe {
  padding: 12px 10px 10px;
}

.pr-pipe-toggle {
  display: inline-flex;
  margin: 0 0 10px;
  background: #111111;
  border-radius: 4px;
  padding: 2px;
}

.pr-pipe-toggle__btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: #b3b3b3;
  font-size: 12px;
  padding: 5px 14px;
  border-radius: 4px;
  cursor: pointer;
}

.pr-pipe-toggle__btn--active {
  background: #343434;
  color: #ffffff;
}

.pr-pipe-chart {
  background: #202020;
  border-radius: 4px;
  padding: 10px 8px 12px;
}

.pr-pipe-scale,
.pr-pipe-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.pr-pipe-scale {
  margin-bottom: 8px;
  font-size: 12px;
  color: #999999;
}

.pr-pipe-scale__axis {
  position: relative;
  height: 16px;
}

.pr-pipe-scale__tick {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  font-variant-numeric: tabular-nums;
}

.pr-pipe-scale__tick:nth-child(1) {
  left: 0%;
  transform: none;
}

.pr-pipe-scale__tick:nth-child(2) {
  left: 20%;
}

.pr-pipe-scale__tick:nth-child(3) {
  left: 40%;
}

.pr-pipe-scale__tick:nth-child(4) {
  left: 60%;
}

.pr-pipe-scale__tick:nth-child(5) {
  left: 80%;
}

.pr-pipe-scale__tick:nth-child(6) {
  left: 100%;
  transform: translateX(-100%);
}

.pr-pipe-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pr-pipe-row__label {
  font-size: 12px;
  color: #999999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.pr-pipe-row__track {
  position: relative;
  display: block;
  height: 16px;
  border-radius: 4px;
  overflow: visible;
}

.pr-pipe-row__hatch {
  /* Tinted for the PIPE well (compute-load). Card hatch stays the summary-cards #2a2a2a/#1f1f1f pair. */
  position: absolute;
  inset: 0;
  border-radius: 4px;
  background-image: repeating-linear-gradient(
    -45deg,
    color-mix(in srgb, var(--pr-pipe) 8%, #202020) 0 2px,
    color-mix(in srgb, var(--pr-pipe) 8%, #303030) 2px 4px
  );
}

.pr-pipe-row__bar {
  position: relative;
  z-index: 1;
  display: block;
  height: 100%;
  border-radius: 4px;
  min-width: 0;
  box-sizing: border-box;
  background: var(--pr-pipe);
}

.pr-pipe-row__grid {
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: 4px;
  pointer-events: none;
  background-image:
    linear-gradient(
      to right,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0.15)
    ),
    linear-gradient(
      to right,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0.15)
    ),
    linear-gradient(
      to right,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0.15)
    ),
    linear-gradient(
      to right,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0.15)
    );
  background-size: 1px 100%;
  background-position: 20% 0, 40% 0, 60% 0, 80% 0;
  background-repeat: no-repeat;
}

.pr-pipe-row__abs {
  position: absolute;
  left: 6px;
  top: 50%;
  z-index: 3;
  transform: translateY(-50%);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #ffffff;
  white-space: nowrap;
  line-height: 1;
  pointer-events: none;
}

.pr-pipe-row__pct {
  position: absolute;
  right: 6px;
  top: 50%;
  z-index: 3;
  transform: translateY(-50%);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: #ffffff;
  pointer-events: none;
}
</style>
