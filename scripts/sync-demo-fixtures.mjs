import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LFS_POINTER_PREFIX = 'version https://git-lfs.github.com/spec/v1'

/** Vercel publishes whatever this copies. A pointer is not a report. */
function assertNotLfsPointer(path) {
  const fd = openSync(path, 'r')
  const buf = Buffer.alloc(LFS_POINTER_PREFIX.length)
  let n = 0
  try {
    n = readSync(fd, buf, 0, buf.length, 0)
  } finally {
    closeSync(fd)
  }
  if (buf.toString('utf8', 0, n).startsWith(LFS_POINTER_PREFIX)) {
    console.error(
      `[sync:demo-fixtures] ${path} is a Git LFS pointer. Run scripts/checkout-lfs.sh before syncing demo fixtures.`,
    )
    process.exit(1)
  }
}

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
  ['data/roofline_multi.npu-rep', 'roofline_multi.npu-rep'],
  ['data/simt_gather_1d_roofline.npu-rep', 'simt_gather_1d_roofline.npu-rep'],
]

for (const [from, name] of copies) {
  const src = join(root, from)
  assertNotLfsPointer(src)
  copyFileSync(src, join(destDir, name))
  console.log(`synced ${from} -> playground/public/data/${name}`)
}

/** 源码对比 demo: nested container plus the three leaf files. */
const sourceDiffDir = join(destDir, 'source-diff')
mkdirSync(sourceDiffDir, { recursive: true })
for (const name of ['demo.npu-rep', 'left.npu-rep', 'mid.npu-rep', 'right.npu-rep']) {
  const from = `data/source-diff/${name}`
  const src = join(root, from)
  assertNotLfsPointer(src)
  copyFileSync(src, join(sourceDiffDir, name))
  console.log(`synced ${from} -> playground/public/data/source-diff/${name}`)
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
