#!/usr/bin/env node
/**
 * Classify expected-red vitest JSON for named check red-stage.
 * Usage: node scripts/factory/check-red-stage.mjs --json /tmp/vitest.json
 */
import { readFileSync } from 'node:fs';
import { redStageVerdictFromVitestJson } from './handoff.mjs';

const args = process.argv.slice(2);
const idx = args.indexOf('--json');
if (idx < 0) {
  console.error('usage: check-red-stage.mjs --json <file>');
  process.exit(2);
}
const json = JSON.parse(readFileSync(args[idx + 1], 'utf8'));
const verdict = redStageVerdictFromVitestJson(json);
console.log(JSON.stringify(verdict));
process.exit(verdict.pass ? 0 : 1);
