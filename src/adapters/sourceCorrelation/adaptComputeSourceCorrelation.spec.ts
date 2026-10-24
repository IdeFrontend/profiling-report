import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import initSqlJs from 'sql.js';
import { adaptSourceCorrelation } from './adaptSourceCorrelation';
import { ensurePcSamplingSql } from './readPcSamplingDb';
import { parseObjdump } from './parseObjdump';
import { configurePcSamplingSqlForNodeTests } from '../../../tests/helpers/sqlJsNode';
import { loadReportSource } from '../loadReportSource';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const gather = join(root, 'data/gather_2d');
const require = createRequire(import.meta.url);

async function pcSamplingDb(
  rows: Array<{ pc: string; stall: number; instr: number; occ: number | null }>,
): Promise<Uint8Array> {
  const SQL = await initSqlJs({
    wasmBinary: readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm')),
  });
  const db = new SQL.Database();
  db.run(
    `CREATE TABLE pc_sampling (
      pc_offset TEXT PRIMARY KEY,
      IBuf_Empty INTEGER, Nop_Cycles INTEGER, Scoreboard_Not_Ready INTEGER,
      Register_bank_conflict INTEGER, Resource_conflict INTEGER,
      Warp_Level_Sync INTEGER, Divergence_Stack_Spill INTEGER, Others INTEGER,
      Instructions_Executed INTEGER, Warp_Occupancy REAL
    )`,
  );
  for (const row of rows) {
    db.run('INSERT INTO pc_sampling VALUES (?,?,?,?,?,?,?,?,?,?,?)', [
      row.pc, row.stall, 0, 0, 0, 0, 0, 0, 0, row.instr, row.occ,
    ]);
  }
  const bytes = db.export();
  db.close();
  return bytes;
}

function loadGatherPayloads(): Record<string, Uint8Array> {
  return {
    'objdump.txt': new Uint8Array(readFileSync(join(gather, 'objdump.txt'))),
    'symbolizer.json': new Uint8Array(readFileSync(join(gather, 'symbolizer.json'))),
    'summary.db': new Uint8Array(readFileSync(join(gather, 'summary.db'))),
    'gather_2d.asc': new Uint8Array(readFileSync(join(gather, 'gather_2d.asc'))),
  };
}

describe('adaptComputeSourceCorrelation', () => {
  beforeAll(async () => {
    configurePcSamplingSqlForNodeTests();
    await ensurePcSamplingSql();
  });

  it('PR-SRC-005: compute pack builds mock:false SourceCorrelationModel', () => {
    const model = adaptSourceCorrelation(loadGatherPayloads());
    expect(model).not.toBeNull();
    expect(model!.mock).toBe(false);
    expect(model!.files[0]!.path).toMatch(/gather_2d\.asc/);
    expect(model!.files[0]!.language).toBe('ascend-c');
    expect(model!.files[0]!.text).toContain('gather_2d_custom');
    expect(model!.assembly.lines.length).toBeGreaterThan(40);
    const hot = model!.assembly.lines.find((l) => l.values.address?.toString().endsWith('00000268'));
    expect(hot?.values.samplingStall).toBe(15504);
    expect(hot?.values.instructionsExecuted).toBe(0);
    expect(hot?.values.warpOccupancy).toBe(0);
    expect(hot?.stallBreakdown?.length).toBeGreaterThan(0);
    // Source Sampling Stall tooltip needs rolled-up stallBreakdown (not only the total).
    const srcHot = model!.files[0]!.lines.find((l) => (l.values.samplingStall as number) > 0);
    expect(srcHot?.stallBreakdown?.length).toBeGreaterThan(0);
  });

  it('PR-SRC-006: symbolizer Line>0 fills maps; Line 0 stays unmapped', () => {
    const model = adaptSourceCorrelation(loadGatherPayloads())!;
    // Updated gather_2d sample: 12 sites with Line in {27,36–39}; 4 remain Line:0.
    expect(Object.keys(model.sourceToAsm).length).toBeGreaterThan(0);
    expect(model.sourceToAsm['gather_2d.asc:39']?.length).toBeGreaterThan(0);
    const hotAsm = model.assembly.lines.findIndex((l) =>
      l.values.address?.toString().endsWith('00000268'),
    );
    expect(hotAsm).toBeGreaterThanOrEqual(0);
    expect(model.asmToSource[hotAsm + 1]).toEqual({ fileId: 'gather_2d.asc', line: 39 });
  });

  it('PR-SRC-009: each symbolizer basename is its own source file', () => {
    const enc = (text: string) => new TextEncoder().encode(text);
    const model = adaptSourceCorrelation({
      'objdump.txt': enc(
        ['     100:\t11111111\tADD r0, r1', '     104:\t22222222\tADD r2, r3', '     108:\t33333333\tNOP'].join(
          '\n',
        ),
      ),
      'symbolizer.json': enc(
        JSON.stringify([
          { Address: '0x100', Symbol: [{ FileName: '/src/a.cpp', FunctionName: 'fa', Line: 2 }] },
          { Address: '0x104', Symbol: [{ FileName: '/src/b.cpp', FunctionName: 'fb', Line: 3 }] },
          { Address: '0x108', Symbol: [{ FileName: '/src/a.cpp', FunctionName: 'fa', Line: 0 }] },
        ]),
      ),
      'a.cpp': enc('line1\nline2\n'),
      'b.cpp': enc('b1\nb2\nb3\n'),
    });
    expect(model).not.toBeNull();
    expect(model!.files.map((f) => f.id)).toEqual(['a.cpp', 'b.cpp']);
    expect(model!.files[0]!.text).toContain('line2');
    expect(model!.sourceToAsm['a.cpp:2']).toEqual([1]);
    expect(model!.sourceToAsm['b.cpp:3']).toEqual([2]);
    expect(model!.sourceToAsm['a.cpp:0']).toBeUndefined();
    expect(model!.asmToSource[1]).toEqual({ fileId: 'a.cpp', line: 2 });
    expect(model!.asmToSource[3]).toBeUndefined();
  });

  it('rolls stall and instructions up by sum and averages warp occupancy, including 0', async () => {
    const enc = (text: string) => new TextEncoder().encode(text);
    const summary = await pcSamplingDb([
      { pc: '0x100', stall: 10, instr: 4, occ: 0 },
      { pc: '0x104', stall: 30, instr: 6, occ: 1 },
      { pc: '0x108', stall: 99, instr: 50, occ: 0.5 },
    ]);
    const model = adaptSourceCorrelation({
      'objdump.txt': enc(
        ['     100:\t11111111\tADD r0, r1', '     104:\t22222222\tADD r2, r3', '     108:\t33333333\tNOP'].join(
          '\n',
        ),
      ),
      'symbolizer.json': enc(
        JSON.stringify([
          { Address: '0x100', Symbol: [{ FileName: '/src/a.cpp', FunctionName: 'fa', Line: 2 }] },
          { Address: '0x104', Symbol: [{ FileName: '/src/a.cpp', FunctionName: 'fa', Line: 2 }] },
          { Address: '0x108', Symbol: [{ FileName: '/src/a.cpp', FunctionName: 'fa', Line: 0 }] },
        ]),
      ),
      'a.cpp': enc('line1\nline2\n'),
      'summary.db': summary,
    });
    const line2 = model!.files[0]!.lines[1]!;
    expect(line2.values.samplingStall).toBe(40);
    expect(line2.values.instructionsExecuted).toBe(10);
    expect(line2.values.warpOccupancy).toBe(0.5);
    expect(line2.stallBreakdown?.find((row) => row.metric === 'IBuf Empty')?.value).toBe(40);
    // Line <= 0 stays unmapped: its counters stay on the asm row and off the source file.
    expect(model!.files[0]!.lines[0]!.values.samplingStall).toBe(0);
    expect(model!.files[0]!.lines[0]!.values.instructionsExecuted).toBe(0);
    expect(model!.asmToSource[3]).toBeUndefined();
    expect(model!.assembly.lines[2]!.values.samplingStall).toBe(99);
    expect(model!.assembly.lines[2]!.values.warpOccupancy).toBe(0.5);
    expect(model!.assembly.lines[0]!.values.warpOccupancy).toBe(0);
  });

  it('a NULL warp occupancy stays out of the source-line mean', async () => {
    const enc = (text: string) => new TextEncoder().encode(text);
    const summary = await pcSamplingDb([
      { pc: '0x100', stall: 5, instr: 1, occ: null },
      { pc: '0x104', stall: 5, instr: 1, occ: 0.4 },
    ]);
    const model = adaptSourceCorrelation({
      'objdump.txt': enc(['     100:\t11111111\tADD r0, r1', '     104:\t22222222\tADD r2, r3'].join('\n')),
      'symbolizer.json': enc(
        JSON.stringify([
          { Address: '0x100', Symbol: [{ FileName: 'a.cpp', FunctionName: 'fa', Line: 1 }] },
          { Address: '0x104', Symbol: [{ FileName: 'a.cpp', FunctionName: 'fa', Line: 1 }] },
        ]),
      ),
      'a.cpp': enc('line1\n'),
      'summary.db': summary,
    });
    expect(model!.files[0]!.lines[0]!.values.warpOccupancy).toBe(0.4);
    expect(model!.assembly.lines[0]!.values.warpOccupancy).toBe(0);
    expect(model!.assembly.lines[1]!.values.warpOccupancy).toBe(0.4);
  });

  it('PR-SRC-007: parseObjdump counts gather_2d instructions', () => {
    const text = readFileSync(join(gather, 'objdump.txt'), 'utf8');
    expect(parseObjdump(text).length).toBe(124);
  });

  it('PR-SRC-008: gather_2d.npu-rep load yields real sourceCorrelation (with .asc embed)', async () => {
    const bytes = new Uint8Array(readFileSync(join(root, 'data/gather_2d.npu-rep')));
    const adapted = loadReportSource(bytes);
    expect(adapted.capabilities).toContain('sourceTab');
    expect(adapted.reportModel.sourceCorrelation?.mock).toBe(false);
    expect(adapted.reportModel.sourceCorrelation?.files[0]?.text).toContain('gather_2d_custom');
    expect(Object.keys(adapted.reportModel.sourceCorrelation?.sourceToAsm ?? {}).length).toBeGreaterThan(
      0,
    );
  });

  it('corrupt summary.db keeps compute model with zero stalls', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const payloads = loadGatherPayloads();
    payloads['summary.db'] = new Uint8Array([1, 2, 3, 4]);
    const model = adaptSourceCorrelation(payloads);
    expect(model).not.toBeNull();
    expect(model!.mock).toBe(false);
    expect(model!.assembly.lines.every((l) => l.values.samplingStall === 0)).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('uninitialized sql.js keeps compute model with zero stalls', async () => {
    const { configurePcSamplingSql } = await import('./readPcSamplingDb');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Reset module sql state so isPcSamplingSqlReady() is false.
    configurePcSamplingSql({});
    const model = adaptSourceCorrelation(loadGatherPayloads());
    expect(model).not.toBeNull();
    expect(model!.mock).toBe(false);
    expect(model!.assembly.lines.every((l) => l.values.samplingStall === 0)).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    // Restore for any later tests in this file (none after, but keep suite isolation).
    configurePcSamplingSqlForNodeTests();
    await ensurePcSamplingSql();
  });
});
