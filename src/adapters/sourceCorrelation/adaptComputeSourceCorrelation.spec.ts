import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { adaptSourceCorrelation } from './adaptSourceCorrelation';
import { parseObjdump } from './parseObjdump';
import { loadReportSource } from '../loadReportSource';

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
});
