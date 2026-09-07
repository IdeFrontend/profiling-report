/**
 * Performance bench for factory Performance role.
 * Measures parseRep wall time on data/out.rep (warm runs).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseRep } from '../../src/adapters/parseRep';
import { writeFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(root, 'docs/perf/last-run.json');

describe('factory perf bench', () => {
  it('times parseRep on data/out.rep', () => {
    const buf = readFileSync(join(root, 'data/out.rep'));
    // warm
    parseRep(buf);
    const runs = 5;
    const samples: number[] = [];
    for (let i = 0; i < runs; i++) {
      const t0 = performance.now();
      const parsed = parseRep(buf);
      const t1 = performance.now();
      expect(parsed.files.length).toBeGreaterThan(0);
      samples.push(t1 - t0);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)]!;
    const payload = {
      metric: 'parseRep_out_rep_ms',
      medianMs: Number(median.toFixed(3)),
      samples,
      at: new Date().toISOString(),
    };
    writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
    expect(median).toBeGreaterThan(0);
  });
});
