<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { SourceFileModel, SourceStallBreakdown } from '../../domain/types';
import { t } from '../../i18n';
import { highlightParts } from '../searchHighlight';
import { SOURCE_TAB_MONO_FAMILY } from './sourceFonts';
import {
  ensureSourceColWidths,
  sourceColCanResize,
  SOURCE_COL_WIDTH_MIN,
  startSourceColBoundaryResize,
} from './sourceColumnResize';

const props = withDefaults(
  defineProps<{
    file: SourceFileModel;
    /** Current caret line (1-based), or null. */
    currentLine: number | null;
    /** Extra lines to highlight (correlation). */
    correlatedLines?: number[];
    /** Search hits to mark (does not remove rows — keeps editor sync). */
    matchLines?: number[];
    /**
     * When set (SASS Assembly search), matching substrings in the Assembly
     * column use the CLA navy chip (`pr-field-match` / UI-43).
     */
    searchQuery?: string;
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
    /**
     * Controlled column widths (px). When omitted the table keeps its own map
     * (Asm pane). Sudu pane passes a shared map so the external header stays aligned.
     */
    columnWidths?: Record<string, number> | null;
    locale?: string;
  }>(),
  {
    correlatedLines: () => [],
    matchLines: () => [],
    searchQuery: '',
    dimZeroFor: null,
    fillerRows: 0,
    fontFamily: null,
    fontSizeCss: undefined,
    showHeader: true,
    showLineNumbers: false,
    columnWidths: null,
    locale: undefined,
  },
);

const emit = defineEmits<{
  'row-click': [line: number];
  'update:columnWidths': [widths: Record<string, number>];
  /** Horizontal scroll of the body — Sudu external header mirrors this. */
  'scroll-left': [left: number];
}>();

const tip = ref<{
  x: number;
  y: number;
  title: string;
  rows: SourceStallBreakdown[];
} | null>(null);

/** Pointer gap; matches StatsAside / timeline hover tips. */
const TIP_OFFSET_PX = 12;
/**
 * Widest stall card (min-width 340 + padding). Right-pane Sampling Stall sits against the
 * viewport edge, so `clientX + 12` alone crops the box — flip like PR-STATS-041b.
 */
const TIP_MAX_W_PX = 380;

/**
 * Flip rather than run off the viewport. SASS metrics are on the right half of the Source
 * layout, so a one-sided `left/top` placement loses most of a 340px card off-screen.
 */
const tipStyle = computed(() => {
  const t = tip.value;
  if (!t) return {};
  const { x, y } = t;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const toTheRight = x + TIP_OFFSET_PX + TIP_MAX_W_PX <= vw;
  const below = y < vh / 2;
  return {
    left: toTheRight ? `${x + TIP_OFFSET_PX}px` : 'auto',
    right: toTheRight ? 'auto' : `${vw - x + TIP_OFFSET_PX}px`,
    top: below ? `${y + TIP_OFFSET_PX}px` : 'auto',
    bottom: below ? 'auto' : `${vh - y + TIP_OFFSET_PX}px`,
  };
});

const correlatedSet = computed(() => new Set(props.correlatedLines ?? []));
const matchSet = computed(() => new Set(props.matchLines ?? []));

/**
 * Metrics / listing columns. Source pane: Sudu owns `#` + source text, so this
 * table is metrics-only. SASS pane: full table including Address + Assembly
 * (no Sudu); optional leading `#` via `showLineNumbers`.
 */
const columns = computed(() => props.file.metricsColumns);

const widthKeys = computed(() => {
  const ids = columns.value.map((c) => c.id);
  return props.showLineNumbers ? ['line', ...ids] : ids;
});

const localWidths = ref<Record<string, number>>(
  ensureSourceColWidths(widthKeys.value),
);

watch(
  widthKeys,
  (keys) => {
    localWidths.value = ensureSourceColWidths(keys, localWidths.value);
  },
  { deep: true },
);

const widths = computed(() =>
  ensureSourceColWidths(widthKeys.value, props.columnWidths ?? localWidths.value),
);

/**
 * Preferred px as a share of the total. Boundary drag trades width between
 * neighbors so the total (and every other divider) stays put.
 */
function colStyle(colId: string): { width: string; minWidth: string } {
  const keys = widthKeys.value;
  const total = keys.reduce((sum, id) => sum + (widths.value[id] ?? 100), 0) || 1;
  const px = widths.value[colId] ?? 100;
  return {
    width: `${(px / total) * 100}%`,
    minWidth: `${SOURCE_COL_WIDTH_MIN}px`,
  };
}

function setWidths(next: Record<string, number>) {
  if (props.columnWidths != null) {
    emit('update:columnWidths', next);
  } else {
    localWidths.value = next;
  }
}

let resizeSession: ReturnType<typeof startSourceColBoundaryResize> | null = null;

function endResizeSession() {
  if (!resizeSession) return;
  resizeSession.end();
  resizeSession = null;
  window.removeEventListener('pointermove', onResizeWindowMove);
  window.removeEventListener('pointerup', onResizeWindowUp);
  window.removeEventListener('pointercancel', onResizeWindowUp);
}

function onResizeWindowMove(e: PointerEvent) {
  resizeSession?.move(e.clientX);
}

function onResizeWindowUp() {
  endResizeSession();
}

function onResizePointerDown(colId: string, e: PointerEvent) {
  if (e.button !== 0) return;
  if (!sourceColCanResize(widthKeys.value, colId)) return;
  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture?.(e.pointerId);
  const table = el.closest('table');
  endResizeSession();
  resizeSession = startSourceColBoundaryResize({
    startClientX: e.clientX,
    leftId: colId,
    ids: widthKeys.value,
    startWidths: widths.value,
    onChange: setWidths,
    trackWidthPx: table?.clientWidth,
  });
  window.addEventListener('pointermove', onResizeWindowMove);
  window.addEventListener('pointerup', onResizeWindowUp);
  window.addEventListener('pointercancel', onResizeWindowUp);
  e.preventDefault();
  e.stopPropagation();
}

function onResizePointerMove(e: PointerEvent) {
  resizeSession?.move(e.clientX);
}

function onResizePointerUp() {
  endResizeSession();
}

onBeforeUnmount(() => {
  endResizeSession();
});

const headEl = ref<HTMLElement | null>(null);
const scrollEl = ref<HTMLElement | null>(null);

function onBodyScroll() {
  const left = scrollEl.value?.scrollLeft ?? 0;
  if (headEl.value && headEl.value.scrollLeft !== left) headEl.value.scrollLeft = left;
  emit('scroll-left', left);
}

/** Parent (Sudu header) can mirror horizontal scroll into the body. */
function setScrollLeft(left: number) {
  if (scrollEl.value) scrollEl.value.scrollLeft = left;
  if (headEl.value) headEl.value.scrollLeft = left;
}

defineExpose({ setScrollLeft });

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

/** Assembly search chips (same tokens as Compute Load CSV field list). */
function assemblyHighlightParts(line: number) {
  const text = cellText(line, 'assembly');
  const q = props.searchQuery?.trim() ?? '';
  if (!q || !matchSet.value.has(line)) return [{ text, match: false as const }];
  return highlightParts(text, q);
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
  // Raw pointer (or cell box) — `tipStyle` adds the offset and flips at the viewport edge.
  tip.value = {
    x: e.clientX || box?.right || 0,
    y: e.clientY || box?.top || 0,
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
  s['--pr-src-font-family'] = props.fontFamily || SOURCE_TAB_MONO_FAMILY;
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
      ref="headEl"
      class="pr-src-metrics__head"
      data-testid="source-metrics-head"
    >
      <table class="pr-src-metrics__table">
        <colgroup>
          <col
            v-if="showLineNumbers"
            class="pr-src-metrics__col--line"
            :style="colStyle('line')"
          >
          <col
            v-for="col in columns"
            :key="col.id"
            :class="`pr-src-metrics__col--${col.id}`"
            :style="colStyle(col.id)"
          >
        </colgroup>
        <thead>
          <tr>
            <th
              v-if="showLineNumbers"
              class="pr-src-metrics__line-th"
              title="#"
            >
              <span class="pr-src-metrics__th-label">#</span>
              <span
                v-if="sourceColCanResize(widthKeys, 'line')"
                class="pr-src-metrics__col-resize"
                data-testid="source-col-resize"
                data-col="line"
                role="separator"
                :aria-label="t('sourceResizeColumn', locale)"
                @pointerdown="onResizePointerDown('line', $event)"
                @pointermove="onResizePointerMove"
                @pointerup="onResizePointerUp"
                @pointercancel="onResizePointerUp"
              />
            </th>
            <th
              v-for="col in columns"
              :key="col.id"
              :title="col.label"
              :class="{ 'pr-src-metrics__left': isTextCol(col) }"
            >
              <span class="pr-src-metrics__th-label">{{ col.label }}</span>
              <span
                v-if="sourceColCanResize(widthKeys, col.id)"
                class="pr-src-metrics__col-resize"
                data-testid="source-col-resize"
                :data-col="col.id"
                role="separator"
                :aria-label="t('sourceResizeColumn', locale)"
                @pointerdown="onResizePointerDown(col.id, $event)"
                @pointermove="onResizePointerMove"
                @pointerup="onResizePointerUp"
                @pointercancel="onResizePointerUp"
              />
            </th>
          </tr>
        </thead>
      </table>
    </div>
    <div
      ref="scrollEl"
      class="pr-src-metrics__scroll"
      data-testid="source-metrics-scroll"
      @scroll="onBodyScroll"
    >
      <table class="pr-src-metrics__table">
        <colgroup>
          <col
            v-if="showLineNumbers"
            class="pr-src-metrics__col--line"
            :style="colStyle('line')"
          >
          <col
            v-for="col in columns"
            :key="col.id"
            :class="`pr-src-metrics__col--${col.id}`"
            :style="colStyle(col.id)"
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
              <template v-else-if="col.id === 'assembly' && searchQuery.trim()">
                <span
                  v-for="(part, i) in assemblyHighlightParts(row.line)"
                  :key="i"
                  :class="{ 'pr-field-match': part.match }"
                  :data-testid="part.match ? 'source-asm-match' : undefined"
                >{{ part.text }}</span>
              </template>
              <template v-else>
                {{ cellText(row.line, col.id) }}
              </template>
            </td>
          </tr>
          <!-- Scroll extent only: match Sudu’s trailing blank lines as empty space (no ~ / hover). -->
          <tr
            v-if="(fillerRows ?? 0) > 0"
            class="pr-src-metrics__filler"
            aria-hidden="true"
            :style="{ height: `${(fillerRows ?? 0) * (rowHeightCss || 20)}px` }"
          >
            <td :colspan="colSpan" />
          </tr>
        </tbody>
      </table>
    </div>
    <!-- Teleport: pane `overflow` and stacking would still clip a fixed tip near the seam. -->
    <Teleport to="body">
      <div
        v-if="tip"
        class="pr-src-metrics__tip"
        data-testid="stall-tooltip"
        role="tooltip"
        :style="tipStyle"
      >
        <div class="pr-src-metrics__tip-title">
          {{ tip.title }}
        </div>
        <table class="pr-src-metrics__tip-table">
          <thead>
            <tr>
              <th class="pr-src-metrics__tip-th-metric">
                Metric
              </th>
              <th class="pr-src-metrics__tip-th-value">
                Value
              </th>
              <th class="pr-src-metrics__tip-th-pct">
                Percentage
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in tip.rows"
              :key="r.metric"
            >
              <td class="pr-src-metrics__tip-metric">
                {{ r.metric }}
              </td>
              <td class="pr-src-metrics__tip-value">
                {{ r.value }}
              </td>
              <td class="pr-src-metrics__tip-pct">
                <!-- Same capsule as Warp Occupancy: hatch unused + solid used + % inside the bar. -->
                <span class="pr-src-metrics__bar-track pr-src-metrics__tip-bar">
                  <span
                    class="pr-src-metrics__bar-fill"
                    :style="{ width: `${Math.min(100, Math.max(0, r.percent))}%` }"
                  />
                  <span class="pr-src-metrics__bar-label">{{ r.percent.toFixed(2) }}%</span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Teleport>
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
  --pr-src-font-family: monospace;
  /* Sketch metrics plane is #1E1E1E (slightly above editor #1A1A1A). */
  --table-bg: #1e1e1e;
  background: var(--table-bg);
  color: #cccccc;
}

.pr-src-metrics__head {
  flex: 0 0 auto;
  /* Titles live in a ~20px row — never show a scrollbar here; body drives scrollLeft. */
  overflow: hidden;
  border-bottom: 1px solid #333333;
  background: #2a2a2a;
  border-radius: 6px 6px 0 0;
}

.pr-src-metrics__scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: scroll;
  overflow-x: auto;
  scrollbar-gutter: stable;
}

.pr-src-metrics__scroll::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.pr-src-metrics__scroll::-webkit-scrollbar-track {
  background: transparent;
}

.pr-src-metrics__scroll::-webkit-scrollbar-thumb {
  background-color: rgb(107 106 107 / 50.2%);
  border: 1px solid transparent;
  background-clip: padding-box;
}

.pr-src-metrics__table {
  /* Fill the pane; preferred col widths share space (table-layout: fixed). */
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
  position: relative;
  color: #b3b3b3;
  /* v930-source: metric headers and values are left-aligned (not spreadsheet-right). */
  text-align: left;
  font-weight: 400;
  /* Smaller UI sans than the 12px mono body so ellipsis lands like the sketch
     ("Instructions Exec…", "Warp Occup…") rather than clipping mid-word earlier. */
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 11px;
  line-height: var(--pr-src-row-h);
  height: var(--pr-src-row-h);
  background: #2a2a2a;
}

.pr-src-metrics__th-label {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 6px;
}

.pr-src-metrics__col-resize {
  position: absolute;
  top: 0;
  right: -3px;
  z-index: 2;
  width: 7px;
  height: 100%;
  cursor: col-resize;
  touch-action: none;
  user-select: none;
}

/* Always-visible drag rail so the hit target isn't invisible until hover. */
.pr-src-metrics__col-resize::before {
  content: '';
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
  background: #555555;
  pointer-events: none;
}

.pr-src-metrics__col-resize:hover,
.pr-src-metrics__col-resize:active {
  background: rgba(48, 120, 240, 0.2);
}

.pr-src-metrics__col-resize:hover::before,
.pr-src-metrics__col-resize:active::before {
  background: #3078f0;
  width: 2px;
}

/* Widths come from inline col styles (resizable); classes remain for targeting. */

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
  text-align: left;
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
  box-sizing: border-box;
  display: block;
  width: 100%;
  /* v930-source: ~⅔ of the ~18px mono row — taller capsule than the old 10px. */
  height: 14px;
  border-radius: 7px;
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
  border-radius: 7px 0 0 7px;
  background: #4a4a4a;
}

.pr-src-metrics__bar-label {
  position: absolute;
  inset: 0 6px 0 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  color: #e8e8e8;
  font-size: 11px;
  line-height: 14px;
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

/* Match rows stay unmarked as a block — Assembly uses `pr-field-match` chips (UI-43). */

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

.pr-src-metrics__filler,
.pr-src-metrics__filler td {
  pointer-events: none;
  cursor: default;
}

.pr-src-metrics__filler:hover td {
  background: transparent;
}

/* Stall breakdown tip — v930-source: padded card, pill header row, hatch bars.
   Teleported to body; z-index above Source chrome so a left-flipped tip stays visible. */
.pr-src-metrics__tip {
  position: fixed;
  z-index: 1000;
  min-width: 340px;
  padding: 16px;
  background: #2b2b2b;
  border: 1px solid #4a4a4a;
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 400;
  pointer-events: none;
  color: #e8e8e8;
}

.pr-src-metrics__tip-title {
  margin: 0 0 12px;
  font-weight: 600;
  font-size: 13px;
  color: #ffffff;
}

.pr-src-metrics__tip-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 4px;
}

.pr-src-metrics__tip-table thead th {
  padding: 6px 12px;
  /* Sketch header strip is lighter than the card (#363636 on #2b2b2b), not darker. */
  color: #b3b3b3;
  font-weight: 400;
  background: #363636;
  border: none;
}

.pr-src-metrics__tip-table thead th:first-child {
  border-radius: 8px 0 0 8px;
}

.pr-src-metrics__tip-table thead th:last-child {
  border-radius: 0 8px 8px 0;
}

.pr-src-metrics__tip-th-metric,
.pr-src-metrics__tip-metric {
  text-align: left;
}

.pr-src-metrics__tip-th-value,
.pr-src-metrics__tip-value {
  text-align: left;
  font-variant-numeric: tabular-nums;
}

.pr-src-metrics__tip-th-pct {
  text-align: left;
}

.pr-src-metrics__tip-table tbody td {
  padding: 6px 12px;
  vertical-align: middle;
}

.pr-src-metrics__tip-metric {
  color: #e8e8e8;
  padding-right: 20px;
}

.pr-src-metrics__tip-value {
  color: #e8e8e8;
  padding-left: 16px;
  padding-right: 20px;
}

.pr-src-metrics__tip-pct {
  min-width: 120px;
}

/* Wider than table cells so "46.32%" fits inside the capsule. */
.pr-src-metrics__tip-bar {
  display: block;
  width: 100%;
  min-width: 96px;
}
</style>
