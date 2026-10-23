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
import { matchRanges, type SearchRange } from '../searchHighlight';
import { t } from '../../i18n';
import { selectedTextFromSudu } from './suduSelection';

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
    /** When non-empty, paints Sudu search highlights (`highlightRanges`). */
    searchQuery?: string;
    dimZeroFor?: string | null;
    /** When true, table scroll follows editor (and vice versa). */
    followScroll?: boolean;
  }>(),
  {
    editorRatio: 0.62,
    currentLine: null,
    correlatedLines: () => [],
    matchLines: () => [],
    searchQuery: '',
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
const copyMenu = ref<{ x: number; y: number } | null>(null);
const copyMenuEl = ref<HTMLElement | null>(null);
const copyMenuStyle = ref<Record<string, string>>({ position: 'fixed', left: '0px', top: '0px' });

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
/** Hide editor + metrics together until Sudu has real geometry. The host stays laid out so boot can measure. */
const showLoading = computed(() => !ready.value && loadError.value == null);

type EditorView = Awaited<ReturnType<Awaited<ReturnType<typeof loadSuduApi>>['newEditor']>>;
type TextModel = ReturnType<Awaited<ReturnType<typeof loadSuduApi>>['newTextModel']>;

/** Last ranges passed to `highlightRanges` — used to wrap selectNext/Prev. */
let paintedSearchRanges: SearchRange[] = [];

let editor: EditorView | null = null;
let model: TextModel | null = null;
let pool: SuduWorkerPool | null = null;
let pendingEcho = -1;
let disposed = false;
/** Selection requested before Sudu finished booting — applied in boot(). */
let pendingLine: number | null = null;
/**
 * True when `pendingLine` came from imperative `setLine` (asm jump).
 * Boot must echo that caret so the parent's sync gate can clear.
 * A `currentLine` watch (scroll-to-top/bottom) leaves this false and must not emit.
 */
let pendingCaretEcho = false;
/**
 * Suppress caret→emit while setLine is programmatic (asm→source). Cleared
 * synchronously after setPosition/reveal — Sudu’s caret listener is sync with
 * setPosition (standalone-sample); no timer.
 */
let ignoreCaret = false;
/** Set when the caret listener actually emitted (boot must not emit again). */
let caretEchoed = false;

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

function endMetricResizeSession() {
  if (!metricResizeSession) return;
  metricResizeSession.end();
  metricResizeSession = null;
  window.removeEventListener('pointermove', onMetricResizeWindowMove);
  window.removeEventListener('pointerup', onMetricResizeWindowUp);
  window.removeEventListener('pointercancel', onMetricResizeWindowUp);
}

function onMetricResizeWindowMove(e: PointerEvent) {
  metricResizeSession?.move(e.clientX);
}

function onMetricResizeWindowUp() {
  endMetricResizeSession();
}

function onMetricColResizeDown(colId: string, e: PointerEvent) {
  if (e.button !== 0) return;
  if (!sourceColCanResize(metricColIds.value, colId)) return;
  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture?.(e.pointerId);
  const table = el.closest('table');
  endMetricResizeSession();
  metricResizeSession = startSourceColBoundaryResize({
    startClientX: e.clientX,
    leftId: colId,
    ids: metricColIds.value,
    startWidths: metricColWidths.value,
    onChange: (next) => {
      metricColWidths.value = next;
    },
    trackWidthPx: table?.clientWidth,
  });
  window.addEventListener('pointermove', onMetricResizeWindowMove);
  window.addEventListener('pointerup', onMetricResizeWindowUp);
  window.addEventListener('pointercancel', onMetricResizeWindowUp);
  e.preventDefault();
  e.stopPropagation();
}

function onMetricColResizeMove(e: PointerEvent) {
  metricResizeSession?.move(e.clientX);
}

function onMetricColResizeUp() {
  endMetricResizeSession();
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
    applySearchHighlights();
    // Apply selection chosen before boot finished. Imperative setLine (asm jump)
    // must echo so syncOrigin can clear. Prop-driven lines (scroll) must not:
    // onSourceLine would drop correlationSuppressed and the forced caret.
    const echo = pendingCaretEcho;
    const bootLine = pendingLine ?? props.currentLine;
    pendingLine = null;
    pendingCaretEcho = false;
    // Bind before setLine so a vscroll during reveal can reach the table once
    // geometry exists. waitForGeom replays the caret if this event was dropped.
    bindTableScroll();
    if (bootLine != null) {
      if (echo) {
        caretEchoed = false;
        const applied = setLine(bootLine);
        // First setPosition after setCaretListener notifies even when the caret
        // stays put (lastNotifiedCaretLine is -1). If it did, do not emit the
        // requested line — Sudu may have clamped it.
        if (!caretEchoed && applied === 'unchanged') {
          const actual = editor.getPosition?.()?.lineNumber ?? bootLine;
          emit('update:currentLine', actual);
        }
      } else {
        ignoreCaret = true;
        try {
          setLine(bootLine);
        } finally {
          ignoreCaret = false;
        }
      }
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

function bindTableScroll() {
  if (tableScrollEl.value) return;
  tableScrollEl.value =
    rootEl.value?.querySelector<HTMLElement>('[data-testid="source-metrics-scroll"]') ?? null;
  tableScrollEl.value?.addEventListener('scroll', onTableScroll);
}

/** Editor may have scrolled before geometry or the table scroller existed. */
function syncTableToCaret() {
  if (!editor || !(geom.value.dpr > 0)) return;
  const line = editor.getPosition?.()?.lineNumber;
  // revealLine must not look like a user caret move (scroll suppression).
  ignoreCaret = true;
  try {
    if (line != null) editor.revealLine(line);
  } finally {
    ignoreCaret = false;
  }
  const scroll = tableScrollEl.value;
  if (!scroll) return;
  const target = cssScrollFromDevice(editor.getVScrollPos(), geom.value.dpr);
  if (Math.abs(scroll.scrollTop - target) >= 0.5) scroll.scrollTop = target;
}

function waitForGeom() {
  if (disposed) return;
  if (readGeom()) {
    bindTableScroll();
    syncTableToCaret();
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
  const ed = editor;
  ed.setCaretListener((lineNumber: number) => {
    if (ignoreCaret) return;
    caretEchoed = true;
    // clearLine's theme override survives arrow keys and editor clicks.
    ed.setTheme(suduEditorTheme());
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

function onEditorContextMenu(e: MouseEvent) {
  copyMenu.value = { x: e.clientX, y: e.clientY };
  copyMenuStyle.value = { position: 'fixed', left: `${e.clientX}px`, top: `${e.clientY}px` };
  void nextTick(() => clampCopyMenu(e.clientX, e.clientY));
}

function clampCopyMenu(x: number, y: number) {
  const el = copyMenuEl.value;
  if (!el || !copyMenu.value) return;
  const { width, height } = el.getBoundingClientRect();
  const left = Math.max(4, Math.min(x + width > window.innerWidth ? x - width : x, window.innerWidth - width - 4));
  const top = Math.max(4, Math.min(y + height > window.innerHeight ? y - height : y, window.innerHeight - height - 4));
  copyMenuStyle.value = { position: 'fixed', left: `${left}px`, top: `${top}px` };
}

function closeCopyMenu() {
  copyMenu.value = null;
}

function onCopyMenuPointerDown(e: PointerEvent) {
  if (!copyMenu.value) return;
  const node = e.target as Node | null;
  if (node && copyMenuEl.value?.contains(node)) return;
  closeCopyMenu();
}

function onCopyMenuKeydown(e: KeyboardEvent) {
  if (!copyMenu.value || e.key !== 'Escape') return;
  e.preventDefault();
  closeCopyMenu();
}

function detachCopyMenuListeners() {
  document.removeEventListener('pointerdown', onCopyMenuPointerDown, true);
  document.removeEventListener('keydown', onCopyMenuKeydown, true);
  window.removeEventListener('scroll', closeCopyMenu, true);
}

/** Copy the editor range. A caret with no range leaves the clipboard alone. */
function onCopySelection() {
  const text = selectedTextFromSudu(editor);
  closeCopyMenu();
  if (!text) return;
  const write = navigator.clipboard?.writeText?.bind(navigator.clipboard);
  if (write) {
    void write(text).catch(() => fallbackCopy(text));
    return;
  }
  fallbackCopy(text);
}

function fallbackCopy(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    ta.remove();
  }
}

watch(
  copyMenu,
  (open) => {
    if (open) {
      document.addEventListener('pointerdown', onCopyMenuPointerDown, true);
      document.addEventListener('keydown', onCopyMenuKeydown, true);
      window.addEventListener('scroll', closeCopyMenu, true);
    } else {
      detachCopyMenuListeners();
    }
  },
  { flush: 'sync' },
);

/** Paint (or clear) Sudu search segment highlights for the current query. */
function applySearchHighlights() {
  if (!editor) return;
  const ranges = matchRanges(props.file.text, props.searchQuery ?? '');
  paintedSearchRanges = ranges;
  editor.highlightRanges(ranges.length ? ranges : null);
}

/**
 * Enter find: step to next/prev painted highlight. Wraps when Sudu's
 * selectNext/Prev is a no-op (caret past the last / before the first match).
 */
function stepSearch(dir: 1 | -1) {
  if (!editor || paintedSearchRanges.length === 0) return;
  // A same-line match does not notify the caret listener, so restore the band here.
  editor.setTheme(suduEditorTheme());
  const before = editor.getPosition();
  if (dir === 1) editor.selectNextRange();
  else editor.selectPrevRange();
  const after = editor.getPosition();
  if (after.lineNumber === before.lineNumber && after.column === before.column) {
    const wrap = dir === 1 ? paintedSearchRanges[0]! : paintedSearchRanges[paintedSearchRanges.length - 1]!;
    editor.selectAndReveal(wrap, true, true);
  }
  editor.focus();
}

/**
 * Metrics row click — same as the sample: move caret only; Sudu keeps it visible
 * with minimum scroll, paints the current-line highlight, and setCaretListener
 * notifies the parent (no custom canvas overlay, no revealLineInCenter).
 */
/**
 * Canvas click. Sudu notifies only when the line changes, so a click on the
 * line clearLine left in place would leave the metrics row unselected.
 */
function onEditorPointerDown() {
  if (!editor) return;
  editor.setTheme(suduEditorTheme());
  const line = editor.getPosition?.()?.lineNumber;
  if (line == null) return;
  void nextTick(() => {
    if (!editor || ignoreCaret) return;
    const now = editor.getPosition?.()?.lineNumber;
    if (now === line && props.currentLine !== line) emit('update:currentLine', line);
  });
}

function onRowClick(line: number) {
  emit('row-click', line);
  if (!editor) {
    emit('update:currentLine', line);
    return;
  }
  // setCaretListener runs only when the line changes. A click on the line
  // already under the caret (initial line, or the line clearLine left in place)
  // still has to select it.
  // clearLine hides the current-line band; a click must paint it again.
  editor.setTheme(suduEditorTheme());
  const already = editor.getPosition?.()?.lineNumber === line;
  editor.setPosition({ lineNumber: line, column: 1 });
  editor.focus();
  if (already) emit('update:currentLine', line);
}

/**
 * Drive caret from the other pane (asm → source).
 * Sudu only paints the caret while focused (`drawCaret` gates on hasFocus) — so
 * focus() is required for the line to look selected. Caret listener may emit;
 * SourceView’s syncOrigin / same-group stay absorbs the bounce (no ignoreCaret).
 */
function setLine(line: number): 'unchanged' | 'moved' {
  if (!editor) return 'unchanged';
  editor.setTheme(suduEditorTheme());
  const prev = editor.getPosition?.()?.lineNumber;
  editor.setPosition({ lineNumber: line, column: 1 });
  editor.revealLine(line);
  editor.focus();
  // Do not emit here. A live caller reads 'unchanged' (onAsmLine drops the gate).
  // Boot emits only for an imperative queue — a prop-driven same line (scroll)
  // must not look like a user click.
  // Compare the caret after setPosition: Sudu clamps past EOF and does not notify
  // when the line did not change, which must not be reported as 'moved'.
  const next = editor.getPosition?.()?.lineNumber;
  if (prev == null || next == null) return prev === line ? 'unchanged' : 'moved';
  return next === prev ? 'unchanged' : 'moved';
}

/**
 * Drop editor selection when the opposite pane has no mapped source line.
 * Sudu has no clearSelection API: blur hides the caret; theme override hides
 * currentLineBg (still painted for caretLine after blur).
 */
function clearLine() {
  pendingLine = null;
  pendingCaretEcho = false;
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
function setLineOrQueue(line: number): 'queued' | 'unchanged' | 'moved' {
  if (!editor) {
    pendingLine = line;
    pendingCaretEcho = true;
    return 'queued';
  }
  pendingCaretEcho = false;
  return setLine(line);
}

/** Scroll editor + metrics table to the top without emitting caret (parent owns line). */
function scrollToTop() {
  pendingCaretEcho = false;
  const scroll = tableScrollEl.value;
  if (scroll) scroll.scrollTop = 0;
  if (!editor) return;
  editor.setTheme(suduEditorTheme());
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
  pendingCaretEcho = false;
  const scroll = tableScrollEl.value;
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
  if (!editor) return;
  editor.setTheme(suduEditorTheme());
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
    // Before the await, so a currentLine watch cannot move the old document.
    ignoreCaret = true;
    const api = await loadSuduApi();
    if (disposed || !editor || !pool || !model) {
      ignoreCaret = false;
      return;
    }
    const prev = model;
    model = api.newTextModel(
      pool,
      file.text,
      file.language,
      { path: file.path },
    );
    // setModel resets lastNotifiedCaretLine and always notifies line 1.
    // That echo would undo a file-switch clear (PR-SOURCE-015).
    ignoreCaret = true;
    try {
      editor.setModel(model);
      prev.dispose();
      readGeom();
      applySearchHighlights();
      if (props.currentLine != null) setLine(props.currentLine);
      else clearLine();
    } finally {
      ignoreCaret = false;
    }
  },
);

watch(
  () => props.searchQuery,
  () => {
    applySearchHighlights();
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
      // onAsmLine sets sourceLine and then setLine, which queues pendingCaretEcho.
      // This watch flushes next and must not downgrade that same line.
      if (pendingCaretEcho && pendingLine === line) return;
      pendingLine = line;
      pendingCaretEcho = false;
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
    bindTableScroll();
  });
});

onBeforeUnmount(() => {
  disposed = true;
  ignoreCaret = false;
  paintedSearchRanges = [];
  closeCopyMenu();
  detachCopyMenuListeners();
  endMetricResizeSession();
  tableScrollEl.value?.removeEventListener('scroll', onTableScroll);
  editor?.setVScrollListener(null);
  editor?.setCaretListener(null);
  editor?.highlightRanges?.(null);
  editor?.dispose();
  model?.dispose();
  editor = null;
  model = null;
});

defineExpose({
  setLine: setLineOrQueue,
  clearLine,
  scrollToTop,
  scrollToBottom,
  stepSearch,
  containerId,
});
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
    :class="{ 'pr-sudu-pane--loading': showLoading }"
    data-testid="sudu-code-pane"
    :style="paneStyle"
    :aria-busy="showLoading"
  >
    <div class="pr-sudu-pane__stage">
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
          @pointerdown="onEditorPointerDown"
          @contextmenu.capture.prevent.stop="onEditorContextMenu"
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
            v-model:column-widths="metricColWidths"
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
            @scroll-left="onMetricsScrollLeft"
            @row-click="onRowClick"
          />
        </div>
      </div>
    </div>
    <div
      v-if="showLoading"
      class="pr-sudu-pane__loading"
      data-testid="sudu-loading"
      role="status"
    >
      <span
        class="pr-sudu-pane__spinner"
        :aria-label="t('sourceEditorLoading')"
      />
    </div>
    <Teleport to="body">
      <div
        v-if="copyMenu"
        ref="copyMenuEl"
        class="pr-sudu-menu"
        role="menu"
        data-testid="sudu-context-menu"
        :style="copyMenuStyle"
        @contextmenu.prevent.stop
      >
        <button
          type="button"
          class="pr-sudu-menu__item"
          role="menuitem"
          data-testid="sudu-context-copy"
          @click="onCopySelection"
        >
          {{ t('sourceCopy') }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.pr-sudu-pane {
  position: relative;
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

.pr-sudu-pane__stage {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

/* Opacity, not display:none — Sudu must keep a real box and paint before we reveal. */
.pr-sudu-pane--loading .pr-sudu-pane__stage {
  opacity: 0;
  pointer-events: none;
}

.pr-sudu-pane__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.pr-sudu-pane__spinner {
  width: 28px;
  height: 28px;
  box-sizing: border-box;
  border: 2px solid #3a3a3a;
  border-top-color: #3078f0;
  border-radius: 50%;
  animation: pr-sudu-spin 0.8s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .pr-sudu-pane__spinner {
    animation: none;
    border-top-color: #3078f0;
  }
}

@keyframes pr-sudu-spin {
  to {
    transform: rotate(360deg);
  }
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

<style>
.pr-sudu-menu {
  z-index: 10001;
  box-sizing: border-box;
  min-width: 140px;
  padding: 4px 0;
  border-radius: 6px;
  background: var(--pr-surface-raised, #363636);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  color: var(--pr-tab-inactive, #d0d0d0);
  font-size: 13px;
  user-select: none;
}

.pr-sudu-menu__item {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}

.pr-sudu-menu__item:hover,
.pr-sudu-menu__item:focus-visible {
  background: var(--pr-surface-hover, #323232);
}
</style>
