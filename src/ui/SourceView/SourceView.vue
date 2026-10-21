<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { SourceCorrelationModel, SourceFileModel } from '../../domain/types';
import { t } from '../../i18n';
import PrIcon from '../PrIcon.vue';
import ToolbarSearch from '../ReportToolbar/ToolbarSearch.vue';
import { DEFAULT_USER_GUIDE_URL } from '../userGuide';
import AsmTablePane from './AsmTablePane.vue';
import { paneBarsUseTwoLines } from './paneBarLayout';
import SourcePillSelect from './SourcePillSelect.vue';
import SuduCodePane from './SuduCodePane.vue';

/** ReportToolbar mounts `[data-testid=source-chrome-host]` on the tab row. */
const SOURCE_CHROME_HOST = "[data-testid='source-chrome-host']";

const props = withDefaults(
  defineProps<{
    model: SourceCorrelationModel;
    locale?: string;
    suduWorkerUrl?: string;
    userGuideUrl?: string;
  }>(),
  {
    locale: undefined,
    suduWorkerUrl: '/sudu/worker.js',
    userGuideUrl: DEFAULT_USER_GUIDE_URL,
  },
);

const emit = defineEmits<{
  'open-user-guide': [url: string];
}>();

type PaneApi = {
  setLine: (n: number) => void;
  clearLine?: () => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
};

const selectedFileId = ref(props.model.files[0]?.id ?? '');
const sourceNavigateBy = ref(props.model.navigateBy[0] ?? 'instructionsExecuted');
const asmNavigateBy = ref(props.model.navigateBy[0] ?? 'instructionsExecuted');
const sourceLine = ref<number | null>(null);
const asmLine = ref<number | null>(null);
const sourcePane = ref<PaneApi | null>(null);
const asmPane = ref<PaneApi | null>(null);

const searchQuery = ref('');
/** Shared Link Views state — both pane toggles stay in sync. */
const linkViews = ref(true);
const sortDesc = ref(true);
/**
 * Which dual pane owns chrome actions (search / sort). Always one of the two;
 * defaults to Source. Clicks outside the panes do not clear it.
 */
const selectedPane = ref<'source' | 'asm'>('source');
/**
 * After scroll-to-top/bottom both carets are forced independently. Suppress
 * cross-pane correlation highlights until the user selects a line again so we
 * do not paint a stale mapped partner beside the forced carets.
 */
const correlationSuppressed = ref(false);
/**
 * Which pane initiated the latest cross-pane sync. Cleared when the echo is
 * absorbed — no timer (timers raced real Sudu caret/paint).
 */
const syncOrigin = ref<'source' | 'asm' | null>(null);

function toggleLinkViews() {
  linkViews.value = !linkViews.value;
}

watch(
  () => props.model,
  (m) => {
    selectedFileId.value = m.files[0]?.id ?? '';
    sourceNavigateBy.value = m.navigateBy[0] ?? 'instructionsExecuted';
    asmNavigateBy.value = m.navigateBy[0] ?? 'instructionsExecuted';
    sourceLine.value = null;
    asmLine.value = null;
    searchQuery.value = '';
    correlationSuppressed.value = false;
  },
);

/** File picker only — asm→source correlation may change `selectedFileId` without reset. */
function onSourceFileChange(fileId: string) {
  selectedFileId.value = fileId;
  sourceLine.value = null;
  asmLine.value = null;
  searchQuery.value = '';
  correlationSuppressed.value = false;
}

const sourceFile = computed<SourceFileModel | null>(() => {
  return props.model.files.find((f) => f.id === selectedFileId.value) ?? props.model.files[0] ?? null;
});

const correlatedAsm = computed(() => {
  if (correlationSuppressed.value || !linkViews.value) return [];
  const file = sourceFile.value;
  if (file && sourceLine.value != null) {
    const fromSource = props.model.sourceToAsm[`${file.id}:${sourceLine.value}`];
    if (fromSource?.length) return fromSource;
  }
  // Asm-driven: expand siblings via asm → source → sourceToAsm (right-panel start).
  if (asmLine.value == null) return [];
  const hit = props.model.asmToSource[asmLine.value];
  if (!hit) return [];
  return props.model.sourceToAsm[`${hit.fileId}:${hit.line}`] ?? [];
});

const correlatedSource = computed(() => {
  if (correlationSuppressed.value || !linkViews.value) return [];
  if (asmLine.value == null) return [];
  const hit = props.model.asmToSource[asmLine.value];
  return hit ? [hit.line] : [];
});

const sourceTextLines = computed(() => (sourceFile.value?.text ?? '').split(/\r?\n/));

/**
 * Right-pane search hits: Assembly column only (CLA-style substring chips).
 * Empty / Source-selected → no table marks.
 */
const asmMatchLines = computed(() => {
  if (selectedPane.value !== 'asm') return [];
  const needle = searchQuery.value.trim().toLowerCase();
  if (!needle) return [];
  return props.model.assembly.lines
    .filter((row) => String(row.values.assembly ?? '').toLowerCase().includes(needle))
    .map((row) => row.line);
});

/** Query forwarded to the asm table for UI-43 navy chips on Assembly text. */
const asmSearchQuery = computed(() =>
  selectedPane.value === 'asm' ? searchQuery.value.trim() : '',
);

function selectPane(pane: 'source' | 'asm') {
  selectedPane.value = pane;
}

function metricValue(file: SourceFileModel, line: number, colId: string): number {
  const row = file.lines.find((l) => l.line === line);
  const v = row?.values[colId];
  return typeof v === 'number' ? v : 0;
}

/** Hot lines for Navigate By (non-zero metric), ordered by sort toggle. */
function hotLines(file: SourceFileModel, col: string): number[] {
  const rows = file.lines
    .filter((l) => {
      const v = l.values[col];
      return typeof v === 'number' ? v !== 0 : v != null && v !== '';
    })
    .map((l) => ({ line: l.line, value: metricValue(file, l.line, col) }));
  rows.sort((a, b) => (sortDesc.value ? b.value - a.value : a.value - b.value));
  return rows.map((r) => r.line);
}

function onSourceLine(line: number) {
  correlationSuppressed.value = false;
  // Asm-driven setLine echo — keep asm caret; clear the gate (no timer).
  if (syncOrigin.value === 'asm') {
    sourceLine.value = line;
    syncOrigin.value = null;
    return;
  }
  // Late caret echo for the same mapped group: keep asm sibling, do not steal pane.
  if (sourceLine.value === line && asmLine.value != null && linkViews.value) {
    const file = sourceFile.value;
    const mapped = file ? (props.model.sourceToAsm[`${file.id}:${line}`] ?? []) : [];
    if (mapped.includes(asmLine.value)) return;
  }
  selectedPane.value = 'source';
  sourceLine.value = line;
  if (!linkViews.value) return;
  const file = sourceFile.value;
  const mapped = file ? (props.model.sourceToAsm[`${file.id}:${line}`] ?? []) : [];
  if (mapped.length > 0) {
    syncOrigin.value = 'source';
    // Keep the asm caret if it already belongs to this source line.
    const stay = asmLine.value != null && mapped.includes(asmLine.value);
    const target = stay ? asmLine.value! : mapped[0]!;
    asmLine.value = target;
    asmPane.value?.setLine(target);
    syncOrigin.value = null; // asm setLine does not echo selection
  } else {
    // Unmapped: clear opposite highlight so a stale pair is not shown.
    asmLine.value = null;
  }
}

function onAsmLine(line: number) {
  correlationSuppressed.value = false;
  if (syncOrigin.value === 'source') {
    asmLine.value = line;
    syncOrigin.value = null;
    return;
  }
  selectedPane.value = 'asm';
  asmLine.value = line;
  if (!linkViews.value) return;
  const hit = props.model.asmToSource[line];
  if (hit) {
    if (hit.fileId !== selectedFileId.value) selectedFileId.value = hit.fileId;
    syncOrigin.value = 'asm';
    sourceLine.value = hit.line;
    // Imperative setLine; SuduCodePane also watches currentLine (sample: setPosition only).
    sourcePane.value?.setLine(hit.line);
  } else {
    // No mapped source — clear metrics current row and Sudu caret/current-line paint.
    sourceLine.value = null;
    sourcePane.value?.clearLine?.();
  }
}

function jumpSource(line: number) {
  sourceLine.value = line;
  sourcePane.value?.setLine(line);
  onSourceLine(line);
}

function jumpAsm(line: number) {
  asmLine.value = line;
  asmPane.value?.setLine(line);
  onAsmLine(line);
}

function cycleLine(lines: number[], current: number | null, dir: 1 | -1): number | null {
  if (lines.length === 0) return null;
  if (current == null) return dir === 1 ? lines[0]! : lines[lines.length - 1]!;
  if (dir === 1) {
    const next = lines.find((n) => n > current);
    return next ?? lines[0]!;
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]! < current) return lines[i]!;
  }
  return lines[lines.length - 1]!;
}

/**
 * Find next/prev walks matches in the selected pane only — empty search is a no-op.
 * Source pane: editor find (Sudu API not wired yet). Asm pane: Assembly column.
 */
function findStep(dir: 1 | -1) {
  const q = searchQuery.value.trim();
  if (!q) return;
  if (selectedPane.value === 'asm') {
    const next = cycleLine(asmMatchLines.value, asmLine.value, dir);
    if (next != null) jumpAsm(next);
    return;
  }
  // TODO(source-search): Sudu editor has no find/highlight API yet — wire when available.
  // Until then Source-selected search does not mark the metrics table or move the caret.
  void dir;
}

/**
 * Sort Navigate By order (asc/desc). Toggles order and jumps to the first hot
 * line in that order for the selected pane so the control is immediately useful.
 */
function setNavigateSort(desc: boolean) {
  sortDesc.value = desc;
  if (selectedPane.value === 'asm') {
    const hot = hotLines(props.model.assembly, asmNavigateBy.value);
    if (hot[0] != null) jumpAsm(hot[0]);
    return;
  }
  const file = sourceFile.value;
  if (!file) return;
  const hot = hotLines(file, sourceNavigateBy.value);
  if (hot[0] != null) jumpSource(hot[0]);
}

function scrollTop() {
  sourcePane.value?.scrollToTop();
  asmPane.value?.scrollToTop();
  correlationSuppressed.value = true;
  sourceLine.value = 1;
  asmLine.value = 1;
}

function scrollBottom() {
  const srcLast = Math.max(1, sourceTextLines.value.length);
  const asmLast =
    props.model.assembly.lines[props.model.assembly.lines.length - 1]?.line ??
    Math.max(1, props.model.assembly.text.split(/\r?\n/).length);
  sourcePane.value?.scrollToBottom();
  asmPane.value?.scrollToBottom();
  correlationSuppressed.value = true;
  sourceLine.value = srcLast;
  asmLine.value = asmLast;
}

function openUserGuide() {
  const url = props.userGuideUrl;
  emit('open-user-guide', url);
  window.open(url, '_blank', 'noopener,noreferrer');
}

const leftViewOptions = [{ id: 'source', label: 'Source' }];
const rightViewOptions = [{ id: 'sass', label: 'SASS' }];

const sourceFileOptions = computed(() =>
  props.model.files.map((f) => ({ id: f.id, label: f.path })),
);

const asmFileOptions = computed(() => [
  { id: props.model.assembly.id, label: props.model.assembly.path },
]);

const sourceNavigateOptions = computed(() =>
  props.model.navigateBy.map((id) => {
    const col = sourceFile.value?.metricsColumns.find((c) => c.id === id);
    return { id, label: col?.label ?? id };
  }),
);

const asmNavigateOptions = computed(() =>
  props.model.navigateBy.map((id) => {
    const col = props.model.assembly.metricsColumns.find((c) => c.id === id);
    return { id, label: col?.label ?? id };
  }),
);

/** True once ReportToolbar’s tab-row host is in the DOM (Teleport target). */
const chromeHostReady = ref(false);
let chromeHostObserver: MutationObserver | null = null;
const panesEl = ref<HTMLElement | null>(null);
/** Shared one-line / two-line mode for both pane bars. */
const paneBarsTwoLine = ref(false);
let paneBarObserver: ResizeObserver | null = null;

function paneBarBox(bar: HTMLElement): { lead: number; nav: number; available: number } | null {
  const lead = bar.querySelector<HTMLElement>('.pr-source-view__pane-bar-lead');
  const nav = bar.querySelector<HTMLElement>('.pr-source-view__pane-bar-nav');
  if (!lead || !nav) return null;
  const style = getComputedStyle(bar);
  const pad = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  return {
    lead: lead.offsetWidth,
    nav: nav.offsetWidth,
    available: Math.max(0, bar.clientWidth - pad),
  };
}

function syncPaneBars() {
  const root = panesEl.value;
  if (!root) return;
  const boxes = [...root.querySelectorAll<HTMLElement>('[data-testid="source-pane-bar"]')]
    .map(paneBarBox)
    .filter((box): box is NonNullable<typeof box> => box != null);
  const bar = root.querySelector<HTMLElement>('[data-testid="source-pane-bar"]');
  const gap = bar ? parseFloat(getComputedStyle(bar).columnGap) || 0 : 0;
  paneBarsTwoLine.value = paneBarsUseTwoLines(boxes, gap);
}

function bindPaneBarObserver() {
  paneBarObserver?.disconnect();
  paneBarObserver = null;
  const root = panesEl.value;
  if (!root || typeof ResizeObserver === 'undefined') return;
  paneBarObserver = new ResizeObserver(() => syncPaneBars());
  paneBarObserver.observe(root);
  root.querySelectorAll('.pr-source-view__pane-bar, .pr-source-view__pane-bar-lead, .pr-source-view__pane-bar-nav')
    .forEach((el) => paneBarObserver?.observe(el));
}

function refreshChromeHost() {
  chromeHostReady.value = typeof document !== 'undefined'
    && document.querySelector(SOURCE_CHROME_HOST) != null;
}

watch(
  () => [selectedFileId.value, props.model.assembly.path, sourceNavigateBy.value, asmNavigateBy.value],
  () => { void nextTick(syncPaneBars); },
);

onMounted(() => {
  refreshChromeHost();
  syncPaneBars();
  bindPaneBarObserver();
  window.addEventListener('resize', syncPaneBars);
  if (!chromeHostReady.value && typeof MutationObserver !== 'undefined') {
    chromeHostObserver = new MutationObserver(() => {
      refreshChromeHost();
      if (chromeHostReady.value) {
        chromeHostObserver?.disconnect();
        chromeHostObserver = null;
      }
    });
    chromeHostObserver.observe(document.body, { childList: true, subtree: true });
  }
});

onBeforeUnmount(() => {
  chromeHostObserver?.disconnect();
  chromeHostObserver = null;
  paneBarObserver?.disconnect();
  paneBarObserver = null;
  window.removeEventListener('resize', syncPaneBars);
});
</script>

<template>
  <div
    class="pr-source-view"
    :class="{ 'pr-source-view--pane-bars-two': paneBarsTwoLine }"
    data-testid="source-view"
    :data-mock="model.mock ? 'true' : 'false'"
    :data-pane-bars="paneBarsTwoLine ? 'two' : 'one'"
  >
    <!-- First control bar lives on the ReportToolbar tab row (no extra margin).
         When the host is absent (unit tests), Teleport stays disabled and renders in place. -->
    <Teleport
      :disabled="!chromeHostReady"
      :to="SOURCE_CHROME_HOST"
    >
      <div
        class="pr-source-view__views-row"
        data-testid="source-view-toolbar"
      >
        <SourcePillSelect
          :caption="t('sourceLeftView', locale)"
          model-value="source"
          :options="leftViewOptions"
          test-id="source-left-view"
        />
        <SourcePillSelect
          :caption="t('sourceRightView', locale)"
          model-value="sass"
          :options="rightViewOptions"
          test-id="source-right-view"
        />

        <ToolbarSearch
          :model-value="searchQuery"
          :locale="locale"
          input-test-id="source-search"
          clear-test-id="source-search-clear"
          icon-test-id="source-search-magnifier"
          @update:model-value="searchQuery = $event"
          @submit="findStep(1)"
        />

        <div
          class="pr-source-view__actions"
          data-testid="source-toolbar-actions"
        >
          <button
            type="button"
            class="pr-source-view__icon-btn"
            data-testid="source-find-next"
            :title="t('sourceFindNext', locale)"
            :disabled="!searchQuery.trim()"
            @click="findStep(1)"
          >
            <PrIcon name="chevron-down" />
          </button>
          <button
            type="button"
            class="pr-source-view__icon-btn"
            data-testid="source-find-prev"
            :title="t('sourceFindPrev', locale)"
            :disabled="!searchQuery.trim()"
            @click="findStep(-1)"
          >
            <PrIcon name="chevron-up" />
          </button>
          <button
            type="button"
            class="pr-source-view__icon-btn"
            data-testid="source-scroll-top"
            :title="t('sourceScrollTop', locale)"
            @click="scrollTop"
          >
            <PrIcon name="to-top" />
          </button>
          <button
            type="button"
            class="pr-source-view__icon-btn"
            data-testid="source-sort-asc"
            :class="{ 'pr-source-view__icon-btn--on': !sortDesc }"
            :title="t('sourceSortMetric', locale)"
            :aria-pressed="!sortDesc"
            @click="setNavigateSort(false)"
          >
            <PrIcon name="sort-asc" />
          </button>
          <button
            type="button"
            class="pr-source-view__icon-btn"
            data-testid="source-sort-desc"
            :class="{ 'pr-source-view__icon-btn--on': sortDesc }"
            :title="t('sourceSortMetric', locale)"
            :aria-pressed="sortDesc"
            @click="setNavigateSort(true)"
          >
            <PrIcon name="sort-desc" />
          </button>
          <button
            type="button"
            class="pr-source-view__icon-btn"
            data-testid="source-scroll-bottom"
            :title="t('sourceScrollBottom', locale)"
            @click="scrollBottom"
          >
            <PrIcon name="to-bottom" />
          </button>
          <button
            type="button"
            class="pr-source-view__icon-btn"
            data-testid="source-user-guide"
            :title="t('userGuide', locale)"
            @click="openUserGuide"
          >
            <PrIcon name="help" />
          </button>
        </div>

        <span
          v-if="model.mock"
          class="pr-source-view__mock"
          data-testid="source-mock-badge"
        >{{ t('sourceMockData', locale) }}</span>
      </div>
    </Teleport>

    <div
      ref="panesEl"
      class="pr-source-view__panes"
    >
      <div
        class="pr-source-view__pane"
        :class="{ 'pr-source-view__pane--selected': selectedPane === 'source' }"
        data-testid="source-pane-source"
        @pointerdown="selectPane('source')"
      >
        <div
          class="pr-source-view__pane-bar"
          data-testid="source-pane-bar"
        >
          <div class="pr-source-view__pane-bar-lead">
            <SourcePillSelect
              :caption="t('sourceFile', locale)"
              :model-value="selectedFileId"
              :options="sourceFileOptions"
              test-id="source-file-select"
              @update:model-value="onSourceFileChange"
            />
            <button
              type="button"
              class="pr-source-view__icon-btn"
              data-testid="source-link-source"
              :class="{ 'pr-source-view__icon-btn--on': linkViews }"
              :title="t('sourceLinkSync', locale)"
              :aria-pressed="linkViews"
              @click="toggleLinkViews"
            >
              <PrIcon name="link" />
            </button>
          </div>
          <div class="pr-source-view__pane-bar-break" />
          <div class="pr-source-view__pane-bar-nav">
            <SourcePillSelect
              :caption="t('sourceNavigateBy', locale)"
              :model-value="sourceNavigateBy"
              :options="sourceNavigateOptions"
              test-id="source-navigate-by"
              @update:model-value="sourceNavigateBy = $event"
            />
          </div>
        </div>
        <!-- v930-source: # + Source ≈ 63% of the left pane; metrics strip takes the rest. -->
        <SuduCodePane
          v-if="sourceFile"
          ref="sourcePane"
          class="pr-source-view__pane-body"
          :file="sourceFile"
          :worker-url="suduWorkerUrl"
          :current-line="sourceLine"
          :correlated-lines="correlatedSource"
          :editor-ratio="0.62"
          @update:current-line="onSourceLine"
        />
      </div>
      <div
        class="pr-source-view__pane"
        :class="{ 'pr-source-view__pane--selected': selectedPane === 'asm' }"
        data-testid="source-pane-asm"
        @pointerdown="selectPane('asm')"
      >
        <div
          class="pr-source-view__pane-bar"
          data-testid="source-pane-bar"
        >
          <div class="pr-source-view__pane-bar-lead">
            <SourcePillSelect
              :caption="t('sourceFile', locale)"
              :model-value="model.assembly.id"
              :options="asmFileOptions"
              test-id="source-asm-select"
            />
            <button
              type="button"
              class="pr-source-view__icon-btn"
              data-testid="source-link-asm"
              :class="{ 'pr-source-view__icon-btn--on': linkViews }"
              :title="t('sourceLinkSync', locale)"
              :aria-pressed="linkViews"
              @click="toggleLinkViews"
            >
              <PrIcon name="link" />
            </button>
          </div>
          <div class="pr-source-view__pane-bar-break" />
          <div class="pr-source-view__pane-bar-nav">
            <SourcePillSelect
              :caption="t('sourceNavigateBy', locale)"
              :model-value="asmNavigateBy"
              :options="asmNavigateOptions"
              test-id="source-asm-navigate-by"
              @update:model-value="asmNavigateBy = $event"
            />
          </div>
        </div>
        <!-- SASS: Address + Assembly are table cells (sketch) — no Sudu editor. -->
        <AsmTablePane
          ref="asmPane"
          class="pr-source-view__pane-body"
          :file="model.assembly"
          :current-line="asmLine"
          :correlated-lines="correlatedAsm"
          :match-lines="asmMatchLines"
          :search-query="asmSearchQuery"
          @update:current-line="onAsmLine"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
  Source chrome colors sampled from v930-source/source-correlation:
  deep #1F1F1F · control #2A2A2A · body #1A1A1A / metrics #1E1E1E ·
  muted label #B3B3B3 · text #CCCCCC · accent #3078F0 (playhead token).
*/
.pr-source-view {
  --pr-src-bg-deep: #1f1f1f;
  --pr-src-bg-body: #1a1a1a;
  --pr-src-bg-metrics: #1e1e1e;
  --pr-src-bg-control: #363636;
  --pr-src-bg-header: #2a2a2a;
  --pr-src-border: #333333;
  --pr-src-border-soft: #2e2e2e;
  --pr-src-divider: #3a3a3a;
  --pr-src-label: #b3b3b3;
  --pr-src-text: #c8c8c8;
  --pr-src-text-strong: #c8c8c8;
  --pr-src-accent: #3078f0;
  --pr-src-control-h: 28px;
  --pr-src-control-radius: 6px;
  --pr-src-ui-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;

  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  background: var(--pr-src-bg-deep);
  color: var(--pr-src-text);
  font-family: var(--pr-src-ui-font);
  font-size: 12px;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}

/* Tab-row chrome: no padding/margin — ReportToolbar already insets the strip.
   Tokens redeclared here because Teleport mounts outside `.pr-source-view`. */
.pr-source-view__views-row {
  /* v930-source: chrome text is muted grey; controls share one control height. */
  --pr-src-bg-control: #363636;
  --pr-src-divider: #3a3a3a;
  --pr-src-label: #b3b3b3;
  --pr-src-text: #c8c8c8;
  --pr-src-text-strong: #c8c8c8;
  --pr-src-accent: #3078f0;
  --pr-src-control-h: 28px;
  --pr-src-control-radius: 6px;
  --pr-src-ui-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;

  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  min-width: 0;
  width: 100%;
  justify-content: flex-end;
  color: var(--pr-src-label);
  font-family: var(--pr-src-ui-font);
  font-size: 12px;
  font-weight: 400;
}

.pr-source-view__pane-bar {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 5px 10px;
  background: var(--pr-src-bg-deep);
  min-width: 0;
}

.pr-source-view__pane-bar-lead,
.pr-source-view__pane-bar-nav {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  width: max-content;
  max-width: 100%;
}

/* Hidden until both bars switch together. flex-basis 100% drops Navigate By. */
.pr-source-view__pane-bar-break {
  display: none;
  flex: 0 0 100%;
  height: 0;
}

.pr-source-view--pane-bars-two .pr-source-view__pane-bar-break {
  display: block;
}

/* Match search height/radius; keep shared pill chevron from tokens.css.
   Trigger lives in SourcePillSelect — :deep so the closed control stays this pill. */
:deep(.pr-source-view__select) {
  box-sizing: border-box;
  height: var(--pr-src-control-h, 28px);
  max-width: 220px;
  padding-top: 0;
  padding-bottom: 0;
  border-radius: var(--pr-src-control-radius, 6px);
  background-color: var(--pr-src-bg-control, #363636);
  color: var(--pr-src-text, #c8c8c8);
  font-size: 12px;
  line-height: calc(var(--pr-src-control-h, 28px) - 2px);
}

.pr-source-view__actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* Same grey rounded chrome as timeline toolbar icon buttons (v930-source). */
.pr-source-view__icon-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--pr-src-control-h, 28px);
  height: var(--pr-src-control-h, 28px);
  margin: 0;
  padding: 0;
  border: none;
  border-radius: var(--pr-src-control-radius, 6px);
  background: var(--pr-src-bg-control, #363636);
  color: var(--pr-src-label, #b3b3b3);
  cursor: pointer;
}

.pr-source-view__icon-btn:hover:not(:disabled) {
  color: #2d70e3;
  background: #1e2a3e;
}

.pr-source-view__icon-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.pr-source-view__icon-btn--on {
  color: #2d70e3;
  background: #1e2a3e;
}

.pr-source-view__mock {
  padding: 1px 8px;
  border-radius: 2px;
  background: #3a2f1a;
  color: #e6c07b;
  font-size: 11px;
}

.pr-source-view__panes {
  display: flex;
  gap: 12px;
  flex: 1 1 auto;
  min-height: 0;
}

.pr-source-view__pane {
  display: flex;
  flex-direction: column;
  flex: 1 1 50%;
  min-width: 0;
  min-height: 0;
}

.pr-source-view__pane-body {
  flex: 1 1 auto;
  min-height: 0;
  /* Blue frame only on the selected pane; keep the 2px box so content does not shift. */
  border: 2px solid transparent;
  border-radius: 6px;
  overflow: hidden;
  background: var(--pr-src-bg-body);
}

.pr-source-view__pane--selected .pr-source-view__pane-body {
  border-color: var(--pr-src-accent, #3078f0);
}
</style>
