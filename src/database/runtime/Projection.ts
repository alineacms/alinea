import type {EntryAccessPolicy, EntrySyncAccess} from '../entry/Access.js'
import {selectEntryForSync} from '../entry/Access.js'
import type {RuntimeDatabaseIndex, RuntimeIndexEntry} from './Model.js'

export interface RuntimeDatabaseView {
  index: RuntimeDatabaseIndex
  access: Readonly<Record<string, Exclude<EntrySyncAccess, 'none'>>>
}

export function projectRuntimeDatabase(
  index: RuntimeDatabaseIndex,
  policy: EntryAccessPolicy
): RuntimeDatabaseView {
  const access: Record<string, Exclude<EntrySyncAccess, 'none'>> = {}
  const entries = index.entries.flatMap(entry => {
    const selection = selectEntryForSync(policy, entry)
    if (selection.access === 'none') return []
    access[entry.id] = selection.access
    return [projectEntry(entry, selection.access)]
  })
  return {
    index: {
      ...index,
      entries,
      children: projectChildren(entries),
      source: undefined,
      development: undefined
    },
    access
  }
}

function projectEntry(
  entry: RuntimeIndexEntry,
  access: Exclude<EntrySyncAccess, 'none'>
): RuntimeIndexEntry {
  if (access === 'read') return entry
  const {frames: _frames, ...explorable} = entry
  return explorable
}

function projectChildren(
  entries: ReadonlyArray<RuntimeIndexEntry>
): Record<string, ReadonlyArray<string>> {
  const visible = new Set(entries.map(entry => entry.entryId))
  const children: Record<string, Array<string>> = {}
  for (const entry of entries) {
    const key =
      entry.parentId && visible.has(entry.parentId) ? entry.parentId : ''
    ;(children[key] ??= []).push(entry.id)
  }
  return children
}
