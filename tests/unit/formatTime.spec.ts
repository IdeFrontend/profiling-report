import { describe, expect, it } from 'vitest';
import { formatCursorTime, formatTime } from '../../src/core/formatTime';

describe('PR-TIME: display units (interim I-Q14)', () => {
  it('PR-TIME-001: formats ns as ms / µs / ns', () => {
    expect(formatTime(1_800_000, 'ms')).toBe('1.800 ms');
    expect(formatTime(1_800_000, 'us')).toBe('1800.000 µs');
    expect(formatTime(1_800_000, 'ns')).toBe('1800000 ns');
    expect(formatTime(986, 'ms')).toBe('0.001 ms');
  });

  it('PR-TIME-002: cursor label matches sketch 00:SS.mmm', () => {
    expect(formatCursorTime(4_456_000)).toBe('00:04.456');
    expect(formatCursorTime(0)).toBe('00:00.000');
  });
});
