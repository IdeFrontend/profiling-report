import { describe, expect, it } from 'vitest';
import { highlightLines, supportsSimpleHighlight } from './simpleHighlight';

describe('supportsSimpleHighlight', () => {
  it('accepts C/C++/AscendC languages and extensions', () => {
    expect(supportsSimpleHighlight('cpp')).toBe(true);
    expect(supportsSimpleHighlight('AscendC')).toBe(true);
    expect(supportsSimpleHighlight(undefined, '/src/kernel.asc')).toBe(true);
    expect(supportsSimpleHighlight(undefined, 'op.cce')).toBe(true);
  });

  it('rejects other languages and extensions', () => {
    expect(supportsSimpleHighlight('python')).toBe(false);
    expect(supportsSimpleHighlight(undefined, 'kernel.s')).toBe(false);
  });
});

describe('highlightLines', () => {
  it('classifies keywords, numbers and strings', () => {
    const [line] = highlightLines('__global__ void f() { int x = 42; char c = "a\\"b"; }', 'cpp');
    const texts = (kind: string) => line.filter((t) => t.kind === kind).map((t) => t.text);
    expect(texts('keyword')).toEqual(['__global__', 'void', 'int', 'char']);
    expect(texts('number')).toEqual(['42']);
    expect(texts('string')).toEqual(['"a\\"b"']);
  });

  it('marks line comments to end of line', () => {
    const [line] = highlightLines('int x; // trailing', 'c');
    expect(line[line.length - 1]).toEqual({ kind: 'comment', text: '// trailing' });
  });

  it('carries a block comment across two lines', () => {
    const lines = highlightLines('int a; /* start\nstill comment */ int b;', 'c');
    expect(lines[0][lines[0].length - 1]).toEqual({ kind: 'comment', text: '/* start' });
    expect(lines[1][0]).toEqual({ kind: 'comment', text: 'still comment */' });
    expect(lines[1].some((t) => t.kind === 'keyword' && t.text === 'int')).toBe(true);
  });

  it('treats a preprocessor line as one preproc token', () => {
    const [line] = highlightLines('  #define FOO 1', 'cpp');
    expect(line).toEqual([{ kind: 'preproc', text: '  #define FOO 1' }]);
  });

  it('returns one plain token per line for unsupported files', () => {
    const lines = highlightLines('mov r0, r1\n// not a comment', undefined, 'x.s');
    expect(lines).toEqual([
      [{ kind: 'plain', text: 'mov r0, r1' }],
      [{ kind: 'plain', text: '// not a comment' }],
    ]);
  });

  it('does not throw on unterminated strings or block comments', () => {
    expect(() => highlightLines('char *s = "oops;', 'c')).not.toThrow();
    const lines = highlightLines('/* forever', 'c');
    expect(lines[0]).toEqual([{ kind: 'comment', text: '/* forever' }]);
  });
});
