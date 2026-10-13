import type { SourceCorrelationModel, SourceFileModel } from '../../domain/types';

export type SourceInlineRow = {
  fileId: string;
  line: number;
  preview: string;
  asmCount: number;
};

export type SourceMarkerRow = {
  fileId: string;
  line: number;
  kind: 'stall' | 'hot';
  label: string;
  value: number;
};

export type SourceStatRow = {
  id: string;
  label: string;
  value: string;
};

function linePreview(file: SourceFileModel, line: number): string {
  const text = file.text.split(/\r?\n/)[line - 1] ?? '';
  return text.trim().slice(0, 72) || `(line ${line})`;
}

/** Mapped source↔asm sites for the Inline Functions dock (mock-derived until Product schema). */
export function inlineFunctionRows(
  model: SourceCorrelationModel,
  file: SourceFileModel | null,
): SourceInlineRow[] {
  if (!file) return [];
  const prefix = `${file.id}:`;
  return Object.keys(model.sourceToAsm)
    .filter((k) => k.startsWith(prefix))
    .map((k) => {
      const line = Number(k.slice(prefix.length));
      return {
        fileId: file.id,
        line,
        preview: linePreview(file, line),
        asmCount: model.sourceToAsm[k]?.length ?? 0,
      };
    })
    .filter((r) => Number.isFinite(r.line))
    .sort((a, b) => a.line - b.line);
}

/** Hot / stall marker rows for Source Markers dock. */
export function sourceMarkerRows(file: SourceFileModel | null): SourceMarkerRow[] {
  if (!file) return [];
  const out: SourceMarkerRow[] = [];
  for (const row of file.lines) {
    const stall = row.values.samplingStall;
    if (typeof stall === 'number' && stall > 0 && row.stallBreakdown?.length) {
      out.push({
        fileId: file.id,
        line: row.line,
        kind: 'stall',
        label: 'Sampling Stall',
        value: stall,
      });
      continue;
    }
    const insn = row.values.instructionsExecuted;
    if (typeof insn === 'number' && insn > 0) {
      out.push({
        fileId: file.id,
        line: row.line,
        kind: 'hot',
        label: 'Instructions Executed',
        value: insn,
      });
    }
  }
  return out.sort((a, b) => b.value - a.value).slice(0, 40);
}

/** Aggregate statistics for the active source file. */
export function sourceStatRows(file: SourceFileModel | null): SourceStatRow[] {
  if (!file) return [];
  let insn = 0;
  let stall = 0;
  let occSum = 0;
  let occN = 0;
  let mapped = 0;
  for (const row of file.lines) {
    const i = row.values.instructionsExecuted;
    if (typeof i === 'number') insn += i;
    const s = row.values.samplingStall;
    if (typeof s === 'number') stall += s;
    const o = row.values.warpOccupancy;
    if (typeof o === 'number') {
      occSum += o;
      occN += 1;
    }
    if (i || s || o) mapped += 1;
  }
  return [
    { id: 'lines', label: 'Lines with metrics', value: String(mapped) },
    { id: 'insn', label: 'Instructions Executed (sum)', value: String(Math.round(insn)) },
    { id: 'stall', label: 'Sampling Stall (sum)', value: String(Math.round(stall)) },
    {
      id: 'occ',
      label: 'Warp Occupancy (avg)',
      value: occN ? `${Math.round((occSum / occN) * 100)}%` : '—',
    },
  ];
}
