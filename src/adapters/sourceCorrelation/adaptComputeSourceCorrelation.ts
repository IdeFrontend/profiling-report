import type {
  SourceCorrelationModel,
  SourceFileModel,
  SourceLineMetrics,
  SourceMetricsColumn,
  SourceStallBreakdown,
} from '../../domain/types';
import { parseObjdump, normalizePc } from './parseObjdump';
import { parseSymbolizer } from './parseSymbolizer';
import {
  isPcSamplingSqlReady,
  readPcSamplingDbSync,
  type PcSamplingRow,
} from './readPcSamplingDb';
import { missingSourceEmbedText } from './resolveSourceFile';

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

interface BuiltSourceFile {
  id: string;
  path: string;
  text: string;
  metrics: SourceLineMetrics[];
  stallByLine: Map<number, number>;
  breakdownByLine: Map<number, Map<string, number>>;
  /** Sum of mapped PC instruction counts. */
  instrByLine: Map<number, number>;
  /** Sum and count of mapped PC warp-occupancy fractions (mean, not sum). */
  occSumByLine: Map<number, number>;
  occCountByLine: Map<number, number>;
}

/**
 * One source file per distinct symbolizer basename, in first-seen order.
 * With no sites, fall back to the first embedded `.asc` / `.cpp` / `.h`.
 */
function sourceFilesFromSites(
  payloads: Record<string, Uint8Array>,
  sites: { fileName: string; line?: number | null }[],
): { order: BuiltSourceFile[]; byId: Map<string, BuiltSourceFile> } {
  const byId = new Map<string, BuiltSourceFile>();
  const order: BuiltSourceFile[] = [];

  function add(fileName: string): void {
    const id = basename(fileName);
    if (byId.has(id)) return;
    const hit = findSourceText(payloads, fileName);
    const text = hit?.text ?? '';
    const lineCount = text.length ? text.split(/\r?\n/).length : 1;
    const built: BuiltSourceFile = {
      id,
      path: hit?.path ?? fileName,
      text,
      metrics: emptyMetrics(lineCount),
      stallByLine: new Map(),
      breakdownByLine: new Map(),
      instrByLine: new Map(),
      occSumByLine: new Map(),
      occCountByLine: new Map(),
    };
    byId.set(id, built);
    order.push(built);
  }

  for (const site of sites) {
    if (site.fileName) add(site.fileName);
  }
  if (order.length === 0) {
    add(
      Object.keys(payloads).find((k) => /\.(asc|cpp|h)$/i.test(k)) ?? 'source.asc',
    );
  }
  // Missing pack text starts at 1 line; grow so mapped stall/instr lines still fit
  // until a host `resolveSourceFile` fills the real document.
  for (const site of sites) {
    if (!site.fileName || site.line == null || site.line < 1) continue;
    const file = byId.get(basename(site.fileName));
    if (!file || file.text) continue;
    if (site.line > file.metrics.length) {
      file.metrics = emptyMetrics(site.line);
    }
  }
  return { order, byId };
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

  const sourceFiles = sourceFilesFromSites(payloads, sites);

  const asmLines: SourceLineMetrics[] = insns.map((insn, i) => {
    const stall = stallByPc.get(insn.pc);
    const samplingStall = stall?.samplingStall ?? 0;
    const executed = stall?.instructionsExecuted ?? 0;
    const occupancy = stall?.warpOccupancy;
    const site = siteByPc.get(insn.pc);
    const file = site ? sourceFiles.byId.get(basename(site.fileName)) : undefined;
    if (file && site?.line != null) {
      if (samplingStall > 0) {
        file.stallByLine.set(site.line, (file.stallByLine.get(site.line) ?? 0) + samplingStall);
        if (stall?.stallBreakdown?.length) {
          let parts = file.breakdownByLine.get(site.line);
          if (!parts) {
            parts = new Map();
            file.breakdownByLine.set(site.line, parts);
          }
          for (const row of stall.stallBreakdown) {
            parts.set(row.metric, (parts.get(row.metric) ?? 0) + row.value);
          }
        }
      }
      if (executed > 0) {
        file.instrByLine.set(site.line, (file.instrByLine.get(site.line) ?? 0) + executed);
      }
      // 0 is a real 0–1 sample. Only a missing column (undefined) stays out of the mean.
      if (occupancy != null) {
        file.occSumByLine.set(site.line, (file.occSumByLine.get(site.line) ?? 0) + occupancy);
        file.occCountByLine.set(
          site.line,
          (file.occCountByLine.get(site.line) ?? 0) + 1,
        );
      }
    }
    return {
      line: i + 1,
      values: {
        address: formatAddress(insn.pcHex),
        assembly: insn.assembly,
        instructionsExecuted: executed,
        samplingStall,
        warpOccupancy: occupancy ?? 0,
      },
      ...(stall?.stallBreakdown?.length ? { stallBreakdown: stall.stallBreakdown } : {}),
    };
  });

  for (const file of sourceFiles.order) {
    const lineIds = new Set<number>([
      ...file.stallByLine.keys(),
      ...file.instrByLine.keys(),
      ...file.occCountByLine.keys(),
    ]);
    for (const line of lineIds) {
      if (line < 1 || line > file.metrics.length) continue;
      const row = file.metrics[line - 1]!;
      const stall = file.stallByLine.get(line) ?? 0;
      if (stall > 0) row.values.samplingStall = stall;
      const executed = file.instrByLine.get(line);
      if (executed) row.values.instructionsExecuted = executed;
      const occN = file.occCountByLine.get(line) ?? 0;
      if (occN > 0) row.values.warpOccupancy = (file.occSumByLine.get(line) ?? 0) / occN;
      const parts = file.breakdownByLine.get(line);
      if (!parts?.size || stall <= 0) continue;
      const stallBreakdown: SourceStallBreakdown[] = [...parts.entries()]
        .map(([metric, value]) => ({
          metric,
          value,
          percent: stall > 0 ? (value / stall) * 100 : 0,
        }))
        .filter((r) => r.value > 0);
      if (stallBreakdown.length) row.stallBreakdown = stallBreakdown;
    }
  }

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
    const fileId = basename(site.fileName);
    const key = `${fileId}:${site.line}`;
    const list = sourceToAsm[key] ?? (sourceToAsm[key] = []);
    if (!list.includes(asmLine)) list.push(asmLine);
    if (asmToSource[asmLine] == null) {
      asmToSource[asmLine] = { fileId, line: site.line };
    }
  }

  return {
    files: sourceFiles.order.map((file) => ({
      id: file.id,
      path: file.path,
      language: languageFor(file.path),
      text: file.text || missingSourceEmbedText(file.path, file.metrics.length),
      metricsColumns: SOURCE_COLUMNS,
      // Keep rolled-up metrics even when text is a placeholder so resolveSourceFile
      // can fill the editor without dropping stall / instr / occupancy.
      lines: file.metrics,
    })),
    assembly,
    sourceToAsm,
    asmToSource,
    navigateBy: ['instructionsExecuted', 'samplingStall', 'warpOccupancy'],
    mock: false,
  };
}
