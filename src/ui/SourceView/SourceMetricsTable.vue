<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SourceFileModel, SourceStallBreakdown } from '../../domain/types';
import { SOURCE_TAB_MONO_STACK } from './sourceFonts';

const props = withDefaults(
  defineProps<{
    file: SourceFileModel;
    /** Current caret line (1-based), or null. */
    currentLine: number | null;
    /** Extra lines to highlight (correlation). */
    correlatedLines?: number[];
    /** Search hits to mark (does not remove rows — keeps editor sync). */
    matchLines?: number[];
    /** When set, rows with a zero/empty value in this metric are dimmed. */
    dimZeroFor?: string | null;
    rowHeightCss: number;
    fillerRows?: number;
    fontFamily?: string | null;
    fontSizeCss?: number;
    /**
     * When false, only the scrollable body is rendered. Column titles live in a
     * sibling header row above the editor (Sudu standalone-sample layout) so
     * line 1 of code lines up with the first metrics row.
     */
    showHeader?: boolean;
    /** Leading `#` column (SASS table-only pane; Sudu owns line numbers on Source). */
    showLineNumbers?: boolean;
  }>(),
  {
    correlatedLines: () => [],
    matchLines: () => [],
    dimZeroFor: null,
    fillerRows: 0,
    fontFamily: null,
    fontSizeCss: undefined,
    showHeader: true,
    showLineNumbers: false,
  },
);

const emit = defineEmits<{
  'row-click': [line: number];
}>();

const tip = ref<{
  x: number;
  y: number;
  title: string;
  rows: SourceStallBreakdown[];
} | null>(null);

const correlatedSet = computed(() => new Set(props.correlatedLines ?? []));
const matchSet = computed(() => new Set(props.matchLines ?? []));

/**
 * Metrics / listing columns. Source pane: Sudu owns `#` + source text, so this
 * table is metrics-only. SASS pane: full table including Address + Assembly
 * (no Sudu); optional leading `#` via `showLineNumbers`.
 */
const columns = computed(() => props.file.metricsColumns);

function isTextCol(col: { id: string; kind: string }): boolean {
  return col.kind === 'text' || col.id === 'address' || col.id === 'assembly';
}

const colSpan = computed(() => columns.value.length + (props.showLineNumbers ? 1 : 0));

function isZeroMetric(line: number): boolean {
  const colId = props.dimZeroFor;
  if (!colId) return false;
  const row = props.file.lines.find((l) => l.line === line);
  const v = row?.values[colId];
  return v == null || v === '' || v === 0;
}

function cellText(line: number, colId: string): string {
  const row = props.file.lines.find((l) => l.line === line);
  const v = row?.values[colId];
  if (v == null) return '';
  if (typeof v === 'number') {
    const col = props.file.metricsColumns.find((c) => c.id === colId);
    if (col?.kind === 'percent' || col?.kind === 'bar') {
      return `${Math.round(v * 100)}%`;
    }
    return String(Math.round(v * 100) / 100);
  }
  return String(v);
}

function barWidth(line: number, colId: string): number {
  const row = props.file.lines.find((l) => l.line === line);
  const v = row?.values[colId];
  if (typeof v !== 'number' || v <= 0) return 0;
  const col = props.file.metricsColumns.find((c) => c.id === colId);
  if (col?.kind === 'bar' && v <= 1) return Math.min(100, v * 100);
  const max = Math.max(
    1,
    ...props.file.lines.map((l) => {
      const n = l.values[colId];
      return typeof n === 'number' ? n : 0;
    }),
  );
  return Math.min(100, (v / max) * 100);
}

function onStallEnter(e: MouseEvent, line: number) {
  const row = props.file.lines.find((l) => l.line === line);
  if (!row?.stallBreakdown?.length) return;
  const total = row.stallBreakdown.reduce((s, r) => s + r.value, 0);
  const el = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
  const box = el?.getBoundingClientRect();
  tip.value = {
    x: (e.clientX || box?.right || 0) + 12,
    y: (e.clientY || box?.top || 0) + 12,
    title: `Total Sample Count: ${total}`,
    rows: row.stallBreakdown,
  };
}

function onStallLeave() {
  tip.value = null;
}

const styleVars = computed(() => {
  const s: Record<string, string> = {};
  if (props.rowHeightCss > 0) s['--pr-src-row-h'] = `${props.rowHeightCss}px`;
  if (props.fontSizeCss && props.fontSizeCss > 0) s['--pr-src-font-size'] = `${props.fontSizeCss}px`;
  s['--pr-src-font-family'] = props.fontFamily
    ? `${props.fontFamily}, ${SOURCE_TAB_MONO_STACK}`
    : SOURCE_TAB_MONO_STACK;
  return s;
});
</script>

<template>
  <div
    class="pr-src-metrics"
    :style="styleVars"
    data-testid="source-metrics"
  >
    <div
      v-if="showHeader"
      class="pr-src-metrics__head"
      data-testid="source-metrics-head"
    >
      <table class="pr-src-metrics__table">
        <colgroup>
          <col
            v-if="showLineNumbers"
            class="pr-src-metrics__col--line"
          >
          <col
            v-for="col in columns"
            :key="col.id"
            :class="`pr-src-metrics__col--${col.id}`"
          >
        </colgroup>
        <thead>
          <tr>
            <th
              v-if="showLineNumbers"
              class="pr-src-metrics__line-th"
              title="#"
            >
              #
            </th>
            <th
              v-for="col in columns"
              :key="col.id"
              :title="col.label"
              :class="{ 'pr-src-metrics__left': isTextCol(col) }"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>
      </table>
    </div>
    <div
      class="pr-src-metrics__scroll"
      data-testid="source-metrics-scroll"
    >
      <table class="pr-src-metrics__table">
        <colgroup>
          <col
            v-if="showLineNumbers"
            class="pr-src-metrics__col--line"
          >
          <col
            v-for="col in columns"
            :key="col.id"
            :class="`pr-src-metrics__col--${col.id}`"
          >
        </colgroup>
        <tbody>
          <tr
            v-for="row in file.lines"
            :key="row.line"
            :data-line="row.line"
            :class="{
              'pr-src-metrics__row--current': currentLine === row.line,
              'pr-src-metrics__row--correlated': correlatedSet.has(row.line),
              'pr-src-metrics__row--match': matchSet.has(row.line),
              'pr-src-metrics__row--dim': isZeroMetric(row.line),
            }"
            :style="{ height: `${rowHeightCss || 20}px` }"
            @click="emit('row-click', row.line)"
          >
            <td
              v-if="showLineNumbers"
              class="pr-src-metrics__line"
              data-col="line"
            >
              {{ row.line }}
            </td>
            <td
              v-for="col in columns"
              :key="col.id"
              :data-col="col.id"
              :class="{
                'pr-src-metrics__num': col.kind !== 'bar' && !isTextCol(col),
                'pr-src-metrics__text': isTextCol(col),
                'pr-src-metrics__addr': col.id === 'address',
                'pr-src-metrics__asm': col.id === 'assembly',
                'pr-src-metrics__bar-cell': col.kind === 'bar',
              }"
              @mouseenter="col.id === 'samplingStall' ? onStallEnter($event, row.line) : undefined"
              @mouseleave="col.id === 'samplingStall' ? onStallLeave() : undefined"
            >
              <template v-if="col.kind === 'bar'">
                <!-- Sketch: hatch background, solid used fill, % at the right end -->
                <span class="pr-src-metrics__bar-track">
                  <span
                    class="pr-src-metrics__bar-fill"
                    :style="{ width: `${barWidth(row.line, col.id)}%` }"
                  />
                  <span class="pr-src-metrics__bar-label">{{ cellText(row.line, col.id) }}</span>
                </span>
              </template>
              <template v-else>
                {{ cellText(row.line, col.id) }}
              </template>
            </td>
          </tr>
          <tr
            v-for="i in fillerRows ?? 0"
            :key="`f-${i}`"
            class="pr-src-metrics__filler"
            :style="{ height: `${rowHeightCss || 20}px` }"
          >
            <td :colspan="colSpan">
              ~
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      v-if="tip"
      class="pr-src-metrics__tip"
      data-testid="stall-tooltip"
      :style="{ left: `${tip.x}px`, top: `${tip.y}px` }"
    >
      <div class="pr-src-metrics__tip-title">
        {{ tip.title }}
      </div>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, idx) in tip.rows"
            :key="r.metric"
          >
            <td>{{ r.metric }}</td>
            <td>{{ r.value }}</td>
            <td class="pr-src-metrics__tip-pct">
              <span class="pr-src-metrics__tip-bar">
                <span
                  class="pr-src-metrics__tip-bar-fill"
                  :class="{ 'pr-src-metrics__tip-bar-fill--primary': idx === 0 }"
                  :style="{ width: `${r.percent}%` }"
                />
              </span>
              {{ r.percent.toFixed(2) }}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.pr-src-metrics {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  --pr-src-row-h: 20px;
  --pr-src-font-size: 12px;
  --pr-src-font-family: 'JetBrains Mono', ui-monospace, monospace;
  /* Sketch metrics plane is #1E1E1E (slightly above editor #1A1A1A). */
  --table-bg: #1e1e1e;
  background: var(--table-bg);
  color: #cccccc;
}

.pr-src-metrics__head {
  flex: 0 0 auto;
  overflow: hidden;
  border-bottom: 1px solid #333333;
  background: #2a2a2a;
  scrollbar-gutter: stable;
}

.pr-src-metrics__scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: scroll;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

.pr-src-metrics__scroll::-webkit-scrollbar,
.pr-src-metrics__head::-webkit-scrollbar {
  width: 12px;
}

.pr-src-metrics__scroll::-webkit-scrollbar-track,
.pr-src-metrics__head::-webkit-scrollbar-track {
  background: transparent;
}

.pr-src-metrics__scroll::-webkit-scrollbar-thumb,
.pr-src-metrics__head::-webkit-scrollbar-thumb {
  background-color: rgb(107 106 107 / 50.2%);
  border: 1px solid transparent;
  background-clip: padding-box;
}

.pr-src-metrics__table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-family: var(--pr-src-font-family);
  font-size: var(--pr-src-font-size);
  line-height: var(--pr-src-row-h);
  background: var(--table-bg);
}

.pr-src-metrics__table th,
.pr-src-metrics__table td {
  padding: 0 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pr-src-metrics__head .pr-src-metrics__table {
  height: var(--pr-src-row-h);
}

.pr-src-metrics__table th {
  color: #b3b3b3;
  text-align: right;
  font-weight: 400;
  font-size: var(--pr-src-font-size);
  line-height: var(--pr-src-row-h);
  height: var(--pr-src-row-h);
  background: #2a2a2a;
}

/* SASS full table widths (# · Address · Assembly · metrics). Source metrics-only
   panes ignore unused col classes. */
.pr-src-metrics__col--line {
  width: 3.5rem;
}

.pr-src-metrics__col--address {
  width: 12rem;
}

.pr-src-metrics__col--assembly {
  width: 36%;
}

.pr-src-metrics__col--instructionsExecuted {
  width: 7.5rem;
}

.pr-src-metrics__col--samplingStall {
  width: 7.5rem;
}

.pr-src-metrics__col--warpOccupancy {
  width: 8.5rem;
}

.pr-src-metrics__left {
  text-align: left !important;
}

.pr-src-metrics__line-th,
.pr-src-metrics__line {
  text-align: right;
  color: #858585;
  font-variant-numeric: tabular-nums;
  padding-right: 10px !important;
}

.pr-src-metrics__num {
  text-align: right;
  color: #cccccc;
  font-variant-numeric: tabular-nums;
}

.pr-src-metrics__text {
  text-align: left;
  color: #cccccc;
}

.pr-src-metrics__addr {
  /* Sketch addresses read as light grey, not VS Code cyan. */
  color: #c1c1c1;
  font-variant-numeric: tabular-nums;
}

.pr-src-metrics__asm {
  color: #d4d4d4;
}

.pr-src-metrics__bar-cell {
  text-align: left;
  min-width: 110px;
  /* No vertical padding — row height must match Sudu line height. */
  vertical-align: middle;
}

.pr-src-metrics__bar-track {
  position: relative;
  display: block;
  width: 100%;
  /* Cap below typical editor line (~18px at 12px font) so rows stay in sync. */
  height: 10px;
  border-radius: 5px;
  border: 1px solid #333333;
  overflow: hidden;
  /* Unused remainder: diagonal hatch (v930-source). */
  background:
    repeating-linear-gradient(
      -45deg,
      #3a3a3a,
      #3a3a3a 2px,
      #2a2a2a 2px,
      #2a2a2a 4px
    );
}

/* Used occupancy: solid fill from the left. */
.pr-src-metrics__bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  height: 100%;
  border-radius: 5px 0 0 5px;
  background: #4a4a4a;
}

.pr-src-metrics__bar-label {
  position: absolute;
  inset: 0 5px 0 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  color: #e8e8e8;
  font-size: 10px;
  line-height: 10px;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
  z-index: 1;
}

.pr-src-metrics__row--current td {
  background: #2a2a2a;
  color: #ffffff;
}

.pr-src-metrics__row--correlated td {
  background: #252830;
}

.pr-src-metrics__row--match td {
  outline: 1px solid #6a6a6a;
  outline-offset: -1px;
}

.pr-src-metrics__row--dim td {
  opacity: 0.35;
}

.pr-src-metrics__row--correlated.pr-src-metrics__row--current td {
  background: #2e323a;
}

tr {
  cursor: pointer;
}

tr:hover td {
  background: #242424;
}

.pr-src-metrics__row--current:hover td {
  background: #323232;
}

.pr-src-metrics__filler td {
  color: #4a4a4a;
  text-align: center;
}

.pr-src-metrics__tip {
  position: fixed;
  z-index: 40;
  min-width: 280px;
  padding: 10px 12px 12px;
  background: #2b2b2b;
  border: 1px solid #555555;
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 400;
  pointer-events: none;
  color: #e0e0e0;
}

.pr-src-metrics__tip-title {
  margin-bottom: 8px;
  font-weight: 600;
  color: #ffffff;
}

.pr-src-metrics__tip table {
  width: 100%;
  border-collapse: collapse;
}

.pr-src-metrics__tip th,
.pr-src-metrics__tip td {
  padding: 3px 6px;
  text-align: left;
}

.pr-src-metrics__tip th {
  color: #b3b3b3;
  font-weight: 400;
}

.pr-src-metrics__tip-pct {
  white-space: nowrap;
}

.pr-src-metrics__tip-bar {
  display: inline-block;
  width: 56px;
  height: 8px;
  margin-right: 8px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  vertical-align: middle;
  overflow: hidden;
}

.pr-src-metrics__tip-bar-fill {
  display: block;
  height: 100%;
  background:
    repeating-linear-gradient(
      -45deg,
      #505050,
      #505050 2px,
      #3a3a3a 2px,
      #3a3a3a 4px
    );
}

/* Sketch stall tip bars stay grey; primary row is only slightly lighter. */
.pr-src-metrics__tip-bar-fill--primary {
  background:
    repeating-linear-gradient(
      -45deg,
      #6a6a6a,
      #6a6a6a 2px,
      #4a4a4a 2px,
      #4a4a4a 4px
    );
}
</style>
