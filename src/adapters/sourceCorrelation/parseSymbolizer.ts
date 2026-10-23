import { normalizePc } from './parseObjdump';

export interface SymbolizerSite {
  pc: string;
  fileName: string;
  functionName: string;
  /** 1-based source line, or `null` when the producer shipped `0` / missing. */
  line: number | null;
}

type SymbolizerEntry = {
  Address?: string;
  Symbol?: Array<{
    FileName?: string;
    FunctionName?: string;
    Line?: number;
  }>;
};

/** Parse compute-profile `symbolizer.json` (PC → file / function / line). */
export function parseSymbolizer(text: string): SymbolizerSite[] {
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: SymbolizerSite[] = [];
  for (const entry of data as SymbolizerEntry[]) {
    if (!entry?.Address) continue;
    const sym = entry.Symbol?.[0];
    if (!sym?.FileName) continue;
    const lineRaw = sym.Line;
    const line =
      typeof lineRaw === 'number' && Number.isFinite(lineRaw) && lineRaw > 0
        ? Math.floor(lineRaw)
        : null;
    out.push({
      pc: normalizePc(entry.Address),
      fileName: sym.FileName,
      functionName: sym.FunctionName ?? '',
      line,
    });
  }
  return out;
}
