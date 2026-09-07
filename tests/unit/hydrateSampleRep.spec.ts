import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadReportSource } from '../../src/index';
import { hydrateSampleRep } from '../../playground/hydrateSampleRep';
import { loadOutRepBytes, loadResultNpuRepBytes, liteSampleRepByteLength } from '../helpers/fixtures';

const SAMPLE_LITE = resolve(__dirname, '../../data/sample.lite.rep');

describe('hydrateSampleRep', () => {
  it('passes cann-rep bytes through unchanged', () => {
    const out = loadOutRepBytes();
    expect(hydrateSampleRep(out)).toEqual(out);
  });

  it('passes the 160-byte product npu-rep through unchanged (no 164-byte parse)', () => {
    const result = loadResultNpuRepBytes();
    // Must not throw on the 160-byte FileInfo layout, and must not mutate the bytes.
    expect(hydrateSampleRep(result)).toEqual(result);
  });

  it('loadReportSource still loads cann-rep after hydrate passthrough', () => {
    const adapted = loadReportSource(hydrateSampleRep(loadOutRepBytes()));
    expect(adapted.swimlaneModel?.processes.length).toBeGreaterThan(0);
  });

  it('expands lite sample.lite.rep with op2 trace', { timeout: 30_000 }, () => {
    const raw = new Uint8Array(readFileSync(SAMPLE_LITE));
    const hydrated = hydrateSampleRep(raw);
    expect(hydrated.byteLength).toBeGreaterThan(liteSampleRepByteLength() * 100);
  });
});
