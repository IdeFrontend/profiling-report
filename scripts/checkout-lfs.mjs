/**
 * Replace Git LFS pointers under data/ with the objects they name.
 * The Vercel build image has the pointer files and no git-lfs binary.
 * This repo is public, so the GitHub LFS batch API serves the bytes.
 */
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { closeSync, openSync, readdirSync, readSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const POINTER_PREFIX = 'version https://git-lfs.github.com/spec/v1'

function repoSlug() {
  const owner = process.env.VERCEL_GIT_REPO_OWNER
  const slug = process.env.VERCEL_GIT_REPO_SLUG
  if (owner && slug) return `${owner}/${slug}`
  try {
    const url = execSync('git remote get-url origin', { encoding: 'utf8' }).trim()
    const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/)
    if (match) return `${match[1]}/${match[2]}`
  } catch {
    // no git remote — caller must be on Vercel, where the env vars are set
  }
  throw new Error('checkout-lfs: cannot tell which GitHub repo holds the LFS objects')
}

function readPointer(path) {
  const fd = openSync(path, 'r')
  const buf = Buffer.alloc(256)
  let n = 0
  try {
    n = readSync(fd, buf, 0, buf.length, 0)
  } finally {
    closeSync(fd)
  }
  const text = buf.toString('utf8', 0, n)
  if (!text.startsWith(POINTER_PREFIX)) return null
  const oid = text.match(/^oid sha256:([a-f0-9]{64})/m)
  const size = text.match(/^size (\d+)/m)
  if (!oid || !size) {
    throw new Error(`checkout-lfs: ${path} is an LFS pointer with no oid or size`)
  }
  return { path, oid: oid[1], size: Number(size[1]) }
}

function listFiles(dir) {
  const out = []
  let names
  try {
    names = readdirSync(dir)
  } catch (err) {
    if (err && err.code === 'ENOENT') return out
    throw err
  }
  for (const name of names) {
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) out.push(...listFiles(path))
    else if (st.isFile()) out.push(path)
  }
  return out
}

export async function materializeLfsPointers(root, repo) {
  const pointers = listFiles(join(root, 'data')).map(readPointer).filter(Boolean)
  if (pointers.length === 0) return 0

  const res = await fetch(`https://github.com/${repo}.git/info/lfs/objects/batch`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.git-lfs+json',
      'Content-Type': 'application/vnd.git-lfs+json',
    },
    body: JSON.stringify({
      operation: 'download',
      transfers: ['basic'],
      objects: pointers.map((p) => ({ oid: p.oid, size: p.size })),
    }),
  })
  if (!res.ok) {
    throw new Error(`checkout-lfs: GitHub LFS batch failed (${res.status}) for ${repo}`)
  }
  const body = await res.json()
  const byOid = new Map()
  for (const obj of body.objects ?? []) byOid.set(obj.oid, obj)

  for (const pointer of pointers) {
    const obj = byOid.get(pointer.oid)
    const href = obj?.actions?.download?.href
    if (!href) {
      const detail = obj?.error?.message || 'no download action'
      throw new Error(`checkout-lfs: ${pointer.path} oid ${pointer.oid}: ${detail}`)
    }
    const file = await fetch(href)
    if (!file.ok) {
      throw new Error(`checkout-lfs: download failed (${file.status}) for ${pointer.path}`)
    }
    const bytes = Buffer.from(await file.arrayBuffer())
    const hash = createHash('sha256').update(bytes).digest('hex')
    if (bytes.length !== pointer.size || hash !== pointer.oid) {
      throw new Error(
        `checkout-lfs: ${pointer.path} oid mismatch (got ${bytes.length} bytes, sha256 ${hash})`,
      )
    }
    writeFileSync(pointer.path, bytes)
    console.log(`checkout-lfs: ${pointer.path} (${bytes.length} bytes)`)
  }
  return pointers.length
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  const root = dirname(dirname(fileURLToPath(import.meta.url)))
  materializeLfsPointers(root, repoSlug()).catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
