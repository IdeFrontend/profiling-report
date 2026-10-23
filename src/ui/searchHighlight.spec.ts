import { describe, expect, it } from 'vitest';
import { highlightParts, matchRanges } from './searchHighlight';

describe('highlightParts', () => {
  it('splits case-insensitive substring matches', () => {
    expect(highlightParts('aiv_mte2_ratio', 'MTE2')).toEqual([
      { text: 'aiv_', match: false },
      { text: 'mte2', match: true },
      { text: '_ratio', match: false },
    ]);
  });

  it('returns a single non-match part when query is empty', () => {
    expect(highlightParts('abc', '')).toEqual([{ text: 'abc', match: false }]);
  });
});

describe('matchRanges', () => {
  it('returns 1-based exclusive-end ranges for case-insensitive hits', () => {
    expect(matchRanges('alpha\nBeta beta\ngamma', 'BE')).toEqual([
      { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 3 },
      { startLineNumber: 2, startColumn: 6, endLineNumber: 2, endColumn: 8 },
    ]);
  });

  it('returns empty for blank query', () => {
    expect(matchRanges('abc', '  ')).toEqual([]);
  });
});
