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
  ensureSourceTabFonts,
  SOURCE_TAB_EDITOR_FONT,
  SOURCE_TAB_MONO_STACK,
} from './sourceFonts';
import {
  ASCEND_C_LANG,
  applySuduLangOptions,
  enableAscendC,
  getSuduWorkerPool,
  loadSuduApi,
  type SuduWorkerPool,
} from './suduRuntime';

const props = withDefaults(
  defineProps<{
    file: SourceFileModel;
    workerUrl: string;
    codiconUrl?: string;
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
    codiconUrl: undefined,
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
 * Suppress caret→emit while setLine / setPosition is programmatic.
 * Sudu often echoes the caret asynchronously *after* a Vue nextTick, so we
 * swallow the next caret event (and fall back to clearing on nextTick).
 */
let ignoreCaret = false;
let ignoreCaretFallback: ReturnType<typeof setTimeout> | null = null;

/** Prefer ascend-c when LangOptions are wired; otherwise cpp so lexer still colors. */
function suduModelLanguage(language: string | undefined, ascendOptsReady: boolean): string {
  if (!language) return 'text';
  if (language === ASCEND_C_LANG && !ascendOptsReady) return 'cpp';
  return language;
}

function beginIgnoreCaret() {
  ignoreCaret = true;
  if (ignoreCaretFallback != null) clearTimeout(ignoreCaretFallback);
  // Real Sudu can emit after paint; keep the gate open briefly as a safety net.
  ignoreCaretFallback = setTimeout(() => {
    ignoreCaret = false;
    ignoreCaretFallback = null;
  }, 50);
}

function endIgnoreCaret() {
  ignoreCaret = false;
  if (ignoreCaretFallback != null) {
    clearTimeout(ignoreCaretFallback);
    ignoreCaretFallback = null;
  }
}

const metricColumns = computed(() => props.file.metricsColumns);

const paneStyle = computed(() => ({
  '--pr-editor-ratio': String(props.editorRatio ?? 0.45),
  '--pr-src-row-h': `${rowH.value || 20}px`,
  '--pr-src-font-size': `${fontSizeCss.value || 12}px`,
  '--pr-src-font-family': fontFamily.value
    ? `${fontFamily.value}, ${SOURCE_TAB_MONO_STACK}`
    : SOURCE_TAB_MONO_STACK,
}));

async function boot() {
  loadError.value = null;
  try {
    await ensureSourceTabFonts(props.codiconUrl);
    if (disposed) return;
    const api = await loadSuduApi();
    if (disposed) return;
    pool = await getSuduWorkerPool(props.workerUrl);
    if (disposed) return;
    if (!editorHost.value) return;
    editorHost.value.id = containerId;
    // Ascend C: code-review sample langOptions.js (disableAll + enable ascend-c).
    // If newLangOptions is missing (stale Vite prebundle), fall back to cpp so
    // the editor still highlights instead of crashing into the <pre> fallback.
    const langOptions =
      props.file.language === ASCEND_C_LANG ? enableAscendC(api) : null;
    editor = api.newEditor({
      containerId,
      workers: pool,
      readonly: true,
      // Sample also passes disableParser: true; single-editor default is already on.
      ...(langOptions ? { langOptions } : {}),
      // Theme object (not bare 'dark') so editorFont overrides Sudu’s 16px/300 default.
      theme: {
        baseTheme: 'dark',
        editorFont: {
          family: SOURCE_TAB_EDITOR_FONT.family,
          size: SOURCE_TAB_EDITOR_FONT.size,
          weight: SOURCE_TAB_EDITOR_FONT.weight,
        },
      },
    });
    // newEditor ignores EditArgs.langOptions in this package — apply before setModel.
    if (langOptions) applySuduLangOptions(editor, langOptions);
    model = api.newTextModel(
      pool,
      props.file.text,
      suduModelLanguage(props.file.language, !!langOptions),
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
  editor.setVScrollListener((vScrollPos: number) => {
    if (vScrollPos === pendingEcho) return;
    if (props.followScroll === false) return;
    const scroll = tableScrollEl.value;
    if (!scroll || !(geom.value.dpr > 0)) return;
    const target = cssScrollFromDevice(vScrollPos, geom.value.dpr);
    if (Math.abs(scroll.scrollTop - target) >= 0.5) scroll.scrollTop = target;
  });
  editor.setCaretListener((lineNumber: number) => {
    if (ignoreCaret) {
      // Absorb the programmatic echo so parent sync does not bounce back.
      endIgnoreCaret();
      return;
    }
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

function onRowClick(line: number) {
  // Emit selection from the click; ignore the caret echo from setPosition.
  emit('row-click', line);
  if (editor) {
    beginIgnoreCaret();
    editor.setPosition({ lineNumber: line, column: 1 });
    editor.revealLine(line);
    editor.focus();
    emit('update:currentLine', line);
  } else {
    emit('update:currentLine', line);
  }
}

/** Scroll metrics so `line` is visible (setPosition alone may not fire vscroll). */
function scrollMetricsToLine(line: number) {
  const scroll = tableScrollEl.value;
  const h = rowH.value || 20;
  if (!scroll || !(h > 0)) return;
  const top = (line - 1) * h;
  const bottom = top + h;
  if (top < scroll.scrollTop) scroll.scrollTop = top;
  else if (bottom > scroll.scrollTop + scroll.clientHeight) {
    scroll.scrollTop = bottom - scroll.clientHeight;
  }
}

/** Move caret without emitting — parent already owns the line state. */
function setLine(line: number) {
  if (!editor) return;
  beginIgnoreCaret();
  editor.setPosition({ lineNumber: line, column: 1 });
  // setPosition alone may leave the caret off-screen when focus is on the asm pane.
  editor.revealLine(line);
  scrollMetricsToLine(line);
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
  beginIgnoreCaret();
  editor.setVScrollPos(0);
  editor.setPosition({ lineNumber: 1, column: 1 });
  editor.revealLine(1);
}

watch(
  () => props.file,
  async (file) => {
    if (!editor || !pool || !model) return;
    const api = await loadSuduApi();
    const prev = model;
    const langOptions =
      file.language === ASCEND_C_LANG ? enableAscendC(api) : null;
    if (langOptions) applySuduLangOptions(editor, langOptions);
    model = api.newTextModel(
      pool,
      file.text,
      suduModelLanguage(file.language, !!langOptions),
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
    if (line == null || disposed) return;
    if (!editor) {
      pendingLine = line;
      return;
    }
    const pos = editor.getPosition?.();
    if (pos && pos.lineNumber === line) {
      // Still reveal — caret may be on-line but scrolled out of view.
      editor.revealLine(line);
      scrollMetricsToLine(line);
      return;
    }
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
  endIgnoreCaret();
  tableScrollEl.value?.removeEventListener('scroll', onTableScroll);
  editor?.setVScrollListener(null);
  editor?.setCaretListener(null);
  editor?.dispose();
  model?.dispose();
  editor = null;
  model = null;
});

defineExpose({ setLine: setLineOrQueue, scrollToTop, containerId });
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
      <div class="pr-sudu-pane__hcols">
        <table class="pr-sudu-pane__head-table">
          <colgroup>
            <col
              v-for="col in metricColumns"
              :key="col.id"
              :class="`pr-src-metrics__col--${col.id}`"
            >
          </colgroup>
          <thead>
            <tr>
              <th
                v-for="col in metricColumns"
                :key="col.id"
                :title="col.label"
                :class="{ 'pr-sudu-pane__th-left': col.id === 'address' }"
              >
                {{ col.label }}
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
  --pr-src-font-family: 'JetBrains Mono', ui-monospace, monospace;
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
  overflow: hidden;
  scrollbar-gutter: stable;
}

/* Shared header chrome with SASS `# · Address · …` row (same face / grey). */
.pr-sudu-pane__source-head,
.pr-sudu-pane__head-table {
  width: 100%;
  height: var(--pr-src-row-h);
  table-layout: fixed;
  border-collapse: collapse;
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

/*
 * Metrics-strip widths (header table sits outside SourceMetricsTable).
 * v930-source: the three metric headers read as similar weight, with Warp Occupancy
 * wide enough for the hatch bar (not the narrow leftover from label-start math).
 */
:deep(.pr-src-metrics__col--instructionsExecuted) {
  width: 28%;
}

:deep(.pr-src-metrics__col--samplingStall) {
  width: 28%;
}

:deep(.pr-src-metrics__col--warpOccupancy) {
  width: 44%;
}
</style>
