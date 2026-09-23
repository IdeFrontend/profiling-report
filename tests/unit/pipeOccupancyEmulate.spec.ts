/**
 * Emulate PIPE occupancy mappers (UI-54) + hist 详情 KV flatten (UI-55).
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
  it('coreNameToPipeSide maps AIC / AIV0 / AIV1', () => {
    expect(coreNameToPipeSide('AIC')).toBe('aic');
    expect(coreNameToPipeSide('AIV0')).toBe('aiv0');
    expect(coreNameToPipeSide('AIV1')).toBe('aiv1');
    expect(coreNameToPipeSide('')).toBeNull();
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

  it('csvTableFromPipeUtilizationHist flattens PipeName_CoreName KV in file order', () => {
    const csv = [
      'PipeName,CoreName,Utilization',
      'SCALAR,AIC,50.522',
      'SCALAR,AIV0,48.385',
      'MTE3,AIV1,26.397',
    ].join('\n');
    const table = csvTableFromPipeUtilizationHist(enc.encode(csv));
    expect(table?.fileName).toBe('PipeUtilizationHist.csv');
    expect(table?.headers).toEqual(['SCALAR_AIC', 'SCALAR_AIV0', 'MTE3_AIV1']);
    expect(table?.rows).toHaveLength(1);
    expect(table?.rows[0]).toEqual({
      SCALAR_AIC: '50.522',
      SCALAR_AIV0: '48.385',
      MTE3_AIV1: '26.397',
    });
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

  it('adaptPayloads: hist only → computeTables hist KV, no PipeUtilization.csv', () => {
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
    expect(histTab?.headers).toEqual(['SCALAR_AIC', 'SCALAR_AIV0', 'SCALAR_AIV1']);
    expect(histTab?.rows[0]?.SCALAR_AIC).toBe('50.0');
    expect(adapted.reportModel.csvTexts['PipeUtilizationHist.csv']).toContain('SCALAR,AIC,50.0');
  });

  it('adaptPayloads: hist + PipeUtilization.csv → omit PipeUtilization from computeTables', () => {
    const hist = 'PipeName,CoreName,Utilization\nSCALAR,AIC,50.0\n';
    const pipe = 'block_id,aiv_vec_ratio\n0,0.5\n';
    const adapted = adaptPayloads({
      'PipeUtilizationHist.csv': enc.encode(hist),
      'PipeUtilization.csv': enc.encode(pipe),
    });
    const names = adapted.reportModel.computeTables.map((t) => t.fileName);
    expect(names).toEqual(['PipeUtilizationHist.csv']);
    expect(adapted.reportModel.computeTables[0].headers).toEqual(['SCALAR_AIC']);
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
