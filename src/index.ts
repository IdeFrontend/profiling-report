/**
 * Public library entry.
 *
 * Host-facing surface stays narrow: shell component, format loaders, and types.
 * Domain helpers and the imperative renderer remain available via deep imports
 * for advanced hosts and tests.
 */

import './ui/tokens.css';
import './ui/fonts.css';

export const LIBRARY_NAME = 'profiling-report' as const;

export {
  adaptChromeTrace,
  adaptPayloads,
  adaptRep,
  chromeTraceToSwimlane,
  emptyReportViewModel,
  isNpuRep,
  isNestedNpuArchive,
  loadReportSource,
  NPU_TYPE_NESTED_ARCHIVE,
  npuArchiveStem,
  parseNpuRep,
  parseRep,
} from './adapters';

export type * from './domain/types';
export {
  DEFAULT_DEPENDENCY_DEPTH,
  MAX_DEPENDENCY_DEPTH,
  normalizeDependencyDepth,
} from './domain/types';

export { default as ProfilingReport } from './ui/ProfilingReport/ProfilingReport.vue';
