import { afterEach, describe, expect, it, vi } from 'vitest';
import { debounce } from '../../src/domain/debounce';

afterEach(() => {
  vi.useRealTimers();
});

describe('PR-DEBOUNCE: cooldown debounce', () => {
  it('PR-DEBOUNCE-001: first call fires immediately; window calls are swallowed; next-after-window fires', () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const push = debounce((s: string) => calls.push(s), 1000);

    push('a');
    expect(calls).toEqual(['a']);

    push('b');
    push('c');
    expect(calls).toEqual(['a']);

    vi.advanceTimersByTime(1000);
    push('d');
    expect(calls).toEqual(['a', 'd']);
  });

  it('PR-DEBOUNCE-002: swallowed calls do not extend the window', () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const push = debounce((n: number) => calls.push(n), 1000);

    push(0);
    vi.advanceTimersByTime(999);
    push(1);
    expect(calls).toEqual([0]);

    // t = 1001：距上次“执行”1001ms，而非距上次“尝试”（999）——窗口不因连点续期。
    vi.advanceTimersByTime(2);
    push(2);
    expect(calls).toEqual([0, 2]);
  });

  it('PR-DEBOUNCE-003: wrappers own independent cooldowns', () => {
    vi.useFakeTimers();
    const a: string[] = [];
    const b: string[] = [];
    const pushA = debounce((s: string) => a.push(s), 1000);
    const pushB = debounce((s: string) => b.push(s), 1000);

    pushA('x');
    pushB('y');
    expect(a).toEqual(['x']);
    expect(b).toEqual(['y']);

    pushA('x2');
    pushB('y2');
    expect(a).toEqual(['x']);
    expect(b).toEqual(['y']);
  });
});
