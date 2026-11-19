<script setup lang="ts">
import { computed, nextTick, ref, watch, type CSSProperties } from 'vue';
import { t, type MessageKey } from '../../../i18n';
import type {
  MemoryHeatmapBlock,
  MemoryHeatmapModel,
  MemoryHeatmapUnit,
  MemoryHeatmapUnitId,
  MemoryHeatmapView,
} from '../../../domain/types';
import SourcePillSelect from '../../SourceView/SourcePillSelect.vue';
import {
  FIXED_TIP_OFFSET_PX,
  placeFixedTip,
} from '../../placeFixedTip';
import {
  HEAT_GRID_GAP_PX,
  HEAT_GRID_PAD_PX,
  hitTestHeatCell,
} from './heatHitTest';

/**
 * biprof §11.2.3.2 Memory Utilization Heatmap panel — the right column of the topology 全屏
 * overlay. The host owns `selectedUnit`; when a unit has multiple views (AIV0/AIV1 UB) the panel
 * keeps the active view index locally (DATA-50).
 * @see docs/views/memory-topology.md § Memory Utilization Heatmap
 */

/** SA tip size estimate for flip/clamp (three label|value rows). */
const HEAT_CELL_TIP_EST_W = 220;
const HEAT_CELL_TIP_EST_H = 88;

/** Legend labels under the strip — only the ends + midpoint (readable; not every 10%). */
const LEGEND_TICKS = [0, 50, 100] as const;

/** Dense stops so the HSL ramp stays continuous even with sparse tick labels. */
const LEGEND_STOPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

/**
 * SA Memory Utilization fill: gray at 0, then green→yellow→red as pct rises.
 * `pct = intensity * 100` where intensity is (Read+Write)/viewMax.
 */
function heatFill(intensity: number): string {
  const pct = Math.min(1, Math.max(0, intensity)) * 100;
  if (pct < 1e-4) return 'hsl(100, 0%, 75%)';
  return `hsl(${100 - pct}, 100%, 40%)`;
}

/** Continuous legend strip stops matching `heatFill` at each 10% stop. */
const LEGEND_GRADIENT = (() => {
  const stops = LEGEND_STOPS.map((pct) => {
    const color =
      pct < 1e-4 ? 'hsl(100, 0%, 75%)' : `hsl(${100 - pct}, 100%, 40%)`;
    return `${color} ${pct}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
})();

/** Thousands grouped by hand — same as the BiProf/SA sample (`300,090`), not host ICU. */
function formatAccessCount(n: number): string {
  return String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** SA tip: `0x` + lowercase hex (no forced pad). */
function formatStartAddress(baseAddress: number, index: number, cellSize: number): string {
  const addr = Math.max(0, Math.floor(baseAddress + index * cellSize));
  return `0x${addr.toString(16)}`;
}

/** Shared capacity unit for Total/Used/Free (#201) — pick from Total so the three values match. */
type HeatByteUnit = 'B' | 'KB' | 'MB';

function capacityUnit(totalBytes: number): HeatByteUnit {
  if (totalBytes >= 1024 * 1024) return 'MB';
  if (totalBytes >= 1024) return 'KB';
  return 'B';
}

/** Frame capacity line: space before unit (`256 KB`); same unit for Total/Used/Free (#201). */
function formatHeatBytes(n: number, unit: HeatByteUnit): string {
  const raw = unit === 'MB' ? n / (1024 * 1024) : unit === 'KB' ? n / 1024 : n;
  const text = Number.isInteger(raw) ? String(raw) : String(Math.round(raw * 100) / 100);
  return `${text} ${unit}`;
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

/** Distinct pack `coreId`s — Core prefix only when more than one (#198 / single-core packs stay plain). */
const isMultiCore = computed(() => {
  const ids = new Set<number>();
  for (const unit of units.value) {
    for (const view of unit.views) ids.add(view.coreId);
  }
  return ids.size > 1;
});

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

/** View label: owner + buffer; multi-core packs prepend pack `coreId` (#198) — never invent one. */
function viewOptionLabel(view: MemoryHeatmapView): string {
  const base = view.ownerName ? `${view.ownerName} ${view.memoryName}` : view.memoryName;
  return isMultiCore.value ? `Core ${view.coreId} · ${base}` : base;
}

/**
 * Under-grid title: same as the view option label when the owner is known, or on multi-core
 * packs even without an owner (`Core N · UB`). Diagram tab words only for single-core, no-owner.
 */
const unitName = computed(() => {
  const view = activeView.value;
  if (!view || !props.selectedUnit) return '';
  if (view.ownerName || isMultiCore.value) return viewOptionLabel(view);
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
    const unit = capacityUnit(view.totalBytes);
    return t('memoryHeatCapacity', props.locale)
      .replace('{total}', formatHeatBytes(view.totalBytes, unit))
      .replace('{used}', formatHeatBytes(view.usedBytes, unit))
      .replace('{free}', formatHeatBytes(view.freeBytes, unit));
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

/**
 * SA heat-cell tip (#194) — swimlane-style: one grid pointermove + geometry hit-test,
 * same-index early return (chase tip xy only), single overlay ring (no per-cell layout grow).
 */
const gridEl = ref<HTMLElement | null>(null);

/** Tip content — rebuilt only when the hovered block changes. */
const tipContent = ref<{
  blockIndex: number;
  startAddress: string;
  cellSize: number;
  accessCount: number;
} | null>(null);

/** Tip chase coords — separate so same-cell moves do not rewrite tip rows. */
const tipPointer = ref({ x: 0, y: 0 });

const hoveredBlockIndex = ref<number | null>(null);

const hoverOverlayStyle = computed<CSSProperties>(() => {
  const index = hoveredBlockIndex.value;
  const view = activeView.value;
  if (index == null || !view) return { display: 'none' };
  const col = index % view.columns;
  const row = Math.floor(index / view.columns);
  return {
    left: `calc(${HEAT_GRID_PAD_PX}px + ${col} * (var(--pr-heat-cell) + ${HEAT_GRID_GAP_PX}px))`,
    top: `calc(${HEAT_GRID_PAD_PX}px + ${row} * (var(--pr-heat-cell) + ${HEAT_GRID_GAP_PX}px))`,
  };
});

const cellTipStyle = computed<CSSProperties>(() => {
  if (!tipContent.value) {
    return { position: 'fixed', left: '0px', top: '0px', right: 'auto', bottom: 'auto' };
  }
  // Flipped axes use right/bottom so the pointer gap stays FIXED_TIP_OFFSET_PX even when
  // HEAT_CELL_TIP_EST_* overshoots the painted tip (left = x - offset - tipW did not).
  const pos = placeFixedTip({
    x: tipPointer.value.x,
    y: tipPointer.value.y,
    tipW: HEAT_CELL_TIP_EST_W,
    tipH: HEAT_CELL_TIP_EST_H,
    viewportW: typeof window !== 'undefined' ? window.innerWidth : 1024,
    viewportH: typeof window !== 'undefined' ? window.innerHeight : 768,
    offset: FIXED_TIP_OFFSET_PX,
  });
  return {
    position: 'fixed',
    zIndex: 1000,
    left: pos.left == null ? 'auto' : `${pos.left}px`,
    right: pos.right == null ? 'auto' : `${pos.right}px`,
    top: pos.top == null ? 'auto' : `${pos.top}px`,
    bottom: pos.bottom == null ? 'auto' : `${pos.bottom}px`,
  };
});

function applyHoverBlock(block: MemoryHeatmapBlock, clientX: number, clientY: number) {
  const view = activeView.value;
  if (!view) return;
  tipPointer.value = { x: clientX, y: clientY };
  if (hoveredBlockIndex.value === block.index && tipContent.value?.blockIndex === block.index) {
    return;
  }
  hoveredBlockIndex.value = block.index;
  tipContent.value = {
    blockIndex: block.index,
    startAddress: formatStartAddress(view.baseAddress, block.index, view.cellSize),
    cellSize: view.cellSize,
    accessCount: block.accessCount,
  };
}

/**
 * Continuous hover like swimlane: hit-test every move; seams keep the left/top cell;
 * null hit inside the grid chrome stays sticky until leave.
 */
function onGridPointerMove(e: PointerEvent) {
  const view = activeView.value;
  const el = gridEl.value;
  if (!view || !el) return;
  const hit = hitTestHeatCell(e.clientX, e.clientY, el.getBoundingClientRect(), {
    columns: view.columns,
    rows: view.rows,
    blockCount: view.blocks.length,
  });
  if (hit == null) {
    // Padding/border ring: chase tip if we already have a cell; else ignore.
    if (tipContent.value) tipPointer.value = { x: e.clientX, y: e.clientY };
    return;
  }
  const block = view.blocks[hit];
  if (!block) return;
  applyHoverBlock(block, e.clientX, e.clientY);
}

function clearCellTip() {
  tipContent.value = null;
  hoveredBlockIndex.value = null;
}

watch(activeView, () => {
  clearCellTip();
});
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

    <div class="pr-heat__legend" data-testid="heat-legend">
      <div class="pr-heat__legend-scale">
        <p
          class="pr-heat__legend-title"
          data-testid="heat-legend-title"
        >
          {{ t('memoryHeatAccessCount', locale) }}
        </p>
        <div
          class="pr-heat__gradient"
          data-testid="heat-legend-gradient"
          aria-hidden="true"
          :style="{ background: LEGEND_GRADIENT }"
        />
        <div class="pr-heat__legend-ticks" data-testid="heat-legend-ticks">
          <span
            v-for="pct in LEGEND_TICKS"
            :key="pct"
            class="pr-heat__legend-tick"
            :data-pct="String(pct)"
          >{{ pct }}%</span>
        </div>
      </div>
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
            ref="gridEl"
            class="pr-heat__grid"
            :style="{ '--pr-heat-cols': gridColumns, '--pr-heat-rows': gridRows }"
            data-testid="heat-grid"
            role="img"
            :aria-label="gridLabel"
            @pointermove="onGridPointerMove"
            @pointerleave="clearCellTip"
          >
            <span
              v-for="block in activeView.blocks"
              :key="block.index"
              class="pr-heat__cell"
              :class="{ 'pr-heat__cell--with': block.state === 'withData' }"
              :data-state="block.state"
              :data-intensity="String(block.intensity)"
              :data-access-count="String(block.accessCount)"
              :style="{ background: heatFill(block.intensity) }"
            />
            <!-- Single overlay ring — no per-cell class / layout grow (swimlane-style). -->
            <div
              v-if="hoveredBlockIndex != null"
              class="pr-heat__hover"
              data-testid="heat-cell-hover"
              aria-hidden="true"
              :style="hoverOverlayStyle"
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

    <!--
      SA Memory Utilization cell tip (#194): Start Address, Cell Size, Accesses Count.
      Teleport→body + placeFixedTip so the panel cannot crop it.
    -->
    <Teleport to="body">
      <div
        v-if="tipContent"
        class="pr-tooltip pr-heat-cell-tip"
        data-testid="heat-cell-tooltip"
        :style="cellTipStyle"
      >
        <div
          class="pr-heat-cell-tip__row"
          data-testid="heat-cell-tip-address"
        >
          <span class="pr-heat-cell-tip__label">{{ t('memoryHeatStartAddress', locale) }}</span>
          <span
            class="pr-heat-cell-tip__value"
            data-testid="heat-cell-tip-address-value"
          >{{ tipContent.startAddress }}</span>
        </div>
        <div
          class="pr-heat-cell-tip__row"
          data-testid="heat-cell-tip-cell-size"
        >
          <span class="pr-heat-cell-tip__label">{{ t('memoryHeatCellSize', locale) }}</span>
          <span
            class="pr-heat-cell-tip__value"
            data-testid="heat-cell-tip-cell-size-value"
          >{{ tipContent.cellSize }} {{ t('memoryHeatBytes', locale) }}</span>
        </div>
        <div
          class="pr-heat-cell-tip__row"
          data-testid="heat-cell-tip-accesses"
        >
          <span class="pr-heat-cell-tip__label">{{ t('memoryHeatAccessesCount', locale) }}</span>
          <span
            class="pr-heat-cell-tip__value"
            data-testid="heat-cell-tip-accesses-value"
          >{{ formatAccessCount(tipContent.accessCount) }}</span>
        </div>
      </div>
    </Teleport>
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
  /* 12px bottom: view-bar band is always reserved below. */
  padding: 44px 0 12px;
}

.pr-heat__legend-scale {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: min(100%, 220px);
}

.pr-heat__legend-title {
  margin: 0;
  color: #b3b3b3;
  font-size: 12px;
  line-height: 1;
  font-weight: 600;
  text-align: center;
}

.pr-heat__gradient {
  width: 100%;
  height: 8px;
  border-radius: 1px;
}

.pr-heat__legend-ticks {
  display: flex;
  justify-content: space-between;
  color: #b3b3b3;
  font-size: 10px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.pr-heat__legend-tick {
  flex: none;
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
  position: relative;
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
  position: relative;
  width: var(--pr-heat-cell);
  height: var(--pr-heat-cell);
  border-radius: 1px;
  /* Fill comes from inline `heatFill(intensity)` (#200). */
  cursor: default;
  box-sizing: border-box;
  /* Hits go to the grid — continuous geometry hit-test owns hover. */
  pointer-events: none;
}

.pr-heat__hover {
  position: absolute;
  z-index: 2;
  width: var(--pr-heat-cell);
  height: var(--pr-heat-cell);
  border-radius: 1px;
  box-sizing: border-box;
  pointer-events: none;
  /* Light ring reads on both gray (0%) and red (100%) fills. */
  box-shadow: inset 0 0 0 1.5px #ffffff;
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

<!--
  Unscoped: Teleport → body (CounterHoverTip / OverviewCharts pattern). Scoped
  selectors can fail to paint position/color on the teleported node.
-->
<style>
.pr-heat-cell-tip.pr-tooltip {
  position: fixed;
  z-index: 1000;
  pointer-events: none;
  box-sizing: border-box;
  padding: 8px 10px;
  background: var(--pr-surface-raised, #363636);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
  color: #b3b3b3;
  font-size: 12px;
  line-height: 1.45;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  /* No enter fade — cell switches must feel instant (swimlane EventTooltip). */
}

.pr-heat-cell-tip__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.pr-heat-cell-tip__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: #e8e8e8;
}

.pr-heat-cell-tip__value {
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: #e8e8e8;
}
</style>
