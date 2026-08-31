import { describe, expect, it } from 'vitest';
import { buildCannbotPayload, CANNBOT_PROMPT } from '../../src/domain/cannbot';
import type { ReportViewModel } from '../../src/domain/types';

function makeFullReport(): ReportViewModel {
  return {
    summary: { opName: 'matmul_v3' },
    pipeOccupancy: [{ id: 'cube', label: 'Cube', ratio: 0.62, colorKey: 'cube' }],
    overviewSeries: [],
    computeTables: [
      { fileName: 'PipeUtilization.csv', headers: ['block_id'], rows: [], blockIds: ['0'] },
    ],
    memoryTables: [{ fileName: 'Memory.csv', headers: ['block_id'], rows: [], blockIds: ['0'] }],
    csvTexts: {
      'PipeUtilization.csv': 'pipe csv text',
      'Memory.csv': 'memory csv text',
      'Other.csv': 'other csv text',
    },
    bandwidthCards: [{ id: 'input', sides: [{ side: 'aic', measuredGBs: 12, peakGBs: 34 }] }],
    roofline: { points: [], mixLabels: [], peakComputeTops: 256, peakBandwidthGBs: 1200 },
    hardwareDetails: { sections: [] },
    memoryTopology: { nodes: [], edges: [] },
  };
}

describe('PR-CANNBOT: payload assembly', () => {
  it('PR-CANNBOT-001: fixed fields and meta fallbacks', () => {
    const meta = {
      name: 'matmul_v3.r3',
      path: 'D:/ops/matmul_v3.r3.rep',
      id: 'rep-0042',
      collectedAt: '2026-08-13T09:41:00Z',
    };
    const payload = buildCannbotPayload('summary', makeFullReport(), meta);
    expect(payload.version).toBe('1.0');
    expect(payload.scope).toBe('summary');
    expect(payload.report_name).toBe('matmul_v3.r3');
    expect(payload.report_id).toBe('rep-0042');
    expect(payload.report_path).toBe('D:/ops/matmul_v3.r3.rep');
    expect(payload.collected_at).toBe('2026-08-13T09:41:00Z');
    expect(payload.op_name).toBe('matmul_v3');
    expect(payload.prompt).toBe(CANNBOT_PROMPT);

    const noMeta = buildCannbotPayload('compute', makeFullReport());
    expect(noMeta.report_name).toBe('');
    expect(noMeta.report_id).toBe('');
    expect(noMeta.report_path).toBe('');
    expect(noMeta.collected_at).toBe('');

    const nameOnly = buildCannbotPayload('compute', makeFullReport(), { name: 'matmul_v3.r3' });
    expect(nameOnly.report_id).toBe('matmul_v3.r3');

    const noReport = buildCannbotPayload('memory', null, meta);
    expect(noReport.op_name).toBe('');
    expect(noReport.data).toEqual({});
    expect(buildCannbotPayload('compute').data).toEqual({});
  });

  it('PR-CANNBOT-002: scope to data mapping reuses view model sections', () => {
    const report = makeFullReport();

    const summaryPayload = buildCannbotPayload('summary', report);
    expect(Object.keys(summaryPayload.data).sort()).toEqual([
      'bandwidthCards',
      'hardwareDetails',
      'memoryTopology',
      'pipeOccupancy',
      'roofline',
      'summary',
    ]);
    expect(summaryPayload.data.summary).toBe(report.summary);
    expect(summaryPayload.data.bandwidthCards).toBe(report.bandwidthCards);
    expect(summaryPayload.data.roofline).toBe(report.roofline);
    expect(summaryPayload.data.pipeOccupancy).toBe(report.pipeOccupancy);
    expect(summaryPayload.data.memoryTopology).toBe(report.memoryTopology);
    expect(summaryPayload.data.hardwareDetails).toBe(report.hardwareDetails);

    const computePayload = buildCannbotPayload('compute', report);
    expect(Object.keys(computePayload.data).sort()).toEqual([
      'computeTables',
      'csvTexts',
      'pipeOccupancy',
    ]);
    expect(computePayload.data.pipeOccupancy).toBe(report.pipeOccupancy);
    expect(computePayload.data.computeTables).toBe(report.computeTables);
    expect(computePayload.data.csvTexts).toEqual({ 'PipeUtilization.csv': 'pipe csv text' });

    const memoryPayload = buildCannbotPayload('memory', report);
    expect(Object.keys(memoryPayload.data).sort()).toEqual([
      'bandwidthCards',
      'csvTexts',
      'memoryTables',
      'memoryTopology',
    ]);
    expect(memoryPayload.data.memoryTables).toBe(report.memoryTables);
    expect(memoryPayload.data.memoryTopology).toBe(report.memoryTopology);
    expect(memoryPayload.data.bandwidthCards).toBe(report.bandwidthCards);
    expect(memoryPayload.data.csvTexts).toEqual({ 'Memory.csv': 'memory csv text' });

    for (const payload of [summaryPayload, computePayload, memoryPayload]) {
      expect(Object.values(payload.data).every((v) => v !== undefined)).toBe(true);
    }

    const bare: ReportViewModel = {
      summary: {},
      pipeOccupancy: [],
      overviewSeries: [],
      computeTables: [],
      memoryTables: [],
      csvTexts: {},
    };
    expect(Object.keys(buildCannbotPayload('summary', bare).data).sort()).toEqual([
      'pipeOccupancy',
      'summary',
    ]);
    expect(Object.keys(buildCannbotPayload('compute', bare).data).sort()).toEqual([
      'computeTables',
      'pipeOccupancy',
    ]);
    expect(Object.keys(buildCannbotPayload('memory', bare).data).sort()).toEqual(['memoryTables']);
  });
});
