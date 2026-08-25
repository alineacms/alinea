import type {DatabaseSnapshot} from '../Database.js'
import {exploreAccessClass, readAccessClass} from '../entry/Release.js'
import {selectEntryForSync, type EntryAccessPolicy} from '../entry/Access.js'
import {type AlineaDatabaseRecord, isEntryCoreRecord} from '../entry/Model.js'
import type {HandlerKeyCatalog} from '../release/Exporter.js'
import type {
  AccessClassId,
  ReplicaCatalog,
  ReplicaState,
  ViewId
} from '../replica/Types.js'
import {projectReplicaState} from './Projection.js'

export interface ProjectEntryReplicaStateOptions {
  viewId: ViewId
  policy: EntryAccessPolicy
  snapshot: DatabaseSnapshot<AlineaDatabaseRecord>
  catalog: ReplicaCatalog
  keys: HandlerKeyCatalog
}

/** Evaluates one effective user policy without recompiling or parsing source. */
export function projectEntryReplicaState(
  options: ProjectEntryReplicaStateOptions
): ReplicaState {
  const accessClasses = new Set<AccessClassId>()
  const recordAccess: Record<string, 'explore' | 'read'> = {}
  const entryByVersion = new Map<string, string>()
  for (const record of options.snapshot.records())
    if (isEntryCoreRecord(record)) entryByVersion.set(record.id, record.entryId)
  const recordEntries: Record<string, ReadonlyArray<string>> = {}
  for (const record of options.snapshot.records()) {
    const affected = affectedEntries(record, entryByVersion)
    if (affected.length > 0) recordEntries[record.id] = affected
    if (!isEntryCoreRecord(record)) continue
    const selection = selectEntryForSync(options.policy, record)
    if (selection.access === 'none') continue
    accessClasses.add(exploreAccessClass(record.id))
    recordAccess[record.id] = selection.access
    if (selection.access === 'read')
      accessClasses.add(readAccessClass(record.id))
  }
  return projectReplicaState({
    viewId: options.viewId,
    catalog: options.catalog,
    keys: options.keys,
    accessClasses,
    recordAccess,
    recordEntries
  })
}

function affectedEntries(
  record: AlineaDatabaseRecord,
  entryByVersion: ReadonlyMap<string, string>
): ReadonlyArray<string> {
  switch (record.kind) {
    case 'entry':
      return [record.entryId]
    case 'entryRead':
    case 'payload':
    case 'search': {
      const entryId = entryByVersion.get(record.entryVersionId)
      return entryId ? [entryId] : []
    }
    case 'link':
      return [...new Set([record.sourceEntryId, record.targetId])]
  }
}
