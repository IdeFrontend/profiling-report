<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from 'vue';
import type { SourceFileModel } from '../../domain/types';
import SourceMetricsTable from './SourceMetricsTable.vue';
import {
  cssRowHeight,
  cssScrollFromDevice,
  deviceScrollFromCss,
  isUsableGeometry,
  trailingRowCount,
  type EditorGeometry,
} from './editorTableSync';
import {
  SOURCE_TAB_EDITOR_FONT,
  SOURCE_TAB_MONO_FAMILY,
} from './sourceFonts';
import {
  getSuduWorkerPool,
  loadSuduApi,
  type SuduWorkerPool,
} from './suduRuntime';
import {
  ensureSourceColWidths,
  sourceColCanResize,
  SOURCE_COL_WIDTH_MIN,
  startSourceColBoundaryResize,
} from './sourceColumnResize';
import { t } from '../../i18n';

/** Match `.pr-sudu-pane__editor` canvas plane. */
const SUDU_EDITOR_BG = '#1a1a1a';
/** `ThemeColor.CurrentLineBorder` / `CurrentLineBackground` (const enum → number). */
const SUDU_THEME_CURRENT_LINE_BORDER = 13;
const SUDU_THEME_CURRENT_LINE_BG = 14;

function suduEditorTheme(opts?: { hideCurrentLine?: boolean }) {
  return {
    baseTheme: 'dark' as const,
    editorFont: {
      family: SOURCE_TAB_EDITOR_FONT.family,
      size: SOURCE_TAB_EDITOR_FONT.size,
      weight: SOURCE_TAB_EDITOR_FONT.weight,
    },
    ...(opts?.hideCurrentLine
      ? {
          // Sudu keeps painting currentLineBg after blur; match the canvas so it disappears.
          [SUDU_THEME_CURRENT_LINE_BORDER]: SUDU_EDITOR_BG,
          [SUDU_THEME_CURRENT_LINE_BG]: SUDU_EDITOR_BG,
        }
      : {}),
  };
}

const props = withDefaults(
  defineProps<{
    file: SourceFileModel;
    workerUrl: string;
    /** Editor flex share (0–1). */
    editorRatio?: number;
    currentLine?: number | null;
    correlatedLines?: number[];
    matchLines?: number[];
    dimZeroFor?: string | null;
    /** When true, table scroll follows editor (and vice versa). */
    followScroll?: boolean;
  }>(),
  {
    editorRatio: 0.62,
    currentLine: null,
    correlatedLines: () => [],
    matchLines: () => [],
    dimZeroFor: null,
    followScroll: true,
  },
);

const emit = defineEmits<{
  'update:currentLine': [line: number];
  'row-click': [line: number];
}>();

const domId = useId().replace(/:/g, '');
const containerId = `pr-sudu-${domId}`;
const rootEl = ref<HTMLElement | null>(null);
const editorHost = ref<HTMLElement | null>(null);
const tableScrollEl = ref<HTMLElement | null>(null);

const geom = ref<EditorGeometry>({
  dpr: 0,
  lineHeight: 0,
  editorHeight: 0,
  maxVScrollPos: 0,
  numLines: 0,
  fontSize: 0,
  fontFamily: null,
});

const rowH = ref(20);
const filler = ref(0);
const fontSizeCss = ref(12);
const fontFamily = ref<string | null>(null);
const ready = ref(false);
const loadError = ref<string | null>(null);

type EditorView = Awaited<ReturnType<Awaited<ReturnType<typeof loadSuduApi>>['newEditor']>>;
type TextModel = ReturnType<Awaited<ReturnType<typeof loadSuduApi>>['newTextModel']>;

let editor: EditorView | null = null;
let model: TextModel | null = null;
let pool: SuduWorkerPool | null = null;
let pendingEcho = -1;
let disposed = false;
/** Selection requested before Sudu finished booting — applied in boot(). */
let pendingLine: number | null = null;
/**
 * Suppress caret→emit while setLine is programmatic (asm→source). Cleared
 * synchronously after setPosition/reveal — Sudu’s caret listener is sync with
 * setPosition (standalone-sample); no timer.
 */
let ignoreCaret = false;

const metricColumns = computed(() => props.file.metricsColumns);
const metricColIds = computed(() => metricColumns.value.map((c) => c.id));

const metricColWidths = ref<Record<string, number>>(
  ensureSourceColWidths(metricColIds.value),
);

watch(
  metricColIds,
  (ids) => {
    metricColWidths.value = ensureSourceColWidths(ids, metricColWidths.value);
  },
  { deep: true },
);

function metricColStyle(colId: string): { width: string; minWidth: string } {
  const ids = metricColIds.value;
  const total = ids.reduce((sum, id) => sum + (metricColWidths.value[id] ?? 100), 0) || 1;
  const px = metricColWidths.value[colId] ?? 100;
  // Shares of preferred px — boundary drag keeps the total fixed so other lines stay put.
  return {
    width: `${(px / total) * 100}%`,
    minWidth: `${SOURCE_COL_WIDTH_MIN}px`,
  };
}

let metricResizeSession: ReturnType<typeof startSourceColBoundaryResize> | null = null;

function onMetricColResizeDown(colId: string, e: PointerEvent) {
  if (e.button !== 0) return;
  if (!sourceColCanResize(metricColIds.value, colId)) return;
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  metricResizeSession = startSourceColBoundaryResize({
    startClientX: e.clientX,
    leftId: colId,
    ids: metricColIds.value,
    startWidths: metricColWidths.value,
    onChange: (next) => {
      metricColWidths.value = next;
    },
  });
  e.preventDefault();
  e.stopPropagation();
}

function onMetricColResizeMove(e: PointerEvent) {
  metricResizeSession?.move(e.clientX);
}

function onMetricColResizeUp() {
  metricResizeSession?.end();
  metricResizeSession = null;
}

const metricsTableRef = ref<InstanceType<typeof SourceMetricsTable> | null>(null);
const headerColsEl = ref<HTMLElement | null>(null);

function onMetricsScrollLeft(left: number) {
  if (headerColsEl.value) headerColsEl.value.scrollLeft = left;
}

function onHeaderColsScroll() {
  const left = headerColsEl.value?.scrollLeft ?? 0;
  metricsTableRef.value?.setScrollLeft(left);
}

const paneStyle = computed(() => ({
  '--pr-editor-ratio': String(props.editorRatio ?? 0.45),
  '--pr-src-row-h': `${rowH.value || 20}px`,
  '--pr-src-font-size': `${fontSizeCss.value || 12}px`,
  '--pr-src-font-family': fontFamily.value || SOURCE_TAB_MONO_FAMILY,
}));

async function boot() {
  loadError.value = null;
  try {
    const api = await loadSuduApi();
    if (disposed) return;
    pool = await getSuduWorkerPool(props.workerUrl);
    if (disposed) return;
    if (!editorHost.value) return;
    editorHost.value.id = containerId;
    editor = api.newEditor({
      containerId,
      workers: pool,
      readonly: true,
      // Sample also passes disableParser: true; single-editor default is already on.
      disableParser: true,
      // Theme object (not bare 'dark') so editorFont overrides Sudu’s 16px/300 default.
      theme: suduEditorTheme(),
    });
    editor.setVScrollVisible(false);
    model = api.newTextModel(
      pool,
      props.file.text,
      props.file.language,
      { path: props.file.path },
    );
    editor.setModel(model);
    wireSync();
    // Apply selection chosen before boot finished (asm click / parent setLine).
    const bootLine = pendingLine ?? props.currentLine;
    if (bootLine != null) {
      pendingLine = null;
      setLine(bootLine);
    }
    waitForGeom();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
    ready.value = true; // show fallback
  }
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
  fontSizeCss.value = next.fontSize / next.dpr;
  fontFamily.value = next.fontFamily;
  return true;
}

function waitForGeom() {
  if (disposed) return;
  if (readGeom()) {
    ready.value = true;
    return;
  }
  requestAnimationFrame(waitForGeom);
}

function wireSync() {
  if (!editor) return;
  // Match standalone-sample/editorAndTable.js: device-px vscroll ↔ CSS table scroll.
  editor.setVScrollListener((vScrollPos: number) => {
    if (vScrollPos === pendingEcho) return;
    if (props.followScroll === false) return;
    const scroll = tableScrollEl.value;
    if (!scroll || !(geom.value.dpr > 0)) return;
    const target = cssScrollFromDevice(vScrollPos, geom.value.dpr);
    if (Math.abs(scroll.scrollTop - target) >= 0.5) scroll.scrollTop = target;
  });
  // Caret movement is synchronous with Sudu; table current-row + parent sync follow it.
  editor.setCaretListener((lineNumber: number) => {
    if (ignoreCaret) return;
    emit('update:currentLine', lineNumber);
  });
}

function onTableScroll() {
  if (props.followScroll === false) return;
  if (!editor || !(geom.value.dpr > 0)) return;
  const scroll = tableScrollEl.value;
  if (!scroll) return;
  const devicePos = deviceScrollFromCss(scroll.scrollTop, geom.value.dpr);
  pendingEcho = devicePos;
  editor.setVScrollPos(devicePos);
  pendingEcho = -1;
}

/**
 * Metrics row click — same as the sample: move caret only; Sudu keeps it visible
 * with minimum scroll, paints the current-line highlight, and setCaretListener
 * notifies the parent (no custom canvas overlay, no revealLineInCenter).
 */
function onRowClick(line: number) {
  emit('row-click', line);
  if (!editor) {
    emit('update:currentLine', line);
    return;
  }
  editor.setPosition({ lineNumber: line, column: 1 });
  editor.focus();
}

/**
 * Drive caret from the other pane (asm → source).
 * Sudu only paints the caret while focused (`drawCaret` gates on hasFocus) — so
 * focus() is required for the line to look selected. Caret listener may emit;
 * SourceView’s syncOrigin / same-group stay absorbs the bounce (no ignoreCaret).
 */
function setLine(line: number) {
  if (!editor) return;
  editor.setTheme(suduEditorTheme());
  editor.setPosition({ lineNumber: line, column: 1 });
  editor.revealLine(line);
  editor.focus();
}

/**
 * Drop editor selection when the opposite pane has no mapped source line.
 * Sudu has no clearSelection API: blur hides the caret; theme override hides
 * currentLineBg (still painted for caretLine after blur).
 */
function clearLine() {
  pendingLine = null;
  if (!editor) return;
  ignoreCaret = true;
  try {
    editor.setTheme(suduEditorTheme({ hideCurrentLine: true }));
    const canvas = editorHost.value?.querySelector('canvas');
    if (canvas instanceof HTMLElement) canvas.blur();
  } finally {
    ignoreCaret = false;
  }
}

/** Queue a line until Sudu finishes booting, then apply. */
function setLineOrQueue(line: number) {
  if (!editor) {
    pendingLine = line;
    return;
  }
  pendingLine = null;
  setLine(line);
}

/** Scroll editor + metrics table to the top without emitting caret (parent owns line). */
function scrollToTop() {
  const scroll = tableScrollEl.value;
  if (scroll) scroll.scrollTop = 0;
  if (!editor) return;
  ignoreCaret = true;
  try {
    editor.setVScrollPos(0);
    editor.setPosition({ lineNumber: 1, column: 1 });
    editor.revealLine(1);
  } finally {
    ignoreCaret = false;
  }
}

/** Scroll editor + metrics table to the bottom without emitting caret (parent owns line). */
function scrollToBottom() {
  const scroll = tableScrollEl.value;
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
  if (!editor) return;
  ignoreCaret = true;
  try {
    const last = Math.max(1, editor.getNumLines());
    editor.setVScrollPos(editor.getMaxVScrollPos());
    editor.setPosition({ lineNumber: last, column: 1 });
    editor.revealLine(last);
  } finally {
    ignoreCaret = false;
  }
}

watch(
  () => props.file,
  async (file) => {
    if (!editor || !pool || !model) return;
    const api = await loadSuduApi();
    const prev = model;
    model = api.newTextModel(
      pool,
      file.text,
      file.language,
      { path: file.path },
    );
    editor.setModel(model);
    prev.dispose();
    readGeom();
    if (props.currentLine != null) setLine(props.currentLine);
  },
);

/** Keep canvas caret in sync when parent drives selection (e.g. asm → source). */
watch(
  () => props.currentLine,
  (line) => {
    if (disposed) return;
    if (line == null) {
      clearLine();
      return;
    }
    if (!editor) {
      pendingLine = line;
      return;
    }
    const pos = editor.getPosition?.();
    // Already on the line — setPosition is a no-op for caret; do not fight scroll.
    if (pos && pos.lineNumber === line) return;
    setLine(line);
  },
);

onMounted(() => {
  void boot().then(() => {
    tableScrollEl.value =
      rootEl.value?.querySelector<HTMLElement>('[data-testid="source-metrics-scroll"]') ?? null;
    tableScrollEl.value?.addEventListener('scroll', onTableScroll);
  });
});

onBeforeUnmount(() => {
  disposed = true;
  ignoreCaret = false;
  metricResizeSession?.end();
  metricResizeSession = null;
  tableScrollEl.value?.removeEventListener('scroll', onTableScroll);
  editor?.setVScrollListener(null);
  editor?.setCaretListener(null);
  editor?.dispose();
  model?.dispose();
  editor = null;
  model = null;
});

defineExpose({ setLine: setLineOrQueue, clearLine, scrollToTop, scrollToBottom, containerId });
</script>

<template>
  <!--
    Standalone-sample layout: metrics column titles sit in a header row *above*
    both the editor and the table body. An empty pad mirrors the editor width so
    line 1 of code lines up with the first metrics data row (not with the titles).
  -->
  <div
    ref="rootEl"
    class="pr-sudu-pane"
    data-testid="sudu-code-pane"
    :style="paneStyle"
  >
    <div
      class="pr-sudu-pane__header-row"
      data-testid="sudu-metrics-header-row"
    >
      <!-- Sketch: # + Source sit over the editor gutter/code (not an empty pad). -->
      <div
        class="pr-sudu-pane__hpad"
        data-testid="sudu-source-header-titles"
      >
        <table class="pr-sudu-pane__source-head">
          <colgroup>
            <col class="pr-sudu-pane__col-line">
            <col class="pr-sudu-pane__col-source">
          </colgroup>
          <thead>
            <tr>
              <th
                class="pr-sudu-pane__th-left"
                title="#"
              >
                #
              </th>
              <th
                class="pr-sudu-pane__th-left"
                title="Source"
              >
                Source
              </th>
            </tr>
          </thead>
        </table>
      </div>
      <div class="pr-sudu-pane__hsplit" />
      <div
        ref="headerColsEl"
        class="pr-sudu-pane__hcols"
        data-testid="sudu-metrics-header-cols"
        @scroll="onHeaderColsScroll"
      >
        <table class="pr-sudu-pane__head-table">
          <colgroup>
            <col
              v-for="col in metricColumns"
              :key="col.id"
              :class="`pr-src-metrics__col--${col.id}`"
              :style="metricColStyle(col.id)"
            >
          </colgroup>
          <thead>
            <tr>
              <th
                v-for="col in metricColumns"
                :key="col.id"
                :title="col.label"
                class="pr-sudu-pane__metric-th"
                :class="{ 'pr-sudu-pane__th-left': col.id === 'address' }"
              >
                <span class="pr-sudu-pane__th-label">{{ col.label }}</span>
                <span
                  v-if="sourceColCanResize(metricColIds, col.id)"
                  class="pr-sudu-pane__col-resize"
                  data-testid="source-col-resize"
                  :data-col="col.id"
                  role="separator"
                  :aria-label="t('sourceResizeColumn')"
                  @pointerdown="onMetricColResizeDown(col.id, $event)"
                  @pointermove="onMetricColResizeMove"
                  @pointerup="onMetricColResizeUp"
                  @pointercancel="onMetricColResizeUp"
                />
              </th>
            </tr>
          </thead>
        </table>
      </div>
    </div>

    <div class="pr-sudu-pane__body">
      <div
        ref="editorHost"
        class="pr-sudu-pane__editor"
        data-testid="sudu-editor-host"
      >
        <pre
          v-if="loadError"
          class="pr-sudu-pane__fallback"
          data-testid="sudu-fallback"
        >{{ file.text }}</pre>
      </div>
      <div class="pr-sudu-pane__splitter" />
      <div class="pr-sudu-pane__table">
        <SourceMetricsTable
          ref="metricsTableRef"
          :file="file"
          :current-line="currentLine ?? null"
          :correlated-lines="correlatedLines"
          :match-lines="matchLines"
          :dim-zero-for="dimZeroFor"
          :row-height-css="rowH"
          :filler-rows="filler"
          :font-family="fontFamily"
          :font-size-css="fontSizeCss"
          :show-header="false"
          v-model:column-widths="metricColWidths"
          @scroll-left="onMetricsScrollLeft"
          @row-click="onRowClick"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pr-sudu-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  --pr-editor-ratio: 0.62;
  --pr-splitter-w: 1px;
  --pr-src-row-h: 20px;
  --pr-src-font-size: 12px;
  --pr-src-font-family: monospace;
}

/* Same flex recipe as #header-row / #panes in sudu standalone-sample. */
.pr-sudu-pane__header-row,
.pr-sudu-pane__body {
  display: flex;
  min-width: 0;
}

.pr-sudu-pane__header-row {
  flex: 0 0 auto;
  height: var(--pr-src-row-h);
  background: #2a2a2a;
  border-bottom: 1px solid #333333;
  border-radius: 6px 6px 0 0;
}

.pr-sudu-pane__body {
  flex: 1 1 auto;
  min-height: 0;
}

.pr-sudu-pane__hpad,
.pr-sudu-pane__editor {
  flex: 0 0 calc(var(--pr-editor-ratio) * 100%);
  min-width: 0;
}

.pr-sudu-pane__hpad {
  display: flex;
  align-items: stretch;
  background: #2a2a2a;
  overflow: hidden;
}

.pr-sudu-pane__hsplit,
.pr-sudu-pane__splitter {
  flex: 0 0 var(--pr-splitter-w);
  background: #333333;
}

.pr-sudu-pane__hcols,
.pr-sudu-pane__table {
  flex: 1 1 auto;
  min-width: 0;
}

.pr-sudu-pane__hcols {
  /* 20px title row — hide overflow; body scrollLeft is mirrored in JS. */
  overflow: hidden;
}

/* Shared header chrome with SASS `# · Address · …` row (same face / grey). */
.pr-sudu-pane__source-head {
  width: 100%;
  height: var(--pr-src-row-h);
  table-layout: fixed;
  border-collapse: collapse;
  font-family: var(--pr-src-font-family);
  font-size: var(--pr-src-font-size);
  line-height: var(--pr-src-row-h);
  background: #2a2a2a;
}

.pr-sudu-pane__head-table {
  width: 100%;
  height: var(--pr-src-row-h);
  table-layout: fixed;
  border-collapse: collapse;
  border-radius: 6px 6px 0 0;
  overflow: hidden;
  font-family: var(--pr-src-font-family);
  font-size: var(--pr-src-font-size);
  line-height: var(--pr-src-row-h);
  background: #2a2a2a;
}

.pr-sudu-pane__source-head th,
.pr-sudu-pane__head-table th {
  padding: 0 8px;
  color: #b3b3b3;
  /* Match SourceMetricsTable: sketch headers are left-aligned UI sans at 11px. */
  text-align: left;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  height: var(--pr-src-row-h);
  background: #2a2a2a;
}

.pr-sudu-pane__head-table th:last-child {
  border-top-right-radius: 6px;
}

.pr-sudu-pane__metric-th {
  position: relative;
}

.pr-sudu-pane__th-label {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 6px;
}

.pr-sudu-pane__col-resize {
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
.pr-sudu-pane__col-resize::before {
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

.pr-sudu-pane__col-resize:hover,
.pr-sudu-pane__col-resize:active {
  background: rgba(48, 120, 240, 0.2);
}

.pr-sudu-pane__col-resize:hover::before,
.pr-sudu-pane__col-resize:active::before {
  background: #3078f0;
  width: 2px;
}

.pr-sudu-pane__col-line {
  width: 3.5rem;
}

.pr-sudu-pane__col-source {
  width: auto;
}

.pr-sudu-pane__th-left {
  text-align: left !important;
}

.pr-sudu-pane__editor {
  position: relative;
  height: 100%;
  background: #1a1a1a;
  overflow: hidden;
}

.pr-sudu-pane__table {
  height: 100%;
}

.pr-sudu-pane__fallback {
  margin: 0;
  padding: 8px;
  height: 100%;
  overflow: auto;
  color: #d0d0d0;
  font-size: 12px;
  white-space: pre;
}

</style>
