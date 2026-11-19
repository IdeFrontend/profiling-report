import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadReportSource } from '../../src/index';
import { parseNpuRep160 } from '../../src/adapters/parseNpuRep160';
import { hydrateSampleRep } from '../../playground/hydrateSampleRep';
import { loadOutRepBytes, loadResultNpuRepBytes, liteSampleRepByteLength } from '../helpers/fixtures';

const SAMPLE_LITE = resolve(__dirname, '../../data/sample.lite.rep');

describe('hydrateSampleRep', () => {
  it('passes cann-rep bytes through unchanged', () => {
    const out = loadOutRepBytes();
    expect(hydrateSampleRep(out)).toEqual(out);
  });

  it('passes flat product npu-rep through unchanged (no nested report to hydrate)', () => {
    const result = loadResultNpuRepBytes();
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

  it('injects the demo SIMT ratio into every nested Summary.jsonl of the lite sample', { timeout: 30_000 }, () => {
    const raw = new Uint8Array(readFileSync(SAMPLE_LITE));
    const hydrated = hydrateSampleRep(raw);
    const outer = parseNpuRep160(hydrated);
    for (const f of outer.files) {
      const nested = parseNpuRep160(outer.payloads[f.name]);
      const summary = new TextDecoder().decode(nested.payloads['Summary.jsonl']);
      expect(summary).toContain('"aiv_simt_ratio":0.215');
    }
    // The hydrated open report adapts with a plated SIMT badge (21.50%).
    const adapted = loadReportSource(hydrated);
    expect(adapted.reportModel?.memoryTopology?.plates).toEqual(
      expect.arrayContaining([expect.objectContaining({ node: 'simt', value: 21.5 })]),
    );
  });
});
