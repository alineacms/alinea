import {
  rxbCollectChildren,
  rxbFindKey,
  rxbMakeCursor,
  rxbRead,
  rxbResolveStr,
  rxbSeekChild,
  type RxbCursor
} from '@creationix/rx'
import type {RxbEntryRow} from './RxbEntryArtifact.js'
import {rxbIndexValue} from './RxbEntryArtifact.js'

export class RxbEntryCursorStore {
  readonly #root: RxbCursor
  readonly #payload: RxbCursor
  readonly #rowsById: RxbCursor
  readonly #indexes: RxbCursor
  readonly #fieldExact: RxbCursor
  readonly #fieldNumber: RxbCursor
  readonly #leafCache = new Map<string, Array<string>>()

  constructor(readonly bytes: Uint8Array) {
    this.#root = rxbMakeCursor(bytes)
    rxbRead(this.#root)
    this.#payload = cursorAtKey(this.#root, 'payload')
    this.#rowsById = cursorAtKey(this.#payload, 'rowsById')
    this.#indexes = cursorAtKey(this.#payload, 'indexes')
    this.#fieldExact = cursorAtKey(
      cursorAtKey(this.#payload, 'fieldIndexes'),
      'exact'
    )
    this.#fieldNumber = cursorAtKey(
      cursorAtKey(this.#payload, 'fieldIndexes'),
      'number'
    )
  }

  indexRowIds(
    name: string,
    values: ReadonlyArray<string | number | boolean | null>
  ): Array<string> {
    const index = cursorAtKey(this.#indexes, indexName(name))
    if (values.length === 1) {
      return this.#cachedLeaf(`index:${name}:${String(values[0])}`, () => {
        const leaf = optionalCursorAtKey(index, indexLookupValue(values[0]))
        return leaf ? cursorStringArray(leaf) : []
      })
    }
    return uniqueRowIds(
      values.flatMap(value => {
        const leaf = optionalCursorAtKey(index, indexLookupValue(value))
        return leaf ? cursorStringArray(leaf) : []
      })
    )
  }

  activeRowIds(): Array<string> {
    return this.#cachedLeaf('index:active:true', () =>
      cursorStringArray(cursorAtKey(this.#indexes, 'byActive'))
    )
  }

  mainRowIds(): Array<string> {
    return this.#cachedLeaf('index:main:true', () =>
      cursorStringArray(cursorAtKey(this.#indexes, 'byMain'))
    )
  }

  fieldExactRowIds(
    path: string,
    values: ReadonlyArray<string | number | boolean | null>
  ): Array<string> {
    const byPath = optionalCursorAtKey(this.#fieldExact, path)
    if (!byPath) return []
    return uniqueRowIds(
      values.flatMap(value => {
        const key = rxbIndexValue(value)
        return this.#cachedLeaf(`field:${path}:${key}`, () => {
          const leaf = optionalCursorAtKey(byPath, key)
          return leaf ? cursorStringArray(leaf) : []
        })
      })
    )
  }

  fieldNumberRangeRowIds(
    path: string,
    condition: Record<string, unknown>
  ): Array<string> | undefined {
    const index = optionalCursorAtKey(this.#fieldNumber, path)
    if (!index) return
    const gt = typeof condition.gt === 'number' ? condition.gt : undefined
    const gte = typeof condition.gte === 'number' ? condition.gte : undefined
    const lt = typeof condition.lt === 'number' ? condition.lt : undefined
    const lte = typeof condition.lte === 'number' ? condition.lte : undefined
    if (
      gt === undefined &&
      gte === undefined &&
      lt === undefined &&
      lte === undefined
    )
      return
    const start =
      gt !== undefined
        ? upperNumberBound(index, gt)
        : gte !== undefined
          ? lowerNumberBound(index, gte)
          : 0
    const end =
      lt !== undefined
        ? lowerNumberBound(index, lt)
        : lte !== undefined
          ? upperNumberBound(index, lte)
          : cursorLength(index)
    const rowIds = Array<string>()
    const pair = rxbMakeCursor(this.bytes)
    const rowId = rxbMakeCursor(this.bytes)
    for (let i = start; i < end; i++) {
      rxbSeekChild(pair, index, i)
      resolveCursor(pair)
      rxbSeekChild(rowId, pair, 1)
      resolveCursor(rowId)
      rowIds.push(rxbResolveStr(rowId))
    }
    return rowIds
  }

  rowValue(rowId: string, name: keyof RxbEntryRow): unknown {
    const row = cursorAtKey(this.#rowsById, rowId)
    const value = cursorAtKey(row, name)
    return cursorValue(value)
  }

  rowDataValue(rowId: string, path: string): unknown {
    let cursor = cursorAtKey(cursorAtKey(this.#rowsById, rowId), 'data')
    for (const part of path.split('.')) {
      const next = optionalCursorAtKey(cursor, part)
      if (!next) return undefined
      cursor = next
    }
    return cursorValue(cursor)
  }

  #cachedLeaf(key: string, read: () => Array<string>): Array<string> {
    const cached = this.#leafCache.get(key)
    if (cached) return cached
    const value = read()
    this.#leafCache.set(key, value)
    return value
  }
}

function cursorAtKey(container: RxbCursor, key: string): RxbCursor {
  const result = rxbMakeCursor(container.data)
  if (!rxbFindKey(result, container, key)) {
    throw new Error(`Missing RXB cursor key: ${key}`)
  }
  return resolveCursor(result)
}

function optionalCursorAtKey(
  container: RxbCursor,
  key: string
): RxbCursor | undefined {
  const result = rxbMakeCursor(container.data)
  if (!rxbFindKey(result, container, key)) return
  return resolveCursor(result)
}

function cursorStringArray(input: RxbCursor): Array<string> {
  const result = Array<string>()
  const item = rxbMakeCursor(input.data)
  for (let i = 0; i < cursorLength(input); i++) {
    rxbSeekChild(item, input, i)
    resolveCursor(item)
    result.push(rxbResolveStr(item))
  }
  return result
}

function cursorValue(input: RxbCursor): unknown {
  const cursor = resolveCursor(input)
  switch (cursor.tag) {
    case 'true':
      return true
    case 'false':
      return false
    case 'null':
      return null
    case 'undef':
      return undefined
    case 'int':
    case 'float':
      return cursor.val
    case 'str':
    case 'hexstr':
    case 'b64str':
    case 'chain':
      return rxbResolveStr(cursor)
    case 'array': {
      const result = Array<unknown>()
      const item = rxbMakeCursor(cursor.data)
      for (let i = 0; i < cursorLength(cursor); i++) {
        rxbSeekChild(item, cursor, i)
        result.push(cursorValue(resolveCursor(item)))
      }
      return result
    }
    case 'object': {
      const result: Record<string, unknown> = {}
      rxbCollectObject(cursor, (key, value) => {
        result[rxbResolveStr(key)] = cursorValue(value)
      })
      return result
    }
    default:
      return undefined
  }
}

function rxbCollectObject(
  input: RxbCursor,
  visit: (key: RxbCursor, value: RxbCursor) => void
) {
  const pair = rxbMakeCursor(input.data)
  const key = rxbMakeCursor(input.data)
  const value = rxbMakeCursor(input.data)
  for (let i = 0; i < cursorLength(input); i++) {
    rxbSeekChild(pair, input, i)
    resolveCursor(pair)
    rxbSeekChild(key, pair, 0)
    resolveCursor(key)
    rxbSeekChild(value, pair, 1)
    resolveCursor(value)
    visit(key, value)
  }
}

function cursorLength(input: RxbCursor): number {
  if (input.ixWidth > 0) return input.ixCount
  return rxbCollectChildren(input, [])
}

function resolveCursor(input: RxbCursor): RxbCursor {
  while (input.tag === 'ptr') {
    input.right = input.val
    rxbRead(input)
  }
  return input
}

function lowerNumberBound(index: RxbCursor, target: number): number {
  let low = 0
  let high = cursorLength(index)
  const pair = rxbMakeCursor(index.data)
  const score = rxbMakeCursor(index.data)
  while (low < high) {
    const mid = (low + high) >>> 1
    rxbSeekChild(pair, index, mid)
    resolveCursor(pair)
    rxbSeekChild(score, pair, 0)
    resolveCursor(score)
    if (score.val < target) low = mid + 1
    else high = mid
  }
  return low
}

function upperNumberBound(index: RxbCursor, target: number): number {
  let low = 0
  let high = cursorLength(index)
  const pair = rxbMakeCursor(index.data)
  const score = rxbMakeCursor(index.data)
  while (low < high) {
    const mid = (low + high) >>> 1
    rxbSeekChild(pair, index, mid)
    resolveCursor(pair)
    rxbSeekChild(score, pair, 0)
    resolveCursor(score)
    if (score.val <= target) low = mid + 1
    else high = mid
  }
  return low
}

function indexName(name: string): string {
  switch (name) {
    case 'id':
      return 'byId'
    case 'type':
      return 'byType'
    case 'workspace':
      return 'byWorkspace'
    case 'root':
      return 'byRoot'
    case 'locale':
      return 'byLocale'
    case 'status':
      return 'byStatus'
    case 'parent':
      return 'byParent'
    case 'path':
      return 'byPath'
    case 'url':
      return 'byUrl'
    case 'level':
      return 'byLevel'
    default:
      return name
  }
}

function indexLookupValue(value: string | number | boolean | null): string {
  return value === null ? '<null>' : String(value)
}

function uniqueRowIds(values: Array<string>): Array<string> {
  return Array.from(new Set(values))
}
