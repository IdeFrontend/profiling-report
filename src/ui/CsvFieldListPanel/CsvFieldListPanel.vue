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

function tabLabel(fileName: string): string {
  const map: Record<string, string> = {
    'PipeUtilization.csv': 'PipeUtilization',
    'ArithmeticUtilization.csv': 'ArithmeticUtilization',
    'ResourceConflictRatio.csv': 'ResourceConflictRatio',
    'Memory.csv': 'Memory L1',
    'L2Cache.csv': 'L2Cache',
    'MemoryL0.csv': 'Memory L0',
    'MemoryUB.csv': 'Memory UB',
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
        <input
          v-model="search"
          data-testid="csv-search"
          type="search"
          :placeholder="t('searchPlaceholder', locale)"
        >
      </label>
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
  gap: 8px;
  min-height: 0;
}

.pr-csv__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.pr-csv__tab {
  appearance: none;
  border: 1px solid #3a3a3a;
  background: #1f1f1f;
  color: #b8b8b8;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 2px;
  cursor: pointer;
}

.pr-csv__tab--active {
  background: #2f4f4f;
  color: #f0f0f0;
  border-color: #4a6a6a;
}

.pr-csv__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.pr-csv__search {
  flex: 1 1 120px;
  min-width: 0;
}

.pr-csv__search input {
  width: 100%;
  box-sizing: border-box;
  background: #1f1f1f;
  border: 1px solid #3a3a3a;
  color: #e0e0e0;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 2px;
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
}

.pr-csv__view-all {
  appearance: none;
  border: 1px solid #3a3a3a;
  background: #262626;
  color: #d0d0d0;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 2px;
  cursor: pointer;
}

.pr-csv__view-all:disabled {
  opacity: 0.45;
  cursor: default;
}

.pr-csv__fields {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 360px;
  overflow: auto;
}

.pr-csv__field {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 8px;
  font-size: 11px;
  padding: 3px 0;
  border-bottom: 1px solid #333;
}

.pr-csv__field-name {
  color: #9a9a9a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-csv__field-value {
  color: #e0e0e0;
  font-variant-numeric: tabular-nums;
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
