import { afterEach, describe, expect, it, vi } from 'vitest';
import { animateViewWindow } from './animateViewWindow';

describe('animateViewWindow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('applies target immediately when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const updates: { startTime: number; endTime: number }[] = [];
    const cancel = animateViewWindow({
      from: { startTime: 0, endTime: 100 },
      to: { startTime: 40, endTime: 60 },
      onUpdate: (w) => updates.push(w),
    });
    expect(updates).toEqual([{ startTime: 40, endTime: 60 }]);
    cancel();
  });

  it('moves both edges together and never widens when zooming in', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(performance, 'now').mockReturnValue(0);

    const updates: { startTime: number; endTime: number }[] = [];
    animateViewWindow({
      from: { startTime: 0, endTime: 1000 },
      to: { startTime: 400, endTime: 600 },
      durationMs: 400,
      onUpdate: (w) => updates.push(w),
    });

    for (let ms = 0; ms <= 400; ms += 40) {
      vi.spyOn(performance, 'now').mockReturnValue(ms);
      callbacks[callbacks.length - 1]!(ms);
    }

    const spans = updates.map((w) => w.endTime - w.startTime);
    expect(Math.max(...spans)).toBeLessThanOrEqual(1000 + 1e-6);
    // Midway: both edges have moved (not zoom-then-pan around a fixed center).
    const mid = updates[Math.floor(updates.length / 2)];
    expect(mid.startTime).toBeGreaterThan(0);
    expect(mid.startTime).toBeLessThan(400);
    expect(mid.endTime).toBeLessThan(1000);
    expect(mid.endTime).toBeGreaterThan(600);
    expect(spans[spans.length - 1]).toBeCloseTo(200, 5);
  });

  it('tweens with rAF and cancel stops further updates', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    let rafCb: FrameRequestCallback | null = null;
    let id = 1;
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) => {
        rafCb = cb;
        return id++;
      },
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(performance, 'now').mockReturnValue(0);

    const updates: number[] = [];
    const cancel = animateViewWindow({
      from: { startTime: 0, endTime: 100 },
      to: { startTime: 50, endTime: 150 },
      durationMs: 400,
      onUpdate: (w) => updates.push(w.startTime),
    });

    expect(rafCb).toBeTruthy();
    vi.spyOn(performance, 'now').mockReturnValue(200);
    rafCb!(200);
    expect(updates.length).toBe(1);

    cancel();
    const count = updates.length;
    vi.spyOn(performance, 'now').mockReturnValue(400);
    rafCb!(400);
    expect(updates.length).toBe(count);
  });
});
