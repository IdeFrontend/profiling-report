import { describe, expect, it } from 'vitest';

import { resolveEnvironmentBehavior } from './environments';

describe('resolveEnvironmentBehavior', () => {
  it('routes the vscode environment to the host Problems view', () => {
    expect(resolveEnvironmentBehavior('vscode').performanceHintsTarget).toBe('problems');
  });

  it('routes the browser environment to the internal hints dock', () => {
    expect(resolveEnvironmentBehavior('browser').performanceHintsTarget).toBe('dock');
  });

  it('falls back to the browser behavior for omitted and unknown environments', () => {
    expect(resolveEnvironmentBehavior(undefined).performanceHintsTarget).toBe('dock');
    expect(resolveEnvironmentBehavior('').performanceHintsTarget).toBe('dock');
    expect(resolveEnvironmentBehavior('future-env').performanceHintsTarget).toBe('dock');
  });
});
