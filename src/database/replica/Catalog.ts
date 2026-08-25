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
  previous: Readonly<
    Record<string, FrameDescriptor | ReadonlyArray<FrameDescriptor>>
  >,
  next: Readonly<
    Record<string, FrameDescriptor | ReadonlyArray<FrameDescriptor>>
  >,
  force: boolean
): ReadonlySet<string> {
  const changed = new Set<string>()
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)])
  for (const key of keys) {
    if (force || !sameFrames(previous[key], next[key])) changed.add(key)
  }
  return changed
}

function sameFrames(
  left: FrameDescriptor | ReadonlyArray<FrameDescriptor> | undefined,
  right: FrameDescriptor | ReadonlyArray<FrameDescriptor> | undefined
): boolean {
  if (!left || !right) return left === right
  if (isFrameList(left) || isFrameList(right)) {
    if (!isFrameList(left) || !isFrameList(right)) return false
    return (
      left.length === right.length &&
      left.every((frame, index) => sameFrames(frame, right[index]))
    )
  }
  return (
    left.id === right.id &&
    left.bundleId === right.bundleId &&
    left.bundleUrl === right.bundleUrl &&
    left.accessClassId === right.accessClassId &&
    left.cipherHash === right.cipherHash
  )
}

function isFrameList(
  value: FrameDescriptor | ReadonlyArray<FrameDescriptor>
): value is ReadonlyArray<FrameDescriptor> {
  return Array.isArray(value)
}
