<script setup lang="ts">
import { computed, ref } from 'vue';
import { t } from '../../../i18n';
import type { SummaryCategory } from '../../../domain/types';

const props = defineProps<{
  categories: SummaryCategory[];
  activeId?: string;
  locale?: string;
}>();

const emit = defineEmits<{
  'update:activeId': [id: string];
}>();

const search = ref('');

const active = computed(
  () => props.categories.find((c) => c.id === props.activeId) ?? props.categories[0] ?? null,
);

function tabLabel(category: SummaryCategory): string {
  const map: Record<string, string> = {
    'PipeUtilization': 'PipeUtilization',
    'ArithmeticUtilization': 'ArithmeticUtilization',
    'ResourceConflictRatio': 'ResourceConflictRatio',
    'MemoryL0': 'MemoryL0',
    'L2Cache': 'L2Cache',
    'Memory': 'MemoryL1',
    'MemoryUB': 'MemoryUB',
  };
  return map[category.id] ?? category.title;
}

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
  const category = active.value;
  if (!category) return [];
  const q = search.value.trim();
  const rows = q
    ? category.fields.filter((f) => f.key.toLowerCase().includes(q.toLowerCase()))
    : category.fields;
  return rows.map((f) => ({
    key: f.key,
    value: f.value,
    parts: highlightParts(f.key, q),
  }));
});
</script>

<template>
  <div
    class="pr-summ"
    data-testid="summary-category-list"
  >
    <div
      class="pr-summ__tabs"
      role="tablist"
      data-testid="summary-category-tabs"
    >
      <button
        v-for="category in categories"
        :key="category.id"
        type="button"
        role="tab"
        class="pr-summ__tab"
        :class="{ 'pr-summ__tab--active': category.id === active?.id }"
        :aria-selected="category.id === active?.id"
        :data-testid="`summary-category-tab-${category.id}`"
        @click="emit('update:activeId', category.id)"
      >
        {{ tabLabel(category) }}
      </button>
    </div>

    <div class="pr-summ__toolbar">
      <label class="pr-summ__search">
        <span class="pr-summ__sr">{{ t('searchLabel', locale) }}</span>
        <span
          class="pr-summ__search-icon"
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
          data-testid="summary-search"
          type="search"
          :placeholder="t('searchPlaceholder', locale)"
        >
        <button
          v-if="search.trim().length > 0"
          type="button"
          class="pr-summ__search-clear"
          data-testid="summary-search-clear"
          :aria-label="t('searchClear', locale)"
          @click.stop="search = ''"
        >
          ×
        </button>
      </label>
    </div>

    <ul
      v-if="active"
      class="pr-summ__fields"
      data-testid="summary-category-fields"
    >
      <li
        v-for="field in fields"
        :key="field.key"
        class="pr-summ__field"
      >
        <span class="pr-summ__field-name">
          <span
            v-for="(part, i) in field.parts"
            :key="i"
            :class="{ 'pr-summ__field-match': part.match }"
            :data-testid="part.match ? 'summary-field-match' : undefined"
          >{{ part.text }}</span>
        </span>
        <span class="pr-summ__field-value">{{ field.value }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pr-summ {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
  flex: 1 1 auto;
}

.pr-summ__tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 0;
  border-bottom: 1px solid #3a3a3a;
  overflow-x: auto;
  scrollbar-width: none;
  flex-shrink: 0;
}

.pr-summ__tabs::-webkit-scrollbar {
  display: none;
}

.pr-summ__tab {
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

.pr-summ__tab:hover {
  color: #d0d0d0;
}

.pr-summ__tab--active {
  color: #ffffff;
  border-bottom-color: #ffffff;
}

.pr-summ__toolbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 0;
  flex-shrink: 0;
}

.pr-summ__search {
  position: relative;
  display: block;
  flex: 1 1 140px;
  min-width: 0;
}

.pr-summ__search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: #9a9a9a;
  font-size: 12px;
  pointer-events: none;
}

.pr-summ__search input {
  width: 100%;
  box-sizing: border-box;
  background: #262626;
  border: 1px solid #3a3a3a;
  color: #e0e0e0;
  font-size: 11px;
  padding: 5px 24px 5px 26px;
  border-radius: 4px;
}

.pr-summ__search input:focus {
  outline: none;
  border-color: #3078f0;
}

.pr-summ__search input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

.pr-summ__search-clear {
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

.pr-summ__search-clear:hover {
  color: #d0d0d0;
}

.pr-summ__fields {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  border-top: 1px solid #333;
}

.pr-summ__field {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 10px;
  font-size: 11px;
  padding: 5px 2px;
  border-bottom: 1px solid #2e2e2e;
  line-height: 1.35;
}

.pr-summ__field-name {
  color: #8e8e8e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-summ__field-match {
  color: #688aec;
  background: #1d283c;
  border-radius: 3px;
  padding: 0;
  font-weight: 600;
}

.pr-summ__field-value {
  color: #e6e6e6;
  font-variant-numeric: tabular-nums;
  text-align: right;
  word-break: break-all;
}

.pr-summ__sr {
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
