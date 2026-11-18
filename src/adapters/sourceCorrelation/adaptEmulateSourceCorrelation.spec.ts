import { describe, expect, it } from 'vitest';
import { adaptEmulate, adaptSourceCorrelation } from '../index';
import {
  adaptEmulateSourceCorrelation,
  hasEmulateSourcePack,
} from './adaptEmulateSourceCorrelation';
import { MISSING_SOURCE_EMBED_PREFIX } from './resolveSourceFile';

const enc = (text: string) => new TextEncoder().encode(text);

function emulateManifest(): string {
  return JSON.stringify({ profile: 'emulate', schemaVersion: 1 });
}

function minimalTraceUs(): string {
  return JSON.stringify({
    displayTimeUnit: 'us',
    traceEvents: [
      { name: 'op', cat: 'pipe', ph: 'X', ts: 0, dur: 10, pid: 0, tid: 0 },
    ],
  });
}

/** Full ELF-ish mini pack: instructions + debug + files + lines + metrics. */
function fullElfPayloads(): Record<string, Uint8Array> {
  return {
    'SourceInstructions.csv': enc(
      [
        'SourceInstrSection,SourceInstrAddr,SourceInstrEncoding,SourceInstrText,DebugInfoId',
        '0,0,aabb,"ADD.X x0, x1",1',
        '0,4,ccdd,"MUL.Y x2, x3",2',
        '0,8,eeff,NOP,',
      ].join('\n'),
    ),
    'DebugInfo.csv': enc(
      [
        'DebugInfoId,SourceLineId,SourceFileId,DebugInfoLineNum',
        '1,10,7,3',
        '2,11,7,5',
      ].join('\n'),
    ),
    'SourceFiles.csv': enc(
      ['SourceFileId,SourceFilePath', '7,/sdk/kernel.asc'].join('\n'),
    ),
    'SourceLines.csv': enc(
      [
        'SourceLineId,SourceLine',
        '10,void kernel() {',
        '11,  mul();',
      ].join('\n'),
    ),
    'AsmMetrics.csv': enc(
      [
        'PC,InstrName,FileId,LineNum,ExecutionCount,TickCount,RelTime,WarpOccupancy,VectorUtilization',
        '0,"ADD.X x0, x1",7,3,10,100,0.5,0.25,80',
        '4,"MUL.Y x2, x3",7,5,0,,,0,',
        '8,NOP,,,,,,,',
      ].join('\n'),
    ),
    'SourceLineMetrics.csv': enc(
      [
        'FileId,LineNum,ExecutionCount,TickCount,RelTime,WarpOccupancy,VectorUtilization',
        '7,3,10,100,0.5,0.25,80',
        '7,5,0,,,0,',
      ].join('\n'),
    ),
  };
}

describe('adaptEmulateSourceCorrelation', () => {
  it('PR-SRC-012: full ELF CSVs yield mock:false model with maps and MVP metrics', () => {
    const model = adaptEmulateSourceCorrelation(fullElfPayloads());
    expect(model).not.toBeNull();
    expect(model!.mock).toBe(false);
    expect(model!.assembly.lines).toHaveLength(3);
    expect(model!.assembly.lines[0]!.values.address).toBe('00000000 00000000');
    expect(model!.assembly.lines[0]!.values.assembly).toBe('ADD.X x0, x1');
    expect(model!.assembly.lines[0]!.values.executionCount).toBe(10);
    expect(model!.assembly.lines[0]!.values.tickCount).toBe(100);
    expect(model!.assembly.lines[0]!.values.relTime).toBe(0.5);
    expect(model!.assembly.lines[0]!.values.warpOccupancy).toBe(0.25);
    expect(model!.assembly.lines[0]!.values.vectorUtilization).toBe(0.8);

    // NULL vs 0: unexecuted MUL keeps ExecutionCount 0; missing TickCount → null
    expect(model!.assembly.lines[1]!.values.executionCount).toBe(0);
    expect(model!.assembly.lines[1]!.values.tickCount).toBeNull();
    expect(model!.assembly.lines[2]!.values.executionCount).toBeNull();

    expect(model!.files).toHaveLength(1);
    expect(model!.files[0]!.id).toBe('7');
    expect(model!.files[0]!.path).toBe('/sdk/kernel.asc');
    expect(model!.files[0]!.text).toContain('void kernel() {');
    expect(model!.files[0]!.text).toContain('mul();');
    expect(model!.sourceToAsm['7:3']).toEqual([1]);
    expect(model!.sourceToAsm['7:5']).toEqual([2]);
    expect(model!.asmToSource[1]).toEqual({ fileId: '7', line: 3 });
    expect(model!.asmToSource[3]).toBeUndefined(); // unmapped NOP
    expect(model!.navigateBy).toEqual([
      'executionCount',
      'tickCount',
      'relTime',
      'warpOccupancy',
      'vectorUtilization',
    ]);
  });

  it('PR-SRC-013: assembly-only (AsmMetrics, no SourceFiles) lights the tab', () => {
    const payloads = {
      'AsmMetrics.csv': enc(
        [
          'PC,InstrName,ExecutionCount,TickCount,RelTime,WarpOccupancy,VectorUtilization',
          '16,"MOV x0, x1",2,20,0.1,0.5,50',
        ].join('\n'),
      ),
    };
    expect(hasEmulateSourcePack(payloads)).toBe(true);
    const model = adaptEmulateSourceCorrelation(payloads)!;
    expect(model.mock).toBe(false);
    expect(model.files).toEqual([]);
    expect(model.assembly.lines).toHaveLength(1);
    expect(model.assembly.lines[0]!.values.assembly).toBe('MOV x0, x1');
    expect(model.assembly.lines[0]!.values.address).toBe('00000000 00000010');
    expect(Object.keys(model.sourceToAsm)).toHaveLength(0);
  });

  it('PR-SRC-014: missing SourceLines uses missing-embed placeholder; keeps metrics', () => {
    const payloads = {
      'SourceInstructions.csv': enc(
        [
          'SourceInstrSection,SourceInstrAddr,SourceInstrText,DebugInfoId',
          '0,0,ADD,1',
        ].join('\n'),
      ),
      'DebugInfo.csv': enc(
        'DebugInfoId,SourceLineId,SourceFileId,DebugInfoLineNum\n1,,7,2\n',
      ),
      'SourceFiles.csv': enc('SourceFileId,SourceFilePath\n7,/missing/kernel.asc\n'),
      'AsmMetrics.csv': enc(
        'PC,InstrName,ExecutionCount,TickCount,RelTime,WarpOccupancy,VectorUtilization\n0,ADD,3,30,0.2,0.1,10\n',
      ),
      'SourceLineMetrics.csv': enc(
        'FileId,LineNum,ExecutionCount,TickCount,RelTime,WarpOccupancy,VectorUtilization\n7,2,3,30,0.2,0.1,10\n',
      ),
    };
    const model = adaptEmulateSourceCorrelation(payloads)!;
    expect(model.files[0]!.text.startsWith(MISSING_SOURCE_EMBED_PREFIX)).toBe(true);
    expect(model.files[0]!.lineCount).toBe(2);
    expect(model.files[0]!.lines.find((l) => l.line === 2)?.values.executionCount).toBe(3);
    expect(model.sourceToAsm['7:2']).toEqual([1]);
  });

  it('PR-SRC-015: IPCAsmMetrics / hints alone do not light the gate', () => {
    expect(
      hasEmulateSourcePack({
        'IPCAsmMetrics.csv': enc('ExecInstrId,ScalarIPC\n1,1.0\n'),
      }),
    ).toBe(false);
    expect(
      hasEmulateSourcePack({
        'SourceLineHints.csv': enc('HintId,HintTypeId,HintMsgId,SourceLineId\n1,1,1,1\n'),
      }),
    ).toBe(false);
    expect(adaptEmulateSourceCorrelation({})).toBeNull();
  });

  it('PR-SRC-016: adaptSourceCorrelation dispatches emulate ELF pack', () => {
    const model = adaptSourceCorrelation(fullElfPayloads());
    expect(model?.mock).toBe(false);
    expect(model?.assembly.lines.length).toBe(3);
  });

  it('PR-SRC-017 / PR-ASIM-013: adaptEmulate attaches sourceTab when ELF present', () => {
    const report = adaptEmulate({
      'manifest.json': enc(emulateManifest()),
      'PipeTrace.json': enc(minimalTraceUs()),
      ...fullElfPayloads(),
    });
    expect(report.reportModel.sourceCorrelation?.mock).toBe(false);
    expect(report.capabilities).toContain('sourceTab');
  });

  it('PR-ASIM-014: adaptEmulate without ELF omits sourceTab (gelu-shaped)', () => {
    const report = adaptEmulate({
      'manifest.json': enc(emulateManifest()),
      'PipeTrace.json': enc(minimalTraceUs()),
      'IPCAsmMetrics.csv': enc('ExecInstrId,ScalarIPC\n1,1.0\n'),
    });
    expect(report.reportModel.sourceCorrelation).toBeUndefined();
    expect(report.capabilities).not.toContain('sourceTab');
  });
});
