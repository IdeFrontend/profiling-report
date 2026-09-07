#!/usr/bin/env node
/**
 * Sync PR labels from a factory handoff record (JSON on stdin or --json file).
 * Usage:
 *   FACTORY_CURRENT_LABELS=a,b node scripts/factory/sync-state.mjs --json /tmp/handoff.json
 *   echo '{...}' | FACTORY_CURRENT_LABELS=a,b node scripts/factory/sync-state.mjs
 */
import { readFileSync } from 'node:fs';
import { labelsFromHandoff, parseHandoffRecord, transitionError } from './handoff.mjs';

const args = process.argv.slice(2);
const jsonIdx = args.indexOf('--json');
let raw;
if (jsonIdx >= 0) {
  raw = readFileSync(args[jsonIdx + 1], 'utf8');
} else {
  raw = readFileSync(0, 'utf8');
}
if (!raw.trim()) {
  console.log(JSON.stringify({ present: false }));
  process.exit(0);
}
const obj = JSON.parse(raw);
const row = parseHandoffRecord(obj.handoff ?? obj);
const err = transitionError(row);
if (err) {
  console.error(err);
  process.exit(1);
}
const current = (process.env.FACTORY_CURRENT_LABELS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const out = labelsFromHandoff(row, current);
console.log(JSON.stringify(out));
