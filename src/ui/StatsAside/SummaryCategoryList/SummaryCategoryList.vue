<script setup lang="ts">
import { computed, ref } from 'vue';
import { t } from '../../../i18n';
import type { SummaryCategory } from '../../../domain/types';
import { formatDetailValue } from '../../../domain/detailValue';
import { highlightParts } from '../../searchHighlight';
import SummaryDiffIndicator from '../StatsSummaryPanel/SummaryDiffIndicator.vue';
import { metricDiff, type MetricDiff } from '../../../domain/metricDiff';
import { asideRoundsToZero, formatAsideValue } from '../asideValueFormat';
import type { BaselineTipRow } from '../baselineTip';

const props = defineProps<{
  categories: SummaryCategory[];
  activeId?: string;
  locale?: string;
  /**
   * The PRIMARY baseline's categories (对比基线): a field whose numeric value
   * differs from the current one gets a delta badge after the value — details
   * show DELTAS (the bars show values).
   */
  baselineCategories?: SummaryCategory[];
  /**
   * Every comparison row's categories (multi-baseline 对比基线): the first row
   * is the primary inline badge; hovering the badge lists the CURRENT value
   * and every row's own value + delta (the other baselines live only there).
   */
  comparisonCategories?: { label: string; categories: SummaryCategory[] }[];
  /** Label for the current report in the popup (i18n from the parent). */
  comparisonCurrentLabel?: string;
}>();

const emit = defineEmits<{
  'update:activeId': [id: string];
}>();

const search = ref('');

/** Bare numeric delta (baseline − current) for one field pair; null when either side is not numeric or equal. */
function diffFor(current: string, baseline: string | undefined): MetricDiff | null {
  if (baseline == null) return null;
  const cur = Number(current);
  const base = Number(baseline);
  if (!Number.isFinite(cur) || !Number.isFinite(base)) return null;
  return metricDiff(cur, base);
}

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

const fields = computed(() => {
  const category = active.value;
  if (!category) return [];
  const q = search.value.trim();
  const rows = q
    ? category.fields.filter((f) => f.key.toLowerCase().includes(q.toLowerCase()))
    : category.fields;
  return rows.map((f) => {
    const base = props.baselineCategories
      ?.find((c) => c.id === category.id)
      ?.fields.find((bf) => bf.key === f.key);
    // Multi-baseline popup rows: current value first, then every baseline's
    // own value + delta (a single comparison row included).
    const comparison: BaselineTipRow[] = [];
    if (props.comparisonCategories && props.comparisonCategories.length > 0) {
      comparison.push({
        label: props.comparisonCurrentLabel ?? 'Current',
        value: formatDetailValue(f.value),
      });
      for (const entry of props.comparisonCategories) {
        const bf = entry.categories
          .find((c) => c.id === category.id)
          ?.fields.find((x) => x.key === f.key);
        if (bf == null) continue;
        const d = diffFor(f.value, bf.value);
        const text = d && !asideRoundsToZero(d.magnitude) ? formatAsideValue(d.magnitude) : undefined;
        comparison.push({
          label: entry.label,
          value: formatDetailValue(bf.value),
          tone: text ? d?.tone : undefined,
          direction:
            text && d
              ? t(d.tone === 'increase' ? 'diffIncreased' : 'diffDecreased', props.locale)
              : undefined,
          delta: text,
        });
      }
    }
    return {
      key: f.key,
      value: f.value,
      parts: highlightParts(f.key, q),
      diff: diffFor(f.value, base?.value),
      tip: comparison.length > 1 ? comparison : null,
    };
  });
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

    <div class="pr-field-toolbar">
      <label class="pr-field-search">
        <span class="pr-field-sr">{{ t('searchLabel', locale) }}</span>
        <span
          class="pr-field-search-icon"
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
          class="pr-field-search-clear"
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
            :class="{ 'pr-field-match': part.match }"
            :data-testid="part.match ? 'summary-field-match' : undefined"
          >{{ part.text }}</span>
        </span>
        <span class="pr-summ__field-side">
          <span class="pr-summ__field-value">{{ formatDetailValue(field.value) }}</span>
          <!-- The delta badge stays on the SAME line, right after the value
               (baseline-compare details mockup 1130). -->
          <SummaryDiffIndicator
            v-if="field.diff && !asideRoundsToZero(field.diff.magnitude)"
            :tone="field.diff.tone"
            :text="formatAsideValue(field.diff.magnitude)"
            :direction-label="t(field.diff.tone === 'increase' ? 'diffIncreased' : 'diffDecreased', locale)"
            :tip="field.tip"
            :focusable="false"
            :data-testid="`summary-field-diff-${field.key}`"
          />
        </span>
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

.pr-summ__field-value {
  color: #e6e6e6;
  font-variant-numeric: tabular-nums;
  /* Details pages read value-first from the left edge (1130 diff-detail mockup). */
  text-align: left;
  word-break: break-all;
}

/* Value + delta badge share one flex row so the badge never wraps under it.
 * Left-justified: the delta follows its own value, not a right-hand column. */
.pr-summ__field-side {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  min-width: 0;
}
</style>
