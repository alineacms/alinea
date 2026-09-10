import {isRecord} from '#/core/util/Objects.js'
import {canonicalJson, hashFieldValue} from '#/core/util/Json.js'
export {canonicalJson, hashFieldValue} from '#/core/util/Json.js'

interface FieldOperationBase {
  /** The SQL entry version identity, not a transient payload hash. */
  recordId: string
  path: string
  baseHash: string | null
}

export type FieldOperation = FieldOperationBase &
  (
    | {kind: 'set'; value: unknown}
    | {kind: 'addSetItem'; itemId: string; value: unknown}
    | {kind: 'removeSetItem'; itemId: string}
    | {kind: 'moveListItem'; itemId: string; position: string}
  )

export interface FieldTransaction {
  id: string
  baseRevision: string
  operations: ReadonlyArray<FieldOperation>
}

export interface FieldConflict {
  recordId: string
  path: string
  expectedHash: string | null
  actualHash: string | null
  localValue: unknown
  remoteValue: unknown
}

export class FieldConflictError extends Error {
  name = 'FieldConflictError'
  constructor(public conflicts: ReadonlyArray<FieldConflict>) {
    super('One or more fields changed remotely')
  }
}

export function pointerSegments(pointer: string): Array<string> {
  if (!pointer.startsWith('/') || pointer.length > 4096)
    throw new Error('Expected a non-root JSON pointer')
  return pointer
    .slice(1)
    .split('/')
    .map(segment => {
      if (/~(?![01])/u.test(segment))
        throw new Error('Invalid JSON pointer escape')
      const decoded = segment.replaceAll('~1', '/').replaceAll('~0', '~')
      if (['__proto__', 'constructor', 'prototype'].includes(decoded))
        throw new Error('Unsafe field path')
      return decoded
    })
}

/** Validate and detach before the first await; caller-owned operations cannot race a commit. */
export function snapshotTransaction(
  transaction: FieldTransaction
): FieldTransaction {
  const result = JSON.parse(canonicalJson(transaction)) as FieldTransaction
  if (
    typeof result.id !== 'string' ||
    !result.id ||
    typeof result.baseRevision !== 'string' ||
    !result.baseRevision ||
    !Array.isArray(result.operations) ||
    result.operations.length === 0 ||
    result.operations.length > 256
  )
    throw new Error('Invalid field transaction')
  const paths = new Map<string, Array<Array<string>>>()
  for (const operation of result.operations) {
    if (
      !isRecord(operation) ||
      typeof operation.recordId !== 'string' ||
      !operation.recordId ||
      typeof operation.path !== 'string' ||
      (operation.baseHash !== null &&
        (typeof operation.baseHash !== 'string' ||
          !/^[a-f0-9]{64}$/.test(operation.baseHash)))
    )
      throw new Error('Invalid field operation')
    const segments = pointerSegments(operation.path)
    const previous = paths.get(operation.recordId) ?? []
    if (
      previous.some(path =>
        path
          .slice(0, Math.min(path.length, segments.length))
          .every((part, index) => part === segments[index])
      )
    )
      throw new Error('Overlapping field operations')
    previous.push(segments)
    paths.set(operation.recordId, previous)
    switch (operation.kind) {
      case 'set':
        if (!Object.hasOwn(operation, 'value'))
          throw new Error('Missing field value')
        break
      case 'addSetItem':
      case 'removeSetItem':
      case 'moveListItem':
        if (typeof operation.itemId !== 'string' || !operation.itemId)
          throw new Error('Missing stable item identity')
        if (
          operation.kind === 'addSetItem' &&
          !Object.hasOwn(operation, 'value')
        )
          throw new Error('Missing item value')
        if (
          operation.kind === 'moveListItem' &&
          (typeof operation.position !== 'string' || !operation.position)
        )
          throw new Error('Missing item position')
        break
      default:
        throw new Error('Unknown field operation')
    }
  }
  return result
}

function valueAt(data: unknown, path: Array<string>): unknown {
  let value = data
  for (const segment of path) {
    if (Array.isArray(value))
      throw new Error('Array offsets are not stable field identities')
    if (!isRecord(value) || !Object.hasOwn(value, segment)) return undefined
    value = value[segment]
  }
  return value
}

function setAt(
  data: Record<string, unknown>,
  path: Array<string>,
  value: unknown
): Record<string, unknown> {
  const [key, ...rest] = path
  const current = Object.hasOwn(data, key) ? data[key] : undefined
  if (rest.length && current !== undefined && !isRecord(current))
    throw new Error('Cannot traverse a non-object field')
  return {
    ...data,
    [key]: rest.length
      ? setAt(isRecord(current) ? current : {}, rest, value)
      : value
  }
}

function applyItem(
  value: unknown,
  operation: Exclude<FieldOperation, {kind: 'set'}>
): unknown {
  if (!Array.isArray(value))
    throw new Error('Item operations require an existing collection')
  const ids = new Set<string>()
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item._id !== 'string' ||
      !item._id ||
      ids.has(item._id)
    )
      throw new Error('Collection items require unique stable identities')
    ids.add(item._id)
  }
  if (operation.kind === 'addSetItem') {
    if (!isRecord(operation.value))
      throw new Error('Collection item must be an object')
    return [
      ...value.filter(item => item._id !== operation.itemId),
      {...operation.value, _id: operation.itemId}
    ]
  }
  if (!ids.has(operation.itemId))
    throw new Error('Collection item no longer exists')
  if (operation.kind === 'removeSetItem')
    return value.filter(item => item._id !== operation.itemId)
  return value.map(item =>
    item._id === operation.itemId ? {...item, _index: operation.position} : item
  )
}

/** All-or-nothing field CAS. Authorize every path before loading values or reporting conflicts.
 * Collection operations retain the branch's whole-collection hash precondition.
 */
export async function applyFieldOperations(
  transaction: FieldTransaction,
  records: ReadonlyMap<string, Record<string, unknown>>,
  authorize: (recordId: string, field: string) => boolean
): Promise<Map<string, Record<string, unknown>>> {
  const request = snapshotTransaction(transaction)
  for (const operation of request.operations)
    if (!authorize(operation.recordId, pointerSegments(operation.path)[0]))
      throw new Error('Field mutation is not authorized')
  const current = new Map<string, Record<string, unknown>>()
  for (const id of new Set(request.operations.map(op => op.recordId))) {
    const data = records.get(id)
    if (!data) throw new Error('Field mutation entry is unavailable')
    current.set(id, JSON.parse(canonicalJson(data)))
  }
  const conflicts: Array<FieldConflict> = []
  for (const operation of request.operations) {
    const data = current.get(operation.recordId)!
    const path = pointerSegments(operation.path)
    const remoteValue = valueAt(data, path)
    const actualHash = await hashFieldValue(remoteValue)
    if (actualHash !== operation.baseHash) {
      conflicts.push({
        recordId: operation.recordId,
        path: operation.path,
        expectedHash: operation.baseHash,
        actualHash,
        remoteValue,
        localValue:
          'value' in operation
            ? operation.value
            : operation.kind === 'moveListItem'
              ? operation.position
              : undefined
      })
      continue
    }
    current.set(
      operation.recordId,
      setAt(
        data,
        path,
        operation.kind === 'set'
          ? operation.value
          : applyItem(remoteValue, operation)
      )
    )
  }
  if (conflicts.length) throw new FieldConflictError(conflicts)
  return current
}
