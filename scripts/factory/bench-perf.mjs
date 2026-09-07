#!/usr/bin/env node
/**
 * Run parse bench and compare to docs/perf/baseline.json (FAC-015 / FAC-016).
 * Exit 0 on pass, 1 on regression beyond +5%.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const PERF_TOLERANCE_RATIO = 0.05;

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const baselinePath = join(root, 'docs/perf/baseline.json');
const lastRunPath = join(root, 'docs/perf/last-run.json');

mkdirSync(join(root, 'docs/perf'), { recursive: true });

const vitest = spawnSync(
  'npx',
  ['vitest', 'run', '--config', 'vitest.perf.config.ts'],
  { cwd: root, encoding: 'utf8', shell: true }
);
if (vitest.status !== 0) {
  console.error(vitest.stdout);
  console.error(vitest.stderr);
  process.exit(vitest.status ?? 1);
}

if (!existsSync(lastRunPath)) {
  console.error('bench did not write docs/perf/last-run.json');
  process.exit(1);
}

const last = JSON.parse(readFileSync(lastRunPath, 'utf8'));
const medianMs = last.medianMs;

if (!existsSync(baselinePath)) {
  const baseline = {
    metric: last.metric,
    medianMs,
    toleranceRatio: PERF_TOLERANCE_RATIO,
    note: 'Initial baseline; regenerate only with Approved. Accept perf baseline.',
  };
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(JSON.stringify({ pass: true, createdBaseline: true, medianMs }, null, 2));
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const limit = baseline.medianMs * (1 + (baseline.toleranceRatio ?? PERF_TOLERANCE_RATIO));
const absFloor = baseline.medianMs + 1; // FAC-016 absolute floor 1ms on top of ratio
const ceiling = Math.max(limit, absFloor);
const pass = medianMs <= ceiling;
const result = {
  pass,
  metric: last.metric,
  medianMs,
  baselineMs: baseline.medianMs,
  ceilingMs: Number(ceiling.toFixed(3)),
  deltaPct: Number((((medianMs - baseline.medianMs) / baseline.medianMs) * 100).toFixed(2)),
};
console.log(JSON.stringify(result, null, 2));
process.exit(pass ? 0 : 1);
