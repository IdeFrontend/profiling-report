/** Pack npu-rep bytes — mirror of data/build_sample_rep.py pack_npu_rep().
 *  Keep head (36B) + FileInfo (164B) layout in sync; parity: tests/unit/packNpuRep.spec.ts
 *  runs `python3 data/build_sample_rep.py --pack-parity` and compares bytes. */

const MAGIC = new TextEncoder().encode('npu-rep\x00');
const VERSION = 0x00010000;
const HEAD_SIZE = 36;
const FILEINFO_SIZE = 164;

export const NPU_TYPE_CSV = 1;
export const NPU_TYPE_JSON = 2;
export const NPU_TYPE_NESTED = 6;

export interface NpuRepEntry {
  name: string;
  type: number;
  data: Uint8Array;
}

export function packNpuRep(entries: NpuRepEntry[]): Uint8Array {
  const n = entries.length;
  const dataStart = HEAD_SIZE + n * FILEINFO_SIZE;
  const layout: Array<{ name: string; type: number; data: Uint8Array; offset: number; length: number }> =
    [];
  let cur = dataStart;
  for (const { name, type, data } of entries) {
    layout.push({ name, type, data, offset: cur, length: data.byteLength });
    cur += data.byteLength;
  }
  const total = cur;

  const head = new ArrayBuffer(HEAD_SIZE);
  const headView = new DataView(head);
  new Uint8Array(head).set(MAGIC);
  headView.setUint32(8, VERSION, true);
  headView.setUint16(12, 0, true);
  headView.setUint16(14, HEAD_SIZE, true);
  headView.setUint32(16, n, true);
  headView.setUint32(20, FILEINFO_SIZE, true);
  headView.setUint32(24, 0, true);
  headView.setBigUint64(28, BigInt(total), true);

  const infoBlocks: Uint8Array[] = [];
  for (const { name, type, offset, length } of layout) {
    const info = new Uint8Array(FILEINFO_SIZE);
    info.set(MAGIC);
    const base = name.includes('/') ? name.slice(name.lastIndexOf('/') + 1) : name;
    const nameBytes = new TextEncoder().encode(base);
    info.set(nameBytes.subarray(0, Math.min(nameBytes.length, 127)), 8);
    const infoView = new DataView(info.buffer);
    infoView.setUint32(136, type, true);
    infoView.setUint32(140, 0, true);
    infoView.setUint32(144, 0, true);
    infoView.setBigUint64(148, BigInt(length), true);
    infoView.setBigUint64(156, BigInt(offset), true);
    infoBlocks.push(info);
  }

  const out = new Uint8Array(total);
  out.set(new Uint8Array(head));
  let pos = HEAD_SIZE;
  for (const block of infoBlocks) {
    out.set(block, pos);
    pos += FILEINFO_SIZE;
  }
  for (const { data, offset } of layout) {
    out.set(data, offset);
  }
  return out;
}
