<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch, watchEffect } from 'vue';
import {
  ensurePcSamplingSql,
  fileNeedsSourceResolve,
  loadReportSource,
  modelNeedsSourceResolve,
  resolveMissingSourceFiles,
  sourceResolveRequests,
  workspaceSourceResolver,
  type PickSourceWorkspace,
  type ResolveSourceFile,
  type ResolveSourceFileRequest,
  type SourceWorkspaceFile,
} from '../../adapters';
import {
  resolveSourceFrame,
  type SourceFrameTarget,
} from '../../adapters/sourceCorrelation/resolveSourceFrame';
import {
  applyWindow,
  clearMeasure,
  clearSelection,
  createViewState,
  keyboardPanStepTime,
  measureFocusWindow,
  panBy,
  pinLane,
  pinOverview,
  setMeasureMode,
  setMeasureRange,
  setMultiSelection,
  setSelectedEvent,
  spanFromZoomPercent,
  unpinLane,
  unpinOverview,
  zoomAt,
  zoomPercentFromSpan,
  zoomToFitWindow,
} from '../../domain/viewState';
import {
  DEFAULT_DEPENDENCY_DEPTH,
  normalizeDependencyDepth,
  type AdaptedReport,
  type Baseline,
  type BaselinePick,
  type BaselineReports,
  type BaselineRow,
  type DependencyMode,
  type MeasureRange,
  type MemoryHeatmapUnitId,
  type MemoryTopologyModel,
  type ReportCapability,
  type ReportOperator,
  type ReportViewModel,
  type SourceCorrelationModel,
  type SelectedEvent,
  type SwimEvent,
  type SwimlaneModel,
  type SwimlaneViewState,
  type SwimThread,
  type TimelineTraceKind,
  type TimelineTraceOption,
  type TimeScaleUnit,
  type TimeDisplayMode,
  type ViewFullCsvPayload,
} from '../../domain/types';
import { buildCannbotPayload } from '../../domain/cannbot';
import type {
  CannbotPayload,
  CannbotReportMeta,
  CannbotScope,
  CannbotSessions,
} from '../../domain/cannbot';
import { cooldown } from '../../domain/cooldown';
import { hasDependencies, neighborsOf } from '../../domain/dependencies';
import { resolveTimeUnitFromVisibleRange, resolveClockFreqMHz, nsPerPxForTrack } from '../../domain/formatTime';
import { colorVarForLaneName } from '../../domain/laneColors';
import { COUNTER_LANE_HEIGHT, leafRowCount } from '../../swimlane/layout';
import {
  buildFolderSummaryEvents,
  collectLeafEventsFromModel,
  findEventInModel,
  findThreadById,
  isFolderNode,
} from '../../domain/swimTree';
import { t, archMetricModeLabel } from '../../i18n';
import ContextMenu, { type ContextMenuAction, type ContextMenuContext } from '../ContextMenu/ContextMenu.vue';
import DetailPanel from '../DetailPanel/DetailPanel.vue';
import EventTooltip from '../EventTooltip/EventTooltip.vue';
import MultiSelectSummary from '../MultiSelectSummary/MultiSelectSummary.vue';
import OperatorOverview from '../OperatorOverview/OperatorOverview.vue';
import PerformanceHintsDock from '../PerformanceHintsDock/PerformanceHintsDock.vue';
import {
  ASIDE_WIDTH_DEFAULT,
  DOCK_HEIGHT_COLLAPSED,
  DOCK_HEIGHT_EXPANDED,
  DOCK_HEIGHT_MARQUEE_PREVIEW,
  fitPanelWidths,
  GUTTER_WIDTH_DEFAULT,
} from '../panelResize';
import ReportLayout from '../ReportLayout/ReportLayout.vue';
import ReportToolbar from '../ReportToolbar/ReportToolbar.vue';
import StatsAside from '../StatsAside/StatsAside.vue';
import MemoryTopologyPanel from '../StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.vue';
import MemoryHeatmapPanel from '../StatsAside/MemoryHeatmapPanel/MemoryHeatmapPanel.vue';
import CardMetricSelect from '../TimelineView/SwimlaneView/CardMetricSelect.vue';
import type { GutterGroup, GutterLane } from '../TimelineView/SwimlaneView/LaneGutter/gutterTypes';
import { animateProgress, animateViewWindow, prefersReducedMotion } from '../TimelineView/animateViewWindow';
import { collapseHiddenHeight, type CollapseAnimState } from '../../swimlane/layout';
import TimelineView from '../TimelineView/TimelineView.vue';
import SourceView from '../SourceView/SourceView.vue';
import SourceDiffView from '../SourceDiff/SourceDiffView.vue';
import '../tokens.css';
import {
  availableGutterMetrics,
  averageBarWidthForCard,
  defaultGutterMetric,
  gutterBarsForCard,
  type GutterBarDisplay,
  type GutterMetric,
} from '../../domain/gutterMetrics';
import { resolveEnvironmentBehavior } from '../environments';
import { DEFAULT_USER_GUIDE_URL } from '../userGuide';
import {
  DEFAULT_HTML_EXPORT_TEMPLATE_URL,
  htmlExportFileName,
  stitchHtmlReport,
} from '../../export/stitchHtmlReport';
import {
  ARCH_DIAGRAM_DEFAULT_METRIC_MODE,
  ARCH_DIAGRAM_METRIC_MODES,
  type ArchDiagramMetricMode,
} from '../../adapters/emulateMemoryTopology';

const props = withDefaults(defineProps<{
  title?: string;
  source?: ArrayBuffer | Uint8Array;
  swimlaneModel?: SwimlaneModel;
  reportModel?: ReportViewModel;
  /** cannbot payload 元信息（.rep 文件名 / 绝对路径 / id / 采集时间），宿主提供。 */
  reportMeta?: CannbotReportMeta;
  /** CANNWork 最新会话状态（scope → session），宿主全量推送；缺省即全部 idle。 */
  cannbotSessions?: CannbotSessions;
  /** Accepted for host compatibility; `'light'` currently paints the dark palette. */
  theme?: 'light' | 'dark';
  locale?: string;
  timeDisplayMode?: TimeDisplayMode;
  dependencyMode?: DependencyMode;
  dependencyDepth?: number;
  /** Force swimlane backend for perf A/B (`auto` prefers WebGL2). */
  preferRenderer?: 'auto' | 'webgl' | 'canvas';
  /** Feature gate. Omit and the adapter's own capabilities (derived from the loaded
   *  source) apply; pass an array to override them. Exposed as a data attribute for
   *  CSS/test hooking and read by the aside. */
  capabilities?: ReportCapability[];
  /** End-user guide URL for the toolbar help button. */
  userGuideUrl?: string;
  /**
   * Toolbar Download HTML Report. Opt-in: hosts that serve
   * `htmlExportTemplateUrl` (playground / CI). Default false — MSTT does not
   * ship the shell template. Report-shell (already that bundle) stays false.
   */
  allowHtmlExport?: boolean;
  /** URL of the inlined report-shell template served by the host. */
  htmlExportTemplateUrl?: string;
  /**
   * Demo/embed mode: hide the view tabs and open the Source compare surface
   * directly when a non-current operator exists. Default false keeps the tabs
   * and the 进入源码对比 entry.
   */
  compareOnly?: boolean;
  /** Host environment. Routes environment-dependent actions (title-row 性能分析 →
   *  Problems on `vscode`, internal dock otherwise). Open union so future
   *  environments can be added without touching consumers. */
  environment?: 'vscode' | 'browser' | (string & {});
  /** Same-origin URL for the Sudu TeaVM worker (Source tab). */
  suduWorkerUrl?: string;
  /**
   * Optional host hook: fill Ascend C source when the pack has correlation embeds
   * but no `.asc` text ([issue #175](https://github.com/IdeFrontend/profiling-report/issues/175)).
   * Library never reads the filesystem; return `null` to keep the placeholder.
   */
  resolveSourceFile?: ResolveSourceFile;
  /**
   * Optional host hook: let the operator pick a source workspace (directory)
   * that fills the missing source files. Absent = the workspace buttons hide.
   */
  pickSourceWorkspace?: PickSourceWorkspace;
  /** Host-owned baseline list (对比基线) — the library renders and selects; the
   *  host persists (ARCHITECTURE: host persistence via props/state, no storage in
   *  the library). */
  baselines?: Baseline[];
  /**
   * Comparison rows (对比基线): every row is a baseline + the pack operator it
   * compares from; row 0 is the primary and drives the aside, the other rows
   * surface only in the per-value hover popups. Host-owned like the checked
   * set. Absent/empty = the root defaults one row to the first checked baseline.
   */
  baselineRows?: BaselineRow[];
  /**
   * Optional host hook: opens the file dialog for the baseline picker + press.
   * The library never reads the filesystem; return `null` to cancel. Absent =
   * the baseline control is hidden.
   */
  pickBaselineFile?: () => Promise<BaselinePick | null>;
  /**
   * Adapted packs for the checked baselines the rows reference, supplied by
   * the host: it adapts the baseline bytes itself via the public
   * `loadReportSource` and keys each pack by baseline id. Data-only side
   * channel — never enters the main load path; a row whose pack is missing
   * paints no comparison until the host delivers it.
   */
  baselineReports?: BaselineReports;
  /**
   * Recent performance reports for the picker's checkbox view — what the host
   * currently lists as its own reports (MSTT: the Performance results tree;
   * the bundled web hosts: the shared demo list). Host-owned: the checked set
   * IS the `baselines` list and every toggle comes back as `update:baselines`.
   */
  recentBaselines?: Baseline[];
}>(), {
  title: undefined,
  source: undefined,
  swimlaneModel: undefined,
  reportModel: undefined,
  reportMeta: undefined,
  cannbotSessions: undefined,
  theme: undefined,
  locale: undefined,
  timeDisplayMode: undefined,
  dependencyMode: 'all',
  dependencyDepth: DEFAULT_DEPENDENCY_DEPTH,
  userGuideUrl: DEFAULT_USER_GUIDE_URL,
  allowHtmlExport: false,
  htmlExportTemplateUrl: DEFAULT_HTML_EXPORT_TEMPLATE_URL,
  compareOnly: false,
  preferRenderer: undefined,
  capabilities: undefined,
  environment: undefined,
  suduWorkerUrl: '/sudu/worker.js',
  resolveSourceFile: undefined,
  pickSourceWorkspace: undefined,
  baselines: undefined,
  baselineRows: undefined,
  pickBaselineFile: undefined,
  baselineReports: undefined,
  recentBaselines: undefined,
});

const emit = defineEmits<{
  ready: [];
  select: [event: SelectedEvent | null];
  error: [error: { message: string; cause?: unknown }];
  'view-full-csv': [payload: ViewFullCsvPayload];
  'open-hardware-details': [];
  'open-pipe-details': [];
  'cannbot-request': [payload: CannbotPayload];
  'open-cannbot-stop': [scope: CannbotScope];
  'cannbot-reference': [scope: CannbotScope];
  'cannbot-view': [scope: CannbotScope];
  'perform-optimization': [payload: { report_path: string; op_name: string }];
  'open-cannwork': [];
  'open-user-guide': [url: string];
  'open-performance-hints-in-problems': [];
  'export-html': [{ fileName: string }];
  'update:baselines': [baselines: Baseline[]];
  'update:baselineRows': [rows: BaselineRow[]];
}>();

/** Shallow: avoid deep-proxying every swim event (collapse/expand was ~2s on op2). */
const internalSwim = shallowRef<SwimlaneModel | null>(null);
const internalReport = ref<ReportViewModel | null>(null);
const internalCapabilities = ref<ReportCapability[] | null>(null);
/**
 * Host `resolveSourceFile` may fill missing Ascend C text after first paint.
 * Overlay on top of `reportModel` / `internalReport` so Vue refreshes SourceView.
 */
const resolvedSourceCorrelation = ref<SourceCorrelationModel | null>(null);
/** Source text the host filled, keyed by file id — carried into the HTML export. */
const resolvedSourceTexts = ref<Record<string, string>>({});
/** Baseline-side fill overlays, keyed `${baselineId}:${operatorId}`. */
const baselineSourceCorrelation = ref<Record<string, SourceCorrelationModel>>({});
/**
 * Bumps on load / operator / host `reportModel` swap — not when the resolve
 * overlay fills text. SourceView uses this to reset search across operators
 * while keeping caret/search across a same-shaped resolve fill.
 */
const sourceSession = ref(0);

/** Last open-report workspace resolver, replayed when the operator changes. */
let reportWorkspaceResolve: ResolveSourceFile | null = null;
let reportWorkspaceFiles: SourceWorkspaceFile[] = [];
/** Last baseline workspace resolver, replayed when the compare operator changes. */
let baselineWorkspaceResolve: ResolveSourceFile | null = null;
let baselineWorkspaceFiles: SourceWorkspaceFile[] = [];

function chainResolve(
  primary: ResolveSourceFile | null,
  fallback: ResolveSourceFile | undefined,
): ResolveSourceFile | undefined {
  if (!primary) return fallback;
  if (!fallback) return primary;
  return async (request) => (await primary(request)) ?? fallback(request);
}

function bumpSourceSession() {
  sourceSession.value += 1;
  resolvedSourceCorrelation.value = null;
  // Export must carry the current report's text, not a previous load's picks.
  resolvedSourceTexts.value = {};
  reportWorkspaceResolve = null;
  reportWorkspaceFiles = [];
}
const loadError = ref<string | null>(null);
const viewState = ref<SwimlaneViewState>(createViewState(null));
const hovered = ref<SwimEvent | null>(null);
const selected = ref<SelectedEvent | null>(null);
/** Raw model event behind `selected` — the dependency walk needs its EventRefs. */
const selectedEvent = ref<SwimEvent | null>(null);
/** Marquee capture; mutually exclusive with `selected` (only one dock mounts). */
const multiSelected = shallowRef<SwimEvent[]>([]);
/**
 * Δt span shown on the axis for the marquee: the live drag extent while dragging.
 * Cleared on commit (the axis measure control disappears when the drag ends).
 */
const multiSelectSpan = ref<MeasureRange | null>(null);
/**
 * True while a live marquee (>4px) gesture is active (any post-gate preview,
 * including empty coverage). Gates Escape so preview `multiSelected` is not
 * treated as a committed multi-select. Footer mount: already-open docks stay up
 * (empty → nothing-selected message); closed→drag mounts only once coverage is
 * non-empty. Host `select` / viewState commit wait for pointerup; Escape restores
 * the pre-drag dock.
 */
const marqueeLive = ref(false);
/** Header count for ids-only live ≥2 preview (no 125k SwimEvent[] assign). */
const livePreviewCount = ref(0);
/** Live union ids of the in-flight marquee; resolved to events at settle / commit. */
const livePreviewIds = shallowRef<string[]>([]);
/** True while a live marquee is still growing (< MULTI_SELECT_SETTLE_MS since the last change). */
const multiSelectDimmed = ref(false);
type DockSnap = {
  selected: SelectedEvent | null;
  selectedEvent: SwimEvent | null;
  multiSelected: SwimEvent[];
  /** Dock was already showing content when the gesture started. */
  wasOpen: boolean;
  dockHeight: number;
  /**
   * Swimlane wrap height before the preview dock mounted (closed layout).
   * Frozen for the gesture so mid-enter / RO feedback cannot overshoot to collapsed.
   */
  wrapClosedHeight?: number;
  /**
   * `scrollY` at gesture start — frozen for slack preview math so edge autoscroll
   * does not grow the dock and re-suspend the edge band.
   */
  scrollY?: number;
};
/** Snapshot of dock UI taken on the first live preview of a gesture; discarded on commit. */
let dockSnap: DockSnap | null = null;
/** Reactive: live marquee opened the dock from closed (drives preview shell height). */
const marqueeFromClosed = ref(false);
/** Recompute the multi-select table this long after the last live selection change. */
const MULTI_SELECT_SETTLE_MS = 200;
let multiSelectDimTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * Applied preview height while marquee is live from a closed dock.
 * Fed back into slack math as `currentPreviewHeight` so wrap shrink stays consistent.
 */
const marqueePreviewHeight = ref(DOCK_HEIGHT_MARQUEE_PREVIEW);
const tooltipStyle = ref({ left: '0px', top: '0px' });
const localTimeDisplayMode = ref<TimeDisplayMode>(props.timeDisplayMode ?? 'time');
const localDependencyMode = ref<DependencyMode>(props.dependencyMode);
const localDependencyDepth = ref(normalizeDependencyDepth(props.dependencyDepth));
const cursor = ref<{ time: number; xRatio: number; snapped?: boolean } | null>(null);
const timelineRef = ref<{
  gutterRoot: HTMLElement | null;
  trackWidth?: number;
  wrapLayoutEpoch?: number;
  swimlaneWrapHeight?: number;
  computeMarqueePreviewDockHeight?: (
    currentPreviewPx: number,
    targetPx: number,
    wrapClosedHeight?: number,
    scrollY?: number,
  ) => number;
} | null>(null);
const layoutRef = ref<{ rootEl: HTMLElement | null } | null>(null);
/** The mounted toolbar (fallback or main) — its exposed `closeBaselinesPicker`. */
const toolbarRef = ref<InstanceType<typeof ReportToolbar> | null>(null);
/** The mounted aside — its live topology models keep the 全屏 overlay in step
 *  with a Metric-mode switch (the aside resolves the operator pick + scope). */
const asideRef = ref<InstanceType<typeof StatsAside> | null>(null);
/** Session-only panel sizes (not persisted). User drag updates preferred; fit clamps actual. */
const preferredGutterWidth = ref(GUTTER_WIDTH_DEFAULT);
const preferredAsideWidth = ref(ASIDE_WIDTH_DEFAULT);
const gutterWidth = ref(GUTTER_WIDTH_DEFAULT);
const asideWidth = ref(ASIDE_WIDTH_DEFAULT);
/** Shared dock height for every footer branch — DetailPanel, multi-select summary and the
 *  hints pane. Whichever pane is mounted carries the expander, so one value survives
 *  branch swaps and reopens. */
const dockHeight = ref(DOCK_HEIGHT_COLLAPSED);
/**
 * Shell height while marquee is live: slack-based preview when opening from closed,
 * otherwise the session dock height (already budgeted into the timeline).
 */
const dockDisplayHeight = computed(() => {
  if (marqueeLive.value && marqueeFromClosed.value) {
    return marqueePreviewHeight.value;
  }
  return dockHeight.value;
});
/** Session expand intent — drives the chevron even when live preview height is slack-capped. */
const dockSessionExpanded = computed(() => dockHeight.value >= DOCK_HEIGHT_EXPANDED);
/** M4 performance-hints dock: opened from the StatsAside 性能分析 trigger, closed via its own close button. */
const hintsDockOpen = ref(false);

const topologyFullscreen = ref(false);
const fullscreenTopology = ref<MemoryTopologyModel | null>(null);
const fullscreenBackRef = ref<HTMLButtonElement | null>(null);
/**
 * §11.2.3.2 heat panel selection — owned here because the diagram and the tab strip are two
 * views of one selection (the diagram emits the unit, the tab strip reads it back).
 */
const selectedMemoryUnit = ref<MemoryHeatmapUnitId | null>(null);
/** Shared with StatsAside (PR-ROOT-015): ArchDiagram Metric mode survives into topology 全屏. */
const archMetricMode = ref<ArchDiagramMetricMode>(ARCH_DIAGRAM_DEFAULT_METRIC_MODE);
const archMetricModes = ARCH_DIAGRAM_METRIC_MODES;
let layoutResizeObserver: ResizeObserver | null = null;
/** Process / group ids with child lanes collapsed in gutter + canvas. */
const collapsedGroupIds = ref<string[]>([]);
const contextMenuContext = ref<ContextMenuContext | null>(null);
/** Lane currently under the canvas/gutter pointer — target for the global Shift+P pin shortcut. */
const hoveredLaneId = ref<string | null>(null);
/** In-flight collapse/expand tween; null when settled. */
const collapseAnim = ref<CollapseAnimState | null>(null);
/** Group id forced expanded while its tween runs (kept separate from `visible` so the
 *  display model does not re-derive every frame). */
const animGroupId = ref<string | null>(null);
/** True while the in-flight tween is collapsing (1→0); false when expanding (0→1). */
const animCollapsing = ref(false);
/** Settled `collapsedGroupIds` the in-flight tween will commit on `onDone`. */
let pendingCollapseTarget: string[] | null = null;
let cancelCollapseAnim: () => void = () => {};
/** Multi-operator packs: selector options + adapted reports (empty for single-op). */
const operators = ref<ReportOperator[]>([]);
/** Shallow: avoid deep-proxying every swim event in every operator pack. */
const operatorReports = shallowRef<Record<string, AdaptedReport>>({});
const selectedOperatorId = ref<string | null>(null);
/** §11.14 multi-timeline catalog for the active leaf (empty when only one / none). */
const timelineTraces = ref<TimelineTraceOption[]>([]);
const timelineTraceModels = shallowRef<Record<string, SwimlaneModel>>({});
const selectedTimelineTraceId = ref<TimelineTraceKind | null>(null);
/** Per-Card gutter metric selection (session-only; reset on report swap). */
const gutterMetricByCard = ref<Record<string, GutterMetric>>({});

function applyTimelineTraceFields(adapted: AdaptedReport) {
  timelineTraces.value = adapted.timelineTraces ?? [];
  timelineTraceModels.value = adapted.timelineTraceModels ?? {};
  selectedTimelineTraceId.value = adapted.selectedTimelineTraceId ?? null;
}

/** Raw swim model for all consumers — unwrap host deep-reactive props so deps/gutter/collapse skip Proxies. */
const swim = computed(() => toRaw(props.swimlaneModel ?? internalSwim.value));
/** Pin row is only offered for a resolvable leaf lane; a summary-bar target carries its
 *  folder id, which the pin action rejects. */
const contextMenuCanPin = computed(() => {
  const ctx = contextMenuContext.value;
  if (!ctx) return false;
  const lane = swim.value ? findThreadById(swim.value, ctx.laneId) : null;
  return !!lane && !isFolderNode(lane);
});
const report = computed(() => {
  const base = props.reportModel ?? internalReport.value;
  if (!base) return null;
  const filled = resolvedSourceCorrelation.value;
  if (!filled || filled === base.sourceCorrelation) return base;
  return { ...base, sourceCorrelation: filled };
});
/** Host-managed mode has no adapter to ask, so adapter flags must not survive the switch. */
const hostManaged = computed(() => props.swimlaneModel != null || props.reportModel != null);
/** Host prop wins; otherwise the ones the adapter derived from the loaded source. */
const caps = computed<ReportCapability[]>(() => {
  if (props.capabilities) return props.capabilities;
  if (hostManaged.value) return [];
  return internalCapabilities.value ?? [];
});
const isArchDiagram = computed(() => caps.value.includes('archDiagram'));

/**
 * §11.2.3.2 heat surface. Its own capability, so it mounts beside the topology independent of
 * `archDiagram` / `memoryDiagram` (plan § Architecture): the panel needs both the capability and
 * at least one unit the adapter could fill.
 */
const memoryHeatmap = computed(() => report.value?.memoryHeatmap ?? null);
const hasMemoryHeatmap = computed(
  () => caps.value.includes('memoryHeatmap') && (memoryHeatmap.value?.units.length ?? 0) > 0,
);
/** Heat mounts beside any topology overlay — including `archDiagram` (PR-ROOT-027) — when the
 * report also carries a drawable `memoryHeatmap`. No topology → no heat column. */
const showHeatPanel = computed(() => hasMemoryHeatmap.value && fullscreenTopology.value != null);
/** 默认选中一个 memory: the first unit the producer could fill, until the diagram names one. */
const activeMemoryUnit = computed(
  () => selectedMemoryUnit.value ?? memoryHeatmap.value?.units[0]?.id ?? null,
);

function onSelectMemoryUnit(unit: MemoryHeatmapUnitId) {
  selectedMemoryUnit.value = unit;
}

watch(isArchDiagram, (on) => {
  if (!on) archMetricMode.value = ARCH_DIAGRAM_DEFAULT_METRIC_MODE;
});

/** Keep the 全屏 diagram on the same Metric mode as the stacked aside (PR-ROOT-015 / PR-ROOT-019).
 *  Read the aside's LIVE models: it is the only place that resolves the block scope AND row 0's
 *  Operator pick, so re-deriving the baseline from the pack's CSV bytes would repaint the CURRENT
 *  operator against the pack's DEFAULT operator (review 2026-11-25). Assigning `undefined` clears
 *  plates (DATA-30) — never keep a stale `*_gbs` snapshot. */
watch(
  archMetricMode,
  () => {
    if (!topologyFullscreen.value) return;
    const aside = asideRef.value;
    if (!aside) return;
    // `post`: the aside must have received the new `archMetricMode` prop
    // before its computeds are read (a pre-flush watcher still sees the old one).
    fullscreenTopology.value = aside.topologyModel ?? null;
    fullscreenBaselineTopology.value = aside.topologyBaseline ?? null;
    fullscreenBaselineRows.value = aside.topologyBaselineRows ?? [];
  },
  { flush: 'post' },
);

/** Environment-routed behavior for host-dependent actions (extensible map in `environments.ts`). */
const environmentBehavior = computed(() => resolveEnvironmentBehavior(props.environment));
const viewportTimeScaleUnit = computed<TimeScaleUnit>(() =>
  resolveTimeUnitFromVisibleRange(viewState.value.endTime - viewState.value.startTime),
);
/** Same density as TimelineView playhead / measure labels — tooltip & detail start/end. */
const nsPerPx = computed((): number | undefined => {
  const w = timelineRef.value?.trackWidth ?? 0;
  // Omit until the track has measured — avoids a pre-mount 1000px digit jump.
  if (!(w > 0)) return undefined;
  return nsPerPxForTrack(viewState.value.endTime - viewState.value.startTime, w);
});
const clockFreqMHz = computed(() => resolveClockFreqMHz(report.value?.summary));

/**
 * 统计分析 from Sampling.json — only with the pipe-trace timeline (or legacy
 * classic `trace.json` when the §11.14 catalog is absent). Hide when the
 * catalog selector is on communication / warpOccupy ([DATA-56]).
 */
const showOverview = computed(() => {
  if ((report.value?.overviewSeries?.length ?? 0) === 0) return false;
  const selected = selectedTimelineTraceId.value;
  return selected == null || selected === 'pipeTrace';
});
/** M4 performance-hints rows (adapter join); empty when absent (DATA-30). */
const performanceHints = computed(() => report.value?.performanceHints ?? []);
const hasPerformanceHints = computed(
  () => caps.value.includes('performanceHints') && performanceHints.value.length > 0,
);
/**
 * Mirrors the dock content chain's hints branch exactly: the pane renders only while the
 * dock is open, the capability carries rows, and no multi/single selection owns the slot.
 * Drives that branch (and so the pane mount) only — the pane reuses the standard
 * event-detail dock chrome, there is no dedicated hints shell, and it is handed the
 * shared `dockHeight` so its top-edge expander resizes the same dock as DetailPanel.
 */
const hintsDockShown = computed(
  () =>
    hintsDockOpen.value &&
    hasPerformanceHints.value &&
    multiSelected.value.length === 0 &&
    selected.value == null,
);
/** Toolbar toggle + initial asideVisible share this gate (includes CSV-only reports). */
const asideAvailable = computed(() => reportHasAsideContent(report.value, caps.value));
const showAside = computed(() => viewState.value.asideVisible && asideAvailable.value);
const showTimeline = computed(() => loadError.value == null && swim.value != null);
/** UI-37: Source tab only for a real (non-mock) correlation model. */
const sourceTabEnabled = computed(
  () =>
    caps.value.includes('sourceTab') &&
    report.value?.sourceCorrelation != null &&
    report.value.sourceCorrelation.mock !== true,
);
/** 概览 lists operator rows; chrome-trace / emulate models carry none. */
const overviewTabEnabled = computed(
  () => loadError.value == null && (report.value?.operatorRows?.length ?? 0) > 0,
);
const activeTab = ref<'overview' | 'timeline' | 'source'>('timeline');
const showOverviewTab = computed(() => activeTab.value === 'overview');
/** Source-compare mode: left = open report, right = the selected saved baseline. */
const compareMode = ref(false);
/** Compare-scoped picks; they never rewrite the host's baselineRows. */
const compareBaselineId = ref<string | null>(null);
/** '' resolves the selected baseline's default operator. */
const compareOperatorId = ref('');
/** True until the user picks a report; pack arrivals keep re-seeding the default. */
const compareAutoSeeded = ref(false);
const sourceDiffRef = ref<InstanceType<typeof SourceDiffView> | null>(null);
/** The saved baseline row's operator, resolved like the aside's popups. */
function compareOperatorIdOf(row: BaselineRow, pack: AdaptedReport | null): string | null {
  const declared = props.baselines?.find((b) => b.id === row.baselineId)?.operators;
  const keys = Object.keys(pack?.operatorReports ?? {});
  const options = declared?.length
    ? declared.map((o) => o.id)
    : keys.length > 0
      ? keys
      : pack?.reportModel.summary.opName
        ? [pack.reportModel.summary.opName]
        : [];
  if (options.length === 0) return null;
  if (row.operatorId && options.includes(row.operatorId)) return row.operatorId;
  const opName = report.value?.summary.opName;
  if (opName != null && options.includes(opName)) return opName;
  return options[0]!;
}
function compareCorrelationOf(row: BaselineRow, pack: AdaptedReport): SourceCorrelationModel | null {
  const operatorId = compareOperatorIdOf(row, pack);
  const operator = operatorId ? pack.operatorReports?.[operatorId] : undefined;
  // An operator entry with no source is an empty pane. The root model is the
  // first operator, so falling through would show that operator under this name.
  if (operator) return operator.reportModel.sourceCorrelation ?? null;
  return pack.reportModel.sourceCorrelation ?? null;
}
function compareSourceKeyOf(row: BaselineRow, pack: AdaptedReport): string {
  return `${row.baselineId}:${compareOperatorIdOf(row, pack) ?? ''}`;
}
/** The host row for a baseline, or a synthetic row for checkbox-only flows. */
function compareRowFor(baselineId: string): BaselineRow {
  const host = (props.baselineRows ?? []).find((r) => r.baselineId === baselineId);
  return {
    id: host?.id ?? 'brow-' + baselineId,
    baselineId,
    operatorId: compareOperatorId.value || host?.operatorId || '',
  };
}
/** Default pair: the first checked baseline with source, else the first checked baseline. */
function defaultCompareBaselineId(): string | null {
  const items = props.baselines ?? [];
  for (const baseline of items) {
    const pack = props.baselineReports?.[baseline.id]?.report;
    if (pack && compareCorrelationOf(compareRowFor(baseline.id), pack) != null) {
      return baseline.id;
    }
  }
  return items[0]?.id ?? null;
}
const compareRow = computed<BaselineRow | null>(() => {
  const baselineId = compareBaselineId.value;
  if (baselineId == null) return null;
  if (!(props.baselines ?? []).some((b) => b.id === baselineId)) return null;
  return compareRowFor(baselineId);
});
const compareBaselineModel = computed<SourceCorrelationModel | null>(() => {
  const row = compareRow.value;
  const pack = row ? props.baselineReports?.[row.baselineId]?.report : null;
  if (!row || !pack) return null;
  return (
    baselineSourceCorrelation.value[compareSourceKeyOf(row, pack)] ??
    compareCorrelationOf(row, pack)
  );
});
/** Compare opens with any checked baseline; a baseline without source gets an empty pane. */
const compareAvailable = computed(
  () => report.value?.sourceCorrelation != null && (props.baselines?.length ?? 0) > 0,
);
/** Operators of the selected baseline, labeled by their declared label or id. */
const compareOperators = computed<ReportOperator[]>(() => {
  const baseline = props.baselines?.find((b) => b.id === compareBaselineId.value);
  const pack = compareBaselineId.value
    ? props.baselineReports?.[compareBaselineId.value]?.report
    : null;
  if (baseline?.operators?.length) return baseline.operators;
  const keys = Object.keys(pack?.operatorReports ?? {});
  if (keys.length > 0) return keys.map((id) => ({ id, label: id }));
  const opName = pack?.reportModel.summary.opName;
  return opName ? [{ id: opName, label: opName }] : [];
});
const compareSelectedOperatorId = computed<string | null>(() => {
  const row = compareRow.value;
  const pack = row ? props.baselineReports?.[row.baselineId]?.report : null;
  return row ? compareOperatorIdOf(row, pack ?? null) : null;
});
/** A workspace pick can fill the open report's placeholder files. */
const reportSourceNeedsResolve = computed(() =>
  modelNeedsSourceResolve(report.value?.sourceCorrelation),
);
/** A workspace pick can fill the baseline pane's placeholder files. */
const baselineSourceNeedsResolve = computed(() =>
  modelNeedsSourceResolve(compareBaselineModel.value),
);
/** The right workspace button shows only with a host hook: enabled for placeholders,
 * disabled inside the empty state, hidden for packed text. */
const baselineWorkspaceAvailable = computed(
  () =>
    props.pickSourceWorkspace != null &&
    (compareBaselineModel.value == null ||
      compareBaselineModel.value.files.length === 0 ||
      baselineSourceNeedsResolve.value),
);
// A host swap replaces every baseline pack; overlays key on the old packs.
watch(
  () => props.baselineReports,
  (reports, prev) => {
    const ids = new Set([...Object.keys(reports ?? {}), ...Object.keys(prev ?? {})]);
    const changedIds = [...ids].filter((id) => reports?.[id]?.report !== prev?.[id]?.report);
    if (changedIds.length === 0) return;
    const comparedId = compareBaselineId.value;
    if (comparedId != null && changedIds.includes(comparedId)) {
      baselineResolveGen += 1;
      baselineWorkspaceResolve = null;
      baselineWorkspaceFiles = [];
    }
    const kept: Record<string, SourceCorrelationModel> = {};
    for (const [key, model] of Object.entries(baselineSourceCorrelation.value)) {
      const id = key.slice(0, key.indexOf(':'));
      if (!changedIds.includes(id)) kept[key] = model;
    }
    baselineSourceCorrelation.value = kept;
    if (compareAutoSeeded.value) {
      compareBaselineId.value = defaultCompareBaselineId();
      compareOperatorId.value = '';
    }
  },
);

const compareSearchQuery = ref('');

function exitCompareMode() {
  compareMode.value = false;
  compareBaselineId.value = null;
  compareOperatorId.value = '';
  compareAutoSeeded.value = false;
  compareSearchQuery.value = '';
}

/** Explicit exit (toolbar button, diff Escape) lands on the Source tab. */
function onCompareExit() {
  exitCompareMode();
  if (sourceTabEnabled.value) activeTab.value = 'source';
}

function enterCompareMode() {
  if (!compareAvailable.value) return;
  if (compareBaselineId.value == null) {
    compareOperatorId.value = '';
    compareBaselineId.value = defaultCompareBaselineId();
    compareAutoSeeded.value = true;
  }
  compareMode.value = true;
}

/** Picking a report resets the operator to that baseline's default. */
function onCompareBaselineChange(id: string) {
  if (id === compareBaselineId.value) return;
  if (!(props.baselines ?? []).some((b) => b.id === id)) return;
  compareBaselineId.value = id;
  compareOperatorId.value = '';
  compareAutoSeeded.value = false;
  replayBaselineFill();
}

function replayBaselineFill(): void {
  if (!baselineWorkspaceResolve) return;
  const resolve = baselineWorkspaceResolve;
  void nextTick(() => {
    const row = compareRow.value;
    const pack = row ? props.baselineReports?.[row.baselineId]?.report : null;
    if (!row || !pack) return;
    const key = compareSourceKeyOf(row, pack);
    const model = baselineSourceCorrelation.value[key] ?? compareCorrelationOf(row, pack);
    if (!model) return;
    const resolveGen = ++baselineResolveGen;
    void fillMissingSourceFiles(model, resolve).then((next) => {
      if (resolveGen !== baselineResolveGen || !next) return;
      baselineSourceCorrelation.value = {
        ...baselineSourceCorrelation.value,
        [key]: next,
      };
    });
  });
}

function onCompareOperatorChange(id: string) {
  compareOperatorId.value = id;
  compareAutoSeeded.value = false;
  replayBaselineFill();
}

// Removing the selected checked baseline moves the compare pair to the next one.
watch(
  () => props.baselines,
  (list, prev) => {
    const items = list ?? [];
    if (items.length === 0) {
      compareBaselineId.value = null;
      compareOperatorId.value = '';
      compareAutoSeeded.value = false;
      exitCompareMode();
      return;
    }
    const selected = compareBaselineId.value;
    if (selected == null || items.some((b) => b.id === selected)) return;
    const removedIndex = (prev ?? []).findIndex((b) => b.id === selected);
    const next = items[Math.min(Math.max(removedIndex, 0), items.length - 1)]!;
    compareBaselineId.value = next.id;
    compareOperatorId.value = '';
    compareAutoSeeded.value = true;
  },
);

// A new report invalidates the comparison pair and its auto-seed; re-opening defaults again.
watch([() => props.reportModel], () => {
  compareBaselineId.value = null;
  compareOperatorId.value = '';
  compareAutoSeeded.value = false;
  exitCompareMode();
});

watch(compareAvailable, (ok) => {
  if (!ok) exitCompareMode();
});

/** compareOnly starts on Source and never shows the tab strip; no baseline → single pane. */
watch(
  [() => props.reportModel, internalReport, selectedOperatorId, sourceTabEnabled, compareAvailable],
  () => {
    if (!props.compareOnly || !sourceTabEnabled.value) return;
    activeTab.value = 'source';
    // Only seed the pair. Re-entering on every operator switch would overwrite a
    // baseline the user picked; the selectedOperatorId watcher handles collisions.
    if (compareAvailable.value && !compareMode.value) enterCompareMode();
  },
  { immediate: true, flush: 'post' },
);
/** Caret the Source tab applies after a Parameter frame click. */
const sourceFocus = ref<SourceFrameTarget | null>(null);
const showSource = computed(
  () =>
    activeTab.value === 'source' &&
    sourceTabEnabled.value &&
    report.value?.sourceCorrelation != null,
);
/** Timeline canvas mounts only while the Timeline tab is active (releases WebGL). */
const showTimelineSurface = computed(
  () => showTimeline.value && !showSource.value && !showOverviewTab.value,
);

watch(sourceTabEnabled, (ok) => {
  if (ok) return;
  exitCompareMode();
  if (activeTab.value === 'source') activeTab.value = 'timeline';
});

watch(overviewTabEnabled, (ok) => {
  if (!ok && activeTab.value === 'overview') activeTab.value = 'timeline';
});

function onActiveTab(tab: 'overview' | 'timeline' | 'source') {
  if (tab === 'source' && !sourceTabEnabled.value) return;
  if (tab === 'overview' && !overviewTabEnabled.value) return;
  if (tab !== 'source') exitCompareMode();
  activeTab.value = tab;
}

function onOpenSource(frame: string | Record<string, unknown>) {
  const files = report.value?.sourceCorrelation?.files;
  if (!sourceTabEnabled.value || !files) return;
  const hit = resolveSourceFrame(frame, files);
  if (!hit) return;
  sourceFocus.value = hit;
  activeTab.value = 'source';
}

const pipeUtilRows = computed(() => {
  const table = report.value?.computeTables.find((t) => t.fileName === 'PipeUtilization.csv');
  return table?.rows ?? [];
});

function lanesWithBars(
  threads: SwimThread[],
  bars: Map<string, GutterBarDisplay>,
): GutterLane[] {
  return threads.map((t) => {
    const lane: GutterLane = {
      id: t.id,
      name: t.name,
      color: colorVarForLaneName(t.name),
      categoryKey: t.categoryKey,
    };
    const bar = bars.get(t.id);
    if (bar) lane.bar = bar;
    if (t.children !== undefined) {
      lane.children = lanesWithBars(t.children, bars);
      if ((t.counterSeries?.length ?? 0) > 0) {
        lane.counterFolder = true;
        if (t.counterSeries![0]?.colorHex) lane.color = t.counterSeries![0]!.colorHex;
      }
    } else if (t.counter) {
      lane.counter = true;
      lane.height = COUNTER_LANE_HEIGHT;
      lane.rowCount = 1;
      if (t.counter.colorHex) lane.color = t.counter.colorHex;
    } else {
      lane.rowCount = leafRowCount(t);
    }
    return lane;
  });
}

function initGutterMetrics(model: SwimlaneModel | null): void {
  if (!model) {
    gutterMetricByCard.value = {};
    return;
  }
  const rows = pipeUtilRows.value;
  const next: Record<string, GutterMetric> = {};
  for (const p of model.processes) {
    const avail = availableGutterMetrics(model, rows, p.id);
    let metric = gutterMetricByCard.value[p.id];
    if (metric == null || !avail.includes(metric)) {
      const fallback = defaultGutterMetric(avail);
      if (fallback == null) continue;
      metric = fallback;
    }
    next[p.id] = metric;
  }
  gutterMetricByCard.value = next;
}

const gutterMetricOptionsByCard = computed(() => {
  const m = swim.value;
  if (!m) return {} as Record<string, GutterMetric[]>;
  const rows = pipeUtilRows.value;
  const out: Record<string, GutterMetric[]> = {};
  for (const p of m.processes) {
    out[p.id] = availableGutterMetrics(m, rows, p.id);
  }
  return out;
});

const laneGroups = computed((): GutterGroup[] => {
  const m = swim.value;
  if (!m) return [];
  const rows = pipeUtilRows.value;
  return m.processes.map((p) => {
    const options = gutterMetricOptionsByCard.value[p.id] ?? [];
    const stored = gutterMetricByCard.value[p.id];
    const metric =
      stored != null && options.includes(stored) ? stored : defaultGutterMetric(options);
    const bars = metric != null ? gutterBarsForCard(m, rows, metric, p.id) : new Map();
    return {
      id: p.id,
      name: p.name,
      utilMidlinePercent: metric != null ? averageBarWidthForCard(bars, metric) : undefined,
      lanes: lanesWithBars(p.threads, bars),
    };
  });
});

/** Collapse set with the in-flight group forced EXPANDED so the tween can interpolate.
 *  Depends only on `animGroupId` (stable across frames), not `collapseAnim.visible`. */
const visualCollapsedIds = computed(() =>
  animGroupId.value
    ? collapsedGroupIds.value.filter((id) => id !== animGroupId.value)
    : collapsedGroupIds.value,
);

/** Unfiltered swim identity — collapse is paint-only on the canvas (PR-UI-013). */
const displaySwim = computed((): SwimlaneModel | null => swim.value);

/** Recompute preview height from wrap slack below lane content while live from closed. */
watchEffect(() => {
  if (!marqueeLive.value || !marqueeFromClosed.value) return;
  // Reactive deps so collapse / model refresh the height. Do **not** subscribe to
  // live scrollY — slack is frozen at gesture-start scroll (dockSnap.scrollY) so
  // edge autoscroll cannot grow the preview and re-suspend the edge band.
  void collapseAnim.value;
  void displaySwim.value;
  const wrapClosed = dockSnap?.wrapClosedHeight;
  const frozenScrollY = dockSnap?.scrollY;
  const next =
    timelineRef.value?.computeMarqueePreviewDockHeight?.(
      marqueePreviewHeight.value,
      dockHeight.value,
      wrapClosed,
      frozenScrollY,
    ) ?? DOCK_HEIGHT_MARQUEE_PREVIEW;
  if (next !== marqueePreviewHeight.value) marqueePreviewHeight.value = next;
});

const bounds = computed(() => {
  const m = swim.value;
  if (!m) return { minTime: 0, maxTime: 1 };
  return {
    minTime: m.minTime,
    maxTime: m.maxTime > m.minTime ? m.maxTime : m.minTime + 1,
  };
});
const contextMenuCanReset = computed(() => {
  const { minTime, maxTime } = bounds.value;
  return viewState.value.startTime !== minTime || viewState.value.endTime !== maxTime;
});

/** Log zoom: 0 = fit, 100 = min window (same floor as Ctrl+wheel / zoomAt). */
const zoomPercent = computed(() =>
  zoomPercentFromSpan(
    viewState.value.endTime - viewState.value.startTime,
    bounds.value.maxTime - bounds.value.minTime,
  ),
);

let cancelViewWindowAnim: () => void = () => {};

function stopViewWindowAnim() {
  cancelViewWindowAnim();
  cancelViewWindowAnim = () => {};
}

function animateToWindow(window: { startTime: number; endTime: number; scrollY: number }) {
  stopViewWindowAnim();
  const from = {
    startTime: viewState.value.startTime,
    endTime: viewState.value.endTime,
  };
  const scrollY = window.scrollY;
  cancelViewWindowAnim = animateViewWindow({
    from,
    to: { startTime: window.startTime, endTime: window.endTime },
    onUpdate: (w) => {
      viewState.value = applyWindow(viewState.value, {
        ...w,
        scrollY,
      });
    },
    onDone: () => {
      cancelViewWindowAnim = () => {};
    },
  });
}

function onFocusMeasure(range: MeasureRange) {
  const target = measureFocusWindow(range, bounds.value, viewState.value.scrollY);
  animateToWindow(target);
}

function resetPanelWidthsToDefaults(): void {
  preferredGutterWidth.value = GUTTER_WIDTH_DEFAULT;
  preferredAsideWidth.value = ASIDE_WIDTH_DEFAULT;
  gutterWidth.value = GUTTER_WIDTH_DEFAULT;
  asideWidth.value = ASIDE_WIDTH_DEFAULT;
}

function resetViewFromModel(
  model: SwimlaneModel | null,
  showAsidePanel: boolean,
  opts?: { preservePanelWidths?: boolean },
): void {
  stopViewWindowAnim();
  cancelCollapseAnim();
  collapseAnim.value = null;
  animGroupId.value = null;
  pendingCollapseTarget = null;
  const next = createViewState(model);
  next.asideVisible = showAsidePanel;
  viewState.value = next;
  selected.value = null;
  selectedEvent.value = null;
  // Same reset as selection: a leftover frame caret reopens the previous line
  // when SourceView's model changes (file ids are basenames).
  sourceFocus.value = null;
  multiSelected.value = [];
  multiSelectSpan.value = null;
  marqueeLive.value = false;
  marqueeFromClosed.value = false;
  clearMultiSelectDimTimer();
  multiSelectDimmed.value = false;
  livePreviewIds.value = [];
  marqueePreviewHeight.value = DOCK_HEIGHT_MARQUEE_PREVIEW;
  dockSnap = null;
  hovered.value = null;
  hintsDockOpen.value = false;
  closeTopologyFullscreen();
  // Operator switches keep session gutter/aside preferences; fresh loads reset them.
  if (!opts?.preservePanelWidths) resetPanelWidthsToDefaults();
  const fromMeta = model?.metadata?.defaultCollapsedIds;
  collapsedGroupIds.value = Array.isArray(fromMeta)
    ? fromMeta.filter((id): id is string => typeof id === 'string')
    : [];
  initGutterMetrics(model);
  if (showTimeline.value) void bindLayoutFit();
}

function stopLayoutFitObserver(): void {
  layoutResizeObserver?.disconnect();
  layoutResizeObserver = null;
}

function applyLayoutFit(): void {
  const el = layoutRef.value?.rootEl;
  if (!el) return;
  const hostWidth = el.clientWidth;
  if (!(hostWidth > 0)) return;
  const next = fitPanelWidths(hostWidth, {
    asideVisible: showAside.value,
    preferredGutter: preferredGutterWidth.value,
    preferredAside: preferredAsideWidth.value,
  });
  if (next.gutterWidth !== gutterWidth.value) gutterWidth.value = next.gutterWidth;
  if (next.asideWidth !== asideWidth.value) asideWidth.value = next.asideWidth;
}

async function bindLayoutFit(): Promise<void> {
  stopLayoutFitObserver();
  await nextTick();
  const el = layoutRef.value?.rootEl;
  if (!el) return;
  applyLayoutFit();
  if (typeof ResizeObserver === 'undefined') return;
  layoutResizeObserver = new ResizeObserver(() => {
    applyLayoutFit();
  });
  layoutResizeObserver.observe(el);
}

function onGutterWidth(w: number): void {
  preferredGutterWidth.value = w;
  gutterWidth.value = w;
}

function onAsideWidth(w: number): void {
  preferredAsideWidth.value = w;
  asideWidth.value = w;
  // Re-fit so a drag that would starve the track is clamped in the same turn.
  applyLayoutFit();
}

function onToggleGroup(groupId: string): void {
  const m = swim.value;

  // Mid-tween re-click on the same group reverses from the current visible.
  if (animGroupId.value === groupId && collapseAnim.value) {
    const { visible, hiddenHeight, summaryEvents } = collapseAnim.value;
    const nowCollapsing = !animCollapsing.value;
    const target = nowCollapsing
      ? [...new Set([...collapsedGroupIds.value, groupId])]
      : collapsedGroupIds.value.filter((id) => id !== groupId);
    cancelCollapseAnim();
    if (hiddenHeight <= 0 || prefersReducedMotion()) {
      animGroupId.value = null;
      collapseAnim.value = null;
      pendingCollapseTarget = null;
      collapsedGroupIds.value = target;
      clampScrollAfterCollapse();
      return;
    }
    animCollapsing.value = nowCollapsing;
    animGroupId.value = groupId;
    pendingCollapseTarget = target;
    collapseAnim.value = { groupId, visible, hiddenHeight, summaryEvents };
    cancelCollapseAnim = animateProgress({
      from: visible,
      to: nowCollapsing ? 0 : 1,
      durationMs: 200,
      onUpdate: (v) => {
        collapseAnim.value = { groupId, visible: v, hiddenHeight, summaryEvents };
      },
      onDone: () => {
        collapseAnim.value = null;
        animGroupId.value = null;
        pendingCollapseTarget = null;
        collapsedGroupIds.value = target;
        clampScrollAfterCollapse();
      },
    });
    return;
  }

  // Different group (or idle): commit any in-flight tween's target before starting anew.
  if (animGroupId.value && pendingCollapseTarget) {
    collapsedGroupIds.value = pendingCollapseTarget;
    pendingCollapseTarget = null;
    // Rows may have just left the filtered tree — drop stale hover / clamp scroll now,
    // not only when the *new* tween's onDone fires (~200ms later).
    clampScrollAfterCollapse();
  }
  cancelCollapseAnim();
  animGroupId.value = null;
  collapseAnim.value = null;

  const set = new Set(collapsedGroupIds.value);
  const collapsing = !set.has(groupId);
  if (collapsing) set.add(groupId);
  else set.delete(groupId);
  const target = [...set];

  // Height of the descendants being hidden/shown (expanded − collapsed content height).
  const collapsedIds = collapsing ? target : collapsedGroupIds.value;
  const expandedIds = collapsing ? collapsedGroupIds.value : target;
  if (!m) {
    collapsedGroupIds.value = target;
    clearHoverAfterCollapse();
    return;
  }
  const hiddenHeight = collapseHiddenHeight(m, expandedIds, collapsedIds);
  const folder = findThreadById(m, groupId);
  const summaryEvents = folder ? buildFolderSummaryEvents(folder) : undefined;
  const summaries =
    summaryEvents && summaryEvents.length > 0 ? summaryEvents : undefined;

  if (hiddenHeight <= 0 || prefersReducedMotion()) {
    pendingCollapseTarget = null;
    collapsedGroupIds.value = target;
    clampScrollAfterCollapse();
    return;
  }

  animCollapsing.value = collapsing;
  animGroupId.value = groupId;
  pendingCollapseTarget = target;
  collapseAnim.value = {
    groupId,
    visible: collapsing ? 1 : 0,
    hiddenHeight,
    summaryEvents: summaries,
  };
  cancelCollapseAnim = animateProgress({
    from: collapsing ? 1 : 0,
    to: collapsing ? 0 : 1,
    durationMs: 200,
    onUpdate: (visible) => {
      collapseAnim.value = {
        groupId,
        visible,
        hiddenHeight,
        summaryEvents: summaries,
      };
    },
    onDone: () => {
      collapseAnim.value = null;
      animGroupId.value = null;
      pendingCollapseTarget = null;
      collapsedGroupIds.value = target;
      clampScrollAfterCollapse();
    },
  });
}

/** Clear hover that may point at a vanished summary bar / pruned event. */
function clearHoverAfterCollapse(): void {
  hovered.value = null;
  viewState.value = { ...viewState.value, hoveredEventId: null };
}

function clampScrollAfterCollapse(): void {
  clearHoverAfterCollapse();
  // Gutter layout (wrapper height) updates this tick; max scroll is viewport-relative.
  void nextTick(() => {
    const el = timelineRef.value?.gutterRoot;
    if (!el) return;
    const maxY = Math.max(0, el.scrollHeight - el.clientHeight);
    if (viewState.value.scrollY <= maxY) return;
    viewState.value = { ...viewState.value, scrollY: maxY };
  });
}

function onPinLane(laneId: string): void {
  viewState.value = pinLane(viewState.value, laneId);
}

function onUnpinLane(laneId: string): void {
  viewState.value = unpinLane(viewState.value, laneId);
}

function onPinOverview(seriesId: string): void {
  viewState.value = pinOverview(viewState.value, seriesId);
}

function onUnpinOverview(seriesId: string): void {
  viewState.value = unpinOverview(viewState.value, seriesId);
}

function onGutterMetricChange(payload: { cardId: string; metric: GutterMetric }): void {
  gutterMetricByCard.value = { ...gutterMetricByCard.value, [payload.cardId]: payload.metric };
}

/**
 * Aside has content when any of: duration card, I/O bandwidth cards,
 * pipe occupancy, compute/memory CSV tables, hardware details, labelled topology,
 * or joined performance hints is present.
 * Roofline counts only when the `roofline` capability is present (adapter-derived when points
 * exist, or host-passed), so points alone without the flag never open the aside.
 * Name/type alone do not open the aside (DATA-33a). Must stay in sync with StatsAside.
 */
function reportHasAsideContent(
  rm: ReportViewModel | null | undefined,
  capabilities: ReportCapability[] = [],
): boolean {
  if (!rm) return false;
  const hasDuration = rm.summary.taskDurationUs != null;
  const hasBandwidth = (rm.bandwidthCards ?? []).length > 0;
  const hasComputeCard = (rm.computeCard?.sides.length ?? 0) > 0;
  const hasPipe = rm.pipeOccupancy.length > 0;
  const hasComputeTables = rm.computeTables.length > 0;
  const hasMemoryTables = rm.memoryTables.length > 0;
  const hasSummaryCategories = (rm.summaryCategories?.length ?? 0) > 0;
  const hasRoofline =
    capabilities.includes('roofline') && (rm.roofline?.points?.length ?? 0) > 0;
  const hasHardware = (rm.hardwareDetails?.sections.length ?? 0) > 0;
  const hasTopology = (rm.memoryTopology?.edges.some((e) => e.label) ?? false);
  const hasPerformanceHints =
    capabilities.includes('performanceHints') && (rm.performanceHints?.length ?? 0) > 0;
  return (
    hasDuration ||
    hasBandwidth ||
    hasComputeCard ||
    hasPipe ||
    hasComputeTables ||
    hasMemoryTables ||
    hasSummaryCategories ||
    hasRoofline ||
    hasHardware ||
    hasTopology ||
    hasPerformanceHints
  );
}

/**
 * DATA-33a: the aside auto-opens on load only for non-hint content. A
 * hints-only emulate report keeps the aside closed, while the manual toolbar
 * toggle stays available because `reportHasAsideContent` counts the hints.
 */
function reportAutoOpensAside(
  rm: ReportViewModel | null | undefined,
  capabilities: ReportCapability[] = [],
): boolean {
  return reportHasAsideContent(
    rm,
    capabilities.filter((c) => c !== 'performanceHints'),
  );
}

function applyAdapted(adapted: AdaptedReport) {
  operators.value = adapted.operators ?? [];
  operatorReports.value = adapted.operatorReports ?? {};
  selectedOperatorId.value = adapted.selectedOperatorId ?? null;
  applyTimelineTraceFields(adapted);
  internalSwim.value = adapted.swimlaneModel;
  internalReport.value = adapted.reportModel;
  internalCapabilities.value = adapted.capabilities ?? null;
  bumpSourceSession();
  resetViewFromModel(adapted.swimlaneModel, reportAutoOpensAside(adapted.reportModel, caps.value));
  loadError.value = null;
  emit('ready');
}

function closeTopologyFullscreen() {
  topologyFullscreen.value = false;
}

function onTopologyFullscreenAfterLeave() {
  // Leave can be cancelled by a mid-fade reopen — only clear when still closed.
  if (topologyFullscreen.value) return;
  fullscreenTopology.value = null;
  // The heat selection is per overlay session, so the next open defaults again (PR-ROOT-026).
  selectedMemoryUnit.value = null;
}

function onOpenTopologyFullscreen(
  model: MemoryTopologyModel,
  unit?: MemoryHeatmapUnitId,
  baseline?: MemoryTopologyModel | null,
  baselineRows?: { label: string; model: MemoryTopologyModel }[],
) {
  fullscreenTopology.value = model;
  fullscreenBaselineTopology.value = baseline ?? null;
  fullscreenBaselineRows.value = baselineRows ?? [];
  // 如果是直接点击一个 memory 进来则直接对应显示相应的内容; via 全屏 it defaults (activeMemoryUnit).
  selectedMemoryUnit.value = unit ?? null;
  topologyFullscreen.value = true;
  void nextTick(() => fullscreenBackRef.value?.focus());
}

function failLoad(cause: unknown) {
  operators.value = [];
  operatorReports.value = {};
  selectedOperatorId.value = null;
  timelineTraces.value = [];
  timelineTraceModels.value = {};
  selectedTimelineTraceId.value = null;
  internalSwim.value = null;
  internalReport.value = null;
  internalCapabilities.value = null;
  bumpSourceSession();
  selected.value = null;
  selectedEvent.value = null;
  hovered.value = null;
  viewState.value = createViewState(null);
  closeTopologyFullscreen();
  activeTab.value = 'timeline';
  loadError.value = cause instanceof Error ? cause.message : String(cause);
  emit('error', { message: loadError.value, cause });
}

/** Bumps on each source load/clear so stale async loads do not applyAdapted. */
let sourceLoadGen = 0;
/** Bumps when starting a resolve pass so stale host replies do not overwrite. */
let sourceResolveGen = 0;
/** The baseline pane's own pass counter — never invalidates the open report. */
let baselineResolveGen = 0;

/** Fill placeholder text; `null` when nothing changed. Never mutates state. */
async function fillMissingSourceFiles(
  model: SourceCorrelationModel | null | undefined,
  resolve: ResolveSourceFile | undefined = props.resolveSourceFile,
): Promise<SourceCorrelationModel | null> {
  if (!model || model.mock || !resolve) return null;
  const next = await resolveMissingSourceFiles(model, resolve);
  return next === model ? null : next;
}

/**
 * Record open-report text for the HTML export (baseline fills never do),
 * keyed by file path so the exported shell can match its workspace pick.
 * Only files the fill changed from placeholder to real are carried — text the
 * pack already embedded stays out of the map.
 */
function recordSourceTexts(
  prev: SourceCorrelationModel | null | undefined,
  next: SourceCorrelationModel,
): void {
  const texts = { ...resolvedSourceTexts.value };
  let recorded = false;
  next.files.forEach((file, index) => {
    const before = prev?.files[index];
    if (!before || !fileNeedsSourceResolve(before) || fileNeedsSourceResolve(file)) return;
    if (texts[file.path] === file.text) return;
    texts[file.path] = file.text;
    recorded = true;
  });
  if (recorded) resolvedSourceTexts.value = texts;
}

async function fillReportSourceFiles(
  model: SourceCorrelationModel | null | undefined,
  resolveGen: number,
  resolve: ResolveSourceFile | undefined = props.resolveSourceFile,
): Promise<SourceCorrelationModel | null> {
  const next = await fillMissingSourceFiles(model, resolve);
  if (resolveGen !== sourceResolveGen || !next) return null;
  recordSourceTexts(model, next);
  resolvedSourceCorrelation.value = next;
  return next;
}

function unionRequests(models: Array<SourceCorrelationModel | null | undefined>): ResolveSourceFileRequest[] {
  const seen = new Set<string>();
  const requests: ResolveSourceFileRequest[] = [];
  for (const model of models) {
    if (!model) continue;
    for (const request of sourceResolveRequests(model)) {
      if (seen.has(request.fileName)) continue;
      seen.add(request.fileName);
      requests.push(request);
    }
  }
  return requests;
}

function mergeWorkspaceFiles(
  prev: SourceWorkspaceFile[],
  picked: { files: SourceWorkspaceFile[] },
): SourceWorkspaceFile[] {
  const byPath = new Map(prev.map((file) => [file.path, file]));
  for (const file of picked.files) byPath.set(file.path, file);
  return [...byPath.values()];
}

/** Placeholder files across the open report and every packaged operator. */
function reportPickRequests(): ResolveSourceFileRequest[] {
  return unionRequests([
    report.value?.sourceCorrelation,
    ...Object.values(operatorReports.value).map((rep) => rep.reportModel.sourceCorrelation),
  ]);
}

function baselinePickRequests(pack: AdaptedReport): ResolveSourceFileRequest[] {
  return unionRequests([
    pack.reportModel.sourceCorrelation,
    ...Object.values(pack.operatorReports ?? {}).map((rep) => rep.reportModel.sourceCorrelation),
  ]);
}

async function onPickReportSourceWorkspace() {
  const model = report.value?.sourceCorrelation;
  const pick = props.pickSourceWorkspace;
  if (!model || !pick) return;
  const requests = reportPickRequests();
  if (requests.length === 0) return;
  // The dialog can outlive the report it was opened for: claim the generation
  // before awaiting so a report swap while it is open drops the stale result.
  const resolveGen = ++sourceResolveGen;
  const picked = await pick(requests);
  if (!picked || resolveGen !== sourceResolveGen) return;
  reportWorkspaceFiles = mergeWorkspaceFiles(reportWorkspaceFiles, picked);
  reportWorkspaceResolve = workspaceSourceResolver({ files: reportWorkspaceFiles });
  await fillReportSourceFiles(
    model,
    resolveGen,
    chainResolve(reportWorkspaceResolve, props.resolveSourceFile),
  );
}

async function onPickBaselineSourceWorkspace() {
  const row = compareRow.value;
  const pack = row ? props.baselineReports?.[row.baselineId]?.report : null;
  const pick = props.pickSourceWorkspace;
  const model = compareBaselineModel.value;
  if (!row || !pack || !model || !pick) return;
  const requests = baselinePickRequests(pack);
  if (requests.length === 0) return;
  const resolveGen = ++baselineResolveGen;
  const picked = await pick(requests);
  if (!picked || resolveGen !== baselineResolveGen) return;
  baselineWorkspaceFiles = mergeWorkspaceFiles(baselineWorkspaceFiles, picked);
  baselineWorkspaceResolve = workspaceSourceResolver({ files: baselineWorkspaceFiles });
  const key = compareSourceKeyOf(row, pack);
  const start = baselineSourceCorrelation.value[key] ?? model;
  const next = await fillMissingSourceFiles(start, baselineWorkspaceResolve);
  if (resolveGen !== baselineResolveGen || !next) return;
  baselineSourceCorrelation.value = {
    ...baselineSourceCorrelation.value,
    [key]: next,
  };
}

async function loadFromSource(source: ArrayBuffer | Uint8Array, gen: number) {
  try {
    // Best-effort sql.js for compute Source `summary.db`. Failure must not block the report.
    try {
      await ensurePcSamplingSql();
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      console.warn(`[profiling-report] sql.js unavailable; Source stalls omitted: ${detail}`);
    }
    if (gen !== sourceLoadGen) return;
    applyAdapted(loadReportSource(source));
    const resolveGen = ++sourceResolveGen;
    await fillReportSourceFiles(internalReport.value?.sourceCorrelation, resolveGen);
  } catch (cause) {
    if (gen !== sourceLoadGen) return;
    failLoad(cause);
  }
}

/** Swap the swimlane/report to another packaged operator without re-parsing the container. */
function onOperatorChange(id: string) {
  const rep = operatorReports.value[id];
  if (!rep || id === selectedOperatorId.value) return;
  selectedOperatorId.value = id;
  applyTimelineTraceFields(rep);
  internalSwim.value = rep.swimlaneModel;
  internalReport.value = rep.reportModel;
  internalCapabilities.value = rep.capabilities ?? null;
  sourceSession.value += 1;
  resolvedSourceCorrelation.value = null;
  // Viewport/selection reset like a fresh load, but keep aside open/closed and panel widths.
  resetViewFromModel(rep.swimlaneModel, viewState.value.asideVisible, {
    preservePanelWidths: true,
  });
  const resolveGen = ++sourceResolveGen;
  void fillReportSourceFiles(
    rep.reportModel.sourceCorrelation,
    resolveGen,
    chainResolve(reportWorkspaceResolve, props.resolveSourceFile),
  );
}

/** Swap among §11.14 catalog CTEF embeds without re-parsing the leaf. */
function onTimelineTraceChange(id: TimelineTraceKind) {
  const model = timelineTraceModels.value[id];
  if (!model || id === selectedTimelineTraceId.value) return;
  selectedTimelineTraceId.value = id;
  internalSwim.value = model;
  resetViewFromModel(model, viewState.value.asideVisible, {
    preservePanelWidths: true,
  });
}

/** Parse before first paint when `source` is already available (avoids empty→loaded height jump). */
let sourceWatchReady = false;
watch(
  () => props.source,
  (src) => {
    if (sourceWatchReady) exitCompareMode();
    sourceWatchReady = true;
    sourceLoadGen += 1;
    sourceResolveGen += 1;
    const gen = sourceLoadGen;
    if (src) {
      void loadFromSource(src, gen);
      return;
    }
    // Source removed: drop what the adapter derived, or its flags outlive the report.
    operators.value = [];
    operatorReports.value = {};
    selectedOperatorId.value = null;
    timelineTraces.value = [];
    timelineTraceModels.value = {};
    selectedTimelineTraceId.value = null;
    internalSwim.value = null;
    internalReport.value = null;
    internalCapabilities.value = null;
    bumpSourceSession();
    closeTopologyFullscreen();
  },
  { immediate: true },
);

watch(
  () => props.reportModel,
  (rm) => {
    if (props.source) return;
    bumpSourceSession();
    const resolveGen = ++sourceResolveGen;
    if (!rm?.sourceCorrelation) return;
    void fillReportSourceFiles(rm.sourceCorrelation, resolveGen);
  },
  { immediate: true },
);

// Hosts often attach the webview bridge after first paint — re-run only when the
// hook appears (falsy → truthy). Do not key on function identity: an inline
// arrow each parent render would cancel in-flight fills and re-hit the host
// for every still-placeholder file on the base model.
watch(
  () => !!props.resolveSourceFile,
  (present, wasPresent) => {
    if (!present || wasPresent) return;
    const rm = props.source ? internalReport.value : props.reportModel;
    if (!rm?.sourceCorrelation) return;
    const resolveGen = ++sourceResolveGen;
    void fillReportSourceFiles(rm.sourceCorrelation, resolveGen);
  },
);

watch(
  () => props.swimlaneModel,
  (m) => {
    if (m && !props.source) {
      resetViewFromModel(
        m,
        reportAutoOpensAside(props.reportModel ?? report.value, caps.value),
      );
    }
  },
);

// Close 全屏 when the *base* report swaps (load / host model / operator). Do not
// watch `report` itself: `resolveSourceFile` overlays a new object with the same
// topology and would dismiss an in-flight 全屏 when Ascend C text arrives.
watch(
  () => props.reportModel ?? internalReport.value,
  () => {
    closeTopologyFullscreen();
  },
);

watch(
  showTimeline,
  (show) => {
    if (show) void bindLayoutFit();
    else stopLayoutFitObserver();
  },
);

watch(showAside, () => {
  applyLayoutFit();
});

onMounted(() => {
  window.addEventListener('keydown', onRootKeydown);
  if (props.source) return;
  if (props.swimlaneModel || props.reportModel) {
    resetViewFromModel(
      props.swimlaneModel ?? null,
      reportAutoOpensAside(props.reportModel, caps.value),
    );
    emit('ready');
  }
});

onBeforeUnmount(() => {
  cancelViewWindowAnim();
  cancelCollapseAnim();
  collapseAnim.value = null;
  animGroupId.value = null;
  pendingCollapseTarget = null;
  clearMultiSelectDimTimer();
  stopLayoutFitObserver();
  window.removeEventListener('keydown', onRootKeydown);
  closeHtmlExportDialog();
});

/** Escape drops the measure overlay and the marquee multi-selection alike. */
function onRootKeydown(e: KeyboardEvent) {
  // A popover that already handled Escape (显示控制, 快捷键说明, the baseline
  // picker, …) calls preventDefault on its document-level listener — which runs
  // before this window listener. Respect that: one Escape press must dismiss
  // only the popover, not also clear measure / the multi-selection behind it.
  if (e.defaultPrevented) return;
  if (e.key === 'Escape' && htmlExportOpen.value) {
    e.preventDefault();
    closeHtmlExportDialog();
    return;
  }
  if (e.key === 'Escape' && (viewState.value.measureMode || viewState.value.measureRange)) {
    viewState.value = clearMeasure(viewState.value);
    // Live marquee preview fills `multiSelected` without a commit — do not clear it here.
    if (!marqueeLive.value && multiSelected.value.length > 0) onSelect(null);
    return;
  }
  if (e.key === 'Escape' && topologyFullscreen.value) {
    e.preventDefault();
    closeTopologyFullscreen();
    return;
  }
  // Live preview owns Escape: canvas cancels and emits `multi-select-preview(null)`,
  // which restores the pre-drag dock. Treating preview `multiSelected` as committed
  // would emit host `select(null)` and clear viewState before that restore.
  if (e.key === 'Escape' && marqueeLive.value) {
    return;
  }
  if (e.key === 'Escape' && multiSelected.value.length > 0) {
    onSelect(null);
    return;
  }
  // Overlay covers the timeline (including the ~200ms leave fade while the model is still held).
  // WASD must not pan/zoom the hidden view.
  if (htmlExportOpen.value || topologyFullscreen.value || fullscreenTopology.value != null) return;
  if (!showTimelineSurface.value) return;
  const target = e.target as HTMLElement | null;
  // Ignore shortcuts while typing — search, dependency depth, and editable controls own them.
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)
  ) {
    return;
  }
  // Global pin toggle (Shift+P) — same pin state as the gutter pushpin and the context menu.
  if (e.key.toLowerCase() === 'p' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    togglePinLane(hoveredLaneId.value);
    return;
  }
  // No chords: W/S/A/D are bare keys (Ctrl/Cmd/Alt/Shift held → let the browser / other
  // handlers own the chord). Matches PyPTO's modifier-free keyboard handling.
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  const key = e.key.toLowerCase();
  if (key === 'w' || key === 's') {
    // Zoom around the cursor (PyPTO anchors on the pointer); center when none is set.
    const anchor =
      cursor.value?.time ?? (viewState.value.startTime + viewState.value.endTime) / 2;
    e.preventDefault();
    onZoom(key === 'w' ? 1.25 : 1 / 1.25, anchor);
  } else if (key === 'a' || key === 'd') {
    const span = viewState.value.endTime - viewState.value.startTime;
    // Nominal 1000 px when the track hasn't measured yet — PyPTO's 30 px step on a
    // ~1000 px canvas ≈ 3% of the visible span.
    const trackWidth = timelineRef.value?.trackWidth ?? 0;
    const step = keyboardPanStepTime(span, trackWidth > 0 ? trackWidth : 1000);
    e.preventDefault();
    onPan(key === 'd' ? step : -step);
  }
}

/**
 * Effective display mode: host prop when set, else the toolbar's local choice.
 * Clamp `'cycles'` → `'time'` only when OpBasicInfo freq is missing — never treat
 * an omitted host prop as an explicit `'time'` write (that would wipe a toolbar
 * cycles selection on every freq change, e.g. operator switch / report reload).
 */
watch(
  [() => props.timeDisplayMode, clockFreqMHz],
  ([mode, freq]) => {
    if (mode != null) {
      localTimeDisplayMode.value = mode === 'cycles' && freq == null ? 'time' : mode;
      return;
    }
    if (localTimeDisplayMode.value === 'cycles' && freq == null) {
      localTimeDisplayMode.value = 'time';
    }
  },
  { immediate: true },
);

watch(
  () => props.dependencyMode,
  (m) => {
    if (m) localDependencyMode.value = m;
  },
);

watch(
  () => props.dependencyDepth,
  (d) => {
    if (d != null) localDependencyDepth.value = normalizeDependencyDepth(d);
  },
);

function onSelect(ev: SwimEvent | null) {
  multiSelected.value = [];
  multiSelectSpan.value = null;
  if (!ev) {
    selected.value = null;
    selectedEvent.value = null;
    viewState.value = clearSelection(viewState.value);
    emit('select', null);
    return;
  }
  // A later timeline commit owns the dock — drop sticky hints so closing DetailPanel
  // does not resurrect the pane without another 性能分析 click (PR-ROOT-023).
  hintsDockOpen.value = false;
  const payload: SelectedEvent = {
    id: ev.id,
    name: ev.name,
    startTime: ev.startTime,
    duration: ev.duration,
    endTime: ev.startTime + ev.duration,
    args: ev.args,
  };
  selected.value = payload;
  selectedEvent.value = ev;
  viewState.value = setSelectedEvent(viewState.value, ev.id);
  emit('select', payload);
}

function selectedPayloadFromEvent(ev: SwimEvent): SelectedEvent {
  return {
    id: ev.id,
    name: ev.name,
    startTime: ev.startTime,
    duration: ev.duration,
    endTime: ev.startTime + ev.duration,
    args: ev.args,
  };
}

function snapshotDockIfNeeded(): void {
  if (dockSnap) return;
  const wasOpen = !!(selected.value || multiSelected.value.length);
  const wrapClosedHeight = wasOpen
    ? undefined
    : (timelineRef.value?.swimlaneWrapHeight ?? 0);
  dockSnap = {
    selected: selected.value,
    selectedEvent: selectedEvent.value,
    multiSelected: multiSelected.value.slice(),
    wasOpen,
    dockHeight: dockHeight.value,
    wrapClosedHeight,
    scrollY: viewState.value.scrollY,
  };
  marqueeFromClosed.value = !wasOpen;
  // Precompute before the dock mounts so the first paint is already at preview
  // height (not collapsed → shrink flicker via wrap RO feedback).
  if (!wasOpen) {
    marqueePreviewHeight.value =
      timelineRef.value?.computeMarqueePreviewDockHeight?.(
        0,
        dockHeight.value,
        wrapClosedHeight,
        viewState.value.scrollY,
      ) ?? DOCK_HEIGHT_MARQUEE_PREVIEW;
  }
}

/**
 * Ordered-id change detection on length + first/mid/last — the same digest as the canvas's
 * `sameIdSet`, so unchanged coverage does not restart the settle timer on every pointermove.
 * ponytail: a same-length interior swap can read as unchanged, leaving `livePreviewIds`
 * stale so the settle resolves the old ids — bounded to the live drag, since commit always
 * re-applies the authoritative list. Upgrade: ordered `every()` or a hash of all ids.
 */
function sameIdDigest(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;
  return (
    a[0] === b[0] && a[a.length >> 1] === b[b.length >> 1] && a[a.length - 1] === b[b.length - 1]
  );
}

function clearMultiSelectDimTimer(): void {
  if (multiSelectDimTimer != null) {
    clearTimeout(multiSelectDimTimer);
    multiSelectDimTimer = null;
  }
}

/** Single-event live preview → DetailPanel (cheap, no settle). */
function applySingleLivePreview(ev: SwimEvent): void {
  if (
    multiSelected.value.length === 0 &&
    selectedEvent.value?.id === ev.id &&
    selected.value?.id === ev.id
  ) {
    return;
  }
  multiSelected.value = [];
  selectedEvent.value = ev;
  selected.value = selectedPayloadFromEvent(ev);
}

/** Resolve the live union ids to model events and refresh the summary table. */
function resolveLiveSelection(): void {
  const ids = livePreviewIds.value;
  const events =
    ids.length === 0
      ? []
      : ids
          .map((id) => findEventInModel(swim.value, id))
          // Stale/unresolvable ids (e.g. the digest ceiling above) are expected to drop;
          // commit re-applies the authoritative list, so the row count can only lag
          // `livePreviewCount` transiently during the live drag.
          .filter((ev): ev is SwimEvent => ev != null);
  multiSelected.value = events;
  multiSelectDimmed.value = false;
}

/**
 * Dim the table now, then recalculate once the marquee has settled (no change for 200ms).
 * ponytail: settling mid-drag re-runs the ranked-window / virtualizer path for the full
 * union on every ≥200ms pause — fine for typical selections, but a 100k-event marquee
 * that the pointer hesitates over pays one remap per pause. Upgrade: resolve only on
 * commit (keep dimmed for the whole live preview) or cap the settle remap when
 * `livePreviewCount` exceeds the ranked window.
 */
function scheduleMultiSelectSettle(): void {
  multiSelectDimmed.value = true;
  clearMultiSelectDimTimer();
  multiSelectDimTimer = setTimeout(() => {
    multiSelectDimTimer = null;
    // A fired-but-not-yet-run timer is not dequeued by `clearTimeout`: commit can land
    // between the timer firing and this callback running, having already cleared
    // `livePreviewIds` and set `marqueeLive` false. Guard so a stale settle never
    // resolves `[]` over the just-committed selection.
    if (!marqueeLive.value) return;
    resolveLiveSelection();
  }, MULTI_SELECT_SETTLE_MS);
}

function clearMarqueeLive(opts?: { restore?: boolean }): void {
  clearMultiSelectDimTimer();
  multiSelectDimmed.value = false;
  livePreviewIds.value = [];
  if (opts?.restore && dockSnap) {
    selected.value = dockSnap.selected;
    selectedEvent.value = dockSnap.selectedEvent;
    multiSelected.value = dockSnap.multiSelected;
    dockHeight.value = dockSnap.dockHeight;
  }
  dockSnap = null;
  marqueeLive.value = false;
  livePreviewCount.value = 0;
  marqueeFromClosed.value = false;
  marqueePreviewHeight.value = DOCK_HEIGHT_MARQUEE_PREVIEW;
}

function previewPayloadIds(payload: string[] | SwimEvent[]): string[] {
  if (payload.length === 0) return [];
  return typeof payload[0] === 'string'
    ? (payload as string[])
    : (payload as SwimEvent[]).map((e) => e.id);
}

function previewPayloadEvents(payload: string[] | SwimEvent[]): SwimEvent[] | null {
  if (payload.length === 0) return [];
  return typeof payload[0] === 'string' ? null : (payload as SwimEvent[]);
}

/**
 * Live marquee coverage for the dock only. Does not touch viewState or host `select`.
 * Canvas emits union **ids**; tests may still emit `SwimEvent[]`. ≥2 updates the header
 * count immediately but keeps the table dimmed and stale while the marquee is still
 * growing; after MULTI_SELECT_SETTLE_MS without a change (or on commit) the root resolves
 * the ids and recalculates the table. Any post-gate preview (including `[]`) arms
 * `marqueeLive` for Escape. Empty mid-drag clears Detail/Summary. When the dock was
 * already open at drag start, the footer stays mounted with a nothing-selected message;
 * when it opened from closed, the footer stays hidden until coverage is non-empty
 * (no empty-state flash) and uses slack-based preview height toward the session target.
 * Unchanged coverage does not restart the settle timer.
 */
function onMultiSelectPreview(payload: string[] | SwimEvent[] | null): void {
  if (payload == null) {
    // Escape / cancel. Commit clears marqueeLive before this emit arrives.
    if (marqueeLive.value) clearMarqueeLive({ restore: true });
    return;
  }
  // Arm gesture liveness before applying coverage so Escape stays gated
  // even for an empty-only live rect over a committed multi dock.
  snapshotDockIfNeeded();
  marqueeLive.value = true;
  const ids = previewPayloadIds(payload);
  if (ids.length === 0) {
    clearMultiSelectDimTimer();
    multiSelectDimmed.value = false;
    livePreviewIds.value = [];
    selected.value = null;
    selectedEvent.value = null;
    multiSelected.value = [];
    livePreviewCount.value = 0;
    return;
  }

  // Single-event DetailPanel is cheap — apply immediately.
  if (ids.length < 2) {
    clearMultiSelectDimTimer();
    multiSelectDimmed.value = false;
    livePreviewIds.value = [];
    livePreviewCount.value = 0;
    const events = previewPayloadEvents(payload);
    const ev = events?.[0] ?? findEventInModel(swim.value, ids[0]!);
    if (ev) applySingleLivePreview(ev);
    return;
  }

  livePreviewCount.value = ids.length;
  selected.value = null;
  selectedEvent.value = null;

  // Unchanged coverage: the settle timer is already pending — do not restart it.
  if (sameIdDigest(ids, livePreviewIds.value)) return;

  livePreviewIds.value = ids;
  scheduleMultiSelectSettle();
}

/**
 * Marquee commit. Empty → clear. Exactly one event → single-select DetailPanel
 * (same as a plain click). Two or more → multi-select summary and `select(null)`
 * so hosts read "no single selection" while the multi dock is up (contract in
 * ProfilingReport.spec.md Outputs). The axis Δt is cleared on commit (it only
 * follows the live drag).
 */
function onMultiSelect(events: SwimEvent[]) {
  const priorHeight = dockSnap?.dockHeight ?? dockHeight.value;
  // Discard the pre-drag snap; commit wins. Preview-null that follows is a no-op.
  clearMarqueeLive();
  if (events.length === 0) {
    onSelect(null);
    return;
  }
  // Closed→drag used preview height; grow to the session height (collapsed or expanded).
  // Clearing the selection must not forget an expanded dock — priorHeight is that session value.
  // Already-open already shows session height during the gesture.
  dockHeight.value = priorHeight;
  if (events.length === 1) {
    onSelect(events[0]!);
    return;
  }
  // Same sticky-hints clear as onSelect(non-null) — multi commit owns the dock (PR-ROOT-023).
  hintsDockOpen.value = false;
  selected.value = null;
  selectedEvent.value = null;
  multiSelected.value = events;
  // multiSelectSpan is already cleared by the canvas before this emit.
  multiSelectSpan.value = null;
  viewState.value = setMultiSelection(
    viewState.value,
    events.map((e) => e.id),
  );
  emit('select', null);
}

/**
 * Live marquee extent during the drag. The canvas nulls it on pointerup/Escape.
 * The root does not replace it with a committed hull, so the axis Δt disappears after drag.
 */
function onMultiSelectSpan(span: MeasureRange | null) {
  multiSelectSpan.value = span;
}

function onHover(ev: SwimEvent | null, clientX: number, clientY: number) {
  // While the context menu pins an event as highlighted, ignore the canvas clearing
  // hover (the pointer left for the menu/scrim) — keep the target highlighted.
  if (contextMenuContext.value?.target && ev == null) return;
  const nextId = ev?.id ?? null;
  if (ev) {
    tooltipStyle.value = {
      left: `${clientX + 12}px`,
      top: `${clientY + 12}px`,
    };
  }
  // Same-id moves only chase the tooltip. Cloning viewState every pixel re-renders
  // the dock while a selection is open.
  if (nextId === viewState.value.hoveredEventId) return;
  hovered.value = ev;
  viewState.value = { ...viewState.value, hoveredEventId: nextId };
}

function onCursor(payload: { time: number; xRatio: number; snapped?: boolean } | null) {
  cursor.value = payload;
}

function onSetPlayhead(time: number) {
  viewState.value = { ...viewState.value, playheadTime: time };
}

function onOverviewWindow(window: { startTime: number; endTime: number }) {
  stopViewWindowAnim();
  viewState.value = applyWindow(viewState.value, {
    ...window,
    scrollY: viewState.value.scrollY,
  });
}

function onContextMenu(payload: { x: number; y: number; laneId: string; target?: SwimEvent | null }): void {
  contextMenuContext.value = { ...payload, target: payload.target ?? null };
  // Hide the hover tooltip, then pin the target as highlighted so it stays visibly
  // highlighted for the whole time the menu is open (the scrim would otherwise drop it).
  hovered.value = null;
  if (payload.target) {
    viewState.value = { ...viewState.value, hoveredEventId: payload.target.id };
  }
}

function onHoverLane(laneId: string | null): void {
  hoveredLaneId.value = laneId;
}

/** Toggle pin for a leaf lane; ignores folders and unknown ids (global Shift+P + context menu). */
function togglePinLane(laneId: string | null): void {
  if (!laneId) return;
  const lane = swim.value ? findThreadById(swim.value, laneId) : null;
  if (!lane || isFolderNode(lane)) return;
  if (viewState.value.pinnedLaneIds.includes(laneId)) onUnpinLane(laneId);
  else onPinLane(laneId);
}

function onContextMenuDismiss(): void {
  contextMenuContext.value = null;
  viewState.value = { ...viewState.value, hoveredEventId: null };
}
function onContextMenuAction(action: ContextMenuAction): void {
  if (action.command === 'reset') {
    onZoomToFit();
    return;
  }
  if (action.command === 'show') {
    // Edge case: target no longer exists → dismiss without selecting. A collapsed-folder
    // summary bar is never itself selected — resolve to its sole underlying leaf
    // (taskCount === 1). A multi-task summary has no single event: drop the action
    // entirely so Show never clears an existing selection.
    if (action.target?.taskCount != null && action.target.sourceEvent == null) return;
    const resolved = action.target?.taskCount != null ? (action.target.sourceEvent ?? null) : (action.target ?? null);
    const stillExists = !resolved || findEventInModel(swim.value, resolved.id) != null;
    if (stillExists) onSelect(resolved);
    return;
  }
  // Edge case: lane no longer exists or is non-leaf → dismiss without action.
  const lane = swim.value ? findThreadById(swim.value, action.laneId) : null;
  if (!lane || isFolderNode(lane)) return;
  if (viewState.value.pinnedLaneIds.includes(action.laneId)) onUnpinLane(action.laneId);
  else onPinLane(action.laneId);
}
function onScrollY(scrollY: number) {
  // Only dismiss when open — ordinary wheel scroll-y must not clear hoveredEventId
  // (canvas does not re-emit hover on wheel).
  if (contextMenuContext.value) onContextMenuDismiss();
  viewState.value = { ...viewState.value, scrollY: Math.max(0, scrollY) };
}

function onPan(deltaTime: number) {
  stopViewWindowAnim();
  viewState.value = applyWindow(
    viewState.value,
    panBy(viewState.value, deltaTime, bounds.value),
  );
}

function onZoom(factor: number, anchorTime: number) {
  stopViewWindowAnim();
  viewState.value = applyWindow(
    viewState.value,
    zoomAt(viewState.value, factor, anchorTime, bounds.value),
  );
}

function onZoomToFit() {
  animateToWindow(zoomToFitWindow(swim.value));
}

const htmlExportAvailable = computed(
  () => props.allowHtmlExport === true && props.source != null,
);

const htmlExportOpen = ref(false);
const htmlExportBusy = ref(false);
const htmlExportError = ref<string | null>(null);
let htmlExportAbort: AbortController | null = null;
let htmlExportGeneration = 0;

function closeHtmlExportDialog() {
  htmlExportAbort?.abort();
  htmlExportAbort = null;
  htmlExportGeneration += 1;
  htmlExportOpen.value = false;
  htmlExportBusy.value = false;
  htmlExportError.value = null;
}

function downloadHtmlFile(html: string, fileName: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke so the download can start (same-turn revoke flakes in some browsers).
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function onExportHtml() {
  const raw = props.source;
  if (!raw || htmlExportBusy.value) return;
  htmlExportError.value = null;
  htmlExportOpen.value = true;
  htmlExportBusy.value = true;
  const gen = ++htmlExportGeneration;
  const ac = new AbortController();
  htmlExportAbort = ac;
  await nextTick();
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  const reportName = props.reportMeta?.name ?? props.title ?? 'report.npu-rep';
  const fileName = htmlExportFileName(reportName);
  try {
    const res = await fetch(props.htmlExportTemplateUrl, { signal: ac.signal });
    if (gen !== htmlExportGeneration) return;
    if (!res.ok) {
      throw new Error(`HTML export template HTTP ${res.status} (${props.htmlExportTemplateUrl})`);
    }
    const template = await res.text();
    if (gen !== htmlExportGeneration) return;
    const html = stitchHtmlReport(
      template,
      bytes,
      reportName,
      props.locale,
      resolvedSourceTexts.value,
    );
    if (gen !== htmlExportGeneration) return;
    downloadHtmlFile(html, fileName);
    emit('export-html', { fileName });
    htmlExportOpen.value = false;
  } catch (cause) {
    if (ac.signal.aborted || gen !== htmlExportGeneration) return;
    const message = cause instanceof Error ? cause.message : String(cause);
    htmlExportError.value = message;
  } finally {
    if (gen === htmlExportGeneration) {
      htmlExportBusy.value = false;
      htmlExportAbort = null;
    }
  }
}

function onZoomIn() {
  const mid = (viewState.value.startTime + viewState.value.endTime) / 2;
  onZoom(1.25, mid);
}

function onZoomOut() {
  const mid = (viewState.value.startTime + viewState.value.endTime) / 2;
  onZoom(1 / 1.25, mid);
}

function onZoomPercent(pct: number) {
  stopViewWindowAnim();
  const full = bounds.value.maxTime - bounds.value.minTime;
  const span = spanFromZoomPercent(pct, full);
  const mid = (viewState.value.startTime + viewState.value.endTime) / 2;
  let startTime = mid - span / 2;
  let endTime = mid + span / 2;
  if (startTime < bounds.value.minTime) {
    startTime = bounds.value.minTime;
    endTime = startTime + span;
  }
  if (endTime > bounds.value.maxTime) {
    endTime = bounds.value.maxTime;
    startTime = endTime - span;
  }
  viewState.value = applyWindow(viewState.value, {
    startTime,
    endTime,
    scrollY: viewState.value.scrollY,
  });
}

function onSearch(q: string) {
  viewState.value = { ...viewState.value, searchQuery: q };
}

function onAside(visible: boolean) {
  viewState.value = { ...viewState.value, asideVisible: visible };
}

/**
 * Topology 全屏 comparison (PR-ROOT-051): the fullscreen panel is mounted from a
 * one-shot current-model snapshot, so its baseline comes from the same active
 * payload the aside compares against. Scope mirrors the stacked aside's rule:
 * All reads the pack's adapter snapshot; ArchDiagram rebuilds from the pack's
 * own ArchDiagramMetrics with the shared metric mode (its snapshot is always
 * the default `*_gbs`). `null` without a payload.
 */
/** The aside-resolved baseline topology for the 全屏 overlay, carried by the
 * open-topology-fullscreen emit: the aside is the only place that resolves
 * the baseline pack's Operator pick and block scope, so the fullscreen paints
 * exactly the comparison the stacked diagram paints (PR-ROOT-051). A Metric
 * switch re-reads the aside's LIVE models (topology / baseline / rows) instead
 * of rebuilding from CSV bytes — the pack's default operator is not
 * necessarily the row's picked one, and the block scope lives only there. */
const fullscreenBaselineTopology = ref<MemoryTopologyModel | null>(null);
/** Every comparison row's topology in the same scope, for the badge hover popup
 *  of the 全屏 diagram (the aside resolves them and hands them over). */
const fullscreenBaselineRows = ref<{ label: string; model: MemoryTopologyModel }[]>([]);

/**
 * The picker's checkbox set IS the baseline list (host-owned, one view). The
 * root adds two rules on top (review PR #234):
 *
 * 1. Invariant: the selection can never point at a baseline that is not in
 *    the list — an uncheck of the selected report clears it.
 * 2. Default row: a checked set with no rows always gets ONE comparison row —
 *    the just-added baseline, else the first. The watcher runs `immediate`,
 *    so a host-restored non-empty list with no rows mounts with that default
 *    row (PR-ROOT-052); an add onto a non-empty list does not add another row
 *    (the aside's `+` is the user's explicit way to add one).
 */
/** Stable ids for root-created rows (the aside's `+` creates its own). Derived
 *  from the host-owned rows: the aside remounts on close/open while the rows
 *  live on, so a per-mount counter could reuse an id. */
function nextBaselineRowId(): string {
  const used = new Set((props.baselineRows ?? []).map((r) => r.id));
  let seq = (props.baselineRows ?? []).length + 1;
  while (used.has(`brow-${seq}`)) seq += 1;
  return `brow-${seq}`;
}

watch(
  () => [props.baselines, props.baselineRows] as const,
  ([list, rows], oldPair) => {
    const items = list ?? [];
    const current = rows ?? [];
    // Invariant: a row can only reference a checked baseline (an uncheck
    // removes its rows; the remaining checked set keeps at least one).
    const kept = current.filter((r) => items.some((b) => b.id === r.baselineId));
    if (kept.length !== current.length) {
      emit('update:baselineRows', kept);
      return;
    }
    // The design's default: with any baseline checked there is always at least
    // one comparison row (基线1), defaulting to the added/first baseline.
    if (items.length > 0 && kept.length === 0) {
      const prev = oldPair?.[0] ?? [];
      const added = items.find((b) => !prev.some((p) => p.id === b.id));
      emit('update:baselineRows', [
        { id: nextBaselineRowId(), baselineId: (added ?? items[0])!.id, operatorId: '' },
      ]);
    }
  },
  { immediate: true },
);

/** The aside's Baseline / Operator bar was pressed: close the baselines
 * popover (review PR #234 — the bar stops pointerdown, so the popover's own
 * outside-dismiss never sees those clicks). */
function onBaselineBarDown() {
  toolbarRef.value?.closeBaselinesPicker();
}

/**
 * StatsAside title-row 性能分析 trigger → environment-routed (`environments.ts`).
 *
 * `vscode`: hand the request to the host (`open-performance-hints-in-problems`) and leave
 * the dock alone — the host reveals its own Problems diagnostics.
 *
 * `browser`: mount the hints table in the bottom dock. The pane is the dock content chain's
 * last branch, so an open DetailPanel / MultiSelectSummary would swallow the trigger.
 * Release the live marquee first (`clearMarqueeLive` drops dockSnap, the marquee flags and
 * the preview throttle), then the committed selection through `onSelect(null)` — the same
 * path the canvas uses; it clears selected / multiSelected / the Δt span / viewState and
 * notifies the host `select(null)` ("no single selection").
 */
function onOpenPerformanceHints() {
  if (environmentBehavior.value.performanceHintsTarget === 'problems') {
    emit('open-performance-hints-in-problems');

    return;
  }

  clearMarqueeLive();
  onSelect(null);
  hintsDockOpen.value = true;
}

/** cannbot 防抖（所有图标共享一把 1s 冷却锁）：首击立即触发，窗口内的后续点击（误操作连点）不再 emit。 */
const CANNBOT_EMIT_COOLDOWN_MS = 1000;

const emitCannbot = cooldown(
  (scope: CannbotScope) =>
    emit('cannbot-request', buildCannbotPayload(scope, report.value, props.reportMeta)),
  CANNBOT_EMIT_COOLDOWN_MS,
);

/* R9 防连点：本次新增的全部用户按钮沿用同一把 1s 冷却锁（首击放行，冷却期内忽略重复点击）。 */
const emitCannbotStop = cooldown(
  (scope: CannbotScope) => emit('open-cannbot-stop', scope),
  CANNBOT_EMIT_COOLDOWN_MS,
);

const emitCannbotReference = cooldown(
  (scope: CannbotScope) => emit('cannbot-reference', scope),
  CANNBOT_EMIT_COOLDOWN_MS,
);

const emitCannbotView = cooldown(
  (scope: CannbotScope) => emit('cannbot-view', scope),
  CANNBOT_EMIT_COOLDOWN_MS,
);

const emitPerformOptimization = cooldown(
  (opName?: string) => emit('perform-optimization', {
    report_path: props.reportMeta?.path ?? '',
    op_name: opName ?? report.value?.summary.opName ?? '',
  }),
  CANNBOT_EMIT_COOLDOWN_MS,
);

const emitOpenCannwork = cooldown(
  () => emit('open-cannwork'),
  CANNBOT_EMIT_COOLDOWN_MS,
);

function onMeasureMode(enabled: boolean) {
  viewState.value = setMeasureMode(viewState.value, enabled);
}

function onMeasureRange(range: MeasureRange | null) {
  viewState.value = setMeasureRange(viewState.value, range);
}

function onTimeDisplayMode(mode: TimeDisplayMode) {
  localTimeDisplayMode.value = mode;
}

function onDependencyMode(mode: DependencyMode) {
  localDependencyMode.value = mode;
}

function onDependencyDepth(depth: number) {
  localDependencyDepth.value = normalizeDependencyDepth(depth);
}

/**
 * Detail-dock neighbours of the selection, walked over the same
 * `SwimEvent.dependencies` refs the swimlane curves use, with the same mode and
 * depth. The cheap `hasDependencies` scan gates it so reports with no edges never
 * pay for the lane index.
 *
 * `undefined` (not an empty pair) so DetailPanel hides the column entirely.
 */
const dependencyNeighbors = computed(() => {
  const ev = selectedEvent.value;
  if (!ev || !hasDependencies(swim.value)) return undefined;
  // One hop: the dock lists what this event directly waits on and feeds. Depth is a
  // 显示控制 setting for the swimlane graph and deliberately does not reach here.
  return neighborsOf(swim.value, ev, localDependencyMode.value, DEFAULT_DEPENDENCY_DEPTH);
});

/** Used by component tests to select an event without canvas pointer geometry. */
function selectEventById(eventId: string) {
  const ev = swim.value
    ? collectLeafEventsFromModel(swim.value).find((e) => e.id === eventId)
    : undefined;
  onSelect(ev ?? null);
}

defineExpose({ selectEventById, viewState, selectedOperatorId });
</script>

<template>
  <div
    class="pr-root"
    data-testid="profiling-report"
    :data-theme="theme ?? 'dark'"
    :data-capabilities="caps.join(',')"
  >
    <ReportToolbar
      v-if="loadError || (!showTimeline && !showSource && !showOverviewTab)"
      ref="toolbarRef"
      :search-query="viewState.searchQuery"
      :aside-visible="viewState.asideVisible"
      :aside-available="asideAvailable"
      :zoom-percent="zoomPercent"
      :time-display-mode="localTimeDisplayMode"
      :clock-freq-m-hz="clockFreqMHz"
      :dependency-mode="localDependencyMode"
      :dependency-depth="localDependencyDepth"
      :locale="locale"
      :measure-mode="viewState.measureMode"
      :operators="operators"
      :selected-operator-id="selectedOperatorId"
      :timeline-traces="timelineTraces"
      :selected-timeline-trace-id="selectedTimelineTraceId"
      :user-guide-url="userGuideUrl"
      :active-tab="activeTab"
      :source-tab-enabled="sourceTabEnabled"
      :overview-tab-enabled="overviewTabEnabled"
      :hide-tabs="compareOnly"
      :html-export-available="htmlExportAvailable"
      :baselines="baselines"
      :pick-baseline-file="pickBaselineFile"
      :recent-baselines="recentBaselines"
      @update:search-query="onSearch"
      @update:selected-operator-id="onOperatorChange"
      @update:selected-timeline-trace-id="onTimelineTraceChange"
      @update:aside-visible="onAside"
      @update:time-display-mode="onTimeDisplayMode"
      @update:dependency-mode="onDependencyMode"
      @update:dependency-depth="onDependencyDepth"
      @update:zoom-percent="onZoomPercent"
      @update:measure-mode="onMeasureMode"
      @update:active-tab="onActiveTab"
      @zoom-to-fit="onZoomToFit"
      @zoom-in="onZoomIn"
      @zoom-out="onZoomOut"
      @open-cannwork="emitOpenCannwork"
      @open-user-guide="emit('open-user-guide', $event)"
      @export-html="onExportHtml"
      @update:baselines="emit('update:baselines', $event)"
    />

    <p
      v-if="loadError"
      class="pr-error"
      data-testid="load-error"
    >
      {{ loadError }}
    </p>

    <ReportLayout
      v-else-if="showTimeline || showAside || showSource || showOverviewTab"
      ref="layoutRef"
      :show-aside="showAside && !showSource && !showOverviewTab"
      :aside-width="asideWidth"
      :locale="locale"
      @update:aside-width="onAsideWidth"
    >
      <template #main>
        <ReportToolbar
          v-if="showTimeline || showSource || showOverviewTab"
          ref="toolbarRef"
          :search-query="viewState.searchQuery"
          :aside-visible="viewState.asideVisible"
          :aside-available="asideAvailable"
          :zoom-percent="zoomPercent"
          :time-display-mode="localTimeDisplayMode"
          :clock-freq-m-hz="clockFreqMHz"
          :dependency-depth="localDependencyDepth"
          :locale="locale"
          :measure-mode="viewState.measureMode"
          :operators="operators"
          :selected-operator-id="selectedOperatorId"
          :timeline-traces="timelineTraces"
          :selected-timeline-trace-id="selectedTimelineTraceId"
          :user-guide-url="userGuideUrl"
          :active-tab="activeTab"
          :source-tab-enabled="sourceTabEnabled"
          :overview-tab-enabled="overviewTabEnabled"
          :hide-tabs="compareOnly"
          :compare-mode="compareMode"
          :compare-available="compareAvailable && sourceTabEnabled"
          :primary-baseline-id="compareBaselineId"
          :compare-operators="compareOperators"
          :compare-operator-id="compareSelectedOperatorId"
          :compare-search-query="compareSearchQuery"
          :html-export-available="htmlExportAvailable"
          :baselines="baselines"
          :pick-baseline-file="pickBaselineFile"
          :recent-baselines="recentBaselines"
          @update:search-query="onSearch"
          @update:selected-operator-id="onOperatorChange"
          @update:selected-timeline-trace-id="onTimelineTraceChange"
          @update:aside-visible="onAside"
          @update:time-display-mode="onTimeDisplayMode"
          @update:dependency-depth="onDependencyDepth"
          @update:zoom-percent="onZoomPercent"
          @update:measure-mode="onMeasureMode"
          @update:active-tab="onActiveTab"
          @update:primary-baseline-id="onCompareBaselineChange"
          @update:compare-operator-id="onCompareOperatorChange"
          @update:compare-search-query="compareSearchQuery = $event"
          @compare-enter="enterCompareMode"
          @compare-exit="onCompareExit"
          @compare-find-next="sourceDiffRef?.findNext()"
          @compare-find-prev="sourceDiffRef?.findPrev()"
          @compare-find-search="sourceDiffRef?.findSearch(1)"
          @compare-nav-highest="sourceDiffRef?.navHighest()"
          @compare-nav-lowest="sourceDiffRef?.navLowest()"
          @compare-sort-asc="sourceDiffRef?.sortAsc()"
          @compare-sort-desc="sourceDiffRef?.sortDesc()"
          @zoom-to-fit="onZoomToFit"
          @zoom-in="onZoomIn"
          @zoom-out="onZoomOut"
          @open-cannwork="emitOpenCannwork"
          @open-user-guide="emit('open-user-guide', $event)"
          @export-html="onExportHtml"
          @update:baselines="emit('update:baselines', $event)"
        />
        <OperatorOverview
          v-if="showOverviewTab"
          :rows="report?.operatorRows ?? []"
          :pipe-occupancy="report?.pipeOccupancy ?? []"
          :locale="locale"
          :selected-operator-id="selectedOperatorId ?? undefined"
          @update:selected-operator-id="onOperatorChange"
          @open-timeline="onActiveTab('timeline')"
          @optimize="emitPerformOptimization($event.opName)"
        />
        <SourceDiffView
          v-if="showSource && report && report.sourceCorrelation && compareMode"
          ref="sourceDiffRef"
          :current="report.sourceCorrelation"
          :baseline="compareBaselineModel ?? undefined"
          :locale="locale"
          :sudu-worker-url="suduWorkerUrl"
          :search-query="compareSearchQuery"
          :current-workspace-available="reportSourceNeedsResolve && pickSourceWorkspace != null"
          :baseline-workspace-available="baselineWorkspaceAvailable"
          @exit="onCompareExit"
          @pick-current-workspace="onPickReportSourceWorkspace"
          @pick-baseline-workspace="onPickBaselineSourceWorkspace"
        />
        <SourceView
          v-else-if="showSource && report?.sourceCorrelation"
          :model="report.sourceCorrelation"
          :session="sourceSession"
          :focus="sourceFocus"
          :locale="locale"
          :sudu-worker-url="suduWorkerUrl"
          :user-guide-url="userGuideUrl"
          :workspace-available="reportSourceNeedsResolve && pickSourceWorkspace != null"
          @open-user-guide="emit('open-user-guide', $event)"
          @pick-workspace="onPickReportSourceWorkspace"
        />
        <TimelineView
          v-if="showTimelineSurface"
          ref="timelineRef"
          :bounds="bounds"
          :view="viewState"
          :time-scale-unit="viewportTimeScaleUnit"
          :dependency-mode="localDependencyMode"
          :dependency-depth="localDependencyDepth"
          :groups="laneGroups"
          :collapsed-ids="visualCollapsedIds"
          :pinned-lane-ids="viewState.pinnedLaneIds"
          :pinned-overview-ids="viewState.pinnedOverviewIds"
          :display-swim="displaySwim"
          :pin-source-model="swim"
          :collapse-anim="collapseAnim"
          :cursor="cursor"
          :multi-select-span="multiSelectSpan"
          :show-overview-charts="showOverview"
          :overview-series="report?.overviewSeries ?? []"
          :gutter-width="gutterWidth"
          :gutter-metric-by-card="gutterMetricByCard"
          :gutter-metric-options-by-card="gutterMetricOptionsByCard"
          :prefer-renderer="preferRenderer ?? 'auto'"
          :locale="locale"
          @update:gutter-width="onGutterWidth"
          @update:scroll-y="onScrollY"
          @update:window="onOverviewWindow"
          @toggle-group="onToggleGroup"
          @pin-lane="onPinLane"
          @unpin-lane="onUnpinLane"
          @pin-overview="onPinOverview"
          @unpin-overview="onUnpinOverview"
          @update:gutter-metric="onGutterMetricChange"
          @select="onSelect"
          @multi-select="onMultiSelect"
          @multi-select-preview="onMultiSelectPreview"
          @multi-select-span="onMultiSelectSpan"
          @hover="onHover"
          @cursor="onCursor"
          @set-playhead="onSetPlayhead"
          @pan="onPan"
          @zoom="onZoom"
          @update:measure-range="onMeasureRange"
          @focus-measure="onFocusMeasure"
          @context-menu="onContextMenu"
          @hover-lane="onHoverLane"
        />
        <ContextMenu
          :context="contextMenuContext"
          :pinned-lane-ids="viewState.pinnedLaneIds"
          :can-pin="contextMenuCanPin"
          :can-reset="contextMenuCanReset"
          :locale="locale"
          @action="onContextMenuAction"
          @dismiss="onContextMenuDismiss"
        />
        <p
          v-if="!showTimeline && !showOverviewTab && !compareOnly"
          class="pr-error"
          data-testid="no-timeline"
        >
          {{ t('noTimeline', locale) }}
        </p>
      </template>

      <template #aside>
        <StatsAside
          ref="asideRef"
          v-model:arch-metric-mode="archMetricMode"
          :report="report"
          :locale="locale"
          :capabilities="caps"
          :baselines="baselines ?? []"
          :baseline-rows="baselineRows ?? []"
          :baseline-reports="baselineReports ?? {}"
          :cannbot-sessions="cannbotSessions"
          @update:baseline-rows="emit('update:baselineRows', $event)"
          @close="onAside(false)"
          @view-full-csv="emit('view-full-csv', $event)"
          @open-hardware-details="emit('open-hardware-details')"
          @open-pipe-details="emit('open-pipe-details')"
          @open-cannbot="emitCannbot"
          @open-cannbot-stop="emitCannbotStop"
          @cannbot-reference="emitCannbotReference"
          @cannbot-view="emitCannbotView"
          @perform-optimization="emitPerformOptimization"
          @open-topology-fullscreen="onOpenTopologyFullscreen"
          @open-performance-hints="onOpenPerformanceHints"
          @baseline-bar-down="onBaselineBarDown"
        />
      </template>
    </ReportLayout>

    <!-- Persistent dock shell: single/multi/empty swap content, not the container.
         Live marquee from a closed dock uses slack-based preview height toward the
         session target (collapsed or expanded); commit grows to that session height.
         From closed, mount only once coverage is non-empty (marqueeLive alone is not enough). -->
    <Transition name="pr-dock">
      <footer
        v-if="(showTimelineSurface && (selected || multiSelected.length || (marqueeLive && livePreviewCount >= 2) || (marqueeLive && !marqueeFromClosed))) || (hintsDockOpen && hasPerformanceHints && !showSource && !showOverviewTab)"
        class="pr-dock"
        :class="{ 'pr-dock--live': marqueeLive }"
        data-testid="dock"
        :style="{ '--pr-dock-h': `${dockDisplayHeight}px` }"
      >
        <Transition
          name="pr-dock-content"
          mode="out-in"
        >
          <MultiSelectSummary
            v-if="(marqueeLive && livePreviewCount >= 2) || (!marqueeLive && multiSelected.length) || (marqueeLive && multiSelected.length >= 2)"
            key="multi"
            :selected-events="multiSelected"
            :model="swim"
            :locale="locale"
            :height="dockDisplayHeight"
            :expanded="dockSessionExpanded"
            :live-preview="marqueeLive"
            :live-count="marqueeLive ? livePreviewCount : undefined"
            :dimmed="multiSelectDimmed"
            @close="onSelect(null)"
            @select-single="onSelect"
            @update:height="dockHeight = $event"
          />
          <DetailPanel
            v-else-if="selected"
            key="single"
            :selected="selected as SelectedEvent"
            :time-display-mode="localTimeDisplayMode"
            :clock-freq-m-hz="clockFreqMHz"
            :time-origin="bounds.minTime"
            :ns-per-px="nsPerPx"
            :locale="locale"
            :neighbors="dependencyNeighbors"
            :dependency-mode="localDependencyMode"
            :source-files="sourceTabEnabled ? report?.sourceCorrelation?.files : undefined"
            :height="dockDisplayHeight"
            :expanded="dockSessionExpanded"
            @close="onSelect(null)"
            @update:height="dockHeight = $event"
            @update:dependency-mode="onDependencyMode"
            @open-source="onOpenSource"
          />
          <PerformanceHintsDock
            v-else-if="hintsDockShown"
            key="hints"
            :rows="performanceHints"
            :locale="locale"
            :height="dockDisplayHeight"
            @close="hintsDockOpen = false"
            @update:height="dockHeight = $event"
          />
          <div
            v-else
            key="empty"
            class="pr-dock-empty"
            data-testid="dock-empty"
          >
            {{ t('nothingSelected', locale) }}
          </div>
        </Transition>
      </footer>
    </Transition>

    <Transition
      name="pr-topo-fs"
      @after-leave="onTopologyFullscreenAfterLeave"
    >
      <div
        v-if="topologyFullscreen && (fullscreenTopology || isArchDiagram)"
        class="pr-topo-fs"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pr-topo-fs-title"
        data-testid="topology-fullscreen-overlay"
      >
        <div class="pr-topo-fs__head">
          <button
            ref="fullscreenBackRef"
            type="button"
            class="pr-topo-fs__back"
            data-testid="topology-fullscreen-back"
            :aria-label="t('back', locale)"
            :title="t('back', locale)"
            @click="closeTopologyFullscreen"
          >
            <svg
              viewBox="0 0 16 16"
              width="14"
              height="14"
              aria-hidden="true"
            >
              <path
                d="M10 3.5L4.5 8 10 12.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M5 8h8"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <h3 id="pr-topo-fs-title">
            {{ t('memoryTopology', locale) }}
          </h3>
        </div>
        <div
          class="pr-topo-fs__body"
          :class="{ 'pr-topo-fs__body--split': showHeatPanel }"
        >
          <div class="pr-topo-fs__diagram">
            <div
              v-if="isArchDiagram"
              class="pr-topo-fs__metric"
              data-testid="topology-fullscreen-metric-switcher"
            >
              <span>{{ t('metric', locale) }}</span>
              <CardMetricSelect
                v-model="archMetricMode"
                :options="archMetricModes"
                variant="inline"
                test-id-prefix="topology-fs-metric"
                :ariaLabel="t('archMetricMode', locale)"
                :label-of="(m) => archMetricModeLabel(m, locale)"
              />
            </div>
            <MemoryTopologyPanel
              v-if="fullscreenTopology"
              :model="fullscreenTopology"
              :baseline="fullscreenBaselineTopology"
              :baseline-rows="fullscreenBaselineRows"
              :locale="locale"
              :open-details-on-contextmenu="false"
              :selectable-units="hasMemoryHeatmap"
              :selected-unit="activeMemoryUnit"
              wheel-gestures
              @open-memory-unit="onSelectMemoryUnit"
            />
          </div>
          <!-- §11.2.3.2 heat panel: the overlay's right column, one selection with the diagram. -->
          <MemoryHeatmapPanel
            v-if="showHeatPanel"
            class="pr-topo-fs__heat"
            :model="memoryHeatmap"
            :selected-unit="activeMemoryUnit"
            :locale="locale"
            @select-unit="onSelectMemoryUnit"
          />
        </div>
      </div>
    </Transition>

    <div
      v-if="htmlExportOpen"
      class="pr-export-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pr-export-modal-title"
      data-testid="html-export-dialog"
    >
      <div class="pr-export-modal__card">
        <h3
          id="pr-export-modal-title"
          class="pr-export-modal__title"
        >
          {{ htmlExportError ? t('exportHtmlFailed', locale) : t('exportHtmlPreparing', locale) }}
        </h3>
        <div
          v-if="!htmlExportError"
          class="pr-export-modal__bar"
          data-testid="html-export-progress"
        />
        <p
          v-else
          class="pr-export-modal__error"
          data-testid="html-export-error"
        >
          {{ htmlExportError }}
        </p>
        <button
          type="button"
          class="pr-export-modal__cancel"
          data-testid="html-export-cancel"
          @click="closeHtmlExportDialog"
        >
          {{ htmlExportError ? t('closePanel', locale) : t('exportHtmlCancel', locale) }}
        </button>
      </div>
    </div>

    <EventTooltip
      v-if="hovered && showTimelineSurface"
      :event="hovered"
      :style-pos="tooltipStyle"
      :time-display-mode="localTimeDisplayMode"
      :clock-freq-m-hz="clockFreqMHz"
      :time-origin="bounds.minTime"
      :ns-per-px="nsPerPx"
      :locale="locale"
    />
  </div>
</template>

<style scoped>
.pr-root {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  height: 100%;
  min-height: 240px;
  padding: 0;
  color: #e8e8e8;
  background: var(--pr-bg-deep);
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 12px;
  overflow: hidden;
}

.pr-error {
  margin: 0;
  padding: 6px 10px;
  color: #f88;
  flex: 0 0 auto;
}

.pr-dock {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  position: relative;
  /* Above `.pr-main` (z-index: 1 in ReportLayout) so the full-height cursor
     playhead (CursorTimestamp, `height: 100vh`) paints *under* the dock, not over it. */
  z-index: 2;
  box-sizing: border-box;
  height: min(var(--pr-dock-h), 60vh);
  background: var(--pr-bg-panel, #262626);
  border-top: 1px solid #3a3a3a;
  border-radius: 16px 16px 0 0;
  overflow: hidden;
  transition: height 200ms ease;
}

.pr-dock--live {
  /* Live preview swaps content; keep shell height stable (no expander fight). */
  transition: none;
}

/* Live enter: opacity only — height is already the precomputed preview; a height
   tween would shrink the wrap mid-animation and re-feed the slack math. */
.pr-dock--live.pr-dock-enter-active {
  transition: opacity 200ms ease;
}

.pr-dock > * {
  flex: 1 1 auto;
  min-height: 0;
}

.pr-dock-empty {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  min-height: 0;
  padding: 0 16px;
  color: #a8a8a8;
  font-size: 12px;
}

.pr-dock-content-enter-active,
.pr-dock-content-leave-active {
  transition: opacity 180ms ease;
}

.pr-dock-content-enter-from,
.pr-dock-content-leave-to {
  opacity: 0;
}

/* Enter grows height in-flow (timeline shrinks with the visible panel — no empty
   flex slot / black hole under a translateY-hidden full-height dock). */
.pr-dock-enter-active {
  transition:
    height 200ms ease,
    opacity 200ms ease;
}

.pr-dock-enter-from {
  height: 0;
  opacity: 0;
}

/* Leave slides away while absolute so flex space frees immediately (PR-E2E-013). */
.pr-dock-leave-active {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 4;
  transition:
    transform 200ms ease,
    opacity 200ms ease;
}

.pr-dock-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pr-dock {
    transition: none;
  }
  .pr-dock-enter-active,
  .pr-dock-leave-active,
  .pr-dock-content-enter-active,
  .pr-dock-content-leave-active {
    transition: none;
  }
}

.pr-topo-fs {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  padding: 10px 12px;
  /* Sketch fullscreen ground is literal `#1a1a1a` (dark-only chrome, like `.pr-heat` / `.pr-topo`). */
  background: #1a1a1a;
  overflow: hidden;
}

.pr-topo-fs-enter-active,
.pr-topo-fs-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}

/* Leave still mounts the overlay for 200ms — do not swallow clicks meant for the report. */
.pr-topo-fs-leave-active {
  pointer-events: none;
}

.pr-topo-fs-enter-from,
.pr-topo-fs-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .pr-topo-fs-enter-active,
  .pr-topo-fs-leave-active {
    transition: none;
  }
}

.pr-topo-fs__head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}

.pr-topo-fs__head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #ffffff;
}

.pr-topo-fs__back {
  appearance: none;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #e6e6e6;
  line-height: 0;
  cursor: pointer;
}

.pr-topo-fs__back:hover {
  color: #ffffff;
}

.pr-topo-fs__body {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* §11.2.3.2: the heat panel takes the overlay's right column, the diagram keeps the rest.
 * 16px gap ≈ sketch breathing room between the zoom pill and the heat card (~28px at 1× on the
 * 1030 frame; 16 keeps the columns close without kissing). */
.pr-topo-fs__body--split {
  flex-direction: row;
  gap: 16px;
}

.pr-topo-fs__diagram {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* §11.2.3.2: the heat panel takes the overlay's right column, the diagram keeps the rest. The frame
 * draws no rule between the two — the panel's own `#262626` surface is the separation against the
 * overlay's `#1a1a1a` (diagram side has no grey card of its own). */
.pr-topo-fs__heat {
  /* Sketch panel is ~398px at 1× (v930-sim/memory-topology-fullscreen); 400 keeps that band. */
  flex: 0 0 400px;
  min-height: 0;
  /* Same element as `.pr-heat`: height-bounded so the lattice can size down (PR-HEAT-011). */
  align-self: stretch;
  overflow: hidden;
}

.pr-topo-fs__metric {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 0 0 auto;
  margin: 0 0 8px;
  font-size: 11px;
  color: #b8b8b8;
}

.pr-topo-fs__body :deep(.pr-topo) {
  flex: 1 1 auto;
  height: auto;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  /* Stacked aside keeps the `#262626` card; fullscreen sits on the overlay ground so only the
   * heat column reads as a grey panel (v930-sim/memory-topology-fullscreen). Drop the aside's
   * 6px pad so the zoom pill's bottom lines up with the heat card (1030 sketch). */
  background: transparent;
  padding: 0;
  border-radius: 0;
}

/* Fill the leftover box (wide host). The panel's own frame keeps `aspect-ratio` in the stacked
 * aside, where the card is already ~chrome ratio; here the leftover is much wider, so the frame
 * must take the flex height instead. Stage size still comes from `100cqh` (PR-MEMTOP-013b). */
.pr-topo-fs__body :deep(.pr-topo__frame) {
  flex: 1 1 auto;
  min-height: 0;
  aspect-ratio: auto;
}

/* Wide host letterboxes the chrome-ratio stage. When a classic *vertical* bar appears it eats
 * inline space and `margin-inline: auto` re-centres the stage — a horizontal jump. Always reserve
 * that lane with `scrollbar-gutter: stable` and keep `overflow: auto` so the gutter is present at
 * 100% too (content does not overflow the wide leftover at fit, so no stray thumb). The stacked
 * aside leaves the panel's own overflow:hidden-at-fit rule: there the stage fills the width and
 * the same jump does not show. */
.pr-topo-fs__body :deep(.pr-topo__viewport),
.pr-topo-fs__body :deep(.pr-topo__viewport--pannable) {
  overflow: auto;
  scrollbar-gutter: stable;
}

/* No `svg` override here: the panel's stage is already the diagram's box (448:423 at the current
 * zoom), and the panel sizes the `svg` to it. Sizing the `svg` to the leftover box instead — the
 * old `width/height: 100%` — fills the stage's *used* box rather than the chrome ratio, and only
 * agreed with it while the stage happened to be that ratio. */

/* Fullscreen drops the aside's `#313131` strip (PR-MEMTOP-014) but keeps a grey pill — sketch
 * `#262626` on the darker overlay ground, same `8px` corner as the heat card. Bar stays in the
 * diagram column (`align-self: flex-end`) — left of the heat panel, bottoms flush (1030). */
.pr-topo-fs__body :deep(.pr-topo__bar) {
  background: #262626;
  border-radius: 8px;
}

.pr-export-modal {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}

.pr-export-modal__card {
  box-sizing: border-box;
  min-width: 280px;
  max-width: min(420px, calc(100% - 32px));
  padding: 20px 22px 18px;
  border: 1px solid #5e5e5e;
  border-radius: 12px;
  background: #363636;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
}

.pr-export-modal__title {
  margin: 0 0 14px;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
}

.pr-export-modal__bar {
  height: 4px;
  margin: 0 0 16px;
  overflow: hidden;
  border-radius: 2px;
  background: #1a1a1a;
}

.pr-export-modal__bar::after {
  content: '';
  display: block;
  width: 40%;
  height: 100%;
  background: #2d70e3;
  animation: pr-export-indeterminate 1.1s ease-in-out infinite;
}

@keyframes pr-export-indeterminate {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(280%);
  }
}

.pr-export-modal__error {
  margin: 0 0 16px;
  font-size: 12px;
  line-height: 1.4;
  color: #f87171;
  white-space: pre-wrap;
}

.pr-export-modal__cancel {
  display: block;
  margin-left: auto;
  padding: 6px 12px;
  border: 0;
  border-radius: 6px;
  background: #404040;
  color: #e6e6e6;
  font-size: 12px;
  cursor: pointer;
}

.pr-export-modal__cancel:hover {
  background: #1e2a3e;
  color: #ffffff;
}
</style>
