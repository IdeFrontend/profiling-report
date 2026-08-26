import { describe, expect, it } from 'vitest';
import { generateSampleOp2Trace } from '../../src/domain/generateSampleOp2Trace';

describe('generateSampleOp2Trace', () => {
  it('is deterministic and yields ~150k X events', () => {
    const a = generateSampleOp2Trace();
    const b = generateSampleOp2Trace();
    expect(a).toEqual(b);

    const events = (a.traceEvents as unknown[]).filter(
      (e) => (e as { ph?: string }).ph === 'X',
    );
    expect(events.length).toBeGreaterThanOrEqual(140_000);
    expect(events.length).toBeLessThanOrEqual(160_000);
    expect(a.nestCardTree).toBe(true);
    expect((a.bands as unknown[]).length).toBe(5);
  });
});
