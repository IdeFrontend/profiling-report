import { describe, expect, it } from 'vitest';
import { computeThreadUtilization, coveredLength } from '../../src/domain/utilization';
import type { SwimThread } from '../../src/domain/types';

describe('PR-UTIL: thread utilization', () => {
  it('PR-UTIL-001: merges overlapping intervals instead of double-counting', () => {
    expect(
      coveredLength([
        { start: 0, end: 100 },
        { start: 50, end: 150 },
      ]),
    ).toBe(150);

    const thread: SwimThread = {
      id: 't',
      name: 'lane',
      events: [
        { id: 'a', name: 'long', startTime: 0, duration: 100 },
        { id: 'b', name: 'nested', startTime: 10, duration: 20 },
      ],
    };
    expect(computeThreadUtilization(thread, 0, 100)).toBe(1);
  });

  it('PR-UTIL-002: clamps to the visible window', () => {
    const thread: SwimThread = {
      id: 't',
      name: 'lane',
      events: [{ id: 'a', name: 'ev', startTime: -50, duration: 100 }],
    };
    expect(computeThreadUtilization(thread, 0, 100)).toBe(0.5);
  });
});
