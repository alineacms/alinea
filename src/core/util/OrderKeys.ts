import {generateNKeysBetween, isValidOrderKey} from './FractionalIndexing.js'
import {isRecord} from './Objects.js'

/** The value as a fractional order key, if it is a valid one */
export function orderKey(value: unknown): string | undefined {
  return typeof value === 'string' && isValidOrderKey(value) ? value : undefined
}

/** Positions of the longest run of strictly increasing keys */
function increasingKeys(keys: Array<string | undefined>): Set<number> {
  const length = keys.map(() => 0)
  const previous = keys.map(() => -1)
  let best = -1
  keys.forEach((key, at) => {
    if (key === undefined) return
    length[at] = 1
    for (let before = 0; before < at; before++) {
      const candidate = keys[before]
      if (
        candidate !== undefined &&
        candidate < key &&
        length[before] + 1 > length[at]
      ) {
        length[at] = length[before] + 1
        previous[at] = before
      }
    }
    if (best === -1 || length[at] > length[best]) best = at
  })
  const keep = new Set<number>()
  for (let at = best; at !== -1; at = previous[at]) keep.add(at)
  return keep
}

/**
 * Give list rows an `_index` order key between their neighbours where they
 * have none, or where their key is out of order. Rows whose keys are in order
 * keep them. Positions in `rekey` (inserted or moved rows) always receive a
 * new key between their neighbours. Items that are not records with an
 * `_index` property (content written by hand, rich text nodes, scalars) are
 * left as they are. Returns the input array if nothing changed.
 */
export function withOrderKeys<Row>(
  rows: Array<Row>,
  rekey: ReadonlySet<number> = new Set()
): Array<Row> {
  const indexed = rows.flatMap((row, at) =>
    isRecord(row) && '_index' in row ? [at] : []
  )
  const keys = indexed.map(at =>
    rekey.has(at)
      ? undefined
      : orderKey((rows[at] as Record<string, unknown>)._index)
  )
  const keep = increasingKeys(keys)
  if (keep.size === indexed.length) return rows
  const result = [...rows]
  let from = 0
  while (from < indexed.length) {
    if (keep.has(from)) {
      from++
      continue
    }
    let to = from
    while (to < indexed.length && !keep.has(to)) to++
    const generated = generateNKeysBetween(
      from > 0 ? keys[from - 1]! : null,
      to < indexed.length ? keys[to]! : null,
      to - from
    )
    for (let at = from; at < to; at++)
      result[indexed[at]] = {
        ...rows[indexed[at]],
        _index: generated[at - from]
      }
    from = to
  }
  return result
}
