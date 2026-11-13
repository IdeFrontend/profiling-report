<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, toRaw, useId, watch } from 'vue';
import type { ReportOperatorRow } from '../../domain/types';
import { t, type MessageKey } from '../../i18n';
import FilterIcon from '../FilterIcon.vue';
import SortIcon from '../SortIcon.vue';
import { shortOperatorName } from '../operatorName';

const props = withDefaults(
  defineProps<{
    /** One row per `OpBasicInfo.csv` row across the operator pack. */
    rows?: ReportOperatorRow[];
    locale?: string;
  }>(),
  {
    rows: () => [],
    locale: undefined,
  },
);

const emit = defineEmits<{ optimize: [{ opName: string }] }>();

/** Sample dock metric: the report does not compute a speedup yet. */
const DEMO_SPEEDUP = '88.69%';

type FilterKey = 'opName' | 'opType';
type SortableKey =
  | 'demangledName'
  | 'taskDurationUs'
  | 'blockDim'
  | 'mixBlockDim'
  | 'gridSize'
  | 'blockSize';

interface Column {
  key: keyof ReportOperatorRow | 'index';
  labelKey: MessageKey;
  /** Inline width; all rendered columns stay at or below 100%. */
  width: string;
}

const baseColumns: Column[] = [
  { key: 'index', labelKey: 'overviewColumnIndex', width: '8%' },
  { key: 'opName', labelKey: 'overviewColumnOpName', width: '18%' },
  { key: 'opType', labelKey: 'overviewColumnOpType', width: '9%' },
  { key: 'demangledName', labelKey: 'overviewColumnDemangledName', width: '20%' },
  { key: 'taskDurationUs', labelKey: 'overviewColumnTaskDuration', width: '11%' },
  { key: 'blockDim', labelKey: 'overviewColumnBlockDim', width: '9%' },
  { key: 'mixBlockDim', labelKey: 'overviewColumnMixBlockDim', width: '8%' },
  { key: 'gridSize', labelKey: 'overviewColumnGridSize', width: '9%' },
  { key: 'blockSize', labelKey: 'overviewColumnBlockSize', width: '8%' },
];

function isFilterKey(key: Column['key']): key is FilterKey {
  return key === 'opName' || key === 'opType';
}

function isSortableKey(key: Column['key']): key is SortableKey {
  return key === 'demangledName' || key === 'taskDurationUs' || key === 'blockDim'
    || key === 'mixBlockDim' || key === 'gridSize' || key === 'blockSize';
}

function isFilterColumn(col: Column): boolean {
  return isFilterKey(col.key);
}

function isSortable(col: Column): boolean {
  return isSortableKey(col.key);
}

function isNumericColumn(col: Column): boolean {
  return col.key === 'taskDurationUs' || col.key === 'blockDim' || col.key === 'mixBlockDim'
    || col.key === 'gridSize' || col.key === 'blockSize';
}

/** Active multi-select filter values per text column; empty means no filter. */
const filterValues = ref<Record<FilterKey, string[]>>({ opName: [], opType: [] });
const openFilter = ref<FilterKey | null>(null);
const filterAnchor = ref({ left: 0, top: 0 });
const sortKey = ref<SortableKey | null>(null);
const sortDirection = ref<'asc' | 'desc' | null>(null);
const popoverRef = ref<HTMLElement | null>(null);
const filterTrigger = ref<HTMLElement | null>(null);
const filterPopoverId = useId();

function distinctValues(key: FilterKey): string[] {
  const values = new Set<string>();
  for (const row of props.rows) {
    const value = row[key];
    if (value) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

const filterOptions = computed<Record<FilterKey, string[]>>(() => ({
  opName: distinctValues('opName'),
  opType: distinctValues('opType'),
}));

function filterValuesFor(col: Column | null): string[] {
  return col != null && isFilterKey(col.key) ? filterValues.value[col.key] : [];
}

function filterOptionsFor(col: Column | null): string[] {
  return col != null && isFilterKey(col.key) ? filterOptions.value[col.key] : [];
}

function filterCount(col: Column | null): number {
  return filterValuesFor(col).length;
}

function filterLabel(col: Column): string {
  return t('overviewFilterFor', props.locale).replace('{name}', t(col.labelKey, props.locale));
}

function sortLabel(col: Column): string {
  return t('overviewSortFor', props.locale).replace('{name}', t(col.labelKey, props.locale));
}

/** Matches the popover box in this file's stylesheet; used only to clamp it. */
const POPOVER_WIDTH = 200;
const POPOVER_MAX_HEIGHT = 240;

/** Keep the fixed popover clamped to the viewport and attached to its funnel. */
function positionFilterPopover() {
  const trigger = filterTrigger.value;
  if (trigger == null) return;
  const rect = trigger.getBoundingClientRect();
  const margin = 8;
  filterAnchor.value = {
    left: Math.max(margin, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - margin)),
    top: Math.max(
      margin,
      Math.min(rect.bottom + 4, window.innerHeight - POPOVER_MAX_HEIGHT - margin),
    ),
  };
}

function toggleFilter(col: Column, event: MouseEvent) {
  if (!isFilterKey(col.key)) return;
  if (openFilter.value === col.key) {
    closeFilter();
    return;
  }
  filterTrigger.value = event.currentTarget as HTMLElement | null;
  openFilter.value = col.key;
  positionFilterPopover();
}

function closeFilter(opts?: { restoreFocus?: boolean }) {
  const trigger = filterTrigger.value;
  openFilter.value = null;
  filterTrigger.value = null;
  if (opts?.restoreFocus) void nextTick(() => trigger?.focus());
}

const openFilterColumn = computed<Column | null>(
  () => columns.value.find((col) => col.key === openFilter.value) ?? null,
);

function toggleFilterValue(col: Column | null, value: string) {
  if (col == null || !isFilterKey(col.key)) return;
  const key = col.key;
  const current = filterValues.value[key];
  filterValues.value = {
    ...filterValues.value,
    [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
  };
}

function clearFilter(col: Column | null) {
  if (col == null || !isFilterKey(col.key)) return;
  filterValues.value = { ...filterValues.value, [col.key]: [] };
}

const filteredRows = computed(() =>
  props.rows.filter(
    (row) =>
      (filterValues.value.opName.length === 0
        || (row.opName != null && filterValues.value.opName.includes(row.opName)))
      && (filterValues.value.opType.length === 0
        || (row.opType != null && filterValues.value.opType.includes(row.opType))),
  ),
);

const hasMixBlockDim = computed(() => filteredRows.value.some((row) => row.mixBlockDim != null));

const columns = computed(() =>
  baseColumns.filter((col) => col.key !== 'mixBlockDim' || hasMixBlockDim.value),
);

/** Compare two values with missing values last in both directions. */
function compareValues(a: string | number | undefined, b: string | number | undefined): number {
  const aMissing = a == null || a === '';
  const bMissing = b == null || b === '';
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

const visibleRows = computed(() => {
  if (sortKey.value == null || sortDirection.value == null) return filteredRows.value;
  const key = sortKey.value;
  const direction = sortDirection.value === 'desc' ? -1 : 1;
  return [...filteredRows.value].sort((a, b) => {
    const comparison = compareValues(a[key], b[key]);
    const aMissing = a[key] == null || a[key] === '';
    const bMissing = b[key] == null || b[key] === '';
    return aMissing || bMissing ? comparison : comparison * direction;
  });
});

/** Single-select table state; the first row is selected by default. */
const selectedRow = shallowRef<ReportOperatorRow | null>(
  props.rows[0] != null ? toRaw(props.rows[0]) : null,
);

/** Rows may arrive as raw objects, so compare their raw identity, not proxies. */
function isSelectedRow(row: ReportOperatorRow): boolean {
  return selectedRow.value != null && toRaw(row) === selectedRow.value;
}

watch(
  () => props.rows,
  (rows) => {
    filterValues.value = { opName: [], opType: [] };
    sortKey.value = null;
    sortDirection.value = null;
    closeFilter();
    selectedRow.value = rows[0] != null ? toRaw(rows[0]) : null;
  },
);

watch(visibleRows, (rows) => {
  if (selectedRow.value == null) return;
  if (!rows.some((row) => toRaw(row) === selectedRow.value)) selectedRow.value = null;
});

watch(hasMixBlockDim, (visible) => {
  if (!visible && sortKey.value === 'mixBlockDim') {
    sortKey.value = null;
    sortDirection.value = null;
  }
});

function cycleSort(key: Column['key']) {
  if (!isSortableKey(key)) return;
  if (sortKey.value !== key) {
    sortKey.value = key;
    sortDirection.value = 'asc';
    return;
  }
  if (sortDirection.value === 'asc') sortDirection.value = 'desc';
  else if (sortDirection.value === 'desc') {
    sortKey.value = null;
    sortDirection.value = null;
  } else {
    sortDirection.value = 'asc';
  }
}

function sortDirectionFor(col: Column): 'asc' | 'desc' | null {
  return sortKey.value === col.key ? sortDirection.value : null;
}

function ariaSort(col: Column): 'ascending' | 'descending' | 'none' {
  if (!isSortable(col) || sortKey.value !== col.key || sortDirection.value == null) return 'none';
  return sortDirection.value === 'asc' ? 'ascending' : 'descending';
}

function selectRow(row: ReportOperatorRow | null) {
  if (row != null) selectedRow.value = toRaw(row);
}

/** Host contract: the optimize event carries the highlighted row's raw op name. */
function optimizeSelected() {
  const opName = selectedRow.value?.opName;
  if (opName == null) return;
  emit('optimize', { opName });
}

function onDocumentClick(event: MouseEvent) {
  if (openFilter.value == null) return;
  const target = event.target;
  if (
    target instanceof Element
    && (target.closest('.pr-operator-overview__filter-popover')
      || target.closest('.pr-operator-overview__header-button[aria-haspopup="true"]'))
  ) return;
  closeFilter();
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || openFilter.value == null) return;
  /* Close only the popover: the host also listens for Escape on window. */
  event.stopPropagation();
  closeFilter({ restoreFocus: true });
}

/** A table scroll moves the anchor; any other scroll detaches the fixed popover. */
function onViewportChange(event: Event) {
  if (openFilter.value == null) return;
  if (event.type === 'resize') {
    positionFilterPopover();
    return;
  }
  const target = event.target;
  if (target instanceof Element) {
    if (target.closest('.pr-operator-overview__filter-popover')) return;
    if (target.closest('.pr-operator-overview__table-wrap')) {
      positionFilterPopover();
      return;
    }
  }
  closeFilter();
}

watch(openFilter, async (open) => {
  if (open != null) {
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeydown);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    await nextTick();
    popoverRef.value?.querySelector<HTMLElement>('input[type="checkbox"]')?.focus();
  } else {
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('keydown', onDocumentKeydown);
    window.removeEventListener('scroll', onViewportChange, true);
    window.removeEventListener('resize', onViewportChange);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onDocumentKeydown);
  window.removeEventListener('scroll', onViewportChange, true);
  window.removeEventListener('resize', onViewportChange);
});

function cell(value: string | number | undefined): string {
  return value == null ? '' : String(value);
}

/** Task Duration renders with two decimals; missing stays an empty cell. */
function duration(value: number | undefined): string {
  return value == null ? '' : value.toFixed(2);
}
</script>

<template>
  <section
    class="pr-operator-overview"
    data-testid="operator-overview"
  >
    <div class="pr-operator-overview__table-wrap">
      <table
        class="pr-operator-overview__table"
        role="grid"
      >
        <thead>
          <tr role="row">
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              role="columnheader"
              :aria-sort="isSortable(col) ? ariaSort(col) : undefined"
              :style="{ width: col.width }"
              :class="{ 'pr-operator-overview__header--numeric': isNumericColumn(col) }"
            >
              <button
                v-if="isFilterColumn(col)"
                type="button"
                class="pr-operator-overview__header-button"
                :aria-label="filterLabel(col)"
                aria-haspopup="true"
                :aria-expanded="openFilter === col.key"
                :aria-controls="openFilter === col.key ? filterPopoverId : undefined"
                @click.stop="toggleFilter(col, $event)"
              >
                <span>{{ t(col.labelKey, locale) }}</span>
                <FilterIcon class="pr-operator-overview__sort" />
                <span
                  v-if="filterCount(col) > 0"
                  class="pr-operator-overview__filter-count"
                >{{ filterCount(col) }}</span>
              </button>
              <button
                v-else-if="isSortable(col)"
                type="button"
                class="pr-operator-overview__header-button"
                :aria-label="sortLabel(col)"
                @click="cycleSort(col.key)"
              >
                <span>{{ t(col.labelKey, locale) }}</span>
                <SortIcon
                  :direction="sortDirectionFor(col)"
                  class="pr-operator-overview__sort"
                />
              </button>
              <span v-else>{{ t(col.labelKey, locale) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in visibleRows"
            :key="index"
            class="pr-operator-overview__row"
            :class="{ 'pr-operator-overview__row--selected': isSelectedRow(row) }"
            :aria-selected="isSelectedRow(row)"
            role="row"
            tabindex="0"
            @click="selectRow(row)"
            @keydown.enter.prevent="selectRow(row)"
            @keydown.space.prevent="selectRow(row)"
          >
            <td role="gridcell">
              {{ index + 1 }}
            </td>
            <td role="gridcell">
              {{ cell(shortOperatorName(row.opName)) }}
            </td>
            <td role="gridcell">
              {{ cell(row.opType) }}
            </td>
            <td role="gridcell">
              {{ cell(row.demangledName) }}
            </td>
            <td
              role="gridcell"
              class="pr-operator-overview__cell--numeric"
            >
              {{ duration(row.taskDurationUs) }}
            </td>
            <td
              role="gridcell"
              class="pr-operator-overview__cell--numeric"
            >
              {{ cell(row.blockDim) }}
            </td>
            <td
              v-if="hasMixBlockDim"
              role="gridcell"
              class="pr-operator-overview__cell--numeric"
            >
              {{ cell(row.mixBlockDim) }}
            </td>
            <td
              role="gridcell"
              class="pr-operator-overview__cell--numeric"
            >
              {{ cell(row.gridSize) }}
            </td>
            <td
              role="gridcell"
              class="pr-operator-overview__cell--numeric"
            >
              {{ cell(row.blockSize) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="rows.length > 0"
      class="pr-operator-overview__dock"
      data-testid="operator-overview-dock"
    >
      <div class="pr-operator-overview__utilization">
        <svg
          class="pr-operator-overview__donut"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          />
          <circle
            cx="12"
            cy="12"
            r="4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          />
        </svg>
        <div class="pr-operator-overview__dock-copy">
          <p class="pr-operator-overview__badge">
            {{ t('overviewLowUtilization', locale) }}
          </p>
          <p class="pr-operator-overview__speedup">
            {{ t('overviewSpeedup', locale).replace('{value}', DEMO_SPEEDUP) }}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="pr-operator-overview__link"
        disabled
      >
        {{ t('overviewOptimizationSuggestion', locale) }}
      </button>
      <button
        type="button"
        class="pr-operator-overview__action"
        @click="optimizeSelected"
      >
        <svg
          class="pr-operator-overview__action-glyph"
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          stroke-width="1.15"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M5.2 9.4 V5.1 A2.6 2.6 0 0 1 7.8 2.5 H11.6 A2.6 2.6 0 0 1 14.2 5.1 V11 A2.6 2.6 0 0 1 11.6 13.6 H9.4"
          />
          <path d="M7.6 6.5 H12.3" />
          <path d="M9.1 9 H12.3" />
          <path
            d="M4.5 9.9 L5.2 11.7 L7 12.4 L5.2 13.1 L4.5 14.9 L3.8 13.1 L2 12.4 L3.8 11.7 Z"
            fill="currentColor"
            stroke="none"
          />
        </svg>
        <span>{{ t('overviewExecuteOptimization', locale) }}</span>
      </button>
    </div>

    <p
      v-if="rows.length > 0"
      class="pr-operator-overview__banner"
      data-testid="operator-overview-banner"
    >
      {{ t('overviewBanner', locale) }}
    </p>

    <Teleport to="body">
      <div
        v-if="openFilterColumn"
        :id="filterPopoverId"
        ref="popoverRef"
        class="pr-operator-overview__filter-popover"
        :style="{ left: `${filterAnchor.left}px`, top: `${filterAnchor.top}px` }"
        @click.stop
      >
        <div class="pr-operator-overview__filter-options">
          <label
            v-for="value in filterOptionsFor(openFilterColumn)"
            :key="value"
            class="pr-operator-overview__filter-option"
          >
            <input
              type="checkbox"
              :checked="filterValuesFor(openFilterColumn).includes(value)"
              @change="toggleFilterValue(openFilterColumn, value)"
            >
            <span>{{ value }}</span>
          </label>
        </div>
        <button
          type="button"
          class="pr-operator-overview__filter-clear"
          @click="clearFilter(openFilterColumn)"
        >
          {{ t('overviewClearFilter', locale) }}
        </button>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.pr-operator-overview {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
  min-height: 0;
  padding: 12px 16px 16px;
  background: var(--pr-bg-deep);
  color: #e6e6e6;
}

.pr-operator-overview__table-wrap {
  flex: 0 1 auto;
  max-height: 100%;
  min-height: 0;
  overflow: auto;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  background: transparent;
}

.pr-operator-overview__table {
  width: 100%;
  min-width: 720px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: 12px;
}

.pr-operator-overview__table th {
  position: sticky;
  top: 0;
  z-index: 1;
  height: 30px;
  padding: 0 12px;
  overflow: hidden;
  border-bottom: 1px solid #4a4a4a;
  background: #2a2a2a;
  color: #b4b4b4;
  font-weight: 400;
  text-align: left;
  white-space: nowrap;
}

.pr-operator-overview__header--numeric {
  text-align: right;
}

.pr-operator-overview__header-button {
  display: inline-flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: inherit;
  white-space: nowrap;
  cursor: pointer;
}

.pr-operator-overview__header-button > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-operator-overview__header--numeric .pr-operator-overview__header-button {
  justify-content: flex-end;
}

.pr-operator-overview__sort {
  flex: 0 0 auto;
  margin-left: 6px;
  vertical-align: middle;
  opacity: 0.7;
}

.pr-operator-overview__filter-count {
  flex: 0 0 auto;
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--pr-playhead);
  color: #ffffff;
  font-size: 10px;
  line-height: 14px;
}

.pr-operator-overview__filter-popover {
  position: fixed;
  z-index: 20;
  width: 200px;
  max-height: 240px;
  padding: 6px 0;
  overflow: auto;
  border: 1px solid var(--pr-divider);
  border-radius: 4px;
  background: var(--pr-surface-raised);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  text-align: left;
}

.pr-operator-overview__filter-options {
  overflow: visible;
}

.pr-operator-overview__filter-option {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 12px;
  color: #e6e6e6;
  font-size: 12px;
  cursor: pointer;
}

.pr-operator-overview__filter-option:hover {
  background: var(--pr-surface-hover);
}

.pr-operator-overview__filter-clear {
  display: block;
  width: 100%;
  padding: 6px 12px;
  border: 0;
  border-top: 1px solid var(--pr-divider);
  background: none;
  color: var(--pr-playhead);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.pr-operator-overview__row {
  height: 32px;
  cursor: default;
}

.pr-operator-overview__row td {
  padding: 0 12px;
  overflow: hidden;
  color: #e7e7e7;
  white-space: nowrap;
  text-overflow: ellipsis;
  box-shadow: inset 0 -1px 0 0 #2a2a2a;
}

.pr-operator-overview__cell--numeric {
  text-align: right;
}

.pr-operator-overview__row:hover {
  background: #262626;
}

.pr-operator-overview__row:focus-visible {
  outline: 1px solid var(--pr-playhead);
  outline-offset: -1px;
}

.pr-operator-overview__row--selected,
.pr-operator-overview__row--selected:hover {
  background: #404040;
}

/* Cell-level color wins over `.row td`; a `<tr>` declaration would lose. */
.pr-operator-overview__row--selected td {
  color: #ffffff;
}

.pr-operator-overview__dock {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.pr-operator-overview__utilization {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.pr-operator-overview__donut {
  flex-shrink: 0;
  color: var(--pr-tab-inactive);
}

.pr-operator-overview__dock-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.pr-operator-overview__badge {
  margin: 0;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
}

.pr-operator-overview__speedup {
  margin: 0;
  color: var(--pr-tab-inactive);
  font-size: 12px;
}

.pr-operator-overview__link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--pr-color-duration-comm);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.pr-operator-overview__link:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.pr-operator-overview__action {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  padding: 0 12px;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  background: transparent;
  color: #e6e6e6;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.pr-operator-overview__action:hover {
  border-color: var(--pr-playhead);
}

.pr-operator-overview__action-glyph {
  flex-shrink: 0;
}

.pr-operator-overview__banner {
  margin: 0;
  padding: 12px 16px;
  border: 0;
  border-radius: 6px;
  background: #2a2a2a;
  color: #b4b4b4;
  font-size: 12px;
  line-height: 1.5;
}
</style>
