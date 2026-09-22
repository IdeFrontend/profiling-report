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
} from '../../src/index';
import { buildCannbotPayload } from '../../src/domain/cannbot';
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
    ).toBe(false);
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

  it('PR-SIM-003: displayTimeUnit ns on emulate Trace still treated as µs (DATA-46)', () => {
    const adapted = adaptEmulate({
      'manifest.json': enc.encode(emulateManifest()),
      'PipeTrace.json': enc.encode(
        JSON.stringify({
          displayTimeUnit: 'ns',
          traceEvents: [
            { name: 'process_name', ph: 'M', pid: 1, args: { name: 'AIC0' } },
            { name: 'thread_name', ph: 'M', pid: 1, tid: 1, args: { name: 'Cube' } },
            { name: 'op', ph: 'X', pid: 1, tid: 1, ts: 0, dur: 100 },
          ],
        }),
      ),
    });
    // Without the us override, chromeTraceToSwimlane would treat dur as ns → 100 ns span.
    expect(adapted.swimlaneModel!.maxTime - adapted.swimlaneModel!.minTime).toBe(100_000);
  });

  it('corrupt manifest.json does not throw in isEmulateLeaf (falls through)', () => {
    expect(isEmulateLeaf({ 'manifest.json': enc.encode('{not-json') })).toBe(false);
  });

  it('PR-SIM-004: missing KernelInfo → timeline-only, not invalid', () => {
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

  it('PR-ASIM-003: missing KernelInfo does not throw', () => {
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

  it('PR-ASIM-005: emulate leaves summary empty (no KernelInfo → cards; DATA-47)', () => {
    const csv = 'KernelInfoAttr,KernelInfoVal\nOp Name,my_kernel\nTask Duration(us),12.5\n';
    const adapted = adaptEmulate({
      'manifest.json': enc.encode(emulateManifest()),
      'PipeTrace.json': enc.encode(minimalTraceUs()),
      'KernelInfo.csv': enc.encode(csv),
    });
    expect(adapted.reportModel.profile).toBe('emulate');
    expect(adapted.reportModel.summary).toEqual({});
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

  it('PR-ASIM-008: ArchDiagramMetrics → memoryTopology + archDiagram capability', () => {
    const archCsv = [
      'ArchDiagramId,ArchDiagramParameterName,ArchDiagramParameterValue',
      '1,l2_cached_ratio,50.0',
      '2,hbm_to_l2_syn_gbs,12.5',
      '3,l2_to_hbm_syn_gbs,8.0',
      '4,aic_out_to_l1_gbs,3.25',
    ].join('\n');
    const adapted = adaptEmulate({
      'manifest.json': enc.encode(emulateManifest()),
      'PipeTrace.json': enc.encode(minimalTraceUs()),
      'ArchDiagramMetrics.csv': enc.encode(archCsv),
    });
    expect(adapted.reportModel.memoryTopology).toBeDefined();
    expect(adapted.reportModel.memoryTopology!.nodes.find((n) => n.id === 'l2')?.peakPct).toBe(50);
    expect(
      adapted.reportModel.memoryTopology!.edges.find((e) => e.id === 'gm-l2-read')?.label,
    ).toBe('12.50 GB/s');
    expect(adapted.capabilities).toContain('archDiagram');
    expect(adapted.capabilities).not.toContain('memoryDiagram');
    expect(adapted.reportModel.memoryTables.some((t) => /ArchDiagramMetrics/i.test(t.fileName))).toBe(
      true,
    );

    const empty = adaptEmulate({
      'manifest.json': enc.encode(emulateManifest()),
      'PipeTrace.json': enc.encode(minimalTraceUs()),
      'ArchDiagramMetrics.csv': enc.encode(
        'ArchDiagramId,ArchDiagramParameterName,ArchDiagramParameterValue\n1,active_cores,1.0\n',
      ),
    });
    expect(empty.reportModel.memoryTopology).toBeUndefined();
    expect(empty.capabilities).not.toContain('archDiagram');
  });

  it('PR-ASIM-008b: ARCH_DIAGRAM_EDGE_MAP locks to plated slots + HTML inventory gaps', async () => {
    const {
      ARCH_DIAGRAM_EDGE_MAP,
      ARCH_DIAGRAM_L2_PEAK_PARAM,
      ARCH_DIAGRAM_UNPLATED_HTML_BASES,
      ARCH_DIAGRAM_HTML_UTIL_RATIOS,
      topologyFromArchDiagramMetrics,
    } = await import('../../src/adapters/emulateMemoryTopology');
    const { TOPOLOGY_SLOT_EDGE_IDS } = await import('../../src/adapters/memoryTopology');

    // Every emulate plated edge id is a chrome slot (shared vocabulary with compute).
    const slotIds = new Set<string>(TOPOLOGY_SLOT_EDGE_IDS);
    expect(ARCH_DIAGRAM_EDGE_MAP.map((e) => e.id).sort()).toEqual([...slotIds].sort());
    for (const spec of ARCH_DIAGRAM_EDGE_MAP) {
      expect(slotIds.has(spec.id), spec.id).toBe(true);
    }

    // Mapped *_gbs params must not be listed as intentionally unplated HTML bases.
    const unplated = new Set(ARCH_DIAGRAM_UNPLATED_HTML_BASES);
    for (const spec of ARCH_DIAGRAM_EDGE_MAP) {
      for (const p of spec.params) {
        expect(p.endsWith('_gbs'), p).toBe(true);
        const base = p.replace(/_gbs$/, '');
        expect(unplated.has(base as (typeof ARCH_DIAGRAM_UNPLATED_HTML_BASES)[number]), p).toBe(
          false,
        );
      }
    }
    expect(ARCH_DIAGRAM_L2_PEAK_PARAM).toBe('l2_cached_ratio');
    expect(ARCH_DIAGRAM_HTML_UTIL_RATIOS).toContain(ARCH_DIAGRAM_L2_PEAK_PARAM);

    // Full Bandwidth-per-operator fixture: every plated edge + L2 peak; AIV pairs average.
    const expected = new Map<string, string>();
    const rows = [
      'ArchDiagramId,ArchDiagramParameterName,ArchDiagramParameterValue',
      `0,${ARCH_DIAGRAM_L2_PEAK_PARAM},50`,
    ];
    let id = 1;
    let solo = 1;
    for (const spec of ARCH_DIAGRAM_EDGE_MAP) {
      if (spec.params.length === 1) {
        const n = 10 + solo++;
        rows.push(`${id++},${spec.params[0]},${n}`);
        expected.set(spec.id, `${n.toFixed(2)} GB/s`);
      } else {
        rows.push(`${id++},${spec.params[0]},4`);
        rows.push(`${id++},${spec.params[1]},6`);
        expected.set(spec.id, '5.00 GB/s');
      }
    }
    // Unplated HTML edge present in CSV must not create an extra edge id / steal a label.
    rows.push(`${id++},aic_l0c_to_out_gbs,99`);
    rows.push(`${id++},aic_cube_ratio,0.5`);

    const model = topologyFromArchDiagramMetrics(rows.join('\n'));
    expect(model).toBeDefined();
    expect(model!.nodes.find((n) => n.id === 'l2')?.peakPct).toBe(50);
    expect(model!.plates).toBeUndefined();
    expect(model!.edges.map((e) => e.id).sort()).toEqual(
      ARCH_DIAGRAM_EDGE_MAP.map((e) => e.id).sort(),
    );
    for (const [edgeId, label] of expected) {
      expect(model!.edges.find((e) => e.id === edgeId)?.label, edgeId).toBe(label);
    }
    expect(model!.edges.some((e) => e.label === '99.00 GB/s')).toBe(false);
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
    expect(adapted.reportModel.profile).toBe('emulate');
    // DATA-47: KernelInfo does not populate summary chrome
    expect(adapted.reportModel.summary).toEqual({});
    // Would not come from compute OpBasicInfo path
    expect(adapted.reportModel.pipeOccupancy).toEqual([]);
  });

  it('gelu.npu-rep opens as emulate with swimlane + PIPE + ArchDiagram (no summary chrome)', () => {
    const bytes = new Uint8Array(
      readFileSync(resolve(__dirname, '../../data/gelu.npu-rep')),
    );
    const adapted = loadReportSource(bytes);
    expect(adapted.swimlaneModel).not.toBeNull();
    expect(adapted.swimlaneModel!.processes.length).toBeGreaterThan(0);
    expect(adapted.swimlaneModel!.maxTime).toBeGreaterThan(adapted.swimlaneModel!.minTime);
    expect(adapted.reportModel.profile).toBe('emulate');
    expect(adapted.reportModel.summary).toEqual({});
    expect(adapted.reportModel.pipeOccupancy.length).toBeGreaterThan(0);
    expect(adapted.reportModel.memoryTopology).toBeDefined();
    expect(adapted.capabilities).toContain('archDiagram');
    expect(adapted.capabilities).not.toContain('memoryDiagram');
    expect(adapted.reportModel.roofline).toBeUndefined();

    const summaryPayload = buildCannbotPayload('summary', adapted.reportModel, {
      name: 'gelu.npu-rep',
    });
    expect(summaryPayload.op_name).toBe('');
    expect((summaryPayload.data as { pipeOccupancy: unknown[] }).pipeOccupancy.length).toBeGreaterThan(
      0,
    );
    expect((summaryPayload.data as { memoryTopology: unknown }).memoryTopology).toBeDefined();

    const computePayload = buildCannbotPayload('compute', adapted.reportModel);
    expect((computePayload.data as { pipeOccupancy: unknown[] }).pipeOccupancy.length).toBeGreaterThan(
      0,
    );

    const memoryPayload = buildCannbotPayload('memory', adapted.reportModel);
    expect((memoryPayload.data as { memoryTopology: unknown }).memoryTopology).toBeDefined();
  });

  it('PR-ASIM-007: native core_*_tracing_report_*.json used when PipeTrace.json absent', () => {
    const adapted = adaptEmulate({
      'manifest.json': enc.encode(exportCatalogManifest()),
      'core_0_tracing_report_0.json': enc.encode(minimalTraceUs()),
    });
    expect(adapted.swimlaneModel).not.toBeNull();
    expect(adapted.swimlaneModel!.maxTime - adapted.swimlaneModel!.minTime).toBe(100_000);
  });

  it('PR-ASIM-007: merges multiple native core_*_tracing_report_*.json (remapped pids; numeric core order)', () => {
    const core = (pid: number, name: string) =>
      JSON.stringify({
        displayTimeUnit: 'ns',
        traceEvents: [
          { name: 'process_name', ph: 'M', pid, args: { name } },
          { name: 'thread_name', ph: 'M', pid, tid: 1, args: { name: 'Cube' } },
          { name: 'op', ph: 'X', pid, tid: 1, ts: 0, dur: 50 },
        ],
      });
    // Insert core_10 before core_2 so localeCompare would reverse them; numeric sort must keep core_2 first.
    const adapted = adaptEmulate({
      'manifest.json': enc.encode(exportCatalogManifest()),
      'core_10_tracing_report_0.json': enc.encode(core(0, 'AIC10')),
      'core_2_tracing_report_0.json': enc.encode(core(0, 'AIC2')),
    });
    expect(adapted.swimlaneModel).not.toBeNull();
    expect(adapted.swimlaneModel!.processes.length).toBe(2);
    expect(adapted.swimlaneModel!.processes.map((p) => p.name)).toEqual(['AIC2', 'AIC10']);
  });

  it('PR-ASIM-007: remaps numeric-string pids across native cores', () => {
    const core = (pid: string, name: string) =>
      JSON.stringify({
        displayTimeUnit: 'ns',
        traceEvents: [
          { name: 'process_name', ph: 'M', pid, args: { name } },
          { name: 'thread_name', ph: 'M', pid, tid: 1, args: { name: 'Cube' } },
          { name: 'op', ph: 'X', pid, tid: 1, ts: 0, dur: 50 },
        ],
      });
    const adapted = adaptEmulate({
      'manifest.json': enc.encode(exportCatalogManifest()),
      'core_0_tracing_report_0.json': enc.encode(core('0', 'AIC0')),
      'core_1_tracing_report_0.json': enc.encode(core('0', 'AIC1')),
    });
    expect(adapted.swimlaneModel).not.toBeNull();
    expect(adapted.swimlaneModel!.processes.length).toBe(2);
    expect(adapted.swimlaneModel!.processes.map((p) => p.name)).toEqual(['AIC0', 'AIC1']);
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

  it('joins InstrQueueTypes/CoreTypes integer FKs; skips unmapped ids', () => {
    const queueTypes = enc.encode('InstrQueueTypeId,InstrQueueTypeName\n1,SCALAR\n5,MTE2\n');
    const coreTypes = enc.encode('CoreTypeId,CoreTypeName\n1,AIC\n2,AIV0\n');
    const items = pipeOccupancyFromPipesUtilization(
      enc.encode(
        'CoreId,CoreTypeId,InstrQueueTypeId,PipeUtilization\n0,1,1,50\n0,2,5,40\n0,1,99,10\n',
      ),
      { queueTypes, coreTypes },
    );
    expect(items.find((i) => i.id === 'scalar')?.ratio).toBe(0.5);
    expect(items.find((i) => i.id === 'mte2')?.ratio).toBe(0.4);
    expect(items.find((i) => i.id === 'mte2')?.side).toBe('cube'); // pipe family side from map
    expect(items.some((i) => /q99|Queue/.test(i.id) || /q99|Queue/.test(i.label))).toBe(false);
  });
});
