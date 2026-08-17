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
  minTime: number;
  maxTime: number;
  /**
   * Optional phase bands for group rows (e.g. ProfilerStep#N).
   * Omit when absent — adapters must not invent these.
   */
  bands?: SwimlaneBand[];
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
  currentFreq?: number;
  /**
   * Rated frequency from OpBasicInfo. Populated by the adapter when present;
   * intentionally **not** shown on StatsAside shell meta (sketch: aic频率 = currentFreq only).
   */
  ratedFreq?: number;
  /** Aside meta shell: core count (核数). Leave unset until HardwareInfo / Product mapping. */
  coreCount?: number;
  /** Aside meta shell: NPU ARCH peak label (e.g. `212 teraOPs`). */
  npuArchLabel?: string;
  /** OpBasicInfo `Block Dim` pass-through (I-Q6e secondary). */
  blockDim?: string | number;
  /** Interim I-Q6a: leave unset until Product formulas exist */
  computeTflops?: number;
  ioBandwidth?: number;
  avgCoreUtil?: number;
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

export interface AdaptedReport {
  swimlaneModel: SwimlaneModel;
  reportModel: ReportViewModel;
  capabilities?: ReportCapability[];
}

export interface SelectedEvent {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  endTime: number;
  args?: Record<string, unknown>;
}

/** Interim I-Q14: ms / µs / ns only (no clock-cycle mode). */
export type TimeDisplayUnit = 'ms' | 'us' | 'ns';

/** Which selection dependency curves (and undimmed neighbors) to show. */
export type DependencyMode = 'all' | 'predecessors' | 'successors';

/** Hop count from the selection. `1` = immediate neighbors; `-1` = unlimited. */
export const DEFAULT_DEPENDENCY_DEPTH = 1;

export function normalizeDependencyDepth(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_DEPENDENCY_DEPTH;
  const d = Math.trunc(n);
  return d < -1 ? -1 : d;
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
  /** M2 度量模式 — local overlay until Q22 */
  measureMode: boolean;
  measureRange: MeasureRange | null;
}

export interface SwimlaneViewWindow {
  startTime: number;
  endTime: number;
  scrollY: number;
}

/** Imperative timeline backend — Canvas MVP; WebGL later (COMPONENTS). */
export interface SwimlaneRenderer {
  attach(canvas: HTMLCanvasElement): void;
  resize(width: number, height: number): void;
  setModel(model: SwimlaneModel): void;
  setView(view: SwimlaneViewWindow): void;
  setSelection(selectedId: string | null, hoveredId: string | null): void;
  setSearchQuery(query: string): void;
  setDependencyMode(mode: DependencyMode): void;
  setDependencyDepth(depth: number): void;
  setCursorX(x: number | null): void;
  contentHeight(): number;
  eventScreenRect(eventId: string): { x: number; y: number; w: number; h: number } | null;
  findEvent(id: string): SwimEvent | null;
  render(): void;
  hitTest(x: number, y: number): string | null;
  dispose(): void;
}
