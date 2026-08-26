import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const destDir = join(root, 'playground/public/data')

mkdirSync(destDir, { recursive: true })

/** Canonical fixtures live under data/; playground copies are generated (gitignored). */
const copies = [
  ['data/out.rep', 'out.rep'],
  ['data/out.trace.json', 'out.trace.json'],
  ['data/example.npu.rep', 'example.rep'],
  ['data/sample.lite.rep', 'sample.lite.rep'],
  ['data/ffn_dense.trace.json', 'ffn_dense.trace.json'],
]

for (const [from, name] of copies) {
  copyFileSync(join(root, from), join(destDir, name))
  console.log(`synced ${from} -> playground/public/data/${name}`)
}
