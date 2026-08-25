import { describe, expect, it } from 'vitest';
import { laneColorKey } from '../../src/domain/laneColors';

describe('laneColorKey', () => {
  it('matches CoreN.*/PIPE on the pipe suffix (not Core/Vec tokens)', () => {
    expect(laneColorKey('Core0.Vec0/MTE3')).toBe('mte3');
    expect(laneColorKey('Core0.Vec0/ALL')).toBe('default');
    expect(laneColorKey('Core0.Cube/ALL')).toBe('default');
    expect(laneColorKey('Core0.Cube/FLOWCTRL')).toBe('default');
    expect(laneColorKey('Core0.Cube/CACHEMISS')).toBe('default');
    expect(laneColorKey('Core0.Cube/SCALAR')).toBe('scalar');
    expect(laneColorKey('Core0.Cube/CUBE')).toBe('cube');
  });

  it('keeps AIV pipe-state names intact (no Core*.*/PIPE suffix rule)', () => {
    expect(laneColorKey('AIV0/PIPE_V/status')).toBe('vector');
    expect(laneColorKey('AIV0/PIPE_S/status')).toBe('scalar');
  });
});
