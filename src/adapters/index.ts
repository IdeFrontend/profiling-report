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
  emptyReportViewModel,
  overviewSeriesFromSampling,
  pipeOccupancyFromRows,
} from './adaptRep';
/** Compute profile entry (alias of today's adaptPayloads). */
export { adaptPayloads as adaptCompute } from './adaptRep';
export {
  adaptEmulate,
  isEmulateLeaf,
  readEmulateManifest,
  pipeOccupancyFromPipesUtilization,
  pipeOccupancyFromHist,
  summaryFromKernelInfo,
  summaryFromEmulateJson,
} from './adaptEmulate';
export { topologyFromArchDiagramMetrics } from './emulateMemoryTopology';
export { buildMemoryTopology } from './memoryTopology';
export { chromeTraceToSwimlane } from './chromeTraceToSwimlane';
export { loadReportSource, adaptChromeTrace } from './loadReportSource';
