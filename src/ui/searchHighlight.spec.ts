import { describe, expect, it } from 'vitest';
import { highlightParts } from './searchHighlight';

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
