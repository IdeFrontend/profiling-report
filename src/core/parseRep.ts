import type { ParsedRep, RepEmbeddedFile, RepHeader } from './types';

const HEAD_MAGIC = 'cann-rep';
const FILE_MAGIC = 'rep-file';
const HEAD_SIZE = 36;
const FILEINFO_SIZE = 160;

function toDataView(source: ArrayBuffer | Uint8Array): { view: DataView; bytes: Uint8Array } {
  const bytes =
    source instanceof Uint8Array ? source : new Uint8Array(source);
  return {
    bytes,
    view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
  };
}

function readCString(bytes: Uint8Array, offset: number, maxLen: number): string {
  const slice = bytes.subarray(offset, offset + maxLen);
  let end = slice.indexOf(0);
  if (end < 0) end = maxLen;
  return new TextDecoder().decode(slice.subarray(0, end));
}

function readMagic(bytes: Uint8Array, offset: number, len: number): string {
  return new TextDecoder().decode(bytes.subarray(offset, offset + len));
}

/** Parse CANN `.rep` / `.ncrep` bytes (REP_FORMAT). */
export function parseRep(source: ArrayBuffer | Uint8Array): ParsedRep {
  const { view, bytes } = toDataView(source);
  if (bytes.byteLength < HEAD_SIZE) {
    throw new Error('[profiling-report] parseRep: buffer too small for head');
  }

  const magic = readMagic(bytes, 0, 8);
  if (magic !== HEAD_MAGIC) {
    throw new Error(`[profiling-report] parseRep: bad head magic ${JSON.stringify(magic)}`);
  }

  const header: RepHeader = {
    magic,
    version: view.getUint32(8, true),
    fileInfoCount: view.getUint32(12, true),
    fileLength: view.getUint32(16, true),
    repLength: Number(view.getBigUint64(20, true)),
    offset: Number(view.getBigUint64(28, true)),
  };

  const files: RepEmbeddedFile[] = [];
  const payloads: Record<string, Uint8Array> = {};

  for (let i = 0; i < header.fileInfoCount; i++) {
    const pos = HEAD_SIZE + i * FILEINFO_SIZE;
    if (pos + FILEINFO_SIZE > bytes.byteLength) {
      throw new Error('[profiling-report] parseRep: truncated file info table');
    }
    const fileMagic = readMagic(bytes, pos, 8);
    if (fileMagic !== FILE_MAGIC) {
      throw new Error(`[profiling-report] parseRep: bad file magic at index ${i}`);
    }
    const name = readCString(bytes, pos + 8, 128);
    const type = view.getUint16(pos + 136, true);
    const origin = view.getUint16(pos + 138, true);
    const length = Number(view.getBigUint64(pos + 144, true));
    const offset = Number(view.getBigUint64(pos + 152, true));

    files.push({ name, type, origin, offset, length });

    if (offset + length > bytes.byteLength) {
      throw new Error(`[profiling-report] parseRep: payload out of range for ${name}`);
    }
    payloads[name] = bytes.subarray(offset, offset + length);
  }

  return { header, files, payloads };
}
