/**
 * Emulate roofline mapper unit tests (DATA-57a).
 * @covers PR-ASIM-013
 */
import { describe, expect, it } from 'vitest';
import {
  emulateRooflineAnalysisPassed,
  rooflineFromEmulatePayloads,
} from '../../src/adapters/rooflineEmulate';

const enc = new TextEncoder();

describe('rooflineEmulate (DATA-57a)', () => {
  it('emulateRooflineAnalysisPassed reads latest roofline row', () => {
    expect(emulateRooflineAnalysisPassed('AnalysisName,AnalysisPassed\nroofline,1\n')).toBe(true);
    expect(emulateRooflineAnalysisPassed('AnalysisName,AnalysisPassed\nroofline,0\n')).toBe(false);
    expect(
      emulateRooflineAnalysisPassed(
        'AnalysisName,AnalysisPassed\narch_diagram,1\nroofline,0\nroofline,1\n',
      ),
    ).toBe(true);
    expect(emulateRooflineAnalysisPassed(undefined)).toBe(false);
  });

  it('CSV cross-product matches David V100 HTML roof count and GOPS→TOps/s', () => {
    const model = rooflineFromEmulatePayloads({
      'AnalysisState.csv': enc.encode('AnalysisName,AnalysisPassed\nroofline,1\n'),
      'RooflinePoints.csv': enc.encode(
        [
          'FunctionPC,FunctionSize,FunctionName,ExecutionMode,Unit,MemoryLevel,ExecutionCount,DurationTicks,FpOperations,IntegerOperations,TotalOperations,ProcessedBytes,ArithmeticIntensity,ThroughputGBs,PerformanceGFlops',
          '584,216,_Z16gather_1d_customPfPiS_m_simt_entry,SIMT,AIV,SIMT-OUT,1,1753,0,704,704,384,1.8333333333333333,0.33661493626718036,0.6171273831564973',
          '584,216,_Z16gather_1d_customPfPiS_m_simt_entry,SIMT,AIV,SIMT-UB,1,1753,0,704,704,512,1.375,0.44881991502290713,0.6171273831564973',
        ].join('\n'),
      ),
      'RooflineComputePeaks.csv': enc.encode(
        [
          'Unit,DataType,PeakGFlops',
          'AIV,fp16,54000.0',
          'AIV,bf16,27000.0',
          'AIV,fp32,13500.0',
          'AIC,fp16_bf16,432000.0',
          'AIC,tf32_hf32,216000.0',
          'AIC,fp32,26000.0',
          'AIC,int8_fp8,864000.0',
        ].join('\n'),
      ),
      'RooflineBandwidthPeaks.csv': enc.encode(
        [
          'Unit,MemoryLevel,PeakGBs',
          'AIV,SIMD-UB,50353.92',
          'AIV,SIMT-UB,12588.8',
          'AIV,SIMT-OUT,1638.4',
          'AIC,CUBE-L0,50353.92',
          'AIC,CUBE-OUT,1638.4',
        ].join('\n'),
      ),
    });
    expect(model).toBeDefined();
    expect(model!.points).toHaveLength(2);
    expect(model!.points.every((p) => p.seriesId === 'aiv-bp16')).toBe(true);
    expect(model!.series).toHaveLength(17);
    const ridgeFp16Simd =
      (model!.series.find((s) => s.id === 'aiv-fp16-simd')!.peakComputeTops * 1000) /
      model!.series.find((s) => s.id === 'aiv-fp16-simd')!.peakBandwidthGBs;
    expect(ridgeFp16Simd).toBeCloseTo(54000 / 50353.92, 8);
  });
});
