import { describe, expect, it } from 'vitest';
import { mockSourceCorrelation } from '../../adapters/sourceCorrelation/mockSourceCorrelation';
import { inlineFunctionRows, sourceMarkerRows, sourceStatRows } from './sourceDockRows';

describe('sourceDockRows', () => {
  it('derives inline rows from sourceToAsm for the active file', () => {
    const model = mockSourceCorrelation();
    const rows = inlineFunctionRows(model, model.files[0]!);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.fileId === 'sharpen.cpp')).toBe(true);
    expect(rows.some((r) => r.line === 46 && r.asmCount === 3)).toBe(true);
  });

  it('lists stall markers ahead of hot-only lines when breakdown present', () => {
    const model = mockSourceCorrelation();
    const rows = sourceMarkerRows(model.files[0]!);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.kind).toBe('stall');
  });

  it('aggregates statistics for the source file', () => {
    const model = mockSourceCorrelation();
    const rows = sourceStatRows(model.files[0]!);
    expect(rows.map((r) => r.id)).toEqual(['lines', 'insn', 'stall', 'occ']);
    expect(Number(rows.find((r) => r.id === 'insn')!.value)).toBeGreaterThan(0);
  });
});
