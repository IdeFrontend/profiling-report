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
    expect(model!.assembly.lines[1]!.values.address).toBe('00000000 00000004');
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
    expect(model!.files[0]!.sourceToAsm?.get(3)).toEqual([1]);
    expect(model!.files[0]!.sourceToAsm?.get(5)).toEqual([2]);
    expect(model!.files[0]!.sparse).toBe(true);
    expect(model!.files[0]!.lineCount).toBe(5);
    expect(model!.asmToSource.get(1)).toEqual({ fileId: '7', line: 3 });
    expect(model!.asmToSource.get(3)).toBeUndefined(); // unmapped NOP
    expect(model!.navigateBy).toEqual([
      'executionCount',
      'tickCount',
      'relTime',
      'warpOccupancy',
      'vectorUtilization',
    ]);
  });

  it('PR-SRC-012: VectorUtilization 0–100 scales by 100, including 1 and fractions', () => {
    const model = adaptEmulateSourceCorrelation({
      'AsmMetrics.csv': enc(
        [
          'PC,InstrName,VectorUtilization',
          '0,A,1',
          '4,B,0.4',
          '8,C,0',
          '12,D,100',
        ].join('\n'),
      ),
    });
    expect(model).not.toBeNull();
    expect(model!.assembly.lines.map((l) => l.values.vectorUtilization)).toEqual([
      0.01, 0.004, 0, 1,
    ]);
  });

  it('PR-SRC-013: assembly-only (AsmMetrics, no SourceFiles) lights the tab', () => {
    const payloads = {
      'AsmMetrics.csv': enc(
        [
          'PC,InstrName,ExecutionCount,TickCount,RelTime,WarpOccupancy,VectorUtilization',
          '16,"MOV x0, x1",2,20,0.1,0.5,50',
          // 64-bit report PC — high word must not be hardcoded zeros
          `${0x7f7b00001234},"LDR x8, [x9]",1,1,0.01,0.1,10`,
        ].join('\n'),
      ),
    };
    expect(hasEmulateSourcePack(payloads)).toBe(true);
    const model = adaptEmulateSourceCorrelation(payloads)!;
    expect(model.mock).toBe(false);
    expect(model.files).toEqual([]);
    expect(model.assembly.lines).toHaveLength(2);
    expect(model.assembly.lines[0]!.values.assembly).toBe('MOV x0, x1');
    expect(model.assembly.lines[0]!.values.address).toBe('00000000 00000010');
    expect(model.assembly.lines[1]!.values.address).toBe('00007f7b 00001234');
    expect(model.asmToSource.size).toBe(0);
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
    expect(model.files[0]!.sparse).toBe(true);
    expect(model.files[0]!.lines.find((l) => l.line === 2)?.values.executionCount).toBe(3);
    expect(model.files[0]!.sourceToAsm?.get(2)).toEqual([1]);
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

  /** Current producer layout: SourceLines carries (file, line, id, text) for the whole file. */
  function locatedSourcePayloads(): Record<string, Uint8Array> {
    return {
      'SourceFiles.csv': enc(['SourceFileId,SourceFilePath', '7,/sdk/kernel.asc'].join('\n')),
      'SourceLines.csv': enc(
        [
          'SourceFileId,SourceLineNum,SourceLineId,SourceLine',
          '7,1,10,"int main() {"',
          '7,2,11,"  return 0;"',
          '7,3,12,}',
        ].join('\n'),
      ),
      'SourceInstructions.csv': enc(
        [
          'SourceInstrSection,SourceInstrAddr,SourceInstrEncoding,SourceInstrText,DebugInfoId',
          '0,0,aabb,"MOV x0, x1",1',
          '0,4,ccdd,RET,2',
        ].join('\n'),
      ),
      'AsmMetrics.csv': enc(
        [
          'PC,InstrName,FileId,LineNum,ExecutionCount,TickCount,RelTime,WarpOccupancy,VectorUtilization',
          '0,"MOV x0, x1",7,2,4,40,0.4,0.5,50',
          '4,RET,7,3,0,,,,0',
        ].join('\n'),
      ),
      'SourceLineMetrics.csv': enc(
        [
          'DebugInfoId,FileId,LineId,LineNum,ExecutionCount,TickCount,RelTime,WarpOccupancy,VectorUtilization',
          '1,7,11,2,4,40,0.4,0.5,50',
        ].join('\n'),
      ),
    };
  }

  it('PR-SRC-019: located SourceLines become the full file text (dense, not collapsed)', () => {
    const model = adaptEmulateSourceCorrelation(locatedSourcePayloads())!;
    expect(model.files).toHaveLength(1);
    const file = model.files[0]!;
    expect(file.sparse).toBe(false);
    expect(file.lineCount).toBe(3);
    expect(file.text).toBe('int main() {\n  return 0;\n}\n');
    // Only metric / mapped lines carry rows; the table fills the rest blank.
    expect(file.lines.map((l) => l.line)).toEqual([2, 3]);
    expect(file.lines.find((l) => l.line === 2)?.values.executionCount).toBe(4);
    expect(file.lines.find((l) => l.line === 3)?.values.executionCount).toBeNull();
    // No DebugInfo.csv: AsmMetrics FileId/LineNum maps the instructions.
    expect(file.sourceToAsm?.get(2)).toEqual([1]);
    expect(file.sourceToAsm?.get(3)).toEqual([2]);
  });

  it('PR-SRC-019b: SourceLineMetrics maps instructions when DebugInfo is absent', () => {
    const payloads = locatedSourcePayloads();
    delete payloads['AsmMetrics.csv'];
    payloads['SourceInstructions.csv'] = enc(
      [
        'SourceInstrSection,SourceInstrAddr,SourceInstrEncoding,SourceInstrText,DebugInfoId',
        '0,0,aabb,"MOV x0, x1",1',
      ].join('\n'),
    );
    payloads['SourceLineMetrics.csv'] = enc(
      [
        'DebugInfoId,FileId,LineId,LineNum,ExecutionCount,TickCount,RelTime,WarpOccupancy,VectorUtilization',
        '1,7,11,2,4,40,0.4,0.5,50',
      ].join('\n'),
    );
    const model = adaptEmulateSourceCorrelation(payloads)!;
    expect(model.files[0]!.sourceToAsm?.get(2)).toEqual([1]);
    expect(model.asmToSource.get(1)).toEqual({ fileId: '7', line: 2 });
  });

  it('PR-SRC-019c: partial located SourceLines keep the collapsed sparse view', () => {
    const payloads = locatedSourcePayloads();
    payloads['SourceLines.csv'] = enc(
      [
        'SourceFileId,SourceLineNum,SourceLineId,SourceLine',
        '7,1,10,"int main() {"',
        '7,3,12,}',
      ].join('\n'),
    );
    const file = adaptEmulateSourceCorrelation(payloads)!.files[0]!;
    expect(file.sparse).toBe(true);
    expect(file.text).toBe('int main() {\n\n}\n');
  });
});
