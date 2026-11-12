import { describe, expect, it } from 'vitest';
import { shortOperatorName } from './operatorName';

describe('shortOperatorName', () => {
  it('PR-OPN-001: short name strips types and params', () => {
    expect(
      shortOperatorName('void gather_2d_custom<float, unsigned int>(float*, unsigned int*)'),
    ).toBe('gather_2d_custom');
    expect(shortOperatorName('add_custom')).toBe('add_custom');
    expect(shortOperatorName('matmul_mock<float>')).toBe('matmul_mock');
    expect(shortOperatorName('')).toBeUndefined();
  });
});
