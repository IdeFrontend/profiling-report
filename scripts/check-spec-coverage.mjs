#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const ID_RE = /\bPR-[A-Z0-9]+-\d{3,}\b/g;

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

/** Extract the ## Acceptance Criteria section body. Matches the H2 heading and captures content until the next H2 or EOF. */
function extractSection(content, heading) {
  const re = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
  const m = content.match(re);
  return m ? m[1] : null;
}

function extractIds(content) {
  return [...content.matchAll(ID_RE)].map((m) => m[0]);
}

const DELEGATED_SPECS = new Set([
  resolve(ROOT, 'specs', 'architecture', 'public-api.spec.md'),
  resolve(ROOT, 'specs', 'architecture', 'mstt-integration.spec.md'),
  resolve(ROOT, 'specs', 'core', 'input-formats.spec.md'),
]);

// ---- gather ----
let specFiles, testFiles;
try { specFiles = [...findFiles(resolve(ROOT, 'specs'), (n) => n.endsWith('.spec.md')), ...findFiles(resolve(ROOT, 'src'), (n) => n.endsWith('.spec.md'))]; }
catch (e) { console.error(`FATAL: ${e.message}`); process.exit(1); }
try { testFiles = [...findFiles(resolve(ROOT, 'src'), (n) => n.endsWith('.spec.ts')), ...findFiles(resolve(ROOT, 'tests'), (n) => n.endsWith('.spec.ts'))]; }
catch (e) { console.error(`FATAL: ${e.message}`); process.exit(1); }
if (specFiles.length === 0) { console.error('ERROR: No spec files found.'); process.exit(1); }
if (testFiles.length === 0) { console.error('ERROR: No test files found.'); process.exit(1); }

// ---- collect ----
const specACs = new Map();   // id → Set(files) — distinct files only
const testIds = new Map();   // id → Set(files) — distinct files only
const specsMissingSection = [];
const specsEmptyAC = [];

for (const file of specFiles) {
  const content = readFile(file);
  const section = extractSection(content, 'Acceptance Criteria');

  if (!section) {
    if (!DELEGATED_SPECS.has(file)) specsMissingSection.push(file);
    continue;
  }

  const ids = extractIds(section);
  if (ids.length === 0 && !DELEGATED_SPECS.has(file)) specsEmptyAC.push(file);

  if (DELEGATED_SPECS.has(file)) continue;

  for (const id of ids) {
    if (!specACs.has(id)) specACs.set(id, new Set());
    specACs.get(id).add(file);
  }
}

for (const file of testFiles) {
  const content = readFile(file);
  for (const id of extractIds(content)) {
    if (!testIds.has(id)) testIds.set(id, new Set());
    testIds.get(id).add(file);
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

for (const [id, files] of [...specACs].sort(([a], [b]) => a.localeCompare(b))) {
  if (!testIds.has(id)) { console.error(`MISSING TEST   ${id}  (spec: ${[...files].join(', ')})`); errors++; }
}

for (const [id, files] of [...testIds].sort(([a], [b]) => a.localeCompare(b))) {
  if (!specACs.has(id)) { console.error(`ORPHAN TEST    ${id}  (test: ${[...files].join(', ')})`); errors++; }
}

for (const [id, files] of specACs) {
  if (files.size > 1) { console.error(`DUPLICATE AC   ${id}  (in: ${[...files].join(', ')})`); errors++; }
}

console.log();
if (errors > 0) { console.error(`${errors} issue(s) found.`); process.exit(1); }
console.log('All spec acceptance criteria have test coverage. No orphans or duplicates.');
