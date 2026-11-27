import { closeSync, ftruncateSync, mkdirSync, mkdtempSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readSourceWorkspace } from '../../scripts/source-workspace.mjs';

const dirs: string[] = [];

function workspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'source-workspace-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe('readSourceWorkspace', () => {
  it('normalizes nested paths to / and skips binary and oversize files', () => {
    const dir = workspace();
    mkdirSync(join(dir, 'nested', 'deep'), { recursive: true });
    writeFileSync(join(dir, 'nested', 'deep', 'op.asc'), 'kernel\n');
    writeFileSync(join(dir, 'blob.asc'), Buffer.from([0x41, 0x00, 0x42]));
    writeFileSync(join(dir, 'huge.asc'), Buffer.alloc(256 * 1024 + 1, 0x61));
    expect(readSourceWorkspace(dir)).toEqual({ 'nested/deep/op.asc': 'kernel\n' });
  });

  it('skips a file bigger than the per-file cap without reading it', () => {
    const dir = workspace();
    writeFileSync(join(dir, 'small.asc'), 'kernel\n');
    // Sparse on purpose: the size is real, the bytes are not on disk.
    const fd = openSync(join(dir, 'huge.so'), 'w');
    ftruncateSync(fd, 3 * 1024 ** 3);
    closeSync(fd);
    expect(readSourceWorkspace(dir)).toEqual({ 'small.asc': 'kernel\n' });
  });

  it('reads source extensions only and skips dotfiles', () => {
    const dir = workspace();
    writeFileSync(join(dir, 'op.asc'), 'kernel\n');
    writeFileSync(join(dir, 'kernel.cpp'), 'int main() {}\n');
    writeFileSync(join(dir, 'kernel.h'), '#pragma once\n');
    writeFileSync(join(dir, '.env'), 'TOKEN=secret\n');
    writeFileSync(join(dir, '.cache.asc'), 'hidden\n');
    writeFileSync(join(dir, 'secret.txt'), 'notes\n');
    writeFileSync(join(dir, 'blob.json'), '{}\n');
    expect(readSourceWorkspace(dir)).toEqual({
      'op.asc': 'kernel\n',
      'kernel.cpp': 'int main() {}\n',
      'kernel.h': '#pragma once\n',
    });
  });

  it('throws when total text exceeds 8 MB', () => {
    const dir = workspace();
    const chunk = Buffer.alloc(256 * 1024, 0x61);
    for (let i = 0; i < 33; i++) writeFileSync(join(dir, `part${i}.asc`), chunk);
    expect(() => readSourceWorkspace(dir)).toThrow(/8 MB/);
  });
});
