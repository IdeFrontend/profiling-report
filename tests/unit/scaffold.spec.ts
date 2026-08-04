import { describe, expect, it } from 'vitest';
import { LIBRARY_NAME, parseRep } from '../../src/index';
import { loadOutRepBytes } from '../helpers/fixtures';

describe('scaffold smoke', () => {
  it('PR-SCAFFOLD-001: exports library name', () => {
    expect(LIBRARY_NAME).toBe('profiling-report');
  });

  it('PR-SCAFFOLD-002: parseRep reads out.rep magic', () => {
    const parsed = parseRep(loadOutRepBytes());
    expect(parsed.header.magic).toBe('cann-rep');
  });
});
