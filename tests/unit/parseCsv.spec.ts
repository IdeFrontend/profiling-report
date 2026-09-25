/**
 * parseCsv RFC-4180 quote support (shared util — compute + emulate adapters).
 * @see specs/core/adapt-emulate.spec.md (PR-ASIM-011)
 */
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../src/adapters/parseCsv';

const FULL_QUOTED_TEXT =
  'UB bank conflicts detected. Try to optimize local memory accesses, prefer sequential patterns instead of strided.';

describe('parseCsv quote handling', () => {
  it('PR-ASIM-011: quoted HintMessages text with embedded commas survives as one field', () => {
    const { headers, rows } = parseCsv(
      `HintMsgId,HintMsgText\n1,"${FULL_QUOTED_TEXT}"\n2,Plain message\n`,
    );
    expect(headers).toEqual(['HintMsgId', 'HintMsgText']);
    expect(rows).toHaveLength(2);
    // The naive split would truncate at the first embedded comma.
    expect(rows[0].HintMsgText).toBe(FULL_QUOTED_TEXT);
    expect(rows[0].HintMsgId).toBe('1');
    expect(rows[1].HintMsgText).toBe('Plain message');
  });

  it('unquotes double-quote escapes inside a quoted field', () => {
    const { rows } = parseCsv('A,B\n1,"say ""hi"" now"\n');
    expect(rows[0].B).toBe('say "hi" now');
  });

  it('keeps quote-free tables split exactly like before (no quote, no change)', () => {
    const { headers, rows } = parseCsv('A,B,C\n1,2,3\n4,,6\n');
    expect(headers).toEqual(['A', 'B', 'C']);
    expect(rows).toEqual([
      { A: '1', B: '2', C: '3' },
      { A: '4', B: '', C: '6' },
    ]);
  });

  it('BOM strip, CRLF, cell trim and blank-line skip regressions hold', () => {
    const { headers, rows } = parseCsv('\uFEFFHintMsgId , HintMsgText\r\n 1 , x \r\n\r\n');
    expect(headers).toEqual(['HintMsgId', 'HintMsgText']);
    expect(rows).toEqual([{ HintMsgId: '1', HintMsgText: 'x' }]);
  });

  it('a mid-field quote is literal, not an opener', () => {
    const { rows } = parseCsv('A,B\n1,a"b,c\n');
    expect(rows[0].B).toBe('a"b');
  });

  it('a mid-field quote is kept literally and does not swallow the delimiter', () => {
    const { rows } = parseCsv('A,B,C\n1,sa"y,3\n');
    expect(rows[0].B).toBe('sa"y');
    expect(rows[0].C).toBe('3');
  });

  it('an unterminated quote keeps the rest of the line as one field', () => {
    const { rows } = parseCsv('A,B\n1,"unterminated, text\n');
    expect(rows[0].A).toBe('1');
    expect(rows[0].B).toBe('unterminated, text');
  });

  it('a quoted empty field yields an empty-string cell', () => {
    const { rows } = parseCsv('A,B\n1,""\n');
    expect(rows[0].A).toBe('1');
    expect(rows[0].B).toBe('');
  });

  it('empty input yields empty headers/rows', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] });
    expect(parseCsv('\n\n')).toEqual({ headers: [], rows: [] });
  });
});
