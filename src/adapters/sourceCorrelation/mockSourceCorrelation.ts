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

/**
 * AscendC mock body (≥100 lines). Sudu language id is `ascend-c` (supported since
 * `@sudu-ide/code-review` 0.0.130-alpha4).
 *
 * Correlation maps a few hot Copy/Convolve/Process sites onto contiguous asm ranges.
 */
const SOURCE_TEXT = [
  '#include "kernel_operator.h"',
  '// Mock AscendC sharpen kernel for Source tab correlation demos.',
  '#include <cstdint>',
  'using namespace AscendC;',
  '',
  'constexpr uint32_t TILE_H = 16;',
  'constexpr uint32_t TILE_W = 16;',
  'constexpr uint32_t TILE_LEN = TILE_H * TILE_W;',
  'constexpr uint32_t BUF_NUM = 2;',
  '',
  'struct SharpenTiling {',
  '    uint32_t rows;',
  '    uint32_t cols;',
  '    uint32_t tileRows;',
  '    uint32_t tileCols;',
  '};',
  '',
  'class SharpenKernel {',
  'public:',
  '    __aicore__ inline SharpenKernel() {}',
  '',
  '    __aicore__ inline void Init(GM_ADDR x, GM_ADDR k, GM_ADDR y, const SharpenTiling &tiling) {',
  '        this->tiling = tiling;',
  '        xGm.SetGlobalBuffer((__gm__ float *)x);',
  '        kGm.SetGlobalBuffer((__gm__ float *)k);',
  '        yGm.SetGlobalBuffer((__gm__ float *)y);',
  '        pipe.InitBuffer(inQue, BUF_NUM, TILE_LEN * sizeof(float));',
  '        pipe.InitBuffer(outQue, BUF_NUM, TILE_LEN * sizeof(float));',
  '        pipe.InitBuffer(kernelBuf, 9 * sizeof(float));',
  '    }',
  '',
  '    __aicore__ inline void Process() {',
  '        CopyKernel();',
  '        uint32_t tilesY = (tiling.rows + TILE_H - 1) / TILE_H;',
  '        uint32_t tilesX = (tiling.cols + TILE_W - 1) / TILE_W;',
  '        for (uint32_t ty = 0; ty < tilesY; ++ty) {',
  '            for (uint32_t tx = 0; tx < tilesX; ++tx) {',
  '                ComputeTile(ty, tx);',
  '            }',
  '        }',
  '    }',
  '',
  'private:',
  '    __aicore__ inline void CopyKernel() {',
  '        LocalTensor<float> kLocal = kernelBuf.Get<float>();',
  '        DataCopy(kLocal, kGm, 9);',
  '        PipeBarrier<PIPE_ALL>();',
  '        for (int32_t i = 0; i < 9; ++i) {',
  '            kernel[i] = kLocal.GetValue(i);',
  '        }',
  '    }',
  '',
  '    __aicore__ inline void ComputeTile(uint32_t ty, uint32_t tx) {',
  '        uint32_t row0 = ty * TILE_H;',
  '        uint32_t col0 = tx * TILE_W;',
  '        uint32_t rows = (row0 + TILE_H <= tiling.rows) ? TILE_H : (tiling.rows - row0);',
  '        uint32_t cols = (col0 + TILE_W <= tiling.cols) ? TILE_W : (tiling.cols - col0);',
  '        CopyIn(row0, col0, rows, cols);',
  '        LocalTensor<float> xLocal = inQue.DeQue<float>();',
  '        LocalTensor<float> yLocal = outQue.AllocTensor<float>();',
  '        Convolve(xLocal, yLocal, rows, cols);',
  '        inQue.FreeTensor(xLocal);',
  '        outQue.EnQue(yLocal);',
  '        CopyOut(row0, col0, rows, cols);',
  '    }',
  '',
  '    __aicore__ inline void CopyIn(uint32_t row0, uint32_t col0, uint32_t rows, uint32_t cols) {',
  '        LocalTensor<float> xLocal = inQue.AllocTensor<float>();',
  '        for (uint32_t r = 0; r < rows; ++r) {',
  '            uint32_t gmOffset = (row0 + r) * tiling.cols + col0;',
  '            DataCopy(xLocal[r * TILE_W], xGm[gmOffset], cols);',
  '        }',
  '        inQue.EnQue(xLocal);',
  '    }',
  '',
  '    __aicore__ inline void CopyOut(uint32_t row0, uint32_t col0, uint32_t rows, uint32_t cols) {',
  '        LocalTensor<float> yLocal = outQue.DeQue<float>();',
  '        for (uint32_t r = 0; r < rows; ++r) {',
  '            uint32_t gmOffset = (row0 + r) * tiling.cols + col0;',
  '            DataCopy(yGm[gmOffset], yLocal[r * TILE_W], cols);',
  '        }',
  '        outQue.FreeTensor(yLocal);',
  '    }',
  '',
  '    __aicore__ inline void Convolve(',
  '        const LocalTensor<float> &src, LocalTensor<float> &dst, uint32_t rows, uint32_t cols) {',
  '        for (uint32_t r = 0; r < rows; ++r) {',
  '            for (uint32_t c = 0; c < cols; ++c) {',
  '                float acc = 0.0f;',
  '                for (int32_t dy = -1; dy <= 1; ++dy) {',
  '                    for (int32_t dx = -1; dx <= 1; ++dx) {',
  '                        int32_t rr = static_cast<int32_t>(r) + dy;',
  '                        int32_t cc = static_cast<int32_t>(c) + dx;',
  '                        float v = 0.0f;',
  '                        if (rr >= 0 && cc >= 0 && rr < static_cast<int32_t>(rows) &&',
  '                            cc < static_cast<int32_t>(cols)) {',
  '                            v = src.GetValue(rr * TILE_W + cc);',
  '                        }',
  '                        acc += v * kernel[(dy + 1) * 3 + (dx + 1)];',
  '                    }',
  '                }',
  '                dst.SetValue(r * TILE_W + c, acc * 0.8f);',
  '            }',
  '        }',
  '        PipeBarrier<PIPE_V>();',
  '    }',
  '',
  '    TPipe pipe;',
  '    TQue<QuePosition::VECIN, BUF_NUM> inQue;',
  '    TQue<QuePosition::VECOUT, BUF_NUM> outQue;',
  '    TBuf<TPosition::VECCALC> kernelBuf;',
  '    GlobalTensor<float> xGm;',
  '    GlobalTensor<float> kGm;',
  '    GlobalTensor<float> yGm;',
  '    SharpenTiling tiling;',
  '    float kernel[9] = {};',
  '};',
  '',
  'extern "C" __global__ __aicore__ void sharpen(GM_ADDR x, GM_ADDR k, GM_ADDR y, GM_ADDR tilingGm) {',
  '    SharpenTiling tiling;',
  '    auto *t = reinterpret_cast<__gm__ SharpenTiling *>(tilingGm);',
  '    tiling.rows = t->rows;',
  '    tiling.cols = t->cols;',
  '    tiling.tileRows = t->tileRows;',
  '    tiling.tileCols = t->tileCols;',
  '    SharpenKernel op;',
  '    op.Init(x, k, y, tiling);',
  '    op.Process();',
  '}',
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

function isCodeLine(line: string): boolean {
  const t = line.trim();
  if (t.length === 0) return false;
  if (t.startsWith('//')) return false;
  // Preprocessor lines still count as code for metrics (unlike // comments).
  return true;
}

function sourceLines(): SourceLineMetrics[] {
  return SOURCE_TEXT.split('\n').map((line, i) => {
    const n = i + 1;
    const code = isCodeLine(line);
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
    id: 'sharpen.cpp',
    path: 'sharpen.cpp',
    language: 'ascend-c',
    text: SOURCE_TEXT,
    metricsColumns: SOURCE_COLUMNS,
    lines: sourceLines(),
  };

  // Map a few hot source lines onto contiguous asm ranges (sketch-like correlation).
  const sourceToAsm: Record<string, number[]> = {
    'sharpen.cpp:46': [1, 2, 3], // DataCopy kernel weights
    'sharpen.cpp:61': [4, 5, 6], // Convolve call
    'sharpen.cpp:71': [7, 8], // DataCopy tile in
    'sharpen.cpp:85': [9], // Convolve definition
    'sharpen.cpp:128': [10, 11, 12], // op.Process()
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
