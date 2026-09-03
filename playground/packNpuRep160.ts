/**
 * Pack the product 160-byte `npu-rep` format — TS mirror of
 * `data/scripts/pack_rep.py` `encode_rep`. Used to build fixtures in tests and
 * round-trip against `parseNpuRep160`.
 *
 * Head (36B, LE): magic[8]="npu-rep\0", version:u32=0x00010000, origin:u16=1,
 *   repHeadLength:u16=36, fileInfoCount:u32, fileInfoLength:u32=160,
 *   reserved:u32=0, npuRepLength:u64.
 * FileInfo (160B): magic[8], name[128], type:u16 (1=nested, 2=json, 3=jsonl,
 *   4=csv, 5=sqlite3, 6=protobuf), reserved:u16=0, reserved1:u32=0,
 *   fileLength:u64, fileRepOffset:u64. Payloads are contiguous.
 */

const MAGIC = new TextEncoder().encode('npu-rep\x00');
const VERSION = 0x00010000;
const ORIGIN = 1;
const HEAD_SIZE = 36;
const FILEINFO_SIZE = 160;

export const NPU160_TYPE_NESTED = 1;
export const NPU160_TYPE_JSON = 2;
export const NPU160_TYPE_JSONL = 3;
export const NPU160_TYPE_CSV = 4;

export interface NpuRep160Entry {
  name: string;
  type: number;
  data: Uint8Array;
}

export function packNpuRep160(entries: NpuRep160Entry[]): Uint8Array {
  const n = entries.length;
  const dataStart = HEAD_SIZE + n * FILEINFO_SIZE;
  let total = dataStart;
  for (const { data } of entries) total += data.byteLength;

  const out = new Uint8Array(total);
  const head = new DataView(out.buffer, out.byteOffset, HEAD_SIZE);
  out.set(MAGIC, 0);
  head.setUint32(8, VERSION, true);
  head.setUint16(12, ORIGIN, true);
  head.setUint16(14, HEAD_SIZE, true);
  head.setUint32(16, n, true);
  head.setUint32(20, FILEINFO_SIZE, true);
  head.setUint32(24, 0, true);
  head.setBigUint64(28, BigInt(total), true);

  let offset = dataStart;
  entries.forEach(({ name, type, data }, i) => {
    const pos = HEAD_SIZE + i * FILEINFO_SIZE;
    const info = new DataView(out.buffer, out.byteOffset + pos, FILEINFO_SIZE);
    out.set(MAGIC, pos);
    const base = name.includes('/') ? name.slice(name.lastIndexOf('/') + 1) : name;
    const nameBytes = new TextEncoder().encode(base).subarray(0, 127);
    out.set(nameBytes, pos + 8);
    info.setUint16(136, type, true);
    info.setUint16(138, 0, true);
    info.setUint32(140, 0, true);
    info.setBigUint64(144, BigInt(data.byteLength), true);
    info.setBigUint64(152, BigInt(offset), true);
    out.set(data, offset);
    offset += data.byteLength;
  });

  return out;
}
