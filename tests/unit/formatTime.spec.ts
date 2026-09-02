import { describe, expect, it } from 'vitest';
import {
  formatAxisTime,
  formatAxisBaseTime,
  formatCursorTime,
  formatTime,
  formatTimeAuto,
  formatTimeParts,
  formatTimePartsAuto,
  nsToCycles,
  resolveClockFreqMHz,
  resolveTimeUnitFromVisibleRange,
  timeScaleUnitFromMagnitude,
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

  it('PR-TIME-007: axis ticks share precision from tick step', () => {
    const stepMs = 100_000_000; // 100 ms major step — integral in display units
    expect(formatAxisTime(100_000_000, 'ms', stepMs)).toBe('100ms');
    expect(formatAxisTime(200_000_000, 'ms', stepMs)).toBe('200ms');
    expect(formatAxisTime(50_000_000, 'ms', 50_000_000)).toBe('50ms');

    const stepHalfMs = 12_500_000; // 12.5 ms — fractional step → one decimal for all ticks
    expect(formatAxisTime(0, 'ms', stepHalfMs)).toBe('0ms');
    expect(formatAxisTime(12_500_000, 'ms', stepHalfMs)).toBe('12.5ms');
    expect(formatAxisTime(25_000_000, 'ms', stepHalfMs)).toBe('25.0ms');
    expect(formatAxisTime(37_500_000, 'ms', stepHalfMs)).toBe('37.5ms');

    expect(formatAxisTime(441_004_000, 'ms', 1_000)).toBe('441.004ms');
  });

  it('PR-TIME-008: per-value auto unit independent of viewport scale', () => {
    expect(timeScaleUnitFromMagnitude(500)).toBe('ns');
    expect(timeScaleUnitFromMagnitude(1_500)).toBe('us');
    expect(timeScaleUnitFromMagnitude(1_500_000)).toBe('ms');
    expect(timeScaleUnitFromMagnitude(2e9)).toBe('s');

    expect(formatTimeAuto(500)).toBe('500 ns');
    expect(formatTimeAuto(1_800_000)).toBe('1.800 ms');
    expect(formatTimePartsAuto(41_000)).toEqual({ value: '41.000', unit: 'µs' });
    // Same absolute duration stays µs even though a wide viewport would be ms.
    expect(formatTime(41_000, 'ms')).toBe('0.041 ms');
    expect(formatTimeAuto(41_000)).toBe('41.000 µs');
  });

  it('PR-TIME-009: event surfaces use 4 significant digits; detail keeps full title', () => {
    expect(formatTimeAuto(479_611_000, { significantDigits: 4 })).toBe('479.6 ms');
    expect(formatTimeAuto(109_283, { significantDigits: 4 })).toBe('109.3 µs');
    expect(formatTimePartsAuto(500_000, { significantDigits: 4 })).toEqual({
      value: '500.0',
      unit: 'µs',
    });
    // Full precision remains the default (detail hover titles).
    expect(formatTimePartsAuto(500_000)).toEqual({ value: '500.000', unit: 'µs' });
  });

  it('PR-TIME-010: cycles conversion, freq resolve, and fixed-width cycle formatting', () => {
    expect(nsToCycles(1000, 1000)).toBe(1000);
    // Fixed width from total trace cycles (10325 → 2 groups → 6 digits, zero-padded).
    const opts = { mode: 'cycles' as const, clockFreqMHz: 1000, totalSpanNs: 10325 };
    expect(formatTime(10325, 'ms', opts)).toBe('010 325');
    expect(formatTime(0, 'ms', opts)).toBe('000 000');
    expect(formatTime(5000, 'ms', opts)).toBe('005 000');
    expect(formatAxisTime(10325, 'ms', undefined, opts)).toBe('010 325');
    expect(formatAxisTime(0, 'ms', undefined, opts)).toBe('000 000');
    expect(formatCursorTime(10325, 'ms', opts)).toBe('010 325');
    // No `cycles` unit in any surface.
    expect(formatTime(1000, 'ms', { mode: 'cycles' })).toBe('—');
    expect(formatTimeParts(10325, 'ms', opts)).toEqual({ value: '010 325', unit: '' });
    // Wider trace → more groups.
    const wide = { mode: 'cycles' as const, clockFreqMHz: 1000, totalSpanNs: 1_000_000 };
    expect(formatTime(1_000_000, 'ms', wide)).toBe('001 000 000');
    expect(resolveClockFreqMHz({ currentFreq: 1800 })).toBe(1800);
    expect(resolveClockFreqMHz({ ratedFreq: 1500 })).toBe(1500);
    expect(resolveClockFreqMHz({ currentFreq: 1800, ratedFreq: 1500 })).toBe(1800);
    expect(resolveClockFreqMHz({})).toBeUndefined();
    expect(resolveClockFreqMHz({ currentFreq: 0 })).toBeUndefined();
  });
});
