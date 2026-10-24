import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { ensurePcSamplingSql, readPcSamplingDb, readPcSamplingDbSync } from './readPcSamplingDb';
import { configurePcSamplingSqlForNodeTests } from '../../../tests/helpers/sqlJsNode';

const require = createRequire(import.meta.url);

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

  it('rejects pc_sampling that omits a stall column', async () => {
    const SQL = await initSqlJs({
      wasmBinary: readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm')),
    });
    const db = new SQL.Database();
    db.run('CREATE TABLE pc_sampling (pc_offset TEXT, Nop_Cycles INTEGER)');
    db.run("INSERT INTO pc_sampling VALUES ('0x100', 1)");
    const bytes = db.export();
    db.close();
    await expect(readPcSamplingDb(bytes)).rejects.toThrow(/missing columns/);
  });

  it('clears a failed ensure so a later call can retry', async () => {
    const { configurePcSamplingSql, ensurePcSamplingSql: ensure } = await import('./readPcSamplingDb');
    configurePcSamplingSql({
      initSqlJs: async () => {
        throw new Error('wasm boom');
      },
    });
    await expect(ensure()).rejects.toThrow(/wasm boom/);
    configurePcSamplingSqlForNodeTests();
    await ensure();
    expect(
      (await readPcSamplingDb(new Uint8Array(readFileSync(fixture)))).length,
    ).toBe(77);
  });

  it('a late failed ensure does not clear a newer in-flight init', async () => {
    const { configurePcSamplingSql, ensurePcSamplingSql: ensure, isPcSamplingSqlReady } =
      await import('./readPcSamplingDb');
    let releaseFail!: () => void;
    const failGate = new Promise<void>((resolve) => {
      releaseFail = resolve;
    });
    configurePcSamplingSql({
      initSqlJs: async () => {
        await failGate;
        throw new Error('stale boom');
      },
    });
    const stale = ensure();
    configurePcSamplingSqlForNodeTests();
    const fresh = ensure();
    releaseFail();
    await expect(stale).rejects.toThrow(/stale boom/);
    await fresh;
    expect(isPcSamplingSqlReady()).toBe(true);
    expect(
      (await readPcSamplingDb(new Uint8Array(readFileSync(fixture)))).length,
    ).toBe(77);
  });
});
