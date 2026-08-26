import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { generateSampleOp2Trace } from '../../playground/generateSampleOp2Trace';

/** Pin generated op2 trace bytes — check:sample only hashes the lite container. */
const OP2_TRACE_SHA256 =
  'a9bd3f1816826e17ce62cb6e2552e7bc582ea29866cef639277882cd204f404c';

function xEventDegrees(trace: Record<string, unknown>): Map<string, number> {
  const deg = new Map<string, number>();
  for (const raw of trace.traceEvents as Array<{
    ph?: string;
    args?: { event_id?: string; dependencies?: string[] };
  }>) {
    if (raw.ph !== 'X') continue;
    const id = raw.args?.event_id;
    if (!id) continue;
    if (!deg.has(id)) deg.set(id, 0);
    for (const dep of raw.args?.dependencies ?? []) {
      deg.set(id, (deg.get(id) ?? 0) + 1);
      deg.set(dep, (deg.get(dep) ?? 0) + 1);
    }
  }
  return deg;
}

describe('generateSampleOp2Trace', () => {
  it('is deterministic and yields ~150k X events', { timeout: 30_000 }, () => {
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

  it('matches pinned sha256 of hydrated op2 trace.json', { timeout: 30_000 }, () => {
    const digest = createHash('sha256')
      .update(JSON.stringify(generateSampleOp2Trace()))
      .digest('hex');
    expect(digest).toBe(OP2_TRACE_SHA256);
  });

  it('gives every X event 1–4 dependency neighbors', { timeout: 30_000 }, () => {
    const deg = xEventDegrees(generateSampleOp2Trace());
    expect(deg.size).toBeGreaterThanOrEqual(140_000);
    let min = Infinity;
    let max = -Infinity;
    let worst = '';
    for (const [id, n] of deg) {
      if (n < min) min = n;
      if (n > max) {
        max = n;
        worst = id;
      }
    }
    expect({ min, max }, `worst event ${worst}`).toEqual({ min: 1, max: 4 });
  });
});
