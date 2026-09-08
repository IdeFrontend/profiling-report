import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NPU160_TYPE_CSV,
  NPU160_TYPE_JSON,
  packNpuRep160,
} from '../../playground/packNpuRep160';

const BUILD_SAMPLE = resolve(__dirname, '../../data/build_sample_rep.py');

describe('packNpuRep160 parity with build_sample_rep.py', () => {
  it('matches Python pack_npu_rep for a fixed entry set', () => {
    const entries = [
      { name: 'OpBasicInfo.csv', type: NPU160_TYPE_CSV, data: new TextEncoder().encode('a,b\n1,2') },
      { name: 'trace.json', type: NPU160_TYPE_JSON, data: new TextEncoder().encode('{}') },
    ];
    const tsBytes = packNpuRep160(entries);
    const pyBytes = execFileSync('python3', [BUILD_SAMPLE, '--pack-parity']);
    expect(Array.from(tsBytes)).toEqual(Array.from(pyBytes));
  });
});
