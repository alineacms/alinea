import {isRecord} from '#/core/util/Objects.js'

export interface Merge {
  value: unknown
  /** Where both sides changed a value differently, keyed by row `_id` */
  conflicts: Array<Array<string>>
}

interface Row {
  _id: string
  _index?: string
}

/**
 * Three-way merge of the changes from `base` to `mine` into `theirs`. Rows
 * of lists and blocks are paired by their `_id`, other arrays merge as a
 * whole. Where both sides changed a value, mine wins and the path is
 * reported. Values that end up as theirs keep their reference.
 */
export function merge(base: unknown, mine: unknown, theirs: unknown): Merge {
  const conflicts = Array<Array<string>>()
  const value = mergeValue(base, mine, theirs, [], conflicts)
  return {value, conflicts}
}

function mergeValue(
  base: unknown,
  mine: unknown,
  theirs: unknown,
  path: Array<string>,
  conflicts: Array<Array<string>>
): unknown {
  if (equal(base, mine) || equal(mine, theirs)) return theirs
  if (isRecord(base) && isRecord(mine) && isRecord(theirs)) {
    const result = {...theirs}
    let changed = false
    const keys = new Set([
      ...Object.keys(base),
      ...Object.keys(mine),
      ...Object.keys(theirs)
    ])
    for (const key of keys) {
      const value = mergeValue(
        base[key],
        mine[key],
        theirs[key],
        [...path, key],
        conflicts
      )
      if (value === theirs[key]) continue
      changed = true
      if (value === undefined) delete result[key]
      else result[key] = value
    }
    return changed ? result : theirs
  }
  if (isRows(base) && isRows(mine) && isRows(theirs))
    return mergeRows(base, mine, theirs, path, conflicts)
  if (!equal(base, theirs)) conflicts.push(path)
  return mine
}

function mergeRows(
  base: Array<Row>,
  mine: Array<Row>,
  theirs: Array<Row>,
  path: Array<string>,
  conflicts: Array<Array<string>>
): Array<Row> {
  const byId = (rows: Array<Row>) => new Map(rows.map(row => [row._id, row]))
  const [baseRows, myRows, theirRows] = [base, mine, theirs].map(byId)
  const ids = new Set([...mine, ...theirs].map(row => row._id))
  const result = Array.from(ids)
    .map(id =>
      mergeValue(
        baseRows.get(id),
        myRows.get(id),
        theirRows.get(id),
        [...path, id],
        conflicts
      )
    )
    .filter(row => row !== undefined) as Array<Row>
  // Rows of a list carry their order, other rows keep mine first
  if (result.every(row => typeof row._index === 'string'))
    result.sort((a, b) => (a._index! < b._index! ? -1 : 1))
  const same =
    result.length === theirs.length &&
    result.every((row, index) => row === theirs[index])
  return same ? theirs : result
}

function isRows(value: unknown): value is Array<Row> {
  return (
    Array.isArray(value) &&
    value.every(item => isRecord(item) && typeof item._id === 'string')
  )
}

export function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((item, i) => equal(item, b[i]))
  if (!isRecord(a) || !isRecord(b)) return false
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) if (!equal(a[key], b[key])) return false
  return true
}
