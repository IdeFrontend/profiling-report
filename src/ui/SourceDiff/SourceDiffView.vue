<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import type { ITextDiffModel } from '@sudu-ide/code-review';
import type { SourceCorrelationModel, SourceFileModel } from '../../domain/types';
import { t } from '../../i18n';
import { alignSourceLines, splitSourceLines, type DiffRow } from './diffAlign';
import SourceDiffPane from './SourceDiffPane.vue';
import PrIcon from '../PrIcon.vue';
import { getSuduWorkerPool, loadSuduApi, type SuduApi, type SuduWorkerPool } from '../SourceView/suduRuntime';

const props = withDefaults(
  defineProps<{
    /** Current operator's source correlation — rendered in the left (focused) pane. */
    current: SourceCorrelationModel;
    /** Selected baseline operator's source correlation — rendered in the right pane. */
    baseline?: SourceCorrelationModel;
    locale?: string;
    suduWorkerUrl?: string;
    searchQuery?: string;
    /** The open report still has placeholder files a workspace pick can fill. */
    currentWorkspaceAvailable?: boolean;
    /** The baseline still has placeholder files a workspace pick can fill. */
    baselineWorkspaceAvailable?: boolean;
  }>(),
  {
    baseline: undefined,
    locale: undefined,
    suduWorkerUrl: '/sudu/worker.js',
    searchQuery: '',
    currentWorkspaceAvailable: false,
    baselineWorkspaceAvailable: false,
  },
);

const emit = defineEmits<{
  exit: [];
  'pick-current-workspace': [];
  'pick-baseline-workspace': [];
}>();

type PaneSide = 'left' | 'right';

const leftFileId = ref('');
const rightFileId = ref('');
/** Pane that owns the focus ring; the last pane the operator pressed. */
const activeSide = ref<PaneSide>('left');

const leftFiles = computed<SourceFileModel[]>(() => props.current.files);
const rightFiles = computed<SourceFileModel[]>(() => props.baseline?.files ?? []);
/** A missing baseline, or one without files, gets an explicit empty right pane. */
const baselineEmpty = computed(() => !props.baseline || props.baseline.files.length === 0);

const EMPTY_FILE: SourceFileModel = { id: '', path: '', metricsColumns: [], lines: [], text: '' };

function resolveFile(files: SourceFileModel[], id: string, path?: string): SourceFileModel {
  return files.find((f) => f.id === id) ?? files.find((f) => f.path === path) ?? files[0] ?? EMPTY_FILE;
}

/** Keep both sides on the same file path when the baseline ships the same file set. */
function syncFileIds(keep: PaneSide): void {
  const left = props.current.files;
  const right = props.baseline?.files ?? [];
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

/** d.ts omits the runtime `dispose` that newDiffModel installs. */
type DiffModel = ITextDiffModel & { dispose?: () => void };

/** One pool and one diff model shared by both panes; SideDiff paints its own changes. */
const workers = shallowRef<SuduWorkerPool | null>(null);
const diffModel = shallowRef<DiffModel | null>(null);
let modelGeneration = 0;
let disposed = false;

function buildDiffModel(api: SuduApi, pool: SuduWorkerPool): DiffModel {
  return api.newDiffModel(
    pool,
    leftFile.value.text,
    rightFile.value.text,
    { path: leftFile.value.path },
    { path: rightFile.value.path },
    leftFile.value.language ?? rightFile.value.language,
  );
}

/** Rebuild on text or language changes; the latest request wins. */
async function rebuildDiffModel(): Promise<void> {
  const generation = ++modelGeneration;
  try {
    const api = await loadSuduApi();
    const pool = workers.value ?? (await getSuduWorkerPool(props.suduWorkerUrl));
    if (disposed || generation !== modelGeneration) return;
    workers.value = pool;
    const next = buildDiffModel(api, pool);
    const previous = diffModel.value;
    diffModel.value = next;
    // Panes apply the new model on the next flush; dispose the old one after that.
    if (previous) void nextTick(() => previous.dispose?.());
  } catch {
    // The metrics table still renders when Sudu is unavailable.
  }
}

watch(
  () => [
    leftFile.value.text,
    rightFile.value.text,
    leftFile.value.language,
    rightFile.value.language,
  ],
  () => {
    void rebuildDiffModel();
  },
);

onMounted(() => {
  void rebuildDiffModel();
});

onBeforeUnmount(() => {
  disposed = true;
  modelGeneration += 1;
});

// Child panes dispose their views first; the pool is process-cached and never disposed.
onUnmounted(() => {
  diffModel.value?.dispose?.();
  diffModel.value = null;
});

const leftPane = ref<InstanceType<typeof SourceDiffPane> | null>(null);
const rightPane = ref<InstanceType<typeof SourceDiffPane> | null>(null);

/** Mirror one pane's wheel into the other; the pane's own echo sentinel stops the bounce. */
function syncScroll(side: 'left' | 'right') {
  return (css: number): void => {
    if (side === 'left') rightPane.value?.setScrollCss(css);
    else leftPane.value?.setScrollCss(css);
  };
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
        @pointerdown="activeSide = 'left'"
      >
        <SourceDiffPane
          ref="leftPane"
          :rows="displayRows"
          side="left"
          :focused="activeSide === 'left'"
          :metrics="leftFile"
          :files="leftFiles"
          :active-file-id="leftFileId"
          :locale="locale"
          :diff-model="diffModel"
          :workers="workers"
          :scroll-listener="syncScroll('left')"
          :highlight-column="navigateBy"
          :workspace-available="currentWorkspaceAvailable"
          :workspace-title="t('sourceWorkspacePick', locale)"
          @pick-workspace="emit('pick-current-workspace')"
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
        @pointerdown="activeSide = 'right'"
      >
        <SourceDiffPane
          v-if="!baselineEmpty"
          ref="rightPane"
          :rows="displayRows"
          side="right"
          :focused="activeSide === 'right'"
          :metrics="rightFile"
          :files="rightFiles"
          :active-file-id="rightFileId"
          :locale="locale"
          :diff-model="diffModel"
          :workers="workers"
          :scroll-listener="syncScroll('right')"
          :highlight-column="navigateBy"
          :workspace-available="baselineWorkspaceAvailable"
          :workspace-title="t('sourceWorkspaceBaselinePick', locale)"
          @pick-workspace="emit('pick-baseline-workspace')"
          @update:navigate-by="navigateBy = $event"
        />
        <div
          v-else
          class="pr-src-diff__empty"
          data-testid="source-diff-baseline-empty"
        >
          <span class="pr-src-diff__empty-hint">{{ t('sourceDiffBaselineEmpty', locale) }}</span>
          <button
            v-if="baselineWorkspaceAvailable"
            type="button"
            class="pr-src-diff__empty-btn"
            data-testid="source-diff-workspace-right"
            :title="t('sourceDiffWorkspaceBaselineDisabled', locale)"
            :aria-label="t('sourceDiffWorkspaceBaselineDisabled', locale)"
            disabled
          >
            <PrIcon name="add-baseline" />
          </button>
        </div>
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

.pr-src-diff__empty {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  min-height: 0;
  color: #999999;
  font-size: 12px;
}

.pr-src-diff__empty-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  background: transparent;
  color: #666666;
  cursor: not-allowed;
}
</style>
