/**
 * Emulate PIPE occupancy mappers (UI-54) + hist 详情 compute-style ratio keys (UI-55).
 */
import { describe, expect, it } from 'vitest';
import {
  coreNameToPipeSide,
  csvTableFromPipeUtilizationHist,
  pipeOccupancyFromHist,
  pipeOccupancyFromPipesUtilization,
} from '../../src/adapters/pipeOccupancyEmulate';
import { adaptPayloads } from '../../src/adapters/adaptRep';

const enc = new TextEncoder();

describe('pipeOccupancyEmulate', () => {
  it('coreNameToPipeSide maps AIC / AIV0 / AIV1; skips bare aiv/vector', () => {
    expect(coreNameToPipeSide('AIC')).toBe('aic');
    expect(coreNameToPipeSide('AIV0')).toBe('aiv0');
    expect(coreNameToPipeSide('AIV1')).toBe('aiv1');
    expect(coreNameToPipeSide('')).toBeNull();
    expect(coreNameToPipeSide('AIV')).toBeNull();
    expect(coreNameToPipeSide('vector')).toBeNull();
  });

  it('bare AIV/vector CoreName is skipped for bars and 详情 (UI-54)', () => {
    const csv = [
      'PipeName,CoreName,Utilization',
      'SCALAR,AIV,48.0',
      'SCALAR,vector,40.0',
      'SCALAR,AIV0,30.0',
    ].join('\n');
    const items = pipeOccupancyFromHist(enc.encode(csv));
    expect(items).toHaveLength(1);
    expect(items[0]?.side).toBe('aiv0');
    expect(items[0]?.ratio).toBeCloseTo(0.3, 10);
    const table = csvTableFromPipeUtilizationHist(enc.encode(csv));
    expect(table?.headers).toEqual(['aiv0_scalar_ratio']);
    expect(Number(table?.rows[0].aiv0_scalar_ratio)).toBeCloseTo(0.3, 10);
  });

  it('pipeOccupancyFromPipesUtilization drops integer CoreTypeId without CoreTypes (UI-54)', () => {
    // Pre-UI-54 defaulted side to cube; unresolved cores must not invent bars.
    const util = [
      'CoreId,CoreTypeId,InstrQueueTypeId,PipeUtilization',
      '0,1,6,18.56',
      '0,2,6,26.4',
    ].join('\n');
    const queues = 'InstrQueueTypeId,InstrQueueTypeName\n6,MTE3\n';
    expect(
      pipeOccupancyFromPipesUtilization(enc.encode(util), {
        queueTypes: enc.encode(queues),
      }),
    ).toEqual([]);
  });

  it('pipeOccupancyFromHist keeps AIV0 and AIV1 separate (no average)', () => {
    const csv = [
      'PipeName,CoreName,Utilization',
      'MTE3,AIC,0.0',
      'MTE3,AIV0,18.56037341849896',
      'MTE3,AIV1,26.39724849527085',
      'SCALAR,AIC,50.52204888834295',
      'SCALAR,AIV0,48.38471932195062',
      'SCALAR,AIV1,48.8514924456455',
    ].join('\n');
    const items = pipeOccupancyFromHist(enc.encode(csv));
    const mte3 = items.filter((p) => p.id === 'mte3');
    expect(mte3).toHaveLength(3);
    const aiv0 = mte3.find((p) => p.side === 'aiv0');
    const aiv1 = mte3.find((p) => p.side === 'aiv1');
    expect(aiv0?.ratio).toBeCloseTo(0.1856037341849896, 10);
    expect(aiv1?.ratio).toBeCloseTo(0.2639724849527085, 10);
    // Must not be the mean of the two AIV values (~0.22498)
    expect(aiv0?.ratio).not.toBeCloseTo((0.1856037341849896 + 0.2639724849527085) / 2, 5);
  });

  it('csvTableFromPipeUtilizationHist projects aic_/aiv0_/aiv1_ *_ratio keys (UI-55)', () => {
    const csv = [
      'PipeName,CoreName,Utilization',
      'SCALAR,AIC,50.522',
      'SCALAR,AIV0,48.385',
      'MTE3,AIV0,18.560',
      'MTE3,AIV1,26.397',
      'SIMD,AIV0,17.295',
    ].join('\n');
    const table = csvTableFromPipeUtilizationHist(enc.encode(csv));
    expect(table?.fileName).toBe('PipeUtilizationHist.csv');
    expect(table?.headers).toEqual([
      'aic_scalar_ratio',
      'aiv0_scalar_ratio',
      'aiv0_mte3_ratio',
      'aiv1_mte3_ratio',
      'aiv0_vec_ratio',
    ]);
    expect(table?.rows).toHaveLength(1);
    expect(Number(table?.rows[0].aic_scalar_ratio)).toBeCloseTo(0.50522, 5);
    expect(Number(table?.rows[0].aiv0_mte3_ratio)).toBeCloseTo(0.1856, 4);
    expect(Number(table?.rows[0].aiv1_mte3_ratio)).toBeCloseTo(0.26397, 4);
    expect(table?.rows[0].aiv_mte3_ratio).toBeUndefined();
    expect(table?.headers.some((h) => h.includes('SCALAR_AIC'))).toBe(false);
    expect(table?.blockIds).toEqual([]);
  });

  it('pipeOccupancyFromPipesUtilization joins CoreTypes / InstrQueueTypes', () => {
    const util = [
      'CoreId,CoreTypeId,InstrQueueTypeId,PipeUtilization',
      '0,1,6,0.0',
      '0,2,6,18.56',
      '0,3,6,26.4',
    ].join('\n');
    const cores = 'CoreTypeId,CoreTypeName\n1,AIC\n2,AIV0\n3,AIV1\n';
    const queues = 'InstrQueueTypeId,InstrQueueTypeName\n6,MTE3\n';
    const items = pipeOccupancyFromPipesUtilization(enc.encode(util), {
      coreTypes: enc.encode(cores),
      queueTypes: enc.encode(queues),
    });
    const mte3 = items.filter((p) => p.id === 'mte3');
    expect(mte3.map((p) => p.side).sort()).toEqual(['aic', 'aiv0', 'aiv1']);
    expect(mte3.find((p) => p.side === 'aiv0')?.ratio).toBeCloseTo(0.1856, 4);
    expect(mte3.find((p) => p.side === 'aiv1')?.ratio).toBeCloseTo(0.264, 4);
  });

  it('adaptPayloads: hist only → computeTables projected ratios, no PipeUtilization.csv', () => {
    const hist = [
      'PipeName,CoreName,Utilization',
      'SCALAR,AIC,50.0',
      'SCALAR,AIV0,40.0',
      'SCALAR,AIV1,30.0',
    ].join('\n');
    const adapted = adaptPayloads({
      'PipeUtilizationHist.csv': enc.encode(hist),
    });
    const scalars = adapted.reportModel.pipeOccupancy.filter((p) => p.id === 'scalar');
    expect(scalars).toHaveLength(3);
    expect(scalars.map((p) => p.side).sort()).toEqual(['aic', 'aiv0', 'aiv1']);

    const names = adapted.reportModel.computeTables.map((t) => t.fileName);
    expect(names).toContain('PipeUtilizationHist.csv');
    expect(names).not.toContain('PipeUtilization.csv');
    const histTab = adapted.reportModel.computeTables.find(
      (t) => t.fileName === 'PipeUtilizationHist.csv',
    );
    expect(histTab?.headers).toEqual([
      'aic_scalar_ratio',
      'aiv0_scalar_ratio',
      'aiv1_scalar_ratio',
    ]);
    expect(Number(histTab?.rows[0]?.aic_scalar_ratio)).toBeCloseTo(0.5, 10);
    expect(adapted.reportModel.csvTexts['PipeUtilizationHist.csv']).toContain('SCALAR,AIC,50.0');
  });

  it('adaptPayloads: hist + PipeUtilization.csv → omit PipeUtilization; occupancy from hist (UI-55)', () => {
    const hist = 'PipeName,CoreName,Utilization\nSCALAR,AIC,50.0\n';
    const pipe = 'block_id,aiv_vec_ratio\n0,0.5\n';
    const adapted = adaptPayloads({
      'PipeUtilizationHist.csv': enc.encode(hist),
      'PipeUtilization.csv': enc.encode(pipe),
    });
    const names = adapted.reportModel.computeTables.map((t) => t.fileName);
    expect(names).toEqual(['PipeUtilizationHist.csv']);
    expect(adapted.reportModel.computeTables[0].headers).toEqual(['aic_scalar_ratio']);
    // Bars must match 详情 sides (aic), not compute csv cube/vector from aiv_vec_ratio.
    const scalars = adapted.reportModel.pipeOccupancy.filter((p) => p.id === 'scalar');
    expect(scalars).toHaveLength(1);
    expect(scalars[0]?.side).toBe('aic');
    expect(scalars[0]?.ratio).toBeCloseTo(0.5, 10);
    expect(adapted.reportModel.pipeOccupancy.some((p) => p.side === 'vector')).toBe(false);
  });

  it('adaptPayloads: PipeUtilization.csv only → unchanged compute tab', () => {
    const pipe = 'block_id,aiv_vec_ratio\n0,0.5\n';
    const adapted = adaptPayloads({
      'PipeUtilization.csv': enc.encode(pipe),
    });
    const names = adapted.reportModel.computeTables.map((t) => t.fileName);
    expect(names).toEqual(['PipeUtilization.csv']);
    expect(adapted.reportModel.computeTables[0].headers).toContain('aiv_vec_ratio');
  });
});
