import { describe, expect, it } from 'vitest';
import {
  formatAxisTime,
  formatCursorTime,
  formatTime,
  nsToCycles,
  resolveClockFreqMHz,
  resolveTimeUnitFromVisibleRange,
  timeScaleUnitFromNsQuantum,
} from '../../src/domain/formatTime';

describe('PR-TIME: Time (auto) vs CPU clocks (I-Q14)', () => {
  it('PR-TIME-001: formats ns in time mode with scale unit', () => {
    expect(formatTime(1_800_000, 'time', { unit: 'ms' })).toBe('1.800 ms');
    expect(formatTime(1_800_000, 'time', { unit: 'us' })).toBe('1800.000 µs');
    expect(formatTime(1_800_000, 'time', { unit: 'ns' })).toBe('1800000 ns');
    expect(formatTime(1_800_000_000, 'time', { unit: 's' })).toBe('1.800 s');
    expect(formatTime(986, 'time', { unit: 'ms' })).toBe('0.001 ms');
  });

  it('PR-TIME-002: cursor label is MM:SS.mmm in time mode; plain cycles in cycles mode', () => {
    expect(formatCursorTime(4_456_000, 'time', { unit: 'ms' })).toBe('00:04.456');
    expect(formatCursorTime(1_800, 'time', { unit: 'us' })).toBe('00:01.800');
    expect(formatCursorTime(900, 'time', { unit: 'us' })).toBe('00:00.900');
    expect(formatCursorTime(0, 'time', { unit: 'ms' })).toBe('00:00.000');
    expect(formatCursorTime(60_000_000, 'time', { unit: 'ms' })).toBe('01:00.000');
    expect(formatCursorTime(1_000, 'cycles', { clockFreqMHz: 1000 })).toBe('1000 cycles');
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
    expect(
      formatAxisTime(986, 'time', { unit: 'ms', tickStepNs: step }),
    ).not.toBe(formatAxisTime(1006, 'time', { unit: 'ms', tickStepNs: step }));
  });

  it('PR-TIME-004: axis origin formats as compact zero', () => {
    expect(formatAxisTime(0, 'time', { unit: 'ms', tickStepNs: 474 })).toBe('0ms');
    expect(formatAxisTime(0, 'time', { unit: 'us', tickStepNs: 474 })).toBe('0µs');
    expect(formatAxisTime(0, 'time', { unit: 'ns', tickStepNs: 474 })).toBe('0ns');
    expect(formatAxisTime(0, 'time', { unit: 's', tickStepNs: 474 })).toBe('0s');
    expect(formatAxisTime(0, 'cycles', { clockFreqMHz: 1000 })).toBe('0cyc');
  });

  it('PR-TIME-005: cycles conversion and missing freq', () => {
    expect(nsToCycles(1000, 1000)).toBe(1000);
    expect(formatTime(1000, 'cycles', { clockFreqMHz: 1000 })).toBe('1000 cycles');
    expect(formatAxisTime(1000, 'cycles', { clockFreqMHz: 1000 })).toBe('1000cyc');
    expect(formatTime(1000, 'cycles', {})).toBe('—');
    expect(resolveClockFreqMHz({ currentFreq: 1800 })).toBe(1800);
    expect(resolveClockFreqMHz({ ratedFreq: 1500 })).toBe(1500);
    expect(resolveClockFreqMHz({ currentFreq: 1800, ratedFreq: 1500 })).toBe(1800);
    expect(resolveClockFreqMHz({})).toBeUndefined();
    expect(resolveClockFreqMHz({ currentFreq: 0 })).toBeUndefined();
  });
});
