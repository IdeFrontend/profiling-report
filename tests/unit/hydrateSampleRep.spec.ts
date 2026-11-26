import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadReportSource } from '../../src/index';
import { parseNpuRep160 } from '../../src/adapters/parseNpuRep160';
import { hydrateSampleRep } from '../../playground/hydrateSampleRep';
import { loadOutRepBytes, loadResultNpuRepBytes } from '../helpers/fixtures';

const SAMPLE_LITE = resolve(__dirname, '../../data/sample.lite.rep');

describe('hydrateSampleRep', () => {
  it('passes cann-rep bytes through unchanged', () => {
    const out = loadOutRepBytes();
    expect(hydrateSampleRep(out)).toEqual(out);
  });

  it('passes flat 160-byte product npu-rep through unchanged (no op2 to hydrate)', { timeout: 30_000 }, () => {
    const result = loadResultNpuRepBytes();
    expect(hydrateSampleRep(result)).toEqual(result);
  });

  it('loadReportSource still loads cann-rep after hydrate passthrough', () => {
    const adapted = loadReportSource(hydrateSampleRep(loadOutRepBytes()));
    expect(adapted.swimlaneModel?.processes.length).toBeGreaterThan(0);
  });

  it('injects the demo SIMT ratio into every nested report (summary + block CSV)', { timeout: 30_000 }, () => {
    const raw = new Uint8Array(readFileSync(SAMPLE_LITE));
    const hydrated = hydrateSampleRep(raw);
    const outer = parseNpuRep160(hydrated);
    for (const f of outer.files) {
      const nested = parseNpuRep160(outer.payloads[f.name]);
      const summary = new TextDecoder().decode(nested.payloads['Summary.jsonl']);
      expect(summary).toContain('"aiv_simt_ratio":0.215');
      const csv = new TextDecoder().decode(nested.payloads['PipeUtilization.csv']);
      const [header, firstRow] = csv.replaceAll(String.fromCharCode(13), '').split(String.fromCharCode(10));
      expect(header).toContain('aiv_simt_ratio');
      expect(firstRow.split(',').length).toBe(header.split(',').length);
    }
    // The adapted report paints the SIMT plate (All snapshot + picked block).
    const adapted = loadReportSource(hydrated);
    const plates = adapted.reportModel?.memoryTopology?.plates ?? [];
    expect(plates.find((p) => p.node === 'simt')?.value).toBe(21.5);
    const pipe = adapted.reportModel?.computeTables?.find(
      (t) => t.fileName === 'PipeUtilization.csv',
    );
    const row = pipe?.rows.find((r) => r.block_id === '0');
    expect(Number(row?.aiv_simt_ratio)).toBeCloseTo(0.215, 3);
  });

  it('expands lite sample.lite.rep with op2 trace', { timeout: 30_000 }, () => {
    const raw = new Uint8Array(readFileSync(SAMPLE_LITE));
    const hydrated = hydrateSampleRep(raw);
    // Hydration injects the multi-MB op2 trace on top of the lite file.
    expect(hydrated.byteLength).toBeGreaterThan(30_000_000);
  });
});
