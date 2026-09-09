<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch } from 'vue';
import { loadReportSource } from '../../adapters';
import {
  applyWindow,
  clearMeasure,
  createViewState,
  keyboardPanStepTime,
  measureFocusWindow,
  panBy,
  pinLane,
  setMeasureMode,
  setMeasureRange,
  spanFromZoomPercent,
  unpinLane,
  zoomAt,
  zoomPercentFromSpan,
  zoomToFitWindow,
} from '../../domain/viewState';
import {
  DEFAULT_DEPENDENCY_DEPTH,
  normalizeDependencyDepth,
  type AdaptedReport,
  type DependencyMode,
  type MeasureRange,
  type MemoryTopologyModel,
  type ReportCapability,
  type ReportOperator,
  type ReportViewModel,
  type SelectedEvent,
  type SwimEvent,
  type SwimlaneModel,
  type SwimlaneViewState,
  type SwimThread,
  type TimeScaleUnit,
  type TimeDisplayMode,
  type ViewFullCsvPayload,
} from '../../domain/types';
import { buildCannbotPayload } from '../../domain/cannbot';
import type { CannbotPayload, CannbotReportMeta, CannbotScope } from '../../domain/cannbot';
import { hasDependencies, neighborsOf } from '../../domain/dependencies';
import { resolveTimeUnitFromVisibleRange, resolveClockFreqMHz } from '../../domain/formatTime';
import { colorVarForLaneName } from '../../domain/laneColors';
import { leafRowCount } from '../../swimlane/layout';
import {
  buildFolderSummaryEvents,
  collectLeafEventsFromModel,
  filterCollapsedTree,
  findThreadById,
} from '../../domain/swimTree';
import { t } from '../../i18n';
import DetailPanel from '../DetailPanel/DetailPanel.vue';
import EventTooltip from '../EventTooltip/EventTooltip.vue';
import {
  ASIDE_WIDTH_DEFAULT,
  fitPanelWidths,
  GUTTER_WIDTH_DEFAULT,
} from '../panelResize';
import ReportLayout from '../ReportLayout/ReportLayout.vue';
import ReportToolbar from '../ReportToolbar/ReportToolbar.vue';
import StatsAside from '../StatsAside/StatsAside.vue';
import MemoryTopologyPanel from '../StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.vue';
import type { GutterGroup, GutterLane } from '../TimelineView/SwimlaneView/LaneGutter/gutterTypes';
import { animateProgress, animateViewWindow, prefersReducedMotion } from '../TimelineView/animateViewWindow';
import { collapseHiddenHeight, type CollapseAnimState } from '../../swimlane/layout';
import TimelineView from '../TimelineView/TimelineView.vue';
import '../tokens.css';
import {
  availableGutterMetrics,
  averageBarWidthForCard,
  defaultGutterMetric,
  gutterBarsForCard,
  type GutterBarDisplay,
  type GutterMetric,
} from '../../domain/gutterMetrics';
import { DEFAULT_USER_GUIDE_URL } from '../userGuide';

const props = withDefaults(defineProps<{
  title?: string;
  source?: ArrayBuffer | Uint8Array;
  swimlaneModel?: SwimlaneModel;
  reportModel?: ReportViewModel;
  /** cannbot payload 元信息（.rep 文件名 / 绝对路径 / id / 采集时间），宿主提供。 */
  reportMeta?: CannbotReportMeta;
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
}>(), {
  dependencyMode: 'all',
  dependencyDepth: DEFAULT_DEPENDENCY_DEPTH,
  userGuideUrl: DEFAULT_USER_GUIDE_URL,
});

const emit = defineEmits<{
  ready: [];
  select: [event: SelectedEvent | null];
  error: [error: { message: string; cause?: unknown }];
  'view-full-csv': [payload: ViewFullCsvPayload];
  'open-hardware-details': [];
  'open-pipe-details': [];
  'cannbot-request': [payload: CannbotPayload];
  'open-user-guide': [url: string];
}>();

/** Shallow: avoid deep-proxying every swim event (collapse/expand was ~2s on op2). */
const internalSwim = shallowRef<SwimlaneModel | null>(null);
const internalReport = ref<ReportViewModel | null>(null);
const internalCapabilities = ref<ReportCapability[] | null>(null);
const loadError = ref<string | null>(null);
const viewState = ref<SwimlaneViewState>(createViewState(null));
const hovered = ref<SwimEvent | null>(null);
const selected = ref<SelectedEvent | null>(null);
/** Raw model event behind `selected` — the dependency walk needs its EventRefs. */
const selectedEvent = ref<SwimEvent | null>(null);
const tooltipStyle = ref({ left: '0px', top: '0px' });
const localTimeDisplayMode = ref<TimeDisplayMode>(props.timeDisplayMode ?? 'time');
const localDependencyMode = ref<DependencyMode>(props.dependencyMode);
const localDependencyDepth = ref(normalizeDependencyDepth(props.dependencyDepth));
const cursor = ref<{ time: number; xRatio: number; snapped?: boolean } | null>(null);
const timelineRef = ref<{ gutterRoot: HTMLElement | null; trackWidth?: number } | null>(null);
const layoutRef = ref<{ rootEl: HTMLElement | null } | null>(null);
/** Session-only panel sizes (not persisted). User drag updates preferred; fit clamps actual. */
const preferredGutterWidth = ref(GUTTER_WIDTH_DEFAULT);
const preferredAsideWidth = ref(ASIDE_WIDTH_DEFAULT);
const gutterWidth = ref(GUTTER_WIDTH_DEFAULT);
const asideWidth = ref(ASIDE_WIDTH_DEFAULT);
const dockExpanded = ref(false);
const topologyFullscreen = ref(false);
const fullscreenTopology = ref<MemoryTopologyModel | null>(null);
const fullscreenBackRef = ref<HTMLButtonElement | null>(null);
let layoutResizeObserver: ResizeObserver | null = null;
/** Process / group ids with child lanes collapsed in gutter + canvas. */
const collapsedGroupIds = ref<string[]>([]);
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
/** Per-Card gutter metric selection (session-only; reset on report swap). */
const gutterMetricByCard = ref<Record<string, GutterMetric>>({});

/** Raw swim model for all consumers — unwrap host deep-reactive props so deps/gutter/collapse skip Proxies. */
const swim = computed(() => toRaw(props.swimlaneModel ?? internalSwim.value));
const report = computed(() => props.reportModel ?? internalReport.value);
/** Host-managed mode has no adapter to ask, so adapter flags must not survive the switch. */
const hostManaged = computed(() => props.swimlaneModel != null || props.reportModel != null);
/** Host prop wins; otherwise the ones the adapter derived from the loaded source. */
const caps = computed<ReportCapability[]>(() => {
  if (props.capabilities) return props.capabilities;
  if (hostManaged.value) return [];
  return internalCapabilities.value ?? [];
});
const viewportTimeScaleUnit = computed<TimeScaleUnit>(() =>
  resolveTimeUnitFromVisibleRange(viewState.value.endTime - viewState.value.startTime),
);
const clockFreqMHz = computed(() => resolveClockFreqMHz(report.value?.summary));

const showOverview = computed(() => (report.value?.overviewSeries?.length ?? 0) > 0);
/** Toolbar toggle + initial asideVisible share this gate (includes CSV-only reports). */
const asideAvailable = computed(() => reportHasAsideContent(report.value));
const showAside = computed(() => viewState.value.asideVisible && asideAvailable.value);
const showTimeline = computed(() => loadError.value == null && swim.value != null);

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
    let metric = gutterMetricByCard.value[p.id] ?? defaultGutterMetric(avail);
    if (!avail.includes(metric)) metric = defaultGutterMetric(avail);
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
    const metric = gutterMetricByCard.value[p.id] ?? defaultGutterMetric(options);
    const bars = gutterBarsForCard(m, rows, metric, p.id);
    return {
      id: p.id,
      name: p.name,
      utilMidlinePercent: averageBarWidthForCard(bars, metric),
      lanes: lanesWithBars(p.threads, bars),
    };
  });
});

/** Collapse set with the in-flight group forced EXPANDED so the tween can interpolate.
 *  Depends only on `animGroupId` (stable across frames), not `collapseAnim.visible`, so
 *  `displaySwim` stays cached for the whole tween and the canvas never rebuilds meshes. */
const visualCollapsedIds = computed(() =>
  animGroupId.value
    ? collapsedGroupIds.value.filter((id) => id !== animGroupId.value)
    : collapsedGroupIds.value,
);

/** Swim model with collapsed Cards/folders pruned so canvas row heights match gutter. */
const displaySwim = computed((): SwimlaneModel | null => {
  const m = swim.value;
  if (!m) return null;
  // Swim is already toRaw'd; replace swimlaneModel (or toggle collapse) to refresh — in-place nested edits do not.
  // During a collapse tween, `visualCollapsedIds` omits the animating group so the expanded
  // tree stays cached and the canvas never rebuilds meshes mid-animation.
  return filterCollapsedTree(m, visualCollapsedIds.value);
});

const bounds = computed(() => {
  const m = swim.value;
  if (!m) return { minTime: 0, maxTime: 1 };
  return {
    minTime: m.minTime,
    maxTime: m.maxTime > m.minTime ? m.maxTime : m.minTime + 1,
  };
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

function onFocusMeasure() {
  const range = viewState.value.measureRange;
  if (!range) return;
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
  hovered.value = null;
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
  // Keep scroll within new content height once the collapse settles.
  const el = timelineRef.value?.gutterRoot;
  if (el) {
    viewState.value = {
      ...viewState.value,
      scrollY: Math.min(viewState.value.scrollY, el.scrollHeight),
    };
  }
}

function onPinLane(laneId: string): void {
  viewState.value = pinLane(viewState.value, laneId);
}

function onUnpinLane(laneId: string): void {
  viewState.value = unpinLane(viewState.value, laneId);
}

function onGutterMetricChange(payload: { cardId: string; metric: GutterMetric }): void {
  gutterMetricByCard.value = { ...gutterMetricByCard.value, [payload.cardId]: payload.metric };
}

/**
 * Aside has content when any of: duration card, I/O bandwidth cards,
 * pipe occupancy, compute/memory CSV tables, roofline points, or hardware details are present.
 * Name/type alone do not open the aside (DATA-33a). Must stay in sync with StatsAside.
 */
function reportHasAsideContent(rm: ReportViewModel | null | undefined): boolean {
  if (!rm) return false;
  const hasDuration = rm.summary.taskDurationUs != null;
  const hasBandwidth = (rm.bandwidthCards ?? []).length > 0;
  const hasComputeCard = (rm.computeCard?.sides.length ?? 0) > 0;
  const hasPipe = rm.pipeOccupancy.length > 0;
  const hasComputeTables = rm.computeTables.length > 0;
  const hasMemoryTables = rm.memoryTables.length > 0;
  const hasSummaryCategories = (rm.summaryCategories?.length ?? 0) > 0;
  const hasRoofline = (rm.roofline?.points?.length ?? 0) > 0;
  const hasHardware = (rm.hardwareDetails?.sections.length ?? 0) > 0;
  const hasTopology = (rm.memoryTopology?.edges.some((e) => e.label) ?? false);
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
    hasTopology
  );
}

function applyAdapted(adapted: AdaptedReport) {
  operators.value = adapted.operators ?? [];
  operatorReports.value = adapted.operatorReports ?? {};
  selectedOperatorId.value = adapted.selectedOperatorId ?? null;
  internalSwim.value = adapted.swimlaneModel;
  internalReport.value = adapted.reportModel;
  internalCapabilities.value = adapted.capabilities ?? null;
  resetViewFromModel(adapted.swimlaneModel, reportHasAsideContent(adapted.reportModel));
  loadError.value = null;
  emit('ready');
}

function closeTopologyFullscreen() {
  topologyFullscreen.value = false;
}

function onTopologyFullscreenAfterLeave() {
  // Leave can be cancelled by a mid-fade reopen — only clear when still closed.
  if (!topologyFullscreen.value) fullscreenTopology.value = null;
}

function onOpenTopologyFullscreen(model: MemoryTopologyModel) {
  fullscreenTopology.value = model;
  topologyFullscreen.value = true;
  void nextTick(() => fullscreenBackRef.value?.focus());
}

function failLoad(cause: unknown) {
  operators.value = [];
  operatorReports.value = {};
  selectedOperatorId.value = null;
  internalSwim.value = null;
  internalReport.value = null;
  internalCapabilities.value = null;
  selected.value = null;
  selectedEvent.value = null;
  hovered.value = null;
  viewState.value = createViewState(null);
  closeTopologyFullscreen();
  loadError.value = cause instanceof Error ? cause.message : String(cause);
  emit('error', { message: loadError.value, cause });
}

function loadFromSource(source: ArrayBuffer | Uint8Array) {
  try {
    applyAdapted(loadReportSource(source));
  } catch (cause) {
    failLoad(cause);
  }
}

/** Swap the swimlane/report to another packaged operator without re-parsing the container. */
function onOperatorChange(id: string) {
  const rep = operatorReports.value[id];
  if (!rep || id === selectedOperatorId.value) return;
  selectedOperatorId.value = id;
  internalSwim.value = rep.swimlaneModel;
  internalReport.value = rep.reportModel;
  internalCapabilities.value = rep.capabilities ?? null;
  // Viewport/selection reset like a fresh load, but keep aside open/closed and panel widths.
  resetViewFromModel(rep.swimlaneModel, viewState.value.asideVisible, {
    preservePanelWidths: true,
  });
}

/** Parse before first paint when `source` is already available (avoids empty→loaded height jump). */
watch(
  () => props.source,
  (src) => {
    if (src) {
      loadFromSource(src);
      return;
    }
    // Source removed: drop what the adapter derived, or its flags outlive the report.
    operators.value = [];
    operatorReports.value = {};
    selectedOperatorId.value = null;
    internalSwim.value = null;
    internalReport.value = null;
    internalCapabilities.value = null;
    closeTopologyFullscreen();
  },
  { immediate: true },
);

watch(
  () => props.swimlaneModel,
  (m) => {
    if (m && !props.source) {
      resetViewFromModel(m, reportHasAsideContent(props.reportModel ?? report.value));
    }
  },
);

watch(
  report,
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
  window.addEventListener('keydown', onGlobalKeydown);
  if (props.source) return;
  if (props.swimlaneModel || props.reportModel) {
    resetViewFromModel(props.swimlaneModel ?? null, reportHasAsideContent(props.reportModel));
    emit('ready');
  }
});

onBeforeUnmount(() => {
  cancelViewWindowAnim();
  cancelCollapseAnim();
  collapseAnim.value = null;
  animGroupId.value = null;
  pendingCollapseTarget = null;
  stopLayoutFitObserver();
  window.removeEventListener('keydown', onGlobalKeydown);
});

function onGlobalKeydown(e: KeyboardEvent) {
  // Escape clears an active measure session / range first (existing M2 contract).
  if (e.key === 'Escape' && (viewState.value.measureMode || viewState.value.measureRange)) {
    viewState.value = clearMeasure(viewState.value);
    return;
  }
  if (e.key === 'Escape' && topologyFullscreen.value) {
    e.preventDefault();
    closeTopologyFullscreen();
    return;
  }
  // Overlay covers the timeline (including the ~200ms leave fade while the model is still held).
  // WASD must not pan/zoom the hidden view.
  if (topologyFullscreen.value || fullscreenTopology.value != null) return;
  if (!showTimeline.value) return;
  // No chords: W/S/A/D are bare keys (Ctrl/Cmd/Alt/Shift held → let the browser / other
  // handlers own the chord). Matches PyPTO's modifier-free keyboard handling.
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  const target = e.target as HTMLElement | null;
  // Ignore while typing — the search box and the dependency-depth field are <input>s.
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)
  ) {
    return;
  }
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
  if (!ev) {
    selected.value = null;
    selectedEvent.value = null;
    viewState.value = { ...viewState.value, selectedEventId: null };
    emit('select', null);
    return;
  }
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
  viewState.value = { ...viewState.value, selectedEventId: ev.id };
  emit('select', payload);
}

function onHover(ev: SwimEvent | null, clientX: number, clientY: number) {
  hovered.value = ev;
  viewState.value = { ...viewState.value, hoveredEventId: ev?.id ?? null };
  if (ev) {
    tooltipStyle.value = {
      left: `${clientX + 12}px`,
      top: `${clientY + 12}px`,
    };
  }
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

function onScrollY(scrollY: number) {
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

function onCannbot(scope: CannbotScope) {
  emit('cannbot-request', buildCannbotPayload(scope, report.value, props.reportMeta));
}

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
      v-if="!showTimeline"
      :title="title"
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
      :user-guide-url="userGuideUrl"
      @update:search-query="onSearch"
      @update:selected-operator-id="onOperatorChange"
      @update:aside-visible="onAside"
      @update:time-display-mode="onTimeDisplayMode"
      @update:dependency-mode="onDependencyMode"
      @update:dependency-depth="onDependencyDepth"
      @update:zoom-percent="onZoomPercent"
      @update:measure-mode="onMeasureMode"
      @zoom-to-fit="onZoomToFit"
      @zoom-in="onZoomIn"
      @zoom-out="onZoomOut"
      @open-user-guide="emit('open-user-guide', $event)"
    />

    <p
      v-if="loadError"
      class="pr-error"
      data-testid="load-error"
    >
      {{ loadError }}
    </p>

    <ReportLayout
      v-else-if="showTimeline || showAside"
      ref="layoutRef"
      :show-aside="showAside"
      :aside-width="asideWidth"
      :locale="locale"
      @update:aside-width="onAsideWidth"
    >
      <template #main>
        <ReportToolbar
          v-if="showTimeline"
          :title="title"
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
          :user-guide-url="userGuideUrl"
          @update:search-query="onSearch"
          @update:selected-operator-id="onOperatorChange"
          @update:aside-visible="onAside"
          @update:time-display-mode="onTimeDisplayMode"
          @update:dependency-depth="onDependencyDepth"
          @update:zoom-percent="onZoomPercent"
          @update:measure-mode="onMeasureMode"
          @zoom-to-fit="onZoomToFit"
          @zoom-in="onZoomIn"
          @zoom-out="onZoomOut"
          @open-user-guide="emit('open-user-guide', $event)"
        />
        <TimelineView
          v-if="showTimeline"
          ref="timelineRef"
          :bounds="bounds"
          :view="viewState"
          :time-scale-unit="viewportTimeScaleUnit"
          :dependency-mode="localDependencyMode"
          :dependency-depth="localDependencyDepth"
          :groups="laneGroups"
          :collapsed-ids="visualCollapsedIds"
          :pinned-lane-ids="viewState.pinnedLaneIds"
          :display-swim="displaySwim"
          :pin-source-model="swim"
          :collapse-anim="collapseAnim"
          :cursor="cursor"
          :show-overview-charts="showOverview"
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
          @update:gutter-metric="onGutterMetricChange"
          @select="onSelect"
          @hover="onHover"
          @cursor="onCursor"
          @set-playhead="onSetPlayhead"
          @pan="onPan"
          @zoom="onZoom"
          @update:measure-range="onMeasureRange"
          @focus-measure="onFocusMeasure"
        />
        <p
          v-if="!showTimeline"
          class="pr-error"
          data-testid="no-timeline"
        >
          {{ t('noTimeline', locale) }}
        </p>
      </template>

      <template #aside>
        <StatsAside
          :report="report"
          :locale="locale"
          :capabilities="caps"
          @close="onAside(false)"
          @view-full-csv="emit('view-full-csv', $event)"
          @open-hardware-details="emit('open-hardware-details')"
          @open-pipe-details="emit('open-pipe-details')"
          @open-cannbot="onCannbot"
          @open-topology-fullscreen="onOpenTopologyFullscreen"
        />
      </template>
    </ReportLayout>

    <p
      v-else
      class="pr-error"
      data-testid="no-timeline"
    >
      {{ t('noTimeline', locale) }}
    </p>

    <Transition
      name="pr-topo-fs"
      @after-leave="onTopologyFullscreenAfterLeave"
    >
      <div
        v-if="topologyFullscreen && fullscreenTopology"
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
          <h3 id="pr-topo-fs-title">{{ t('memoryTopology', locale) }}</h3>
        </div>
        <div class="pr-topo-fs__body">
          <MemoryTopologyPanel
            :model="fullscreenTopology"
            :locale="locale"
            :open-details-on-contextmenu="false"
          />
        </div>
      </div>
    </Transition>

    <Transition name="pr-dock">
      <DetailPanel
        v-if="selected && showTimeline"
        :selected="selected"
        :time-display-mode="localTimeDisplayMode"
        :clock-freq-m-hz="clockFreqMHz"
        :time-origin="bounds.minTime"
        :locale="locale"
        :neighbors="dependencyNeighbors"
        :dependency-mode="localDependencyMode"
        :expanded="dockExpanded"
        @close="onSelect(null)"
        @update:expanded="dockExpanded = $event"
        @update:dependency-mode="onDependencyMode"
      />
    </Transition>

    <EventTooltip
      v-if="hovered && showTimeline"
      :event="hovered"
      :style-pos="tooltipStyle"
      :time-display-mode="localTimeDisplayMode"
      :clock-freq-m-hz="clockFreqMHz"
      :time-origin="bounds.minTime"
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
  background: var(--pr-bg-deep);
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
}

.pr-topo-fs__body :deep(.pr-topo) {
  height: 100%;
  box-sizing: border-box;
}

.pr-topo-fs__body :deep(.pr-topo__svg) {
  width: 100%;
  height: 100%;
}
</style>
