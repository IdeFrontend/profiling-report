import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { hydrateSampleRep } from '../../playground/hydrateSampleRep';

const OUT_REP = resolve(__dirname, '../../data/out.rep');
const OUT_TRACE = resolve(__dirname, '../../data/out.trace.json');
const NPU_REP = resolve(__dirname, '../../data/example.npu.rep');
const SAMPLE_LITE_REP = resolve(__dirname, '../../data/sample.lite.rep');
const RESULT_NPU_REP = resolve(__dirname, '../../data/result.npu-rep');

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

/** Real 160-byte product sample (`data/result.npu-rep`). */
export function loadResultNpuRepBytes(): Uint8Array {
  return new Uint8Array(readFileSync(RESULT_NPU_REP));
}

/** Lite sample.lite.rep on disk → full bytes with op2 trace hydrated in memory. */
export function loadSampleRepBytes(): Uint8Array {
  return hydrateSampleRep(readFileSync(SAMPLE_LITE_REP));
}

export function liteSampleRepByteLength(): number {
  return statSync(SAMPLE_LITE_REP).size;
}

export function loadSampleRepBuffer(): ArrayBuffer {
  const bytes = loadSampleRepBytes();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
