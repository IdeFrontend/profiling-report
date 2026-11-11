<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { t, type MessageKey } from '../../../i18n';
import type {
  MemoryHeatmapModel,
  MemoryHeatmapUnit,
  MemoryHeatmapUnitId,
  MemoryHeatmapView,
} from '../../../domain/types';
import SourcePillSelect from '../../SourceView/SourcePillSelect.vue';

/**
 * biprof §11.2.3.2 Memory Utilization Heatmap panel — the right column of the topology 全屏
 * overlay. The host owns `selectedUnit`; when a unit has multiple views (AIV0/AIV1 UB) the panel
 * keeps the active view index locally (DATA-50).
 * @see docs/views/memory-topology.md § Memory Utilization Heatmap
 */

/** Frame capacity line uses KB/MB when the byte count is an exact binary multiple (0 → `0KB`). */
function formatHeatBytes(n: number): string {
  if (n >= 1024 * 1024 && n % (1024 * 1024) === 0) return `${n / (1024 * 1024)}MB`;
  if (n % 1024 === 0) return `${n / 1024}KB`;
  return `${n}B`;
}

/** Heat tab set, in order (`L1 | UB | L0A | L0B | L0C`) — no L2Cache ([UI-60]). */
const TABS: MemoryHeatmapUnitId[] = ['l1', 'ub', 'l0a', 'l0b', 'l0c'];

/** Tab labels — English in both locales. */
const UNIT_LABEL_KEY: Record<MemoryHeatmapUnitId, MessageKey> = {
  l1: 'memoryHeatUnitL1',
  ub: 'memoryHeatUnitUb',
  l0a: 'memoryHeatUnitL0a',
  l0b: 'memoryHeatUnitL0b',
  l0c: 'memoryHeatUnitL0c',
};

/**
 * Fallback diagram words when a view has no owner (`AIC L1`, `AIV × 2 UB`). Prefer
 * `{ownerName} {memoryName}` when CoreTypes resolved the owner.
 */
const UNIT_NAME_KEY: Record<MemoryHeatmapUnitId, MessageKey> = {
  l1: 'memoryHeatUnitNameL1',
  ub: 'memoryHeatUnitNameUb',
  l0a: 'memoryHeatUnitNameL0a',
  l0b: 'memoryHeatUnitNameL0b',
  l0c: 'memoryHeatUnitNameL0c',
};

const props = withDefaults(
  defineProps<{
    model?: MemoryHeatmapModel | null;
    /** Unit the host has selected — the tab to show and highlight (mirrors the diagram). */
    selectedUnit?: MemoryHeatmapUnitId | null;
    locale?: string;
  }>(),
  { model: null, selectedUnit: null, locale: undefined },
);

const emit = defineEmits<{
  'select-unit': [unit: MemoryHeatmapUnitId];
}>();

const tabsEl = ref<HTMLElement | null>(null);
/** Index into `activeUnit.views` — resets when the host changes tab. */
const viewIndex = ref(0);

const units = computed(() => props.model?.units ?? []);

const byId = computed(() => new Map(units.value.map((u) => [u.id, u])));

/** Tab the host names. A unit the model has no source for has no entry, and its body blanks. */
const activeUnit = computed<MemoryHeatmapUnit | null>(() =>
  props.selectedUnit ? (byId.value.get(props.selectedUnit) ?? null) : null,
);

watch(
  () => props.selectedUnit,
  () => {
    viewIndex.value = 0;
  },
);

watch(activeUnit, (unit) => {
  if (!unit) return;
  if (viewIndex.value >= unit.views.length) viewIndex.value = 0;
});

const activeView = computed<MemoryHeatmapView | null>(() => {
  const unit = activeUnit.value;
  if (!unit?.views.length) return null;
  return unit.views[Math.min(viewIndex.value, unit.views.length - 1)] ?? null;
});

const withDataCount = computed(
  () => activeView.value?.blocks.filter((b) => b.state === 'withData').length ?? 0,
);

function unitLabel(id: MemoryHeatmapUnitId): string {
  return t(UNIT_LABEL_KEY[id], props.locale);
}

function viewOptionLabel(view: MemoryHeatmapView): string {
  if (view.ownerName) return `${view.ownerName} ${view.memoryName}`;
  return view.memoryName;
}

/** Under-grid title: owner + buffer when known, else the diagram's tab words. */
const unitName = computed(() => {
  const view = activeView.value;
  if (!view || !props.selectedUnit) return '';
  if (view.ownerName) return `${view.ownerName} ${view.memoryName}`;
  return t(UNIT_NAME_KEY[props.selectedUnit], props.locale);
});

const gridLabel = computed(() =>
  t('memoryHeatGridLabel', props.locale)
    .replace('{used}', String(withDataCount.value))
    .replace('{total}', String(activeView.value?.blocks.length ?? 0)),
);

/**
 * Capacity caption (DATA-51). Omit when Total is unknown; never put an instruction count here.
 */
const metricLabel = computed(() => {
  const view = activeView.value;
  if (!view) return '';
  if (view.totalBytes != null && view.usedBytes != null && view.freeBytes != null) {
    return t('memoryHeatCapacity', props.locale)
      .replace('{total}', formatHeatBytes(view.totalBytes))
      .replace('{used}', formatHeatBytes(view.usedBytes))
      .replace('{free}', formatHeatBytes(view.freeBytes));
  }
  return '';
});

const gridColumns = computed(() => activeView.value?.columns ?? 1);
const gridRows = computed(() => activeView.value?.rows ?? 1);

function onTabsKeydown(e: KeyboardEvent) {
  const at = TABS.indexOf(props.selectedUnit ?? TABS[0]);
  const target =
    e.key === 'ArrowRight'
      ? TABS[(at + 1) % TABS.length]
      : e.key === 'ArrowLeft'
        ? TABS[(at - 1 + TABS.length) % TABS.length]
        : e.key === 'Home'
          ? TABS[0]
          : e.key === 'End'
            ? TABS[TABS.length - 1]
            : null;
  if (target == null) return;
  e.preventDefault();
  emit('select-unit', target);
  void nextTick(() =>
    tabsEl.value
      ?.querySelector<HTMLButtonElement>(`[data-testid="heat-tab-${target}"]`)
      ?.focus(),
  );
}

const viewSelectOptions = computed(() =>
  (activeUnit.value?.views ?? []).map((view, i) => ({
    id: String(i),
    label: viewOptionLabel(view),
  })),
);

const viewSelectValue = computed(() => String(viewIndex.value));

function onViewSelect(id: string) {
  const value = Number(id);
  if (Number.isFinite(value)) viewIndex.value = value;
}
</script>

<template>
  <section
    v-if="units.length > 0"
    class="pr-heat"
    data-testid="memory-heatmap-panel"
    role="region"
    :aria-label="t('memoryAnalysis', locale)"
  >
    <div
      ref="tabsEl"
      class="pr-heat__tabs"
      role="tablist"
      data-testid="heat-tabs"
      @keydown="onTabsKeydown"
    >
      <button
        v-for="id in TABS"
        :id="`heat-tab-${id}`"
        :key="id"
        type="button"
        role="tab"
        class="pr-heat__tab"
        :class="{ 'pr-heat__tab--active': id === selectedUnit }"
        :data-testid="`heat-tab-${id}`"
        :aria-selected="id === selectedUnit"
        :tabindex="id === (selectedUnit ?? TABS[0]) ? 0 : -1"
        @click="emit('select-unit', id)"
      >
        {{ unitLabel(id) }}
      </button>
    </div>

    <div class="pr-heat__legend">
      <span
        class="pr-heat__swatch pr-heat__swatch--with"
        aria-hidden="true"
      />
      <span class="pr-heat__legend-label">{{ t('memoryHeatWithData', locale) }}</span>
      <span
        class="pr-heat__swatch pr-heat__swatch--without"
        aria-hidden="true"
      />
      <span class="pr-heat__legend-label">{{ t('memoryHeatWithoutData', locale) }}</span>
    </div>

    <!--
      Always reserve this band so multi-view UB does not shrink the lattice vs other tabs.
      Outside the body size container so the lattice cannot clip the pill (PR-HEAT-011).
    -->
    <div
      class="pr-heat__view-bar"
      data-testid="heat-view-bar"
      :data-empty="!(activeUnit && activeUnit.views.length > 1) || undefined"
    >
      <SourcePillSelect
        v-if="activeUnit && activeUnit.views.length > 1"
        :caption="t('memoryHeatView', locale)"
        :model-value="viewSelectValue"
        :options="viewSelectOptions"
        test-id="heat-view-select"
        @update:model-value="onViewSelect"
      />
    </div>

    <!-- Outside the body so the badge cannot steal lattice height (PR-HEAT-011 / DATA-50). -->
    <p
      v-if="activeView?.outsideDeclared"
      class="pr-heat__outside"
      data-testid="heat-outside"
    >
      {{ t('memoryHeatOutsideDeclared', locale) }}
    </p>

    <div
      class="pr-heat__body"
      data-testid="heat-body"
      role="tabpanel"
      :aria-labelledby="selectedUnit ? `heat-tab-${selectedUnit}` : undefined"
    >
      <template v-if="activeView">
        <div
          class="pr-heat__lattice"
          data-testid="heat-lattice"
        >
          <div
            class="pr-heat__grid"
            :style="{ '--pr-heat-cols': gridColumns, '--pr-heat-rows': gridRows }"
            data-testid="heat-grid"
            role="img"
            :aria-label="gridLabel"
          >
            <span
              v-for="block in activeView.blocks"
              :key="block.index"
              class="pr-heat__cell"
              :class="{ 'pr-heat__cell--with': block.state === 'withData' }"
              :data-state="block.state"
            />
          </div>
        </div>
        <p
          v-if="unitName"
          class="pr-heat__title"
          data-testid="heat-unit-name"
        >
          {{ unitName }}
        </p>
        <p
          v-if="metricLabel"
          class="pr-heat__metric"
          data-testid="heat-metric"
        >
          {{ metricLabel }}
        </p>
      </template>

      <p
        v-else
        class="pr-heat__empty"
        data-testid="heat-empty"
      >
        {{ t('memoryHeatEmpty', locale) }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.pr-heat {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 12px;
  background: #262626;
  border-radius: 8px;
  color: #fff;
  font-size: 12px;
  overflow: hidden;
}

.pr-heat__tabs {
  display: flex;
  flex: none;
  gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid #333333;
  overflow-x: auto;
}

.pr-heat__tab {
  position: relative;
  flex: none;
  white-space: nowrap;
  padding: 6px 10px 12px;
  border: none;
  background: none;
  color: #b3b3b3;
  font: inherit;
  cursor: pointer;
}

.pr-heat__tab:hover {
  color: #fff;
}

.pr-heat__tab--active {
  color: #fff;
}

.pr-heat__tab--active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  width: calc(100% - 16px);
  height: 2px;
  border-radius: 1px;
  background: #ffffff;
  transform: translateX(-50%);
}

.pr-heat__legend {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 8px;
  /* 12px bottom: view-bar band is always reserved below. */
  padding: 44px 0 12px;
}

.pr-heat__legend-label {
  color: #b3b3b3;
}

.pr-heat__legend-label + .pr-heat__swatch {
  margin-left: 12px;
}

.pr-heat__swatch {
  width: 8px;
  height: 8px;
  border-radius: 1px;
}

.pr-heat__swatch--with {
  background: #3d64ad;
}

.pr-heat__swatch--without {
  background: #afc6fe;
}

.pr-heat__view-bar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  /* Match SourcePillSelect closed height so empty tabs keep the same lattice. */
  min-height: var(--pr-src-control-h, 28px);
  margin: 0 0 12px;
}

.pr-heat__outside {
  flex: none;
  margin: 0 0 8px;
  color: #e6a23c;
  font-size: 12px;
  line-height: 15px;
  text-align: center;
}

.pr-heat__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: stretch;
  min-height: 0;
  overflow: hidden;
  container-type: size;
}

.pr-heat__lattice {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.pr-heat__grid {
  --pr-heat-cols: 16;
  --pr-heat-rows: 26;
  --pr-heat-footer: 81px;
  /* 8px = 2px padding×2 + 2px border×2 — height must match width or the frame clips. */
  --pr-heat-cell: min(
    calc((100cqw - 8px) / var(--pr-heat-cols) - 2px),
    calc((100cqh - var(--pr-heat-footer) - 8px) / var(--pr-heat-rows) - 2px)
  );
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(var(--pr-heat-cols), var(--pr-heat-cell));
  grid-template-rows: repeat(var(--pr-heat-rows), var(--pr-heat-cell));
  gap: 2px;
  padding: 2px;
  border: 2px solid #6e798d;
  border-radius: 5px;
  background: #303f5e;
  overflow: hidden;
}

.pr-heat__cell {
  width: var(--pr-heat-cell);
  height: var(--pr-heat-cell);
  border-radius: 1px;
  background: #afc6fe;
}

.pr-heat__cell--with {
  background: #3d64ad;
}

.pr-heat__title {
  flex: none;
  margin: 31px 0 0;
  color: #e7e7e7;
  font-size: 19px;
  font-weight: 600;
  line-height: 22px;
  text-align: center;
}

.pr-heat__metric {
  flex: none;
  margin: 13px 0 0;
  color: #b3b3b3;
  font-size: 12px;
  line-height: 15px;
  text-align: center;
}

.pr-heat__empty {
  margin: auto;
  color: #b3b3b3;
  text-align: center;
}
</style>
