import { isNpuRep, parseNpuRep } from '../src/adapters/parseNpuRep';
import { isNpuRep160, parseNpuRep160 } from '../src/adapters/parseNpuRep160';
import { generateSampleOp2Trace } from './generateSampleOp2Trace';
import { NPU_TYPE_JSON, packNpuRep } from './packNpuRep';
import { NPU160_TYPE_JSON, packNpuRep160 } from './packNpuRep160';

const OP2_NAME = 'op2.npu.rep';

/** Demo-only SIMT utilization (21.50%): the producer's `aiv_simt_ratio` rows are
 *  NA, so the demo open report carries a synthetic one the same way the demo
 *  baselines are reseeded (baselinesHost `ensureDemoTopology`). Real reports
 *  adapt without it and SIMT stays blank. */
const DEMO_SIMT_RATIO = 0.215;

function hasTimeline(payloads: Record<string, Uint8Array>): boolean {
  return Object.keys(payloads).some((name) => {
    const lower = name.toLowerCase();
    return lower === 'trace.json' || lower === 'pipetrace.json';
  });
}

/** Add `aiv_simt_ratio` to the `PipeUtilization` record of a Summary.jsonl payload. */
function injectSimtRatio(payload: Uint8Array | undefined): Uint8Array | undefined {
  if (!payload) return payload;
  const text = new TextDecoder().decode(payload);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  let changed = false;
  const out = lines.map((line) => {
    const rec = JSON.parse(line) as Record<string, unknown>;
    if (rec.category === 'PipeUtilization' && !('aiv_simt_ratio' in rec)) {
      rec.aiv_simt_ratio = DEMO_SIMT_RATIO;
      changed = true;
    }
    return JSON.stringify(rec);
  });
  if (!changed) return payload;
  return new TextEncoder().encode(out.join('\n'));
}

/**
 * Demo hydration of the committed lite sample: inject op2 trace.json when the
 * fixture omits it, and add the demo-only `aiv_simt_ratio` to every nested
 * report's Summary.jsonl so the open report paints the SIMT badge too.
 */
export function hydrateSampleRep(source: ArrayBuffer | Uint8Array): Uint8Array {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  if (!isNpuRep(bytes)) return bytes;

  // Product 160-byte nested sample (current sample.lite.rep).
  if (isNpuRep160(bytes)) {
    const parsed = parseNpuRep160(bytes);
    const entries = parsed.files.map((f) => {
      const payload = parsed.payloads[f.name]!;
      if (isNpuRep160(payload)) {
        // Nested report container (op1 / op2): inject the demo ratio into its
        // Summary.jsonl; op2 also gets the trace when the fixture omits it.
        const nested = parseNpuRep160(payload);
        const inner = nested.files.map((nf) => ({
          name: nf.name,
          type: nf.type,
          data:
            nf.name === 'Summary.jsonl'
              ? (injectSimtRatio(nested.payloads[nf.name]) ?? nested.payloads[nf.name]!)
              : nested.payloads[nf.name]!,
        }));
        if (f.name === OP2_NAME && !hasTimeline(nested.payloads)) {
          const traceBytes = new TextEncoder().encode(JSON.stringify(generateSampleOp2Trace()));
          inner.push({ name: 'trace.json', type: NPU160_TYPE_JSON, data: traceBytes });
        }
        inner.sort((a, b) => a.name.localeCompare(b.name));
        return { name: f.name, type: f.type, data: packNpuRep160(inner) };
      }
      return { name: f.name, type: f.type, data: payload };
    });
    return packNpuRep160(entries);
  }

  // Legacy interim 164-byte containers (e.g. example.npu.rep): trace only.
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
