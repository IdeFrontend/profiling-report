import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT_REP = resolve(__dirname, '../../data/out.rep');

export const EXPECTED_OUT_REP_EMBEDS = [
  'ArithmeticUtilization.csv',
  'L2Cache.csv',
  'Memory.csv',
  'MemoryL0.csv',
  'MemoryUB.csv',
  'OpBasicInfo.csv',
  'PipeUtilization.csv',
  'ResourceConflictRatio.csv',
  'trace.json',
] as const;

export function loadOutRepBytes(): Uint8Array {
  return new Uint8Array(readFileSync(OUT_REP));
}

export function loadOutRepBuffer(): ArrayBuffer {
  const bytes = loadOutRepBytes();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
