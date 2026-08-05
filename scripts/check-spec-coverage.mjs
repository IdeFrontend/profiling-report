#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const STRICT_ID_RE = /\bPR-([A-Z0-9]+)-(\d{3,})\b/g;
const LOOSE_ID_RE = /\bPR-[A-Za-z0-9-]+-\d+\b/g;

function findFiles(dir, predicate) {
  if (!existsSync(dir)) throw new Error(`scan root missing: ${dir}`);
  const acc = [];
  const entries = readdirSync(dir, { withFileTypes: true, recursive: false });
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) acc.push(...findFiles(full, predicate));
    else if (predicate(entry.name)) acc.push(full);
  }
  return acc;
}

function readFile(filePath) { return readFileSync(filePath, 'utf-8'); }

function extractSection(content, heading) {
  const re = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
  const m = content.match(re);
  return m ? m[1] : null;
}

function extractIds(content) {
  return [...content.matchAll(STRICT_ID_RE)].map((m) => m[0]);
}

function extractLooseIds(content) {
  return [...content.matchAll(LOOSE_ID_RE)].map((m) => m[0]);
}

// ---- gather ----
let specFiles, testFiles;
try { specFiles = [...findFiles(resolve(ROOT, 'specs'), (n) => n.endsWith('.spec.md')), ...findFiles(resolve(ROOT, 'src'), (n) => n.endsWith('.spec.md'))]; }
catch (e) { console.error(`FATAL: ${e.message}`); process.exit(1); }
try { testFiles = [...findFiles(resolve(ROOT, 'src'), (n) => n.endsWith('.spec.ts')), ...findFiles(resolve(ROOT, 'tests'), (n) => n.endsWith('.spec.ts'))]; }
catch (e) { console.error(`FATAL: ${e.message}`); process.exit(1); }
if (specFiles.length === 0) { console.error('ERROR: No spec files found.'); process.exit(1); }
if (testFiles.length === 0) { console.error('ERROR: No test files found.'); process.exit(1); }

// ---- collect ----
const specACs = new Map();
const testIds = new Map();
const malformed = [];
const specsMissingSection = [];
const specsEmptyAC = [];

for (const file of specFiles) {
  const content = readFile(file);
  const section = extractSection(content, 'Acceptance Criteria');

  if (!section) { specsMissingSection.push(file); }
  else {
    const ids = extractIds(section);
    // Skip EMPTY AC warning for specs that explicitly delegate verification
    const isDelegated = /^\*.*(?:verified by|Shared.*prefix).*\*$/m.test(section.trim());
    if (ids.length === 0 && !isDelegated) specsEmptyAC.push(file);
    for (const id of ids) {
      if (id.split('-').length > 3) malformed.push({ file, id });
      if (!specACs.has(id)) specACs.set(id, []);
      specACs.get(id).push(file);
    }
  }

  for (const id of extractLooseIds(content)) {
    if (!/\bPR-[A-Z0-9]+-\d{3,}\b/.test(id)) malformed.push({ file, id });
  }
}

for (const file of testFiles) {
  const content = readFile(file);
  for (const id of extractIds(content)) {
    if (!testIds.has(id)) testIds.set(id, []);
    testIds.get(id).push(file);
  }
}

// ---- reports ----
console.log(`Spec files: ${specFiles.length}`);
console.log(`Test files: ${testFiles.length}`);
console.log(`Unique spec ACs: ${specACs.size}`);
console.log(`Unique test IDs:  ${testIds.size}\n`);

let errors = 0;

for (const file of specsMissingSection) { console.error(`NO AC SECTION  ${file}`); errors++; }
for (const file of specsEmptyAC) { console.error(`EMPTY AC       ${file}`); errors++; }
for (const { file, id } of malformed) { console.error(`MALFORMED ID   ${id}  in ${file}`); errors++; }

for (const [id, files] of [...specACs].sort(([a], [b]) => a.localeCompare(b))) {
  if (!testIds.has(id)) { console.error(`MISSING TEST   ${id}  (spec: ${files.join(', ')})`); errors++; }
}

for (const [id, files] of [...testIds].sort(([a], [b]) => a.localeCompare(b))) {
  if (!specACs.has(id)) { console.error(`ORPHAN TEST    ${id}  (test: ${files.join(', ')})`); errors++; }
}

for (const [id, files] of specACs) {
  if (files.length > 1) { console.error(`DUPLICATE AC   ${id}  (in: ${files.join(', ')})`); errors++; }
}

for (const [id, files] of testIds) {
  if (files.length > 1) { console.error(`DUPLICATE TEST ${id}  (in: ${files.join(', ')})`); errors++; }
}

console.log();
if (errors > 0) { console.error(`${errors} issue(s) found.`); process.exit(1); }
console.log('All spec acceptance criteria have test coverage. No orphans or duplicates.');
