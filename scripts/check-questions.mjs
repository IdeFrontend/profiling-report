#!/usr/bin/env node

/**
 * Validate the open-question / decision stores and every cross-reference to them.
 *
 * Invariants (see docs/context/questions/):
 *   1. No `resolved` status row is left on the open list.
 *   2. Every DATA-/UI-/PROC-/PKG- id cited in the repo resolves to a known id in
 *      docs/context/questions/ ∪ INTERIM_DECISIONS.md ∪ docs/context/decisions/.
 *   3. Every decision entry (in docs/context/decisions/*.md) links at least one owning spec.
 *   4. Only the canonical status enum (open|partial|interim|deferred) is used on the open list.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const QUESTIONS_DIR = resolve(ROOT, 'docs/context/questions');
const QUESTION_FILES = ['DATA.md', 'UI.md', 'PROC.md', 'PKG.md'];
const INTERIM = resolve(ROOT, 'docs/context/INTERIM_DECISIONS.md');
const DECISIONS_DIR = resolve(ROOT, 'docs/context/decisions');
const DECISION_FILES = ['DATA.md', 'UI.md', 'PROC.md', 'PKG.md'];

const errors = [];
const warnings = [];

const ID_RE = /(?<!PR-)\b((?:DATA|UI|PROC|PKG)-\d+[a-z]?)\b/g;

/** Collect all defined ids from the three stores (structural positions only). */
function definedIds() {
  const set = new Set();
  for (const file of QUESTION_FILES) {
    const q = readFileSync(join(QUESTIONS_DIR, file), 'utf8');
    for (const m of q.matchAll(/^###\s+((?:DATA|UI|PROC|PKG)-\d+)\b/gm)) set.add(m[1]);
  }
  for (const file of DECISION_FILES) {
    const dec = readFileSync(join(DECISIONS_DIR, file), 'utf8');
    for (const m of dec.matchAll(/^##\s+((?:DATA|UI|PROC|PKG)-\d+)\b/gm)) set.add(m[1]);
  }
  const interim = readFileSync(INTERIM, 'utf8');
  for (const m of interim.matchAll(/\*\*((?:DATA|UI|PROC|PKG)-\d+[a-z]?)\*\*/g)) set.add(m[1]);
  return set;
}

// ---- Check 1 + 4: status on the open list ----
function checkOpenStatus() {
  const allowed = new Set(['open', 'partial', 'interim', 'deferred']);
  let count = 0;
  for (const file of QUESTION_FILES) {
    const q = readFileSync(join(QUESTIONS_DIR, file), 'utf8');
    for (const line of q.split('\n')) {
      if (!line.includes('**Status:**')) continue;
      count++;
      const ticks = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      for (const t of ticks) {
        if (!allowed.has(t)) {
          errors.push(`${file}: status \`${t}\` is not in the open-list enum (open|partial|interim|deferred) — ${line.trim()}`);
        }
      }
    }
  }
  if (count === 0) errors.push('questions/: no `**Status:**` rows found (expected one per question)');
}

// ---- Check 3: decision → spec link ----
function checkDecisionLinks() {
  for (const file of DECISION_FILES) {
    const dec = readFileSync(join(DECISIONS_DIR, file), 'utf8');
    const sections = dec.split(/\n##\s+/).slice(1); // drop preamble
    for (const section of sections) {
      const id = section.match(/^(DATA|UI|PROC|PKG)-\d+/)?.[0];
      if (!id) {
        warnings.push(`${file}: section with no parseable id: ${section.split('\n')[0]}`);
        continue;
      }
      const hasSpecs = section.includes('**Specs:**');
      const hasLink = /\*\*Specs:\*\*[^\n]*\]\([^)]+\)/.test(section);
      if (!hasSpecs) errors.push(`${file}: ${id} has no \`**Specs:**\` field`);
      else if (!hasLink) errors.push(`${file}: ${id} \`**Specs:**\` field has no markdown link`);
    }
  }
}

// ---- Check 2: cited ids resolve ----
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist']);
const SCAN_EXTS = /\.(md|ts|vue|mjs|py|tsx)$/;

function walk(dir, acc) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = full.slice(ROOT.length + 1);
    if (SKIP_DIRS.has(name)) continue;
    if (rel === 'docs/archive') continue;
    if (rel.startsWith('docs/context/questions/')) continue;
    if (rel === 'docs/context/INTERIM_DECISIONS.md') continue;
    if (rel.startsWith('docs/context/decisions/')) continue;
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, acc);
    else if (SCAN_EXTS.test(name)) acc.push(rel);
  }
  return acc;
}

function checkIdResolution() {
  const defined = definedIds();
  const files = walk(join(ROOT, 'docs'), []);
  walk(join(ROOT, 'specs'), files);
  walk(join(ROOT, 'src'), files);
  walk(join(ROOT, 'tests'), files);
  walk(join(ROOT, 'playground'), files);
  walk(join(ROOT, 'data'), files);

  const undefinedIds = new Map();
  for (const rel of files) {
    const content = readFileSync(join(ROOT, rel), 'utf8');
    for (const m of content.matchAll(ID_RE)) {
      if (!defined.has(m[0])) {
        if (!undefinedIds.has(m[0])) undefinedIds.set(m[0], new Set());
        undefinedIds.get(m[0]).add(rel);
      }
    }
  }
  for (const [id, refs] of undefinedIds) {
    errors.push(`undefined question id "${id}" cited in: ${[...refs].sort().join(', ')}`);
  }
}

checkOpenStatus();
checkDecisionLinks();
checkIdResolution();

for (const w of warnings) console.warn(`WARN: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  console.error(`\ncheck-questions: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`check-questions: ok (${warnings.length} warning(s))`);
