<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { t, type MessageKey } from '../../../i18n';
import type {
  MemoryHeatmapModel,
  MemoryHeatmapUnit,
  MemoryHeatmapUnitId,
} from '../../../domain/types';
import { HEATMAP_COLUMNS, HEATMAP_ROWS } from '../../../adapters/emulateMemoryHeatmap';

/**
 * biprof §11.2.3.2 Memory Utilization Heatmap panel — the right column of the topology 全屏
 * overlay. Presentational: the host owns `selectedUnit` and the tab/diagram selection, so the
 * panel keeps no state of its own.
 * @see docs/views/memory-topology.md § Memory Utilization Heatmap
 */

/** The frame's tab set, in its own order (`L2Cache | L1 | UB | L0A | L0B | L0C`). */
const TABS: MemoryHeatmapUnitId[] = ['l2', 'l1', 'ub', 'l0a', 'l0b', 'l0c'];

/** Tab / body title per unit — the frame's own words, English in both locales. */
const UNIT_LABEL_KEY: Record<MemoryHeatmapUnitId, MessageKey> = {
  l2: 'memoryHeatUnitL2',
  l1: 'memoryHeatUnitL1',
  ub: 'memoryHeatUnitUb',
  l0a: 'memoryHeatUnitL0a',
  l0b: 'memoryHeatUnitL0b',
  l0c: 'memoryHeatUnitL0c',
};

/**
 * The same six units in the **diagram's** words (`AIC L1`, `AIV × 2 UB`): the frame repeats the
 * selected unit's name under the grid (Visual), where the strip's short tab label will not do.
 */
const UNIT_NAME_KEY: Record<MemoryHeatmapUnitId, MessageKey> = {
  l2: 'memoryHeatUnitNameL2',
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

const units = computed(() => props.model?.units ?? []);

const byId = computed(() => new Map(units.value.map((u) => [u.id, u])));

/** Tab the host names. A unit the model has no source for has no entry, and its body blanks. */
const activeUnit = computed<MemoryHeatmapUnit | null>(() =>
  props.selectedUnit ? (byId.value.get(props.selectedUnit) ?? null) : null,
);

const withDataCount = computed(
  () => activeUnit.value?.blocks.filter((b) => b.state === 'withData').length ?? 0,
);

function unitLabel(id: MemoryHeatmapUnitId): string {
  return t(UNIT_LABEL_KEY[id], props.locale);
}

/** The selected unit in the diagram's own words — drawn under the grid, not above it (Visual). */
const unitName = computed(() =>
  props.selectedUnit ? t(UNIT_NAME_KEY[props.selectedUnit], props.locale) : '',
);

/** The grid is one `role="img"`, so its content is summarised for the a11y tree instead of read cell by cell. */
const gridLabel = computed(() =>
  t('memoryHeatGridLabel', props.locale)
    .replace('{used}', String(withDataCount.value))
    .replace('{total}', String(activeUnit.value?.blocks.length ?? 0)),
);

/** `已用指令条数 300,090` — the frame groups thousands; done by hand so the label does not follow the host ICU. */
const metricLabel = computed(() => {
  const count = activeUnit.value?.usedInstructionCount;
  if (count == null) return '';
  return t('memoryHeatUsedInstr', props.locale).replace(
    '{n}',
    String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
  );
});

/**
 * Roving tabindex (PR-HEAT-009): the strip is a real `tablist`, so Arrow / Home / End move the
 * selection and the focus together. The selection itself still belongs to the host — the panel
 * emits and only moves the focus, so a host that ignores the emit cannot desync the two.
 */
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
  // Or the strip scrolls horizontally under the pointer while the selection moves.
  e.preventDefault();
  emit('select-unit', target);
  void nextTick(() =>
    tabsEl.value
      ?.querySelector<HTMLButtonElement>(`[data-testid="heat-tab-${target}"]`)
      ?.focus(),
  );
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

    <!-- One tabpanel for the whole strip: the six tabs share a body, so the panel is named by
         whichever tab is active rather than wrapping 416 hidden cells per unit. -->
    <div
      class="pr-heat__body"
      data-testid="heat-body"
      role="tabpanel"
      :aria-labelledby="selectedUnit ? `heat-tab-${selectedUnit}` : undefined"
    >
      <template v-if="activeUnit">
        <!-- Centres the grid; cell size comes from the body's container queries (PR-HEAT-011). -->
        <div class="pr-heat__lattice" data-testid="heat-lattice">
          <div
            class="pr-heat__grid"
            :style="{ '--pr-heat-cols': HEATMAP_COLUMNS, '--pr-heat-rows': HEATMAP_ROWS }"
            data-testid="heat-grid"
            role="img"
            :aria-label="gridLabel"
          >
            <span
              v-for="block in activeUnit.blocks"
              :key="block.index"
              class="pr-heat__cell"
              :class="{ 'pr-heat__cell--with': block.state === 'withData' }"
              :data-state="block.state"
            />
          </div>
        </div>
        <!-- The frame's own order under the grid: the selected unit's name, then the caption. -->
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
/* Dark-only chrome — the *only* grey card in the fullscreen overlay (diagram side stays on the
 * deep `#1a1a1a` surface; see ProfilingReport `.pr-topo-fs`). */
.pr-heat {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 12px;
  background: #262626;
  color: #fff;
  font-size: 12px;
  overflow: hidden;
}

.pr-heat__tabs {
  display: flex;
  flex: none;
  /* 6px between the buttons keeps the label-to-label ink at ~26px, the frame's own rhythm (Visual). */
  gap: 6px;
  /* The frame's indicator floats ~12px above the rule rather than sitting on it (Visual; 50px÷4). */
  padding-bottom: 12px;
  border-bottom: 1px solid #333333;
  /* The six labels fill the content box to the pixel, so the strip must never shrink or wrap them:
   * a host font a hair wider would otherwise wrap a label and change the strip's height. Tabs keep
   * their own width and the strip scrolls instead (invisible while they fit, as they do today). */
  overflow-x: auto;
}

.pr-heat__tab {
  position: relative;
  flex: none;
  white-space: nowrap;
  /* 12px under the label is the frame's gap from the label to its indicator (Visual). The side
   * padding is 10px so a short label like `L1` still clears a 24px target. */
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

/* Selected tab = the diagram's selected unit (MemoryTopologyPanel PR-MEMTOP-022). The frame's
 * indicator is a short white bar under the label — narrower than the tab, so it cannot be the tab's
 * own border: the label plus 4px, which is the frame's ~1.3x label ratio. */
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
  /* The frame's own rhythm around the legend: 47.5px from the strip's rule down to the swatch and
   * 28px from the swatch to the grid, i.e. ~44px / ~24px of padding around the label's line box.
   * The legend is the block that sits directly above the grid — the frame has no unit title here. */
  padding: 44px 0 24px;
}

.pr-heat__legend-label {
  color: #b3b3b3;
}

.pr-heat__legend-label + .pr-heat__swatch {
  margin-left: 12px;
}

.pr-heat__swatch {
  /* The frame's swatch is 32px at 4×, i.e. 8px in the frame's own 12px type (Visual). */
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

/* Body is the size container: cqh covers lattice + title + metric, so the grid can shrink for a
 * short column while legend→grid stays the legend's own 24px (≈28px to the swatch) and spare
 * height falls *below* the metric — not between the legend and the map (PR-HEAT-011). */
.pr-heat__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  gap: 0;
  overflow: hidden;
  container-type: size;
  /* Title (31+22) + metric (13+15) — line-heights below lock those used boxes. ponytail: fixed
   * budget; if title/metric chrome grows past this, height-fit can clip — derive from measured
   * footer or switch to a nested 1fr grid-slot. */
  --pr-heat-footer: 81px;
}

/* Wraps the grid only; does not flex-grow, so it cannot open a legend→map gap. */
.pr-heat__lattice {
  flex: none;
  display: flex;
  justify-content: center;
  width: 100%;
  min-width: 0;
}

/* The frame repeats the selected unit's own name under the grid (`AIC L1`, its diagram words), then
 * the `已用指令条数` caption under that — neither sits above the lattice (Visual). */
.pr-heat__title {
  flex: none;
  /* Sketch: 122px under the grid at 4× → 30.5px (Visual). */
  margin: 31px 0 0;
  color: #e7e7e7;
  font-size: 19px;
  font-weight: 600;
  line-height: 22px;
  text-align: center;
}

/* The frame's `已用指令条数` caption sits *under* the grid, centred — not above it (Visual). */
.pr-heat__metric {
  flex: none;
  margin: 13px 0 0;
  color: #b3b3b3;
  font-size: 12px;
  line-height: 15px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* 16 × 26 carrier shape. Cell size = min(width-fit, height-fit) so the lattice never overflows the
 * column and never opens a scrollbar (PR-HEAT-011). Bound from HEATMAP_COLUMNS / HEATMAP_ROWS.
 * `100cq*` is the body (legend is outside), with `--pr-heat-footer` reserved for title + metric. */
.pr-heat__grid {
  --pr-heat-gap: 2px;
  --pr-heat-inset: 2px;
  --pr-heat-border: 2px;
  /* Sketch corner ~20px at 4× → 5px. */
  --pr-heat-radius: 5px;
  --pr-heat-cell: min(
    calc(
      (100cqw - 2 * var(--pr-heat-border) - 2 * var(--pr-heat-inset) -
        (var(--pr-heat-cols) - 1) * var(--pr-heat-gap)) / var(--pr-heat-cols)
    ),
    calc(
      (100cqh - var(--pr-heat-footer) - 2 * var(--pr-heat-border) - 2 * var(--pr-heat-inset) -
        (var(--pr-heat-rows) - 1) * var(--pr-heat-gap)) / var(--pr-heat-rows)
    )
  );
  display: grid;
  box-sizing: border-box;
  width: calc(
    var(--pr-heat-cols) * var(--pr-heat-cell) + (var(--pr-heat-cols) - 1) * var(--pr-heat-gap) +
      2 * var(--pr-heat-inset) + 2 * var(--pr-heat-border)
  );
  height: calc(
    var(--pr-heat-rows) * var(--pr-heat-cell) + (var(--pr-heat-rows) - 1) * var(--pr-heat-gap) +
      2 * var(--pr-heat-inset) + 2 * var(--pr-heat-border)
  );
  grid-template-columns: repeat(var(--pr-heat-cols), var(--pr-heat-cell));
  grid-template-rows: repeat(var(--pr-heat-rows), var(--pr-heat-cell));
  gap: var(--pr-heat-gap);
  padding: var(--pr-heat-inset);
  border: var(--pr-heat-border) solid #6e798d;
  border-radius: var(--pr-heat-radius);
  background: #303f5e;
  /* Clip cells to the rounded frame (v930-sim/memory-topology-fullscreen). */
  overflow: hidden;
  min-height: 0;
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

.pr-heat__empty {
  margin: 0;
  color: #b3b3b3;
}
</style>
