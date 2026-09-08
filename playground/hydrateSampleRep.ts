import { isNpuRep, parseNpuRep } from '../src/adapters/parseNpuRep';
import { isNpuRep160, parseNpuRep160 } from '../src/adapters/parseNpuRep160';
import { generateSampleOp2Trace } from './generateSampleOp2Trace';
import { NPU_TYPE_JSON, packNpuRep } from './packNpuRep';
import { NPU160_TYPE_JSON, packNpuRep160 } from './packNpuRep160';

const OP2_NAME = 'op2.npu.rep';

function hasTimeline(payloads: Record<string, Uint8Array>): boolean {
  return Object.keys(payloads).some((name) => {
    const lower = name.toLowerCase();
    return lower === 'trace.json' || lower === 'pipetrace.json';
  });
}

/** Inject op2 trace.json when the committed lite sample.lite.rep omits it. */
export function hydrateSampleRep(source: ArrayBuffer | Uint8Array): Uint8Array {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  if (!isNpuRep(bytes)) return bytes;

  // Product 160-byte nested sample (current sample.lite.rep).
  if (isNpuRep160(bytes)) {
    const parsed = parseNpuRep160(bytes);
    const op2Payload = parsed.payloads[OP2_NAME];
    if (!op2Payload) return bytes;

    const op2Parsed = parseNpuRep160(op2Payload);
    if (hasTimeline(op2Parsed.payloads)) return bytes;

    const traceBytes = new TextEncoder().encode(JSON.stringify(generateSampleOp2Trace()));
    const op2Entries = op2Parsed.files.map((f) => ({
      name: f.name,
      type: f.type,
      data: op2Parsed.payloads[f.name]!,
    }));
    op2Entries.push({ name: 'trace.json', type: NPU160_TYPE_JSON, data: traceBytes });
    op2Entries.sort((a, b) => a.name.localeCompare(b.name));

    const op2Bytes = packNpuRep160(op2Entries);
    const outerEntries = parsed.files.map((f) =>
      f.name === OP2_NAME
        ? { name: f.name, type: f.type, data: op2Bytes }
        : { name: f.name, type: f.type, data: parsed.payloads[f.name]! },
    );
    return packNpuRep160(outerEntries);
  }

  // Legacy interim 164-byte containers (e.g. example.npu.rep).
  const parsed = parseNpuRep(bytes);
  const op2Payload = parsed.payloads[OP2_NAME];
  if (!op2Payload) return bytes;

  const op2Parsed = parseNpuRep(op2Payload);
  if (hasTimeline(op2Parsed.payloads)) return bytes;

  const traceBytes = new TextEncoder().encode(JSON.stringify(generateSampleOp2Trace()));
  const op2Entries = op2Parsed.files.map((f) => ({
    name: f.name,
    type: f.type,
    data: op2Parsed.payloads[f.name]!,
  }));
  op2Entries.push({ name: 'trace.json', type: NPU_TYPE_JSON, data: traceBytes });
  op2Entries.sort((a, b) => a.name.localeCompare(b.name));

  const op2Bytes = packNpuRep(op2Entries);
  const outerEntries = parsed.files.map((f) =>
    f.name === OP2_NAME
      ? { name: f.name, type: f.type, data: op2Bytes }
      : { name: f.name, type: f.type, data: parsed.payloads[f.name]! },
  );
  return packNpuRep(outerEntries);
}
