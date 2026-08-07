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

    expect(summary.computeTflops).toBeUndefined();
    expect(summary.ioBandwidth).toBeUndefined();
    expect(summary.avgCoreUtil).toBeUndefined();
  });

  it('PR-VM-002 (interim I-Q6b): PipeUtilization → PIPE bars mean of non-NA', () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const byId = Object.fromEntries(
      adapted.reportModel.pipeOccupancy.map((p) => [p.id, p]),
    );

    expect(byId.vector).toMatchObject({ label: expect.any(String), colorKey: 'vector' });
    expect(byId.vector.ratio).toBeCloseTo(0.067157625, 5);

    expect(byId.mte2.ratio).toBeCloseTo(0.3812395, 5);
    expect(byId.mte3.ratio).toBeCloseTo(0.1621495, 5);
    expect(byId.scalar.ratio).toBeCloseTo(0.33244325, 5);

    // AIC cube/mte1/fixp all-NA in fixture → omit or no invented zeros as occupancy
    expect(byId.cube).toBeUndefined();

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

  it('PR-VM-005: pipe occupancy items include side for Cube|Vector filtering', () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    for (const pipe of adapted.reportModel.pipeOccupancy) {
      expect(['cube', 'vector', 'both']).toContain(pipe.side);
    }
    expect(adapted.reportModel.pipeOccupancy.find((p) => p.id === 'vector')?.side).toBe('vector');
    expect(adapted.reportModel.pipeOccupancy.find((p) => p.id === 'mte2')?.side).toBe('both');
  });
});