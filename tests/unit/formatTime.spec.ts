import { describe, expect, it } from 'vitest';
import {
  formatAxisTime,
  formatAxisBaseTime,
  formatCursorTime,
  formatTime,
  formatTimeParts,
  resolveTimeUnitFromVisibleRange,
  timeScaleUnitFromNsQuantum,
} from '../../src/domain/formatTime';

describe('PR-TIME: auto-scale time labels', () => {
  it('PR-TIME-001: formats ns by scale unit', () => {
    expect(formatTime(1_800_000, 'ms')).toBe('1.800 ms');
    expect(formatTime(1_800_000, 'us')).toBe('1 800.000 µs');
    expect(formatTime(1_800_000, 'ns')).toBe('1 800 000 ns');
    expect(formatTime(1_800_000_000, 's')).toBe('1.800 s');
    expect(formatTime(986, 'ms')).toBe('0.001 ms');
    expect(formatTime(999, 'ns')).toBe('999 ns');
    expect(formatTime(1_000, 'ns')).toBe('1 000 ns');
    expect(formatTime(1_000_000_000, 'ns')).toBe('1 000 000 000 ns');
  });

  it('PR-TIME-002: cursor label is MM:SS.mmm in resolved scale', () => {
    expect(formatCursorTime(4_456_000, 'ms')).toBe('00:04.456');
    expect(formatCursorTime(1_800, 'us')).toBe('00:01.800');
    expect(formatCursorTime(900, 'us')).toBe('00:00.900');
    expect(formatCursorTime(0, 'ms')).toBe('00:00.000');
    expect(formatCursorTime(60_000_000, 'ms')).toBe('01:00.000');
  });

  it('PR-TIME-002b: visible-range and quantum resolvers pick scale unit', () => {
    expect(resolveTimeUnitFromVisibleRange(2e9)).toBe('s');
    expect(resolveTimeUnitFromVisibleRange(5e6)).toBe('ms');
    expect(resolveTimeUnitFromVisibleRange(5e3)).toBe('us');
    expect(resolveTimeUnitFromVisibleRange(500)).toBe('ns');
    expect(timeScaleUnitFromNsQuantum(1e9)).toBe('s');
    expect(timeScaleUnitFromNsQuantum(1e6)).toBe('ms');
    expect(timeScaleUnitFromNsQuantum(1e3)).toBe('us');
    expect(timeScaleUnitFromNsQuantum(1)).toBe('ns');
  });

  it('PR-TIME-003: axis decimals follow tick step', () => {
    const step = 20; // ns
    expect(formatAxisTime(986, 'ms', step)).not.toBe(formatAxisTime(1006, 'ms', step));
  });

  it('PR-TIME-004: axis origin formats as compact zero', () => {
    expect(formatAxisTime(0, 'ms', 474)).toBe('0ms');
    expect(formatAxisTime(0, 'us', 474)).toBe('0µs');
    expect(formatAxisTime(0, 'ns', 474)).toBe('0ns');
    expect(formatAxisTime(0, 's', 474)).toBe('0s');
  });

  it('PR-TIME-005: formatTimeParts and formatTime join value + unit', () => {
    const parts = formatTimeParts(1_000_000, 'ms');
    expect(parts).toEqual({ value: '1.000', unit: 'ms' });
    expect(formatTime(1_000_000, 'ms')).toBe('1.000 ms');
    expect(formatTimeParts(2_500_000, 'ns')).toEqual({ value: '2 500 000', unit: 'ns' });
    expect(formatAxisTime(2_500_000, 'ns')).toBe('2 500 000ns');
  });

  it('PR-TIME-006: axis base uses integral values only', () => {
    expect(formatAxisBaseTime(15_000, 'us')).toBe('15 µs');
    expect(formatAxisBaseTime(236_256_145_000, 'us')).toBe('236 256 145 µs');
    expect(formatAxisBaseTime(15_000, 'us')).not.toContain('.');
  });
});
