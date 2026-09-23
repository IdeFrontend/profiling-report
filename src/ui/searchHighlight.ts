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
