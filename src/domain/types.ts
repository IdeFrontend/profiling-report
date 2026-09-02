/** Canonical models — see docs/architecture/COMPONENTS.md */

/** Points at `thread.events[index]` where `thread.id === tid`. */
export interface EventRef {
  tid: string;
  index: number;
}

export interface EventDependencies {
  predecessors: EventRef[];
  successors: EventRef[];
}

export interface SwimEvent {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  /** Omit when both lists would be empty. */
  dependencies?: EventDependencies;
  args?: Record<string, unknown>;
}

export interface SwimThread {
  id: string;
  name: string;
  utilization?: number;
  /** Leaves hold intervals; folders use []. */
  events: SwimEvent[];
  /** Non-empty ⇒ folder (lane-style gutter row); omit/empty ⇒ leaf. */
  children?: SwimThread[];
}

export interface SwimProcess {
  id: string;
  /** Card name (sketch) or flat CTEF process name. */
  name: string;
  utilization?: number;
  /** Top children under the card (通信 / 计算 / 储存HBM) or flat CTEF threads. */
  threads: SwimThread[];
}

export interface SwimlaneModel {
  processes: SwimProcess[];
  /**
   * Earliest event `startTime` (ns). Display origin for axis/cursor/tooltip/detail
   * (PyPTO / Perfetto default: left edge shows 0). Also WebGL `timeBase` / utilization.
   */
  minTime: number;
  maxTime: number;
  /**
   * Optional phase bands for group rows (e.g. ProfilerStep#N).
   * Omit when absent — adapters must not invent these.
   */
  bands?: SwimlaneBand[];
  /**
   * When true, layout skips Card header bands (sticky pinned-lane strip).
   * Viewer-built only — adapters must not set this on producer models.
   */
  skipCardHeaders?: boolean;
  metadata?: Record<string, unknown>;
}

/** Shared timeline phase marker painted on folder / spacer group rows. */
export interface SwimlaneBand {
  id: string;
  name: string;
  startTime: number;
  duration: number;
}

export interface SummaryMetrics {
  opName?: string;
  opType?: string;
  /** Task duration in microseconds as in OpBasicInfo, or converted — adapter documents unit. */
  taskDurationUs?: number;
  /** OpBasicInfo `Current Freq`. Parsed; not shown on the aside shell. */
  currentFreq?: number;
  /**
   * Rated frequency from OpBasicInfo. Populated when present;
   * not shown on the StatsAside shell (v930 header is 进程 / 算子类型 / Blocks).
   */
  ratedFreq?: number;
  /** OpBasicInfo `Pid` / `PID` — aside meta **进程**. */
  pid?: string;
  /** OpBasicInfo `Block Dim` — aside meta **Blocks** and I-Q6e duration secondary. */
  blockDim?: string | number;
  /** Interim I-Q6a: leave unset until Product formulas exist */
  computeTflops?: number;
  ioBandwidth?: number;
  avgCoreUtil?: number;
}

/** I-Q6g: one AIC/AIV row on an I/O bandwidth card. Values in GB/s; UI shows GB/s (HQ 34). */
export interface BandwidthSideRow {
  side: 'aic' | 'aiv';
  measuredGBs: number;
  peakGBs: number;
}

/** I-Q6g: 输入/输出带宽. Omit the card when both sides are NA. */
export interface BandwidthCardModel {
  id: 'input' | 'output';
  sides: BandwidthSideRow[];
}

export interface PipeOccupancyItem {
  id: string;
  label: string;
  ratio: number;
  colorKey: string;
  /**
   * M1 Cube|Vector toggle grouping (`v930/compute-load`).
   * Cube uses `aic_*` columns; Vector uses `aiv_*` — never blend across sides.
   */
  side?: 'cube' | 'vector';
  /** Mean non-NA `*_time(us)` for this family (I-Q6f); omit when all NA. */
  absoluteValue?: number;
}

export interface OverviewSeries {
  id: string;
  label: string;
  points: { t: number; v: number }[];
}

/** M1 searchable CSV detail tab (`v930/compute-load-detail` / `v930/memory-load-detail`, COMPONENTS CsvTableModel). */
export interface CsvTableModel {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  /** Distinct block_id values in fixture order (I-Q6c). */
  blockIds: string[];
}

/** M2 interim roofline point (I-Q11*). */
export interface RooflinePoint {
  id: string;
  label: string;
  /** Arithmetic intensity (Ops/Byte). */
  intensity: number;
  /** Achieved performance (TOps/s). */
  performance: number;
  style: 'solid' | 'hollow';
}

export interface RooflineMixLabel {
  id: string;
  label: string;
  percent: number;
}

/** M2 interim roofline model (I-Q11a–f). Omit when undecidable. */
export interface RooflineViewModel {
  points: RooflinePoint[];
  mixLabels: RooflineMixLabel[];
  peakComputeTops: number;
  peakBandwidthGBs: number;
}

export interface HardwareField {
  key: string;
  value: string;
}

export interface HardwareSection {
  id: string;
  title: string;
  fields: HardwareField[];
}

/** M1 interim hardware details (I-Q7a). */
export interface HardwareDetailsModel {
  sections: HardwareSection[];
}

/** M2 memory-topology node (change-log #5, Q12). */
export interface MemoryTopologyNode {
  id: string;
  /** Display label, e.g. GM, L2 Cache, Cube, UB, Vec. */
  label: string;
}

/** M2 memory-topology buffer link (change-log #5). */
export interface MemoryTopologyEdge {
  id: string;
  from: string;
  to: string;
  /** Data-driven GB/s (or KB) label; omit when the mapped CSV value is NA/missing. */
  label?: string;
}

/** M2 memory topology: static node set + data-driven buffer-link labels. */
export interface MemoryTopologyModel {
  nodes: MemoryTopologyNode[];
  edges: MemoryTopologyEdge[];
}

export interface ReportViewModel {
  summary: SummaryMetrics;
  pipeOccupancy: PipeOccupancyItem[];
  overviewSeries: OverviewSeries[];
  /** Compute-load tabs: PipeUtilization | ArithmeticUtilization | ResourceConflictRatio. */
  computeTables: CsvTableModel[];
  /** Memory tabs: Memory.csv | L2Cache | MemoryL0 | MemoryUB. */
  memoryTables: CsvTableModel[];
  /** Raw CSV text by basename for 查看全部 (I-Q6d). */
  csvTexts: Record<string, string>;
  /** I-Q6g 输入/输出带宽 cards; omit when Memory.csv has no usable BW. */
  bandwidthCards?: BandwidthCardModel[];
  /** Interim I-Q11*; omit when no GM point. */
  roofline?: RooflineViewModel;
  /** Interim I-Q7a; omit when empty. */
  hardwareDetails?: HardwareDetailsModel;
  /** M2 memory topology (change-log #5); omit when no label data. */
  memoryTopology?: MemoryTopologyModel;
}

export type ViewFullCsvPayload = {
  fileName: string;
  text: string;
};

export type ReportCapability =
  | 'roofline'
  | 'dependencies'
  | 'memoryDiagram'
  | 'hardwareDetails'
  | 'sourceTab'
  | 'cacheTab'
  | 'aicpu';

export interface RepEmbeddedFile {
  name: string;
  type: number;
  origin: number;
  offset: number;
  length: number;
}

export interface RepHeader {
  magic: string;
  version: number;
  fileInfoCount: number;
  fileLength: number;
  repLength: number;
  offset: number;
}

export interface ParsedRep {
  header: RepHeader;
  files: RepEmbeddedFile[];
  /** Raw payloads keyed by basename */
  payloads: Record<string, Uint8Array>;
}

/** A selectable operator packaged in a multi-operator container. */
export interface ReportOperator {
  /** Stable id — nested FileInfo name (e.g. `op1.npu.rep`); unique in the pack. */
  id: string;
  /** Display label in the top-left OP selector (archive stem, e.g. `op1`). */
  label: string;
}

export interface AdaptedReport {
  swimlaneModel: SwimlaneModel;
  reportModel: ReportViewModel;
  capabilities?: ReportCapability[];
  /** Multi-operator packs only: selectable operators (omit for single-op sources). */
  operators?: ReportOperator[];
  /** Adapted report per operator id (multi-op only). */
  operatorReports?: Record<string, AdaptedReport>;
  /** Currently selected operator id (multi-op only; defaults to the first). */
  selectedOperatorId?: string;
}

export interface SelectedEvent {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  endTime: number;
  args?: Record<string, unknown>;
}

/** Auto wall-time scale (I-Q14 interim): s / ms / µs / ns from viewport or axis density. */
export type TimeScaleUnit = 's' | 'ms' | 'us' | 'ns';

/** Which selection dependency curves (and undimmed neighbors) to show. */
export type DependencyMode = 'all' | 'predecessors' | 'successors';

/** Hop count from the selection. `1` = immediate neighbors; `-1` = no hop cap (link count still budgeted). */
export const DEFAULT_DEPENDENCY_DEPTH = 1;
/** Upper clamp — beyond this the BFS is indistinguishable from `-1` and just wastes time. */
export const MAX_DEPENDENCY_DEPTH = 100;

export function normalizeDependencyDepth(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_DEPENDENCY_DEPTH;
  const d = Math.trunc(n);
  if (d < -1) return -1;
  if (d > MAX_DEPENDENCY_DEPTH) return MAX_DEPENDENCY_DEPTH;
  return d;
}

/** M2 timeline measure range — times in the same ns units as SwimlaneViewState. */
export interface MeasureRange {
  startTime: number;
  endTime: number;
}

/** Interaction state — not part of the immutable report model (COMPONENTS). */
export interface SwimlaneViewState {
  startTime: number;
  endTime: number;
  scrollY: number;
  selectedEventId: string | null;
  hoveredEventId: string | null;
  searchQuery: string;
  asideVisible: boolean;
  playheadTime: number | null;
  /** M2 度量模式 — local overlay only; does not recompute the aside */
  measureMode: boolean;
  measureRange: MeasureRange | null;
  /** Leaf lane ids in pin order (session-local); sticky strip duplicates. */
  pinnedLaneIds: string[];
  /**
   * Leaf lane ids hidden from the swim body (context-menu "隐藏 / Hide" filter).
   * Independent from `collapsedIds` (folder folding) and `pinnedLaneIds` (sticky strip):
   * the canvas/gutter drop hidden leaves; pinned lanes ignore the flag and keep showing.
   */
  hiddenLaneIds: string[];
  /**
   * General undo stack. Each entry is a snapshot of the parts of `viewState`
   * that user-driven changes can revert: window, selection, hidden lanes,
   * offset. `undoLast` pops the top and restores it. Capped at
   * `MAX_UNDO_HISTORY`. MVP interim — covers Q24 (zoom undo) and unifies
   * selection / hide-lane / offset changes under one undo channel.
   * `measureMode` / `measureRange` are *not* snapshotted (ephemeral overlay).
   */
  undoStack: UndoSnapshot[];
  /**
   * Q25 Offset: lane-start time shift in ns. Applied as a visual offset on top of
   * `view.startTime` (additive). MVP interim — see OPEN_QUESTIONS Q25.
   */
  offsetNs: number;
}

/** Fields included in an undo-stack snapshot. Measure/pin/hover/search are
 *  intentionally excluded — measure is ephemeral; pin ships in its own PR;
 *  hover / search are pointer-driven, not user actions. */
export interface UndoSnapshot {
  startTime: number;
  endTime: number;
  scrollY: number;
  selectedEventId: string | null;
  hiddenLaneIds: string[];
  offsetNs: number;
}

export interface SwimlaneViewWindow {
  startTime: number;
  endTime: number;
  scrollY: number;
}

/** Imperative timeline backend — Canvas MVP; WebGL later (COMPONENTS). */
export interface SwimlaneRenderer {
  attach(canvas: HTMLCanvasElement): void;
  resize(devicePixelWidth: number, devicePixelHeight: number, dpr: number): void;
  setModel(model: SwimlaneModel): void;
  setView(view: SwimlaneViewWindow): void;
  setSelection(selectedId: string | null, hoveredId: string | null): void;
  setSearchQuery(query: string): void;
  /** Optional: hosts that omit this keep default `all`. */
  setDependencyMode?(mode: DependencyMode): void;
  /** Optional: hosts that omit this keep default hop depth. */
  setDependencyDepth?(depth: number): void;
  /** Optional: when false, skip dependency curves / selection dimming. */
  setPaintDependencies?(enabled: boolean): void;
  contentHeight(): number;
  eventScreenRect(eventId: string): { x: number; y: number; w: number; h: number } | null;
  findEvent(id: string): SwimEvent | null;
  render(): void;
  hitTest(x: number, y: number): string | null;
  dispose(): void;
}
