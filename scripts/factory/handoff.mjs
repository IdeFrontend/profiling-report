/**
 * Factory handoff bus — schema, transitions, labels, comment parsers.
 * @spec docs/process/AI_FACTORY.md
 */

export const FACTORY_ROLES = [
  'spec-author',
  'architect',
  'test-author',
  'developer',
  'fixer',
  'consistency',
  'performance',
  'reviewer',
  'human',
];

export const FACTORY_STATUSES = [
  'READY',
  'ARCH_PASS',
  'ARCH_FAIL',
  'CLARIFY',
  'BLOCKED',
  'RED_PASS',
  'COVERAGE_PASS',
  'COVERAGE_FAIL',
  'GREEN',
  'FIXED',
  'TEST_GAP',
  'CONSISTENCY_PASS',
  'CONSISTENCY_FAIL',
  'PERF_PASS',
  'PERF_FAIL',
  'REVIEW_PASS',
  'REVIEW_FAIL',
  'HITL',
];

export const STAGE_LABELS = [
  'start',
  'awaiting-spec',
  'awaiting-architect',
  'awaiting-tests',
  'awaiting-dev',
  'awaiting-fixer',
  'awaiting-consistency',
  'awaiting-perf',
  'awaiting-review',
  'hitl',
  'done',
];

export const MODE_LABELS = ['stage-red', 'stage-implement'];

const SLICE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA = /^(?:[0-9a-f]{40}|unknown)$/;

export function isFactoryRole(v) {
  return typeof v === 'string' && FACTORY_ROLES.includes(v);
}

export function isFactoryStatus(v) {
  return typeof v === 'string' && FACTORY_STATUSES.includes(v);
}

export function sliceIdFromBranch(branch) {
  const m = /^slice\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(branch.trim());
  return m ? m[1] : undefined;
}

export function parseHandoffRecord(obj) {
  if (typeof obj.slice !== 'string' || !SLICE_ID.test(obj.slice)) {
    throw new Error('FAC-008: invalid slice id');
  }
  if (typeof obj.commit !== 'string' || !SHA.test(obj.commit)) {
    throw new Error('FAC-008: commit must be a 40-char hex SHA or "unknown"');
  }
  if (!isFactoryRole(obj.from_role) || !isFactoryRole(obj.to_role)) {
    throw new Error('FAC-008: from_role/to_role not a factory role');
  }
  if (!isFactoryStatus(obj.status)) {
    throw new Error('FAC-008: status not a factory status');
  }
  const ids = Array.isArray(obj.ids) ? obj.ids : [];
  if (ids.some((x) => typeof x !== 'string')) {
    throw new Error('FAC-008: ids must be an array of strings');
  }
  let artifacts = Array.isArray(obj.artifacts) ? [...obj.artifacts] : [];
  if (artifacts.some((x) => typeof x !== 'string')) {
    throw new Error('FAC-008: artifacts must be an array of strings');
  }
  if (typeof obj.reason === 'string' && obj.reason.trim()) {
    const prefixed = obj.reason.startsWith('reason:') ? obj.reason : `reason: ${obj.reason}`;
    if (!artifacts.some((a) => a.startsWith('reason:'))) artifacts.push(prefixed);
  }
  if (
    typeof obj.developer_attempts !== 'number' ||
    obj.developer_attempts < 0 ||
    !Number.isInteger(obj.developer_attempts)
  ) {
    throw new Error('FAC-008: developer_attempts must be a non-negative integer');
  }
  if (typeof obj.idempotency !== 'string' || obj.idempotency !== `${obj.commit}:${obj.from_role}`) {
    throw new Error('FAC-008: idempotency must be <commit>:<from_role>');
  }

  const backStatuses = new Set([
    'CLARIFY',
    'BLOCKED',
    'TEST_GAP',
    'ARCH_FAIL',
    'COVERAGE_FAIL',
    'CONSISTENCY_FAIL',
    'PERF_FAIL',
    'REVIEW_FAIL',
    'FIXED',
  ]);
  if (backStatuses.has(obj.status)) {
    const hasReason =
      (typeof obj.reason === 'string' && obj.reason.trim().length > 0) ||
      artifacts.some((a) => typeof a === 'string' && a.startsWith('reason:'));
    if (!hasReason) throw new Error('FAC-009: back-channel hop needs reason');
  }

  const row = {
    slice: obj.slice,
    commit: obj.commit,
    from_role: obj.from_role,
    to_role: obj.to_role,
    status: obj.status,
    ids,
    artifacts,
    developer_attempts: obj.developer_attempts,
    idempotency: obj.idempotency,
  };
  if (typeof obj.reason === 'string') row.reason = obj.reason;
  if (typeof obj.phase === 'string') row.phase = obj.phase;
  if (obj.spike === true) row.spike = true;
  if (obj.spec_wrong === true) row.spec_wrong = true;
  return row;
}

/**
 * Extract machine handoff from a PR comment body.
 * Looks for `<!-- factory-handoff -->` then a ```json fence or raw JSON object.
 */
export function parseFactoryHandoffComment(body) {
  if (typeof body !== 'string' || !body.includes('factory-handoff')) return undefined;
  const marker = /<!--\s*factory-handoff\s*-->/i.exec(body);
  if (!marker) return undefined;
  const after = body.slice(marker.index + marker[0].length);
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(after);
  let raw;
  if (fenced) {
    raw = fenced[1].trim();
  } else {
    const brace = after.indexOf('{');
    if (brace < 0) return undefined;
    raw = after.slice(brace).trim();
    // trim trailing markdown if any
    const end = raw.lastIndexOf('}');
    if (end >= 0) raw = raw.slice(0, end + 1);
  }
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error('FAC-008: factory-handoff JSON is invalid');
  }
  return parseHandoffRecord(obj);
}

/** @deprecated file bus removed — kept for self-check of record schema only */
export function parseFactoryLine(line) {
  const trimmed = line.trim();
  if (trimmed === '') return { kind: 'empty' };
  const obj = JSON.parse(trimmed);
  if (obj.from_role === undefined && obj.schema !== undefined) {
    return { kind: 'schema' };
  }
  return { kind: 'row', row: parseHandoffRecord(obj) };
}

export function parseFactoryJsonl(text) {
  const rows = [];
  for (const line of text.split(/\n/)) {
    const parsed = parseFactoryLine(line);
    if (parsed.kind === 'row') rows.push(parsed.row);
  }
  return rows;
}

export function lastHandoff(rows) {
  return rows.length === 0 ? undefined : rows[rows.length - 1];
}

/** Soft transition check — allows documented back-channel matrix edges. */
export function transitionError(row) {
  const { from_role: from, to_role: to, status, developer_attempts: attempts, spike, phase } = row;

  const ok = (cond) => (cond ? undefined : `illegal transition ${from} ${status} → ${to}`);

  if (status === 'HITL' || status === 'BLOCKED') {
    if (to === 'human') return undefined;
    // BLOCKED may also target an owning role with reason
    if (status === 'BLOCKED') return undefined;
  }
  if (status === 'CLARIFY' || status === 'TEST_GAP') return undefined;
  if (status === 'ARCH_FAIL' || status === 'COVERAGE_FAIL' || status === 'CONSISTENCY_FAIL' || status === 'PERF_FAIL' || status === 'REVIEW_FAIL') {
    return undefined;
  }

  if (from === 'human' && status === 'READY') {
    return ok(to !== 'human');
  }
  if (from === 'spec-author' && status === 'READY') {
    return ok(to === 'architect');
  }
  if (from === 'spec-author' && status === 'COVERAGE_PASS') {
    return ok(to === 'developer');
  }
  if (from === 'architect' && status === 'ARCH_PASS') {
    if (phase === 'structure') return ok(to === 'consistency');
    if (spike) return ok(to === 'developer');
    return ok(to === 'test-author' || to === 'developer');
  }
  if (from === 'test-author' && status === 'RED_PASS') {
    return ok(to === 'spec-author');
  }
  if (from === 'developer' && status === 'GREEN') {
    return ok(to === 'architect');
  }
  if (from === 'fixer' && status === 'FIXED') {
    return ok(to === 'reviewer');
  }
  if (from === 'consistency' && status === 'CONSISTENCY_PASS') {
    return ok(to === 'performance');
  }
  if (from === 'performance' && status === 'PERF_PASS') {
    return ok(to === 'reviewer');
  }
  if (from === 'reviewer' && status === 'REVIEW_PASS') {
    return ok(to === 'human');
  }
  if (from === 'reviewer' && status === 'REVIEW_FAIL') {
    if (attempts >= 2 && to === 'human') return undefined;
    // Prefer fixer for impl; allow other owning roles
    return undefined;
  }
  return `illegal transition ${from} ${status} → ${to}`;
}

export function labelForToRole(role) {
  switch (role) {
    case 'spec-author':
      return 'awaiting-spec';
    case 'architect':
      return 'awaiting-architect';
    case 'test-author':
      return 'awaiting-tests';
    case 'developer':
      return 'awaiting-dev';
    case 'fixer':
      return 'awaiting-fixer';
    case 'consistency':
      return 'awaiting-consistency';
    case 'performance':
      return 'awaiting-perf';
    case 'reviewer':
      return 'awaiting-review';
    case 'human':
      return 'hitl';
    default:
      return 'hitl';
  }
}

export function ciModeLabels(status, phase) {
  if (status === 'RED_PASS') {
    return { add: ['stage-red'], remove: ['stage-implement'] };
  }
  if (status === 'GREEN' || (status === 'ARCH_PASS' && phase === 'structure')) {
    return { add: ['stage-implement'], remove: ['stage-red'] };
  }
  if (
    status === 'CONSISTENCY_PASS' ||
    status === 'PERF_PASS' ||
    status === 'PERF_FAIL' ||
    status === 'REVIEW_PASS' ||
    status === 'REVIEW_FAIL' ||
    status === 'FIXED'
  ) {
    return { add: ['stage-implement'], remove: ['stage-red'] };
  }
  return { add: [], remove: [] };
}

export function labelsFromHandoff(row, currentLabels = []) {
  const stage = labelForToRole(row.to_role);
  const mode = ciModeLabels(row.status, row.phase);
  const current = new Set(currentLabels);
  const add = new Set();
  const remove = new Set();

  for (const l of STAGE_LABELS) {
    if (l === stage) {
      if (!current.has(l)) add.add(l);
    } else if (current.has(l) && l !== 'done') {
      remove.add(l);
    }
  }
  for (const l of mode.add) {
    if (!current.has(l)) add.add(l);
  }
  for (const l of mode.remove) {
    if (current.has(l)) remove.add(l);
  }
  // kickoff latch
  if (current.has('start')) remove.add('start');

  return { add: [...add], remove: [...remove], present: true, stage };
}

export function parseKickoffComment(body) {
  const m = /^\/factory start slice=([a-z0-9]+(?:-[a-z0-9]+)*) role=([a-z-]+)\s*$/.exec(
    body.trim()
  );
  if (!m || !isFactoryRole(m[2]) || m[2] === 'human') return undefined;
  return { slice: m[1], role: m[2] };
}

export function parseHitlUnlock(body) {
  const t = body.trim();
  if (t === 'Approved. Proceed to code.') return { kind: 'proceed-to-code' };
  if (t === 'Approved. Accept perf baseline.') return { kind: 'accept-perf-baseline' };
  const m = /^Approved\. Continue to slice ([1-9]\d*)\.$/.exec(t);
  if (m) return { kind: 'continue-slice', n: Number(m[1]) };
  return undefined;
}

export function classifyVitestFailure(message) {
  if (/Cannot find module|Cannot find package|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND/i.test(message)) {
    return 'missing-module';
  }
  if (/SyntaxError|Unexpected token/.test(message)) {
    return 'syntax';
  }
  return 'assertion';
}

/**
 * Vitest/Playwright-ish JSON or log text: pass only if there are failures and all are assertion-class.
 */
export function redStageVerdictFromVitestJson(json) {
  const failed = [];
  if (Array.isArray(json?.testResults)) {
    for (const tr of json.testResults) {
      for (const ar of tr.assertionResults ?? []) {
        if (ar.status === 'failed') {
          failed.push((ar.failureMessages ?? []).join('\n') || tr.message || 'failed');
        }
      }
      if ((tr.status === 'failed' || tr.message) && !(tr.assertionResults?.length)) {
        failed.push(tr.message || 'suite failed');
      }
    }
  }
  if (json?.success === true || (json?.numFailedTests === 0 && failed.length === 0)) {
    return { pass: false, reason: 'tests are green; red-stage requires assertion failures' };
  }
  if (failed.length === 0 && typeof json === 'object') {
    // Fallback: numFailedTests
    if ((json.numFailedTests ?? 0) > 0) {
      return { pass: true, reason: 'numFailedTests > 0 (messages unavailable)' };
    }
    return { pass: false, reason: 'no failed tests found in report' };
  }
  for (const msg of failed) {
    const cls = classifyVitestFailure(msg);
    if (cls !== 'assertion') {
      return { pass: false, reason: `non-assertion failure class: ${cls}` };
    }
  }
  return { pass: true, reason: `assertion-mismatch red (${failed.length} failures)` };
}
