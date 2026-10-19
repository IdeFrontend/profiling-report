import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensurePcSamplingSql, readPcSamplingDb, readPcSamplingDbSync } from './readPcSamplingDb';
import { configurePcSamplingSqlForNodeTests } from '../../../tests/helpers/sqlJsNode';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const fixture = join(root, 'data/gather_2d/summary.db');

describe('readPcSamplingDb', () => {
  beforeAll(async () => {
    configurePcSamplingSqlForNodeTests();
    await ensurePcSamplingSql();
  });

  it('reads pc_sampling stall counters from gather_2d summary.db', async () => {
    const rows = await readPcSamplingDb(new Uint8Array(readFileSync(fixture)));
    expect(rows.length).toBe(77);
    const hot = rows.find((r) => r.pcOffset.toLowerCase() === '0x268');
    expect(hot).toBeTruthy();
    expect(hot!.samplingStall).toBe(15504);
    expect(hot!.scoreboardNotReady).toBeGreaterThan(0);
    expect(hot!.stallBreakdown.some((b) => b.metric === 'Scoreboard Not Ready')).toBe(true);
    expect(rows.every((r) => r.pcOffset.startsWith('0x'))).toBe(true);
    expect(readPcSamplingDbSync(new Uint8Array(readFileSync(fixture))).length).toBe(77);
  });

  it('rejects non-SQLite bytes', async () => {
    await expect(readPcSamplingDb(new Uint8Array([1, 2, 3]))).rejects.toThrow();
  });
});
