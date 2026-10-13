import type {
  SourceCorrelationModel,
  SourceFileModel,
  SourceLineMetrics,
  SourceMetricsColumn,
} from '../../domain/types';

/** Sketch: Instructions Executed (num) · Sampling Stall (num + tip) · Warp Occupancy (bar %). */
const SOURCE_COLUMNS: SourceMetricsColumn[] = [
  { id: 'instructionsExecuted', label: 'Instructions Executed', kind: 'number' },
  { id: 'samplingStall', label: 'Sampling Stall', kind: 'number' },
  { id: 'warpOccupancy', label: 'Warp Occupancy', kind: 'bar' },
];

/** Sketch SASS order: # (UI) · Address · Assembly · Instructions · Stall · Occupancy. */
const ASM_COLUMNS: SourceMetricsColumn[] = [
  { id: 'address', label: 'Address', kind: 'text' },
  { id: 'assembly', label: 'Assembly', kind: 'text' },
  { id: 'instructionsExecuted', label: 'Instructions Executed', kind: 'number' },
  { id: 'samplingStall', label: 'Sampling Stall', kind: 'number' },
  { id: 'warpOccupancy', label: 'Warp Occupancy', kind: 'bar' },
];

const SOURCE_TEXT = [
  'def sharpen(tile, k):',
  '    # Mock kernel body for Source tab correlation demos.',
  '    acc = 0.0',
  '    for dy in range(-1, 2):',
  '        for dx in range(-1, 2):',
  '            acc += tile[dy, dx] * k[dy + 1, dx + 1]',
  '    return acc * 0.8',
  '',
  'def launch(grid):',
  '    for idx in range(grid):',
  '        sharpen(load(idx), KERNEL)',
].join('\n');

const ASM_LINES = [
  'IMAD R0, R1, c[0x0][0x4], R2',
  'LDG.E R4, [R6]',
  'FFMA R8, R4, R10, R8',
  'IADD R6, R6, 0x4',
  'LDG.E R12, [R14]',
  'FFMA R8, R12, R16, R8',
  'IADD R14, R14, 0x4',
  'FADD R20, R8, R20',
  'STG.E [R22], R20',
  'EXIT',
  'NOP',
  'BRA.U `(.L_exit)',
];

function sourceLines(): SourceLineMetrics[] {
  return SOURCE_TEXT.split('\n').map((line, i) => {
    const n = i + 1;
    const code = line.trim().length > 0 && !line.trim().startsWith('#');
    const stall = code ? 40 + ((n * 17) % 120) : 0;
    return {
      line: n,
      values: {
        instructionsExecuted: code ? 80 + n * 3 : 0,
        samplingStall: stall,
        warpOccupancy: code ? 0.55 + (n % 5) * 0.05 : 0,
      },
      ...(stall > 0
        ? {
            stallBreakdown: [
              { metric: 'Short Scoreboard', value: Math.round(stall * 0.46), percent: 46.32 },
              { metric: 'Long Scoreboard', value: Math.round(stall * 0.21), percent: 21.32 },
              { metric: 'Tex Throttle', value: Math.round(stall * 0.18), percent: 18.32 },
              { metric: 'Wait', value: Math.round(stall * 0.05), percent: 5.32 },
            ],
          }
        : {}),
    };
  });
}

function assemblyFile(): SourceFileModel {
  const text = ASM_LINES.join('\n');
  const lines: SourceLineMetrics[] = ASM_LINES.map((insn, i) => {
    const n = i + 1;
    const stall = 20 + ((n * 13) % 90);
    return {
      line: n,
      values: {
        // Sketch paints a mid-space in the hex address (hi lo).
        address: `00007f7b 895aa${(0x990 + n * 8).toString(16)}`,
        assembly: insn,
        instructionsExecuted: 10 + n * 2,
        samplingStall: stall,
        warpOccupancy: 0.6 + (n % 4) * 0.05,
      },
      stallBreakdown: [
        { metric: 'Short Scoreboard', value: Math.round(stall * 0.5), percent: 50 },
        { metric: 'Long Scoreboard', value: Math.round(stall * 0.3), percent: 30 },
        { metric: 'Wait', value: Math.round(stall * 0.2), percent: 20 },
      ],
    };
  });
  return {
    id: 'sass',
    path: 'kernel.sass',
    language: 'sass',
    text,
    metricsColumns: ASM_COLUMNS,
    lines,
  };
}

/** Deterministic Source ↔ SASS fixture used when real embeds are absent (UI-37). */
export function mockSourceCorrelation(): SourceCorrelationModel {
  const file: SourceFileModel = {
    id: 'sharpen.py',
    path: 'sharpen.py',
    language: 'python',
    text: SOURCE_TEXT,
    metricsColumns: SOURCE_COLUMNS,
    lines: sourceLines(),
  };

  // Map a few hot source lines onto contiguous asm ranges (sketch-like correlation).
  const sourceToAsm: Record<string, number[]> = {
    'sharpen.py:4': [1, 2, 3],
    'sharpen.py:5': [4, 5, 6],
    'sharpen.py:6': [7, 8],
    'sharpen.py:7': [9],
    'sharpen.py:11': [10, 11, 12],
  };
  const asmToSource: Record<number, { fileId: string; line: number }> = {};
  for (const [key, asmLines] of Object.entries(sourceToAsm)) {
    const line = Number(key.split(':')[1]);
    for (const asm of asmLines) {
      asmToSource[asm] = { fileId: file.id, line };
    }
  }

  return {
    files: [file],
    assembly: assemblyFile(),
    sourceToAsm,
    asmToSource,
    navigateBy: ['instructionsExecuted', 'samplingStall', 'warpOccupancy'],
    mock: true,
  };
}
