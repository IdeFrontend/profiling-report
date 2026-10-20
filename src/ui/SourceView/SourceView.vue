<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { SourceCorrelationModel, SourceFileModel } from '../../domain/types';
import { t } from '../../i18n';
import PrIcon from '../PrIcon.vue';
import { DEFAULT_USER_GUIDE_URL } from '../userGuide';
import AsmTablePane from './AsmTablePane.vue';
import SuduCodePane from './SuduCodePane.vue';
import './sourceFonts.css';

/** ReportToolbar mounts `[data-testid=source-chrome-host]` on the tab row. */
const SOURCE_CHROME_HOST = "[data-testid='source-chrome-host']";

const props = withDefaults(
  defineProps<{
    model: SourceCorrelationModel;
    locale?: string;
    suduWorkerUrl?: string;
    suduCodiconUrl?: string;
    userGuideUrl?: string;
  }>(),
  {
    locale: undefined,
    suduWorkerUrl: '/sudu/worker.js',
    suduCodiconUrl: '/sudu/codicon.ttf',
    userGuideUrl: DEFAULT_USER_GUIDE_URL,
  },
);

const emit = defineEmits<{
  'open-user-guide': [url: string];
}>();

type PaneApi = {
  setLine: (n: number) => void;
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
const activePane = ref<'source' | 'asm'>('source');
/**
 * After scroll-to-top/bottom both carets are forced independently. Suppress
 * cross-pane correlation highlights until the user selects a line again so we
 * do not paint a stale mapped partner beside the forced carets.
 */
const correlationSuppressed = ref(false);
/**
 * Which pane initiated the latest cross-pane sync. Blocks caret/selection echoes
 * from bouncing back (asm click → source setLine → Sudu caret → onSourceLine
 * would otherwise snap asm to mapped[0]).
 */
const syncOrigin = ref<'source' | 'asm' | null>(null);
let syncOriginClear: ReturnType<typeof setTimeout> | null = null;

function endSync() {
  syncOrigin.value = null;
  if (syncOriginClear != null) {
    clearTimeout(syncOriginClear);
    syncOriginClear = null;
  }
}

function beginSync(origin: 'source' | 'asm') {
  syncOrigin.value = origin;
  if (syncOriginClear != null) clearTimeout(syncOriginClear);
  // Sudu can echo caret after paint; keep the gate longer than ignoreCaret (50ms).
  syncOriginClear = setTimeout(endSync, 300);
}

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

const sourceMatchLines = computed(() => matchLinesIn(sourceTextLines.value, searchQuery.value));
/** Search Address + Assembly cells (SASS is table-only — no editor buffer for the query). */
const asmMatchLines = computed(() => {
  const needle = searchQuery.value.trim().toLowerCase();
  if (!needle) return [];
  return props.model.assembly.lines
    .filter((row) => {
      const addr = String(row.values.address ?? '').toLowerCase();
      const asm = String(row.values.assembly ?? '').toLowerCase();
      return addr.includes(needle) || asm.includes(needle);
    })
    .map((row) => row.line);
});

function matchLinesIn(lines: string[], q: string): number[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const out: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.toLowerCase().includes(needle)) out.push(i + 1);
  }
  return out;
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
  // Programmatic source caret from an asm-driven sync — keep asm where the user put it.
  if (syncOrigin.value === 'asm') {
    sourceLine.value = line;
    endSync();
    return;
  }
  activePane.value = 'source';
  sourceLine.value = line;
  if (!linkViews.value) return;
  const file = sourceFile.value;
  const mapped = file ? (props.model.sourceToAsm[`${file.id}:${line}`] ?? []) : [];
  if (mapped.length > 0) {
    beginSync('source');
    // Keep the asm caret if it already belongs to this source line (late Sudu echo
    // after an asm→source jump must not snap to mapped[0]).
    const stay = asmLine.value != null && mapped.includes(asmLine.value);
    const target = stay ? asmLine.value! : mapped[0]!;
    asmLine.value = target;
    asmPane.value?.setLine(target);
  } else {
    // Unmapped: clear opposite highlight so a stale pair is not shown.
    asmLine.value = null;
  }
}

function onAsmLine(line: number) {
  correlationSuppressed.value = false;
  if (syncOrigin.value === 'source') {
    asmLine.value = line;
    endSync();
    return;
  }
  activePane.value = 'asm';
  asmLine.value = line;
  if (!linkViews.value) return;
  const hit = props.model.asmToSource[line];
  if (hit) {
    if (hit.fileId !== selectedFileId.value) selectedFileId.value = hit.fileId;
    beginSync('asm');
    sourceLine.value = hit.line;
    // Prefer imperative setLine; SuduCodePane also watches currentLine + revealLine.
    sourcePane.value?.setLine(hit.line);
  } else {
    sourceLine.value = null;
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

/** Find next/prev only walk text matches — empty search is a no-op. */
function findStep(dir: 1 | -1) {
  const q = searchQuery.value.trim();
  if (!q) return;
  if (activePane.value === 'asm') {
    const next = cycleLine(asmMatchLines.value, asmLine.value, dir);
    if (next != null) jumpAsm(next);
    return;
  }
  const file = sourceFile.value;
  if (!file) return;
  const next = cycleLine(sourceMatchLines.value, sourceLine.value, dir);
  if (next != null) jumpSource(next);
}

/**
 * Sort Navigate By order (asc/desc). Toggles order and jumps to the first hot
 * line in that order for the active pane so the control is immediately useful.
 */
function setNavigateSort(desc: boolean) {
  sortDesc.value = desc;
  if (activePane.value === 'asm') {
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

function refreshChromeHost() {
  chromeHostReady.value = typeof document !== 'undefined'
    && document.querySelector(SOURCE_CHROME_HOST) != null;
}

onMounted(() => {
  refreshChromeHost();
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
});
</script>

<template>
  <div
    class="pr-source-view"
    data-testid="source-view"
    :data-mock="model.mock ? 'true' : 'false'"
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
        <label class="pr-source-view__field">
          <span>{{ t('sourceLeftView', locale) }}:</span>
          <select
            class="pr-block-pill pr-source-view__select"
            data-testid="source-left-view"
            disabled
            :aria-label="t('sourceLeftView', locale)"
          >
            <option selected>
              Source
            </option>
          </select>
        </label>
        <label class="pr-source-view__field">
          <span>{{ t('sourceRightView', locale) }}:</span>
          <select
            class="pr-block-pill pr-source-view__select"
            data-testid="source-right-view"
            disabled
            :aria-label="t('sourceRightView', locale)"
          >
            <option selected>
              SASS
            </option>
          </select>
        </label>

        <div class="pr-source-view__search">
          <label class="pr-source-view__search-field">
            <span class="pr-source-view__sr">{{ t('searchLabel', locale) }}</span>
            <PrIcon
              name="search"
              class="pr-source-view__search-icon"
            />
            <input
              data-testid="source-search"
              type="search"
              :value="searchQuery"
              :placeholder="t('searchPlaceholder', locale)"
              @input="searchQuery = ($event.target as HTMLInputElement).value"
              @keydown.enter.prevent="findStep(1)"
            >
          </label>
          <button
            v-if="searchQuery.length > 0"
            type="button"
            class="pr-source-view__search-clear"
            data-testid="source-search-clear"
            :aria-label="t('searchClear', locale)"
            @mousedown.prevent
            @click="searchQuery = ''"
          >
            ×
          </button>
        </div>

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
      class="pr-source-view__chrome"
    >
      <div class="pr-source-view__pane-bars">
        <div class="pr-source-view__pane-bar">
          <label class="pr-source-view__field">
            <span>{{ t('sourceFile', locale) }}:</span>
            <select
              class="pr-block-pill pr-source-view__select"
              data-testid="source-file-select"
              :value="selectedFileId"
              @change="onSourceFileChange(($event.target as HTMLSelectElement).value)"
            >
              <option
                v-for="f in model.files"
                :key="f.id"
                :value="f.id"
              >
                {{ f.path }}
              </option>
            </select>
          </label>
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
          <label class="pr-source-view__field">
            <span>{{ t('sourceNavigateBy', locale) }}:</span>
            <select
              class="pr-block-pill pr-source-view__select"
              data-testid="source-navigate-by"
              :value="sourceNavigateBy"
              @change="sourceNavigateBy = ($event.target as HTMLSelectElement).value"
            >
              <option
                v-for="opt in sourceNavigateOptions"
                :key="opt.id"
                :value="opt.id"
              >
                {{ opt.label }}
              </option>
            </select>
          </label>
        </div>
        <div class="pr-source-view__pane-bar">
          <label class="pr-source-view__field">
            <span>{{ t('sourceFile', locale) }}:</span>
            <select
              class="pr-block-pill pr-source-view__select"
              data-testid="source-asm-select"
              disabled
              :aria-label="t('sourceFile', locale)"
            >
              <option selected>
                {{ model.assembly.path }}
              </option>
            </select>
          </label>
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
          <label class="pr-source-view__field">
            <span>{{ t('sourceNavigateBy', locale) }}:</span>
            <select
              class="pr-block-pill pr-source-view__select"
              data-testid="source-asm-navigate-by"
              :value="asmNavigateBy"
              @change="asmNavigateBy = ($event.target as HTMLSelectElement).value"
            >
              <option
                v-for="opt in asmNavigateOptions"
                :key="opt.id"
                :value="opt.id"
              >
                {{ opt.label }}
              </option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <div class="pr-source-view__panes">
      <div class="pr-source-view__pane">
        <!-- v930-source: # + Source ≈ 63% of the left pane; metrics strip takes the rest. -->
        <SuduCodePane
          v-if="sourceFile"
          ref="sourcePane"
          :file="sourceFile"
          :worker-url="suduWorkerUrl"
          :codicon-url="suduCodiconUrl"
          :current-line="sourceLine"
          :correlated-lines="correlatedSource"
          :match-lines="sourceMatchLines"
          :editor-ratio="0.62"
          @update:current-line="onSourceLine"
        />
      </div>
      <div class="pr-source-view__vsplit" />
      <div class="pr-source-view__pane">
        <!-- SASS: Address + Assembly are table cells (sketch) — no Sudu editor. -->
        <AsmTablePane
          ref="asmPane"
          :file="model.assembly"
          :current-line="asmLine"
          :correlated-lines="correlatedAsm"
          :match-lines="asmMatchLines"
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
  --pr-src-mono-font: 'JetBrains Mono', ui-monospace, monospace;

  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  background: var(--pr-src-bg-body);
  color: var(--pr-src-text);
  font-family: var(--pr-src-ui-font);
  font-size: 12px;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}

.pr-source-view__chrome {
  flex: 0 0 auto;
  background: var(--pr-src-bg-deep);
  border-bottom: 1px solid var(--pr-src-border);
  font-size: 12px;
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

.pr-source-view__pane-bars {
  display: flex;
  align-items: stretch;
  min-height: 34px;
}

.pr-source-view__pane-bar {
  display: flex;
  flex: 1 1 50%;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 5px 10px;
  background: var(--pr-src-bg-deep);
  min-width: 0;
}

.pr-source-view__pane-bar + .pr-source-view__pane-bar {
  border-left: 1px solid var(--pr-src-border);
}

.pr-source-view__field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--pr-src-label);
}

/* Match search height/radius; keep shared pill chevron from tokens.css. */
.pr-source-view__select {
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

.pr-source-view__select:disabled {
  opacity: 0.85;
  cursor: default;
}

.pr-source-view__search {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  gap: 0;
}

.pr-source-view__search-field {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: var(--pr-src-control-h, 28px);
  min-width: 180px;
  padding: 0 8px;
  border: 1px solid var(--pr-src-divider);
  border-radius: var(--pr-src-control-radius, 6px);
  background: var(--pr-src-bg-control);
  color: var(--pr-src-label);
}

.pr-source-view__search-field:focus-within {
  border-color: var(--pr-src-accent);
  box-shadow: inset 0 0 0 1px var(--pr-src-accent);
}

.pr-source-view__search-icon {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
}

.pr-source-view__search-field input {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--pr-src-text);
  font-family: inherit;
  font-size: 12px;
}

.pr-source-view__search-field input::placeholder {
  color: #808080;
}

.pr-source-view__search-field input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

/* Room for the clear × when a query is present. */
.pr-source-view__search:has(.pr-source-view__search-clear) input {
  padding-right: 24px;
}

.pr-source-view__search-clear {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 2px;
  background: transparent;
  color: var(--pr-src-label);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.pr-source-view__search-clear:hover {
  color: #ffffff;
  background: #363636;
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

.pr-source-view__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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
  flex: 1 1 auto;
  min-height: 0;
}

.pr-source-view__pane {
  flex: 1 1 50%;
  min-width: 0;
  min-height: 0;
  /* v930-source: both panes share the same framed header chrome. */
  border: 1px solid #2e4a7a;
  border-radius: 4px;
  overflow: hidden;
  background: var(--pr-src-bg-body);
}

/* Sketch pane join is a hairline divider, not a thick blue strip. */
.pr-source-view__vsplit {
  flex: 0 0 1px;
  background: var(--pr-src-border);
}
</style>
