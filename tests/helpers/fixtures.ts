import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT_REP = resolve(__dirname, '../../data/out.rep');
const OUT_TRACE = resolve(__dirname, '../../data/out.trace.json');
const NPU_REP = resolve(__dirname, '../../data/example.npu.rep');
const SAMPLE_REP = resolve(__dirname, '../../data/sample.rep');

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

export function loadOutTraceBytes(): Uint8Array {
  return new Uint8Array(readFileSync(OUT_TRACE));
}

export function loadOutTraceBuffer(): ArrayBuffer {
  const bytes = loadOutTraceBytes();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export function loadNpuRepBytes(): Uint8Array {
  return new Uint8Array(readFileSync(NPU_REP));
}

export function loadNpuRepBuffer(): ArrayBuffer {
  const bytes = loadNpuRepBytes();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export function loadSampleRepBytes(): Uint8Array {
  return new Uint8Array(readFileSync(SAMPLE_REP));
}

export function loadSampleRepBuffer(): ArrayBuffer {
  const bytes = loadSampleRepBytes();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
