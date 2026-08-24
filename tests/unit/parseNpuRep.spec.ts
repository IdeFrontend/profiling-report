import { describe, expect, it } from 'vitest';
import { parseNpuRep } from '../../src/index';
import { loadNpuRepBytes } from '../helpers/fixtures';

describe('PR-NPU: npu-rep container parse', () => {
  it('PR-NPU-001: parses npu-rep head and 164-byte file table (2 nested archives)', () => {
    const parsed = parseNpuRep(loadNpuRepBytes());

    expect(parsed.header.magic).toBe('npu-rep');
    expect(parsed.header.version).toBe(0x00010000);
    expect(parsed.header.fileInfoCount).toBe(2);
    expect(parsed.header.totalLength).toBe(83506);
    expect(parsed.files.map((f) => f.name)).toEqual(['op1.npu.rep', 'op2.npu.rep']);
    expect(parsed.files.every((f) => f.type === 6)).toBe(true);
  });

  it('PR-NPU-002: nested archives parse into leaf payloads (trace.json + CSVs)', () => {
    const outer = parseNpuRep(loadNpuRepBytes());
    const leaf = parseNpuRep(outer.payloads['op1.npu.rep']);

    expect(leaf.header.fileInfoCount).toBe(11);
    expect(leaf.payloads['trace.json']?.byteLength).toBeGreaterThan(0);
    expect(leaf.payloads['OpBasicInfo.csv']).toBeDefined();
    expect(leaf.payloads['PipeUtilization.csv']).toBeDefined();
    expect(leaf.payloads['HardwareInfo.jsonl']).toBeDefined();
  });

  it('PR-NPU-003: rejects bad magic / version / length mismatch', () => {
    const bytes = loadNpuRepBytes();

    const badMagic = new Uint8Array(bytes);
    badMagic[0] = 0x58; // 'X'
    expect(() => parseNpuRep(badMagic)).toThrow(/magic/);

    const badVersion = new Uint8Array(bytes);
    new DataView(badVersion.buffer, badVersion.byteOffset, badVersion.byteLength).setUint32(
      8,
      0x00020000,
      true,
    );
    expect(() => parseNpuRep(badVersion)).toThrow(/version/);

    const truncated = bytes.subarray(0, bytes.byteLength - 10);
    expect(() => parseNpuRep(truncated)).toThrow(/npuRepLength/);
  });
});
