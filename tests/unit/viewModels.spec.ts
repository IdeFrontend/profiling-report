import { describe, expect, it } from 'vitest';
import { adaptRep, parseRep } from '../../src/index';
import { buildMemoryTopology, firstLabelledMemoryTopology } from '../../src/adapters/memoryTopology';
import { loadOutRepBytes } from '../helpers/fixtures';
import type { CsvTableModel } from '../../src/domain/types';

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
    expect(byId.vector.absoluteValue).toBeCloseTo(0.065455, 5);
    expect(byId.mte2.absoluteValue).toBeCloseTo(0.371969625, 5);

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

  it('PR-VM-008: ICache Miss included when rate mean present', () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const icache = adapted.reportModel.pipeOccupancy.find(
      (p) => p.id === 'icache' && p.side === 'vector',
    );
    expect(icache).toBeDefined();
    expect(icache?.ratio).toBe(0);
    expect(icache?.absoluteValue).toBeUndefined();
  });

  it('PR-VM-009 (interim I-Q11*): GM roofline + mix labels; capability when points exist', () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const roof = adapted.reportModel.roofline;
    expect(roof).toBeDefined();
    expect(adapted.capabilities).toContain('roofline');

    const gm = roof!.points.find((p) => p.id === 'gm');
    expect(gm).toBeDefined();
    expect(gm!.style).toBe('solid');
    expect(gm!.performance).toBeCloseTo(2240 / 0.97962125 / 1e6, 5);
    expect(gm!.intensity).toBeCloseTo(0.09067357512953368, 5);
    expect(roof!.peakComputeTops).toBe(1);
    expect(roof!.peakBandwidthGBs).toBeGreaterThan(0);

    const byId = Object.fromEntries(roof!.mixLabels.map((m) => [m.id, m]));
    expect(byId.fp32).toBeDefined();
    expect(byId.misc).toBeDefined();
    expect(byId.fp32.percent + byId.misc.percent).toBeCloseTo(100, 3);
    expect(roof!.points.some((p) => p.id === 'l2')).toBe(false);
  });

  it('PR-VM-009: omit roofline when ArithmeticUtilization missing', () => {
    const parsed = parseRep(loadOutRepBytes());
    delete parsed.payloads['ArithmeticUtilization.csv'];
    const adapted = adaptRep(parsed);
    expect(adapted.reportModel.roofline).toBeUndefined();
    expect(adapted.capabilities ?? []).not.toContain('roofline');
  });

  it('PR-VM-009: zero Vector fops falls back to Cube (I-Q11a)', () => {
    const parsed = parseRep(loadOutRepBytes());
    parsed.payloads['ArithmeticUtilization.csv'] = new TextEncoder().encode(
      [
        'block_id,sub_block_id,aic_time(us),aic_cube_fops,aic_cube_fp16_ratio,aiv_time(us),aiv_vec_fops',
        '0,cube0,2.0,4000,1.0,1.0,0',
      ].join('\n'),
    );
    const adapted = adaptRep(parsed);
    const gm = adapted.reportModel.roofline?.points.find((p) => p.id === 'gm');
    expect(gm).toBeDefined();
    expect(gm!.performance).toBeCloseTo(4000 / 2 / 1e6, 5);
    expect(adapted.reportModel.roofline?.mixLabels).toEqual([
      { id: 'fp16', label: 'Cube_FP16', percent: 100 },
    ]);
  });

  it('PR-VM-010 (interim I-Q7a): hardwareDetails falls back to OpBasicInfo', () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    expect(adapted.reportModel.hardwareDetails).toBeDefined();
    expect(adapted.capabilities).toContain('hardwareDetails');
    const section = adapted.reportModel.hardwareDetails!.sections[0];
    expect(section.title).toBe('OpBasicInfo');
    const byKey = Object.fromEntries(section.fields.map((f) => [f.key, f.value]));
    expect(byKey['Op Name']).toBe('add_custom');
    expect(byKey['Current Freq']).toBe('1650');
  });

  it('PR-VM-011 (Q12 + change-log #5): memoryTopology with data-driven edge labels', () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const topo = adapted.reportModel.memoryTopology;
    expect(topo).toBeDefined();
    expect(adapted.capabilities).toContain('memoryDiagram');
    expect(topo!.nodes.length).toBeGreaterThan(0);
    expect(topo!.edges.filter((e) => e.label !== undefined).length).toBeGreaterThan(0);
  });

  it('PR-VM-012: topology labels are block-scoped; snapshot uses first labelled block', () => {
    const tables: CsvTableModel[] = [
      {
        fileName: 'Memory.csv',
        headers: ['block_id', 'aiv_main_mem_read_bw(GB/s)'],
        rows: [
          { block_id: '0', 'aiv_main_mem_read_bw(GB/s)': 'NA' },
          { block_id: '1', 'aiv_main_mem_read_bw(GB/s)': '4.25' },
        ],
        blockIds: ['0', '1'],
      },
    ];
    expect(buildMemoryTopology(tables, '0')).toBeUndefined();
    const block1 = buildMemoryTopology(tables, '1');
    expect(block1?.edges.find((e) => e.id === 'gm-l2-read')?.label).toBe('4.25 GB/s');
    expect(buildMemoryTopology(tables, '9')).toBeUndefined();
    const first = firstLabelledMemoryTopology(tables);
    expect(first?.blockId).toBe('1');
    expect(first?.model.edges.find((e) => e.id === 'gm-l2-read')?.label).toBe('4.25 GB/s');
  });
});
