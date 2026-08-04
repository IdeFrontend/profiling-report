#!/usr/bin/env node

/**
 * Validate that every acceptance criterion in a spec has a corresponding test,
 * and that every test references its spec.
 *
 * Usage: node scripts/check-spec-coverage.mjs
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/**
 * Scan directories recursively for files matching a name predicate.
 * Returns [] (not throws) for missing directories — callers can check
 * existence separately if needed.
 */
function findFiles(dir, namePredicate) {
  const acc = [];
  if (!existsSync(dir)) return acc;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        acc.push(...findFiles(full, namePredicate));
      } else if (namePredicate(entry.name)) {
        acc.push(full);
      }
    }
  } catch {
    // Permission error — skip, return what we have so far
  }
  return acc;
}

/**
 * ID regex: PR- followed by uppercase letters/digits, hyphen, 3+ digits.
 * This matches PR-FMT-001, PR-E2E-001, PR-SCAFFOLD-004, etc.
 * Uses word boundaries to avoid partial matches inside other strings.
 */
const ID_RE = /\bPR-[A-Z0-9]+-\d{3,}\b/g;

function extractIds(content) {
  return [...new Set([...content.matchAll(ID_RE)].map((m) => m[0]))];
}

/** Read a file or return null on any error. */
function safeRead(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// ---- gather spec files ----

const specFiles = [
  ...findFiles(resolve(ROOT, 'specs'), (n) => n.endsWith('.spec.md')),
  ...findFiles(resolve(ROOT, 'src'), (n) => n.endsWith('.spec.md')),
];

if (specFiles.length === 0) {
  console.error('ERROR: No spec files found. Check that specs/ and src/**/*.spec.md exist.');
  process.exit(1);
}

// ---- gather test files ----

const testFiles = [
  ...findFiles(resolve(ROOT, 'src'), (n) => n.endsWith('.spec.ts')),
  ...findFiles(resolve(ROOT, 'tests'), (n) => n.endsWith('.spec.ts')),
];

if (testFiles.length === 0) {
  console.error('ERROR: No test files found. Check that src/**/*.spec.ts and tests/**/*.spec.ts exist.');
  process.exit(1);
}

// ---- collect IDs ----

const allSpecACs = new Map(); // id → [file, file, ...]  (allow duplicates for detection)
const allTestIds = new Map(); // id → file

for (const file of specFiles) {
  const content = safeRead(file);
  if (content === null) {
    console.error(`ERROR: Cannot read spec file: ${file}`);
    process.exit(1);
  }
  for (const id of extractIds(content)) {
    if (!allSpecACs.has(id)) allSpecACs.set(id, []);
    allSpecACs.get(id).push(file);
  }
}

for (const file of testFiles) {
  const content = safeRead(file);
  if (content === null) {
    console.error(`ERROR: Cannot read test file: ${file}`);
    process.exit(1);
  }
  for (const id of extractIds(content)) {
    allTestIds.set(id, file);
  }
}

// ---- reports ----

console.log(`Spec files: ${specFiles.length}`);
console.log(`Test files: ${testFiles.length}`);
console.log(`Unique spec ACs: ${allSpecACs.size}`);
console.log(`Unique test IDs:  ${allTestIds.size}`);
console.log();

let errors = 0;

// Check: every spec AC has a test
for (const [id, specFiles] of [...allSpecACs].sort(([a], [b]) => a.localeCompare(b))) {
  if (!allTestIds.has(id)) {
    console.error(`MISSING TEST   ${id}  (spec: ${specFiles.join(', ')})`);
    errors++;
  }
}

// Check: every test ID appears in a spec
for (const [id, testFile] of [...allTestIds].sort(([a], [b]) => a.localeCompare(b))) {
  if (!allSpecACs.has(id)) {
    console.error(`ORPHAN TEST    ${id}  (test: ${testFile})`);
    errors++;
  }
}

// Check: duplicate ACs (same ID defined in multiple specs)
for (const [id, files] of allSpecACs) {
  if (files.length > 1) {
    console.error(`DUPLICATE AC   ${id}  (defined in: ${files.join(', ')})`);
    errors++;
  }
}

console.log();

if (errors > 0) {
  console.error(`${errors} issue(s) found.`);
  process.exit(1);
}

console.log('All spec acceptance criteria have test coverage. No orphans or duplicates.');
