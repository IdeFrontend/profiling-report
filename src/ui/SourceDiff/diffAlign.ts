/**
 * Line alignment for the 源码对比 (source diff) surface.
 *
 * Mirrors `AlignedDiffMapping` in `@sudu-ide/code-review`: each changed hunk
 * occupies max(lenL, lenR) view rows, and the shorter side gets filler rows so
 * both columns stay on one line grid. Pure data — no Vue, no Sudu import.
 */

export type DiffRowKind = 'same' | 'changed' | 'onlyLeft' | 'onlyRight'

export interface DiffRow {
  kind: DiffRowKind
  /** 1-based source line in the left text; null on a filler row. */
  leftLine: number | null
  /** 1-based source line in the right text; null on a filler row. */
  rightLine: number | null
  leftText: string
  rightText: string
}

/** Cells above this LCS table size fall back to the cheap hunk rule. */
const LCS_CELL_LIMIT = 4_000_000

/** First operator id that is not the current one; '' when the pack has a single op. */
export function pickBaselineOperatorId(
  operators: readonly { id: string }[] | undefined,
  currentId: string | null | undefined,
): string {
  return operators?.find((op) => op.id !== currentId)?.id ?? ''
}

/** Split editor text into lines; a trailing newline does not add a phantom row. */
export function splitSourceLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split(/\r?\n/)
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** Indices (into `rows`) of every row with the given kind. */
export function diffRowsByKind(rows: DiffRow[], kind: DiffRowKind): number[] {
  const out: number[] = []
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].kind === kind) out.push(i)
  }
  return out
}

export function alignSourceLines(left: string[], right: string[]): DiffRow[] {
  if (left.length * right.length > LCS_CELL_LIMIT) return alignWithoutLcs(left, right)

  const lcs = lcsSuffixTable(left, right)
  const rows: DiffRow[] = []
  const pendingLeft: number[] = []
  const pendingRight: number[] = []

  const flush = (): void => {
    const count = Math.max(pendingLeft.length, pendingRight.length)
    for (let k = 0; k < count; k += 1) {
      const hasLeft = k < pendingLeft.length
      const hasRight = k < pendingRight.length
      rows.push({
        kind: hasLeft && hasRight ? 'changed' : hasLeft ? 'onlyLeft' : 'onlyRight',
        leftLine: hasLeft ? pendingLeft[k] + 1 : null,
        rightLine: hasRight ? pendingRight[k] + 1 : null,
        leftText: hasLeft ? left[pendingLeft[k]] : '',
        rightText: hasRight ? right[pendingRight[k]] : '',
      })
    }
    pendingLeft.length = 0
    pendingRight.length = 0
  }

  let li = 0
  let ri = 0
  while (li < left.length && ri < right.length) {
    if (left[li] === right[ri]) {
      flush()
      rows.push({
        kind: 'same',
        leftLine: li + 1,
        rightLine: ri + 1,
        leftText: left[li],
        rightText: right[ri],
      })
      li += 1
      ri += 1
      continue
    }
    const stride = right.length + 1
    if (lcs[(li + 1) * stride + ri] >= lcs[li * stride + ri + 1]) {
      pendingLeft.push(li)
      li += 1
    } else {
      pendingRight.push(ri)
      ri += 1
    }
  }
  while (li < left.length) pendingLeft.push(li++);
  while (ri < right.length) pendingRight.push(ri++);
  flush()
  return rows
}

/** dp[i][j] = LCS length of left[i..] and right[j..]. */
function lcsSuffixTable(left: string[], right: string[]): Uint32Array {
  const stride = right.length + 1
  const dp = new Uint32Array((left.length + 1) * stride)
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      dp[i * stride + j] =
        left[i] === right[j]
          ? dp[(i + 1) * stride + j + 1] + 1
          : Math.max(dp[(i + 1) * stride + j], dp[i * stride + j + 1])
    }
  }
  return dp
}

/**
 * shortcut: inputs above LCS_CELL_LIMIT skip LCS — prefix/suffix matches plus one
 * big middle hunk. Upgrade path: Myers diff with a linear-space divide-and-conquer
 * bisect when diffs of multi-megabyte files need tighter hunks.
 */
function alignWithoutLcs(left: string[], right: string[]): DiffRow[] {
  const rows: DiffRow[] = []
  const maxPrefix = Math.min(left.length, right.length)
  let prefix = 0
  while (prefix < maxPrefix && left[prefix] === right[prefix]) prefix += 1

  let suffix = 0
  while (
    suffix < maxPrefix - prefix &&
    left[left.length - 1 - suffix] === right[right.length - 1 - suffix]
  ) {
    suffix += 1
  }

  for (let i = 0; i < prefix; i += 1) {
    rows.push({ kind: 'same', leftLine: i + 1, rightLine: i + 1, leftText: left[i], rightText: left[i] })
  }

  const leftEnd = left.length - suffix
  const rightEnd = right.length - suffix
  const leftCount = leftEnd - prefix
  const rightCount = rightEnd - prefix
  const middle = Math.max(leftCount, rightCount)
  for (let k = 0; k < middle; k += 1) {
    const hasLeft = k < leftCount
    const hasRight = k < rightCount
    const leftIndex = prefix + k
    const rightIndex = prefix + k
    rows.push({
      kind: hasLeft && hasRight ? 'changed' : hasLeft ? 'onlyLeft' : 'onlyRight',
      leftLine: hasLeft ? leftIndex + 1 : null,
      rightLine: hasRight ? rightIndex + 1 : null,
      leftText: hasLeft ? left[leftIndex] : '',
      rightText: hasRight ? right[rightIndex] : '',
    })
  }

  for (let i = 0; i < suffix; i += 1) {
    const leftIndex = leftEnd + i
    const rightIndex = rightEnd + i
    rows.push({
      kind: 'same',
      leftLine: leftIndex + 1,
      rightLine: rightIndex + 1,
      leftText: left[leftIndex],
      rightText: right[rightIndex],
    })
  }
  return rows
}
