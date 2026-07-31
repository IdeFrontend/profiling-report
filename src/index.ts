/**
 * Public library entry.
 * Milestone 2: typed stubs + failing feature tests drive the API; implementations follow.
 */

export const LIBRARY_NAME = 'profiling-report' as const;

export { notImplemented } from './core/notImplemented';
export { parseRep, adaptRep, chromeTraceToSwimlane } from './core/adapters';
export type * from './core/types';

export { default as ProfilingReport } from './ui/ProfilingReport.vue';
