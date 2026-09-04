import type {EntryAccessPolicy, EntrySyncAccess} from '../entry/Access.js'
import {entrySyncAccess} from '../entry/Access.js'
import type {RuntimeDatabaseIndex, RuntimeIndexEntry} from './Model.js'

export function createRuntimeView(
  index: RuntimeDatabaseIndex,
  policy: EntryAccessPolicy
): RuntimeDatabaseIndex {
  const entries = index.entries.flatMap(entry => {
    const access = entrySyncAccess(policy, entry)
    if (access === 'none') return []
    return [projectEntry(entry, access)]
  })
  return {
    ...index,
    entries,
    source: undefined,
    development: undefined
  }
}

function projectEntry(
  entry: RuntimeIndexEntry,
  access: Exclude<EntrySyncAccess, 'none'>
): RuntimeIndexEntry {
  if (access === 'read') return entry
  const {frames: _frames, urlAliases: _urlAliases, ...explorable} = entry
  return explorable
}
