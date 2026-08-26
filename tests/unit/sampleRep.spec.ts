import { describe, expect, it } from 'vitest';
import { loadReportSource } from '../../src/index';
import type { AdaptedReport, SwimlaneModel, SwimThread } from '../../src/domain/types';
import { collectLeafEventsFromModel, isFolderNode } from '../../src/domain/swimTree';
import { loadOutRepBytes, loadSampleRepBytes, liteSampleRepByteLength } from '../helpers/fixtures';

function walkThreads(threads: SwimThread[], visit: (thread: SwimThread) => void): void {
  for (const thread of threads) {
    visit(thread);
    if (thread.children?.length) walkThreads(thread.children, visit);
  }
}

function connectionRefCount(model: SwimlaneModel): number {
  let n = 0;
  for (const process of model.processes) {
    walkThreads(process.threads, (thread) => {
      for (const event of thread.events) {
        n += (event.dependencies?.successors.length ?? 0) + (event.dependencies?.predecessors.length ?? 0);
      }
    });
  }
  return n;
}

function threadsById(model: SwimlaneModel): Map<string, SwimThread> {
  const map = new Map<string, SwimThread>();
  for (const process of model.processes) {
    walkThreads(process.threads, (thread) => map.set(thread.id, thread));
  }
  return map;
}

function dependencyDegrees(model: SwimlaneModel): Map<string, number> {
  const byId = threadsById(model);
  const deg = new Map<string, number>();
  const bump = (id: string) => deg.set(id, (deg.get(id) ?? 0) + 1);
  for (const process of model.processes) {
    walkThreads(process.threads, (thread) => {
      for (const event of thread.events) {
        if (!deg.has(event.id)) deg.set(event.id, 0);
        for (const ref of event.dependencies?.successors ?? []) {
          const target = byId.get(ref.tid)?.events[ref.index];
          if (!target) continue;
          bump(event.id);
          bump(target.id);
        }
      }
    });
  }
  return deg;
}

function requireOperator(reports: Record<string, AdaptedReport> | undefined, id: string): AdaptedReport {
  const report = reports?.[id];
  if (!report) throw new Error(`missing operator report ${id}`);
  return report;
}

describe('PR-NPU-006: sample.rep distinct operators', () => {
  it('committed sample.rep is lite (op2 trace generated at hydrate time)', () => {
    expect(liteSampleRepByteLength()).toBeLessThan(500_000);
  });

  const adapted = loadReportSource(loadSampleRepBytes());
  const op1 = requireOperator(adapted.operatorReports, 'op1.npu.rep');
  const op2 = requireOperator(adapted.operatorReports, 'op2.npu.rep');

  it('loads as a multi-op container with op1/op2', () => {
    expect(adapted.operators?.map((o) => o.id)).toEqual(['op1.npu.rep', 'op2.npu.rep']);
    expect(adapted.operators?.map((o) => o.label)).toEqual(['op1', 'op2']);
    expect(adapted.selectedOperatorId).toBe('op1.npu.rep');
  });

  it('op1 and op2 carry distinct traces with distinct event counts', () => {
    expect(collectLeafEventsFromModel(op1.swimlaneModel).length).toBeLessThan(
      collectLeafEventsFromModel(op2.swimlaneModel).length,
    );
    // op2 is the large rendering-performance fixture (~150k X events).
    expect(collectLeafEventsFromModel(op2.swimlaneModel).length).toBeGreaterThanOrEqual(140_000);
    expect(collectLeafEventsFromModel(op2.swimlaneModel).length).toBeLessThanOrEqual(160_000);
  });

  it('both operators expose dependency connections', () => {
    expect(op1.capabilities).toContain('dependencies');
    expect(op2.capabilities).toContain('dependencies');
    expect(connectionRefCount(op1.swimlaneModel)).toBeGreaterThan(0);
    expect(connectionRefCount(op2.swimlaneModel)).toBeGreaterThan(0);
  });

  it('op1 gives every event 3–8 dependency neighbors', () => {
    const deg = dependencyDegrees(op1.swimlaneModel);
    expect(deg.size).toBeGreaterThan(50);
    for (const [id, n] of deg) {
      expect(n, id).toBeGreaterThanOrEqual(3);
      expect(n, id).toBeLessThanOrEqual(8);
    }
  });

  it('op2 gives every event 1–4 dependency neighbors', () => {
    const deg = dependencyDegrees(op2.swimlaneModel);
    expect(deg.size).toBeGreaterThanOrEqual(140_000);
    for (const [id, n] of deg) {
      expect(n, id).toBeGreaterThanOrEqual(1);
      expect(n, id).toBeLessThanOrEqual(4);
    }
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

  it('nests Card → 计算 → Core0.Cube → pipe leaves', () => {
    expect(op1.swimlaneModel.metadata?.nestCardTree).toBe(true);
    for (const report of [op1, op2]) {
      const card = report.swimlaneModel.processes[0]!;
      expect(card.threads.map((t) => t.name)).toEqual(['通信', '计算', '储存HBM']);
      const compute = card.threads.find((t) => t.name === '计算')!;
      expect(isFolderNode(compute)).toBe(true);
      const cube = compute.children!.find((c) => c.name === 'Core0.Cube');
      expect(cube && isFolderNode(cube)).toBe(true);
      expect(cube!.children!.some((p) => !isFolderNode(p) && p.events.length > 0)).toBe(true);
    }
  });

  it('ordinary .rep stays flat (no invented nesting)', () => {
    const flat = loadReportSource(loadOutRepBytes());
    const m = flat.swimlaneModel!;
    expect(m.metadata?.nestCardTree).toBeUndefined();
    expect(m.metadata?.defaultCollapsedIds).toBeUndefined();
    expect(m.processes[0]!.threads.map((t) => t.name)).not.toContain('计算');
  });

  it('nested Vec0/MTE3 gutter util uses mte3 ratio, not vector', () => {
    const compute = op1.swimlaneModel.processes[0]!.threads.find((t) => t.name === '计算')!;
    const vec0 = compute.children!.find((c) => c.name === 'Core0.Vec0')!;
    const mte3 = vec0.children!.find((c) => c.name === 'MTE3')!;
    const all = vec0.children!.find((c) => c.name === 'ALL');
    const mte3Items = op1.reportModel.pipeOccupancy.filter((p) => p.colorKey === 'mte3');
    const vecItems = op1.reportModel.pipeOccupancy.filter((p) => p.colorKey === 'vector');
    expect(mte3Items.length).toBeGreaterThan(0);
    expect(vecItems.length).toBeGreaterThan(0);
    const mte3Mean = mte3Items.reduce((a, p) => a + p.ratio, 0) / mte3Items.length;
    const vecMean = vecItems.reduce((a, p) => a + p.ratio, 0) / vecItems.length;
    expect(mte3.utilization).toBeCloseTo(mte3Mean);
    expect(mte3.utilization).not.toBeCloseTo(vecMean);
    // ALL has no PipeUtilization colorKey — util must stay unset (not vector).
    expect(all?.utilization).toBeUndefined();
  });

  it('op1/op2 include ProfilerStep bands (stress-style group labels)', () => {
    expect(op1.swimlaneModel.bands?.map((b) => b.name)).toEqual([
      'ProfilerStep#1',
      'ProfilerStep#2',
      'ProfilerStep#3',
    ]);
    expect(op2.swimlaneModel.bands?.map((b) => b.name)).toEqual([
      'ProfilerStep#1',
      'ProfilerStep#2',
      'ProfilerStep#3',
      'ProfilerStep#4',
      'ProfilerStep#5',
    ]);
    expect(op2.swimlaneModel.bands![0]!.startTime).toBe(0);
    const last = op2.swimlaneModel.bands![op2.swimlaneModel.bands!.length - 1]!;
    expect(last.startTime + last.duration).toBe(1_000_000_000);
  });

  it('events carry producer Parameter fields (Code / Pc_addr / …)', () => {
    const events = collectLeafEventsFromModel(op1.swimlaneModel);
    expect(events.length).toBeGreaterThan(0);
    const withParams = events.filter(
      (e) => e.args?.Pc_addr != null && e.args?.Detail != null && e.args?.Code != null,
    );
    expect(withParams.length).toBe(events.length);
    expect(String(withParams[0]!.args!.Pc_addr)).toMatch(/^0x[0-9a-f]+$/i);
    expect(Array.isArray(withParams[0]!.args!.Code)).toBe(true);
  });
});
