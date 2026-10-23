/** 1-based document range (Sudu / VS Code style; end column exclusive). */
export type SearchRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

/** Split `text` into runs for UI-43 substring chips (case-insensitive). */
export function highlightParts(
  text: string,
  query: string,
): { text: string; match: boolean }[] {
  if (!query) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: { text: string; match: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const j = lower.indexOf(q, i);
    if (j === -1) {
      parts.push({ text: text.slice(i), match: false });
      break;
    }
    if (j > i) parts.push({ text: text.slice(i, j), match: false });
    parts.push({ text: text.slice(j, j + q.length), match: true });
    i = j + q.length;
  }
  return parts;
}

/**
 * Case-insensitive substring matches as Sudu `highlightRanges` / `IRange`s.
 * Empty query → []. End column is exclusive (1-based).
 */
export function matchRanges(text: string, query: string): SearchRange[] {
  const q = query.trim();
  if (!q) return [];
  const needle = q.toLowerCase();
  const ranges: SearchRange[] = [];
  const lines = text.split(/\r?\n/);
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!;
    const lower = line.toLowerCase();
    let from = 0;
    while (from <= lower.length - needle.length) {
      const idx = lower.indexOf(needle, from);
      if (idx < 0) break;
      ranges.push({
        startLineNumber: li + 1,
        startColumn: idx + 1,
        endLineNumber: li + 1,
        endColumn: idx + q.length + 1,
      });
      from = idx + q.length;
    }
  }
  return ranges;
}
