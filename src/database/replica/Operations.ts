import type {ContentHash, RecordId, Revision} from './Types.js'

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
