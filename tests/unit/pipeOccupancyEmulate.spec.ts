/**
 * Emulate PIPE occupancy mappers (UI-54): CoreName → aic|aiv0|aiv1, no cross-core mean.
 */
import { describe, expect, it } from 'vitest';
import {
  coreNameToPipeSide,
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

  it('adaptPayloads falls back to hist when PipeUtilization.csv is absent', () => {
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
  });
});
