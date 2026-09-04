import type {EntryAccessPolicy, EntrySyncAccess} from '../entry/Access.js'
import {entrySyncAccess} from '../entry/Access.js'
import type {RuntimeDatabaseIndex, RuntimeIndexEntry} from './Model.js'
import type {RuntimeDelta} from './Snapshot.js'

export function createRuntimeView(
  index: RuntimeDatabaseIndex,
  policy: EntryAccessPolicy
): RuntimeDatabaseIndex {
  const entries = index.entries.flatMap(entry => {
    const access = entrySyncAccess(policy, entry)
    if (access === 'none') return []
    return [projectRuntimeEntry(entry, access)]
  })
  return {
    ...index,
    entries,
    source: undefined,
    development: undefined
  }
}

export function projectRuntimeEntry(
  entry: RuntimeIndexEntry,
  access: Exclude<EntrySyncAccess, 'none'>
): RuntimeIndexEntry {
  if (access === 'read') return entry
  const {frames: _frames, urlAliases: _urlAliases, ...explorable} = entry
  return explorable
}

export function createRuntimeDeltaView(
  delta: RuntimeDelta,
  policy: EntryAccessPolicy
): RuntimeDelta {
  const entries: Array<RuntimeDelta['entries'][number]> = []
  for (const change of delta.entries) {
    if (change.op === 'remove') {
      if (
        change.previous &&
        entrySyncAccess(policy, change.previous) === 'none'
      )
        continue
      entries.push({op: 'remove', id: change.id, entryId: change.entryId})
      continue
    }
    const access = entrySyncAccess(policy, change.entry)
    if (access !== 'none') {
      entries.push({
        op: 'set',
        entry: projectRuntimeEntry(change.entry, access)
      })
      continue
    }
    if (change.previous && entrySyncAccess(policy, change.previous) !== 'none')
      entries.push({
        op: 'remove',
        id: change.entry.id,
        entryId: change.entry.entryId
      })
  }
  return {
    ...delta,
    entries,
    source: undefined,
    development: undefined
  }
}
