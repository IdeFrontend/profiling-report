import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  baselineDisplayTitle,
  formatBaselineStamp,
  isGeneratedBaselineName,
  stampFromOpprofName,
} from './baselineTitle';
import type { Baseline } from './baselinesModel';

const b = (over: Partial<Baseline>): Baseline => ({
  id: 'demo-recent-1',
  name: 'OPPROF_20261108142517_QKWFPLXZVTRNBGMA',
  path: '/data/out.rep',
  ...over,
});

describe('isGeneratedBaselineName', () => {
  it('flags OPPROF run ids, uuids, the b- fallback and empty names', () => {
    expect(isGeneratedBaselineName('OPPROF_20261108142517_QKWFPLXZVTRNBGMA')).toBe(true);
    expect(isGeneratedBaselineName('6f0a2b3c-9d4e-4f5a-8b6c-1d2e3f4a5b6c')).toBe(true);
    expect(isGeneratedBaselineName('b-m3k2x9-abc123')).toBe(true);
    expect(isGeneratedBaselineName('')).toBe(true);
    expect(isGeneratedBaselineName(undefined)).toBe(true);
  });

  it('keeps real names', () => {
    expect(isGeneratedBaselineName('gelu.npu-rep')).toBe(false);
    expect(isGeneratedBaselineName('matmul profile run')).toBe(false);
    expect(isGeneratedBaselineName('OPPROF_matmul_7x7')).toBe(false); // not the run-id shape
  });
});

describe('formatBaselineStamp', () => {
  it('formats the locale-neutral stamp', () => {
    expect(formatBaselineStamp(new Date(2026, 10, 8, 14, 25).getTime())).toBe('2026-11-08 14:25');
  });

  it('returns empty for a broken value', () => {
    expect(formatBaselineStamp(Number.NaN)).toBe('');
  });
});

describe('stampFromOpprofName', () => {
  it('parses the embedded run stamp', () => {
    expect(stampFromOpprofName('OPPROF_20261108142517_QKWFPLXZVTRNBGMA')).toBe(
      new Date(2026, 10, 8, 14, 25, 17).getTime(),
    );
  });

  it('returns undefined without the run-id shape', () => {
    expect(stampFromOpprofName('out.rep')).toBeUndefined();
    expect(stampFromOpprofName(undefined)).toBeUndefined();
  });

  it('returns undefined for an impossible calendar', () => {
    expect(stampFromOpprofName('OPPROF_20260231010101_QKWFPLXZVTRNBGMA')).toBeUndefined();
    expect(stampFromOpprofName('OPPROF_20260229010101_QKWFPLXZVTRNBGMA')).toBeUndefined();
  });

  it('keeps the embedded clock in Europe/London, where 01:30 does not exist', () => {
    // UTC Date prints 01:30 either way. The gap only shows up in a DST zone.
    // CI runs Node 20, which rejects --experimental-strip-types, so emit plain JS.
    const source = readFileSync(path.join(process.cwd(), 'src/domain/baselineTitle.ts'), 'utf8');
    const js = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      fileName: 'baselineTitle.ts',
    }).outputText;
    const dir = mkdtempSync(path.join(tmpdir(), 'opprof-'));
    try {
      const file = path.join(dir, 'baselineTitle.mjs');
      writeFileSync(file, js);
      const href = pathToFileURL(file).href;
      const script = `
        import { baselineDisplayTitle, stampFromOpprofName } from ${JSON.stringify(href)};
        const name = 'OPPROF_20260329013000_QKWFPLXZVTRNBGMA';
        const ms = stampFromOpprofName(name);
        const title = baselineDisplayTitle({ id: 'x', name, path: '/data/out.rep' });
        if (ms != null) throw new Error('rolled epoch ' + ms);
        if (title !== 'out.rep 2026-03-29 01:30') throw new Error('title ' + title);
      `;
      const res = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        env: { ...process.env, TZ: 'Europe/London' },
        encoding: 'utf8',
      });
      expect(res.status, res.stderr || res.stdout).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('baselineDisplayTitle', () => {
  it('replaces a generated id with filename + the parsed OPPROF stamp', () => {
    expect(baselineDisplayTitle(b({}))).toBe('out.rep 2026-11-08 14:25');
  });

  it('prints the embedded OPPROF digits and does not roll an impossible day', () => {
    expect(
      baselineDisplayTitle(b({ name: 'OPPROF_20260329013000_QKWFPLXZVTRNBGMA' })),
    ).toBe('out.rep 2026-03-29 01:30');
    expect(
      baselineDisplayTitle(b({ name: 'OPPROF_20240229010101_QKWFPLXZVTRNBGMA' })),
    ).toBe('out.rep 2024-02-29 01:01');
    expect(
      baselineDisplayTitle(b({ name: 'OPPROF_20260231010101_QKWFPLXZVTRNBGMA' })),
    ).toBe('out.rep');
  });

  it('uses the entry pickedAt over the parsed stamp', () => {
    const pickedAt = new Date(2026, 10, 10, 9, 5).getTime();
    expect(baselineDisplayTitle(b({ pickedAt }))).toBe('out.rep 2026-11-10 09:05');
  });

  it('appends the stamp to a real name', () => {
    const pickedAt = new Date(2026, 10, 16, 17, 2).getTime();
    expect(baselineDisplayTitle(b({ name: 'baseline-a.npu-rep', pickedAt }))).toBe(
      'baseline-a.npu-rep 2026-11-16 17:02',
    );
  });

  it('keeps a real name without any stamp', () => {
    expect(baselineDisplayTitle(b({ name: 'gelu.npu-rep', pickedAt: undefined }))).toBe(
      'gelu.npu-rep',
    );
  });

  it('shows the stamp alone when the filename is itself an OPPROF run id', () => {
    expect(
      baselineDisplayTitle(
        b({
          path: 'C:/runs/OPPROF_20260505172654_BDSCTVEAQPKQTIOW',
          name: 'OPPROF_20260505172654_BDSCTVEAQPKQTIOW',
        }),
      ),
    ).toBe('2026-05-05 17:26');
  });

  it('falls back to the old chain when nothing derivable', () => {
    expect(baselineDisplayTitle(b({ name: '', path: '/data/out.rep', pickedAt: undefined }))).toBe(
      'out.rep',
    );
    expect(
      baselineDisplayTitle(b({ name: '', path: '', pickedAt: undefined, id: 'x-1' })),
    ).toBe('x-1');
  });
});
