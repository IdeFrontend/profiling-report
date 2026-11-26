import { describe, expect, it, vi } from 'vitest';
import type { SourceCorrelationModel, SourceFileModel } from '../../domain/types';
import {
  MISSING_SOURCE_EMBED_PREFIX,
  applyResolvedSourceText,
  fileNeedsSourceResolve,
  isMissingSourceEmbed,
  missingSourceEmbedText,
  modelNeedsSourceResolve,
  resolveMissingSourceFiles,
  sourceBasename,
  sourceResolveRequests,
  workspaceSourceResolver,
  type SourceWorkspacePick,
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
    asmToSource: new Map(),
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
    const next = applyResolvedSourceText(
      placeholderFile({
        lineCount: 1728,
        sparse: true,
        metricsColumns: [
          { id: 'instructionsExecuted', label: 'Instructions Executed', kind: 'number' },
          { id: 'samplingStall', label: 'Sampling Stall', kind: 'number' },
          { id: 'warpOccupancy', label: 'Warp Occupancy', kind: 'percent' },
        ],
      }),
      text,
    );
    expect(next.text).toBe(text);
    expect(next.lines).toHaveLength(40);
    expect(next.lineCount).toBeUndefined();
    expect(next.sparse).toBe(false);
    expect(next.lines[38]!.values.samplingStall).toBe(12);
    expect(next.lines[38]!.stallBreakdown?.[0]?.metric).toBe('IBuf empty');
    expect(next.lines[0]!.values.samplingStall).toBe(0);
  });

  it('applyResolvedSourceText zeros use the file metricsColumns (not compute ids)', () => {
    const text = 'a\nb\nc';
    const next = applyResolvedSourceText(
      placeholderFile({
        lineCount: 100,
        metricsColumns: [
          { id: 'executionCount', label: 'Instructions Executed', kind: 'number' },
          { id: 'tickCount', label: 'Tick Count', kind: 'number' },
        ],
        lines: [{ line: 2, values: { executionCount: 9, tickCount: 3 } }],
      }),
      text,
    );
    expect(next.lines).toHaveLength(3);
    expect(next.lines[0]!.values).toEqual({ executionCount: 0, tickCount: 0 });
    expect(next.lines[1]!.values.executionCount).toBe(9);
    expect(next.lines[0]!.values.instructionsExecuted).toBeUndefined();
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

describe('workspaceSourceResolver', () => {
  const pick = (
    files: Array<{ path: string; text: string }>,
  ): SourceWorkspacePick => ({ files });

  it('matches an exact absolute path', async () => {
    const resolve = workspaceSourceResolver(
      pick([
        { path: '/home/build/gather_2d.asc', text: 'exact\n' },
        { path: '/home/build/other.asc', text: 'other\n' },
      ]),
    );
    await expect(
      resolve({ fileName: '/home/build/gather_2d.asc', basename: 'gather_2d.asc' }),
    ).resolves.toBe('exact\n');
  });

  it('normalizes backslashes before matching', async () => {
    const resolve = workspaceSourceResolver(
      pick([{ path: 'src\\kernel\\gather_2d.asc', text: 'win\n' }]),
    );
    await expect(
      resolve({ fileName: 'D:/build/src/kernel/gather_2d.asc', basename: 'gather_2d.asc' }),
    ).resolves.toBe('win\n');
  });

  it('prefers the longest path suffix at a segment boundary', async () => {
    const resolve = workspaceSourceResolver(
      pick([
        { path: 'kernels/gather_2d.asc', text: 'short\n' },
        { path: 'src/kernel/gather_2d.asc', text: 'long\n' },
      ]),
    );
    await expect(
      resolve({ fileName: '/home/build/src/kernel/gather_2d.asc', basename: 'gather_2d.asc' }),
    ).resolves.toBe('long\n');
  });

  it('falls back to the request basename when no path suffix matches', async () => {
    const resolve = workspaceSourceResolver(
      pick([{ path: 'workspace/gather_2d.asc', text: 'by name\n' }]),
    );
    await expect(
      resolve({ fileName: '/tmp/device_dump.bin', basename: 'gather_2d.asc' }),
    ).resolves.toBe('by name\n');
  });

  it('scores absolute workspace paths by shared segments, not a literal suffix', async () => {
    const resolve = workspaceSourceResolver(
      pick([
        { path: '/build/other/kernel.asc', text: 'shallow\n' },
        { path: '/build/src/kernel.asc', text: 'deep\n' },
      ]),
    );
    await expect(
      resolve({ fileName: '/src/kernel.asc', basename: 'kernel.asc' }),
    ).resolves.toBe('deep\n');
  });

  it('returns null when two distinct candidates share the best match', async () => {
    const resolve = workspaceSourceResolver(
      pick([
        { path: 'a/gather_2d.asc', text: 'one\n' },
        { path: 'b/gather_2d.asc', text: 'two\n' },
      ]),
    );
    await expect(
      resolve({ fileName: '/home/build/gather_2d.asc', basename: 'gather_2d.asc' }),
    ).resolves.toBeNull();
  });

  it('retries case-insensitively only after the case-sensitive pass misses', async () => {
    const resolve = workspaceSourceResolver(
      pick([{ path: 'src/Gather_2D.ASC', text: 'folded\n' }]),
    );
    await expect(
      resolve({ fileName: '/home/build/gather_2d.asc', basename: 'gather_2d.asc' }),
    ).resolves.toBe('folded\n');
  });

  it('skips an empty file and keeps searching', async () => {
    const resolve = workspaceSourceResolver(
      pick([
        { path: 'a/gather_2d.asc', text: '' },
        { path: 'b/gather_2d.asc', text: 'real\n' },
      ]),
    );
    await expect(
      resolve({ fileName: 'b/gather_2d.asc', basename: 'gather_2d.asc' }),
    ).resolves.toBe('real\n');
  });
});

describe('modelNeedsSourceResolve', () => {
  it('needs a resolve only for a real model with a placeholder file', () => {
    expect(modelNeedsSourceResolve(null)).toBe(false);
    expect(modelNeedsSourceResolve(modelWith([placeholderFile({ text: 'real\n' })]))).toBe(false);
    expect(modelNeedsSourceResolve(modelWith([placeholderFile()]))).toBe(true);
    expect(modelNeedsSourceResolve({ ...modelWith([placeholderFile()]), mock: true })).toBe(false);
  });
});

describe('sourceBasename and sourceResolveRequests', () => {
  it('derives the basename from the path, not the opaque file id', () => {
    expect(sourceBasename('/sdk/kernel.asc')).toBe('kernel.asc');
    expect(sourceBasename('D:\\sdk\\kernel.asc')).toBe('kernel.asc');
  });

  it('requests the path basename for an emulate-shaped file id', async () => {
    // Emulate adapters store a DB id, not a filename, in `file.id`.
    const emulateFile = placeholderFile({ id: '7', path: '/sdk/kernel.asc' });
    const model = modelWith([emulateFile]);
    expect(sourceResolveRequests(model)).toEqual([
      { fileName: '/sdk/kernel.asc', basename: 'kernel.asc' },
    ]);
    const resolve = vi.fn(async () => 'int kernel() {}\n');
    await resolveMissingSourceFiles(model, resolve);
    expect(resolve).toHaveBeenCalledWith({
      fileName: '/sdk/kernel.asc',
      basename: 'kernel.asc',
    });
  });

  it('dedupes placeholder paths and skips files that already have text', () => {
    const model = modelWith([
      placeholderFile({ id: '1', path: '/src/a.asc' }),
      placeholderFile({ id: '2', path: '/src/a.asc' }),
      placeholderFile({ id: '3', path: '/src/b.asc', text: 'real\n' }),
      placeholderFile({ id: '4', path: '/src/c.asc' }),
    ]);
    expect(sourceResolveRequests(model)).toEqual([
      { fileName: '/src/a.asc', basename: 'a.asc' },
      { fileName: '/src/c.asc', basename: 'c.asc' },
    ]);
  });
});
