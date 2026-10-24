<script setup lang="ts">
import { computed } from 'vue';
import { resolveSourceFrame } from '../../../adapters/sourceCorrelation/resolveSourceFrame';
import type { SourceFileModel } from '../../../domain/types';
import { t } from '../../../i18n';

const props = defineProps<{
  /** Raw producer args of the selected event; keys are shown verbatim. */
  args?: Record<string, unknown>;
  /** Bundled source files. A frame that matches one becomes a Source-tab link. */
  sourceFiles?: SourceFileModel[];
  locale?: string;
}>();

const emit = defineEmits<{
  'open-source': [frame: string | Record<string, unknown>];
}>();

interface ParameterValue {
  text: string;
  /** Hover text. Object frames keep every field here, even when `text` is shortened. */
  title: string;
  raw: string | Record<string, unknown>;
  link: boolean;
}

interface ParameterRow {
  key: string;
  values: ParameterValue[];
  /** Path-like values render as the sketch's underlined source links. */
  paths: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function frameText(value: string | Record<string, unknown>): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Visible label for a frame that actually opens the Source tab. */
function linkedFrameLabel(value: string | Record<string, unknown>): string {
  if (typeof value === 'string') return value;
  const path = ['FileName', 'file', 'path', 'SourceFilePath']
    .map((key) => value[key])
    .find((item) => typeof item === 'string' && item.trim());
  if (typeof path !== 'string') return JSON.stringify(value);
  const lineRaw = value.Line ?? value.line ?? value.CallSiteLine;
  const line = typeof lineRaw === 'number' ? lineRaw : Number(lineRaw);
  return Number.isFinite(line) && line > 0 ? `${path}:${line}` : path;
}

function toFrames(value: unknown): Array<string | Record<string, unknown>> {
  if (Array.isArray(value)) {
    const frames: Array<string | Record<string, unknown>> = [];
    for (const item of value) {
      if (typeof item === 'string') {
        if (item !== '') frames.push(item);
      } else if (isRecord(item)) frames.push(item);
      else if (item !== null && item !== undefined) frames.push(String(item));
    }
    return frames;
  }
  if (isRecord(value)) return [value];
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') return value === '' ? [] : [value];
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
      const values = toFrames(value).map((raw) => {
        const title = frameText(raw);
        const link = resolveSourceFrame(raw, props.sourceFiles ?? []) != null;
        return {
          text: link ? linkedFrameLabel(raw) : title,
          title,
          raw,
          link,
        };
      });
      return {
        key,
        values,
        paths: values.length > 0 && values.every((v) => v.text.includes('/') && !v.text.includes(' ')),
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
          <template
            v-for="(value, index) in row.values"
            :key="index"
          >
            <button
              v-if="value.link"
              type="button"
              class="pr-detail-parameter__value pr-detail-parameter__value--path"
              data-testid="source-frame-link"
              :title="value.title"
              @click="emit('open-source', value.raw)"
            >
              {{ value.text }}
            </button>
            <span
              v-else
              class="pr-detail-parameter__value"
              :class="{ 'pr-detail-parameter__value--path': row.paths }"
              :title="value.title"
            >{{ value.text }}</span>
          </template>
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

button.pr-detail-parameter__value {
  display: block;
  max-width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.pr-detail-parameter__value--path {
  color: #cfd8ff;
  text-decoration: underline;
}
</style>
