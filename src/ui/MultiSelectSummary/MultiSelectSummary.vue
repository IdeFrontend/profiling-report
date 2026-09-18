<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import SortIcon from '../SortIcon.vue';
import CloseButton from '../CloseButton.vue';
import { formatTimePartsAuto } from '../../domain/formatTime';
import { collectLeafEventsFromModel } from '../../domain/swimTree';
import type { SwimEvent, SwimlaneModel } from '../../domain/types';
import { t } from '../../i18n';
import {
  DOCK_HEIGHT_COLLAPSED,
  DOCK_HEIGHT_EXPANDED,
} from '../panelResize';

const MAX_RENDERED_ROWS = 1000;
/** Ranked-window row height used to virtualize the tbody (padding + label + border). */
const ROW_HEIGHT_PX = 29;
const ROW_OVERSCAN = 4;
/** jsdom / unmeasured body: enough rows for collapsed dock tests without 1000 DOM nodes. */
const FALLBACK_VIEWPORT_ROWS = 24;

const props = withDefaults(
  defineProps<{
    /** Events the marquee captured; the parent resolves ids to full objects. */
    selectedEvents: SwimEvent[];
    /** Average Wall Duration averages over the whole model, not just the selection. */
    model: SwimlaneModel | null;
    locale?: string;
    height?: number;
    /** Live marquee: header count only, no table body (avoids 1000-row layout mid-drag). */
    livePreview?: boolean;
  }>(),
  {
    height: DOCK_HEIGHT_COLLAPSED,
    locale: undefined,
    livePreview: false,
  },
);

const emit = defineEmits<{
  close: [];
  /** Name click — leave multi-select for the single-select DetailPanel. */
  'select-single': [event: SwimEvent];
  'update:height': [height: number];
}>();

type SortKey = 'name' | 'duration' | 'selfTime' | 'avgDuration';
type SortDirection = 'asc' | 'desc';

/** Sketch default: longest first. */
const sortKey = ref<SortKey>('duration');
const sortDirection = ref<SortDirection>('desc');

/** Mean duration per event name across the whole model (interim: self time = duration). */
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

const selectedCount = computed(() => props.selectedEvents.length);

const rows = computed<Row[]>(() => {
  if (props.livePreview) return [];
  return props.selectedEvents.map((event) => ({
    id: event.id,
    event,
    name: event.name,
    duration: event.duration,
    // Interim: events are flat, so self time is the full duration.
    selfTime: event.duration,
    // Selection-only fallback when the event is not in the model (host-built list).
    avgDuration: averageByName.value.get(event.name) ?? event.duration,
  }));
});

/**
 * Keep only the visible window sorted. Full `rows` still drive the header count and
 * bar maxima; live marquees are also membership-guarded / throttled in the root so
 * this does not re-run on every pointermove with an unchanged id set.
 */
function selectTopRows(
  items: readonly Row[],
  k: number,
  cmp: (a: Row, b: Row) => number,
): Row[] {
  if (items.length <= k) return items.slice().sort(cmp);
  const best: Row[] = [];
  for (const item of items) {
    if (best.length < k) {
      let lo = 0;
      let hi = best.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cmp(item, best[mid]!) < 0) hi = mid;
        else lo = mid + 1;
      }
      best.splice(lo, 0, item);
      continue;
    }
    if (cmp(item, best[k - 1]!) >= 0) continue;
    let lo = 0;
    let hi = k;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cmp(item, best[mid]!) < 0) hi = mid;
      else lo = mid + 1;
    }
    best.splice(lo, 0, item);
    best.pop();
  }
  return best;
}

const rankedRows = computed<Row[]>(() => {
  const key = sortKey.value;
  const sign = sortDirection.value === 'asc' ? 1 : -1;
  const cmp = (a: Row, b: Row) => {
    if (key === 'name') return sign * a.name.localeCompare(b.name);
    return sign * (a[key] - b[key]);
  };
  return selectTopRows(rows.value, MAX_RENDERED_ROWS, cmp);
});

const bodyRef = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
const viewportHeight = ref(0);
let bodyRo: ResizeObserver | null = null;

function onBodyScroll(e: Event): void {
  scrollTop.value = (e.currentTarget as HTMLElement).scrollTop;
}

onMounted(() => {
  const el = bodyRef.value;
  if (!el || typeof ResizeObserver === 'undefined') return;
  bodyRo = new ResizeObserver(() => {
    viewportHeight.value = el.clientHeight;
  });
  bodyRo.observe(el);
  viewportHeight.value = el.clientHeight;
});

onBeforeUnmount(() => {
  bodyRo?.disconnect();
  bodyRo = null;
});

watch(
  () => props.selectedEvents,
  () => {
    scrollTop.value = 0;
    if (bodyRef.value) bodyRef.value.scrollTop = 0;
  },
);

const windowStart = computed(() => {
  const ranked = rankedRows.value.length;
  if (ranked === 0) return 0;
  const raw = Math.floor(scrollTop.value / ROW_HEIGHT_PX) - ROW_OVERSCAN;
  return Math.max(0, Math.min(raw, ranked - 1));
});

const windowRows = computed<Row[]>(() => {
  const ranked = rankedRows.value;
  if (ranked.length === 0) return [];
  const measured = viewportHeight.value > 0 ? Math.ceil(viewportHeight.value / ROW_HEIGHT_PX) : 0;
  const vp = Math.max(FALLBACK_VIEWPORT_ROWS, measured);
  const start = windowStart.value;
  const count = Math.min(ranked.length - start, vp + ROW_OVERSCAN * 2);
  return ranked.slice(start, start + count);
});

const topPadPx = computed(() => windowStart.value * ROW_HEIGHT_PX);
const bottomPadPx = computed(() =>
  Math.max(0, (rankedRows.value.length - windowStart.value - windowRows.value.length) * ROW_HEIGHT_PX),
);

type CellView = { text: string; percent: number };

const windowCells = computed(() => {
  const max = columnMax.value;
  return windowRows.value.map((row) => ({
    row,
    duration: formatCell(row, 'duration', max.duration),
    selfTime: formatCell(row, 'selfTime', max.selfTime),
    avgDuration: formatCell(row, 'avgDuration', max.avgDuration),
  }));
});

/** Column maxima drive the inline bars; guard against an all-zero column. */
const columnMax = computed(() => {
  let duration = 0;
  let selfTime = 0;
  let avgDuration = 0;
  for (const row of rows.value) {
    duration = Math.max(duration, row.duration);
    selfTime = Math.max(selfTime, row.selfTime);
    avgDuration = Math.max(avgDuration, row.avgDuration);
  }
  return { duration, selfTime, avgDuration };
});

const NUMERIC_COLUMNS = [
  { key: 'duration', label: 'wallDuration' },
  { key: 'selfTime', label: 'selfTime' },
  { key: 'avgDuration', label: 'avgWallDuration' },
] as const;

function formatCell(
  row: Row,
  key: 'duration' | 'selfTime' | 'avgDuration',
  max: number,
): CellView {
  const parts = formatTimePartsAuto(row[key]);
  return {
    text: `${parts.value} ${parts.unit}`,
    percent: max > 0 ? (row[key] / max) * 100 : 100,
  };
}

/** A new column starts ascending; subsequent clicks alternate direction. */
function toggleSort(key: SortKey): void {
  if (sortKey.value !== key) {
    sortKey.value = key;
    sortDirection.value = 'asc';
    return;
  }
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
}

/** aria-sort value for a column header ('none' when this column is not the sort key). */
function sortState(key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) return 'none';
  return sortDirection.value === 'asc' ? 'ascending' : 'descending';
}

/** SortIcon direction for a column: active column shows asc/desc, others show null (↕). */
function dirFor(key: SortKey): 'asc' | 'desc' | null {
  if (sortKey.value !== key) return null;
  return sortDirection.value;
}

const expanded = computed(() => props.height >= DOCK_HEIGHT_EXPANDED);

const expanderLabel = computed(() =>
  t(expanded.value ? 'collapseDock' : 'expandDock', props.locale),
);

function toggleExpanded(): void {
  emit('update:height', expanded.value ? DOCK_HEIGHT_COLLAPSED : DOCK_HEIGHT_EXPANDED);
}
</script>

<template>
  <div
    class="pr-multi-select"
    data-testid="multi-select-summary"
  >
    <button
      type="button"
      class="pr-multi-select__expander"
      :class="{ 'pr-multi-select__expander--expanded': expanded }"
      data-testid="multi-select-expander"
      :aria-label="expanderLabel"
      :aria-expanded="expanded"
      :title="expanderLabel"
      @click="toggleExpanded"
    >
      <span class="pr-multi-select__expander-bar" />
      <span class="pr-multi-select__expander-arrow" />
    </button>
    <header class="pr-multi-select__head">
      <span
        class="pr-multi-select__count"
        data-testid="multi-select-count"
      >{{ t('itemsSelected', locale).replace('{n}', String(selectedCount)) }}</span>
      <span
        class="pr-multi-select__tab"
        data-testid="multi-select-tab"
      >{{ t('slices', locale) }} ({{ selectedCount }})</span>
      <span
        v-if="!livePreview && selectedCount > rankedRows.length"
        class="pr-multi-select__visible-count"
        data-testid="multi-select-visible-count"
      >{{ t('showingRows', locale).replace('{shown}', String(rankedRows.length)).replace('{total}', String(selectedCount)) }}</span>
      <CloseButton
        class="pr-multi-select__close"
        data-testid="multi-select-close"
        :label="t('closePanel', locale)"
        @click="emit('close')"
      />
    </header>

    <div
      ref="bodyRef"
      class="pr-multi-select__body"
      @scroll.passive="onBodyScroll"
    >
      <table v-if="!livePreview" class="pr-multi-select__table">
        <thead>
          <tr>
            <th scope="col" :aria-sort="sortState('name')">
              <button
                type="button"
                class="pr-multi-select__sort"
                data-testid="multi-select-sort-name"
                :aria-label="`${t('name', locale)} — ${t('sortColumn', locale)}`"
                @click="toggleSort('name')"
              >
                {{ t('name', locale) }}
                <SortIcon :direction="dirFor('name')" />
              </button>
            </th>
            <th
              v-for="col in NUMERIC_COLUMNS"
              :key="col.key"
              scope="col"
              :aria-sort="sortState(col.key)"
            >
              <button
                type="button"
                class="pr-multi-select__sort"
                :data-testid="`multi-select-sort-${col.key}`"
                :aria-label="`${t(col.label, locale)} — ${t('sortColumn', locale)}`"
                @click="toggleSort(col.key)"
              >
                {{ t(col.label, locale) }}
                <SortIcon :direction="dirFor(col.key)" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="topPadPx > 0" aria-hidden="true">
            <td
              colspan="4"
              class="pr-multi-select__pad"
              :style="{ height: `${topPadPx}px` }"
            />
          </tr>
          <tr
            v-for="entry in windowCells"
            :key="entry.row.id"
            :data-testid="`multi-select-row-${entry.row.id}`"
          >
            <td>
              <button
                type="button"
                class="pr-multi-select__name"
                :data-testid="`multi-select-name-${entry.row.id}`"
                :title="entry.row.name"
                @click="emit('select-single', entry.row.event)"
              >
                {{ entry.row.name }}
              </button>
            </td>
            <td
              v-for="col in NUMERIC_COLUMNS"
              :key="col.key"
              :data-testid="`multi-select-${col.key}-${entry.row.id}`"
            >
              <span class="pr-multi-select__metric">
                <span
                  class="pr-multi-select__value"
                  :title="entry[col.key].text"
                >{{ entry[col.key].text }}</span>
                <span
                  class="pr-multi-select__bar"
                  data-testid="multi-select-bar"
                  aria-hidden="true"
                ><span
                  class="pr-multi-select__bar-fill"
                  :style="{ width: `${entry[col.key].percent}%` }"
                /></span>
              </span>
            </td>
          </tr>
          <tr v-if="bottomPadPx > 0" aria-hidden="true">
            <td
              colspan="4"
              class="pr-multi-select__pad"
              :style="{ height: `${bottomPadPx}px` }"
            />
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.pr-multi-select {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  position: relative;
  min-height: 0;
  /* The shell owns background, border and height. */
}

/* Sketch affordance, identical to DetailPanel: a 14x1 bar and a small solid triangle,
   centred on the dock's top edge. The two swap order between states via flex direction. */
.pr-multi-select__expander {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 2px;
  /* Padding only, so the 14x8 visual keeps its sketch position while the hit target
     reaches a usable size. */
  margin: 0;
  padding: 4px 16px 10px;
  border: 0;
  background: transparent;
  color: #6c6c6c;
  cursor: pointer;
}

.pr-multi-select__expander--expanded {
  flex-direction: column;
}

.pr-multi-select__expander:hover {
  color: #b3b3b3;
}

.pr-multi-select__expander-bar {
  width: 14px;
  height: 1px;
  background: currentColor;
}

.pr-multi-select__expander-arrow {
  width: 0;
  height: 0;
  border-right: 3px solid transparent;
  border-bottom: 4px solid currentColor;
  border-left: 3px solid transparent;
}

.pr-multi-select__expander--expanded .pr-multi-select__expander-arrow {
  border-top: 4px solid currentColor;
  border-bottom: 0;
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

.pr-multi-select__visible-count {
  padding-bottom: 6px;
  color: #969696;
}

.pr-multi-select__close {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: #b0b0b0;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.pr-multi-select__close:hover {
  color: #f0f0f0;
}

.pr-multi-select__pad {
  padding: 0;
  border: 0;
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
th[aria-sort='ascending'] .pr-multi-select__sort,
th[aria-sort='descending'] .pr-multi-select__sort {
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
