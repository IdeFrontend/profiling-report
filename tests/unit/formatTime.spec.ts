import { describe, expect, it } from 'vitest';
import {
  formatAxisTime,
  formatCursorTime,
  formatDisplayTime,
  formatDisplayTimeParts,
  formatTime,
  formatTimeParts,
  resolveCursorTimeUnit,
} from '../../src/domain/formatTime';

describe('PR-TIME: display units (interim I-Q14)', () => {
  it('PR-TIME-001: formats ns as ms / µs / ns', () => {
    expect(formatTime(1_800_000, 'ms')).toBe('1.800 ms');
    expect(formatTime(1_800_000, 'us')).toBe('1800.000 µs');
    expect(formatTime(1_800_000, 'ns')).toBe('1800000 ns');
    expect(formatTime(986, 'ms')).toBe('0.001 ms');
  });

  it('PR-TIME-005: formatTimeParts splits value and unit', () => {
    expect(formatTimeParts(7_419, 'ns')).toEqual({ value: '7419', unit: 'ns' });
    expect(formatTimeParts(1_800_000, 'ms')).toEqual({ value: '1.800', unit: 'ms' });
    expect(formatTimeParts(Number.NaN, 'ms').value).toBe('—');

    const parts = formatTimeParts(1_800_000, 'us');
    expect(`${parts.value} ${parts.unit}`).toBe(formatTime(1_800_000, 'us'));
  });

  it('PR-TIME-002: cursor label is MM:SS.mmm in the given unit', () => {
    // Sketch: 4.456 ms → 00:04.456 when unit is ms
    expect(formatCursorTime(4_456_000, 'ms')).toBe('00:04.456');
    // 1.8 µs fixture mid-point updates in µs unit
    expect(formatCursorTime(1_800, 'us')).toBe('00:01.800');
    expect(formatCursorTime(900, 'us')).toBe('00:00.900');
    expect(formatCursorTime(0, 'ms')).toBe('00:00.000');
    // 60 ms → one "minute" on the ms-as-clock scale
    expect(formatCursorTime(60_000_000, 'ms')).toBe('01:00.000');
  });

  it('PR-TIME-002b: short spans resolve to a finer cursor unit', () => {
    expect(resolveCursorTimeUnit(1_800, 'ms')).toBe('us');
    expect(resolveCursorTimeUnit(500, 'ms')).toBe('ns');
    expect(resolveCursorTimeUnit(5_000_000, 'ms')).toBe('ms');
    expect(resolveCursorTimeUnit(1_800, 'us')).toBe('us');
  });

  it('PR-TIME-003: axis decimals follow tick step', () => {
    const step = 20; // ns
    expect(formatAxisTime(986, 'ms', step)).not.toBe(formatAxisTime(1006, 'ms', step));
  });

  it('PR-TIME-004: axis origin formats as compact zero', () => {
    expect(formatAxisTime(0, 'ms', 474)).toBe('0ms');
    expect(formatAxisTime(0, 'us', 474)).toBe('0µs');
    expect(formatAxisTime(0, 'ns', 474)).toBe('0ns');
  });

  it('PR-TIME-006: formatDisplayTime subtracts origin', () => {
    expect(formatDisplayTime(3_354_000, 986_000, 'us')).toBe(formatTime(2_368_000, 'us'));
    expect(formatDisplayTimeParts(3_354_000, 986_000, 'us')).toEqual(
      formatTimeParts(2_368_000, 'us'),
    );
  });
});
