/**
 * Emulate ELF Source | SASS → SourceCorrelationModel (DATA-53).
 *
 * Gate: non-empty SourceInstructions.csv, or AsmMetrics.csv with PC + text.
 * SourceFiles / SourceLines are optional (assembly-only OK, shared with compute
 * missing-embed UX). Does not light from IPCAsmMetrics or hints alone.
 */
import type {
  SourceCorrelationModel,
  SourceFileModel,
  SourceLineMetrics,
  SourceMetricsColumn,
} from '../../domain/types';
import { parseCsv } from '../parseCsv';
import { missingSourceEmbedText } from './resolveSourceFile';

export const EMULATE_SOURCE_EMBED_NAMES = {
  sourceInstructions: ['SourceInstructions.csv', 'sourceinstructions.csv'],
  asmMetrics: ['AsmMetrics.csv', 'asmmetrics.csv'],
  sourceFiles: ['SourceFiles.csv', 'sourcefiles.csv'],
  sourceLines: ['SourceLines.csv', 'sourcelines.csv'],
  debugInfo: ['DebugInfo.csv', 'debuginfo.csv'],
  sourceLineMetrics: ['SourceLineMetrics.csv', 'sourcelinemetrics.csv'],
} as const;

const SOURCE_COLUMNS: SourceMetricsColumn[] = [
  { id: 'executionCount', label: 'Instructions Executed', kind: 'number' },
  { id: 'tickCount', label: 'Instruction Ticks', kind: 'number' },
  { id: 'relTime', label: 'Relative Time', kind: 'bar' },
  { id: 'warpOccupancy', label: 'Warp Occupancy', kind: 'bar' },
  { id: 'vectorUtilization', label: 'Vector Utilization', kind: 'percent' },
];

const ASM_COLUMNS: SourceMetricsColumn[] = [
  { id: 'address', label: 'Address', kind: 'text' },
  { id: 'assembly', label: 'Assembly', kind: 'text' },
  ...SOURCE_COLUMNS,
];

const NAVIGATE_BY = SOURCE_COLUMNS.map((c) => c.id);

function payloadByName(
  payloads: Record<string, Uint8Array>,
  names: readonly string[],
): Uint8Array | undefined {
  for (const name of names) {
    if (payloads[name]) return payloads[name];
  }
  const lower = Object.fromEntries(
    Object.entries(payloads).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const name of names) {
    const hit = lower[name.toLowerCase()];
    if (hit) return hit;
  }
  return undefined;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function csvRows(
  payloads: Record<string, Uint8Array>,
  names: readonly string[],
  options?: { trim?: boolean },
): Record<string, string>[] {
  const bytes = payloadByName(payloads, names);
  if (!bytes || bytes.byteLength === 0) return [];
  return parseCsv(decodeUtf8(bytes), options).rows;
}

function cell(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (v != null && v !== '') return v.trim();
  }
  // Case-insensitive header fallback (producer exports vary).
  const lower = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const key of keys) {
    const v = lower[key.toLowerCase()];
    if (v != null && v !== '') return v.trim();
  }
  return '';
}

/** Like `cell`, but preserves leading / trailing whitespace (source text). */
function rawCell(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (v != null) return v;
  }
  const lower = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const key of keys) {
    const v = lower[key.toLowerCase()];
    if (v != null) return v;
  }
  return '';
}

/** Empty / missing → null (unavailable). Numeric zero stays 0. */
function parseNullableNumber(raw: string): number | null {
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parsePc(raw: string): number | null {
  if (raw === '') return null;
  const n = raw.startsWith('0x') || raw.startsWith('0X') ? Number.parseInt(raw, 16) : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Two hex words (hi lo) for a report PC — supports full 64-bit values. */
function formatAddress(pc: number): string {
  const hi = Math.floor(pc / 0x1_0000_0000);
  const lo = pc % 0x1_0000_0000;
  return `${hi.toString(16).padStart(8, '0')} ${lo.toString(16).padStart(8, '0')}`;
}

function languageFor(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.asc') || lower.endsWith('.cpp') || lower.endsWith('.h') || lower.endsWith('.c')) {
    return 'ascend-c';
  }
  return 'text';
}

interface MetricVals {
  executionCount: number | null;
  tickCount: number | null;
  relTime: number | null;
  warpOccupancy: number | null;
  /** Stored as 0–1 fraction for `percent` columns (producer ships 0–100). */
  vectorUtilization: number | null;
}

function emptyMetrics(): MetricVals {
  return {
    executionCount: null,
    tickCount: null,
    relTime: null,
    warpOccupancy: null,
    vectorUtilization: null,
  };
}

function metricsFromRow(row: Record<string, string>): MetricVals {
  const executionCount = parseNullableNumber(cell(row, 'ExecutionCount'));
  const tickCount = parseNullableNumber(cell(row, 'TickCount'));
  const relTime = parseNullableNumber(cell(row, 'RelTime'));
  const warpOccupancy = parseNullableNumber(cell(row, 'WarpOccupancy'));
  const vectorRaw = parseNullableNumber(cell(row, 'VectorUtilization'));
  // Producer VectorUtilization is 0–100, including 1 (= 1%). UI percent kind expects 0–1.
  const vectorUtilization = vectorRaw == null ? null : vectorRaw / 100;
  return { executionCount, tickCount, relTime, warpOccupancy, vectorUtilization };
}

function metricValues(m: MetricVals): Record<string, number | string | null> {
  return {
    executionCount: m.executionCount,
    tickCount: m.tickCount,
    relTime: m.relTime,
    warpOccupancy: m.warpOccupancy,
    vectorUtilization: m.vectorUtilization,
  };
}

interface AsmInsn {
  section: number;
  pc: number;
  text: string;
  debugInfoId: string;
}

function instructionsFromRows(rows: Record<string, string>[]): AsmInsn[] {
  const out: AsmInsn[] = [];
  for (const row of rows) {
    const pc = parsePc(cell(row, 'SourceInstrAddr', 'PC'));
    if (pc == null) continue;
    const sectionRaw = cell(row, 'SourceInstrSection');
    const section = sectionRaw === '' ? 0 : Number(sectionRaw);
    out.push({
      section: Number.isFinite(section) ? section : 0,
      pc,
      text: cell(row, 'SourceInstrText', 'InstrName'),
      debugInfoId: cell(row, 'DebugInfoId'),
    });
  }
  out.sort((a, b) => a.section - b.section || a.pc - b.pc);
  return out;
}

function instructionsFromAsmMetrics(rows: Record<string, string>[]): AsmInsn[] {
  const out: AsmInsn[] = [];
  for (const row of rows) {
    const pc = parsePc(cell(row, 'PC'));
    if (pc == null) continue;
    const text = cell(row, 'InstrName', 'SourceInstrText');
    if (!text && cell(row, 'PC') === '') continue;
    out.push({
      section: 0,
      pc,
      text,
      debugInfoId: '',
    });
  }
  out.sort((a, b) => a.pc - b.pc);
  return out;
}

export function hasEmulateSourcePack(payloads: Record<string, Uint8Array>): boolean {
  const instr = csvRows(payloads, EMULATE_SOURCE_EMBED_NAMES.sourceInstructions);
  if (instr.length > 0) return true;
  const asm = csvRows(payloads, EMULATE_SOURCE_EMBED_NAMES.asmMetrics);
  for (const row of asm) {
    const pc = parsePc(cell(row, 'PC'));
    const text = cell(row, 'InstrName', 'SourceInstrText');
    if (pc != null && text) return true;
  }
  return false;
}

export function adaptEmulateSourceCorrelation(
  payloads: Record<string, Uint8Array>,
): SourceCorrelationModel | null {
  if (!hasEmulateSourcePack(payloads)) return null;

  const instrRows = csvRows(payloads, EMULATE_SOURCE_EMBED_NAMES.sourceInstructions);
  const asmMetricRows = csvRows(payloads, EMULATE_SOURCE_EMBED_NAMES.asmMetrics);
  const fileRows = csvRows(payloads, EMULATE_SOURCE_EMBED_NAMES.sourceFiles);
  const lineRows = csvRows(payloads, EMULATE_SOURCE_EMBED_NAMES.sourceLines, { trim: false });
  const debugRows = csvRows(payloads, EMULATE_SOURCE_EMBED_NAMES.debugInfo);
  const sourceMetricRows = csvRows(payloads, EMULATE_SOURCE_EMBED_NAMES.sourceLineMetrics);

  const insns =
    instrRows.length > 0
      ? instructionsFromRows(instrRows)
      : instructionsFromAsmMetrics(asmMetricRows);
  if (insns.length === 0) return null;

  const metricsByPc = new Map<number, MetricVals>();
  for (const row of asmMetricRows) {
    const pc = parsePc(cell(row, 'PC'));
    if (pc == null) continue;
    metricsByPc.set(pc, metricsFromRow(row));
  }

  const filesById = new Map<string, { path: string }>();
  for (const row of fileRows) {
    const id = cell(row, 'SourceFileId');
    if (!id) continue;
    filesById.set(id, { path: cell(row, 'SourceFilePath') || id });
  }
  const ensureFile = (fileId: string) => {
    if (!filesById.has(fileId)) filesById.set(fileId, { path: fileId });
  };

  // DebugInfoId → mapping
  const debugById = new Map<
    string,
    { fileId: string; lineNum: number; lineId: string }
  >();
  for (const row of debugRows) {
    const id = cell(row, 'DebugInfoId');
    if (!id) continue;
    const lineNum = Number(cell(row, 'DebugInfoLineNum', 'LineNum'));
    debugById.set(id, {
      fileId: cell(row, 'SourceFileId', 'FileId'),
      lineNum: Number.isFinite(lineNum) ? lineNum : 0,
      lineId: cell(row, 'SourceLineId', 'LineId'),
    });
  }

  // SourceLineMetrics also carries DebugInfoId → (FileId, LineNum); it keeps
  // instruction mapping working when DebugInfo.csv is absent.
  const metricLineByDebugInfoId = new Map<
    string,
    { fileId: string; lineNum: number }
  >();
  for (const row of sourceMetricRows) {
    const id = cell(row, 'DebugInfoId');
    const fileId = cell(row, 'FileId', 'SourceFileId');
    const lineNum = Number(cell(row, 'LineNum'));
    if (!id || !fileId || !Number.isFinite(lineNum) || lineNum <= 0) continue;
    metricLineByDebugInfoId.set(id, { fileId, lineNum });
  }

  /**
   * Current producer layout: `SourceFileId,SourceLineNum,SourceLineId,SourceLine`
   * is the complete source text (one row per physical line). Legacy packs have
   * only `SourceLineId,SourceLine`, where DebugInfo is the file/line authority.
   */
  const locatedTextByFile = new Map<string, Map<number, string>>();
  const legacyTextById = new Map<string, string>();
  let hasSourceLineLocations = false;
  const ensureLocatedText = (fileId: string) => {
    let m = locatedTextByFile.get(fileId);
    if (!m) {
      m = new Map();
      locatedTextByFile.set(fileId, m);
    }
    return m;
  };
  for (const row of lineRows) {
    const lineId = cell(row, 'SourceLineId');
    const text = rawCell(row, 'SourceLine');
    const fileId = cell(row, 'SourceFileId', 'FileId');
    const lineNum = Number(cell(row, 'SourceLineNum', 'LineNum'));
    if (fileId && Number.isFinite(lineNum) && lineNum > 0) {
      hasSourceLineLocations = true;
      ensureFile(fileId);
      ensureLocatedText(fileId).set(lineNum, text);
    } else if (lineId) {
      legacyTextById.set(lineId, text);
    }
  }

  // Also accept FileId/LineNum directly on AsmMetrics when DebugInfo is sparse.
  const fileLineByPc = new Map<number, { fileId: string; lineNum: number }>();
  for (const row of asmMetricRows) {
    const pc = parsePc(cell(row, 'PC'));
    if (pc == null) continue;
    const fileId = cell(row, 'FileId', 'SourceFileId');
    const lineNum = Number(cell(row, 'LineNum'));
    if (fileId && Number.isFinite(lineNum) && lineNum > 0) {
      fileLineByPc.set(pc, { fileId, lineNum });
    }
  }

  const sourceToAsmByFile = new Map<string, Map<number, number[]>>();
  const asmToSource = new Map<number, { fileId: string; line: number }>();

  const asmLines: SourceLineMetrics[] = insns.map((insn, i) => {
    const asmLine = i + 1;
    const metrics = metricsByPc.get(insn.pc) ?? emptyMetrics();

    let mapped: { fileId: string; lineNum: number } | undefined;
    if (insn.debugInfoId) {
      const d = debugById.get(insn.debugInfoId);
      if (d && d.fileId && d.lineNum > 0 && filesById.has(d.fileId)) {
        mapped = { fileId: d.fileId, lineNum: d.lineNum };
      } else if (d && d.fileId && d.lineNum > 0) {
        // File identity from DebugInfo even when SourceFiles row missing —
        // still useful for maps if we synthesize a file entry below.
        mapped = { fileId: d.fileId, lineNum: d.lineNum };
        ensureFile(d.fileId);
      }
    }
    if (!mapped && insn.debugInfoId) {
      const fromMetric = metricLineByDebugInfoId.get(insn.debugInfoId);
      if (fromMetric) {
        mapped = fromMetric;
        ensureFile(fromMetric.fileId);
      }
    }
    if (!mapped) {
      const fromAsm = fileLineByPc.get(insn.pc);
      if (fromAsm) {
        mapped = fromAsm;
        ensureFile(fromAsm.fileId);
      }
    }

    if (mapped) {
      let byLine = sourceToAsmByFile.get(mapped.fileId);
      if (!byLine) {
        byLine = new Map();
        sourceToAsmByFile.set(mapped.fileId, byLine);
      }
      const list = byLine.get(mapped.lineNum);
      if (list) list.push(asmLine);
      else byLine.set(mapped.lineNum, [asmLine]);
      if (!asmToSource.has(asmLine)) {
        asmToSource.set(asmLine, { fileId: mapped.fileId, line: mapped.lineNum });
      }
    }

    return {
      line: asmLine,
      values: {
        address: formatAddress(insn.pc),
        assembly: insn.text,
        ...metricValues(metrics),
      },
    };
  });

  // Source text. Current packs already carry (file, line) per row. Legacy
  // packs only have line ids, so place their text through DebugInfo.
  const textByFileLine = hasSourceLineLocations
    ? locatedTextByFile
    : new Map<string, Map<number, string>>();
  if (!hasSourceLineLocations) {
    const ensureTextMap = (fileId: string) => {
      let m = textByFileLine.get(fileId);
      if (!m) {
        m = new Map();
        textByFileLine.set(fileId, m);
      }
      return m;
    };
    for (const insn of insns) {
      if (!insn.debugInfoId) continue;
      const d = debugById.get(insn.debugInfoId);
      if (!d || !d.fileId || d.lineNum <= 0) continue;
      if (d.lineId) {
        const text = legacyTextById.get(d.lineId);
        if (text != null) ensureTextMap(d.fileId).set(d.lineNum, text);
      }
    }
  }

  const sourceMetricsByFile = new Map<string, Map<number, MetricVals>>();
  for (const row of sourceMetricRows) {
    const fileId = cell(row, 'FileId', 'SourceFileId');
    const lineNum = Number(cell(row, 'LineNum'));
    if (!fileId || !Number.isFinite(lineNum) || lineNum <= 0) continue;
    let byLine = sourceMetricsByFile.get(fileId);
    if (!byLine) {
      byLine = new Map();
      sourceMetricsByFile.set(fileId, byLine);
    }
    byLine.set(lineNum, metricsFromRow(row));
  }

  // Source files. Current packs ship the complete text, so render it as a
  // normal full document and keep metric rows sparse. A partial line range
  // (legacy packs or a truncated SourceLines file) keeps the collapsed sparse
  // document (reported lines plus blank gap rows).
  const files: SourceFileModel[] = [];
  for (const [fileId, meta] of filesById) {
    const texts = textByFileLine.get(fileId) ?? new Map();
    const fileSourceToAsm = sourceToAsmByFile.get(fileId) ?? new Map<number, number[]>();
    const fileMetrics = sourceMetricsByFile.get(fileId) ?? new Map<number, MetricVals>();
    const interesting = new Set<number>();
    let maxLine = 0;
    let maxTextLine = 0;
    for (const line of texts.keys()) {
      if (line > maxTextLine) maxTextLine = line;
      maxLine = Math.max(maxLine, line);
    }
    for (const line of fileSourceToAsm.keys()) {
      maxLine = Math.max(maxLine, line);
    }
    for (const line of fileMetrics.keys()) {
      maxLine = Math.max(maxLine, line);
    }
    if (maxLine < 1) maxLine = 1;

    // Complete text = every physical line 1..maxLine is present.
    const fullText =
      hasSourceLineLocations &&
      texts.size > 0 &&
      texts.size === maxLine &&
      maxTextLine === maxLine;
    if (!fullText) {
      for (const line of texts.keys()) interesting.add(line);
    }
    for (const line of fileSourceToAsm.keys()) interesting.add(line);
    for (const line of fileMetrics.keys()) interesting.add(line);

    const lineArr: string[] = Array.from({ length: maxLine }, () => '');
    for (const [line, text] of texts) {
      if (line >= 1 && line <= maxLine) lineArr[line - 1] = text;
    }

    const path = meta.path;
    const text =
      texts.size > 0
        ? `${lineArr.join('\n')}\n`
        : missingSourceEmbedText(path, maxLine);

    const lines: SourceLineMetrics[] = [...interesting]
      .sort((a, b) => a - b)
      .map((line) => {
        const m = fileMetrics.get(line) ?? emptyMetrics();
        return { line, values: metricValues(m) };
      });

    files.push({
      id: fileId,
      path,
      language: languageFor(path),
      text,
      metricsColumns: SOURCE_COLUMNS,
      lines,
      lineCount: maxLine,
      sparse: !fullText,
      sourceToAsm: fileSourceToAsm,
    });
  }

  // Stable order: SourceFiles CSV order first, then any synthesized ids.
  const fileOrder = fileRows
    .map((r) => cell(r, 'SourceFileId'))
    .filter(Boolean);
  files.sort((a, b) => {
    const ia = fileOrder.indexOf(a.id);
    const ib = fileOrder.indexOf(b.id);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.id.localeCompare(b.id);
  });

  const assembly: SourceFileModel = {
    id: 'asm',
    path: 'Assembly[abi:emulate]',
    language: 'sass',
    text: insns.map((i) => i.text).join('\n'),
    metricsColumns: ASM_COLUMNS,
    lines: asmLines,
  };

  return {
    files,
    assembly,
    asmToSource,
    navigateBy: [...NAVIGATE_BY],
    mock: false,
  };
}
