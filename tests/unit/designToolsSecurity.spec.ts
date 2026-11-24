import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

const RENDER = join(process.cwd(), 'scripts', 'design-render.mjs');
const DIFF = join(process.cwd(), 'scripts', 'design-diff.mjs');
const SANITIZE = join(process.cwd(), 'scripts', 'design-sanitize.mjs');
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function writeScreen(root: string, name: string, dsl: unknown, png?: Buffer): void {
  const dir = join(root, name);
  mkdirSync(dir);
  writeFileSync(join(dir, 'arkUIDSL.json'), JSON.stringify(dsl));
  if (png) writeFileSync(join(dir, 'screenshot.png'), png);
}

describe('design-render trust boundary', () => {
  it('escapes attribute values, blocks scripts, and never loads assets outside the batch', () => {
    const root = tempRoot('design-render-');
    writeScreen(root, 'Hostile', {
      ui: {
        styles: { width: 120, height: 80 },
        componentName: 'Page',
        meta: { octoName: 'page', bbox: [0, 0, 120, 80] },
        children: [
          {
            componentName: 'Image',
            src: '../../../outside.png',
            styles: {},
            meta: { octoName: 'img', bbox: [0, 0, 50, 50] },
            children: [],
          },
          {
            componentName: 'Text',
            content: '<script>alert(1)</script>',
            styles: { fontSize: 12, fontColor: '#FFFFFFFF', boxShadow: '0 0 0 1px red" onmouseover="alert(1)' },
            meta: { octoName: 'text', bbox: [0, 50, 100, 70] },
            children: [],
          },
        ],
      },
    });

    execFileSync(process.execPath, [RENDER, 'Hostile', root], { encoding: 'utf-8' });
    const html = readFileSync(join(root, 'Hostile', '_rebuilt.html'), 'utf-8');

    expect(html).toContain('Content-Security-Policy');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script');
    expect(html).not.toContain('../../../outside.png');
    expect(html).not.toContain('" onmouseover="');
    expect(html).toContain('&quot; onmouseover=&quot;');
  });
});

describe('design-diff root handling', () => {
  it('renders and diffs a screen when the design root is relative', async () => {
    const root = tempRoot('design-diff-');
    const png = await sharp({
      create: { width: 20, height: 20, channels: 4, background: { r: 22, g: 24, b: 26, alpha: 1 } },
    }).png().toBuffer();
    writeScreen(root, 'Tiny', {
      ui: {
        styles: { width: 20, height: 20 },
        componentName: 'Page',
        meta: { octoName: 'page', bbox: [0, 0, 20, 20] },
        children: [],
      },
    }, png);

    const rows = JSON.parse(
      execFileSync(process.execPath, [DIFF, 'Tiny', relative(process.cwd(), root), '--json'], { encoding: 'utf-8' }),
    ) as Array<{ screen: string; diff?: number; error?: boolean; note?: string }>;

    expect(rows).toHaveLength(1);
    expect(rows[0].screen).toBe('Tiny');
    expect(rows[0].error).toBeUndefined();
    expect(typeof rows[0].diff).toBe('number');
  }, 120000);
});

// minimal stored-entry zip writer (no compression) for the malicious-archive fixture
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZip(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf-8');
    const crc = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + entry.data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

describe('design-sanitize archive trust boundary', () => {
  it('refuses an archive whose entry escapes the batch', () => {
    const batch = `unsafe-zip-${process.pid}`;
    const target = join(process.cwd(), 'docs', 'ui', 'source', batch);
    rmSync(target, { recursive: true, force: true });
    const zipPath = join(tempRoot('design-zip-'), `${batch}.zip`);
    writeFileSync(zipPath, buildZip([{ name: `${batch}/../evil.txt`, data: Buffer.from('x') }]));

    const res = spawnSync(process.execPath, [SANITIZE, zipPath], { encoding: 'utf-8' });

    expect(res.status).toBe(2);
    expect(res.stderr).toContain('unsafe archive entry');
    expect(existsSync(target)).toBe(false);
    expect(existsSync(join(process.cwd(), 'docs', 'ui', 'source', 'evil.txt'))).toBe(false);
  }, 120000);
});

describe('design-sanitize check-only', () => {
  function batch(): string {
    const root = tempRoot('design-sanitize-');
    const dir = join(root, 'Screen');
    mkdirSync(dir);
    writeFileSync(join(dir, 'index.html'),
      '<html><head><script src="../_shared/tailwind-play.js"></script></head><body><img src="assets/missing.png"></body></html>');
    return root;
  }

  it('never writes into the batch and survives a screen without arkUIDSL.json', () => {
    const root = batch();
    const res = spawnSync(process.execPath, [SANITIZE, root], { encoding: 'utf-8' });

    expect(res.stderr).not.toContain('ENOENT');
    expect(res.stdout).toContain('screens: 1');
    expect(existsSync(join(root, '_shared'))).toBe(false);
  }, 120000);

  it('keeps the folder as the input when --tailwind-src comes first', () => {
    const root = batch();
    const tw = join(tempRoot('design-tw-'), 'tailwind-play.js');
    writeFileSync(tw, '// tailwind runtime\n');

    const res = spawnSync(process.execPath, [SANITIZE, '--tailwind-src', tw, root], { encoding: 'utf-8' });

    expect(res.stderr).not.toContain('ENOTDIR');
    expect(res.stdout).toContain('screens: 1');
  }, 120000);

  it('--fix survives incomplete screens', () => {
    const root = tempRoot('design-sanitize-fix-');
    // A: assets but no index.html — the dedupe rewrite must not read it
    mkdirSync(join(root, 'A', 'assets'), { recursive: true });
    writeFileSync(join(root, 'A', 'assets', 't.png'), Buffer.from('t'));
    // B: index.html + a shared asset, but no arkUIDSL.json — adoption must not read the
    // DSL, and the un-adoptable ref must still be reported
    mkdirSync(join(root, 'B'));
    writeFileSync(join(root, 'B', 'index.html'), '<img src="assets/s.png"><img src="assets/b.png">');
    mkdirSync(join(root, '_shared', 'assets'), { recursive: true });
    writeFileSync(join(root, '_shared', 'assets', 's.png'), Buffer.from('s'));

    // --fix regenerates the batch's DESIGN_INDEX section; restore it so the repo is untouched
    const idx = join(process.cwd(), 'docs', 'ui', 'DESIGN_INDEX.md');
    const before = readFileSync(idx, 'utf-8');
    try {
      const res = spawnSync(process.execPath, [SANITIZE, root, '--fix', '--skip-verify'], { encoding: 'utf-8' });
      expect(res.stderr).not.toContain('ENOENT');
      expect(res.status).toBe(1);
      expect(res.stdout).toContain('problem: A: no index.html');
      expect(res.stdout).toContain('problem: B: no arkUIDSL.json');
      expect(res.stdout).toContain('B: 2 missing asset refs');
      expect(res.stdout).not.toContain('adoptable from _shared/assets');
    } finally {
      writeFileSync(idx, before);
    }
  }, 120000);
});
