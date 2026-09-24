/**
 * Host environments and how ProfilingReport routes environment-dependent
 * actions. Extension point: add a `HostEnvironment` entry plus an
 * `EnvironmentBehavior` record instead of scattering `if (environment === …)`
 * branches through components.
 */
export type HostEnvironment = 'vscode' | 'browser';

export interface EnvironmentBehavior {
  /**
   * Target of the 性能分析 详情 trigger.
   * - `'problems'`: route to the host via `open-performance-hints-in-problems`
   *   (the host reveals its native Problems diagnostics).
   * - `'dock'`: open the internal hints dock, reusing the event-detail dock.
   */
  performanceHintsTarget: 'problems' | 'dock';
}

const BEHAVIORS: Record<HostEnvironment, EnvironmentBehavior> = {
  vscode: { performanceHintsTarget: 'problems' },
  browser: { performanceHintsTarget: 'dock' },
};

/** Unknown/omitted environments behave like the standalone browser build. */
const DEFAULT_ENVIRONMENT: HostEnvironment = 'browser';

export function resolveEnvironmentBehavior(environment?: string): EnvironmentBehavior {
  return BEHAVIORS[environment as HostEnvironment] ?? BEHAVIORS[DEFAULT_ENVIRONMENT];
}
