import { describe, expect, it } from 'vitest';
import { loadReportSource, parseRep } from '../../src/index';
import { operatorsFromNestedNames } from '../../src/adapters/loadReportSource';
import { packNpuRep160, NPU160_TYPE_CSV, NPU160_TYPE_JSON, NPU160_TYPE_NESTED } from '../../playground/packNpuRep160';
import { loadNpuRepBytes, loadOutRepBytes, loadOutTraceBytes, loadResultNpuRepBytes } from '../helpers/fixtures';

describe('PR-JSON: standalone Chrome Trace', () => {
  it('PR-JSON-001: loads CTEF JSON without report aside data (PROC-3)', () => {
    const adapted = loadReportSource(loadOutTraceBytes());
    expect(adapted.swimlaneModel!.processes.length).toBeGreaterThan(0);
    expect(adapted.swimlaneModel!.minTime).toBeLessThan(adapted.swimlaneModel!.maxTime);
    expect(adapted.reportModel.summary).toEqual({});
    expect(adapted.reportModel.pipeOccupancy).toEqual([]);
    expect(adapted.reportModel.overviewSeries).toEqual([]);
    expect(adapted.swimlaneModel!.processes[0]?.threads[0]?.utilization).toBeUndefined();
    expect(adapted.swimlaneModel!.bands).toBeUndefined();
  });

  it('PR-JSON-002: loadReportSource still accepts .rep bytes', () => {
    const adapted = loadReportSource(loadOutRepBytes());
    expect(adapted.reportModel.summary.opName).toBe('add_custom');
    expect(adapted.reportModel.pipeOccupancy.length).toBeGreaterThan(0);
  });

  it('PR-NPU-004: loadReportSource loads multi-op npu-rep (default first operator)', () => {
    const adapted = loadReportSource(loadNpuRepBytes());
    expect(adapted.operators?.map((o) => o.id)).toEqual(['op1.npu.rep', 'op2.npu.rep']);
    expect(adapted.operators?.map((o) => o.label)).toEqual(['op1', 'op2']);
    expect(adapted.selectedOperatorId).toBe('op1.npu.rep');
    expect(adapted.reportModel.summary.opName).toBe('add_custom');
    expect(adapted.swimlaneModel!.processes.length).toBeGreaterThan(0);
    expect(adapted.operatorReports?.['op2.npu.rep']?.reportModel.summary.opName).toBe('add_custom');
  });

  it('PR-NPU-005: duplicate operator stems throw', () => {
    expect(() => operatorsFromNestedNames(['op1.npu.rep', 'op1.rep'])).toThrow(
      /duplicate operator stem "op1"/,
    );
    expect(operatorsFromNestedNames(['op1.npu.rep', 'op2.npu.rep'])).toEqual([
      { id: 'op1.npu.rep', label: 'op1' },
      { id: 'op2.npu.rep', label: 'op2' },
    ]);
  });

  it('PR-NPU-008: loadReportSource routes 160-byte leaf to a full single-op report', () => {
    // Build a flat 160-byte leaf from out.rep payloads (adds the trace.json the
    // committed data/result.npu-rep omits).
    const payloads = parseRep(loadOutRepBytes()).payloads;
    const entries = Object.entries(payloads).map(([name, data]) => ({
      name,
      type: name.endsWith('.csv') ? NPU160_TYPE_CSV : NPU160_TYPE_JSON,
      data,
    }));
    const leaf = packNpuRep160(entries);

    const adapted = loadReportSource(leaf);
    expect(adapted.operators).toBeUndefined();
    expect(adapted.reportModel.summary.opName).toBe('add_custom');
    expect(adapted.reportModel.pipeOccupancy.length).toBeGreaterThan(0);
    expect(adapted.swimlaneModel!.processes.length).toBeGreaterThan(0);
  });

  it('PR-NPU-009: metrics-only 160-byte sample adapts with a null swimlane (no hard error)', () => {
    // data/result.npu-rep is a partial metric pack (no trace.json / OpBasicInfo):
    // it must adapt to a metrics-only report (null swimlane + populated aside)
    // rather than throwing, so the viewer can render the aside without a timeline.
    const adapted = loadReportSource(loadResultNpuRepBytes());
    expect(adapted.swimlaneModel).toBeNull();
    expect(adapted.reportModel.pipeOccupancy.length).toBeGreaterThan(0);
    expect(adapted.reportModel.memoryTables.length).toBeGreaterThan(0);
    expect(adapted.reportModel.hardwareDetails).toBeDefined();
    expect(adapted.operators).toBeUndefined();
  });

  it('PR-NPU-008: loadReportSource routes nested 160-byte container to multi-op report', () => {
    const payloads = parseRep(loadOutRepBytes()).payloads;
    const toEntries = () =>
      Object.entries(payloads).map(([name, data]) => ({
        name,
        type: name.endsWith('.csv') ? NPU160_TYPE_CSV : NPU160_TYPE_JSON,
        data,
      }));

    const op1 = packNpuRep160(toEntries());
    const op2 = packNpuRep160(toEntries());
    const outer = packNpuRep160([
      { name: 'op1.npu.rep', type: NPU160_TYPE_NESTED, data: op1 },
      { name: 'op2.npu.rep', type: NPU160_TYPE_NESTED, data: op2 },
    ]);

    const adapted = loadReportSource(outer);
    expect(adapted.operators?.map((o) => o.id)).toEqual(['op1.npu.rep', 'op2.npu.rep']);
    expect(adapted.operators?.map((o) => o.label)).toEqual(['op1', 'op2']);
    expect(adapted.selectedOperatorId).toBe('op1.npu.rep');
    expect(adapted.reportModel.summary.opName).toBe('add_custom');
    expect(adapted.operatorReports?.['op2.npu.rep']?.reportModel.summary.opName).toBe('add_custom');
  });
});
