<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../../i18n';

const props = defineProps<{
  /** Raw producer args of the selected event; keys are shown verbatim. */
  args?: Record<string, unknown>;
  locale?: string;
}>();

interface ParameterRow {
  key: string;
  values: string[];
  /** Path-like values render as the sketch's underlined source links. */
  paths: boolean;
}

function toValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (value === null || value === undefined) return [];
  if (typeof value === 'object') return [JSON.stringify(value)];
  return [String(value)];
}

/**
 * Not producer parameters: `event_id` / `dependencies` are the DATA-36a transport, already
 * rendered as the Relevent graph, and `cat` is the Chrome Trace category the adapter
 * copies into `args` — DetailSummary already shows it in the type pill.
 */
const HIDDEN_KEYS = new Set(['event_id', 'dependencies', 'cat']);

const rows = computed<ParameterRow[]>(() =>
  Object.entries(props.args ?? {})
    .filter(([key]) => !HIDDEN_KEYS.has(key))
    .map(([key, value]) => {
      const values = toValues(value).filter((v) => v !== '');
      return {
        key,
        values,
        paths: values.length > 0 && values.every((v) => v.includes('/') && !v.includes(' ')),
      };
    })
    .filter((row) => row.values.length > 0),
);
</script>

<template>
  <section
    class="pr-detail-parameter"
    data-testid="detail-parameter"
    :aria-label="t('parameter', locale)"
  >
    <h3 class="pr-detail-parameter__title">
      {{ t('parameter', locale) }}
    </h3>

    <p
      v-if="rows.length === 0"
      class="pr-detail-parameter__empty"
      data-testid="detail-parameter-empty"
    >
      {{ t('noParameters', locale) }}
    </p>

    <dl
      v-else
      class="pr-detail-parameter__rows"
    >
      <template
        v-for="row in rows"
        :key="row.key"
      >
        <dt class="pr-detail-parameter__key">
          {{ row.key }}
        </dt>
        <dd
          class="pr-detail-parameter__values"
          :class="{ 'pr-detail-parameter__values--paths': row.paths }"
        >
          <span
            v-for="(value, index) in row.values"
            :key="index"
            class="pr-detail-parameter__value"
            :class="{ 'pr-detail-parameter__value--path': row.paths }"
            :title="value"
          >{{ value }}</span>
        </dd>
      </template>
    </dl>
  </section>
</template>

<style scoped>
.pr-detail-parameter {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  min-width: 0;
  min-height: 0;
}

.pr-detail-parameter__title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #e0e0e0;
}

.pr-detail-parameter__empty {
  margin: 0;
  color: #888;
  font-size: 12px;
}

.pr-detail-parameter__rows {
  display: grid;
  grid-template-columns: minmax(72px, auto) minmax(0, 1fr);
  gap: 4px 16px;
  margin: 0;
  overflow: auto;
}

.pr-detail-parameter__key {
  color: #909090;
  font-size: 12px;
}

.pr-detail-parameter__values {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  min-width: 0;
  font-size: 12px;
}

.pr-detail-parameter__value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #d8d8d8;
  font-variant-numeric: tabular-nums;
}

.pr-detail-parameter__value--path {
  color: #cfd8ff;
  text-decoration: underline;
}
</style>
