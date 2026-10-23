/** One instruction row from `objdump.txt`. */
export interface ObjdumpInsn {
  /** Normalized `0x…` PC (lowercase, no leading zeros after `0x` except `0x0`). */
  pc: string;
  /** Hex digits as in the listing (may include leading zeros). */
  pcHex: string;
  assembly: string;
}

const INSN_RE = /^\s+([0-9a-fA-F]+):\s+\S+\s+(.*)$/;

/** Normalize a PC string (`198`, `0x198`, `0X198`) → `0x198`. */
export function normalizePc(raw: string): string {
  const hex = raw.trim().toLowerCase().replace(/^0x/, '').replace(/^0+(?=[0-9a-f])/, '');
  return `0x${hex || '0'}`;
}

/** Parse llvm/objdump-style listing into instruction rows (skips headers / labels). */
export function parseObjdump(text: string): ObjdumpInsn[] {
  const out: ObjdumpInsn[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = INSN_RE.exec(line);
    if (!m) continue;
    const pcHex = m[1]!.toLowerCase();
    const assembly = m[2]!.replace(/\s+/g, ' ').trim();
    out.push({
      pc: normalizePc(pcHex),
      pcHex,
      assembly,
    });
  }
  return out;
}
