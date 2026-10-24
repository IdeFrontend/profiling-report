import { describe, expect, it } from 'vitest';
import type { SourceFileModel } from '../../domain/types';
import { resolveSourceFrame } from './resolveSourceFrame';

function file(id: string, path = id): SourceFileModel {
  return { id, path, text: 'int x;\n', metricsColumns: [], lines: [{ line: 1, values: {} }] };
}

const files = [file('gather_2d.asc')];
const absolute = '/home/chenning/asc-devkit/examples/gather_2d/gather_2d.asc';

describe('resolveSourceFrame', () => {
  it('matches bundled sources by basename and opens a missing line at 1', () => {
    expect(resolveSourceFrame(absolute, files)).toEqual({ fileId: 'gather_2d.asc', line: 1 });
    expect(resolveSourceFrame('gather_2d.asc', files)).toEqual({ fileId: 'gather_2d.asc', line: 1 });
    expect(resolveSourceFrame(`${absolute}:39:12`, files)).toEqual({ fileId: 'gather_2d.asc', line: 39 });
    expect(resolveSourceFrame('None:None', files)).toBeNull();
    expect(resolveSourceFrame({ FileName: absolute, Line: 0 }, files)).toEqual({
      fileId: 'gather_2d.asc',
      line: 1,
    });
    expect(resolveSourceFrame({ FileName: absolute, Line: 27 }, files)).toEqual({
      fileId: 'gather_2d.asc',
      line: 27,
    });
    expect(resolveSourceFrame('/tmp/missing.cpp', files)).toBeNull();
    expect(resolveSourceFrame('Gather_2D.ASC:36', files)).toEqual({ fileId: 'gather_2d.asc', line: 36 });
  });
});