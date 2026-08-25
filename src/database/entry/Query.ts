import type {Status} from '#/core/Graph.js'
import type {DatabaseSnapshot} from '../Database.js'
import {type DatabaseReader, SnapshotDatabaseReader} from '../Reader.js'
import type {DatabaseIndex, IndexedRecord} from '../SecondaryIndex.js'
import {
  allEntries,
  entriesById,
  entriesByLocation,
  entriesByParent,
  entriesByType,
  type EntryReference,
  parentKey,
  rootKey,
  workspaceKey
} from './Indexes.js'
import {
  type AlineaDatabaseRecord,
  type EntryCoreRecord,
  isEntryCoreRecord
} from './Model.js'

export interface EntryDatabaseQuery {
  id?: string
  parentId?: string | null
  type?: string
  workspace?: string
  root?: string
  locale?: string | null
  status?: Status
  skip?: number
  take?: number
}

export class EntryQueryEngine {
  #reader: DatabaseReader<AlineaDatabaseRecord>

  constructor(
    source:
      | DatabaseReader<AlineaDatabaseRecord>
      | DatabaseSnapshot<AlineaDatabaseRecord>
  ) {
    this.#reader =
      'schema' in source ? new SnapshotDatabaseReader(source) : source
  }

  async count(
    query: EntryDatabaseQuery,
    signal?: AbortSignal
  ): Promise<number> {
    return (await this.#references(query, signal)).length
  }

  async find(
    query: EntryDatabaseQuery,
    signal?: AbortSignal
  ): Promise<ReadonlyArray<EntryCoreRecord>> {
    const references = await this.#references(query, signal)
    const records = await Promise.all(
      references.map(reference => this.#reader.get(reference.id, signal))
    )
    return records.filter(isEntryCoreRecord)
  }

  async #references(
    query: EntryDatabaseQuery,
    signal?: AbortSignal
  ): Promise<ReadonlyArray<IndexedRecord<EntryReference>>> {
    const [index, key] = selectIndex(query)
    const status = query.status ?? 'published'
    const matching: Array<IndexedRecord<EntryReference>> = []
    for await (const item of this.#reader.scan(index, key, signal)) {
      const entry = item.metadata
      if (query.id !== undefined && entry.entryId !== query.id) continue
      if (query.parentId !== undefined && entry.parentId !== query.parentId)
        continue
      if (query.type !== undefined && entry.type !== query.type) continue
      if (query.workspace !== undefined && entry.workspace !== query.workspace)
        continue
      if (query.root !== undefined && entry.root !== query.root) continue
      if (query.locale !== undefined && entry.locale !== query.locale) continue
      if (!matchesStatus(entry, status)) continue
      matching.push(item)
    }
    const skip = Math.max(0, query.skip ?? 0)
    const end =
      query.take === undefined ? undefined : skip + Math.max(0, query.take)
    return matching.slice(skip, end)
  }
}

function selectIndex(
  query: EntryDatabaseQuery
): [DatabaseIndex<AlineaDatabaseRecord, EntryReference>, string] {
  if (query.id !== undefined) return [entriesById, query.id]
  if (typeof query.parentId === 'string')
    return [entriesByParent, parentKey('', '', query.parentId)]
  if (query.parentId === null && query.workspace && query.root)
    return [
      entriesByParent,
      parentKey(query.workspace, query.root, query.parentId)
    ]
  if (query.type !== undefined) return [entriesByType, query.type]
  if (query.workspace && query.root)
    return [entriesByLocation, rootKey(query.workspace, query.root)]
  if (query.workspace) return [entriesByLocation, workspaceKey(query.workspace)]
  return [allEntries, 'all']
}

function matchesStatus(entry: EntryReference, status: Status): boolean {
  switch (status) {
    case 'published':
      return entry.status === 'published'
    case 'draft':
      return entry.status === 'draft'
    case 'archived':
      return entry.status === 'archived'
    case 'preferDraft':
      return entry.active
    case 'preferPublished':
      return entry.main
    case 'all':
      return true
  }
}
