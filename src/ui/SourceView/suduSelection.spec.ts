import { describe, expect, it } from 'vitest';
import { selectedTextFromSudu } from './suduSelection';

function editor(text: string, start: [number, number], end: [number, number]) {
  return {
    getText: () => text,
    $editor0: {
      $model: {
        $selection: {
          $startPos: { $line: start[0], $charPos: start[1] },
          $endPos: { $line: end[0], $charPos: end[1] },
        },
      },
    },
  };
}

describe('selectedTextFromSudu', () => {
  const text = 'alpha\nbeta\ngamma';

  it('returns null for a caret with no range', () => {
    expect(selectedTextFromSudu(editor(text, [1, 2], [1, 2]))).toBeNull();
    expect(selectedTextFromSudu(null)).toBeNull();
    expect(selectedTextFromSudu({})).toBeNull();
  });

  it('slices one line and a reversed range', () => {
    expect(selectedTextFromSudu(editor(text, [0, 1], [0, 4]))).toBe('lph');
    expect(selectedTextFromSudu(editor(text, [0, 4], [0, 1]))).toBe('lph');
  });

  it('joins a multi-line range with newlines', () => {
    expect(selectedTextFromSudu(editor(text, [0, 3], [2, 2]))).toBe('ha\nbeta\nga');
  });

  it('treats (lineCount, 0) as the exclusive end of the last line', () => {
    expect(selectedTextFromSudu(editor(text, [2, 0], [3, 0]))).toBe('gamma\n');
    expect(selectedTextFromSudu(editor(text, [3, 0], [2, 0]))).toBe('gamma\n');
    expect(selectedTextFromSudu(editor(text, [1, 2], [3, 0]))).toBe('ta\ngamma\n');
    expect(selectedTextFromSudu(editor(text, [0, 0], [1, 0]))).toBe('alpha\n');
    expect(selectedTextFromSudu(editor(text, [0, 3], [2, 2]))).toBe('ha\nbeta\nga');
    expect(selectedTextFromSudu(editor(text, [1, 2], [1, 2]))).toBeNull();
    expect(selectedTextFromSudu(editor(text, [2, 0], [4, 0]))).toBeNull();
    expect(selectedTextFromSudu(editor(text, [2, 0], [3, 1]))).toBeNull();
  });
});
