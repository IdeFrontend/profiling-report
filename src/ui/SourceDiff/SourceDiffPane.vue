<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from 'vue';
import type { ILineDescriptor } from '@sudu-ide/types/frontend';
import type { SourceFileModel, SourceLineMetrics } from '../../domain/types';
import { t } from '../../i18n';
import PrIcon from '../PrIcon.vue';
import { matchRanges } from '../searchHighlight';
import { SOURCE_TAB_EDITOR_FONT } from '../SourceView/sourceFonts';
import {
  ensureSourceColWidths,
  SOURCE_COL_WIDTH_MIN,
} from '../SourceView/sourceColumnResize';
import SourceMetricsTable from '../SourceView/SourceMetricsTable.vue';
import SourcePillSelect, { type SourceSelectOption } from '../SourceView/SourcePillSelect.vue';
import {
  cssRowHeight,
  cssScrollFromDevice,
  deviceScrollFromCss,
  isUsableGeometry,
  trailingRowCount,
  type EditorGeometry,
} from '../SourceView/editorTableSync';
import { getSuduWorkerPool, loadSuduApi } from '../SourceView/suduRuntime';
import type { DiffRow } from './diffAlign';

const props = withDefaults(
  defineProps<{
    rows: DiffRow[];
    side: 'left' | 'right';
    /** Source-line metrics for this side's file; values are looked up by source line. */
    metrics: SourceFileModel;
    locale?: string;
    workerUrl?: string;
    searchQuery?: string;
    /** Sibling files offered by the pane header; defaults to `metrics` alone. */
    files?: SourceFileModel[];
    activeFileId?: string;
    /** Vertical scroll in CSS px (parent mirrors it into the other pane). */
    scrollListener?: (cssScroll: number) => void;
    /** Shared scroll-sync state from the pane bar link toggle. */
    linked?: boolean;
    /** Metric column emphasized by Navigate By. */
    highlightColumn?: string | null;
  }>(),
  {
    locale: undefined,
    workerUrl: '/sudu/worker.js',
    searchQuery: '',
    files: undefined,
    activeFileId: undefined,
    scrollListener: undefined,
    linked: true,
    highlightColumn: null,
  },
);

const emit = defineEmits<{
  'select-file': [id: string];
  'toggle-link': [];
  'update:navigateBy': [id: string];
}>();

/**
 * Actual Sudu editor plane. SuduCodePane pins `ThemeColor.EditorBackground` (11)
 * to this same value, so it is the rendered background we blend against.
 */
const SUDU_EDITOR_BG = { r: 0x1a, g: 0x1a, b: 0x1a };
/**
 * shortcut: screen blend approximates the mockup band; upgrade if the editor gains a row-highlight API.
 * Screen(base, band) = 255 - (255-base)(255-band)/255. Solving for #463521 (code)
 * and #4A3925 (metrics) gives these band colors (blue clips to 0).
 */
const BAND_CHANGED_CODE = 'rgb(49, 30, 8)';
const BAND_CHANGED_METRICS = 'rgb(50, 31, 8)';
const BAND_ONLY_CODE = 'rgb(45, 9, 10)';
const BAND_ONLY_METRICS = 'rgb(50, 8, 9)';

const EDITOR_BG_HEX = `#${SUDU_EDITOR_BG.r.toString(16).padStart(2, '0')}${SUDU_EDITOR_BG.g
  .toString(16)
  .padStart(2, '0')}${SUDU_EDITOR_BG.b.toString(16).padStart(2, '0')}`;

const editorTheme = {
  baseTheme: 'dark' as const,
  editorFont: { ...SOURCE_TAB_EDITOR_FONT, size: 14 },
  11: EDITOR_BG_HEX,
  // Compare has no current-line band; matching EditorBackground keeps Sudu from repainting it.
  13: EDITOR_BG_HEX,
  14: EDITOR_BG_HEX,
  19: '#575757',
  20: '#575757',
  21: '#575757',
};

const domId = useId().replace(/:/g, '');
const containerId = `pr-src-diff-${domId}`;
const rootEl = ref<HTMLElement | null>(null);
const editorHost = ref<HTMLElement | null>(null);
const tableScrollEl = ref<HTMLElement | null>(null);
const loadError = ref<string | null>(null);
const rowH = ref(20);
const filler = ref(0);
const scrollCss = ref(0);
const currentLine = ref<number | null>(null);

/** Same formula as codereview.js: measure the widest line number + 5px, rounded up. */
const gutterCss = computed(() => {
  const digits = String(Math.max(1, props.rows.length)).length;
  const ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!ctx) return 20;
  const size = geom.value.fontSize || SOURCE_TAB_EDITOR_FONT.size;
  const family = geom.value.fontFamily || SOURCE_TAB_EDITOR_FONT.family;
  ctx.font = `400 ${size}px ${family}`;
  return Math.ceil(ctx.measureText('0'.repeat(digits)).width + 5);
});

const geom = ref<EditorGeometry>({
  dpr: 0,
  lineHeight: 0,
  editorHeight: 0,
  maxVScrollPos: 0,
  numLines: 0,
  fontSize: 0,
  fontFamily: null,
});

type EditorView = Awaited<ReturnType<Awaited<ReturnType<typeof loadSuduApi>>['newEditor']>>;
type TextModel = ReturnType<Awaited<ReturnType<typeof loadSuduApi>>['newTextModelFromLines']>;

let editor: EditorView | null = null;
let model: TextModel | null = null;
let pool: Awaited<ReturnType<typeof getSuduWorkerPool>> | null = null;
let disposed = false;
/** Device px applied by the parent; its own scroll echo must not bounce back. */
let pendingEcho = -1;

const fileOptions = computed<SourceSelectOption[]>(() => {
  const files = props.files?.length ? props.files : [props.metrics];
  return files.map((file) => ({
    id: file.id,
    label: file.path.split(/[\\/]/).pop() || file.path,
  }));
});
const activeFileId = computed(() => props.activeFileId ?? props.metrics.id);

function sideLine(row: DiffRow): number | null {
  return props.side === 'left' ? row.leftLine : row.rightLine;
}

function sideText(row: DiffRow): string {
  return props.side === 'left' ? row.leftText : row.rightText;
}

const descriptors = computed<ILineDescriptor[]>(() =>
  props.rows.map((row) => {
    const line = sideLine(row);
    const tokens = [{ text: sideText(row) }];
    return line == null ? { tokens } : { lineNumber: line, tokens };
  }),
);

/** Search highlights are 1-based document lines — the view row index + 1. */
const modelText = computed(() => props.rows.map(sideText).join('\n'));

const metricsByLine = computed(() => {
  const map = new Map<number, SourceLineMetrics>();
  for (const line of props.metrics.lines) map.set(line.line, line);
  return map;
});

/**
 * SourceMetricsTable looks values up by `line`, so feed it view rows and copy the
 * values of that row's source line. Filler rows carry no values.
 */
const viewMetrics = computed<SourceFileModel>(() => ({
  ...props.metrics,
  lines: props.rows.map((row, index) => {
    const sourceLine = sideLine(row);
    const hit = sourceLine == null ? undefined : metricsByLine.value.get(sourceLine);
    return { line: index + 1, values: hit?.values ?? {}, stallBreakdown: hit?.stallBreakdown };
  }),
}));

/** Header columns reuse the body table's default widths so labels sit over their values. */
const metricColumns = computed(() => props.metrics.metricsColumns);
const navigateOptions = computed<SourceSelectOption[]>(() =>
  metricColumns.value.map((col) => ({ id: col.id, label: col.label })),
);
const navigateValue = computed(
  () =>
    navigateOptions.value.find((opt) => opt.id === props.highlightColumn)?.id ??
    navigateOptions.value[0]?.id ??
    '',
);
const metricWidths = computed(() =>
  ensureSourceColWidths(metricColumns.value.map((col) => col.id)),
);

function metricColStyle(colId: string): { width: string; minWidth: string } {
  const total = Object.values(metricWidths.value).reduce((sum, px) => sum + px, 0) || 1;
  return {
    width: `${((metricWidths.value[colId] ?? 100) / total) * 100}%`,
    minWidth: `${SOURCE_COL_WIDTH_MIN}px`,
  };
}

type BandTone = 'changed' | 'only';

const bands = computed(() => {
  const out: { top: number; tone: BandTone }[] = [];
  props.rows.forEach((row, index) => {
    if (row.kind === 'same') return;
    // A row this side does not contain has no band: the pane background shows through.
    const own = row.kind === 'onlyLeft' ? 'left' : 'right';
    if (row.kind !== 'changed' && own !== props.side) return;
    const tone: BandTone = row.kind === 'changed' ? 'changed' : 'only';
    out.push({ top: index * rowH.value, tone });
  });
  return out;
});

function bandClass(tone: BandTone): string {
  return `pr-src-diff-pane__band--${tone}`;
}

function bandBackground(tone: BandTone, plane: 'code' | 'metrics'): string {
  if (tone === 'changed') return plane === 'metrics' ? BAND_CHANGED_METRICS : BAND_CHANGED_CODE;
  return plane === 'metrics' ? BAND_ONLY_METRICS : BAND_ONLY_CODE;
}

function onEditorScroll(vScrollPos: number): void {
  if (!(geom.value.dpr > 0)) return;
  const css = cssScrollFromDevice(vScrollPos, geom.value.dpr);
  const scroll = tableScrollEl.value;
  if (scroll && Math.abs(scroll.scrollTop - css) >= 0.5) scroll.scrollTop = css;
  // The table clamps at its own scroll range; the band overlay rides on it, so the
  // applied (clamped) offset is the only row basis both layers agree on.
  const applied = scroll ? scroll.scrollTop : css;
  if (applied !== css) {
    const devicePos = deviceScrollFromCss(applied, geom.value.dpr);
    if (devicePos !== vScrollPos) editor?.setVScrollPos(devicePos);
  }
  scrollCss.value = applied;
  if (vScrollPos === pendingEcho) return;
  props.scrollListener?.(applied);
}

function onTableScroll(): void {
  const scroll = tableScrollEl.value;
  if (!editor || !(geom.value.dpr > 0) || !scroll) return;
  const devicePos = deviceScrollFromCss(scroll.scrollTop, geom.value.dpr);
  if (devicePos === pendingEcho) return;
  pendingEcho = devicePos;
  editor.setVScrollPos(devicePos);
  pendingEcho = -1;
  scrollCss.value = scroll.scrollTop;
  props.scrollListener?.(scroll.scrollTop);
}

/** Metrics row click — move the editor caret so the matching source row lights up. */
function onRowClick(line: number): void {
  currentLine.value = line;
  if (!editor) return;
  editor.setPosition({ lineNumber: line, column: 1 });
  editor.focus();
}

/** Canvas click keeps the metrics row on the caret line (Sudu only notifies on changes). */
function onEditorPointerDown(): void {
  if (!editor) return;
  const line = editor.getPosition?.()?.lineNumber;
  if (line == null) return;
  void nextTick(() => {
    const now = editor?.getPosition?.()?.lineNumber;
    if (now != null) currentLine.value = now;
  });
}

function readGeom(): boolean {
  if (!editor) return false;
  const next: EditorGeometry = {
    dpr: editor.getDevicePixelRatio(),
    lineHeight: editor.getLineHeight(),
    editorHeight: editor.getEditorHeight(),
    maxVScrollPos: editor.getMaxVScrollPos(),
    numLines: editor.getNumLines(),
    fontSize: editor.getFontSize(),
    fontFamily: editor.getFontFamily(),
  };
  if (!isUsableGeometry(next)) return false;
  geom.value = next;
  rowH.value = cssRowHeight(next);
  filler.value = trailingRowCount(next);
  return true;
}

function waitForGeom(): void {
  if (disposed || readGeom()) return;
  requestAnimationFrame(waitForGeom);
}

function bindTableScroll(): void {
  if (tableScrollEl.value) return;
  tableScrollEl.value =
    rootEl.value?.querySelector<HTMLElement>('[data-testid="source-metrics-scroll"]') ?? null;
  tableScrollEl.value?.addEventListener('scroll', onTableScroll);
}

function applySearch(): void {
  if (!editor) return;
  const ranges = matchRanges(modelText.value, props.searchQuery ?? '');
  editor.highlightRanges(ranges.length ? ranges : null);
}

function buildModel(api: Awaited<ReturnType<typeof loadSuduApi>>): void {
  if (!editor || !pool) return;
  model?.dispose();
  model = api.newTextModelFromLines(
    pool,
    descriptors.value,
    props.metrics.language,
    { path: props.metrics.path },
  );
  editor.setModel(model);
  editor.setVScrollPos(0);
  scrollCss.value = 0;
}

async function boot(): Promise<void> {
  try {
    const api = await loadSuduApi();
    if (disposed || !editorHost.value) return;
    pool = await getSuduWorkerPool(props.workerUrl);
    if (disposed) return;
    editorHost.value.id = containerId;
    editor = api.newEditor({
      containerId,
      workers: pool,
      readonly: true,
      // Keep the language parser so the mapped lines keep syntax colors.
      disableParser: false,
      theme: editorTheme,
    });
    editor.setVScrollVisible(false);
    buildModel(api);
    editor.setVScrollListener(onEditorScroll);
    editor.setCaretListener?.((lineNumber) => {
      currentLine.value = lineNumber;
    });
    applySearch();
    bindTableScroll();
    waitForGeom();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  }
}

watch(descriptors, async () => {
  if (!editor) return;
  buildModel(await loadSuduApi());
  applySearch();
  bindTableScroll();
});

watch(
  () => props.metrics.path,
  async () => {
    if (!editor) return;
    buildModel(await loadSuduApi());
  },
);

watch(
  () => props.searchQuery,
  () => applySearch(),
);

onMounted(() => {
  void boot();
});

onBeforeUnmount(() => {
  disposed = true;
  tableScrollEl.value?.removeEventListener('scroll', onTableScroll);
  tableScrollEl.value = null;
  editor?.dispose();
  editor = null;
  model?.dispose();
  model = null;
});

/** Parent-driven scroll (keeps pane A's wheel in sync with pane B). */
function setScrollCss(css: number): void {
  if (!editor || !(geom.value.dpr > 0)) return;
  const scroll = tableScrollEl.value;
  if (scroll) scroll.scrollTop = css;
  // Clamp to the table's range so bands, table rows and the editor share one offset.
  const applied = scroll ? scroll.scrollTop : css;
  const devicePos = deviceScrollFromCss(applied, geom.value.dpr);
  pendingEcho = devicePos;
  editor.setVScrollPos(devicePos);
  scrollCss.value = applied;
}

/** Jump to a view row (change navigation). */
function scrollToRow(index: number): void {
  setScrollCss(Math.max(0, index * rowH.value));
}

function getScrollCss(): number {
  return tableScrollEl.value?.scrollTop ?? scrollCss.value;
}

defineExpose({ setScrollCss, scrollToRow, getScrollCss });
</script>

<template>
  <div
    ref="rootEl"
    class="pr-src-diff-pane"
    role="region"
    :aria-label="t(side === 'left' ? 'sourceDiffLeftPane' : 'sourceDiffRightPane', locale)"
    :data-side="side"
    :data-testid="`source-diff-pane-${side}`"
    :style="{ '--pr-src-gutter-w': `${gutterCss}px` }"
  >
    <div class="pr-src-diff-pane__bar">
      <SourcePillSelect
        class="pr-src-diff-pane__file"
        :caption="t('sourceDiffSourcePane', locale)"
        :model-value="activeFileId"
        :options="fileOptions"
        :test-id="`source-diff-file-${side}`"
        @update:model-value="emit('select-file', $event)"
      />
      <button
        type="button"
        class="pr-src-diff-pane__icon-btn"
        :class="{ 'pr-src-diff-pane__icon-btn--on': linked }"
        :data-testid="`source-diff-link-${side}`"
        :aria-label="t('sourceLinkSync', locale)"
        :aria-pressed="linked"
        :title="t('sourceLinkSync', locale)"
        @click="emit('toggle-link')"
      >
        <PrIcon name="link" />
      </button>
      <SourcePillSelect
        class="pr-src-diff-pane__nav"
        :caption="t('sourceNavigateBy', locale)"
        :model-value="navigateValue"
        :options="navigateOptions"
        :test-id="`source-diff-navigate-${side}`"
        @update:model-value="emit('update:navigateBy', $event)"
      />
    </div>
    <div
      class="pr-src-diff-pane__surface"
      :class="{ 'pr-src-diff-pane__surface--focused': side === 'left' }"
    >
      <div
        class="pr-src-diff-pane__head"
        data-testid="source-diff-head"
        :style="{ height: '30px', lineHeight: '30px' }"
      >
      <div class="pr-src-diff-pane__head-editor">
        <table class="pr-src-diff-pane__head-table">
          <colgroup>
            <col class="pr-src-diff-pane__col-line">
            <col>
          </colgroup>
          <thead>
            <tr>
              <th title="#">
                #
              </th>
              <th :title="t('sourceDiffSourcePane', locale)">
                {{ t('sourceDiffSourcePane', locale) }}
              </th>
            </tr>
          </thead>
        </table>
      </div>
      <div class="pr-src-diff-pane__head-metrics">
        <table class="pr-src-diff-pane__head-table">
          <colgroup>
            <col
              v-for="col in metricColumns"
              :key="col.id"
              :style="metricColStyle(col.id)"
            >
          </colgroup>
          <thead>
            <tr>
              <th
                v-for="col in metricColumns"
                :key="col.id"
                :title="col.label"
              >
                <span class="pr-src-diff-pane__th-label">{{ col.label }}</span>
              </th>
            </tr>
          </thead>
        </table>
      </div>
    </div>
    <div class="pr-src-diff-pane__body">
      <div
        ref="editorHost"
        class="pr-src-diff-pane__editor"
        @pointerdown="onEditorPointerDown"
      />
      <p
        v-if="loadError"
        class="pr-src-diff-pane__error"
        :data-testid="`source-diff-error-${side}`"
      >
        {{ loadError }}
      </p>
      <SourceMetricsTable
        :file="viewMetrics"
        :current-line="null"
        :row-height-css="rowH"
        :show-header="false"
        :show-line-numbers="false"
        :filler-rows="filler"
        :locale="locale"
        compare
        @row-click="onRowClick"
      />
      <div
        class="pr-src-diff-pane__tint"
        aria-hidden="true"
      >
        <div
          class="pr-src-diff-pane__tint-layer"
          :style="{ transform: `translateY(${-scrollCss}px)` }"
        >
          <template
            v-for="(band, i) in bands"
            :key="i"
          >
            <div
              class="pr-src-diff-pane__band pr-src-diff-pane__band--code"
              :class="bandClass(band.tone)"
              :data-row-tint="band.tone"
              :style="{ top: `${band.top}px`, height: `${rowH}px`, background: bandBackground(band.tone, 'code') }"
            />
            <div
              class="pr-src-diff-pane__band pr-src-diff-pane__band--metrics"
              :class="bandClass(band.tone)"
              :data-row-tint="`${band.tone}-metrics`"
              :style="{ top: `${band.top}px`, height: `${rowH}px`, background: bandBackground(band.tone, 'metrics') }"
            />
          </template>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.pr-src-diff-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  background: var(--pr-bg-deep, #1f1f1f);
}

.pr-src-diff-pane__bar {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 8px;
  min-height: 52px;
}

/* v930 sketch pane bar: flat #2a2a2a pills, no border, #999 text. */
.pr-src-diff-pane__bar :deep(.pr-source-view__field) {
  gap: 8px;
  min-width: 0;
}

.pr-src-diff-pane__bar :deep(.pr-block-pill) {
  border: 0;
  border-radius: 4px;
  background-color: #2a2a2a;
  color: #999999;
}

.pr-src-diff-pane__nav :deep(.pr-source-view__select) {
  width: 174px;
  max-width: 174px;
}

.pr-src-diff-pane__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: #363636;
  color: #b3b3b3;
  cursor: pointer;
}

.pr-src-diff-pane__icon-btn:hover {
  background: var(--pr-surface-hover, #424242);
  color: #ffffff;
}

.pr-src-diff-pane__icon-btn:focus-visible {
  outline: 2px solid var(--pr-playhead, #3078f0);
  outline-offset: 1px;
}

.pr-src-diff-pane__icon-btn--on,
.pr-src-diff-pane__icon-btn[aria-pressed='true'] {
  background: #363636;
  color: #e6e6e6;
}

.pr-src-diff-pane__surface {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--pr-border-gutter, #313131);
  border-radius: 6px 6px 0 0;
}

.pr-src-diff-pane__surface--focused {
  border-color: var(--pr-playhead, #3078f7);
}
/* canvas composites over an inset box-shadow/outline, so the 2px ring is its own layer */
.pr-src-diff-pane__surface--focused::after {
  position: absolute;
  inset: 0;
  z-index: 5;
  border: 1px solid var(--pr-playhead, #3078f7);
  border-radius: 6px 6px 0 0;
  pointer-events: none;
  content: '';
}

.pr-src-diff-pane__head {
  box-sizing: border-box;
  display: flex;
  flex: 0 0 auto;
  overflow: hidden;
  background: #2a2a2a;
  border-bottom: 1px solid var(--pr-border-separator, #2a2a2a);
  border-radius: 6px 6px 0 0;
}

.pr-src-diff-pane__head-editor {
  flex: 0 0 55.5%;
  min-width: 0;
  overflow: hidden;
}

.pr-src-diff-pane__head-metrics {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
}

.pr-src-diff-pane__head-table {
  width: 100%;
  height: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 400;
  background: #2a2a2a;
}

.pr-src-diff-pane__head-table th {
  padding: 0 16px;
  color: #b3b3b3;
  text-align: left;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pr-src-diff-pane__col-line {
  width: var(--pr-src-gutter-w, 20px);
}

.pr-src-diff-pane__th-label {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 6px;
}

.pr-src-diff-pane__body {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

/* Metrics fill the remaining width so the head columns sit over their values. */
.pr-src-diff-pane__body :deep(.pr-src-metrics) {
  flex: 1 1 0;
}

.pr-src-diff-pane__editor {
  position: relative;
  flex: 0 0 55.5%;
  min-width: 0;
  overflow: hidden;
}

/* Screen blend over the canvas and metric cells: separate bands keep each plane's tone. */
.pr-src-diff-pane__tint {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  mix-blend-mode: screen;
}

.pr-src-diff-pane__tint-layer {
  position: absolute;
  inset: 0;
}

.pr-src-diff-pane__band {
  position: absolute;
}

.pr-src-diff-pane__band--code {
  left: var(--pr-src-gutter-w, 20px);
  right: 44.5%;
}

.pr-src-diff-pane__band--metrics {
  left: 55.5%;
  right: 0;
}

.pr-src-diff-pane__error {
  position: absolute;
  margin: 8px;
  color: var(--pr-text-muted, #9aa0a6);
  font-size: 12px;
}
</style>
