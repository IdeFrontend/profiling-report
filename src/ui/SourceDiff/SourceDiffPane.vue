<script lang="ts">
import { cssRowHeight } from '../SourceView/editorTableSync';
import { SOURCE_TAB_EDITOR_FONT } from '../SourceView/sourceFonts';
import type { SuduApi, SuduWorkerPool } from '../SourceView/suduRuntime';

/** Same background SuduCodePane pins, so the diff canvas matches the Source tab. */
const SUDU_EDITOR_BG = { r: 0x1a, g: 0x1a, b: 0x1a };
const EDITOR_BG_HEX = `#${SUDU_EDITOR_BG.r.toString(16).padStart(2, '0')}${SUDU_EDITOR_BG.g
  .toString(16)
  .padStart(2, '0')}${SUDU_EDITOR_BG.b.toString(16).padStart(2, '0')}`;

/** One object for both panes, so the per-theme measurement cache hits. */
const DIFF_EDITOR_THEME = {
  baseTheme: 'dark' as const,
  editorFont: { ...SOURCE_TAB_EDITOR_FONT, size: 12 },
  11: EDITOR_BG_HEX,
  // Compare has no current-line band; matching EditorBackground keeps Sudu from painting it.
  13: EDITOR_BG_HEX,
  14: EDITOR_BG_HEX,
  // Both one-sided kinds paint the design brown: 15 is removed, 17 is added.
  15: '#432224',
  17: '#432224',
  // 23 is the edited-region band for a changed row both files have.
  23: '#463520',
  19: '#575757',
  20: '#575757',
  21: '#575757',
};

interface DiffMeasurement {
  rowHeightCss: number;
  dpr: number;
  fontSize: number;
  fontFamily: string | null;
}

const measurementByTheme = new WeakMap<object, DiffMeasurement>();

/**
 * SideDiff exposes no geometry, so measure the font once with a plain editor in a
 * hidden host. Sudu only mounts its canvas when the container is in the document;
 * a detached host makes dispose log "disconnectFromDom: called on already disconnected".
 */
function measureDiff(api: SuduApi, workers: SuduWorkerPool): DiffMeasurement {
  const currentDpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const cached = measurementByTheme.get(DIFF_EDITOR_THEME);
  // Zoom changes the device ratio; a cached measurement would desync the scroll scale.
  if (cached && cached.dpr === currentDpr) return cached;
  const fallback: DiffMeasurement = {
    rowHeightCss: 18,
    dpr: currentDpr,
    fontSize: SOURCE_TAB_EDITOR_FONT.size,
    fontFamily: SOURCE_TAB_EDITOR_FONT.family,
  };
  if (typeof document === 'undefined') return fallback;
  const host = document.createElement('div');
  host.id = `pr-src-diff-measure-${Math.random().toString(36).slice(2)}`;
  host.style.display = 'none';
  document.body.append(host);
  const editor = api.newEditor({
    containerId: host.id,
    workers,
    readonly: true,
    disableParser: true,
    theme: DIFF_EDITOR_THEME,
  });
  const dpr = editor.getDevicePixelRatio() || fallback.dpr;
  // getFontSize() is device pixels; the gutter measures in CSS px (SuduCodePane divides too).
  const deviceFont = editor.getFontSize();
  const measured: DiffMeasurement = {
    rowHeightCss: cssRowHeight({ lineHeight: editor.getLineHeight(), dpr }) || fallback.rowHeightCss,
    dpr,
    fontSize: deviceFont > 0 ? deviceFont / (dpr || 1) : fallback.fontSize,
    fontFamily: editor.getFontFamily() || fallback.fontFamily,
  };
  editor.dispose();
  host.remove();
  measurementByTheme.set(DIFF_EDITOR_THEME, measured);
  return measured;
}
</script>

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
import type { ITextDiffModel } from '@sudu-ide/code-review';
import type { SourceFileModel, SourceLineMetrics } from '../../domain/types';
import { t } from '../../i18n';
import PrIcon from '../PrIcon.vue';
import {
  ensureSourceColWidths,
  SOURCE_COL_WIDTH_MIN,
} from '../SourceView/sourceColumnResize';
import SourceMetricsTable from '../SourceView/SourceMetricsTable.vue';
import SourcePillSelect, { type SourceSelectOption } from '../SourceView/SourcePillSelect.vue';
import { cssScrollFromDevice, deviceScrollFromCss } from '../SourceView/editorTableSync';
import { loadSuduApi } from '../SourceView/suduRuntime';
import type { DiffRow } from './diffAlign';

const props = withDefaults(
  defineProps<{
    rows: DiffRow[];
    side: 'left' | 'right';
    /** Source-line metrics for this side's file; values are looked up by source line. */
    metrics: SourceFileModel;
    locale?: string;
    /** Shared model for both panes; the parent rebuilds it when either file changes. */
    diffModel?: ITextDiffModel | null;
    /** Shared worker pool used to construct the native SideDiff view. */
    workers?: SuduWorkerPool | null;
    /** Sibling files offered by the pane header; defaults to `metrics` alone. */
    files?: SourceFileModel[];
    activeFileId?: string;
    /** Vertical scroll in CSS px (parent mirrors it into the other pane). */
    scrollListener?: (cssScroll: number) => void;
    /** Metric column emphasized by Navigate By. */
    highlightColumn?: string | null;
    /** Whether this pane owns the focus ring. */
    focused?: boolean;
    /** Show this side's workspace picker button (the file text is a placeholder). */
    workspaceAvailable?: boolean;
    /** Accessible name / tooltip for the workspace picker button. */
    workspaceTitle?: string;
  }>(),
  {
    locale: undefined,
    diffModel: null,
    workers: null,
    files: undefined,
    activeFileId: undefined,
    scrollListener: undefined,
    highlightColumn: null,
    focused: false,
    workspaceAvailable: false,
    workspaceTitle: '',
  },
);

const emit = defineEmits<{
  'select-file': [id: string];
  'update:navigateBy': [id: string];
  'pick-workspace': [];
}>();

const domId = useId().replace(/:/g, '');
const containerId = `pr-src-diff-${domId}`;
const rootEl = ref<HTMLElement | null>(null);
const editorHost = ref<HTMLElement | null>(null);
const tableScrollEl = ref<HTMLElement | null>(null);
const loadError = ref<string | null>(null);
const rowH = ref(18);
const scrollCss = ref(0);
/** Font metrics measured once from a plain editor; SideDiff exposes no geometry. */
const measurement = ref<DiffMeasurement | null>(null);

/** Same formula as codereview.js: measure the widest line number + 5px, rounded up. */
const gutterCss = computed(() => {
  const digits = String(Math.max(1, props.rows.length)).length;
  const ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!ctx) return 20;
  const size = measurement.value?.fontSize || SOURCE_TAB_EDITOR_FONT.size;
  const family = measurement.value?.fontFamily || SOURCE_TAB_EDITOR_FONT.family;
  ctx.font = `400 ${size}px ${family}`;
  return Math.ceil(ctx.measureText('0'.repeat(digits)).width + 5);
});

type SideDiffView = ReturnType<SuduApi['newSideDiff']>;

let view: SideDiffView | null = null;
let suduApi: SuduApi | null = null;
let disposed = false;
let booting = false;
/** Device px applied by the parent; its own scroll echo must not bounce back. */
let pendingEcho = -1;
/** CSS scrollTop just written by the editor or by setScrollCss. The browser
 *  reports it back asynchronously, after pendingEcho has already been cleared. */
let mirroredScrollTop: number | null = null;
/** Scroll requested before SideDiff has booted. Applied at the end of boot. */
let pendingScrollCss: number | null = null;

const fileOptions = computed<SourceSelectOption[]>(() => {
  const files = props.files?.length ? props.files : [props.metrics];
  return files.map((file) => ({
    id: file.id,
    label: file.path,
  }));
});
const activeFileId = computed(() => props.activeFileId ?? props.metrics.id);

function sideLine(row: DiffRow): number | null {
  return props.side === 'left' ? row.leftLine : row.rightLine;
}

const metricsByLine = computed(() => {
  const map = new Map<number, SourceLineMetrics>();
  for (const line of props.metrics.lines) map.set(line.line, line);
  return map;
});

/**
 * SourceMetricsTable looks values up by `line`, so feed it view rows and copy the
 * values of that row's source line. Filler rows carry no values.
 */
const viewMetrics = computed<SourceFileModel>(() => {
  // Drop lineCount so the table's extent is the view-row list, not the source file's.
  const metrics = { ...props.metrics };
  delete metrics.lineCount;
  return {
    ...metrics,
    lines: props.rows.map((row, index) => {
      const sourceLine = sideLine(row);
      const hit = sourceLine == null ? undefined : metricsByLine.value.get(sourceLine);
      return { line: index + 1, values: hit?.values ?? {}, stallBreakdown: hit?.stallBreakdown };
    }),
  };
});

/**
 * Design tint per view row, keyed by table line. A row this side lacks is a spacer on the
 * code plane, so it gets no tone either — the metrics plane must match the canvas band.
 */
const rowTones = computed<Record<number, string>>(() => {
  const tones: Record<number, string> = {};
  props.rows.forEach((row, index) => {
    if (row.kind === 'same' || sideLine(row) == null) return;
    tones[index + 1] = row.kind === 'changed' ? 'modified' : 'removed';
  });
  return tones;
});

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

watch(
  () =>
    [
      props.focused,
      props.highlightColumn,
      navigateOptions.value.map((opt) => opt.id).join('\0'),
    ] as const,
  () => {
    if (!props.focused) return;
    const first = navigateOptions.value[0]?.id;
    if (!first) return;
    if (props.highlightColumn && navigateOptions.value.some((opt) => opt.id === props.highlightColumn)) {
      return;
    }
    emit('update:navigateBy', first);
  },
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

function onEditorScroll(vScrollPos: number): void {
  const dpr = measurement.value?.dpr ?? 0;
  if (!(dpr > 0)) return;
  const css = cssScrollFromDevice(vScrollPos, dpr);
  const scroll = tableScrollEl.value;
  if (scroll && Math.abs(scroll.scrollTop - css) >= 0.5) {
    scroll.scrollTop = css;
    mirroredScrollTop = scroll.scrollTop;
  }
  // The table clamps at its own scroll range; push the clamped offset back to the canvas.
  const applied = scroll ? scroll.scrollTop : css;
  if (applied !== css) {
    const devicePos = deviceScrollFromCss(applied, dpr);
    if (devicePos !== vScrollPos) view?.setVScrollPos(devicePos);
  }
  scrollCss.value = applied;
  if (vScrollPos === pendingEcho) return;
  props.scrollListener?.(applied);
}

function onTableScroll(): void {
  const scroll = tableScrollEl.value;
  const dpr = measurement.value?.dpr ?? 0;
  if (!view || !(dpr > 0) || !scroll) return;
  if (mirroredScrollTop != null && Math.abs(scroll.scrollTop - mirroredScrollTop) < 1) {
    mirroredScrollTop = null;
    return;
  }
  const devicePos = deviceScrollFromCss(scroll.scrollTop, dpr);
  if (devicePos === pendingEcho) return;
  pendingEcho = devicePos;
  view.setVScrollPos(devicePos);
  pendingEcho = -1;
  scrollCss.value = scroll.scrollTop;
  props.scrollListener?.(scroll.scrollTop);
}

/** Metrics row click scrolls the canvas to the same view row; SideDiff has no caret API. */
function onRowClick(line: number): void {
  const css = Math.max(0, (line - 1) * rowH.value);
  setScrollCss(css);
  // setScrollCss swallows its own table echo, so the sibling pane must be told directly.
  props.scrollListener?.(getScrollCss());
}

function bindTableScroll(): void {
  if (tableScrollEl.value) return;
  tableScrollEl.value =
    rootEl.value?.querySelector<HTMLElement>('[data-testid="source-metrics-scroll"]') ?? null;
  tableScrollEl.value?.addEventListener('scroll', onTableScroll);
}

async function boot(): Promise<void> {
  if (booting || view || disposed || !props.workers) return;
  booting = true;
  try {
    const api = await loadSuduApi();
    if (disposed || !editorHost.value || !props.workers) return;
    suduApi = api;
    editorHost.value.id = containerId;
    measurement.value = measureDiff(api, props.workers);
    rowH.value = measurement.value.rowHeightCss;
    view = api.newSideDiff(
      {
        containerId,
        workers: props.workers,
        theme: DIFF_EDITOR_THEME,
        readonly: true,
        // Keep the language parser so both sides keep syntax colors.
        disableParser: false,
      },
      props.side === 'left',
    );
    if (props.diffModel) view.setModel(props.diffModel);
    view.setVScrollListener(onEditorScroll);
    bindTableScroll();
    if (pendingScrollCss != null) setScrollCss(pendingScrollCss);
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    booting = false;
  }
}

/**
 * Browser zoom changes the device ratio without remounting. Re-measure, then
 * reapply the current CSS offset through the shared sync path so rows stay put.
 */
function onViewportResize(): void {
  const currentDpr = window.devicePixelRatio || 1;
  if (!view || !suduApi || !props.workers) return;
  if (currentDpr === measurement.value?.dpr) return;
  const oldRowH = rowH.value;
  const topRow = oldRowH > 0 ? Math.floor(getScrollCss() / oldRowH) : 0;
  measurement.value = measureDiff(suduApi, props.workers);
  rowH.value = measurement.value.rowHeightCss;
  // The table still has the old row height until Vue flushes; restoring now clamps
  // against the short scrollHeight and that offset never gets rewritten.
  const top = topRow * rowH.value;
  void nextTick(() => {
    setScrollCss(top);
  });
}

watch(
  () => props.workers,
  () => {
    void boot();
  },
);

watch(
  () => props.diffModel,
  (model) => {
    if (view && model) view.setModel(model);
  },
);

onMounted(() => {
  window.addEventListener('resize', onViewportResize);
  void boot();
});

onBeforeUnmount(() => {
  disposed = true;
  window.removeEventListener('resize', onViewportResize);
  tableScrollEl.value?.removeEventListener('scroll', onTableScroll);
  tableScrollEl.value = null;
  view?.dispose();
  view = null;
});

/** Parent-driven scroll (keeps pane A's wheel in sync with pane B). */
function setScrollCss(css: number): void {
  pendingScrollCss = css;
  const dpr = measurement.value?.dpr ?? 0;
  if (!view || !(dpr > 0)) return;
  pendingScrollCss = null;
  const scroll = tableScrollEl.value;
  if (scroll) {
    scroll.scrollTop = css;
    mirroredScrollTop = scroll.scrollTop;
  }
  // Clamp to the table's range so table rows and the canvas share one offset.
  const applied = scroll ? scroll.scrollTop : css;
  const devicePos = deviceScrollFromCss(applied, dpr);
  pendingEcho = devicePos;
  view.setVScrollPos(devicePos);
  pendingEcho = -1;
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
        v-if="workspaceAvailable"
        type="button"
        class="pr-src-diff-pane__icon-btn"
        :data-testid="`source-diff-workspace-${side}`"
        :aria-label="workspaceTitle"
        :title="workspaceTitle"
        @click="emit('pick-workspace')"
      >
        <PrIcon name="add-baseline" />
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
      :class="{ 'pr-src-diff-pane__surface--focused': focused }"
    >
      <div
        class="pr-src-diff-pane__head"
        data-testid="source-diff-head"
        :style="{ height: '18px', lineHeight: '18px' }"
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
        :row-tones="rowTones"
        :current-line="null"
        :row-height-css="rowH"
        :show-header="false"
        :show-line-numbers="false"
        :locale="locale"
        @row-click="onRowClick"
      />
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
  border-color: #317af7;
  border-radius: 6px;
}
/* canvas composites over an inset box-shadow/outline, so the 2px ring is its own layer */
.pr-src-diff-pane__surface--focused::after {
  position: absolute;
  inset: 0;
  z-index: 5;
  border: 1px solid #317af7;
  border-radius: 6px;
  pointer-events: none;
  content: '';
}

.pr-src-diff-pane__head {
  box-sizing: border-box;
  display: flex;
  flex: 0 0 auto;
  overflow: hidden;
  background: #2a2a2a;
  border-bottom: 1px solid #353535;
  border-radius: 6px 6px 0 0;
}

.pr-src-diff-pane__head-editor {
  flex: 0 0 55.5%;
  min-width: 0;
  overflow: hidden;
}

.pr-src-diff-pane__head-metrics {
  box-sizing: border-box;
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  border-left: 1px solid #2a2a2a;
}

.pr-src-diff-pane__head-table {
  width: 100%;
  height: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 400;
  background: #2a2a2a;
}

.pr-src-diff-pane__head-table th {
  padding: 0 8px;
  color: #b3b3b3;
  text-align: left;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: #2a2a2a;
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
  box-sizing: border-box;
  flex: 1 1 0;
  /* Divider between the code plane and the metrics plane, on the metrics side. */
  border-left: 1px solid #2a2a2a;
}

.pr-src-diff-pane__editor {
  position: relative;
  flex: 0 0 55.5%;
  min-width: 0;
  overflow: hidden;
}

.pr-src-diff-pane__error {
  position: absolute;
  margin: 8px;
  color: var(--pr-text-muted, #9aa0a6);
  font-size: 12px;
}
</style>
