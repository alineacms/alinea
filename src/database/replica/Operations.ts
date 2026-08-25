import type {ContentHash, RecordId, Revision} from './Types.js'
import {crypto} from '@alinea/iso'
import {bytesToHex} from '#/core/source/Utils.js'
import {isRecord} from '#/core/util/Objects.js'

export interface FieldOperationBase {
  recordId: RecordId
  path: string
  baseHash: ContentHash | null
}

export interface SetFieldOperation extends FieldOperationBase {
  kind: 'set'
  value: unknown
}

export interface AddSetItemOperation extends FieldOperationBase {
  kind: 'addSetItem'
  itemId: string
  value: unknown
}

export interface RemoveSetItemOperation extends FieldOperationBase {
  kind: 'removeSetItem'
  itemId: string
}

export interface MoveListItemOperation extends FieldOperationBase {
  kind: 'moveListItem'
  itemId: string
  position: string
}

export type FieldOperation =
  | SetFieldOperation
  | AddSetItemOperation
  | RemoveSetItemOperation
  | MoveListItemOperation

export interface FieldTransaction {
  id: string
  baseRevision: Revision
  operations: ReadonlyArray<FieldOperation>
}

export interface FieldConflict {
  recordId: RecordId
  path: string
  expectedHash: ContentHash | null
  actualHash: ContentHash | null
  localValue: unknown
  remoteValue: unknown
}

export interface FieldTransactionResult {
  revision: Revision
  conflicts: ReadonlyArray<FieldConflict>
}

export interface FieldOperationRecord {
  id: RecordId
  data: Readonly<Record<string, unknown>>
}

export interface ApplyFieldOperationsOptions<
  Record extends FieldOperationRecord
> {
  records: ReadonlyMap<RecordId, Record>
  authorize?(record: Record, operation: FieldOperation): boolean
}

export interface AppliedFieldOperations<Record extends FieldOperationRecord> {
  records: ReadonlyMap<RecordId, Record>
  conflicts: ReadonlyArray<FieldConflict>
}

/**
 * Applies operations independently by field path. A stale transaction can
 * still merge changes to untouched paths, while a changed path conflicts.
 */
export async function applyFieldOperations<Record extends FieldOperationRecord>(
  transaction: FieldTransaction,
  options: ApplyFieldOperationsOptions<Record>
): Promise<AppliedFieldOperations<Record>> {
  const current = new Map(options.records)
  const changed = new Map<RecordId, Record>()
  const conflicts: Array<FieldConflict> = []
  for (const operation of transaction.operations) {
    const record = current.get(operation.recordId)
    if (!record) {
      conflicts.push({
        recordId: operation.recordId,
        path: operation.path,
        expectedHash: operation.baseHash,
        actualHash: null,
        localValue: operationValue(operation),
        remoteValue: undefined
      })
      continue
    }
    if (options.authorize && !options.authorize(record, operation))
      throw new Error(`Mutation is not authorized for "${operation.recordId}"`)
    const remoteValue = valueAtPointer(record.data, operation.path)
    const actualHash = await hashFieldValue(remoteValue)
    if (actualHash !== operation.baseHash) {
      conflicts.push({
        recordId: operation.recordId,
        path: operation.path,
        expectedHash: operation.baseHash,
        actualHash,
        localValue: operationValue(operation),
        remoteValue
      })
      continue
    }
    const data = setAtPointer(
      record.data,
      operation.path,
      applyOperation(remoteValue, operation)
    )
    const next = {...record, data} as Record
    current.set(record.id, next)
    changed.set(record.id, next)
  }
  return {records: changed, conflicts}
}

export async function hashFieldValue(
  value: unknown
): Promise<ContentHash | null> {
  if (value === undefined) return null
  const encoded = new TextEncoder().encode(stableStringify(value))
  const digest = await crypto.subtle.digest('SHA-256', encoded as BufferSource)
  return bytesToHex(new Uint8Array(digest))
}

function applyOperation(value: unknown, operation: FieldOperation): unknown {
  switch (operation.kind) {
    case 'set':
      return operation.value
    case 'addSetItem': {
      const source = Array.isArray(value) ? value : []
      const item = isRecord(operation.value)
        ? {...operation.value, _id: operation.itemId}
        : {_id: operation.itemId, value: operation.value}
      return [...source.filter(row => rowId(row) !== operation.itemId), item]
    }
    case 'removeSetItem':
      return Array.isArray(value)
        ? value.filter(row => rowId(row) !== operation.itemId)
        : []
    case 'moveListItem':
      return Array.isArray(value)
        ? value.map(row =>
            rowId(row) === operation.itemId && isRecord(row)
              ? {...row, _index: operation.position}
              : row
          )
        : []
  }
}

function operationValue(operation: FieldOperation): unknown {
  switch (operation.kind) {
    case 'set':
    case 'addSetItem':
      return operation.value
    case 'removeSetItem':
      return undefined
    case 'moveListItem':
      return operation.position
  }
}

function rowId(value: unknown): string | undefined {
  return isRecord(value) && typeof value._id === 'string'
    ? value._id
    : undefined
}

function valueAtPointer(
  data: Readonly<Record<string, unknown>>,
  pointer: string
): unknown {
  let current: unknown = data
  for (const segment of pointerSegments(pointer)) {
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index)) return undefined
      current = current[index]
    } else if (isRecord(current)) {
      current = current[segment]
    } else return undefined
  }
  return current
}

function setAtPointer(
  data: Readonly<Record<string, unknown>>,
  pointer: string,
  value: unknown
): Readonly<Record<string, unknown>> {
  const segments = pointerSegments(pointer)
  if (segments.length === 0) {
    if (!isRecord(value)) throw new Error('The root record must be an object')
    return value
  }
  const set = (current: unknown, offset: number): unknown => {
    const segment = segments[offset]
    const last = offset === segments.length - 1
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index))
        throw new Error(`Invalid array index "${segment}" in "${pointer}"`)
      const result = [...current]
      result[index] = last ? value : set(result[index], offset + 1)
      return result
    }
    const source = isRecord(current) ? current : {}
    return {
      ...source,
      [segment]: last ? value : set(source[segment], offset + 1)
    }
  }
  return set(data, 0) as Readonly<Record<string, unknown>>
}

function pointerSegments(pointer: string): Array<string> {
  if (pointer === '') return []
  if (!pointer.startsWith('/'))
    throw new Error(`Field path must be a JSON pointer: "${pointer}"`)
  return pointer
    .slice(1)
    .split('/')
    .map(segment => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(item => stableStringify(item)).join(',')}]`
  if (isRecord(value))
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
