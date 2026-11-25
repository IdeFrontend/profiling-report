import { isNpuRep, parseNpuRep } from '../src/adapters/parseNpuRep';
import { isNpuRep160, parseNpuRep160 } from '../src/adapters/parseNpuRep160';
import { generateSampleOp2Trace } from './generateSampleOp2Trace';
import { NPU_TYPE_JSON, packNpuRep } from './packNpuRep';
import { NPU160_TYPE_JSON, packNpuRep160 } from './packNpuRep160';

const OP2_NAME = 'op2.npu.rep';

/** Demo-only SIMT utilization: the producer's `aiv_simt_ratio` rows are NA, so the
 *  demo open report carries a synthetic one the way the demo baselines are seeded
 *  (baselinesHost `ensureDemoBlockTopology`). Real reports adapt without it and
 *  SIMT stays blank. */
const DEMO_SIMT_RATIO = 0.215;

const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);

function hasTimeline(payloads: Record<string, Uint8Array>): boolean {
  return Object.keys(payloads).some((name) => {
    const lower = name.toLowerCase();
    return lower === 'trace.json' || lower === 'pipetrace.json';
  });
}

/** Add the demo-only `aiv_simt_ratio` to a Summary.jsonl payload. */
function injectSimtSummary(payload: Uint8Array): Uint8Array {
  const text = new TextDecoder().decode(payload).replaceAll(CR, '');
  const lines = text.split(LF).filter((l) => l.trim().length > 0);
  let changed = false;
  const out = lines.map((line) => {
    const rec = JSON.parse(line) as Record<string, unknown>;
    if (rec.category === 'PipeUtilization' && !('aiv_simt_ratio' in rec)) {
      rec.aiv_simt_ratio = DEMO_SIMT_RATIO;
      changed = true;
    }
    return JSON.stringify(rec);
  });
  return changed ? new TextEncoder().encode(out.join(LF)) : payload;
}

/** Append the demo-only `aiv_simt_ratio` column to a PipeUtilization.csv payload. */
function injectSimtCsv(payload: Uint8Array): Uint8Array {
  const text = new TextDecoder().decode(payload).replaceAll(CR, '');
  const lines = text.split(LF);
  if (!lines[0] || lines[0].split(',').includes('aiv_simt_ratio')) return payload;
  const out = lines.map((line, i) => {
    if (i === 0) return `${line},aiv_simt_ratio`;
    if (!line.trim()) return line;
    const block = i - 1;
    return `${line},${(DEMO_SIMT_RATIO + (block % 5) * 0.01).toFixed(4)}`;
  });
  return new TextEncoder().encode(out.join(LF));
}

/**
 * Demo hydration of the committed lite sample: inject op2 trace.json when the
 * fixture omits it, and add the demo-only `aiv_simt_ratio` to every nested
 * report (Summary.jsonl for the All scope, PipeUtilization.csv for a picked
 * block) so the open report paints the SIMT badge too.
 */
export function hydrateSampleRep(source: ArrayBuffer | Uint8Array): Uint8Array {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  if (!isNpuRep(bytes)) return bytes;

  // Product 160-byte nested sample (current sample.lite.rep).
  if (isNpuRep160(bytes)) {
    const parsed = parseNpuRep160(bytes);
    const traceBytes = new TextEncoder().encode(JSON.stringify(generateSampleOp2Trace()));
    let changed = false;
    const outerEntries = parsed.files.map((f) => {
      const payload = parsed.payloads[f.name]!;
      if (!isNpuRep160(payload)) return { name: f.name, type: f.type, data: payload };
      const nested = parseNpuRep160(payload);
      let nestedChanged = false;
      const inner = nested.files.map((nf) => {
        let data = nested.payloads[nf.name]!;
        if (nf.name === 'Summary.jsonl') {
          const next = injectSimtSummary(data);
          if (next !== data) {
            data = next;
            nestedChanged = true;
          }
        } else if (nf.name === 'PipeUtilization.csv') {
          const next = injectSimtCsv(data);
          if (next !== data) {
            data = next;
            nestedChanged = true;
          }
        }
        return { name: nf.name, type: nf.type, data };
      });
      if (f.name === OP2_NAME && !hasTimeline(nested.payloads)) {
        inner.push({ name: 'trace.json', type: NPU160_TYPE_JSON, data: traceBytes });
        nestedChanged = true;
      }
      if (!nestedChanged) return { name: f.name, type: f.type, data: payload };
      inner.sort((a, b) => a.name.localeCompare(b.name));
      changed = true;
      return { name: f.name, type: f.type, data: packNpuRep160(inner) };
    });
    return changed ? packNpuRep160(outerEntries) : bytes;
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
