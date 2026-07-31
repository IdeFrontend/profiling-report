import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const destDir = join(root, 'playground/public/data')

mkdirSync(destDir, { recursive: true })

const copies = [
  ['data/out.rep', 'out.rep'],
  ['tests/fixtures/out.trace.json', 'out.trace.json'],
]

for (const [from, name] of copies) {
  copyFileSync(join(root, from), join(destDir, name))
  console.log(`synced ${from} -> playground/public/data/${name}`)
}
