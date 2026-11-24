import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts', 'design-find.mjs');
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function screen(content: string) {
  return {
    ui: {
      componentName: 'Page',
      meta: { octoName: 'page', bbox: [0, 0, 100, 100] },
      children: [
        {
          componentName: 'Text',
          content,
          meta: { octoName: 'button-label', bbox: [0, 0, 10, 10] },
          children: [],
        },
      ],
    },
  };
}

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'design-find-'));
  roots.push(root);
  for (const [dir, text] of [['AlphaScreen', 'Button'], ['BetaScreen', 'Button']] as const) {
    mkdirSync(join(root, dir));
    writeFileSync(join(root, dir, 'arkUIDSL.json'), JSON.stringify(screen(text)));
  }
  return root;
}

function find(root: string, ...extra: string[]) {
  return JSON.parse(
    execFileSync(process.execPath, [SCRIPT, 'Button', root, '--json', ...extra], { encoding: 'utf-8' }),
  ) as Array<{ screen: string; hits: Array<{ screen: string }> }>;
}

describe('design-find --json', () => {
  it('reports the screen each hit was walked in', () => {
    const rows = find(fixture());

    expect(rows.map((r) => r.screen).sort()).toEqual(['AlphaScreen', 'BetaScreen']);
    for (const row of rows) {
      expect(row.hits.length).toBeGreaterThan(0);
      for (const hit of row.hits) expect(hit.screen).toBe(row.screen);
    }
  });

  it('falls back to the default limit when --limit has no value', () => {
    const rows = find(fixture(), '--limit');

    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.hits.length).toBeGreaterThan(0);
  });

  it('keeps a directory after a bare --limit as the design root', () => {
    const root = fixture();
    const rows = JSON.parse(
      execFileSync(process.execPath, [SCRIPT, 'Button', '--limit', root, '--json'], { encoding: 'utf-8' }),
    ) as Array<{ screen: string; hits: Array<{ screen: string }> }>;

    expect(rows.map((r) => r.screen).sort()).toEqual(['AlphaScreen', 'BetaScreen']);
    for (const row of rows) expect(row.hits.length).toBeGreaterThan(0);
  });
});
