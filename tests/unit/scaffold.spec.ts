import { describe, expect, it } from 'vitest';
import { LIBRARY_NAME, parseRep } from '../../src/index';

describe('scaffold smoke', () => {
  it('PR-SCAFFOLD-001: exports library name', () => {
    expect(LIBRARY_NAME).toBe('profiling-report');
  });

  it('PR-SCAFFOLD-002: parseRep is not implemented yet', () => {
    expect(() => parseRep(new ArrayBuffer(0))).toThrow(/not implemented/i);
  });
});
