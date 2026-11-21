import { afterEach, describe, expect, it, vi } from 'vitest';
import { newBaselineId } from './baselineId';

describe('newBaselineId', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses crypto.randomUUID when available (uuid v4 shape)', () => {
    const uuid = '6f0a2b3c-9d4e-4f5a-8b6c-1d2e3f4a5b6c';
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => uuid) });
    expect(newBaselineId()).toBe(uuid);
  });

  it('falls back to the b-<ts36>-<rand> shape without crypto.randomUUID', () => {
    // Plain-HTTP LAN hosts have no `crypto.randomUUID` — the fallback shape
    // is what baselineTitle's FALLBACK_ID_RE matches, so both sides must
    // stay in lockstep.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    vi.stubGlobal('crypto', undefined);
    const id = newBaselineId();
    expect(id).toMatch(/^b-[0-9a-z]+-[0-9a-z]+$/);
    expect(random).toHaveBeenCalledOnce();
  });

  it('keeps the lockstep shape when Math.random() returns exactly 0', () => {
    // `(0).toString(36).slice(2, 10)` is '' — without the guard the id ends
    // with a bare dash and FALLBACK_ID_RE stops matching it.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.stubGlobal('crypto', undefined);
    expect(newBaselineId()).toMatch(/^b-[0-9a-z]+-[0-9a-z]+$/);
  });
});
