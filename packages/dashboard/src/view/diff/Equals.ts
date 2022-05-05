export function equals(a: any, b: any) {
  if (a === b) return true
  if (!a || !b) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!equals(a[i], b[i])) return false
    }
    return true
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const keys = Object.keys(a)
    if (keys.length !== Object.keys(b).length) return false
    for (const key of keys) {
      if (!equals(a[key], b[key])) return false
    }
    return true
  }
  return false
}

// Source: https://github.com/florian/diff-tool/blob/15b1570ffa2b5750bae444f1f64ac7a9706c5539/react/differ.js#L13
export function computeLcs<T>(
  a: Array<T>,
  b: Array<T>,
  equals: (valueA: T, valueB: T) => boolean
): Array<Array<number>> {
  const n = a.length
  const m = b.length
  const lcs: Array<Array<number>> = Array.from(Array(n + 1), () => Array(m + 1))
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      if (i == 0 || j == 0) {
        lcs[i][j] = 0
      } else if (equals(a[i - 1], b[j - 1])) {
        lcs[i][j] = 1 + lcs[i - 1][j - 1]
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1])
      }
    }
  }
  return lcs
}

export type Change<T> =
  | {type: 'addition'; value: T}
  | {type: 'removal'; value: T}
  | {type: 'unchanged'; old: T; value: T}

export function diffList<T>(
  a: Array<T>,
  b: Array<T>,
  equals: (a: T, b: T) => boolean
): Array<Change<T>> {
  const lcs = computeLcs(a, b, equals)
  const results: Array<Change<T>> = []

  let i = a.length
  let j = b.length
  while (i !== 0 || j !== 0) {
    if (i === 0) {
      results.push({type: 'addition', value: b[j - 1]})
      j -= 1
    } else if (j === 0) {
      results.push({type: 'removal', value: a[i - 1]})
      i -= 1
    } else if (equals(a[i - 1], b[j - 1])) {
      results.push({type: 'unchanged', old: a[i - 1], value: b[j - 1]})
      i -= 1
      j -= 1
    } else if (lcs[i - 1][j] <= lcs[i][j - 1]) {
      results.push({type: 'addition', value: b[j - 1]})
      j -= 1
    } else {
      results.push({type: 'removal', value: a[i - 1]})
      i -= 1
    }
  }
  return results.reverse()
}
