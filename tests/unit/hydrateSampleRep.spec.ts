import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hydrateSampleRep } from '../../playground/hydrateSampleRep';
import { loadOutRepBytes, liteSampleRepByteLength } from '../helpers/fixtures';

const SAMPLE_LITE = resolve(__dirname, '../../data/sample.lite.rep');

describe('hydrateSampleRep', () => {
  it('passes cann-rep bytes through unchanged', () => {
    const out = loadOutRepBytes();
    expect(hydrateSampleRep(out)).toEqual(out);
  });

  it('expands lite sample.lite.rep with op2 trace', () => {
    const raw = new Uint8Array(readFileSync(SAMPLE_LITE));
    const hydrated = hydrateSampleRep(raw);
    expect(hydrated.byteLength).toBeGreaterThan(liteSampleRepByteLength() * 100);
  });
});
