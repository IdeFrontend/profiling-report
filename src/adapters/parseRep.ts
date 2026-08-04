import type { ParsedRep, RepEmbeddedFile, RepHeader } from '../domain/types';

const HEAD_MAGIC = 'cann-rep';
const FILE_MAGIC = 'rep-file';
const HEAD_SIZE = 36;
const FILEINFO_SIZE = 160;
/** REP_FORMAT: readers accept 0x00010000; newer unknown versions warn via error. */
const SUPPORTED_VERSION = 0x00010000;

function toDataView(source: ArrayBuffer | Uint8Array): { view: DataView; bytes: Uint8Array } {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
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

function readSafeU64(view: DataView, offset: number, label: string): number {
  const value = view.getBigUint64(offset, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`[profiling-report] parseRep: ${label} exceeds Number.MAX_SAFE_INTEGER`);
  }
  return Number(value);
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}

/** Parse CANN `.rep` / `.ncrep` bytes (REP_FORMAT validation checklist). */
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
    repLength: readSafeU64(view, 20, 'repLength'),
    offset: readSafeU64(view, 28, 'offset'),
  };

  if (header.version !== SUPPORTED_VERSION) {
    throw new Error(
      `[profiling-report] parseRep: unsupported version 0x${header.version.toString(16)} (expected 0x${SUPPORTED_VERSION.toString(16)})`,
    );
  }

  if (header.repLength !== bytes.byteLength) {
    throw new Error(
      `[profiling-report] parseRep: repLength ${header.repLength} != actual size ${bytes.byteLength}`,
    );
  }

  const expectedDataStart = HEAD_SIZE + header.fileInfoCount * FILEINFO_SIZE;
  if (header.offset !== expectedDataStart) {
    throw new Error(
      `[profiling-report] parseRep: head.offset ${header.offset} != expected data start ${expectedDataStart}`,
    );
  }

  const files: RepEmbeddedFile[] = [];
  const payloads: Record<string, Uint8Array> = {};
  const seenNames = new Set<string>();

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
    if (!name) {
      throw new Error(`[profiling-report] parseRep: empty embed name at index ${i}`);
    }
    if (seenNames.has(name)) {
      throw new Error(`[profiling-report] parseRep: duplicate embed name ${JSON.stringify(name)}`);
    }
    seenNames.add(name);

    const type = view.getUint16(pos + 136, true);
    const origin = view.getUint16(pos + 138, true);
    const length = readSafeU64(view, pos + 144, `${name}.length`);
    const offset = readSafeU64(view, pos + 152, `${name}.offset`);

    if (offset < header.offset) {
      throw new Error(
        `[profiling-report] parseRep: ${name} offset ${offset} < data_start ${header.offset}`,
      );
    }
    if (offset + length > bytes.byteLength) {
      throw new Error(`[profiling-report] parseRep: payload out of range for ${name}`);
    }

    for (const prev of files) {
      if (rangesOverlap(offset, offset + length, prev.offset, prev.offset + prev.length)) {
        throw new Error(
          `[profiling-report] parseRep: overlapping payloads ${JSON.stringify(prev.name)} and ${JSON.stringify(name)}`,
        );
      }
    }

    files.push({ name, type, origin, offset, length });
    payloads[name] = bytes.subarray(offset, offset + length);
  }

  return { header, files, payloads };
}
