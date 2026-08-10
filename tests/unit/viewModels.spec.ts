import { describe, expect, it } from 'vitest';
import { adaptRep, parseRep } from '../../src/index';
import { loadOutRepBytes } from '../helpers/fixtures';

describe('PR-VM: report view-models (interim)', () => {
  it('PR-VM-001 (interim I-Q6a): OpBasicInfo → thin summary only', () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const { summary } = adapted.reportModel;

    expect(summary.opName).toBe('add_custom');
    expect(summary.opType).toBe('vector');
    expect(summary.taskDurationUs).toBeCloseTo(1.800036, 5);
    expect(summary.currentFreq).toBe(1650);
    expect(summary.ratedFreq).toBe(1650);
    expect(summary.blockDim).toBe(8);

    expect(summary.computeTflops).toBeUndefined();
    expect(summary.ioBandwidth).toBeUndefined();
    expect(summary.avgCoreUtil).toBeUndefined();
  });

  it('PR-VM-002 (interim I-Q6b): PipeUtilization → PIPE bars mean of non-NA', () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const vectorPipes = adapted.reportModel.pipeOccupancy.filter((p) => p.side === 'vector');
    const byId = Object.fromEntries(vectorPipes.map((p) => [p.id, p]));

    expect(byId.vector).toMatchObject({ label: expect.any(String), colorKey: 'vector', side: 'vector' });
    expect(byId.vector.ratio).toBeCloseTo(0.067157625, 5);

    expect(byId.mte2.ratio).toBeCloseTo(0.3812395, 5);
    expect(byId.mte3.ratio).toBeCloseTo(0.1621495, 5);
    expect(byId.scalar.ratio).toBeCloseTo(0.33244325, 5);

    // AIC cube/mte1/fixp all-NA in fixture → no cube-side occupancy
    expect(adapted.reportModel.pipeOccupancy.filter((p) => p.side === 'cube')).toEqual([]);

    // Gutter util comes from PIPE ratios, not busy-fraction heuristics
    const pipeLane = adapted.swimlaneModel.processes
      .flatMap((p) => p.threads)
      .find((t) => t.name.includes('PIPE_V'));
    expect(pipeLane?.utilization).toBeCloseTo(byId.vector.ratio, 5);
  });

  it('PR-VM-003 (interim I-Q5+): overviewSeries empty — not invented from PipeUtilization', () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    expect(adapted.reportModel.overviewSeries).toEqual([]);
  });

  it('PR-VM-005: pipe occupancy items are side-specific (no AIC/AIV blend)', () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    for (const pipe of adapted.reportModel.pipeOccupancy) {
      expect(['cube', 'vector']).toContain(pipe.side);
    }
    expect(adapted.reportModel.pipeOccupancy.find((p) => p.id === 'vector')?.side).toBe('vector');
    expect(
      adapted.reportModel.pipeOccupancy.filter((p) => p.id === 'mte2').every((p) => p.side === 'vector'),
    ).toBe(true);
  });

  it('PR-VM-006: computeTables for PipeUtilization / ArithmeticUtilization / ResourceConflictRatio', () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const byName = Object.fromEntries(
      adapted.reportModel.computeTables.map((t) => [t.fileName, t]),
    );

    expect(Object.keys(byName).sort()).toEqual([
      'ArithmeticUtilization.csv',
      'PipeUtilization.csv',
      'ResourceConflictRatio.csv',
    ]);

    for (const name of Object.keys(byName)) {
      const table = byName[name]!;
      expect(table.headers.length).toBeGreaterThan(2);
      expect(table.headers).toContain('block_id');
      expect(table.rows.length).toBe(8);
      expect(table.blockIds).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
    }
  });

  it('PR-VM-007: memoryTables + csvTexts for 查看全部', () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const byName = Object.fromEntries(
      adapted.reportModel.memoryTables.map((t) => [t.fileName, t]),
    );

    expect(Object.keys(byName)).toEqual([
      'MemoryL0.csv',
      'L2Cache.csv',
      'Memory.csv',
      'MemoryUB.csv',
    ]);

    for (const table of adapted.reportModel.memoryTables) {
      expect(table.blockIds).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
      const text = adapted.reportModel.csvTexts[table.fileName];
      expect(text).toBeTruthy();
      expect(text!.startsWith(table.headers[0]!)).toBe(true);
    }

    expect(adapted.reportModel.csvTexts['PipeUtilization.csv']).toMatch(/^block_id,/);
  });
});
