<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../../i18n';
import type { CsvTableModel } from '../../domain/types';

const props = withDefaults(
  defineProps<{
    tables: CsvTableModel[];
    csvTexts?: Record<string, string>;
    locale?: string;
    showBlockSwitcher?: boolean;
  }>(),
  {
    csvTexts: () => ({}),
    locale: undefined,
    showBlockSwitcher: true,
  },
);

const emit = defineEmits<{
  'view-full-csv': [payload: { fileName: string; text: string }];
}>();

const activeFile = ref(props.tables[0]?.fileName ?? '');
const selectedBlock = ref('');
const search = ref('');

watch(
  () => props.tables.map((t) => t.fileName).join('|'),
  () => {
    if (!props.tables.some((t) => t.fileName === activeFile.value)) {
      activeFile.value = props.tables[0]?.fileName ?? '';
    }
  },
  { immediate: true },
);

const activeTable = computed(
  () => props.tables.find((t) => t.fileName === activeFile.value) ?? null,
);

watch(
  activeTable,
  (table) => {
    const ids = table?.blockIds ?? [];
    if (ids.length === 0) {
      selectedBlock.value = '';
      return;
    }
    if (!ids.includes(selectedBlock.value)) {
      selectedBlock.value = ids[0]!;
    }
  },
  { immediate: true },
);

const blockIds = computed(() => activeTable.value?.blockIds ?? []);

const showBlocks = computed(
  () => props.showBlockSwitcher && blockIds.value.length > 0,
);

/** Product tab labels from changes.png #3–#4. */
function tabLabel(fileName: string): string {
  const map: Record<string, string> = {
    'PipeUtilization.csv': 'PipeUtilization',
    'ArithmeticUtilization.csv': 'ArithmeticUtilization',
    'ResourceConflictRatio.csv': 'ResourceConflictRatio',
    'MemoryL0.csv': 'MemoryL0',
    'L2Cache.csv': 'L2Cache',
    'Memory.csv': 'MemoryL1',
    'MemoryUB.csv': 'MemoryUB',
  };
  return map[fileName] ?? fileName.replace(/\.csv$/i, '');
}

const activeRow = computed(() => {
  const table = activeTable.value;
  if (!table) return null;
  if (!selectedBlock.value) return table.rows[0] ?? null;
  return table.rows.find((r) => r['block_id'] === selectedBlock.value) ?? null;
});

const fields = computed(() => {
  const table = activeTable.value;
  const row = activeRow.value;
  if (!table || !row) return [];
  const q = search.value.trim().toLowerCase();
  return table.headers
    .filter((h) => (q ? h.toLowerCase().includes(q) : true))
    .map((h) => ({ header: h, value: row[h] ?? '' }));
});

function onViewAll() {
  const name = activeFile.value;
  const text = props.csvTexts[name];
  if (!name || text == null) return;
  emit('view-full-csv', { fileName: name, text });
}
</script>

<template>
  <div
    class="pr-csv"
    data-testid="csv-field-list"
  >
    <div
      class="pr-csv__tabs"
      role="tablist"
      data-testid="csv-tabs"
    >
      <button
        v-for="table in tables"
        :key="table.fileName"
        type="button"
        role="tab"
        class="pr-csv__tab"
        :class="{ 'pr-csv__tab--active': table.fileName === activeFile }"
        :data-testid="`csv-tab-${table.fileName}`"
        :aria-selected="table.fileName === activeFile"
        @click="activeFile = table.fileName"
      >
        {{ tabLabel(table.fileName) }}
      </button>
    </div>

    <div class="pr-csv__toolbar">
      <label class="pr-csv__search">
        <span class="pr-csv__sr">{{ t('searchLabel', locale) }}</span>
        <span
          class="pr-csv__search-icon"
          aria-hidden="true"
        >⌕</span>
        <input
          v-model="search"
          data-testid="csv-search"
          type="search"
          :placeholder="t('searchPlaceholder', locale)"
        >
      </label>
      <div class="pr-csv__actions">
        <label
          v-if="showBlocks"
          class="pr-csv__block"
        >
          <span>{{ t('block', locale) }}</span>
          <select
            v-model="selectedBlock"
            data-testid="csv-block"
          >
            <option
              v-for="id in blockIds"
              :key="id"
              :value="id"
            >
              {{ id }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="pr-csv__view-all"
          data-testid="csv-view-all"
          :disabled="!csvTexts[activeFile]"
          @click="onViewAll"
        >
          {{ t('viewAll', locale) }}
        </button>
      </div>
    </div>

    <ul
      class="pr-csv__fields"
      data-testid="csv-fields"
    >
      <li
        v-for="field in fields"
        :key="field.header"
        class="pr-csv__field"
      >
        <span class="pr-csv__field-name">{{ field.header }}</span>
        <span class="pr-csv__field-value">{{ field.value }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pr-csv {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
  flex: 1 1 auto;
}

.pr-csv__tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 0;
  border-bottom: 1px solid #3a3a3a;
  overflow-x: auto;
  scrollbar-width: none;
}

.pr-csv__tabs::-webkit-scrollbar {
  display: none;
}

.pr-csv__tab {
  appearance: none;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #9a9a9a;
  font-size: 11px;
  padding: 6px 10px;
  margin-bottom: -1px;
  cursor: pointer;
  white-space: nowrap;
}

.pr-csv__tab:hover {
  color: #d0d0d0;
}

.pr-csv__tab--active {
  color: #e8e8e8;
  border-bottom-color: var(--pr-playhead, #3078f0);
}

.pr-csv__toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}

.pr-csv__search {
  position: relative;
  display: block;
  width: 100%;
}

.pr-csv__search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: #777;
  font-size: 12px;
  pointer-events: none;
}

.pr-csv__search input {
  width: 100%;
  box-sizing: border-box;
  background: #1f1f1f;
  border: 1px solid #3a3a3a;
  color: #e0e0e0;
  font-size: 11px;
  padding: 5px 8px 5px 26px;
  border-radius: 2px;
}

.pr-csv__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.pr-csv__block {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #b8b8b8;
}

.pr-csv__block select {
  background: #1f1f1f;
  border: 1px solid #3a3a3a;
  color: #e0e0e0;
  font-size: 11px;
  padding: 3px 6px;
  border-radius: 2px;
  min-width: 64px;
}

.pr-csv__view-all {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--pr-playhead, #3078f0);
  font-size: 12px;
  padding: 0;
  cursor: pointer;
}

.pr-csv__view-all:hover:not(:disabled) {
  text-decoration: underline;
}

.pr-csv__view-all:disabled {
  opacity: 0.4;
  cursor: default;
}

.pr-csv__fields {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  max-height: min(520px, 60vh);
  overflow: auto;
  border-top: 1px solid #333;
}

.pr-csv__field {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 10px;
  font-size: 11px;
  padding: 5px 2px;
  border-bottom: 1px solid #2e2e2e;
  line-height: 1.35;
}

.pr-csv__field-name {
  color: #8e8e8e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-csv__field-value {
  color: #e6e6e6;
  font-variant-numeric: tabular-nums;
  text-align: right;
  word-break: break-all;
}

.pr-csv__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
