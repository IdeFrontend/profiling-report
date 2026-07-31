/**
 * Public library entry. Feature APIs land in later TDD slices.
 * Milestone 1: stub only so the harness and playground can import the package.
 */

export const LIBRARY_NAME = 'profiling-report' as const;

export function notImplemented(api: string): never {
  throw new Error(`[profiling-report] ${api} is not implemented yet (Milestone 1 scaffold)`);
}

/** Placeholder — implemented in the core-parse slice (PR-FMT-*). */
export function parseRep(_source: ArrayBuffer | Uint8Array): never {
  return notImplemented('parseRep');
}

export { default as ProfilingReport } from './ui/ProfilingReport.vue';
