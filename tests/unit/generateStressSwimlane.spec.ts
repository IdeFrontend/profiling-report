import { describe, expect, it } from 'vitest';
import {
  generateStressSwimlane,
  stressPresetFromQuery,
  stressSwimlaneStats,
} from '../../src/domain/generateStressSwimlane';

describe('PR-STRESS: generateStressSwimlane', () => {
  it('PR-STRESS-001: medium preset reaches Sudu-class event counts', () => {
    const model = generateStressSwimlane({}, 'medium');
    const stats = stressSwimlaneStats(model);
    expect(stats.processCount).toBe(4);
    expect(stats.threadCount).toBe(32);
    expect(stats.eventCount).toBe(320_000);
    expect(model.minTime).toBe(0);
    expect(model.maxTime).toBe(1_000_000_000);
  });

  it('PR-STRESS-002: small preset is deterministic for same seed', () => {
    const a = generateStressSwimlane({ seed: 42 }, 'small');
    const b = generateStressSwimlane({ seed: 42 }, 'small');
    expect(a.processes[0]?.threads[0]?.events[0]).toEqual(
      b.processes[0]?.threads[0]?.events[0],
    );
    expect(stressSwimlaneStats(a).eventCount).toBe(8_000);
  });

  it('PR-STRESS-003: custom options override preset sizes', () => {
    const model = generateStressSwimlane(
      { processCount: 1, threadsPerProcess: 2, eventsPerThread: 50, timeSpanNs: 10_000 },
      'large',
    );
    expect(stressSwimlaneStats(model).eventCount).toBe(100);
    expect(model.maxTime).toBe(10_000);
  });

  it('PR-STRESS-004: stressPresetFromQuery falls back to medium', () => {
    expect(stressPresetFromQuery('large')).toBe('large');
    expect(stressPresetFromQuery('nope')).toBe('medium');
    expect(stressPresetFromQuery(null)).toBe('medium');
  });

  it('PR-STRESS-005: occupancy leaves gaps when event count exceeds busy budget ns', () => {
    // count (200) > timeSpanNs * occupancy (50) — old formula treated count as ns,
    // zeroed gapBudget, and packed 1ns events with no idle.
    const model = generateStressSwimlane(
      {
        processCount: 1,
        threadsPerProcess: 1,
        eventsPerThread: 200,
        timeSpanNs: 100,
        occupancy: 0.5,
        seed: 1,
      },
      'small',
    );
    const events = model.processes[0]!.threads[0]!.events;
    expect(events.length).toBe(200);
    // Initial gap from avgGap > 0 → first event does not start at t=0.
    expect(events[0]!.startTime).toBeGreaterThan(0);
    let gaps = 0;
    for (let i = 1; i < 30; i++) {
      const prev = events[i - 1]!;
      const cur = events[i]!;
      if (cur.startTime > prev.startTime + prev.duration) gaps += 1;
    }
    expect(gaps).toBeGreaterThan(0);
  });
});
