/** Canonical models — see docs/specs/architecture/COMPONENTS.md */

export interface SwimEvent {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  dependencies?: string[];
  args?: Record<string, unknown>;
}

export interface SwimThread {
  id: string;
  name: string;
  utilization?: number;
  events: SwimEvent[];
}

export interface SwimProcess {
  id: string;
  name: string;
  threads: SwimThread[];
}

export interface SwimlaneModel {
  processes: SwimProcess[];
  minTime: number;
  maxTime: number;
  metadata?: Record<string, unknown>;
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
   * M1 Cube|Vector toggle grouping ([changes.png] #2).
   * Cube uses `aic_*` columns; Vector uses `aiv_*` — never blend across sides.
   */
  side?: 'cube' | 'vector';
}

export interface OverviewSeries {
  id: string;
  label: string;
  points: { t: number; v: number }[];
}

/** M1 searchable CSV detail tab ([changes.png] #3–#4, COMPONENTS CsvTableModel). */
export interface CsvTableModel {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  /** Distinct block_id values in fixture order (I-Q6c). */
  blockIds: string[];
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
}

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
  setCursorX(x: number | null): void;
  contentHeight(): number;
  eventScreenRect(eventId: string): { x: number; y: number; w: number; h: number } | null;
  findEvent(id: string): SwimEvent | null;
  render(): void;
  hitTest(x: number, y: number): string | null;
  dispose(): void;
}
