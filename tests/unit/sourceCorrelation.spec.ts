import { describe, expect, it } from 'vitest';
import {
  adaptChromeTrace,
  adaptRep,
  adaptSourceCorrelation,
  mockSourceCorrelation,
  parseRep,
} from '../../src/index';
import { loadOutRepBytes } from '../helpers/fixtures';

describe('PR-SRC: source correlation adapter', () => {
  it('PR-SRC-001: adaptSourceCorrelation returns null on out.rep payloads', () => {
    const parsed = parseRep(loadOutRepBytes());
    expect(adaptSourceCorrelation(parsed.payloads)).toBeNull();
  });

  it('PR-SRC-002: mockSourceCorrelation is deterministic with bidirectional maps', () => {
    const a = mockSourceCorrelation();
    const b = mockSourceCorrelation();
    expect(a).toEqual(b);
    expect(a.mock).toBe(true);
    expect(a.files.length).toBeGreaterThan(0);
    expect(a.files[0]!.language).toBe('cpp');
    expect(a.files[0]!.path).toMatch(/\.cpp$/);
    expect(a.files[0]!.text.split(/\r?\n/).length).toBeGreaterThanOrEqual(100);
    expect(a.assembly.lines.length).toBeGreaterThan(0);
    expect(a.assembly.metricsColumns.map((c) => c.id)).toEqual([
      'address',
      'assembly',
      'instructionsExecuted',
      'samplingStall',
      'warpOccupancy',
    ]);
    expect(a.assembly.lines[0]!.values.assembly).toBeTruthy();
    expect(Object.keys(a.sourceToAsm).length).toBeGreaterThan(0);
    for (const [key, asmLines] of Object.entries(a.sourceToAsm)) {
      const line = Number(key.split(':')[1]);
      for (const asm of asmLines) {
        expect(a.asmToSource[asm]).toEqual({ fileId: a.files[0]!.id, line });
      }
    }
    expect(a.navigateBy.length).toBeGreaterThan(0);
  });

  it('PR-SRC-003: adaptRep fills mock sourceCorrelation and sourceTab', () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    expect(adapted.reportModel.sourceCorrelation).toBeDefined();
    expect(adapted.reportModel.sourceCorrelation!.mock).toBe(true);
    expect(adapted.capabilities).toContain('sourceTab');
  });

  it('PR-SRC-004: adaptChromeTrace omits sourceCorrelation and sourceTab', () => {
    const trace = {
      traceEvents: [
        { name: 'op', cat: 'x', ph: 'X', ts: 0, dur: 1000, pid: 1, tid: 1 },
      ],
    };
    const adapted = adaptChromeTrace(trace);
    expect(adapted.reportModel.sourceCorrelation).toBeUndefined();
    expect(adapted.capabilities ?? []).not.toContain('sourceTab');
  });
});
