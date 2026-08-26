import { parseNpuRep } from '../src/adapters/parseNpuRep';
import { generateSampleOp2Trace } from '../src/domain/generateSampleOp2Trace';
import { NPU_TYPE_JSON, packNpuRep } from './packNpuRep';

const OP2_NAME = 'op2.npu.rep';

function entriesFromParsed(parsed: ReturnType<typeof parseNpuRep>) {
  return parsed.files.map((f) => ({
    name: f.name,
    type: f.type,
    data: parsed.payloads[f.name]!,
  }));
}

/** Inject op2 trace.json when the committed lite sample.rep omits it. */
export function hydrateSampleRep(source: ArrayBuffer | Uint8Array): Uint8Array {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  const parsed = parseNpuRep(bytes);
  const op2Payload = parsed.payloads[OP2_NAME];
  if (!op2Payload) return bytes;

  const op2Parsed = parseNpuRep(op2Payload);
  if (op2Parsed.payloads['trace.json']) return bytes;

  const traceJson = JSON.stringify(generateSampleOp2Trace());
  const traceBytes = new TextEncoder().encode(traceJson);
  const op2Entries = entriesFromParsed(op2Parsed);
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
