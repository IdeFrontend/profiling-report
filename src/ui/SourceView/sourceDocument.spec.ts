import { describe, expect, it } from 'vitest';
import type { SourceFileModel } from '../../domain/types';
import {
  SPARSE_GAP_ROWS,
  sparseDocumentLines,
  sparseSourceDocument,
} from './sourceDocument';

function paddedText(lines: Record<number, string>, maxLine: number): string {
  const rows = Array.from({ length: maxLine }, (_, i) => lines[i + 1] ?? '');
  return `${rows.join('\n')}\n`;
}

function sparseFile(overrides: Partial<SourceFileModel> = {}): SourceFileModel {
  return {
    id: '1',
    path: '/sdk/kernel.asc',
    language: 'ascend-c',
    text: paddedText(
      { 17: '{', 22: 'set_atomic_none();', 23: 'set_mask_norm();', 24: '}' },
      24,
    ),
    metricsColumns: [{ id: 'executionCount', label: 'Instructions Executed', kind: 'number' }],
    lines: [
      { line: 24, values: { executionCount: 2 } },
      { line: 17, values: { executionCount: 10 } },
      { line: 22, values: { executionCount: 0 } },
      { line: 23, values: { executionCount: 5 } },
    ],
    lineCount: 24,
    sparse: true,
    ...overrides,
  };
}

describe('sparse source document', () => {
  it('PR-SRC-018: collapses runs with blank gap rows, preserving contiguous ranges', () => {
    expect(SPARSE_GAP_ROWS).toBe(2);
    expect(sparseDocumentLines([{ line: 17 }, { line: 22 }, { line: 23 }, { line: 24 }])).toEqual([
      17, 0, 0, 22, 23, 24,
    ]);
    // Contiguous runs stay contiguous; duplicates and unsorted rows are normalised.
    expect(sparseDocumentLines([{ line: 5 }, { line: 3 }, { line: 4 }, { line: 4 }])).toEqual([
      3, 4, 5,
    ]);
  });

  it('PR-SRC-018b: builds numbered descriptors and a doc ↔ source map', () => {
    const doc = sparseSourceDocument(sparseFile())!;
    expect(doc.rows.map((row) => row.lineNumber ?? 0)).toEqual([17, 0, 0, 22, 23, 24]);
    expect(doc.rows[0]!.tokens.map((token) => token.text)).toEqual(['{']);
    expect(doc.rows[1]!.tokens).toEqual([]);
    expect(doc.sourceLineOfDoc).toEqual([17, 0, 0, 22, 23, 24]);
    expect(doc.docLineOfSource.get(17)).toBe(1);
    expect(doc.docLineOfSource.get(22)).toBe(4);
    expect(doc.docLineOfSource.get(24)).toBe(6);
    expect(doc.text).toBe('{\n\n\nset_atomic_none();\nset_mask_norm();\n}\n');
  });

  it('PR-SRC-018c: dense files keep the plain text model', () => {
    expect(sparseSourceDocument(sparseFile({ sparse: false }))).toBeNull();
    expect(sparseSourceDocument(sparseFile({ lines: [] }))).toBeNull();
  });
});
