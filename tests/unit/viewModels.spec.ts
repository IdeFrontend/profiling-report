import { describe, expect, it } from 'vitest';
import { adaptPayloads, adaptRep, loadReportSource, parseNpuRep160, parseRep } from '../../src/index';
import {
  bandwidthCardsFromRows,
  computeCardFromRows,
  overviewSeriesFromSampling,
  pipeOccupancyFromRows,
  rooflineFromRows,
} from '../../src/adapters';
import { buildMemoryTopology, firstLabelledMemoryTopology } from '../../src/adapters/memoryTopology';
import { loadOutRepBytes, loadVectorMuladdNpuRepBytes } from '../helpers/fixtures';
import type { CsvTableModel } from '../../src/domain/types';

describe('PR-VM: report view-models (interim)', () => {
  it('PR-VM-001 (interim DATA-33a): OpBasicInfo → thin summary only', () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const { summary } = adapted.reportModel;

    expect(summary.opName).toBe('add_custom');
    expect(summary.opType).toBe('vector');
    expect(summary.taskDurationUs).toBeCloseTo(1.800036, 5);
    expect(summary.pid).toBe('3072984');
    expect(summary.currentFreq).toBe(1650);
    expect(summary.ratedFreq).toBe(1650);
    expect(summary.blockDim).toBe(8);
    expect(summary.coreCount).toBeUndefined();

    // Classic `.rep` has no summary.jsonl → no derived compute/BW/utilization fields.
    expect(summary.aicFlops).toBeUndefined();
    expect(summary.aivFlops).toBeUndefined();
    expect(summary.parallelUtilization).toBeUndefined();
  });

  it('PR-VM-013 (DATA-8): bandwidthCards prefer the producer-summed summary.jsonl sides; Memory.csv fallback; peak 1600 GB/s', () => {
    const fixture = adaptRep(parseRep(loadOutRepBytes())).reportModel.bandwidthCards;
    expect(fixture).toBeDefined();
    expect(fixture!.map((c) => c.id)).toEqual(['input', 'output']);
    const fixtureIn = Object.fromEntries(fixture![0]!.sides.map((s) => [s.side, s]));
    expect(fixtureIn.aic).toBeUndefined();
    expect(fixtureIn.aiv).toBeDefined();
    expect(fixtureIn.aiv!.measuredGBs).toBeGreaterThan(1);
    expect(fixtureIn.aiv!.peakGBs).toBe(1600);
    const fixtureOut = Object.fromEntries(fixture![1]!.sides.map((s) => [s.side, s]));
    expect(fixtureOut.aic).toBeUndefined();
    expect(fixtureOut.aiv!.peakGBs).toBe(1600);

    const parsed = parseRep(loadOutRepBytes());
    parsed.payloads['Memory.csv'] = new TextEncoder().encode(
      [
        'block_id,aic_main_mem_read_bw(GB/s),aiv_main_mem_read_bw(GB/s),aic_main_mem_write_bw(GB/s),aiv_main_mem_write_bw(GB/s)',
        '0,80,90,NA,70',
        '1,80,NA,NA,90',
      ].join('\n'),
    );
    const cards = adaptRep(parsed).reportModel.bandwidthCards;
    expect(cards?.map((c) => c.id)).toEqual(['input', 'output']);
    const input = Object.fromEntries(cards![0]!.sides.map((s) => [s.side, s]));
    expect(input.aic).toMatchObject({ measuredGBs: 80, peakGBs: 1600 });
    expect(input.aiv?.measuredGBs).toBe(90);
    const output = Object.fromEntries(cards![1]!.sides.map((s) => [s.side, s]));
    expect(output.aic).toBeUndefined();
    expect(output.aiv).toMatchObject({ measuredGBs: 80, peakGBs: 1600 });

    parsed.payloads['Memory.csv'] = new TextEncoder().encode(
      ['block_id,aiv_main_mem_read_bw', '0,50', '1,70'].join('\n'),
    );
    const aliased = adaptRep(parsed).reportModel.bandwidthCards;
    expect(aliased).toEqual([
      { id: 'input', sides: [{ side: 'aiv', measuredGBs: 60, peakGBs: 1600 }] },
    ]);

    // DATA-8: `OpInfoSummary` publishes the aic + aiv sides already summed — prefer them.
    parsed.payloads['summary.jsonl'] = new TextEncoder().encode(
      JSON.stringify({
        category: 'OpInfoSummary',
        'aicore_gm_bw_theoretical(GB/s)': 1600,
        'aicore_gm_read_bw(GB/s)': 1234,
        'aicore_gm_write_bw(GB/s)': 567,
      }),
    );
    expect(adaptRep(parsed).reportModel.bandwidthCards).toEqual([
      { id: 'input', sides: [{ side: 'aicore', measuredGBs: 1234, peakGBs: 1600 }] },
      { id: 'output', sides: [{ side: 'aicore', measuredGBs: 567, peakGBs: 1600 }] },
    ]);

    // Without the summed field, fall back to the `category: Memory` per-side columns.
    parsed.payloads['summary.jsonl'] = new TextEncoder().encode(
      [
        JSON.stringify({ category: 'OpInfoSummary', 'aicore_gm_bw_theoretical(GB/s)': 1600 }),
        JSON.stringify({
          category: 'Memory',
          'aic_main_mem_read_bw(GB/s)': 80,
          'aiv_main_mem_read_bw(GB/s)': 90,
        }),
      ].join('\n'),
    );
    const perSide = adaptRep(parsed).reportModel.bandwidthCards!;
    expect(Object.fromEntries(perSide[0]!.sides.map((s) => [s.side, s.measuredGBs]))).toEqual({
      aic: 80,
      aiv: 90,
    });

    delete parsed.payloads['summary.jsonl'];
    delete parsed.payloads['Memory.csv'];
    expect(adaptRep(parsed).reportModel.bandwidthCards).toBeUndefined();
  });

  it('PR-VM-002 (DATA-28): PipeUtilization → PIPE bars mean of non-NA', () => {
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
    const pipeLane = adapted.swimlaneModel!.processes
      .flatMap((p) => p.threads)
      .find((t) => t.name.includes('PIPE_V'));
    expect(pipeLane?.utilization).toBeCloseTo(byId.vector.ratio, 5);
  });

  it('PR-VM-003 (DATA-39): Sampling.json ph:C → one track per name present; empty without Sampling; not from PipeUtilization', () => {
    const without = adaptRep(parseRep(loadOutRepBytes()));
    expect(without.reportModel.overviewSeries).toEqual([]);

    const withSampling = loadReportSource(loadVectorMuladdNpuRepBytes());
    const series = withSampling.reportModel.overviewSeries;
    expect(series.length).toBeGreaterThan(0);
    // DATA-39: render every distinct ph:C counter name present in Sampling.json
    expect(series.map((s) => s.id).sort()).toEqual(
      ['CUBE', 'FIXP', 'MTE1', 'MTE2', 'SCALAR'].sort(),
    );
    expect(series.every((s) => s.id === s.label)).toBe(true);

    const cube = series.find((s) => s.id === 'CUBE')!;
    expect(cube.points.length).toBeGreaterThan(0);
    for (const p of cube.points) {
      expect(Number.isFinite(p.t)).toBe(true);
      expect(Number.isFinite(p.v)).toBe(true);
    }
    // Sampling ts is µs (same as PipeTrace); overview t is canonical ns.
    expect(cube.points.some((p) => p.t >= 1000)).toBe(true);

    const swim = withSampling.swimlaneModel!;
    const maxT = Math.max(...series.flatMap((s) => s.points.map((p) => p.t)));
    expect(maxT).toBeLessThanOrEqual(swim.maxTime * 1.05 + 1);

    // Stripping Sampling must not invent series from remaining PipeUtilization.
    const payloads = { ...parseNpuRep160(loadVectorMuladdNpuRepBytes()).payloads };
    delete payloads['Sampling.json'];
    delete payloads['sampling.json'];
    expect(adaptPayloads(payloads).reportModel.overviewSeries).toEqual([]);
  });

  it('PR-VM-003 (DATA-39): args.value null / non-number is skipped (not coerced to 0)', () => {
    const json = JSON.stringify({
      traceEvents: [
        { ph: 'C', name: 'CUBE', ts: 1, args: { value: null } },
        { ph: 'C', name: 'CUBE', ts: 2, args: { value: '10' } },
        { ph: 'C', name: 'CUBE', ts: 3, args: { value: 42 } },
        { ph: 'C', name: 'VECTOR', ts: 4, args: {} },
      ],
    });
    const series = overviewSeriesFromSampling(new TextEncoder().encode(json));
    expect(series).toHaveLength(1);
    expect(series[0]!.id).toBe('CUBE');
    expect(series[0]!.points).toEqual([{ t: 3000, v: 42 }]);
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

  it('PR-VM-009 (interim DATA-37*): GM roofline + mix labels; capability when points exist', () => {
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

  it('PR-VM-009: zero Vector fops falls back to Cube (DATA-37a)', () => {
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

  it('PR-VM-010: hardwareDetails prefers HardwareInfo.jsonl; else OpBasicInfo', () => {
    const parsed = parseRep(loadOutRepBytes());
    parsed.payloads['HardwareInfo.jsonl'] = new TextEncoder().encode(
      [
        '{"category":"AI Core Information","ai_core_count":36,"ai_core_frequency_MHZ":[1650]}',
        '{"category":"Device Info","chip_info":"Ascend 950PR_9599 V100","arch_info":"3510"}',
      ].join('\n'),
    );
    const fromJsonl = adaptRep(parsed);
    const titles = fromJsonl.reportModel.hardwareDetails!.sections.map((s) => s.title);
    expect(titles).toEqual(['AI Core Information', 'Device Info']);
    const cores = Object.fromEntries(
      fromJsonl.reportModel.hardwareDetails!.sections[0]!.fields.map((f) => [f.key, f.value]),
    );
    expect(cores.ai_core_count).toBe('36');
    expect(fromJsonl.reportModel.summary.pid).toBe('3072984');

    const fallback = adaptRep(parseRep(loadOutRepBytes()));
    expect(fallback.reportModel.hardwareDetails).toBeDefined();
    expect(fallback.capabilities).toContain('hardwareDetails');
    const section = fallback.reportModel.hardwareDetails!.sections[0];
    expect(section.title).toBe('OpBasicInfo');
    const byKey = Object.fromEntries(section.fields.map((f) => [f.key, f.value]));
    expect(byKey['Op Name']).toBe('add_custom');
    expect(byKey['Current Freq']).toBe('1650');
  });

  it('PR-VM-014: summary.coreCount from HardwareInfo.jsonl by op type (DATA-1)', () => {
    const parsed = parseRep(loadOutRepBytes());
    parsed.payloads['HardwareInfo.jsonl'] = new TextEncoder().encode(
      '{"category":"AI Core Information","ai_core_count":36,"ai_cube_count":36,"ai_vector_count":72}',
    );
    expect(adaptRep(parsed).reportModel.summary.coreCount).toBe(72);

    parsed.payloads['OpBasicInfo.csv'] = new TextEncoder().encode(
      'Op Name,Op Type,Task Duration(us),Block Dim\nx,cube,1,8\n',
    );
    expect(adaptRep(parsed).reportModel.summary.coreCount).toBe(36);

    parsed.payloads['OpBasicInfo.csv'] = new TextEncoder().encode(
      'Op Name,Op Type,Task Duration(us),Block Dim\nx,mix,1,8\n',
    );
    expect(adaptRep(parsed).reportModel.summary.coreCount).toBe(36);

    delete parsed.payloads['HardwareInfo.jsonl'];
    expect(adaptRep(parsed).reportModel.summary.coreCount).toBeUndefined();

    parsed.payloads['HardwareInfo.jsonl'] = new TextEncoder().encode(
      '{"category":"AI Core Information","aic_cube_count":24,"aic_vector_count":48,"aic_core_count":24}',
    );
    parsed.payloads['OpBasicInfo.csv'] = new TextEncoder().encode(
      'Op Name,Op Type,Task Duration(us),Block Dim\nx,cube,1,8\n',
    );
    expect(adaptRep(parsed).reportModel.summary.coreCount).toBe(24);
  });

  it('PR-VM-015: computeCard from ArithmeticUtilization + HardwareInfo (HQ 2–4, Q33)', () => {
    const parsed = parseRep(loadOutRepBytes());
    expect(adaptRep(parsed).reportModel.computeCard).toBeUndefined();

    parsed.payloads['HardwareInfo.jsonl'] = new TextEncoder().encode(
      '{"category":"AI Core Information","ai_cube_count":36,"ai_vector_count":72,"ai_core_frequency_MHZ":[1650]}',
    );
    const card = adaptRep(parsed).reportModel.computeCard;
    expect(card).toBeDefined();
    expect(card!.sides.map((s) => s.side)).toEqual(['aiv']);
    const aiv = card!.sides[0]!;
    expect(aiv.measuredTflops).toBeCloseTo(2240 / 0.97962125 / 1e6, 5);
    expect(aiv.peakTflops).toBeCloseTo((128 * 72 * 1.65 * 2) / 1000, 3);

    parsed.payloads['HardwareInfo.jsonl'] = new TextEncoder().encode(
      '{"category":"AI Core Information","ai_vector_count":72}',
    );
    const ratedOnly = adaptRep(parsed).reportModel.computeCard!.sides[0]!;
    expect(ratedOnly.peakTflops).toBeCloseTo((128 * 72 * 1.65 * 2) / 1000, 3);
  });

  it('PR-VM-011: out.rep UB/Vec/GM 2:1 and from→to; L2↔L1 from Memory.csv; UB from Memory.csv (DATA-22/23); hide NA, show 0', () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const topo = adapted.reportModel.memoryTopology;
    expect(topo).toBeDefined();
    expect(adapted.capabilities).toContain('memoryDiagram');
    expect(topo!.nodes.length).toBeGreaterThan(0);
    const label = (id: string) => topo!.edges.find((e) => e.id === id)?.label;
    const dir = (id: string) => {
      const e = topo!.edges.find((x) => x.id === id)!;
      return `${e.from}->${e.to}`;
    };
    expect(label('l2-ub')).toBe('16.76 GB/s');
    expect(label('ub-l2')).toBe('8.38 GB/s');
    expect(label('ub-vec')).toBe('16.76 GB/s');
    expect(label('vec-ub')).toBe('8.38 GB/s');
    expect(label('gm-l2-read')).toBe('16.89 GB/s');
    expect(label('gm-l2-write')).toBe('8.38 GB/s');
    expect(dir('gm-l2-read')).toBe('gm->l2');
    expect(dir('gm-l2-write')).toBe('l2->gm');
    expect(dir('ub-vec')).toBe('ub->vec');
    expect(dir('vec-ub')).toBe('vec->ub');
    expect(dir('l2-l1-read')).toBe('l2->l1');
    expect(dir('l2-l1-write')).toBe('l1->l2');
    expect(dir('l1-l0a')).toBe('l1->l0a');
    expect(dir('l1-l0b')).toBe('l1->l0b');
    expect(dir('l0a-cube')).toBe('l0a->cube');
    expect(dir('l0b-cube')).toBe('l0b->cube');
    const both: CsvTableModel[] = [
      {
        fileName: 'Memory.csv',
        headers: ['block_id', 'aic_l1_read_bw(GB/s)', 'aiv_ub_to_gm_bw(GB/s)'],
        rows: [
          {
            block_id: '0',
            'aic_l1_read_bw(GB/s)': '0',
            'aiv_ub_to_gm_bw(GB/s)': '1.11',
          },
        ],
        blockIds: ['0'],
      },
      {
        fileName: 'MemoryUB.csv',
        headers: ['block_id', 'aiv_ub_read_bw_gm(GB/s)'],
        rows: [{ block_id: '0', 'aiv_ub_read_bw_gm(GB/s)': '9.25' }],
        blockIds: ['0'],
      },
    ];
    const labelled = buildMemoryTopology(both, '0');
    expect(labelled?.edges.find((e) => e.id === 'l2-l1-read')?.label).toBe('0.00 GB/s');
    // DATA-22: Memory.csv wins; the MemoryUB `*_gm` column is not the collected source.
    expect(labelled?.edges.find((e) => e.id === 'ub-l2')?.label).toBe('1.11 GB/s');

    const sampleOnly: CsvTableModel[] = [
      {
        fileName: 'Memory.csv',
        headers: ['block_id', 'aiv_ub_to_gm_bw(GB/s)', 'aic_l1_write_bw(GB/s)'],
        rows: [
          {
            block_id: '0',
            'aiv_ub_to_gm_bw(GB/s)': '8.38',
            'aic_l1_write_bw(GB/s)': 'NA',
          },
        ],
        blockIds: ['0'],
      },
    ];
    const sample = buildMemoryTopology(sampleOnly, '0');
    expect(sample?.edges.find((e) => e.id === 'ub-l2')?.label).toBe('8.38 GB/s');
    expect(sample?.edges.find((e) => e.id === 'l2-l1-write')?.label).toBeUndefined();
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

  it('PR-VM-012b: L2 Peak(%) from first non-NA hit-rate column (DATA-20 / DATA-21)', () => {
    const tables: CsvTableModel[] = [
      {
        fileName: 'Memory.csv',
        headers: ['block_id', 'aiv_main_mem_read_bw(GB/s)'],
        rows: [{ block_id: '0', 'aiv_main_mem_read_bw(GB/s)': '1.0' }],
        blockIds: ['0'],
      },
      {
        fileName: 'L2Cache.csv',
        headers: [
          'block_id',
          'aic_total_hit_rate(%)',
          'aiv_total_hit_rate(%)',
          'aic_read_hit_rate(%)',
        ],
        rows: [
          {
            block_id: '0',
            'aic_total_hit_rate(%)': 'NA',
            'aiv_total_hit_rate(%)': '81.25',
            'aic_read_hit_rate(%)': '10',
          },
        ],
        blockIds: ['0'],
      },
    ];
    const model = buildMemoryTopology(tables, '0');
    expect(model?.nodes.find((n) => n.id === 'l2')?.peakPct).toBe(81.25);
    expect(model?.edges.find((e) => e.id === 'l2-hit')?.label).toBe('81.25%');
  });

  it('PR-VM-016: OpBasicInfo identity keeps Summary.jsonl derived FLOPS/util overlay', () => {
    const parsed = parseRep(loadOutRepBytes());
    parsed.payloads['OpBasicInfo.csv'] = new TextEncoder().encode(
      ['Op Name,Op Type,Task Duration(us),Pid,Block Dim', 'hybrid,vector,12.5,99,8'].join('\n'),
    );
    parsed.payloads['Summary.jsonl'] = new TextEncoder().encode(
      JSON.stringify({
        category: 'OpInfoSummary',
        'Op Name': 'from-jsonl',
        aic_flops: 10,
        aic_flops_theoretical: 20,
        aiv_flops: 5,
        aiv_flops_theoretical: 10,
        aicore_parallel_utilization: 0.5,
        aicore_parallel_balance: 0.9,
        'aicore_gm_bw_theoretical(GB/s)': 1600,
      }) + '\n',
    );
    const { summary, computeCard } = adaptRep(parsed).reportModel;
    expect(summary.opName).toBe('hybrid'); // OpBasicInfo wins identity
    expect(summary.taskDurationUs).toBe(12.5);
    expect(summary.aicFlops).toBe(10);
    expect(summary.aivFlops).toBe(5);
    expect(summary.parallelUtilization).toBe(0.5);
    expect(computeCard?.sides.map((s) => s.side).sort()).toEqual(['aic', 'aiv']);
    expect(computeCard!.sides.find((s) => s.side === 'aic')!.measuredTflops).toBe(10);
  });

  it('PR-VM-017 (DATA-19/28/29): All scope reads summary.jsonl, a picked block reads its CSV row', () => {
    const encoder = new TextEncoder();
    const payloads = {
      // Producer aggregate: deliberately different from the per-block CSVs below.
      'summary.jsonl': encoder.encode(
        [
          JSON.stringify({
            category: 'OpInfoSummary',
            'aicore_gm_bw_theoretical(GB/s)': 1600,
          }),
          JSON.stringify({ category: 'PipeUtilization', aiv_vec_ratio: 0.42 }),
          JSON.stringify({ category: 'Memory', 'aiv_ub_to_gm_bw(GB/s)': 42 }),
        ].join('\n') + '\n',
      ),
      'PipeUtilization.csv': encoder.encode('block_id,aiv_vec_ratio\n0,0.2\n1,0.8\n'),
      // Edge direction carries one row per block; blocks are 0 and 1.
      'Memory.csv': encoder.encode(
        [
          'block_id,aiv_ub_to_gm_bw(GB/s)',
          '0,1.5',
          '1,1.7',
        ].join('\n'),
      ),
    };
    const model = adaptPayloads(payloads).reportModel;

    // All = the summary.jsonl category record …
    expect(model.pipeOccupancy.find((p) => p.id === 'vector')?.ratio).toBeCloseTo(0.42, 6);
    expect(model.memoryTopology?.edges.find((e) => e.id === 'ub-l2')?.label).toBe('42.00 GB/s');
    expect(model.summaryCategories!.find((c) => c.id === 'PipeUtilization')!.fields).toContainEqual({
      key: 'aiv_vec_ratio',
      value: '0.42',
    });

    // … and it is not the CSV mean, which is what a picked block's rows produce.
    const csvRows = model.computeTables.find((t) => t.fileName === 'PipeUtilization.csv')!.rows;
    expect(pipeOccupancyFromRows(csvRows).find((p) => p.id === 'vector')?.ratio).toBeCloseTo(0.5, 6);
    expect(buildMemoryTopology(model.memoryTables, '1')?.edges.find((e) => e.id === 'ub-l2')?.label)
      .toBe('1.70 GB/s');
  });

  it('PR-VM-017b (DATA-19/29): All roofline reads the summary.jsonl categories, not the CSV mean', () => {
    const encoder = new TextEncoder();
    const payloads = {
      // Producer aggregate: deliberately different from the per-block CSVs below.
      'summary.jsonl': encoder.encode(
        [
          JSON.stringify({
            category: 'ArithmeticUtilization',
            'aiv_vec_fops': '2e7',
            'aiv_time(us)': '1',
          }),
          JSON.stringify({ category: 'Memory', 'read_main_memory_datas(KB)': '1024' }),
        ].join('\n') + '\n',
      ),
      'ArithmeticUtilization.csv': encoder.encode(
        'block_id,aiv_vec_fops,aiv_time(us)\n0,4e7,1\n1,8e7,1\n',
      ),
      'Memory.csv': encoder.encode('block_id,read_main_memory_datas(KB)\n0,4096\n1,4096\n'),
    };
    const gm = adaptPayloads(payloads).reportModel.roofline?.points.find((p) => p.id === 'gm');
    // The category record is the All aggregate; the CSV mean would be 6e7 fops.
    expect(gm?.performance).toBeCloseTo(2e7 / 1 / 1e6, 6);
    expect(gm?.intensity).toBeCloseTo(2e7 / 1024 / 1024, 6);
  });

  it('PR-VM-018 (DATA-8/19): bandwidthCardsFromRows sums a block’s aic + aiv sides per direction', () => {
    const rows = [
      {
        block_id: '2',
        'aic_main_mem_read_bw(GB/s)': '80',
        'aiv_main_mem_read_bw(GB/s)': '90',
        'aic_main_mem_write_bw(GB/s)': 'NA',
        'aiv_main_mem_write_bw(GB/s)': '70',
      },
    ];
    expect(bandwidthCardsFromRows(rows)).toEqual([
      { id: 'input', sides: [{ side: 'aicore', measuredGBs: 170, peakGBs: 1600 }] },
      { id: 'output', sides: [{ side: 'aicore', measuredGBs: 70, peakGBs: 1600 }] },
    ]);
    // Peak follows the producer's `aicore_gm_bw_theoretical` when the caller resolved one.
    expect(bandwidthCardsFromRows(rows, 800)[0]!.sides[0]!.peakGBs).toBe(800);
    expect(bandwidthCardsFromRows([])).toEqual([]);
  });

  it('PR-VM-019 (DATA-19): computeCardFromRows measures the block row, peaks stay chip-level', () => {
    const summary = { aicFlopsTheoretical: 20, aivFlopsTheoretical: 10 };
    const rows = [{ 'aic_cube_fops': '3e7', 'aic_time(us)': '1.5' }];
    const card = computeCardFromRows(rows, summary);
    expect(card?.sides).toEqual([{ side: 'aic', measuredTflops: 20, peakTflops: 20 }]);
    // No theoretical peak in the summary → no side, never an invented peak.
    expect(computeCardFromRows(rows, {})).toBeUndefined();
    expect(computeCardFromRows([], summary)).toBeUndefined();
    // Classic `.rep`: no OpInfoSummary peak, so the chip-level peak comes from the All card.
    const fallback = { sides: [{ side: 'aic' as const, measuredTflops: 1, peakTflops: 20 }] };
    expect(computeCardFromRows(rows, {}, fallback)?.sides).toEqual([
      { side: 'aic', measuredTflops: 20, peakTflops: 20 },
    ]);
    // A peak is never borrowed for a side the All card does not have.
    expect(computeCardFromRows(rows, {}, { sides: [] })).toBeUndefined();
  });

  it('PR-VM-020 (DATA-19): rooflineFromRows honours the rows it is given', () => {
    const arith = [{ 'aiv_vec_fops': '2e7', 'aiv_time(us)': '1' }];
    const mem = [{ 'read_main_memory_datas(KB)': '1024' }];
    const model = rooflineFromRows(arith, mem);
    expect(model?.points[0]?.intensity).toBeCloseTo(2e7 / 1024 / 1024, 6);
    expect(rooflineFromRows([], mem)).toBeUndefined();
  });
});
