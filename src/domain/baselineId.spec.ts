import { afterEach, describe, expect, it, vi } from 'vitest';
import { newBaselineId } from './baselineId';
import { isGeneratedBaselineName } from './baselineTitle';

describe('newBaselineId', () => {
  afterEach(() => {
    // restoreAllMocks undoes spies only; stubGlobal entries live in vitest's
    // own map and would leak `crypto: undefined` into later files sharing
    // this worker.
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when available (uuid v4 shape)', () => {
    const uuid = '6f0a2b3c-9d4e-4f5a-8b6c-1d2e3f4a5b6c';
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => uuid) });
    const id = newBaselineId();
    expect(id).toBe(uuid);
    expect(isGeneratedBaselineName(id)).toBe(true);
  });

  it('falls back to a b-<ts36>-<rand> id the title layer recognises', () => {
    // Plain-HTTP LAN hosts have no `crypto.randomUUID`. Assert through
    // `isGeneratedBaselineName`, not a copied regex, so the generator and the
    // title's judgement cannot drift apart silently.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    vi.stubGlobal('crypto', undefined);
    const id = newBaselineId();
    expect(isGeneratedBaselineName(id)).toBe(true);
    expect(random).toHaveBeenCalledOnce();
  });

  it('keeps the recognised shape when Math.random() returns exactly 0', () => {
    // `(0).toString(36).slice(2, 10)` is '' — padEnd still produces a full
    // 8-char suffix, so the title layer keeps recognising the id.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.stubGlobal('crypto', undefined);
    expect(isGeneratedBaselineName(newBaselineId())).toBe(true);
  });
});
