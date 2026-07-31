import { describe, expect, it } from 'vitest';
import { parseRep } from '../../src/index';
import { EXPECTED_OUT_REP_EMBEDS, loadOutRepBytes } from '../helpers/fixtures';

describe('PR-FMT: .rep container parse', () => {
  it('PR-FMT-001: parses cann-rep header and file table', () => {
    const parsed = parseRep(loadOutRepBytes());

    expect(parsed.header.magic).toBe('cann-rep');
    expect(parsed.header.version).toBe(0x00010000);
    expect(parsed.header.fileInfoCount).toBe(9);
    expect(parsed.header.fileLength).toBe(36);
    expect(parsed.header.repLength).toBe(33714);
    expect(parsed.header.offset).toBe(1476);
    expect(parsed.files).toHaveLength(9);
    expect(parsed.files[0]).toMatchObject({
      name: 'ArithmeticUtilization.csv',
      type: 1,
      origin: 0,
    });
    expect(parsed.files.at(-1)).toMatchObject({
      name: 'trace.json',
      type: 2,
      origin: 1,
    });
  });

  it('PR-FMT-002: embed list and payloads match data/out.rep (interim I-Q4)', () => {
    const parsed = parseRep(loadOutRepBytes());
    const names = parsed.files.map((f) => f.name);

    expect(names).toEqual([...EXPECTED_OUT_REP_EMBEDS]);
    for (const name of EXPECTED_OUT_REP_EMBEDS) {
      const meta = parsed.files.find((f) => f.name === name);
      expect(meta, name).toBeDefined();
      expect(parsed.payloads[name]?.byteLength).toBe(meta!.length);
      expect(parsed.payloads[name]?.byteLength).toBeGreaterThan(0);
    }
  });
});
