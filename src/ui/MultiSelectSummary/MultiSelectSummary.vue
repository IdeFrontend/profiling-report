<script setup lang="ts">
import { computed, ref } from 'vue';
import CloseButton from '../CloseButton.vue';
import SortArrows from '../SortArrows.vue';
import { formatTimePartsAuto } from '../../domain/formatTime';
import { collectLeafEventsFromModel } from '../../domain/swimTree';
import type { SwimEvent, SwimlaneModel } from '../../domain/types';
import { t } from '../../i18n';
import {
  DOCK_HEIGHT_COLLAPSED,
  DOCK_HEIGHT_EXPANDED,
  startHorizontalResize,
} from '../panelResize';

const DOCK_HEIGHT_MIN = DOCK_HEIGHT_COLLAPSED;
const DOCK_HEIGHT_MAX = DOCK_HEIGHT_EXPANDED * 2;

const props = withDefaults(
  defineProps<{
    /** Events the marquee captured; the parent resolves ids to full objects. */
    selectedEvents: SwimEvent[];
    /** Average Wall Duration averages over the whole model, not just the selection. */
    model: SwimlaneModel | null;
    locale?: string;
    height?: number;
  }>(),
  {
    height: DOCK_HEIGHT_EXPANDED,
    locale: undefined,
  },
);

const emit = defineEmits<{
  close: [];
  /** Name click — leave multi-select for the single-select DetailPanel. */
  'select-single': [event: SwimEvent];
  'update:height': [height: number];
}>();

const dockStyle = computed(() => ({ height: `${props.height}px` }));

type SortKey = 'name' | 'duration' | 'selfTime' | 'avgDuration';
type SortDirection = 'asc' | 'desc';

/** Sketch default: longest first. `null` direction = unsorted (selection order). */
const sortKey = ref<SortKey>('duration');
const sortDirection = ref<SortDirection | null>('desc');

/** Mean duration per event name across the whole model (Q23: self time = duration). */
const averageByName = computed(() => {
  const totals = new Map<string, { sum: number; count: number }>();
  if (props.model) {
    for (const ev of collectLeafEventsFromModel(props.model)) {
      const entry = totals.get(ev.name) ?? { sum: 0, count: 0 };
      entry.sum += ev.duration;
      entry.count += 1;
      totals.set(ev.name, entry);
    }
  }
  const means = new Map<string, number>();
  for (const [name, { sum, count }] of totals) means.set(name, sum / count);
  return means;
});

interface Row {
  id: string;
  event: SwimEvent;
  name: string;
  duration: number;
  selfTime: number;
  avgDuration: number;
}

const rows = computed<Row[]>(() =>
  props.selectedEvents.map((event) => ({
    id: event.id,
    event,
    name: event.name,
    duration: event.duration,
    // Q23 interim: events are flat, so self time is the full duration.
    selfTime: event.duration,
    // Selection-only fallback when the event is not in the model (host-built list).
    avgDuration: averageByName.value.get(event.name) ?? event.duration,
  })),
);

const sortedRows = computed<Row[]>(() => {
  const dir = sortDirection.value;
  if (!dir) return rows.value;
  const key = sortKey.value;
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows.value].sort((a, b) => {
    if (key === 'name') return sign * a.name.localeCompare(b.name);
    return sign * (a[key] - b[key]);
  });
});

/** Column maxima drive the inline bars; guard against an all-zero column. */
const columnMax = computed(() => ({
  duration: Math.max(...rows.value.map((r) => r.duration), 0),
  selfTime: Math.max(...rows.value.map((r) => r.selfTime), 0),
  avgDuration: Math.max(...rows.value.map((r) => r.avgDuration), 0),
}));

const NUMERIC_COLUMNS = [
  { key: 'duration', label: 'wallDuration' },
  { key: 'selfTime', label: 'selfTime' },
  { key: 'avgDuration', label: 'avgWallDuration' },
] as const;

function cell(row: Row, key: 'duration' | 'selfTime' | 'avgDuration') {
  const parts = formatTimePartsAuto(row[key]);
  const max = columnMax.value[key];
  return {
    text: `${parts.value} ${parts.unit}`,
    // All-equal (or all-zero) columns fill completely, per the spec's edge case.
    percent: max > 0 ? (row[key] / max) * 100 : 100,
  };
}

/** ascending → descending → unsorted; a new column enters the cycle at ascending. */
function toggleSort(key: SortKey): void {
  if (sortKey.value !== key) {
    sortKey.value = key;
    sortDirection.value = 'asc';
    return;
  }
  sortDirection.value =
    sortDirection.value === 'asc' ? 'desc' : sortDirection.value === 'desc' ? null : 'asc';
}

/** aria-sort value for a column header ('none' when this column is not the sort key). */
function sortState(key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key || !sortDirection.value) return 'none';
  return sortDirection.value === 'asc' ? 'ascending' : 'descending';
}

let session: ReturnType<typeof startHorizontalResize> | null = null;

function onResizePointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  session = startHorizontalResize({
    startClientX: e.clientY,
    startWidth: props.height,
    min: DOCK_HEIGHT_MIN,
    max: Math.min(DOCK_HEIGHT_MAX, Math.max(DOCK_HEIGHT_MIN, window.innerHeight - 160)),
    direction: -1,
    onChange: (h) => emit('update:height', h),
  });
  e.preventDefault();
}

function onResizePointerMove(e: PointerEvent) {
  session?.move(e.clientY);
}

function onResizePointerUp() {
  session?.end();
  session = null;
}
</script>

<template>
  <footer
    class="pr-multi-select"
    data-testid="multi-select-summary"
    :style="dockStyle"
  >
    <button
      type="button"
      class="pr-multi-select__resize"
      data-testid="multi-select-resize-handle"
      :aria-label="t('resizeDock', locale)"
      :title="t('resizeDock', locale)"
      @pointerdown="onResizePointerDown"
      @pointermove="onResizePointerMove"
      @pointerup="onResizePointerUp"
      @pointercancel="onResizePointerUp"
    />
    <header class="pr-multi-select__head">
      <span
        class="pr-multi-select__count"
        data-testid="multi-select-count"
      >{{ t('itemsSelected', locale).replace('{n}', String(rows.length)) }}</span>
      <span
        class="pr-multi-select__tab"
        data-testid="multi-select-tab"
      >{{ t('slices', locale) }} ({{ rows.length }})</span>
      <CloseButton
        class="pr-multi-select__close"
        data-testid="multi-select-close"
        :label="t('closePanel', locale)"
        @click="emit('close')"
      />
    </header>

    <div class="pr-multi-select__body">
      <table class="pr-multi-select__table">
        <thead>
          <tr>
            <th scope="col">
              <button
                type="button"
                class="pr-multi-select__sort"
                data-testid="multi-select-sort-name"
                :aria-label="`${t('name', locale)} — ${t('sortColumn', locale)}`"
                :aria-sort="sortState('name')"
                @click="toggleSort('name')"
              >
                {{ t('name', locale) }}
                <SortArrows />
              </button>
            </th>
            <th
              v-for="col in NUMERIC_COLUMNS"
              :key="col.key"
              scope="col"
            >
              <button
                type="button"
                class="pr-multi-select__sort"
                :data-testid="`multi-select-sort-${col.key}`"
                :aria-label="`${t(col.label, locale)} — ${t('sortColumn', locale)}`"
                :aria-sort="sortState(col.key)"
                @click="toggleSort(col.key)"
              >
                {{ t(col.label, locale) }}
                <SortArrows />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in sortedRows"
            :key="row.id"
            :data-testid="`multi-select-row-${row.id}`"
          >
            <td>
              <button
                type="button"
                class="pr-multi-select__name"
                :data-testid="`multi-select-name-${row.id}`"
                :title="row.name"
                @click="emit('select-single', row.event)"
              >
                {{ row.name }}
              </button>
            </td>
            <td
              v-for="col in NUMERIC_COLUMNS"
              :key="col.key"
              :data-testid="`multi-select-${col.key}-${row.id}`"
            >
              <span class="pr-multi-select__metric">
                <span
                  class="pr-multi-select__value"
                  :title="cell(row, col.key).text"
                >{{ cell(row, col.key).text }}</span>
                <span
                  class="pr-multi-select__bar"
                  data-testid="multi-select-bar"
                  aria-hidden="true"
                ><span
                  class="pr-multi-select__bar-fill"
                  :style="{ width: `${cell(row, col.key).percent}%` }"
                /></span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </footer>
</template>

<style scoped>
.pr-multi-select {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  position: relative;
  /* Same dock chrome and height ownership as DetailPanel. */
  background: var(--pr-bg-panel, #262626);
  border-top: 1px solid #3a3a3a;
}

/* Same 5px hit strip as DetailPanel's top edge. */
.pr-multi-select__resize {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 5px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: ns-resize;
  transform: translateY(-50%);
  z-index: 6;
}

.pr-multi-select__resize:hover,
.pr-multi-select__resize:active {
  background: rgba(49, 122, 247, 0.35);
}

.pr-multi-select__head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 12px 0;
  border-bottom: 1px solid #3a3a3a;
}

.pr-multi-select__count {
  padding-bottom: 6px;
  font-size: 13px;
  color: #d0d0d0;
}

.pr-multi-select__tab {
  padding-bottom: 6px;
  /* Active tab rule, same as DetailPanel's 详情 tab. */
  border-bottom: 2px solid #e8e8e8;
  font-size: 13px;
  font-weight: 600;
}

.pr-multi-select__close {
  margin-left: auto;
  /* The head's 8px top / 0 bottom padding belongs to the tab (its underline has to
     meet the bottom border). Cancel it here so the ✕ centers on the band, not the
     padding box — flex centers the margin box. Same in DetailPanel's head. */
  margin-bottom: 8px;
}

.pr-multi-select__body {
  /* Claim the dock's height so the table — not the panel — is what scrolls. */
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 0 12px 12px;
}

.pr-multi-select__table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.pr-multi-select__table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0;
  text-align: left;
  font-weight: 400;
  background: var(--pr-bg-panel, #262626);
  border-bottom: 1px solid #3a3a3a;
}

.pr-multi-select__table td {
  padding: 4px 8px 4px 0;
  border-bottom: 1px solid #303030;
  min-width: 0;
}

.pr-multi-select__sort {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 8px 8px 8px 0;
  border: 0;
  background: transparent;
  color: #999999;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.pr-multi-select__sort:hover {
  color: #e0e0e0;
}

/* The sketch's arrows are identical on every column, so the sorted column is
   marked by its label brightening — not by a different glyph. */
.pr-multi-select__sort[aria-sort='ascending'],
.pr-multi-select__sort[aria-sort='descending'] {
  color: #e8e8e8;
}

.pr-multi-select__name {
  display: block;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: #6ea8fe;
  font: inherit;
  text-align: left;
  text-decoration: underline;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-multi-select__metric {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 56px;
  align-items: center;
  gap: 8px;
}

.pr-multi-select__value {
  padding: 2px 6px;
  border-radius: 3px;
  background: #3c3c3c;
  color: #e2e2e2;
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Sketch: muted fill on a darker track, inline right of the value. */
.pr-multi-select__bar {
  display: block;
  height: 12px;
  border-radius: 2px;
  background: #2b2b2b;
  overflow: hidden;
}

.pr-multi-select__bar-fill {
  display: block;
  height: 100%;
  background: #565656;
}
</style>
