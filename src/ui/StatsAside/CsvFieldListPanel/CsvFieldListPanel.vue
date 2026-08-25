<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { t } from '../../../i18n';
import type { CsvTableModel } from '../../../domain/types';

const props = withDefaults(
  defineProps<{
    tables: CsvTableModel[];
    csvTexts?: Record<string, string>;
    locale?: string;
    showBlockSwitcher?: boolean;
    showViewAll?: boolean;
    selectedBlockId?: string;
  }>(),
  {
    csvTexts: () => ({}),
    locale: undefined,
    showBlockSwitcher: true,
    showViewAll: true,
    selectedBlockId: undefined,
  },
);

const emit = defineEmits<{
  'view-full-csv': [payload: { fileName: string; text: string }];
  'update:selectedBlockId': [id: string];
}>();

const activeFile = ref(props.tables[0]?.fileName ?? '');
const internalBlock = ref('');
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

const selectedBlock = computed({
  get(): string {
    const ids = activeTable.value?.blockIds ?? [];
    const bound = props.selectedBlockId;
    if (bound != null && bound !== '' && ids.includes(bound)) return bound;
    if (internalBlock.value !== '' && ids.includes(internalBlock.value)) return internalBlock.value;
    return ids[0] ?? '';
  },
  set(v: string) {
    internalBlock.value = v;
    emit('update:selectedBlockId', v);
  },
});

const blockIds = computed(() => activeTable.value?.blockIds ?? []);

const showBlocks = computed(
  () => props.showBlockSwitcher && blockIds.value.length > 0,
);

const showActions = computed(() => showBlocks.value || props.showViewAll);

/** Product tab labels from `v930/compute-load-detail` / `v930/memory-load-detail`. */
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

function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  if (!query) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: { text: string; match: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const j = lower.indexOf(q, i);
    if (j === -1) {
      parts.push({ text: text.slice(i), match: false });
      break;
    }
    if (j > i) parts.push({ text: text.slice(i, j), match: false });
    parts.push({ text: text.slice(j, j + q.length), match: true });
    i = j + q.length;
  }
  return parts;
}

const fields = computed(() => {
  const table = activeTable.value;
  const row = activeRow.value;
  if (!table || !row) return [];
  const q = search.value.trim();
  return table.headers.map((h) => ({
    header: h,
    value: row[h] ?? '',
    parts: highlightParts(h, q),
  }));
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
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <circle
              cx="5"
              cy="5"
              r="3.5"
              stroke="currentColor"
              stroke-width="1.2"
            />
            <path
              d="M7.8 7.8 L10.5 10.5"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
        </span>
        <input
          v-model="search"
          data-testid="csv-search"
          type="search"
          :placeholder="t('searchPlaceholder', locale)"
        >
        <button
          v-if="search.length > 0"
          type="button"
          class="pr-csv__search-clear"
          data-testid="csv-search-clear"
          :aria-label="t('searchClear', locale)"
          @click.stop="search = ''"
        >
          ×
        </button>
      </label>
      <div
        v-if="showActions"
        class="pr-csv__actions"
      >
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
          v-if="showViewAll"
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
        <span class="pr-csv__field-name">
          <span
            v-for="(part, i) in field.parts"
            :key="i"
            :class="{ 'pr-csv__field-match': part.match }"
            :data-testid="part.match ? 'csv-field-match' : undefined"
          >{{ part.text }}</span>
        </span>
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
  flex-shrink: 0;
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
  color: #ffffff;
  border-bottom-color: #ffffff;
}

.pr-csv__toolbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 0;
  flex-shrink: 0;
}

.pr-csv__search {
  position: relative;
  display: block;
  flex: 1 1 140px;
  min-width: 0;
}

.pr-csv__search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: #9a9a9a;
  font-size: 12px;
  pointer-events: none;
}

.pr-csv__search input {
  width: 100%;
  box-sizing: border-box;
  background: #262626;
  border: 1px solid #3a3a3a;
  color: #e0e0e0;
  font-size: 11px;
  padding: 5px 24px 5px 26px;
  border-radius: 4px;
}

.pr-csv__search input:focus {
  outline: none;
  border-color: #3078f0;
}

.pr-csv__search input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

.pr-csv__search-clear {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  appearance: none;
  border: 0;
  background: transparent;
  color: #9a9a9a;
  font-size: 14px;
  line-height: 1;
  padding: 2px 4px;
  cursor: pointer;
}

.pr-csv__search-clear:hover {
  color: #d0d0d0;
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
  appearance: none;
  background: #2a2a2a url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='%23c8c8c8' d='M0 0l5 6 5-6z'/></svg>") no-repeat right 8px center;
  border: 1px solid #3a3a3a;
  color: #e0e0e0;
  font-size: 11px;
  padding: 4px 22px 4px 10px;
  border-radius: 4px;
  min-width: 72px;
}

.pr-csv__view-all {
  appearance: none;
  border: 0;
  background: transparent;
  color: #c8c8c8;
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
  flex: 1 1 auto;
  min-height: 0;
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

.pr-csv__field-match {
  display: inline-block;
  color: #688aec;
  background: #1d283c;
  border-radius: 3px;
  padding: 0 4px;
  font-weight: 600;
  line-height: 1.35;
  vertical-align: baseline;
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
