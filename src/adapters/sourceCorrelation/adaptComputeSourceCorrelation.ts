import type {
  SourceCorrelationModel,
  SourceFileModel,
  SourceLineMetrics,
  SourceMetricsColumn,
} from '../../domain/types';
import { parseObjdump, normalizePc } from './parseObjdump';
import { parseSymbolizer } from './parseSymbolizer';
import {
  isPcSamplingSqlReady,
  readPcSamplingDbSync,
  type PcSamplingRow,
} from './readPcSamplingDb';

const SOURCE_COLUMNS: SourceMetricsColumn[] = [
  { id: 'instructionsExecuted', label: 'Instructions Executed', kind: 'number' },
  { id: 'samplingStall', label: 'Sampling Stall', kind: 'number' },
  { id: 'warpOccupancy', label: 'Warp Occupancy', kind: 'bar' },
];

const ASM_COLUMNS: SourceMetricsColumn[] = [
  { id: 'address', label: 'Address', kind: 'text' },
  { id: 'assembly', label: 'Assembly', kind: 'text' },
  { id: 'instructionsExecuted', label: 'Instructions Executed', kind: 'number' },
  { id: 'samplingStall', label: 'Sampling Stall', kind: 'number' },
  { id: 'warpOccupancy', label: 'Warp Occupancy', kind: 'bar' },
];

export const COMPUTE_SOURCE_EMBED_NAMES = {
  objdump: ['objdump.txt'],
  symbolizer: ['symbolizer.json'],
  summaryDb: ['summary.db'],
} as const;

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

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

/** Find source text by exact path, basename, or `.asc` / `.cpp` sibling name. */
function findSourceText(
  payloads: Record<string, Uint8Array>,
  fileName: string,
): { id: string; path: string; text: string } | null {
  const want = basename(fileName);
  for (const [key, bytes] of Object.entries(payloads)) {
    if (basename(key) === want || key === fileName) {
      return { id: want, path: key, text: decodeText(bytes) };
    }
  }
  const lowerWant = want.toLowerCase();
  for (const [key, bytes] of Object.entries(payloads)) {
    if (basename(key).toLowerCase() === lowerWant) {
      return { id: want, path: key, text: decodeText(bytes) };
    }
  }
  return null;
}

function formatAddress(pcHex: string): string {
  const hi = '00000000';
  const lo = pcHex.padStart(8, '0');
  return `${hi} ${lo}`;
}

function emptyMetrics(lineCount: number): SourceLineMetrics[] {
  return Array.from({ length: lineCount }, (_, i) => ({
    line: i + 1,
    values: {
      instructionsExecuted: 0,
      samplingStall: 0,
      warpOccupancy: 0,
    },
  }));
}

function languageFor(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.asc') || lower.endsWith('.cpp') || lower.endsWith('.h')) {
    return 'ascend-c';
  }
  return 'text';
}

/**
 * Detect compute Source pack: `objdump.txt` plus `symbolizer.json` and/or `summary.db`.
 */
export function hasComputeSourcePack(payloads: Record<string, Uint8Array>): boolean {
  const objdump = payloadByName(payloads, COMPUTE_SOURCE_EMBED_NAMES.objdump);
  if (!objdump?.byteLength) return false;
  const symbolizer = payloadByName(payloads, COMPUTE_SOURCE_EMBED_NAMES.symbolizer);
  const summaryDb = payloadByName(payloads, COMPUTE_SOURCE_EMBED_NAMES.summaryDb);
  return !!(symbolizer?.byteLength || summaryDb?.byteLength);
}

/**
 * Build `SourceCorrelationModel` from compute embeds (`objdump` / `symbolizer` / `summary.db` / source).
 * Requires `ensurePcSamplingSql()` when `summary.db` is present.
 */
export function adaptComputeSourceCorrelation(
  payloads: Record<string, Uint8Array>,
): SourceCorrelationModel | null {
  if (!hasComputeSourcePack(payloads)) return null;

  const objdumpBytes = payloadByName(payloads, COMPUTE_SOURCE_EMBED_NAMES.objdump);
  if (!objdumpBytes) return null;
  const insns = parseObjdump(decodeText(objdumpBytes));
  if (!insns.length) return null;

  const symbolizerBytes = payloadByName(payloads, COMPUTE_SOURCE_EMBED_NAMES.symbolizer);
  const sites = symbolizerBytes ? parseSymbolizer(decodeText(symbolizerBytes)) : [];
  const siteByPc = new Map(sites.map((s) => [s.pc, s]));

  const summaryBytes = payloadByName(payloads, COMPUTE_SOURCE_EMBED_NAMES.summaryDb);
  let stallByPc = new Map<string, PcSamplingRow>();
  if (summaryBytes?.byteLength) {
    if (!isPcSamplingSqlReady()) {
      console.warn(
        '[profiling-report] ignoring summary.db: sql.js is not initialized (await ensurePcSamplingSql() for stall metrics)',
      );
    } else {
      try {
        stallByPc = new Map(
          readPcSamplingDbSync(summaryBytes).map((row) => [normalizePc(row.pcOffset), row]),
        );
      } catch (cause) {
        // Keep Source/SASS from objdump (+ symbolizer); omit stall metrics rather than failLoad.
        const detail = cause instanceof Error ? cause.message : String(cause);
        console.warn(`[profiling-report] ignoring summary.db: ${detail}`);
      }
    }
  }

  const primaryFile =
    sites.find((s) => s.fileName)?.fileName ??
    Object.keys(payloads).find((k) => /\.(asc|cpp|h)$/i.test(k)) ??
    'source.asc';
  const sourceHit = findSourceText(payloads, primaryFile);
  const sourceText = sourceHit?.text ?? '';
  const sourcePath = sourceHit?.path ?? primaryFile;
  const sourceId = basename(primaryFile);
  const sourceLineCount = sourceText.length ? sourceText.split(/\r?\n/).length : 1;

  const sourceMetrics = emptyMetrics(sourceLineCount);
  const sourceStallByLine = new Map<number, number>();

  const asmLines: SourceLineMetrics[] = insns.map((insn, i) => {
    const stall = stallByPc.get(insn.pc);
    const samplingStall = stall?.samplingStall ?? 0;
    const site = siteByPc.get(insn.pc);
    if (site?.line != null && samplingStall > 0) {
      sourceStallByLine.set(
        site.line,
        (sourceStallByLine.get(site.line) ?? 0) + samplingStall,
      );
    }
    return {
      line: i + 1,
      values: {
        address: formatAddress(insn.pcHex),
        assembly: insn.assembly,
        instructionsExecuted: 0,
        samplingStall,
        warpOccupancy: 0,
      },
      ...(stall?.stallBreakdown?.length ? { stallBreakdown: stall.stallBreakdown } : {}),
    };
  });

  for (const [line, stall] of sourceStallByLine) {
    if (line < 1 || line > sourceMetrics.length) continue;
    const row = sourceMetrics[line - 1]!;
    row.values.samplingStall = stall;
  }

  const sourceFile: SourceFileModel = {
    id: sourceId,
    path: sourcePath,
    language: languageFor(sourcePath),
    text: sourceText || `// missing source embed: ${primaryFile}\n`,
    metricsColumns: SOURCE_COLUMNS,
    lines: sourceText ? sourceMetrics : emptyMetrics(1),
  };

  const fn =
    sites.find((s) => s.functionName)?.functionName ||
    'kernel';
  const assembly: SourceFileModel = {
    id: 'sass',
    path: `${basename(fn)}[abi:compute]`,
    language: 'sass',
    text: insns.map((i) => i.assembly).join('\n'),
    metricsColumns: ASM_COLUMNS,
    lines: asmLines,
  };

  const pcToAsmLine = new Map(insns.map((insn, i) => [insn.pc, i + 1]));
  const sourceToAsm: Record<string, number[]> = {};
  const asmToSource: Record<number, { fileId: string; line: number }> = {};

  for (const site of sites) {
    if (site.line == null) continue;
    const asmLine = pcToAsmLine.get(site.pc);
    if (asmLine == null) continue;
    const key = `${sourceId}:${site.line}`;
    const list = sourceToAsm[key] ?? (sourceToAsm[key] = []);
    if (!list.includes(asmLine)) list.push(asmLine);
    if (asmToSource[asmLine] == null) {
      asmToSource[asmLine] = { fileId: sourceId, line: site.line };
    }
  }

  return {
    files: [sourceFile],
    assembly,
    sourceToAsm,
    asmToSource,
    navigateBy: ['instructionsExecuted', 'samplingStall', 'warpOccupancy'],
    mock: false,
  };
}
