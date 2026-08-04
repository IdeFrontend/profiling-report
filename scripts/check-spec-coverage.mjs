#!/usr/bin/env node

/**
 * Validate that every acceptance criterion in a spec has a corresponding test,
 * and that every test references its spec.
 *
 * Usage: node scripts/check-spec-coverage.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/** Extract test IDs (PR-XXXX-NNN) from a test file. */
function extractTestIds(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const matches = content.matchAll(/(?:^|\s|['"`=(])(PR-[A-Z]+-\d{3})(?:\s|['"`:,)])/gm);
    return new Set([...matches].map((m) => m[1]));
  } catch {
    return new Set();
  }
}

/** Extract acceptance criteria IDs from a spec file. */
function extractSpecACs(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const matches = content.matchAll(/\b(PR-[A-Z]+-\d{3})\b/g);
    return new Set([...matches].map((m) => m[1]));
  } catch {
    return new Set();
  }
}

function findFiles(dir, pattern, acc = []) {
  if (!existsSync(dir)) return acc;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      findFiles(full, pattern, acc);
    } else if (typeof pattern === 'function' ? pattern(entry.name) : entry.name.endsWith(pattern)) {
      acc.push(full);
    }
  }
  return acc;
}

const specFiles = findFiles(resolve(ROOT, 'specs'), '.spec.md');
const componentSpecFiles = [
  ...findFiles(resolve(ROOT, 'src/ui'), (n) => n.endsWith('.spec.md')),
  ...findFiles(resolve(ROOT, 'src/swimlane'), (n) => n.endsWith('.spec.md')),
];

const testFiles = [
  ...findFiles(resolve(ROOT, 'tests'), '.spec.ts'),
  ...findFiles(resolve(ROOT, 'src/ui'), (n) => n.endsWith('.spec.ts')),
  ...findFiles(resolve(ROOT, 'src/swimlane'), (n) => n.endsWith('.spec.ts')),
];

// Collect all spec ACs
const allSpecACs = new Set();
for (const spec of [...specFiles, ...componentSpecFiles]) {
  for (const id of extractSpecACs(spec)) {
    allSpecACs.add(id);
  }
}

// Collect all test IDs
const allTestIds = new Set();
for (const test of testFiles) {
  for (const id of extractTestIds(test)) {
    allTestIds.add(id);
  }
}

console.log(`Spec files: ${specFiles.length + componentSpecFiles.length}`);
console.log(`Test files: ${testFiles.length}`);
console.log(`Spec ACs found: ${allSpecACs.size}`);
console.log(`Test IDs found: ${allTestIds.size}`);
console.log();

// Check: every spec AC has a test
let missingTests = 0;
for (const id of [...allSpecACs].sort()) {
  if (!allTestIds.has(id)) {
    console.log(`MISSING TEST for spec AC: ${id}`);
    missingTests++;
  }
}

// Check: every test ID appears in a spec
let orphanTests = 0;
for (const id of [...allTestIds].sort()) {
  if (!allSpecACs.has(id)) {
    console.log(`ORPHAN TEST (no spec AC): ${id}`);
    orphanTests++;
  }
}

console.log();
if (missingTests > 0) console.log(`${missingTests} spec ACs missing tests`);
if (orphanTests > 0) console.log(`${orphanTests} test IDs without spec ACs`);

if (missingTests === 0 && orphanTests === 0) {
  console.log('All spec acceptance criteria have test coverage.');
  process.exit(0);
} else {
  process.exit(1);
}
