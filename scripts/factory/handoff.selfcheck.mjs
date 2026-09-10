#!/usr/bin/env node
/** Self-check for factory handoff bus (no vitest — scripts/ is outside vitest resolve). */
import assert from 'node:assert/strict';
import {
  classifyVitestFailure,
  labelForToRole,
  labelsFromHandoff,
  parseFactoryHandoffComment,
  parseHitlUnlock,
  parseKickoffComment,
  parseHandoffRecord,
  redStageVerdictFromVitestJson,
  transitionError,
} from './handoff.mjs';

const sha = 'a'.repeat(40);

function row(partial = {}) {
  return parseHandoffRecord({
    slice: 'pilot-bus',
    commit: sha,
    from_role: 'spec-author',
    to_role: 'architect',
    status: 'READY',
    ids: ['PR-FAC-001'],
    artifacts: [],
    developer_attempts: 0,
    idempotency: `${sha}:spec-author`,
    phase: 'author',
    ...partial,
  });
}

assert.deepEqual(parseKickoffComment('/factory start slice=pilot-bus role=spec-author'), {
  slice: 'pilot-bus',
  role: 'spec-author',
});
assert.deepEqual(parseHitlUnlock('Approved. Proceed to code.'), { kind: 'proceed-to-code' });
assert.equal(transitionError(row()), undefined);
assert.equal(
  transitionError(
    row({
      from_role: 'test-author',
      to_role: 'spec-author',
      status: 'RED_PASS',
      idempotency: `${sha}:test-author`,
      phase: 'coverage',
    })
  ),
  undefined
);

assert.throws(
  () =>
    row({
      from_role: 'test-author',
      to_role: 'spec-author',
      status: 'CLARIFY',
      idempotency: `${sha}:test-author`,
    }),
  /FAC-009/
);

const out = labelsFromHandoff(
  row({
    from_role: 'developer',
    to_role: 'architect',
    status: 'GREEN',
    idempotency: `${sha}:developer`,
    phase: 'structure',
  }),
  ['awaiting-dev', 'stage-red']
);
assert.ok(out.add.includes('awaiting-architect'));
assert.ok(out.add.includes('stage-implement'));
assert.equal(labelForToRole('reviewer'), 'awaiting-review');
assert.equal(labelForToRole('fixer'), 'awaiting-fixer');
assert.equal(
  transitionError(
    row({
      from_role: 'fixer',
      to_role: 'reviewer',
      status: 'FIXED',
      idempotency: `${sha}:fixer`,
      reason: 'addressed review comments 1-3',
    })
  ),
  undefined
);
assert.equal(classifyVitestFailure('AssertionError: x'), 'assertion');
assert.equal(
  redStageVerdictFromVitestJson({
    success: false,
    numFailedTests: 1,
    testResults: [
      { assertionResults: [{ status: 'failed', failureMessages: ['AssertionError: expected x'] }] },
    ],
  }).pass,
  true
);

const payload = {
  slice: 'pilot-bus',
  commit: sha,
  from_role: 'spec-author',
  to_role: 'architect',
  status: 'READY',
  phase: 'author',
  ids: ['PR-FAC-001'],
  reason: '',
  developer_attempts: 0,
  idempotency: `${sha}:spec-author`,
  spike: false,
};
const comment = [
  '### Factory · spec-author · READY',
  '',
  'Wrote specs for the pilot slice.',
  '',
  '<!-- factory-handoff -->',
  '```json',
  JSON.stringify(payload, null, 2),
  '```',
  '',
].join('\n');
const parsed = parseFactoryHandoffComment(comment);
assert.equal(parsed.slice, 'pilot-bus');
assert.equal(parsed.from_role, 'spec-author');
assert.equal(parsed.to_role, 'architect');
assert.equal(parsed.status, 'READY');
assert.equal(parseFactoryHandoffComment('just a normal PR comment'), undefined);
assert.throws(
  () => parseFactoryHandoffComment('<!-- factory-handoff -->\n```json\n{not-json}\n```'),
  /FAC-008/
);

console.log('factory handoff self-check ok');
