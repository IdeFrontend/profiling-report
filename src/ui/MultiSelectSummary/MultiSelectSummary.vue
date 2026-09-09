<script setup lang="ts">
import { computed, ref } from 'vue';
import SortIcon from '../SortIcon.vue';
import { t } from '../../i18n';
import { formatTimeAuto } from '../../domain/formatTime';
import type { MultiSelectSummaryItem } from '../../domain/types';

const props = defineProps<{
  rows: MultiSelectSummaryItem[];
  count: number;
  locale?: string;
}>();

const emit = defineEmits<{ close: [] }>();

type SortKey = 'name' | 'wallDuration' | 'selfTime' | 'avgWallDuration';

const sortKey = ref<SortKey | null>(null);
const sortDir = ref<'asc' | 'desc' | null>(null);

function dirFor(key: SortKey): 'asc' | 'desc' | null {
  return sortKey.value === key ? sortDir.value : null;
}

function onSort(key: SortKey) {
  if (sortKey.value !== key) {
    sortKey.value = key;
    sortDir.value = 'asc';
    return;
  }
  if (sortDir.value === 'asc') { sortDir.value = 'desc'; return; }
  if (sortDir.value === 'desc') { sortKey.value = null; sortDir.value = null; }
}

function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
  const d = dirFor(key);
  if (d === 'asc') return 'ascending';
  if (d === 'desc') return 'descending';
  return 'none';
}

const COLS: { key: SortKey; labelKey: Parameters<typeof t>[0] }[] = [
  { key: 'name',            labelKey: 'multiSelectName' },
  { key: 'wallDuration',    labelKey: 'multiSelectWallDuration' },
  { key: 'selfTime',        labelKey: 'multiSelectSelfTime' },
  { key: 'avgWallDuration', labelKey: 'multiSelectAvgWallDuration' },
];

const sortedRows = computed<MultiSelectSummaryItem[]>(() => {
  const copy = [...props.rows];
  if (!sortKey.value || !sortDir.value) return copy;
  const key = sortKey.value;
  const sign = sortDir.value === 'asc' ? 1 : -1;
  return copy.sort((a, b) => {
    if (key === 'name') return a.name.localeCompare(b.name) * sign;
    return (a[key] - b[key]) * sign || a.name.localeCompare(b.name);
  });
});
</script>

<template>
  <section
    class="pr-mss"
    data-testid="multi-select-summary"
  >
    <header class="pr-mss__head">
      <span class="pr-mss__headline">
        {{ t('multiSelectCount', locale).replace('{n}', String(count)) }}
        <span class="pr-mss__badge">{{ t('multiSelectSlices', locale).replace('{n}', String(count)) }}</span>
      </span>
      <button
        type="button"
        class="pr-mss__close"
        data-testid="multi-select-close"
        :aria-label="t('multiSelectClose', locale)"
        @click="emit('close')"
      >
        ×
      </button>
    </header>

    <p
      v-if="rows.length === 0"
      class="pr-mss__empty"
      data-testid="multi-select-empty"
    >
      {{ t('multiSelectEmpty', locale) }}
    </p>

    <div
      v-else
      class="pr-mss__scroll"
    >
      <table
        class="pr-mss__table"
        data-testid="multi-select-table"
      >
        <thead>
          <tr>
            <th
              v-for="col in COLS"
              :key="col.key"
              :data-testid="`col-${col.key}`"
              :aria-sort="ariaSort(col.key)"
              class="pr-mss__th"
              :class="{ 'pr-mss__th--active': sortKey === col.key }"
            >
              <button
                type="button"
                class="pr-mss__sort-btn"
                @click="onSort(col.key)"
              >
                {{ t(col.labelKey, locale) }}
                <SortIcon :direction="dirFor(col.key)" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in sortedRows"
            :key="row.name"
            class="pr-mss__row"
          >
            <td
              class="pr-mss__cell pr-mss__cell--name"
              data-testid="row-name"
            >
              {{ row.name }}
            </td>
            <td class="pr-mss__cell pr-mss__cell--time">
              {{ formatTimeAuto(row.wallDuration) }}
            </td>
            <td class="pr-mss__cell pr-mss__cell--time">
              {{ formatTimeAuto(row.selfTime) }}
            </td>
            <td class="pr-mss__cell pr-mss__cell--time">
              {{ formatTimeAuto(row.avgWallDuration) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.pr-mss {
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  color: #e0e0e0;
  min-width: 0;
}

.pr-mss__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #2e2e2e;
  flex-shrink: 0;
}

.pr-mss__headline {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #a0a0a0;
}

.pr-mss__badge {
  padding: 1px 6px;
  border-radius: 10px;
  background: #2e2e2e;
  color: #cfcfcf;
  font-size: 11px;
}

.pr-mss__close {
  appearance: none;
  border: 0;
  background: transparent;
  color: #a0a0a0;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 4px;
}

.pr-mss__close:hover {
  color: #e0e0e0;
}

.pr-mss__empty {
  margin: 0;
  padding: 16px 12px;
  color: #888;
  font-size: 12px;
}

.pr-mss__scroll {
  overflow: auto;
  min-height: 0;
}

.pr-mss__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.pr-mss__th {
  padding: 0;
  border-bottom: 1px solid #2e2e2e;
  text-align: left;
  font-weight: 600;
  color: #a0a0a0;
  white-space: nowrap;
}

.pr-mss__sort-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: inherit;
  cursor: pointer;
  padding: 6px 12px;
  width: 100%;
  text-align: left;
}

.pr-mss__sort-btn:hover {
  color: #e0e0e0;
}

.pr-mss__th--active {
  color: #d0d0d0;
}

.pr-mss__row:nth-child(odd) {
  background: #1a1a1a;
}

.pr-mss__row:hover {
  background: #272727;
}

.pr-mss__cell {
  padding: 5px 12px;
  border-bottom: 1px solid #2e2e2e;
  font-variant-numeric: tabular-nums;
}

.pr-mss__cell--name {
  color: #e0e0e0;
}

.pr-mss__cell--time {
  text-align: right;
  color: #cfcfcf;
}
</style>
