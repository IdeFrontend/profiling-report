import { describe, expect, it } from 'vitest';
import { loadReportSource } from '../../src/index';
import { loadNpuRepBytes, loadOutRepBytes, loadOutTraceBytes } from '../helpers/fixtures';

describe('PR-JSON: standalone Chrome Trace', () => {
  it('PR-JSON-001: loads CTEF JSON without report aside data (Q15)', () => {
    const adapted = loadReportSource(loadOutTraceBytes());
    expect(adapted.swimlaneModel.processes.length).toBeGreaterThan(0);
    expect(adapted.swimlaneModel.minTime).toBeLessThan(adapted.swimlaneModel.maxTime);
    expect(adapted.reportModel.summary).toEqual({});
    expect(adapted.reportModel.pipeOccupancy).toEqual([]);
    expect(adapted.reportModel.overviewSeries).toEqual([]);
    expect(adapted.swimlaneModel.processes[0]?.threads[0]?.utilization).toBeUndefined();
    expect(adapted.swimlaneModel.bands).toBeUndefined();
  });

  it('PR-JSON-002: loadReportSource still accepts .rep bytes', () => {
    const adapted = loadReportSource(loadOutRepBytes());
    expect(adapted.reportModel.summary.opName).toBe('add_custom');
    expect(adapted.reportModel.pipeOccupancy.length).toBeGreaterThan(0);
  });

  it('PR-NPU-004: loadReportSource loads multi-op npu-rep (default first operator)', () => {
    const adapted = loadReportSource(loadNpuRepBytes());
    expect(adapted.operators?.map((o) => o.id)).toEqual(['op1', 'op2']);
    expect(adapted.selectedOperatorId).toBe('op1');
    expect(adapted.reportModel.summary.opName).toBe('add_custom');
    expect(adapted.swimlaneModel.processes.length).toBeGreaterThan(0);
    expect(adapted.operatorReports?.['op2']?.reportModel.summary.opName).toBe('add_custom');
  });
});
