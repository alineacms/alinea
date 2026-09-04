import type {Entry} from '#/core/Entry.js'
import type {Mutation} from '#/core/db/Mutation.js'
import type {EntryStore} from '../entry/Store.js'
import type {RuntimeDatabaseIndex, RuntimeIndexEntry} from './Model.js'

/**
 * Opens only the entry payloads a requested mutation can inspect or rewrite.
 */
export async function loadTransactionPayloads(
  index: RuntimeDatabaseIndex,
  store: EntryStore,
  mutations: ReadonlyArray<Mutation>
): Promise<ReadonlyMap<string, Entry>> {
  const requested = transactionPayloads(index.entries, mutations)
  const requestedEntries = [...requested.values()]
  const loaded = await store.loadMany(requestedEntries)
  const loadedByVersion = new Map<string, Entry>()
  for (const [position, core] of requestedEntries.entries()) {
    const entry = loaded[position]
    if (entry) loadedByVersion.set(core.id, entry)
  }
  return loadedByVersion
}

function transactionPayloads(
  entries: ReadonlyArray<RuntimeIndexEntry>,
  mutations: ReadonlyArray<Mutation>
): Map<string, RuntimeIndexEntry> {
  const requested = new Map<string, RuntimeIndexEntry>()
  const request = (entry: RuntimeIndexEntry | undefined) => {
    if (entry?.frames?.data) requested.set(entry.id, entry)
  }
  const requestId = (id: string) => {
    for (const entry of entries) if (entry.entryId === id) request(entry)
  }

  for (const mutation of mutations) {
    switch (mutation.op) {
      case 'create':
        if (mutation.id) requestId(mutation.id)
        break
      case 'update':
      case 'publish':
        requestId(mutation.id)
        break
      case 'unpublish':
      case 'archive':
        break
      case 'remove': {
        const removed = entries.filter(entry => entry.entryId === mutation.id)
        const removesLibrary = removed.some(
          entry => entry.type === 'MediaLibrary'
        )
        for (const entry of removed)
          if (entry.type === 'MediaFile') request(entry)
        if (removesLibrary)
          for (const entry of entries)
            if (
              entry.type === 'MediaFile' &&
              entry.parents.includes(mutation.id)
            )
              request(entry)
        break
      }
      case 'move': {
        requestId(mutation.id)
        const moved = entries.find(entry => entry.entryId === mutation.id)
        const target = entries.find(entry => entry.entryId === mutation.target)
        const parentId =
          mutation.targetType === 'root'
            ? null
            : mutation.dropPosition === 'on'
              ? mutation.target
              : (target?.parentId ?? null)
        const root =
          mutation.targetType === 'root'
            ? mutation.target
            : (target?.root ?? moved?.root)
        const workspace = target?.workspace ?? moved?.workspace
        const structural =
          moved && (moved.parentId !== parentId || moved.root !== root)
        if (structural)
          for (const entry of entries)
            if (
              entry.queryable &&
              entry.status === 'published' &&
              (entry.entryId === mutation.id ||
                entry.parents.includes(mutation.id))
            )
              request(entry)

        const siblings = entries.filter(
          entry =>
            entry.queryable &&
            entry.workspace === workspace &&
            entry.root === root &&
            entry.parentId === parentId &&
            entry.entryId !== mutation.id
        )
        const seen = new Set<string>()
        if (
          siblings.some(entry => {
            const duplicate = seen.has(entry.index)
            seen.add(entry.index)
            return duplicate
          })
        )
          for (const sibling of siblings) requestId(sibling.entryId)
        break
      }
      case 'removeFile':
      case 'uploadFile':
        break
    }
  }
  return requested
}
