/**
 * Tiny dependency-free C/C++/AscendC tokenizer for the Sudu <pre> fallback.
 *
 * ponytail: line-at-a-time scan with one flag for an open block comment.
 * Ceiling: no templates, raw strings, or preprocessor continuations — the
 * fallback only needs readable colors when WebGL keeps Sudu from booting.
 */

export type HighlightKind =
  | 'plain'
  | 'comment'
  | 'string'
  | 'number'
  | 'keyword'
  | 'preproc';

export interface HighlightToken {
  kind: HighlightKind;
  text: string;
}

const LANGUAGE_RE = /^(?:c|cpp|c\+\+|ascendc|cuda)$/i;
const PATH_RE = /\.(?:c|h|cc|cpp|cxx|hpp|asc|cce)$/i;

export function supportsSimpleHighlight(language?: string, path?: string): boolean {
  const lang = language?.trim();
  return (lang != null && LANGUAGE_RE.test(lang)) || (path != null && PATH_RE.test(path));
}

const KEYWORDS = new Set(
  (
    'alignas alignof auto bool break case catch char class const constexpr continue ' +
    'default delete do double else enum explicit extern false float for friend goto if ' +
    'inline int long mutable namespace new noexcept nullptr operator private protected ' +
    'public register return short signed sizeof static struct switch template this throw ' +
    'true try typedef typename union unsigned using virtual void volatile while ' +
    'int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t size_t ' +
    '__global__ __aicore__ __gm__ __ubuf__ __aic__ __in__ __out__ __local__ ' +
    '__restrict__ __attribute__'
  ).split(' '),
);

const WORD_START = /[A-Za-z_$]/;
const WORD_BODY = /[A-Za-z0-9_$]/;
const NUMBER_RE = /^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)[uUlLfF]*/;
const PREPROC_RE = /^\s*#/;

function pushToken(tokens: HighlightToken[], kind: HighlightKind, text: string): void {
  if (!text) return;
  const last = tokens[tokens.length - 1];
  if (last && last.kind === kind) last.text += text;
  else tokens.push({ kind, text });
}

/** End index (exclusive) of a quoted run, or line length when unterminated. */
function scanQuoted(line: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '\\') i += 2;
    else if (ch === quote) return i + 1;
    else i += 1;
  }
  return line.length;
}

interface LineState {
  inBlock: boolean;
}

function tokenizeLine(line: string, state: LineState): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;

  if (state.inBlock) {
    const end = line.indexOf('*/');
    if (end < 0) {
      pushToken(tokens, 'comment', line);
      return tokens;
    }
    pushToken(tokens, 'comment', line.slice(0, end + 2));
    state.inBlock = false;
    i = end + 2;
  } else if (PREPROC_RE.test(line)) {
    pushToken(tokens, 'preproc', line);
    return tokens;
  }

  while (i < line.length) {
    const ch = line[i];
    if (ch === '/' && line[i + 1] === '/') {
      pushToken(tokens, 'comment', line.slice(i));
      break;
    }
    if (ch === '/' && line[i + 1] === '*') {
      const end = line.indexOf('*/', i + 2);
      if (end < 0) {
        pushToken(tokens, 'comment', line.slice(i));
        state.inBlock = true;
        break;
      }
      pushToken(tokens, 'comment', line.slice(i, end + 2));
      i = end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const end = scanQuoted(line, i, ch);
      pushToken(tokens, 'string', line.slice(i, end));
      i = end;
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      const text = NUMBER_RE.exec(line.slice(i))?.[0] ?? ch;
      pushToken(tokens, 'number', text);
      i += text.length;
      continue;
    }
    if (WORD_START.test(ch)) {
      let j = i + 1;
      while (j < line.length && WORD_BODY.test(line[j])) j += 1;
      const word = line.slice(i, j);
      pushToken(tokens, KEYWORDS.has(word) ? 'keyword' : 'plain', word);
      i = j;
      continue;
    }
    pushToken(tokens, 'plain', ch);
    i += 1;
  }
  return tokens;
}

export function highlightLines(
  text: string,
  language?: string,
  path?: string,
): HighlightToken[][] {
  const lines = text.split('\n');
  if (!supportsSimpleHighlight(language, path)) {
    return lines.map((line) => [{ kind: 'plain', text: line }]);
  }
  const state: LineState = { inBlock: false };
  return lines.map((line) => tokenizeLine(line, state));
}
