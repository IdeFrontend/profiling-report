/**
 * Public library entry.
 */

import './ui/tokens.css';

export const LIBRARY_NAME = 'profiling-report' as const;

export { notImplemented } from './core/notImplemented';
export {
  parseRep,
  adaptRep,
  chromeTraceToSwimlane,
  loadReportSource,
  adaptChromeTrace,
} from './core/adapters';
export { formatTime, formatAxisTime, formatCursorTime } from './core/formatTime';
export { t, resolveLocale } from './core/i18n';
export { computeThreadUtilization, coveredLength, withDerivedUtilizations } from './core/utilization';
export { colorForThread, colorVarForLaneName, laneColorKey } from './core/laneColors';
export {
  createViewState,
  zoomToFitWindow,
  zoomAt,
  panBy,
  applyWindow,
} from './core/viewState';
export { CanvasSwimlaneRenderer, LANE_GROUP_HEADER_HEIGHT, LANE_HEIGHT } from './swimlane/CanvasSwimlaneRenderer';
export type * from './core/types';

export { default as ProfilingReport } from './ui/ProfilingReport.vue';
