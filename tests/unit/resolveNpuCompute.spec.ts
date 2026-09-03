import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compareVersions, MIN_SUPPORTED_VERSION, parseVersion, resolveNpuCompute } from '../../backend/resolveNpuCompute.mjs';

describe('resolveNpuCompute: tool resolution ladder', () => {
  beforeEach(() => {
    delete process.env.NPU_COMPUTE_BIN;
    delete process.env.AUTO_DOWNLOAD_TOOL;
  });

  afterEach(() => {
    delete process.env.NPU_COMPUTE_BIN;
    delete process.env.AUTO_DOWNLOAD_TOOL;
  });

  function deps(overrides: {
    isExecutable?: (file: string) => Promise<boolean>;
    versionCheck?: (bin: string) => Promise<{ ok: boolean; version?: string; reason?: string }>;
    findOnPath?: (name: string) => Promise<string | null>;
    download?: (cacheDir?: string) => Promise<string>;
  } = {}) {
    return {
      isExecutable: async () => true,
      versionCheck: async () => ({ ok: true, version: '9.1.0' }),
      findOnPath: async () => null,
      download: vi.fn(async () => '/cache/extracted/npu-compute'),
      ...overrides,
    };
  }

  describe('version helpers', () => {
    it('parses an x.y.z triple from --version output', () => {
      expect(parseVersion('npu-compute version 9.1.0')).toEqual([9, 1, 0]);
      expect(parseVersion('9.1.0')).toEqual([9, 1, 0]);
      expect(parseVersion('no version here')).toBeNull();
    });

    it('compares triples numerically (not lexically)', () => {
      expect(compareVersions([9, 1, 0], [9, 1, 0])).toBe(0);
      expect(compareVersions([10, 0, 0], [9, 1, 0])).toBeGreaterThan(0);
      expect(compareVersions([8, 2, 0], MIN_SUPPORTED_VERSION.split('.').map(Number))).toBeLessThan(0);
    });
  });

  it('rung 1: explicit path wins and is version-checked', async () => {
    const download = vi.fn(async () => '/cache/extracted/npu-compute');
    const { bin, source } = await resolveNpuCompute(
      { explicitPath: '/opt/npu-compute' },
      deps({ download }),
    );
    expect(source).toBe('explicit');
    expect(bin).toBe('/opt/npu-compute');
    expect(download).not.toHaveBeenCalled();
  });

  it('rung 1: explicit path that is not executable throws', async () => {
    await expect(
      resolveNpuCompute({ explicitPath: '/opt/missing' }, deps({ isExecutable: async () => false })),
    ).rejects.toThrow(/not executable/);
  });

  it('rung 1: explicit path with an incompatible version throws', async () => {
    await expect(
      resolveNpuCompute(
        { explicitPath: '/opt/old' },
        deps({ versionCheck: async () => ({ ok: false, reason: '8.0.0 < 9.1.0' }) }),
      ),
    ).rejects.toThrow(/incompatible/);
  });

  it('rung 2: autodetect on PATH with a compatible version', async () => {
    const download = vi.fn(async () => '/cache/extracted/npu-compute');
    const { bin, source } = await resolveNpuCompute(
      {},
      deps({ findOnPath: async () => '/usr/bin/npu-compute', download }),
    );
    expect(source).toBe('autodetect');
    expect(bin).toBe('/usr/bin/npu-compute');
    expect(download).not.toHaveBeenCalled();
  });

  it('rung 3: incompatible autodetect falls through to download when enabled', async () => {
    process.env.AUTO_DOWNLOAD_TOOL = '1';
    const { bin, source } = await resolveNpuCompute(
      {},
      deps({
        findOnPath: async () => '/usr/bin/npu-compute',
        versionCheck: async () => ({ ok: false, reason: '8.0.0 < 9.1.0' }),
      }),
    );
    expect(source).toBe('download');
    expect(bin).toBe('/cache/extracted/npu-compute');
  });

  it('throws when no tool and download is not enabled', async () => {
    const download = vi.fn(async () => '/cache/extracted/npu-compute');
    await expect(resolveNpuCompute({}, deps({ download }))).rejects.toThrow(
      /not found or incompatible/,
    );
    expect(download).not.toHaveBeenCalled();
  });
});
