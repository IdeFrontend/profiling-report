import type { ILineDescriptor } from '@sudu-ide/types/frontend';
import { isMissingSourceEmbed } from '../../adapters/sourceCorrelation/resolveSourceFile';
import type { SourceFileModel } from '../../domain/types';

/**
 * Blank attached rows inserted where the pack skipped source lines. Two rows
 * read as a visible break without pretending the gap has a line number.
 */
export const SPARSE_GAP_ROWS = 2;

/**
 * Collapsed document order for a sparse pack: the reported source lines, with
 * `SPARSE_GAP_ROWS` zeros (blank, unnumbered rows) between non-contiguous runs.
 * `0` is an attached row — never a source line.
 */
export function sparseDocumentLines(lines: readonly { line: number }[]): number[] {
  const sorted = [...new Set(lines.map((r) => r.line))]
    .filter((line) => line > 0)
    .sort((a, b) => a - b);
  const out: number[] = [];
  let prev = 0;
  for (const line of sorted) {
    if (prev > 0 && line > prev + 1) {
      for (let i = 0; i < SPARSE_GAP_ROWS; i++) out.push(0);
    }
    out.push(line);
    prev = line;
  }
  return out;
}

/**
 * Collapsed row list shared by the editor and the metrics table.
 * `null` for dense files, and for a sparse file with no reported lines and no
 * missing-embed banner (both panes then use the plain `text` / `lineCount`).
 * A missing embed with no reported lines is one row so the banner is not
 * dropped while the table shows extent 0.
 */
export function sparseLayout(file: Pick<SourceFileModel, 'sparse' | 'lines' | 'text'>): number[] | null {
  if (!file.sparse) return null;
  const layout = sparseDocumentLines(file.lines);
  if (layout.length > 0) return layout;
  if (isMissingSourceEmbed(file.text)) return [1];
  return null;
}

export interface SparseSourceDocument {
  /** Sudu `newTextModelFromLines` descriptors, in collapsed order. */
  rows: ILineDescriptor[];
  /** Document text; search ranges are in these 1-based document rows. */
  text: string;
  /** Source line → 1-based document row. */
  docLineOfSource: Map<number, number>;
  /** 1-based document row → source line; `0` for a blank gap row. */
  sourceLineOfDoc: number[];
}

/**
 * Build the mapped document for a sparse emulate source file. Returns `null`
 * for dense files (compute embeds, resolved source text), which keep the plain
 * `newTextModel(file.text)` path.
 */
export function sparseSourceDocument(file: SourceFileModel): SparseSourceDocument | null {
  const layout = sparseLayout(file);
  if (!layout) return null;
  const textByLine = file.text.split(/\r?\n/);
  // The placeholder is written only on padded line 1. Reported lines often
  // start later, so put that banner on the first rendered row.
  const banner = isMissingSourceEmbed(file.text) ? (textByLine[0] ?? '') : '';
  let bannerPending = banner.length > 0;
  const rows: ILineDescriptor[] = [];
  const docLineOfSource = new Map<number, number>();
  const sourceLineOfDoc: number[] = [];
  for (const line of layout) {
    if (line === 0) {
      rows.push({ tokens: [] });
      sourceLineOfDoc.push(0);
      continue;
    }
    let text = textByLine[line - 1] ?? '';
    if (bannerPending) {
      if (!text) text = banner;
      bannerPending = false;
    }
    rows.push({ lineNumber: line, tokens: [{ text }] });
    sourceLineOfDoc.push(line);
    docLineOfSource.set(line, rows.length);
  }
  const text = `${rows.map((row) => row.tokens.map((token) => token.text).join('')).join('\n')}\n`;
  return { rows, text, docLineOfSource, sourceLineOfDoc };
}
