/**
 * Emulate format / adaptEmulate acceptance tests.
 * @see specs/core/emulate-format.spec.md
 * @see specs/core/adapt-emulate.spec.md
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  adaptEmulate,
  isEmulateLeaf,
  loadReportSource,
  pipeOccupancyFromHist,
  pipeOccupancyFromPipesUtilization,
  summaryFromKernelInfo,
} from '../../src/index';
import {
  NPU160_TYPE_CSV,
  NPU160_TYPE_JSON,
  packNpuRep160,
} from '../../playground/packNpuRep160';

const enc = new TextEncoder();

function minimalTraceUs(): string {
  return JSON.stringify({
    traceEvents: [
      { ph: 'X', name: 'cube', pid: 1, tid: 1, ts: 0, dur: 100 },
      { ph: 'X', name: 'vector', pid: 1, tid: 2, ts: 10, dur: 80 },
    ],
  });
}

function emulateManifest(): string {
  return JSON.stringify({ profile: 'emulate', schemaVersion: 1, producer: 'npu_emulate' });
}

function exportCatalogManifest(): string {
  return JSON.stringify({
    database: '/tmp/npu_emulate/demo.db',
    exported_at: '2026-09-15T00:00:00+00:00',
    total_objects: 3,
    total_tables: 2,
    total_views: 1,
    total_rows: 10,
    objects: [
      { name: 'AnalysisState', type: 'table', row_count: 1, columns: [], file: 'AnalysisState.csv' },
      {
        name: 'ExecutedInstructions',
        type: 'table',
        row_count: 5,
        columns: [],
        file: 'ExecutedInstructions.csv',
      },
    ],
  });
}

function packEmulateLeaf(
  extra: { name: string; type: number; data: Uint8Array }[] = [],
): Uint8Array {
  return packNpuRep160([
    { name: 'manifest.json', type: NPU160_TYPE_JSON, data: enc.encode(emulateManifest()) },
    { name: 'PipeTrace.json', type: NPU160_TYPE_JSON, data: enc.encode(minimalTraceUs()) },
    ...extra,
  ]);
}

describe('emulate-format (PR-SIM-*)', () => {
  it('PR-SIM-001: manifest.json thin profile or export catalog classifies emulate leaf', () => {
    expect(
      isEmulateLeaf({
        'manifest.json': enc.encode(emulateManifest()),
        'PipeTrace.json': enc.encode(minimalTraceUs()),
      }),
    ).toBe(true);
    expect(isEmulateLeaf({ 'manifest.json': enc.encode(exportCatalogManifest()) })).toBe(true);
    expect(
      isEmulateLeaf({
        'EmulateManifest.json': enc.encode(emulateManifest()),
      }),
    ).toBe(true);
    expect(
      isEmulateLeaf({
        'manifest.json': enc.encode(JSON.stringify({ profile: 'compute', schemaVersion: 1 })),
      }),
    ).toBe(false);
    expect(isEmulateLeaf({ 'PipeTrace.json': enc.encode(minimalTraceUs()) })).toBe(false);
    expect(
      isEmulateLeaf({
        'manifest.json': enc.encode(
          JSON.stringify({ objects: [{ name: 'Unrelated', type: 'table', row_count: 1 }] }),
        ),
      }),
    ).toBe(false);
  });

  it('PR-SIM-002: marker + PipeTrace.json valid without compute metric CSVs', () => {
    const adapted = loadReportSource(packEmulateLeaf());
    expect(adapted.swimlaneModel).not.toBeNull();
    expect(adapted.reportModel.pipeOccupancy).toEqual([]);
    expect(adapted.reportModel.memoryTopology).toBeUndefined();
    expect(adapted.reportModel.roofline).toBeUndefined();
  });

  it('PR-SIM-003: PipeTrace.json contracted as µs (tick conversion is producer-side)', () => {
    const adapted = adaptEmulate({
      'manifest.json': enc.encode(emulateManifest()),
      'PipeTrace.json': enc.encode(minimalTraceUs()),
    });
    // 100 µs → 100_000 ns
    expect(adapted.swimlaneModel!.maxTime - adapted.swimlaneModel!.minTime).toBe(100_000);
  });

  it('PR-SIM-004: missing KernelInfo/summary → timeline-only, not invalid', () => {
    expect(() => loadReportSource(packEmulateLeaf())).not.toThrow();
    const adapted = loadReportSource(packEmulateLeaf());
    expect(adapted.reportModel.summary).toEqual({});
  });

  it('PR-SIM-005: missing PipeTrace → open with null swimlane (no throw)', () => {
    const adapted = adaptEmulate({
      'manifest.json': enc.encode(exportCatalogManifest()),
    });
    expect(adapted.swimlaneModel).toBeNull();
    expect(adapted.reportModel.pipeOccupancy).toEqual([]);
  });
});

describe('adapt-emulate (PR-ASIM-*)', () => {
  it('PR-ASIM-001: adaptEmulate builds swimlane from PipeTrace.json (µs)', () => {
    const adapted = adaptEmulate({
      'manifest.json': enc.encode(emulateManifest()),
      'PipeTrace.json': enc.encode(minimalTraceUs()),
    });
    expect(adapted.swimlaneModel!.processes.length).toBeGreaterThan(0);
  });

  it('PR-ASIM-002: no pipeOccupancy without util embeds; PipesUtilization fills bars', () => {
    const empty = adaptEmulate({
      'manifest.json': enc.encode(emulateManifest()),
      'PipeTrace.json': enc.encode(minimalTraceUs()),
    });
    expect(empty.reportModel.pipeOccupancy).toEqual([]);

    const withPipes = adaptEmulate({
      'manifest.json': enc.encode(emulateManifest()),
      'PipeTrace.json': enc.encode(minimalTraceUs()),
      'PipesUtilization.csv': enc.encode(
        'CoreId,CoreTypeId,InstrQueueTypeId,PipeUtilization\n0,AIC,Cube,0.5\n0,AIC,MTE2,0.25\n',
      ),
    });
    expect(withPipes.reportModel.pipeOccupancy.length).toBeGreaterThan(0);
    expect(withPipes.reportModel.computeTables.some((t) => t.fileName === 'PipesUtilization.csv')).toBe(
      true,
    );
    // No invented compute PipeUtilization.csv
    expect(
      Object.keys(withPipes.reportModel.csvTexts).some(
        (k) => /PipeUtilization\.csv$/i.test(k) && !/Pipes|Hist/i.test(k),
      ),
    ).toBe(false);
  });

  it('PR-ASIM-003: missing KernelInfo/summary does not throw', () => {
    expect(() =>
      adaptEmulate({
        'manifest.json': enc.encode(emulateManifest()),
        'PipeTrace.json': enc.encode(minimalTraceUs()),
      }),
    ).not.toThrow();
  });

  it('PR-ASIM-004: does not invent compute-shaped metric CSVs', () => {
    const adapted = adaptEmulate({
      'manifest.json': enc.encode(emulateManifest()),
      'PipeTrace.json': enc.encode(minimalTraceUs()),
    });
    expect(adapted.reportModel.memoryTopology).toBeUndefined();
    expect(adapted.reportModel.roofline).toBeUndefined();
    expect(adapted.reportModel.hardwareDetails).toBeUndefined();
    expect(adapted.reportModel.overviewSeries).toEqual([]);
  });

  it('PR-ASIM-005: interim DATA-42a maps KernelInfo into summary', () => {
    const csv = 'KernelInfoAttr,KernelInfoVal\nOp Name,my_kernel\nTask Duration(us),12.5\n';
    expect(summaryFromKernelInfo(enc.encode(csv))).toEqual({
      opName: 'my_kernel',
      taskDurationUs: 12.5,
    });
    const adapted = adaptEmulate({
      'manifest.json': enc.encode(emulateManifest()),
      'PipeTrace.json': enc.encode(minimalTraceUs()),
      'KernelInfo.csv': enc.encode(csv),
    });
    expect(adapted.reportModel.summary.opName).toBe('my_kernel');
    expect(adapted.reportModel.summary.taskDurationUs).toBe(12.5);
  });

  it('PR-ASIM-006: corrupt PipeTrace throws; absent PipeTrace does not', () => {
    expect(() =>
      adaptEmulate({
        'manifest.json': enc.encode(emulateManifest()),
        'PipeTrace.json': enc.encode('{not-json'),
      }),
    ).toThrow(/PipeTrace\.json is not valid JSON/);
    expect(() =>
      adaptEmulate({
        'manifest.json': enc.encode(emulateManifest()),
      }),
    ).not.toThrow();
  });
});

describe('npu-rep / loadReportSource profile routing', () => {
  it('PR-NPU-012: manifest.json leaf classified as emulate; compute CSVs not required', () => {
    const adapted = loadReportSource(packEmulateLeaf());
    expect(adapted.swimlaneModel).not.toBeNull();
    expect(adapted.reportModel.summary).toEqual({});
  });

  it('PR-JSON-004: loadReportSource routes emulate leaf to adaptEmulate path', () => {
    const adapted = loadReportSource(
      packEmulateLeaf([
        {
          name: 'KernelInfo.csv',
          type: NPU160_TYPE_CSV,
          data: enc.encode('KernelInfoAttr,KernelInfoVal\nOp Name,routed\n'),
        },
      ]),
    );
    expect(adapted.reportModel.summary.opName).toBe('routed');
    // Would not come from compute OpBasicInfo path
    expect(adapted.reportModel.pipeOccupancy).toEqual([]);
  });

  it('gelu.npu-rep opens as emulate with swimlane from PipeTrace.json', () => {
    const bytes = new Uint8Array(
      readFileSync(resolve(__dirname, '../../data/gelu.npu-rep')),
    );
    const adapted = loadReportSource(bytes);
    expect(adapted.swimlaneModel).not.toBeNull();
    expect(adapted.swimlaneModel!.processes.length).toBeGreaterThan(0);
    expect(adapted.swimlaneModel!.maxTime).toBeGreaterThan(adapted.swimlaneModel!.minTime);
    expect(adapted.reportModel.memoryTopology).toBeUndefined();
    expect(adapted.reportModel.roofline).toBeUndefined();
  });

  it('PR-ASIM-007: native core_*_tracing_report_*.json used when PipeTrace.json absent', () => {
    const adapted = adaptEmulate({
      'manifest.json': enc.encode(exportCatalogManifest()),
      'core_0_tracing_report_0.json': enc.encode(minimalTraceUs()),
    });
    expect(adapted.swimlaneModel).not.toBeNull();
    expect(adapted.swimlaneModel!.maxTime - adapted.swimlaneModel!.minTime).toBe(100_000);
  });
});
describe('emulate pipe mappers', () => {
  it('maps PipeUtilizationHist PipeName → occupancy', () => {
    const items = pipeOccupancyFromHist(
      enc.encode('PipeName,CoreName,Utilization\nCube,AIC0,0.4\nVector,AIV0,0.6\n'),
    );
    expect(items.find((i) => i.id === 'cube')?.ratio).toBe(0.4);
    expect(items.find((i) => i.id === 'vector')?.ratio).toBe(0.6);
  });

  it('maps PipesUtilization ratios', () => {
    const items = pipeOccupancyFromPipesUtilization(
      enc.encode('CoreId,CoreTypeId,InstrQueueTypeId,PipeUtilization\n0,AIC,Scalar,25\n'),
    );
    expect(items.find((i) => i.id === 'scalar')?.ratio).toBe(0.25);
  });
});
