import { afterEach, describe, expect, it, vi } from 'vitest';
import { cooldown } from '../../src/domain/cooldown';

afterEach(() => {
  vi.useRealTimers();
});

describe('PR-COOLDOWN: leading-edge cooldown', () => {
  it('PR-COOLDOWN-001: first call fires immediately; window calls are swallowed; next-after-window fires', () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const push = cooldown((s: string) => calls.push(s), 1000);

    push('a');
    expect(calls).toEqual(['a']);

    push('b');
    push('c');
    expect(calls).toEqual(['a']);

    vi.advanceTimersByTime(1000);
    push('d');
    expect(calls).toEqual(['a', 'd']);
  });

  it('PR-COOLDOWN-002: swallowed calls do not extend the window', () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const push = cooldown((n: number) => calls.push(n), 1000);

    push(0);
    vi.advanceTimersByTime(999);
    push(1);
    expect(calls).toEqual([0]);

    // t = 1001：距上次“执行”1001ms，而非距上次“尝试”（999）——窗口不因连点续期。
    vi.advanceTimersByTime(2);
    push(2);
    expect(calls).toEqual([0, 2]);
  });

  it('PR-COOLDOWN-003: wrappers own independent cooldowns', () => {
    vi.useFakeTimers();
    const a: string[] = [];
    const b: string[] = [];
    const pushA = cooldown((s: string) => a.push(s), 1000);
    const pushB = cooldown((s: string) => b.push(s), 1000);

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
