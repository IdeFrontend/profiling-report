import { describe, expect, it } from 'vitest';
import { formatAxisTime, formatCursorTime, formatTime } from '../../src/domain/formatTime';

describe('PR-TIME: display units (interim I-Q14)', () => {
  it('PR-TIME-001: formats ns as ms / µs / ns', () => {
    expect(formatTime(1_800_000, 'ms')).toBe('1.800 ms');
    expect(formatTime(1_800_000, 'us')).toBe('1800.000 µs');
    expect(formatTime(1_800_000, 'ns')).toBe('1800000 ns');
    expect(formatTime(986, 'ms')).toBe('0.001 ms');
  });

  it('PR-TIME-002: cursor label is MM:SS.mmm from real seconds', () => {
    // 4.456 s
    expect(formatCursorTime(4_456_000_000)).toBe('00:04.456');
    // 4.456 ms → 00:00.004
    expect(formatCursorTime(4_456_000)).toBe('00:00.004');
    expect(formatCursorTime(0)).toBe('00:00.000');
    // 60 ms must not look like one minute
    expect(formatCursorTime(60_000_000)).toBe('00:00.060');
  });

  it('PR-TIME-003: axis decimals follow tick step', () => {
    const step = 20; // ns
    expect(formatAxisTime(986, 'ms', step)).not.toBe(formatAxisTime(1006, 'ms', step));
  });
});
