#!/usr/bin/env node
/**
 * Classify a trusted factory PR comment.
 * Usage: node scripts/factory/comment.mjs --body-file /tmp/body.txt
 *
 * Types: kickoff | proceed-to-code | accept-perf-baseline | continue-slice | handoff | ignore
 */
import { readFileSync } from 'node:fs';
import {
  labelForToRole,
  labelsFromHandoff,
  parseFactoryHandoffComment,
  parseHitlUnlock,
  parseKickoffComment,
  transitionError,
} from './handoff.mjs';

const args = process.argv.slice(2);
const fileIdx = args.indexOf('--body-file');
const body =
  fileIdx >= 0
    ? readFileSync(args[fileIdx + 1], 'utf8')
    : args.includes('--body')
      ? args[args.indexOf('--body') + 1]
      : '';

const kickoff = parseKickoffComment(body);
if (kickoff) {
  const roleLabel = labelForToRole(kickoff.role);
  console.log(
    JSON.stringify({
      type: 'kickoff',
      slice: kickoff.slice,
      role: kickoff.role,
      labels: ['start', roleLabel],
    })
  );
  process.exit(0);
}

const unlock = parseHitlUnlock(body);
if (unlock?.kind === 'proceed-to-code') {
  console.log(JSON.stringify({ type: 'proceed-to-code', labels: ['awaiting-dev'] }));
  process.exit(0);
}
if (unlock?.kind === 'accept-perf-baseline') {
  console.log(JSON.stringify({ type: 'accept-perf-baseline' }));
  process.exit(0);
}
if (unlock?.kind === 'continue-slice') {
  console.log(JSON.stringify({ type: 'continue-slice', n: unlock.n }));
  process.exit(0);
}

try {
  const handoff = parseFactoryHandoffComment(body);
  if (handoff) {
    const err = transitionError(handoff);
    if (err) {
      console.log(JSON.stringify({ type: 'handoff-invalid', error: err }));
      process.exit(0);
    }
    const current = (process.env.FACTORY_CURRENT_LABELS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const labels = labelsFromHandoff(handoff, current);
    console.log(
      JSON.stringify({
        type: 'handoff',
        handoff,
        add: labels.add,
        remove: labels.remove,
        stage: labels.stage,
      })
    );
    process.exit(0);
  }
} catch (e) {
  console.log(JSON.stringify({ type: 'handoff-invalid', error: e.message }));
  process.exit(0);
}

console.log(JSON.stringify({ type: 'ignore' }));
