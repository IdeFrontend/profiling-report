import { describe, expect, it } from 'vitest';
import {
  isNpuRep160,
  isNestedNpuArchive160,
  NPU_REP_TYPE_NESTED,
  parseNpuRep160,
} from '../../src/index';
import { packNpuRep160, NPU160_TYPE_CSV, NPU160_TYPE_JSON, NPU160_TYPE_NESTED } from '../../playground/packNpuRep160';
import { loadNpuRepBytes, loadResultNpuRepBytes } from '../helpers/fixtures';

describe('PR-NPU160: product 160-byte npu-rep parse', () => {
  it('PR-NPU-007: parses the real data/result.npu-rep head + file table', () => {
    const parsed = parseNpuRep160(loadResultNpuRepBytes());

    expect(parsed.header.magic).toBe('npu-rep');
    expect(parsed.header.version).toBe(0x00010000);
    expect(parsed.header.origin).toBe(1);
    expect(parsed.header.fileInfoCount).toBe(6);
    expect(parsed.header.totalLength).toBe(4821);

    expect(parsed.files.map((f) => f.name)).toEqual([
      'HardwareInfo.jsonl',
      'L2Cache.csv',
      'Memory.csv',
      'MemoryL0.csv',
      'MemoryUB.csv',
      'PipeUtilization.csv',
    ]);
    expect(parsed.files.map((f) => f.type)).toEqual([3, 4, 4, 4, 4, 4]);
    expect(parsed.payloads['HardwareInfo.jsonl']?.byteLength).toBeGreaterThan(0);
    expect(parsed.payloads['PipeUtilization.csv']?.byteLength).toBeGreaterThan(0);
  });

  it('PR-NPU-007: isNpuRep160 distinguishes 160-byte from 164-byte sample', () => {
    expect(isNpuRep160(loadResultNpuRepBytes())).toBe(true);
    // The 164-byte example.npu.rep shares the magic but reports fileInfoLength=164.
    expect(isNpuRep160(loadNpuRepBytes())).toBe(false);
  });

  it('PR-NPU-007: rejects bad magic / version / length / origin', () => {
    const bytes = loadResultNpuRepBytes();

    const badMagic = new Uint8Array(bytes);
    badMagic[0] = 0x58; // 'X'
    expect(() => parseNpuRep160(badMagic)).toThrow(/magic/);

    const badVersion = new Uint8Array(bytes);
    new DataView(badVersion.buffer, badVersion.byteOffset, badVersion.byteLength).setUint32(
      8,
      0x00020000,
      true,
    );
    expect(() => parseNpuRep160(badVersion)).toThrow(/version/);

    const truncated = bytes.subarray(0, bytes.byteLength - 10);
    expect(() => parseNpuRep160(truncated)).toThrow(/npuRepLength/);

    const badOrigin = new Uint8Array(bytes);
    new DataView(badOrigin.buffer, badOrigin.byteOffset, badOrigin.byteLength).setUint16(12, 0, true);
    expect(() => parseNpuRep160(badOrigin)).toThrow(/origin/);
  });

  it('PR-NPU-007: round-trips packNpuRep160 → parseNpuRep160', () => {
    const entries = [
      { name: 'OpBasicInfo.csv', type: NPU160_TYPE_CSV, data: new TextEncoder().encode('a,b\n1,2') },
      { name: 'trace.json', type: NPU160_TYPE_JSON, data: new TextEncoder().encode('{}') },
    ];
    const packed = packNpuRep160(entries);
    const parsed = parseNpuRep160(packed);

    expect(parsed.files.map((f) => f.name)).toEqual(['OpBasicInfo.csv', 'trace.json']);
    expect(parsed.files.map((f) => f.type)).toEqual([4, 2]);
    expect(new TextDecoder().decode(parsed.payloads['trace.json'])).toBe('{}');
  });

  it('PR-NPU-007: rejects duplicate names and trailing unreferenced bytes', () => {
    const dup = packNpuRep160([
      { name: 'a.csv', type: NPU160_TYPE_CSV, data: new TextEncoder().encode('x') },
      { name: 'a.csv', type: NPU160_TYPE_CSV, data: new TextEncoder().encode('y') },
    ]);
    expect(() => parseNpuRep160(dup)).toThrow(/duplicate/);

    // Append a byte and bump npuRepLength to match: header length agrees, but the
    // trailing byte is not referenced by any FileInfo → unreferenced payload.
    const valid = packNpuRep160([
      { name: 'a.csv', type: NPU160_TYPE_CSV, data: new TextEncoder().encode('x') },
    ]);
    const extra = new Uint8Array(valid.byteLength + 1);
    extra.set(valid);
    new DataView(extra.buffer).setBigUint64(28, BigInt(extra.byteLength), true);
    expect(() => parseNpuRep160(extra)).toThrow(/unreferenced payload/);
  });

  it('PR-NPU-007: nested type 1 archive is detected as nested', () => {
    const leaf = packNpuRep160([
      { name: 'trace.json', type: NPU160_TYPE_JSON, data: new TextEncoder().encode('{}') },
    ]);
    const outer = packNpuRep160([
      { name: 'op1.npu.rep', type: NPU160_TYPE_NESTED, data: leaf },
    ]);

    const parsed = parseNpuRep160(outer);
    const entry = parsed.files[0];
    expect(entry.type).toBe(NPU_REP_TYPE_NESTED);
    expect(isNestedNpuArchive160(entry, parsed.payloads[entry.name])).toBe(true);
  });
});
