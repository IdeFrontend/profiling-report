import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { adaptSourceCorrelation } from './adaptSourceCorrelation';
import { ensurePcSamplingSql } from './readPcSamplingDb';
import { parseObjdump } from './parseObjdump';
import { configurePcSamplingSqlForNodeTests } from '../../../tests/helpers/sqlJsNode';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const gather = join(root, 'data/gather_2d');

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
    expect(hot?.stallBreakdown?.length).toBeGreaterThan(0);
  });

  it('PR-SRC-006: symbolizer Line 0 does not invent sourceToAsm entries', () => {
    const model = adaptSourceCorrelation(loadGatherPayloads())!;
    // gather_2d sample ships Line:0 for every site — maps stay empty until producer lines land.
    expect(Object.keys(model.sourceToAsm)).toHaveLength(0);
    expect(Object.keys(model.asmToSource)).toHaveLength(0);
  });

  it('PR-SRC-007: parseObjdump counts gather_2d instructions', () => {
    const text = readFileSync(join(gather, 'objdump.txt'), 'utf8');
    expect(parseObjdump(text).length).toBe(124);
  });
});
