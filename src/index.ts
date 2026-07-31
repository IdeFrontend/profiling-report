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
export { formatTime, formatAxisTime } from './core/formatTime';
export { t, resolveLocale } from './core/i18n';
export { computeThreadUtilization, withDerivedUtilizations } from './core/utilization';
export {
  createViewState,
  zoomToFitWindow,
  zoomAt,
  panBy,
  applyWindow,
} from './core/viewState';
export { CanvasSwimlaneRenderer, LANE_HEIGHT } from './swimlane/CanvasSwimlaneRenderer';
export type * from './core/types';

export { default as ProfilingReport } from './ui/ProfilingReport.vue';
