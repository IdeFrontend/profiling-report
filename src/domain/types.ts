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
  ratedFreq?: number;
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
}

export interface OverviewSeries {
  id: string;
  label: string;
  points: { t: number; v: number }[];
}

export interface ReportViewModel {
  summary: SummaryMetrics;
  pipeOccupancy: PipeOccupancyItem[];
  overviewSeries: OverviewSeries[];
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
}

export interface SwimlaneViewWindow {
  startTime: number;
  endTime: number;
  scrollY: number;
}

/** Imperative timeline backend — Canvas MVP; WebGL later (COMPONENTS). */
export interface SwimlaneRenderer {
  setModel(model: SwimlaneModel): void;
  setView(view: SwimlaneViewWindow): void;
  render(): void;
  hitTest(x: number, y: number): string | null;
  dispose(): void;
}
