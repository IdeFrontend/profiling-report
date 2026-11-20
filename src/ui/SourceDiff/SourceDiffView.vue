<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { SourceCorrelationModel, SourceFileModel } from '../../domain/types';
import { t } from '../../i18n';
import { alignSourceLines, splitSourceLines, type DiffRow } from './diffAlign';
import PrIcon from '../PrIcon.vue';
import SourceDiffPane from './SourceDiffPane.vue';

const props = withDefaults(
  defineProps<{
    /** Current operator's source correlation — rendered in the left (focused) pane. */
    current: SourceCorrelationModel;
    /** Selected baseline operator's source correlation — rendered in the right pane. */
    baseline: SourceCorrelationModel;
    locale?: string;
    suduWorkerUrl?: string;
    searchQuery?: string;
  }>(),
  {
    locale: undefined,
    suduWorkerUrl: '/sudu/worker.js',
    searchQuery: '',
  },
);

const emit = defineEmits<{
  exit: [];
}>();

type DockTab = 'inline' | 'markers' | 'stats';
type PaneSide = 'left' | 'right';

const DOCK_TABS: { id: DockTab; key: 'sourceDiffTabInlineFunctions' | 'sourceDiffTabSourceMarkers' | 'sourceDiffTabStatistics' }[] = [
  { id: 'inline', key: 'sourceDiffTabInlineFunctions' },
  { id: 'markers', key: 'sourceDiffTabSourceMarkers' },
  { id: 'stats', key: 'sourceDiffTabStatistics' },
];

const dockTab = ref<DockTab>('inline');
const leftFileId = ref('');
const rightFileId = ref('');

const leftFiles = computed<SourceFileModel[]>(() => props.current.files);
const rightFiles = computed<SourceFileModel[]>(() => props.baseline.files);

const EMPTY_FILE: SourceFileModel = { id: '', path: '', metricsColumns: [], lines: [], text: '' };

function resolveFile(files: SourceFileModel[], id: string, path?: string): SourceFileModel {
  return files.find((f) => f.id === id) ?? files.find((f) => f.path === path) ?? files[0] ?? EMPTY_FILE;
}

/** Keep both sides on the same file path when the baseline ships the same file set. */
function syncFileIds(keep: PaneSide): void {
  const left = props.current.files;
  const right = props.baseline.files;
  if (keep === 'left' || !leftFileId.value) {
    const picked = resolveFile(left, leftFileId.value);
    leftFileId.value = picked.id;
    rightFileId.value = resolveFile(right, rightFileId.value, picked.path).id;
  } else {
    const picked = resolveFile(right, rightFileId.value);
    rightFileId.value = picked.id;
    leftFileId.value = resolveFile(left, leftFileId.value, picked.path).id;
  }
}

watch(
  () => [props.current, props.baseline],
  () => {
    leftFileId.value = '';
    rightFileId.value = '';
    syncFileIds('left');
  },
  { immediate: true },
);

const leftFile = computed(() => resolveFile(leftFiles.value, leftFileId.value));
const rightFile = computed(() => resolveFile(rightFiles.value, rightFileId.value));

/** Navigate By is one shared metric across both panes; default to the first column. */
const metricColumns = computed(() =>
  leftFile.value.metricsColumns.length
    ? leftFile.value.metricsColumns
    : rightFile.value.metricsColumns,
);
const navigateBy = ref('');
watch(
  metricColumns,
  (columns) => {
    if (!columns.some((col) => col.id === navigateBy.value)) {
      navigateBy.value = columns[0]?.id ?? '';
    }
  },
  { immediate: true },
);

const rows = computed<DiffRow[]>(() =>
  alignSourceLines(
    leftFile.value.text ? splitSourceLines(leftFile.value.text) : [],
    rightFile.value.text ? splitSourceLines(rightFile.value.text) : [],
  ),
);

/** Unchanged rows stay: the compare chrome has no collapse control (Source has none). */
const displayRows = computed<DiffRow[]>(() => rows.value);

const leftPane = ref<InstanceType<typeof SourceDiffPane> | null>(null);
const rightPane = ref<InstanceType<typeof SourceDiffPane> | null>(null);

/** Names declared with `inline` before their parameter list, in file order. */
function inlineFunctionNames(file: SourceFileModel): string[] {
  const re = /\binline\s+[^\n(){}=;]*?\b([A-Za-z_]\w*)\s*\(/g;
  return [...file.text.matchAll(re)].map((m) => m[1]!);
}

const dockPanes = computed(() => [
  { side: 'left' as const, inlineNames: inlineFunctionNames(leftFile.value) },
  { side: 'right' as const, inlineNames: inlineFunctionNames(rightFile.value) },
]);

/** Mirror one pane's wheel into the other; the pane's own echo sentinel stops the bounce. */
const linked = ref(true);

function syncScroll(side: 'left' | 'right') {
  return (css: number): void => {
    if (!linked.value) return;
    if (side === 'left') rightPane.value?.setScrollCss(css);
    else leftPane.value?.setScrollCss(css);
  };
}

/** Link toggle: resuming copies the left pane's offset so the panes snap together. */
function toggleLink(): void {
  linked.value = !linked.value;
  if (linked.value) {
    rightPane.value?.setScrollCss(leftPane.value?.getScrollCss() ?? 0);
  }
}

const dockCollapsed = ref(false);

function toggleDock(): void {
  dockCollapsed.value = !dockCollapsed.value;
}

/** Move both panes to a view row. */
function scrollToRow(index: number): void {
  leftPane.value?.scrollToRow(index);
  rightPane.value?.scrollToRow(index);
}

/** Navigate By rows use this pane's (left) metric column, like the Source tab's focused pane. */
const navCursor = ref(-1);

function hasNavigateData(value: number | string | null | undefined): boolean {
  return typeof value === 'number' ? value !== 0 : value != null && value !== '';
}

function metricValue(line: number, column: string): number {
  const row = leftFile.value.lines.find((entry) => entry.line === line);
  const value = row?.values[column];
  return typeof value === 'number' ? value : 0;
}

watch([displayRows, navigateBy], () => {
  navCursor.value = -1;
  searchCursor.value = -1;
});

/** View rows with Navigate By data in document order. */
const dataRows = computed<number[]>(() =>
  displayRows.value.flatMap((row, index) =>
    row.leftLine != null &&
    hasNavigateData(leftFile.value.lines.find((entry) => entry.line === row.leftLine)?.values[navigateBy.value])
      ? [index]
      : [],
  ),
);

/** View rows with Navigate By data, ordered by value (Source tab's `hotLines`). */
function valueRows(desc: boolean): number[] {
  const rowsWithData = dataRows.value
    .map((index) => ({
      index,
      line: displayRows.value[index]!.leftLine!,
      value: metricValue(displayRows.value[index]!.leftLine!, navigateBy.value),
    }))
    .sort((a, b) =>
      a.value !== b.value ? (desc ? b.value - a.value : a.value - b.value) : desc ? b.line - a.line : a.line - b.line,
    );
  return rowsWithData.map((entry) => entry.index);
}

function jumpToViewRow(index: number): void {
  navCursor.value = index;
  scrollToRow(index);
}

/** Next/previous data row in document order; does not wrap, the end stays. */
function stepDataRow(dir: 1 | -1): void {
  const rowsInOrder = dataRows.value;
  if (!rowsInOrder.length) return;
  let next: number;
  if (navCursor.value < 0) next = dir === 1 ? rowsInOrder[0]! : rowsInOrder[rowsInOrder.length - 1]!;
  else if (dir === 1) next = rowsInOrder.find((index) => index > navCursor.value) ?? navCursor.value;
  else {
    next = navCursor.value;
    for (let i = rowsInOrder.length - 1; i >= 0; i -= 1) {
      if (rowsInOrder[i]! < navCursor.value) {
        next = rowsInOrder[i]!;
        break;
      }
    }
  }
  if (next !== navCursor.value) jumpToViewRow(next);
}

/** Step along value order; a cursor outside the order starts at its first row. */
function stepValueRow(desc: boolean): void {
  const ordered = valueRows(desc);
  if (!ordered.length) return;
  const current = ordered.indexOf(navCursor.value);
  const next = current < 0 ? ordered[0]! : ordered[Math.min(current + 1, ordered.length - 1)]!;
  if (next !== navCursor.value) jumpToViewRow(next);
}

function goToExtreme(desc: boolean): void {
  const target = valueRows(desc)[0];
  if (target != null && target !== navCursor.value) jumpToViewRow(target);
}

const searchCursor = ref(-1);

/** Enter in the search field walks matches through the left pane's text. */
function findSearch(dir: 1 | -1): void {
  const needle = props.searchQuery.trim().toLowerCase();
  if (!needle) return;
  const matches = displayRows.value.flatMap((row, index) =>
    row.leftText.toLowerCase().includes(needle) ? [index] : [],
  );
  if (!matches.length) return;
  const current = matches.indexOf(searchCursor.value);
  const next =
    current < 0
      ? dir === 1
        ? matches[0]!
        : matches[matches.length - 1]!
      : matches[(current + dir + matches.length) % matches.length]!;
  searchCursor.value = next;
  jumpToViewRow(next);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation();
    emit('exit');
  }
}

defineExpose({
  findNext: () => stepDataRow(1),
  findPrev: () => stepDataRow(-1),
  navHighest: () => goToExtreme(true),
  navLowest: () => goToExtreme(false),
  sortAsc: () => stepValueRow(false),
  sortDesc: () => stepValueRow(true),
  findSearch,
  toggleDock,
});
</script>

<template>
  <div
    class="pr-src-diff"
    data-testid="source-diff-view"
    tabindex="-1"
    @keydown="onKeydown"
  >
    <div class="pr-src-diff__panes">
      <div
        class="pr-src-diff__pane pr-src-diff__pane--left"
        data-testid="source-diff-pane-host-left"
      >
        <SourceDiffPane
          ref="leftPane"
          :rows="displayRows"
          side="left"
          :metrics="leftFile"
          :files="leftFiles"
          :active-file-id="leftFileId"
          :locale="locale"
          :worker-url="suduWorkerUrl"
          :search-query="searchQuery"
          :scroll-listener="syncScroll('left')"
          :linked="linked"
          :highlight-column="navigateBy"
          @toggle-link="toggleLink"
          @update:navigate-by="navigateBy = $event"
          @select-file="
            (id) => {
              leftFileId = id;
              syncFileIds('left');
            }
          "
        />
      </div>
      <div
        class="pr-src-diff__pane"
        data-testid="source-diff-pane-host-right"
      >
        <SourceDiffPane
          ref="rightPane"
          :rows="displayRows"
          side="right"
          :metrics="rightFile"
          :files="rightFiles"
          :active-file-id="rightFileId"
          :locale="locale"
          :worker-url="suduWorkerUrl"
          :search-query="searchQuery"
          :scroll-listener="syncScroll('right')"
          :linked="linked"
          :highlight-column="navigateBy"
          @toggle-link="toggleLink"
          @update:navigate-by="navigateBy = $event"
        />
      </div>
    </div>

    <div class="pr-src-diff__dock">
      <div
        class="pr-src-diff__tabs"
        role="tablist"
        :aria-label="t('sourceDiffTitle', locale)"
      >
        <button
          v-for="tab in DOCK_TABS"
          :key="tab.id"
          type="button"
          role="tab"
          class="pr-src-diff__tab"
          :class="{ 'pr-src-diff__tab--active': dockTab === tab.id }"
          :aria-selected="dockTab === tab.id"
          :data-testid="`source-diff-tab-${tab.id}`"
          @click="dockTab = tab.id"
        >
          {{ t(tab.key, locale) }}
        </button>
        <button
          type="button"
          class="pr-src-diff__dock-toggle"
          data-testid="source-diff-dock-toggle"
          :aria-expanded="!dockCollapsed"
          :aria-label="t('sourceDiffDockToggle', locale)"
          :title="t('sourceDiffDockToggle', locale)"
          @click="toggleDock"
        >
          <PrIcon :name="dockCollapsed ? 'chevron-up' : 'chevron-down'" />
        </button>
      </div>
      <div
        v-show="!dockCollapsed"
        class="pr-src-diff__dock-body"
      >
        <section
          v-for="pane in dockPanes"
          :key="pane.side"
          class="pr-src-diff__dock-pane"
          :data-testid="`source-diff-dock-${pane.side}`"
          :aria-label="t(pane.side === 'left' ? 'sourceDiffLeftPane' : 'sourceDiffRightPane', locale)"
        >
          <header class="pr-src-diff__dock-title">
            {{ t('sourceDiffSourcePane', locale) }}
          </header>
          <p
            class="pr-src-diff__dock-line"
            :data-testid="`source-diff-dock-${pane.side}-content`"
          >
            <template v-if="dockTab === 'inline'">
              {{ pane.inlineNames.length ? pane.inlineNames.join(', ') : t('sourceDiffNoInlineFunctions', locale) }}
            </template>
            <template v-else-if="dockTab === 'markers'">
              {{ t('sourceDiffTabSourceMarkers', locale) }}: {{ t('sourceDiffSourceMarkersEmpty', locale) }}
            </template>
            <template v-else>
              {{ t('sourceDiffTabStatistics', locale) }}: {{ t('sourceDiffStatisticsEmpty', locale) }}
            </template>
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pr-src-diff {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  background: var(--pr-bg-deep, #1f1f1f);
}

.pr-src-diff:focus-visible {
  outline: 2px solid var(--pr-playhead, #3078f0);
  outline-offset: -2px;
}

.pr-src-diff__panes {
  box-sizing: border-box;
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  gap: 12px;
  padding: 0 12px;
  background: var(--pr-bg-deep, #1f1f1f);
}

.pr-src-diff__pane {
  display: flex;
  flex: 1 1 50%;
  min-width: 0;
  min-height: 0;
}

.pr-src-diff__dock {
  flex: 0 0 auto;
  border-top: 1px solid var(--pr-divider, #3a3a3a);
  background: var(--pr-bg-deep, #1f1f1f);
}

.pr-src-diff__tabs {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 25px;
  height: 46px;
  padding: 0 0 0 12px;
}

.pr-src-diff__dock-toggle {
  position: absolute;
  top: 50%;
  left: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #b3b3b3;
  transform: translate(-50%, -50%);
  cursor: pointer;
}

.pr-src-diff__dock-toggle:hover {
  color: #ffffff;
}

.pr-src-diff__dock-toggle:focus-visible {
  outline: 2px solid var(--pr-playhead, #3078f0);
  outline-offset: 1px;
}

.pr-src-diff__tab {
  position: relative;
  appearance: none;
  border: 0;
  background: transparent;
  color: #b3b3b3;
  font: inherit;
  font-size: 12px;
  padding: 0;
  cursor: pointer;
}

.pr-src-diff__tab:hover {
  color: #e6e6e6;
}

.pr-src-diff__tab:focus-visible {
  outline: 2px solid var(--pr-playhead, #3078f0);
  outline-offset: 2px;
}

.pr-src-diff__tab--active {
  color: #ffffff;
}

.pr-src-diff__tab--active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 2px;
  height: 2px;
  background: #ffffff;
}

.pr-src-diff__dock-body {
  box-sizing: border-box;
  display: flex;
  gap: 12px;
  height: 132px;
  padding: 0 12px;
  background: var(--pr-bg-deep, #1f1f1f);
}

.pr-src-diff__dock-pane {
  box-sizing: border-box;
  flex: 0 1 35.7%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--pr-border-card, #353535);
  border-radius: 6px 6px 0 0;
  background: #2a2a2a;
}

.pr-src-diff__dock-pane + .pr-src-diff__dock-pane {
  flex: 1 1 63.6%;
}

.pr-src-diff__dock-title {
  box-sizing: border-box;
  height: 31px;
  padding: 0 16px;
  font-size: 12px;
  line-height: 31px;
  color: #b3b3b3;
}

.pr-src-diff__dock-line {
  margin: 0;
  padding: 0 16px;
  font-size: 12px;
  color: var(--pr-text, #e6e6e6);
}
</style>
