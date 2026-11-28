import { describe, expect, it } from 'vitest';
import {
  alignSourceLines,
  diffRowsByKind,
  diffRowsFromModel,
  rowsFromRanges,
  splitSourceLines,
  textForSideDiff,
  type DiffRow,
} from './diffAlign';

function leftLines(rows: DiffRow[]): number[] {
  return rows.flatMap((row) => (row.leftLine === null ? [] : [row.leftLine]))
}

function rightLines(rows: DiffRow[]): number[] {
  return rows.flatMap((row) => (row.rightLine === null ? [] : [row.rightLine]))
}

describe('splitSourceLines', () => {
  it('splits on newlines', () => {
    expect(splitSourceLines('a\nb\nc')).toEqual(['a', 'b', 'c']);
  });

  it('does not add a phantom row for a trailing newline', () => {
    expect(splitSourceLines('a\nb\n')).toEqual(['a', 'b']);
  });

  it('keeps interior blank lines', () => {
    expect(splitSourceLines('a\n\nb\n')).toEqual(['a', '', 'b']);
  });

  it('returns no lines for empty text', () => {
    expect(splitSourceLines('')).toEqual([]);
  });

  it('strips one trailing newline before Sudu so the canvas matches the table', () => {
    const raw = 'a\nb\n';
    expect(textForSideDiff(raw)).toBe('a\nb');
    expect(splitSourceLines(raw)).toEqual(splitSourceLines(textForSideDiff(raw)));
    expect(textForSideDiff('a\nb')).toBe('a\nb');
  });
});

describe('alignSourceLines', () => {
  it('marks identical files all same with matching numbers', () => {
    const lines = ['int a = 1;', 'return a;'];
    const rows = alignSourceLines(lines, [...lines]);
    expect(rows.map((row) => row.kind)).toEqual(['same', 'same']);
    expect(leftLines(rows)).toEqual([1, 2]);
    expect(rightLines(rows)).toEqual([1, 2]);
    expect(rows[0]).toMatchObject({ leftText: 'int a = 1;', rightText: 'int a = 1;' });
  });

  it('emits one changed row for one changed line', () => {
    const rows = alignSourceLines(['a', 'b', 'c'], ['a', 'B', 'c']);
    expect(rows.map((row) => row.kind)).toEqual(['same', 'changed', 'same']);
    const changed = diffRowsByKind(rows, 'changed');
    expect(changed).toEqual([1]);
    expect(rows[1]).toMatchObject({ leftLine: 2, rightLine: 2, leftText: 'b', rightText: 'B' });
  });

  it('pairs a longer left run with filler rows, then resumes the common suffix', () => {
    const left = ['header', 'x1', 'x2', 'x3', 'x4', 'x5', 'footer'];
    const right = ['header', 'footer'];
    const rows = alignSourceLines(left, right);
    expect(rows.map((row) => row.kind)).toEqual([
      'same',
      'onlyLeft',
      'onlyLeft',
      'onlyLeft',
      'onlyLeft',
      'onlyLeft',
      'same',
    ]);
    expect(diffRowsByKind(rows, 'onlyLeft')).toHaveLength(5);
    expect(rows[1]).toMatchObject({ leftLine: 2, rightLine: null, leftText: 'x1', rightText: '' });
    expect(rows[5]).toMatchObject({ leftLine: 6, rightLine: null, leftText: 'x5' });
    expect(rows[6]).toMatchObject({ kind: 'same', leftLine: 7, rightLine: 2, leftText: 'footer', rightText: 'footer' });
  });

  it('pairs filler rows on the right when only the right side grows', () => {
    const rows = alignSourceLines(['a', 'c'], ['a', 'b1', 'b2', 'c']);
    expect(rows.map((row) => row.kind)).toEqual(['same', 'onlyRight', 'onlyRight', 'same']);
    expect(rows[1]).toMatchObject({ leftLine: null, rightLine: 2, leftText: '', rightText: 'b1' });
    expect(rows[3]).toMatchObject({ leftLine: 2, rightLine: 4 });
  });

  it('handles empty left against non-empty right', () => {
    const rows = alignSourceLines([], ['a', 'b']);
    expect(rows.map((row) => row.kind)).toEqual(['onlyRight', 'onlyRight']);
    expect(leftLines(rows)).toEqual([]);
    expect(rightLines(rows)).toEqual([1, 2]);
  });

  it('handles non-empty left against empty right', () => {
    const rows = alignSourceLines(['a', 'b'], []);
    expect(rows.map((row) => row.kind)).toEqual(['onlyLeft', 'onlyLeft']);
    expect(rightLines(rows)).toEqual([]);
  });

  it('returns no rows when both sides are empty', () => {
    expect(alignSourceLines([], [])).toEqual([]);
  });

  it('treats a trailing newline as no extra row', () => {
    const left = splitSourceLines('a\nb\n');
    const right = splitSourceLines('a\nb\n');
    expect(alignSourceLines(left, right).map((row) => row.kind)).toEqual(['same', 'same']);
  });

  it('falls back to one hunk above the LCS cell limit', () => {
    const left: string[] = [];
    const right: string[] = [];
    for (let i = 0; i < 2100; i += 1) left.push(`L${i}`);
    for (let i = 0; i < 2000; i += 1) right.push(`R${i}`);
    left[0] = right[0] = 'shared-head';
    left[2099] = right[1999] = 'shared-tail';

    const naiveRows =
      1 + Math.max(left.length - 2, right.length - 2) + 1;
    const rows = alignSourceLines(left, right);

    expect(left.length * right.length).toBeGreaterThan(4_000_000);
    expect(rows).toHaveLength(naiveRows);
    expect(rows[0].kind).toBe('same');
    expect(rows[rows.length - 1]).toMatchObject({
      kind: 'same',
      leftLine: 2100,
      rightLine: 2000,
    });
    expect(diffRowsByKind(rows, 'same')).toHaveLength(2);
    expect(diffRowsByKind(rows, 'changed')).toHaveLength(1998);
    expect(diffRowsByKind(rows, 'onlyLeft')).toHaveLength(100);
  });
});

describe('rowsFromRanges', () => {
  it('pairs both sides by offset inside each range', () => {
    const left = ['a', 'b', 'c'];
    const right = ['a', 'B', 'c'];
    const ranges = [
      { $fromL: 0, $lenL: 1, $fromR: 0, $lenR: 1 },
      { $fromL: 1, $lenL: 1, $fromR: 1, $lenR: 1 },
      { $fromL: 2, $lenL: 1, $fromR: 2, $lenR: 1 },
    ];
    const rows = rowsFromRanges(ranges, left, right)!;
    expect(rows.map((row) => row.kind)).toEqual(['same', 'changed', 'same']);
    expect(rows[1]).toMatchObject({ leftLine: 2, rightLine: 2, leftText: 'b', rightText: 'B' });
  });

  it('keeps the library pairing instead of recomputing an LCS', () => {
    const left = ['a', 'b', 'c'];
    const right = ['a', 'c'];
    // The library pairs 'b' with 'c' inside one hunk.
    const rows = rowsFromRanges(
      [
        { $fromL: 0, $lenL: 1, $fromR: 0, $lenR: 1 },
        { $fromL: 1, $lenL: 2, $fromR: 1, $lenR: 1 },
      ],
      left,
      right,
    )!;
    expect(rows.map((row) => row.kind)).toEqual(['same', 'changed', 'onlyLeft']);
    expect(alignSourceLines(left, right).map((row) => row.kind)).toEqual(['same', 'onlyLeft', 'same']);
  });

  it('pads the shorter side with filler rows', () => {
    const rows = rowsFromRanges([{ $fromL: 0, $lenL: 2, $fromR: 0, $lenR: 1 }], ['a', 'b'], ['a'])!;
    expect(rows.map((row) => row.kind)).toEqual(['same', 'onlyLeft']);
    expect(rows[1]).toMatchObject({ leftLine: 2, rightLine: null, rightText: '' });
  });

  it('returns null when the ranges do not partition both texts', () => {
    expect(rowsFromRanges([{ $fromL: 0, $lenL: 1, $fromR: 0, $lenR: 1 }], ['a', 'b'], ['a'])).toBeNull();
    expect(rowsFromRanges([], ['a'], [])).toBeNull();
  });
});

describe('diffRowsFromModel', () => {
  it('reads the library ranges once the worker diff lands', () => {
    const model = {
      $javaModel0: {
        $diffModel0: { $ranges: { data: [{ $fromL: 0, $lenL: 1, $fromR: 0, $lenR: 1 }] } },
      },
    };
    expect(diffRowsFromModel(model, ['a'], ['a'])).toEqual([
      { kind: 'same', leftLine: 1, rightLine: 1, leftText: 'a', rightText: 'a' },
    ]);
  });

  it('returns null before the diff lands or when the private fields move', () => {
    expect(diffRowsFromModel(null, ['a'], ['a'])).toBeNull();
    expect(diffRowsFromModel({}, ['a'], ['a'])).toBeNull();
    expect(diffRowsFromModel({ $javaModel0: { $diffModel0: { $ranges: {} } } }, ['a'], ['a'])).toBeNull();
  });
});
