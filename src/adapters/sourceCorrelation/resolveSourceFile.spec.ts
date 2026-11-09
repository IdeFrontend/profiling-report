import { describe, expect, it, vi } from 'vitest';
import type { SourceCorrelationModel, SourceFileModel } from '../../domain/types';
import {
  MISSING_SOURCE_EMBED_PREFIX,
  applyResolvedSourceText,
  fileNeedsSourceResolve,
  isMissingSourceEmbed,
  missingSourceEmbedText,
  resolveMissingSourceFiles,
} from './resolveSourceFile';

function placeholderFile(overrides: Partial<SourceFileModel> = {}): SourceFileModel {
  return {
    id: 'gather_2d.asc',
    path: '/home/build/gather_2d.asc',
    language: 'ascend-c',
    text: `${MISSING_SOURCE_EMBED_PREFIX}/home/build/gather_2d.asc\n`,
    metricsColumns: [],
    lines: [
      {
        line: 1,
        values: { instructionsExecuted: 0, samplingStall: 0, warpOccupancy: 0 },
      },
      {
        line: 39,
        values: { instructionsExecuted: 0, samplingStall: 12, warpOccupancy: 0 },
        stallBreakdown: [{ metric: 'IBuf empty', value: 12, percent: 100 }],
      },
    ],
    ...overrides,
  };
}

function modelWith(files: SourceFileModel[]): SourceCorrelationModel {
  return {
    files,
    assembly: {
      id: 'sass',
      path: 'k.sass',
      text: '',
      metricsColumns: [],
      lines: [],
    },
    sourceToAsm: {},
    asmToSource: {},
    navigateBy: ['samplingStall'],
    mock: false,
  };
}

describe('resolveSourceFile helpers', () => {
  it('detects missing-embed placeholder', () => {
    expect(isMissingSourceEmbed(`${MISSING_SOURCE_EMBED_PREFIX}x.asc\n`)).toBe(true);
    expect(isMissingSourceEmbed('real source')).toBe(false);
    expect(fileNeedsSourceResolve(placeholderFile())).toBe(true);
    expect(fileNeedsSourceResolve(placeholderFile({ text: 'void kernel() {}\n' }))).toBe(false);
    const padded = missingSourceEmbedText('/p/a.asc', 39);
    expect(isMissingSourceEmbed(padded)).toBe(true);
    expect(padded.split(/\r?\n/).length - 1).toBe(39);
  });

  it('applyResolvedSourceText replaces text and preserves stall metrics', () => {
    const text = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join('\n');
    const next = applyResolvedSourceText(placeholderFile(), text);
    expect(next.text).toBe(text);
    expect(next.lines).toHaveLength(40);
    expect(next.lines[38]!.values.samplingStall).toBe(12);
    expect(next.lines[38]!.stallBreakdown?.[0]?.metric).toBe('IBuf empty');
    expect(next.lines[0]!.values.samplingStall).toBe(0);
  });

  it('resolveMissingSourceFiles skips embedded text and does not call resolve', async () => {
    const resolve = vi.fn(async () => 'should not run');
    const embedded = placeholderFile({ text: 'already packed\n' });
    const model = modelWith([embedded]);
    const next = await resolveMissingSourceFiles(model, resolve);
    expect(next).toBe(model);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('resolveMissingSourceFiles fills placeholder from host', async () => {
    const resolve = vi.fn(async (req) => {
      expect(req).toEqual({
        fileName: '/home/build/gather_2d.asc',
        basename: 'gather_2d.asc',
      });
      return 'extern "C" void gather_2d() {}\n';
    });
    const model = modelWith([placeholderFile()]);
    const next = await resolveMissingSourceFiles(model, resolve);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(next).not.toBe(model);
    expect(next.files[0]!.text).toContain('gather_2d');
    expect(isMissingSourceEmbed(next.files[0]!.text)).toBe(false);
  });

  it('resolveMissingSourceFiles keeps placeholder on null or throw', async () => {
    const model = modelWith([placeholderFile()]);
    const miss = await resolveMissingSourceFiles(model, async () => null);
    expect(miss).toBe(model);
    const boom = await resolveMissingSourceFiles(model, async () => {
      throw new Error('fs denied');
    });
    expect(boom).toBe(model);
  });
});
