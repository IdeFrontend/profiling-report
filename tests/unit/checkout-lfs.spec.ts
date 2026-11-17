import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { materializeLfsPointers } from '../../scripts/checkout-lfs.mjs';

const POINTER_PREFIX = 'version https://git-lfs.github.com/spec/v1';

function pointerFor(oid: string, size: number): string {
  return `${POINTER_PREFIX}\noid sha256:${oid}\nsize ${size}\n`;
}

function stubFetch(oid: string, bytes: Uint8Array) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/info/lfs/objects/batch')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            objects: [{ oid, actions: { download: { href: 'https://example.test/obj' } } }],
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () =>
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      };
    }),
  );
}

describe('materializeLfsPointers', () => {
  const dirs: string[] = [];

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function fixture(oid: string, size: number) {
    const root = mkdtempSync(join(tmpdir(), 'checkout-lfs-'));
    dirs.push(root);
    mkdirSync(join(root, 'data'));
    const file = join(root, 'data', 'sample.bin');
    const pointer = pointerFor(oid, size);
    writeFileSync(file, pointer);
    return { root, file, pointer };
  }

  it('replaces a pointer when length and sha256 match', async () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]);
    const oid = createHash('sha256').update(bytes).digest('hex');
    const { root, file } = fixture(oid, bytes.length);
    stubFetch(oid, bytes);

    await expect(materializeLfsPointers(root, 'acme/widgets')).resolves.toBe(1);
    expect(readFileSync(file)).toEqual(Buffer.from(bytes));
  });

  it('keeps the pointer when the download hash does not match', async () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]);
    const oid = createHash('sha256').update(bytes).digest('hex');
    const { root, file, pointer } = fixture(oid, bytes.length);
    stubFetch(oid, new Uint8Array([1, 2, 3]));

    await expect(materializeLfsPointers(root, 'acme/widgets')).rejects.toThrow(/oid mismatch/);
    expect(readFileSync(file, 'utf8')).toBe(pointer);
  });
});
