import {indexDependency, recordDependency} from './Dependency.js'
import type {QueryDependency} from './Dependency.js'
import type {
  FrameDescriptor,
  IndexKey,
  RecordId,
  ReplicaCatalog,
  Revision
} from './Types.js'

export interface ReplicaChangeSet {
  fromRevision: Revision
  toRevision: Revision
  records: ReadonlySet<RecordId>
  indexes: ReadonlySet<IndexKey>
  dependencies: ReadonlySet<QueryDependency>
}

export function diffCatalogs(
  previous: ReplicaCatalog,
  next: ReplicaCatalog
): ReplicaChangeSet {
  const bundleChanged = previous.bundleId !== next.bundleId
  const records = changedKeys(previous.records, next.records, bundleChanged)
  const indexes = changedKeys(previous.indexes, next.indexes, bundleChanged)
  const dependencies = new Set<QueryDependency>()
  for (const id of records) dependencies.add(recordDependency(id))
  for (const key of indexes) dependencies.add(indexDependency(key))
  return {
    fromRevision: previous.revision,
    toRevision: next.revision,
    records,
    indexes,
    dependencies
  }
}

function changedKeys(
  previous: Readonly<Record<string, FrameDescriptor>>,
  next: Readonly<Record<string, FrameDescriptor>>,
  force: boolean
): ReadonlySet<string> {
  const changed = new Set<string>()
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)])
  for (const key of keys) {
    if (force || !sameFrame(previous[key], next[key])) changed.add(key)
  }
  return changed
}

function sameFrame(
  left: FrameDescriptor | undefined,
  right: FrameDescriptor | undefined
): boolean {
  if (!left || !right) return left === right
  return (
    left.id === right.id &&
    left.accessClassId === right.accessClassId &&
    left.cipherHash === right.cipherHash
  )
}
