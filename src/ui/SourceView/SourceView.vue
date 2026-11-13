<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { SourceFrameTarget } from '../../adapters/sourceCorrelation/resolveSourceFrame';
import {
  applyResolvedSourceText,
  fileNeedsSourceResolve,
  type ResolveSourceFile,
} from '../../adapters/sourceCorrelation/resolveSourceFile';
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

/** Dropdown entries: `navigateBy` ids that this pane has a column for. */
function navigateOptions(
  navigateBy: readonly string[],
  columns: readonly { id: string; label: string }[] | undefined,
): { id: string; label: string }[] {
  const byId = new Map((columns ?? []).map((c) => [c.id, c.label]));
  return navigateBy.filter((id) => byId.has(id)).map((id) => ({ id, label: byId.get(id) ?? id }));
}

function firstListedNavigate(
  navigateBy: readonly string[],
  columns: readonly { id: string }[] | undefined,
): string {
  const present = new Set((columns ?? []).map((c) => c.id));
  return navigateBy.find((id) => present.has(id)) ?? navigateBy[0] ?? 'instructionsExecuted';
}

const props = withDefaults(
  defineProps<{
    model: SourceCorrelationModel;
    /**
     * Report-boundary generation from ProfilingReport. Bumps on load / operator /
     * host model swap — not on `resolveSourceFile` text fill — so search resets
     * across operators while same-shaped resolve overlays keep UI state.
     */
    session?: number;
    /** One-shot Source caret from a task-detail frame. Applied once per file and line. */
    focus?: SourceFrameTarget | null;
    locale?: string;
    suduWorkerUrl?: string;
    userGuideUrl?: string;
    /** Optional host hook for a source file whose pack text is the missing embed. */
    resolveSourceFile?: ResolveSourceFile;
  }>(),
  {
    session: 0,
    focus: null,
    locale: undefined,
    suduWorkerUrl: '/sudu/worker.js',
    userGuideUrl: DEFAULT_USER_GUIDE_URL,
    resolveSourceFile: undefined,
  },
);

const emit = defineEmits<{
  'open-user-guide': [url: string];
}>();

type PaneApi = {
  /** `queued` keeps the echo gate until boot; `unchanged` means Sudu will not emit. */
  setLine: (n: number) => 'queued' | 'unchanged' | 'moved' | void;
  clearLine?: () => void;
  stepSearch?: (dir: 1 | -1) => void;
};

const selectedFileId = ref(props.model.files[0]?.id ?? '');
const sourceNavigateBy = ref(
  firstListedNavigate(props.model.navigateBy, props.model.files[0]?.metricsColumns),
);
const asmNavigateBy = ref(
  firstListedNavigate(props.model.navigateBy, props.model.assembly.metricsColumns),
);
const sourceLine = ref<number | null>(null);
const asmLine = ref<number | null>(null);
const sourcePane = ref<PaneApi | null>(null);
const asmPane = ref<PaneApi | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
/** User-supplied / host-resolved text keyed by source file id. */
const overrides = ref<Record<string, string>>({});
const dragActive = ref(false);
/** Files already asked from the host once — null replies must not loop. */
const attemptedResolve = new Set<string>();
/** Host lookup progress for the retry button (`miss` keeps the drop zone). */
const resolveStatus = ref<'idle' | 'pending' | 'miss'>('idle');

const searchQuery = ref('');
/** Shared Link Views state — both pane toggles stay in sync. */
const linkViews = ref(true);
/**
 * Which dual pane owns chrome actions (search / navigate). Always one of the two;
 * defaults to Source. Clicks outside the panes do not clear it.
 */
const selectedPane = ref<'source' | 'asm'>('source');
/**
 * Which pane initiated the latest cross-pane sync. Cleared when the echo is
 * absorbed — no timer (timers raced real Sudu caret/paint).
 */
const syncOrigin = ref<'source' | 'asm' | null>(null);
/**
 * File select with no caret: highlight every instruction mapped to that source
 * file. The shared listing stays complete — this does not hide other files' rows.
 */
const showFileMatch = ref(false);

function toggleLinkViews() {
  linkViews.value = !linkViews.value;
  if (linkViews.value) scrollToFileMatch();
}

/** Last `{fileId}:{line}` applied from `focus`, so a manual file change is left alone. */
let appliedFocusKey = '';

function focusKey(focus: SourceFrameTarget | null | undefined): string {
  return focus ? `${focus.fileId}:${focus.line}` : '';
}

function clearFocusCaret() {
  appliedFocusKey = '';
  sourceLine.value = null;
  asmLine.value = null;
  syncOrigin.value = null;
  sourcePane.value?.clearLine?.();
  asmPane.value?.clearLine?.();
}

function applyFocus() {
  const focus = props.focus;
  const key = focusKey(focus);
  // Host cleared the frame caret (fresh load / operator switch). Do this even
  // when the model keeps the same file ids — resolveSourceFile's same-shape
  // preserve must not leave a stale current row.
  if (!focus || !key) {
    if (appliedFocusKey) clearFocusCaret();
    return;
  }
  if (key === appliedFocusKey) return;
  if (!props.model.files.some((file) => file.id === focus.fileId)) return;
  appliedFocusKey = key;
  selectedFileId.value = focus.fileId;
  void nextTick(() => jumpSource(focus.line));
}

watch(
  () => [props.model, props.session] as const,
  ([m], prev) => {
    const prevModel = prev?.[0];
    const prevSession = prev?.[1];
    // Same session + same file ids: resolveSourceFile filled Ascend C text —
    // keep caret, search, and file selection. A new session (operator / load /
    // host report swap) always resets, even when basenames still match.
    const sameSession = prevSession === props.session;
    const sameShape =
      prevModel != null &&
      prevModel.files.length === m.files.length &&
      prevModel.files.every((f, i) => f.id === m.files[i]?.id) &&
      prevModel.assembly.id === m.assembly.id;
    if (sameSession && sameShape && m.files.some((f) => f.id === selectedFileId.value)) {
      return;
    }
    selectedFileId.value = m.files[0]?.id ?? '';
    sourceNavigateBy.value = firstListedNavigate(m.navigateBy, m.files[0]?.metricsColumns);
    asmNavigateBy.value = firstListedNavigate(m.navigateBy, m.assembly.metricsColumns);
    sourceLine.value = null;
    asmLine.value = null;
    searchQuery.value = '';
    syncOrigin.value = null;
    showFileMatch.value = false;
    appliedFocusKey = '';
    overrides.value = {};
    attemptedResolve.clear();
    resolveStatus.value = 'idle';
    applyFocus();
  },
);

watch(() => focusKey(props.focus), () => applyFocus(), { immediate: true });

/** fileId → source file (built once per model). */
const filesById = computed(() => {
  const map = new Map<string, SourceFileModel>();
  for (const f of props.model.files) map.set(f.id, f);
  return map;
});

/** fileId → asm lines in listing order (built once per model, not per click). */
const asmLinesByFile = computed(() => {
  const map = new Map<string, number[]>();
  for (const [asmLine, hit] of props.model.asmToSource) {
    const list = map.get(hit.fileId);
    if (list) list.push(asmLine);
    else map.set(hit.fileId, [asmLine]);
  }
  for (const list of map.values()) list.sort((a, b) => a - b);
  return map;
});

function mappedAsmLines(fileId: string): number[] {
  return asmLinesByFile.value.get(fileId) ?? [];
}

function sourceMappedAsm(file: SourceFileModel | null | undefined, line: number): number[] {
  return file?.sourceToAsm?.get(line) ?? [];
}

/** File picker only — asm→source correlation may change `selectedFileId` without reset. */
function onSourceFileChange(fileId: string) {
  selectedFileId.value = fileId;
  sourceLine.value = null;
  asmLine.value = null;
  syncOrigin.value = null;
  showFileMatch.value = true;
  scrollToFileMatch();
}

const sourceFile = computed<SourceFileModel | null>(() => {
  const raw =
    props.model.files.find((f) => f.id === selectedFileId.value) ?? props.model.files[0] ?? null;
  if (!raw) return null;
  const override = overrides.value[raw.id];
  return override != null && fileNeedsSourceResolve(raw)
    ? applyResolvedSourceText(raw, override)
    : raw;
});

/** Raw model file, before any drop / host override. */
const rawSourceFile = computed<SourceFileModel | null>(() =>
  props.model.files.find((f) => f.id === selectedFileId.value) ?? props.model.files[0] ?? null,
);

/** Placeholder overlay only while no override exists for the selected file. */
const showResolveOverlay = computed(() => {
  const file = sourceFile.value;
  return file != null && fileNeedsSourceResolve(file) && overrides.value[file.id] == null;
});

function basenameOf(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function setOverride(fileId: string, text: string) {
  overrides.value = { ...overrides.value, [fileId]: text };
}

/** Ask the host once per file id; `force` is the explicit retry button. */
async function resolveSelected(force = false) {
  const raw = rawSourceFile.value;
  const resolve = props.resolveSourceFile;
  if (!raw || !resolve || !fileNeedsSourceResolve(raw)) return;
  if (!force && attemptedResolve.has(raw.id)) return;
  attemptedResolve.add(raw.id);
  resolveStatus.value = 'pending';
  try {
    const text = await resolve({ fileName: raw.path, basename: basenameOf(raw.path) });
    if (sourceFile.value?.id !== raw.id) return;
    if (text == null) {
      resolveStatus.value = 'miss';
      return;
    }
    const current = sourceFile.value;
    if (current?.id !== raw.id || !fileNeedsSourceResolve(current)) return;
    setOverride(raw.id, text);
    resolveStatus.value = 'idle';
  } catch {
    // Host miss: keep the placeholder.
    if (sourceFile.value?.id === raw.id) resolveStatus.value = 'miss';
  }
}

async function applyLocalFile(file: File) {
  const raw = rawSourceFile.value;
  if (!raw || !fileNeedsSourceResolve(raw)) return;
  try {
    const text = await file.text();
    if (sourceFile.value?.id !== raw.id) return;
    setOverride(raw.id, text);
  } catch {
    // Unreadable file: keep the placeholder.
  }
}

function openFilePicker() {
  fileInput.value?.click();
}

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) await applyLocalFile(file);
}

async function onDrop(event: DragEvent) {
  dragActive.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) await applyLocalFile(file);
}

function onDragLeave(event: DragEvent) {
  const zone = event.currentTarget as HTMLElement | null;
  const next = event.relatedTarget as Node | null;
  if (!zone || !next || !zone.contains(next)) dragActive.value = false;
}

watch(
  () => selectedFileId.value,
  () => {
    resolveStatus.value = 'idle';
    void resolveSelected();
  },
);

/** Scroll the shared listing to the first instruction of the selected file. */
function scrollToFileMatch() {
  if (!linkViews.value || !showFileMatch.value) return;
  if (sourceLine.value != null || asmLine.value != null) return;
  const fileId = sourceFile.value?.id;
  if (!fileId) return;
  const first = mappedAsmLines(fileId)[0];
  if (first != null) void nextTick(() => asmPane.value?.setLine(first));
}

const correlatedAsm = computed(() => {
  if (!linkViews.value) return [];
  const file = sourceFile.value;
  if (file && sourceLine.value != null) {
    return sourceMappedAsm(file, sourceLine.value);
  }
  if (showFileMatch.value && file && asmLine.value == null) return mappedAsmLines(file.id);
  // Asm-driven: expand siblings via asm → source → sourceToAsm (right-panel start).
  if (asmLine.value == null) return [];
  const hit = props.model.asmToSource.get(asmLine.value);
  if (!hit) return [];
  const hitFile = filesById.value.get(hit.fileId) ?? file;
  return sourceMappedAsm(hitFile, hit.line);
});

const correlatedSource = computed(() => {
  if (!linkViews.value) return [];
  if (asmLine.value == null) return [];
  const hit = props.model.asmToSource.get(asmLine.value);
  return hit ? [hit.line] : [];
});

/** Trimmed search — both panes paint matches; Enter still steps the selected pane only. */
const trimmedSearch = computed(() => searchQuery.value.trim());

/**
 * Right-pane search hits: Assembly column only (CLA-style substring chips).
 * Empty query → no table marks. Painted whether or not SASS is selected.
 */
const asmMatchLines = computed(() => {
  const needle = trimmedSearch.value.toLowerCase();
  if (!needle) return [];
  return props.model.assembly.lines
    .filter((row) => String(row.values.assembly ?? '').toLowerCase().includes(needle))
    .map((row) => row.line);
});

function selectPane(pane: 'source' | 'asm') {
  selectedPane.value = pane;
}

function metricValue(file: SourceFileModel, line: number, colId: string): number {
  const row = file.lines.find((l) => l.line === line);
  const v = row?.values[colId];
  return typeof v === 'number' ? v : 0;
}

/** Navigate By cell counts as data. A numeric 0 does not; a missing cell does not. */
function hasNavigateData(v: number | string | null | undefined): boolean {
  return typeof v === 'number' ? v !== 0 : v != null && v !== '';
}

/**
 * Rows with Navigate By data, ordered by value.
 * Ascending visits the earlier line first on a tie; descending visits the later line first.
 */
function hotLines(file: SourceFileModel, col: string, desc: boolean): number[] {
  const rows = file.lines
    .filter((l) => hasNavigateData(l.values[col]))
    .map((l) => ({ line: l.line, value: metricValue(file, l.line, col) }));
  rows.sort((a, b) => {
    if (a.value !== b.value) return desc ? b.value - a.value : a.value - b.value;
    return desc ? b.line - a.line : a.line - b.line;
  });
  return rows.map((r) => r.line);
}

/** Next row in a value order. A caret that is not in `lines` starts at the first. The end stays. */
function nextHotLine(lines: number[], current: number | null): number | null {
  if (lines.length === 0) return null;
  const i = current == null ? -1 : lines.indexOf(current);
  if (i < 0) return lines[0]!;
  return lines[Math.min(i + 1, lines.length - 1)]!;
}

function onSourceLine(line: number) {
  showFileMatch.value = false;
  // Asm-driven setLine echo — keep asm caret; clear the gate (no timer).
  if (syncOrigin.value === 'asm') {
    sourceLine.value = line;
    syncOrigin.value = null;
    return;
  }
  const file = sourceFile.value;
  const mapped = sourceMappedAsm(file, line);
  // Falite-scale: one source line can map to thousands of PCs — Set for O(1).
  const mappedSet = mapped.length > 0 ? new Set(mapped) : null;
  // Late caret echo for the same mapped group: keep asm sibling, do not steal pane.
  if (sourceLine.value === line && asmLine.value != null && linkViews.value) {
    if (mappedSet?.has(asmLine.value)) return;
  }
  selectedPane.value = 'source';
  sourceLine.value = line;
  if (!linkViews.value) return;
  if (mappedSet && mapped.length > 0) {
    syncOrigin.value = 'source';
    // Keep the asm caret if it already belongs to this source line.
    const stay = asmLine.value != null && mappedSet.has(asmLine.value);
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
  showFileMatch.value = false;
  if (syncOrigin.value === 'source') {
    asmLine.value = line;
    syncOrigin.value = null;
    return;
  }
  selectedPane.value = 'asm';
  asmLine.value = line;
  if (!linkViews.value) return;
  const hit = props.model.asmToSource.get(line);
  if (hit) {
    const fileChanged = hit.fileId !== selectedFileId.value;
    if (fileChanged) selectedFileId.value = hit.fileId;
    // A different file swaps the Sudu model after this handler. setLine now would
    // clamp to the old document and the echo would store that line. The file
    // watch applies currentLine after setModel and does not echo.
    if (fileChanged) {
      syncOrigin.value = null;
      sourceLine.value = hit.line;
    } else {
      syncOrigin.value = 'asm';
      sourceLine.value = hit.line;
      // Same-line setPosition does not emit a caret. Drop the gate or the next
      // source click is swallowed as an echo (PR-SOURCE-006). Queued (pre-boot)
      // stays armed until that echo.
      const applied = sourcePane.value?.setLine(hit.line);
      if (applied === 'unchanged') syncOrigin.value = null;
    }
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

function selectedNavigateFile(): SourceFileModel | null {
  return selectedPane.value === 'asm' ? props.model.assembly : sourceFile.value;
}

function selectedNavigateColumn(): string {
  return selectedPane.value === 'asm' ? asmNavigateBy.value : sourceNavigateBy.value;
}

function selectedCaret(): number | null {
  return selectedPane.value === 'asm' ? asmLine.value : sourceLine.value;
}

/** Document order of rows whose Navigate By cell has data. */
function dataLinesInOrder(file: SourceFileModel, col: string): number[] {
  return file.lines.filter((l) => hasNavigateData(l.values[col])).map((l) => l.line);
}

/**
 * Next/previous data row in document order. Does not wrap.
 * No caret → next starts at the first data row, previous at the last.
 * A caret past the last data row stays; one before the first stays.
 */
function stepDataLine(lines: number[], current: number | null, dir: 1 | -1): number | null {
  if (lines.length === 0) return null;
  if (current == null) return dir === 1 ? lines[0]! : lines[lines.length - 1]!;
  if (dir === 1) return lines.find((n) => n > current) ?? current;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]! < current) return lines[i]!;
  }
  return current;
}

function jumpSelected(line: number) {
  if (selectedPane.value === 'asm') jumpAsm(line);
  else jumpSource(line);
}

/** Prev/next row with Navigate By data in the selected pane. Independent of search. */
function stepSelectedData(dir: 1 | -1) {
  const file = selectedNavigateFile();
  if (!file) return;
  const next = stepDataLine(dataLinesInOrder(file, selectedNavigateColumn()), selectedCaret(), dir);
  if (next == null || next === selectedCaret()) return;
  jumpSelected(next);
}

/**
 * Enter walks matches in the selected pane only — empty search is a no-op.
 * Both panes already paint highlights from `trimmedSearch`.
 */
function findSearchStep(dir: 1 | -1) {
  if (!trimmedSearch.value) return;
  if (selectedPane.value === 'asm') {
    const next = cycleLine(asmMatchLines.value, asmLine.value, dir);
    if (next != null) jumpAsm(next);
    return;
  }
  sourcePane.value?.stepSearch?.(dir);
}

/**
 * Step the selected pane along its Navigate By values.
 * Ascending walks increasing values (earlier line first on a tie); descending
 * walks decreasing values (later line first on a tie). The other pane's
 * Navigate By is ignored. No caret, or a caret on a row with no data, starts
 * at the first line of that order. The end stays — the walk does not wrap.
 */
function setNavigateSort(desc: boolean) {
  const file = selectedNavigateFile();
  if (!file) return;
  const next = nextHotLine(hotLines(file, selectedNavigateColumn(), desc), selectedCaret());
  if (next == null || next === selectedCaret()) return;
  jumpSelected(next);
}

/** Highest (desc) or lowest (asc) Navigate By value in the selected pane. Ties follow `hotLines`. */
function goToExtreme(desc: boolean) {
  const file = selectedNavigateFile();
  if (!file) return;
  const target = hotLines(file, selectedNavigateColumn(), desc)[0];
  if (target == null || target === selectedCaret()) return;
  jumpSelected(target);
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
  navigateOptions(props.model.navigateBy, sourceFile.value?.metricsColumns),
);

const asmNavigateOptions = computed(() =>
  navigateOptions(props.model.navigateBy, props.model.assembly.metricsColumns),
);

/**
 * Link views mirrors a Navigate By pick onto the other pane only when that
 * pane's dropdown lists the same metric. A missing metric leaves the other
 * pane alone; Link views off never mirrors.
 */
function setSourceNavigateBy(id: string) {
  sourceNavigateBy.value = id;
  if (!linkViews.value) return;
  if (asmNavigateOptions.value.some((o) => o.id === id)) asmNavigateBy.value = id;
}

function setAsmNavigateBy(id: string) {
  asmNavigateBy.value = id;
  if (!linkViews.value) return;
  if (sourceNavigateOptions.value.some((o) => o.id === id)) sourceNavigateBy.value = id;
}

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
  void resolveSelected();
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
          @submit="findSearchStep(1)"
        />

        <div
          class="pr-source-view__actions"
          data-testid="source-toolbar-actions"
        >
          <button
            type="button"
            class="pr-source-view__icon-btn pr-icon-tip pr-icon-tip--sentence"
            data-testid="source-find-next"
            :aria-label="t('sourceFindNext', locale)"
            @click="stepSelectedData(1)"
          >
            <PrIcon name="chevron-down" />
          </button>
          <button
            type="button"
            class="pr-source-view__icon-btn pr-icon-tip pr-icon-tip--sentence"
            data-testid="source-find-prev"
            :aria-label="t('sourceFindPrev', locale)"
            @click="stepSelectedData(-1)"
          >
            <PrIcon name="chevron-up" />
          </button>
          <button
            type="button"
            class="pr-source-view__icon-btn pr-icon-tip pr-icon-tip--sentence"
            data-testid="source-nav-highest"
            :aria-label="t('sourceNavHighest', locale)"
            @click="goToExtreme(true)"
          >
            <PrIcon name="to-top" />
          </button>
          <button
            type="button"
            class="pr-source-view__icon-btn pr-icon-tip pr-icon-tip--sentence"
            data-testid="source-sort-asc"
            :aria-label="t('sourceSortAsc', locale)"
            @click="setNavigateSort(false)"
          >
            <PrIcon name="sort-asc" />
          </button>
          <button
            type="button"
            class="pr-source-view__icon-btn pr-icon-tip pr-icon-tip--sentence"
            data-testid="source-sort-desc"
            :aria-label="t('sourceSortDesc', locale)"
            @click="setNavigateSort(true)"
          >
            <PrIcon name="sort-desc" />
          </button>
          <button
            type="button"
            class="pr-source-view__icon-btn pr-icon-tip pr-icon-tip--sentence"
            data-testid="source-nav-lowest"
            :aria-label="t('sourceNavLowest', locale)"
            @click="goToExtreme(false)"
          >
            <PrIcon name="to-bottom" />
          </button>
          <button
            type="button"
            class="pr-source-view__icon-btn pr-icon-tip pr-icon-tip--end"
            data-testid="source-user-guide"
            :aria-label="t('userGuide', locale)"
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
              class="pr-source-view__icon-btn pr-icon-tip"
              data-testid="source-link-source"
              :class="{ 'pr-source-view__icon-btn--on': linkViews }"
              :aria-label="t('sourceLinkSync', locale)"
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
              @update:model-value="setSourceNavigateBy"
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
          :search-query="trimmedSearch"
          :editor-ratio="0.62"
          @update:current-line="onSourceLine"
        />
        <div
          v-if="showResolveOverlay"
          class="pr-source-view__resolve"
          :class="{ 'pr-source-view__resolve--over': dragActive }"
          data-testid="source-resolve-drop"
          role="region"
          :aria-label="t('sourceResolveDropAria', locale)"
          @dragover.prevent
          @dragenter.prevent="dragActive = true"
          @dragleave="onDragLeave"
          @drop.prevent="onDrop"
        >
          <p class="pr-source-view__resolve-hint">
            {{ t('sourceResolveDropHint', locale) }}
          </p>
          <p
            v-if="resolveStatus === 'miss'"
            class="pr-source-view__resolve-miss"
            data-testid="source-resolve-miss"
            role="status"
          >
            {{ t('sourceResolveNotFound', locale) }}
          </p>
          <div class="pr-source-view__resolve-actions">
            <button
              type="button"
              class="pr-source-view__resolve-btn"
              data-testid="source-resolve-browse"
              @click="openFilePicker"
            >
              {{ t('sourceResolveChooseFile', locale) }}
            </button>
            <button
              v-if="resolveSourceFile"
              type="button"
              class="pr-source-view__resolve-btn"
              data-testid="source-resolve-retry"
              :disabled="resolveStatus === 'pending'"
              :aria-busy="resolveStatus === 'pending'"
              @click="resolveSelected(true)"
            >
              {{
                t(resolveStatus === 'pending' ? 'sourceResolveSearching' : 'sourceResolveRetry', locale)
              }}
            </button>
          </div>
          <input
            ref="fileInput"
            class="pr-source-view__resolve-input"
            data-testid="source-resolve-input"
            type="file"
            accept=".asc,.c,.cc,.cpp,.cxx,.h,.hpp,.txt,text/plain"
            :aria-label="t('sourceResolveInputAria', locale)"
            @change="onFilePicked"
          >
        </div>
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
              class="pr-source-view__icon-btn pr-icon-tip"
              data-testid="source-link-asm"
              :class="{ 'pr-source-view__icon-btn--on': linkViews }"
              :aria-label="t('sourceLinkSync', locale)"
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
              @update:model-value="setAsmNavigateBy"
            />
          </div>
        </div>
        <!-- SASS: Address + Assembly are table cells (sketch) — no Sudu editor. -->
        <AsmTablePane
          v-if="model.assembly.lines.length"
          ref="asmPane"
          class="pr-source-view__pane-body"
          :file="model.assembly"
          :current-line="asmLine"
          :correlated-lines="correlatedAsm"
          :match-lines="asmMatchLines"
          :search-query="trimmedSearch"
          @update:current-line="onAsmLine"
        />
        <p
          v-else
          class="pr-source-view__pane-body pr-source-view__asm-empty"
          data-testid="asm-empty"
        >
          {{ t('sourceAsmEmpty', locale) }}
        </p>
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
  gap: 0 10px;
  padding: 5px 10px;
  background: var(--pr-src-bg-deep);
  min-width: 0;
  position: relative;
  z-index: 2;
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

/* One 8px row gap. A zero-height flex break would add row-gap on both sides. */
.pr-source-view--pane-bars-two .pr-source-view__pane-bar-nav {
  margin-top: 8px;
}

/* Closed-control pill size lives on SourcePillSelect (shared with heat view picker). */

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
  position: relative;
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

/* Missing-embed overlay: absolute over the Source pane body, below the pane bar. */
.pr-source-view__resolve {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 16px 16px;
  border: 2px dashed var(--pr-src-border, #333333);
  border-radius: 6px;
  background: var(--pr-src-bg-body, #1a1a1a);
  color: var(--pr-src-label, #b3b3b3);
  font-family: var(--pr-src-ui-font);
  font-size: 12px;
  text-align: center;
}

.pr-source-view__resolve--over {
  border-color: var(--pr-src-accent, #3078f0);
  background: color-mix(in srgb, var(--pr-src-accent, #3078f0) 12%, var(--pr-src-bg-body, #1a1a1a));
}

.pr-source-view__resolve-hint {
  margin: 0;
  max-width: 320px;
  line-height: 1.5;
}

.pr-source-view__resolve-miss {
  margin: 0;
  max-width: 320px;
  line-height: 1.5;
}

.pr-source-view__resolve-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.pr-source-view__resolve-btn {
  height: var(--pr-src-control-h, 28px);
  padding: 0 12px;
  border: 1px solid var(--pr-src-border, #333333);
  border-radius: var(--pr-src-control-radius, 6px);
  background: var(--pr-src-bg-control, #363636);
  color: var(--pr-src-text, #c8c8c8);
  font: inherit;
  cursor: pointer;
}

.pr-source-view__resolve-btn:hover:not(:disabled) {
  border-color: var(--pr-src-accent, #3078f0);
}

.pr-source-view__resolve-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.pr-source-view__resolve-btn:focus-visible {
  outline: 2px solid var(--pr-src-accent, #3078f0);
  outline-offset: 2px;
}

.pr-source-view__resolve-input {
  display: none;
}

.pr-source-view__asm-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 16px;
  color: var(--pr-src-label);
  text-align: center;
}
</style>
