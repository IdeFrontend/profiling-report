import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

function copyIfExists(from, to) {
  try {
    copyFileSync(from, to)
    return true
  } catch {
    return false
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const destDir = join(root, 'playground/public/data')

mkdirSync(destDir, { recursive: true })

/** Canonical fixtures live under data/; playground copies are generated (gitignored). */
const copies = [
  ['data/out.rep', 'out.rep'],
  ['data/out.trace.json', 'out.trace.json'],
  ['data/example.npu.rep', 'example.rep'],
  ['data/example160.npu-rep', 'example160.rep'],
  ['data/sample.lite.rep', 'sample.lite.rep'],
  ['data/ffn_dense.trace.json', 'ffn_dense.trace.json'],
  ['data/vector_muladd_plain.npu-rep', 'vector_muladd_plain.npu-rep'],
  ['data/gelu.npu-rep', 'gelu.npu-rep'],
  ['data/gather_2d.npu-rep', 'gather_2d.npu-rep'],
]

for (const [from, name] of copies) {
  copyFileSync(join(root, from), join(destDir, name))
  console.log(`synced ${from} -> playground/public/data/${name}`)
}

/** Sudu Source-tab worker (TeaVM) — served same-origin from playground. */
const suduDir = join(root, 'playground/public/sudu')
mkdirSync(suduDir, { recursive: true })
const suduWorker = join(root, 'node_modules/@sudu-ide/code-review/src/worker.js')
try {
  copyFileSync(suduWorker, join(suduDir, 'worker.js'))
  console.log('synced @sudu-ide/code-review worker -> playground/public/sudu/worker.js')
} catch (e) {
  console.warn('[sync:demo-fixtures] sudu worker not copied:', e instanceof Error ? e.message : e)
}

const suduFontsDir = join(suduDir, 'fonts')
mkdirSync(suduFontsDir, { recursive: true })
const jbMonoFiles = join(root, 'node_modules/@fontsource/jetbrains-mono/files')
for (const name of [
  'jetbrains-mono-latin-300-normal.woff2',
  'jetbrains-mono-latin-300-italic.woff2',
  'jetbrains-mono-latin-400-normal.woff2',
  'jetbrains-mono-latin-400-italic.woff2',
  'jetbrains-mono-latin-600-normal.woff2',
  'jetbrains-mono-latin-600-italic.woff2',
]) {
  const from = join(jbMonoFiles, name)
  const to = join(suduFontsDir, name)
  if (copyIfExists(from, to)) {
    console.log(`synced ${name} -> playground/public/sudu/fonts/${name}`)
  } else {
    console.warn(`[sync:demo-fixtures] missing ${name} (npm install @fontsource/jetbrains-mono)`)
  }
}

const codiconFrom = join(root, 'node_modules/@vscode/codicons/dist/codicon.ttf')
if (copyIfExists(codiconFrom, join(suduDir, 'codicon.ttf'))) {
  console.log('synced codicon.ttf -> playground/public/sudu/codicon.ttf')
} else {
  console.warn('[sync:demo-fixtures] codicon not copied (npm install @vscode/codicons)')
}

/** sql.js WASM for compute Source-tab `summary.db` reads (same-origin). */
const sqljsDir = join(root, 'playground/public/sqljs')
mkdirSync(sqljsDir, { recursive: true })
const sqlWasm = join(root, 'node_modules/sql.js/dist/sql-wasm.wasm')
if (copyIfExists(sqlWasm, join(sqljsDir, 'sql-wasm.wasm'))) {
  console.log('synced sql-wasm.wasm -> playground/public/sqljs/sql-wasm.wasm')
} else {
  console.warn('[sync:demo-fixtures] sql.js wasm not copied (npm install sql.js)')
}

const shellTemplate = join(root, 'dist/report-shell/template.html')
if (existsSync(shellTemplate)) {
  copyFileSync(shellTemplate, join(root, 'playground/public/npu-rep-html-template.txt'))
  console.log('synced dist/report-shell/template.html -> playground/public/npu-rep-html-template.txt')
}
