import { describe, expect, it } from 'vitest';
import { loadReportSource } from '../../src/index';
import type { AdaptedReport, SwimlaneModel } from '../../src/domain/types';
import { loadSampleRepBytes } from '../helpers/fixtures';

function eventCount(model: SwimlaneModel): number {
  return model.processes.reduce(
    (a, p) => a + p.threads.reduce((b, t) => b + t.events.length, 0),
    0,
  );
}

function connectionRefCount(model: SwimlaneModel): number {
  let n = 0;
  for (const process of model.processes) {
    for (const thread of process.threads) {
      for (const event of thread.events) {
        n += (event.dependencies?.successors.length ?? 0) + (event.dependencies?.predecessors.length ?? 0);
      }
    }
  }
  return n;
}

function requireOperator(reports: Record<string, AdaptedReport> | undefined, id: string): AdaptedReport {
  const report = reports?.[id];
  if (!report) throw new Error(`missing operator report ${id}`);
  return report;
}

describe('PR-NPU-006: sample.rep distinct operators', () => {
  const adapted = loadReportSource(loadSampleRepBytes());
  const op1 = requireOperator(adapted.operatorReports, 'op1.npu.rep');
  const op2 = requireOperator(adapted.operatorReports, 'op2.npu.rep');

  it('loads as a multi-op container with op1/op2', () => {
    expect(adapted.operators?.map((o) => o.id)).toEqual(['op1.npu.rep', 'op2.npu.rep']);
    expect(adapted.operators?.map((o) => o.label)).toEqual(['op1', 'op2']);
    expect(adapted.selectedOperatorId).toBe('op1.npu.rep');
  });

  it('op1 and op2 carry distinct traces with distinct event counts', () => {
    expect(eventCount(op1.swimlaneModel)).toBeLessThan(eventCount(op2.swimlaneModel));
  });

  it('both operators expose dependency connections', () => {
    expect(op1.capabilities).toContain('dependencies');
    expect(op2.capabilities).toContain('dependencies');
    expect(connectionRefCount(op1.swimlaneModel)).toBeGreaterThan(0);
    expect(connectionRefCount(op2.swimlaneModel)).toBeGreaterThan(0);
  });

  it('op1 and op2 carry different CSV content', () => {
    expect(op1.reportModel.summary.opName).toBe('add_custom');
    expect(op2.reportModel.summary.opName).toBe('matmul_mock');
    expect(op1.reportModel.summary.blockDim).not.toBe(op2.reportModel.summary.blockDim);
  });

  it('both operators expose Cube-side pipe occupancy (MIX Cube tab)', () => {
    for (const report of [op1, op2]) {
      expect(report.reportModel.summary.opType?.toLowerCase()).toBe('mix');
      const cube = report.reportModel.pipeOccupancy.filter((p) => p.side === 'cube');
      expect(cube.length).toBeGreaterThan(0);
      expect(cube.some((p) => p.id === 'cube' && p.ratio > 0)).toBe(true);
      expect(cube.some((p) => p.id === 'mte2' && p.ratio > 0)).toBe(true);
    }
    const cube1 = op1.reportModel.pipeOccupancy.find((p) => p.id === 'cube' && p.side === 'cube');
    const cube2 = op2.reportModel.pipeOccupancy.find((p) => p.id === 'cube' && p.side === 'cube');
    expect(cube1?.ratio).toBeGreaterThan(0);
    expect(cube2?.ratio).toBeGreaterThan(0);
    expect(cube1?.ratio).not.toBe(cube2?.ratio);
  });
});
