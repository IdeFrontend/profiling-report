import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

describe('source freshness (DATA-57)', () => {
  it('PR-FRESH-001: no sources.json product fingerprint artifacts', () => {
    expect(existsSync(resolve(root, 'docs/formats/sources.schema.json'))).toBe(
      false,
    );
    expect(
      existsSync(resolve(root, 'docs/formats/compute/sources.json.md')),
    ).toBe(false);
    expect(
      existsSync(
        resolve(root, 'src/adapters/sourceProvenance/adaptSourceProvenance.ts'),
      ),
    ).toBe(false);
  });
});
