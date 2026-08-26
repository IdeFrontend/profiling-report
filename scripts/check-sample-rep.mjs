#!/usr/bin/env node
/**
 * Ensure committed `data/sample.lite.rep` matches `data/sample.lite.rep.sha256`.
 * Refresh the hash after `npm run build:sample`.
 * Runtime op2 trace.json is pinned separately in tests/unit/generateSampleOp2Trace.spec.ts.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const samplePath = resolve(root, 'data/sample.lite.rep');
const hashPath = resolve(root, 'data/sample.lite.rep.sha256');

if (!existsSync(samplePath) || !existsSync(hashPath)) {
  console.error('[check:sample] missing data/sample.lite.rep or data/sample.lite.rep.sha256');
  process.exit(1);
}

const expected = readFileSync(hashPath, 'utf8').trim().split(/\s+/)[0];
if (!expected) {
  console.error('[check:sample] empty data/sample.lite.rep.sha256');
  process.exit(1);
}
const actual = createHash('sha256').update(readFileSync(samplePath)).digest('hex');

if (actual !== expected) {
  console.error(
    `[check:sample] data/sample.lite.rep sha256 mismatch.\n` +
      `  expected: ${expected}\n` +
      `  actual:   ${actual}\n` +
      `Regenerate with: npm run build:sample`,
  );
  process.exit(1);
}

console.log(`[check:sample] ok ${actual.slice(0, 12)}…`);
