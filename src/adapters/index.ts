export { parseRep } from './parseRep';
export {
  isNpuRep,
  isNestedNpuArchive,
  npuArchiveStem,
  parseNpuRep,
  NPU_TYPE_NESTED_ARCHIVE,
} from './parseNpuRep';
export {
  isNpuRep160,
  isNestedNpuArchive160,
  parseNpuRep160,
  NPU_REP_TYPE_NESTED,
} from './parseNpuRep160';
export {
  adaptRep,
  adaptPayloads,
  bandwidthCardsFromRows,
  categoryRow,
  computeCardFromRows,
  emptyReportViewModel,
  overviewSeriesFromSampling,
  pipeOccupancyFromRows,
  rooflineFromRows,
  summaryCategoryRows,
} from './adaptRep';
/** Compute profile entry (alias of today's adaptPayloads). */
export { adaptPayloads as adaptCompute } from './adaptRep';
export {
  adaptEmulate,
  isEmulateLeaf,
  readEmulateManifest,
  pipeOccupancyFromPipesUtilization,
  pipeOccupancyFromHist,
} from './adaptEmulate';
export { topologyFromArchDiagramMetrics } from './emulateMemoryTopology';
export type { ArchDiagramMetricMode } from './emulateMemoryTopology';
export {
  ARCH_DIAGRAM_METRIC_MODES,
  ARCH_DIAGRAM_DEFAULT_METRIC_MODE,
  ARCH_DIAGRAM_EDGE_MAP,
  ARCH_DIAGRAM_L2_PEAK_PARAM,
  ARCH_DIAGRAM_UNPLATED_HTML_BASES,
  archDiagramCsvFromTexts,
  combineArchDiagramValues,
} from './emulateMemoryTopology';
export { buildMemoryTopology, buildMemoryTopologyFromCategories } from './memoryTopology';
export { chromeTraceToSwimlane } from './chromeTraceToSwimlane';
export { loadReportSource, adaptChromeTrace } from './loadReportSource';
