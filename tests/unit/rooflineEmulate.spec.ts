/**
 * Emulate roofline mapper unit tests (DATA-57a).
 * @covers PR-ASIM-016
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
    // Latest roofline wins: pass then fail → omit (not any-pass).
    expect(
      emulateRooflineAnalysisPassed(
        'AnalysisName,AnalysisPassed\narch_diagram,1\nroofline,1\nroofline,0\n',
      ),
    ).toBe(false);
    // A later non-roofline row does not clear a prior pass.
    expect(
      emulateRooflineAnalysisPassed(
        'AnalysisName,AnalysisPassed\nroofline,1\narch_diagram,0\n',
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
    // Point seriesId matches a bandwidth-suffixed roof (SIMT-OUT / SIMT-UB).
    expect(model!.points.map((p) => p.seriesId).sort()).toEqual([
      'aiv-bp16-simt',
      'aiv-bp16-simt-out',
    ]);
    expect(model!.points.every((p) => model!.series.some((s) => s.id === p.seriesId))).toBe(true);
    expect(model!.series.map((s) => s.id)).toEqual([
      'aiv-fp16-simd',
      'aiv-fp16-simt',
      'aiv-fp16-simt-out',
      'aiv-bp16-simd',
      'aiv-bp16-simt',
      'aiv-bp16-simt-out',
      'aiv-fp32-simd',
      'aiv-fp32-simt',
      'aiv-fp32-simt-out',
      'aic-int16-fp16-l0',
      'aic-int16-fp16-cube-out',
      'aic-tf32-hf32-l0',
      'aic-tf32-hf32-cube-out',
      'aic-fp32-l0',
      'aic-fp32-cube-out',
      'aic-int8-fp8-l0',
      'aic-int8-fp8-cube-out',
    ]);
    expect(model!.series.find((s) => s.id === 'aic-fp32-l0')!.label).toBe('AIC fp32 · L0');
    expect(model!.series.find((s) => s.id.startsWith('aiv-bp16'))!.label).toContain('AIV bf16');
    const ridgeFp16Simd =
      (model!.series.find((s) => s.id === 'aiv-fp16-simd')!.peakComputeTops * 1000) /
      model!.series.find((s) => s.id === 'aiv-fp16-simd')!.peakBandwidthGBs;
    expect(ridgeFp16Simd).toBeCloseTo(54000 / 50353.92, 8);
  });

  it('disambiguates colliding truncated labels with PC hex', () => {
    const longA =
      '_ZN7AscendCL28BinaryContinuousImplTemplateIfNS_3Reg9RegTensorIfL_ZNS1_L14RegTraitNumOneEEEEXadL_ZNS1_L3MulIfLNS1_13MaskMergeModeE2ES3_EEvRT1_S7_S7_RDv4_xEEEEvPU3AS6T_SC_SC_i.vector.thread';
    const longB =
      '_ZN7AscendCL28BinaryContinuousImplTemplateIfNS_3Reg9RegTensorIfL_ZNS1_L14RegTraitNumOneEEEEXadL_ZNS1_L3AddIfLNS1_13MaskMergeModeE2ES3_EEvRT1_S7_S7_RDv4_xEEEEvPU3AS6T_SC_SC_i.vector.thread';
    const model = rooflineFromEmulatePayloads({
      'RooflinePoints.csv': enc.encode(
        [
          'FunctionPC,FunctionSize,FunctionName,ExecutionMode,Unit,MemoryLevel,ExecutionCount,DurationTicks,FpOperations,IntegerOperations,TotalOperations,ProcessedBytes,ArithmeticIntensity,ThroughputGBs,PerformanceGFlops',
          `1024,32,${longA},SIMD,AIV,SIMD-UB,1,1,1,0,1,8,0.125,1,1`,
          `1124,32,${longB},SIMD,AIV,SIMD-UB,1,1,1,0,1,8,0.125,1,1`,
        ].join('\n'),
      ),
      'RooflineComputePeaks.csv': enc.encode('Unit,DataType,PeakGFlops\nAIV,fp16,54000.0\n'),
      'RooflineBandwidthPeaks.csv': enc.encode(
        'Unit,MemoryLevel,PeakGBs\nAIV,SIMD-UB,50353.92\n',
      ),
    });
    expect(model).toBeDefined();
    const labels = model!.points.map((p) => p.label);
    expect(new Set(labels).size).toBe(2);
    expect(labels.every((l) => /@ 0x[0-9A-F]+$/.test(l))).toBe(true);
    expect(labels.some((l) => l.endsWith('@ 0x400'))).toBe(true);
    expect(labels.some((l) => l.endsWith('@ 0x464'))).toBe(true);
  });
});
