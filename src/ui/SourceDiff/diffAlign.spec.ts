import { describe, expect, it } from 'vitest';
import { alignSourceLines, diffRowsByKind, splitSourceLines, type DiffRow } from './diffAlign';

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
