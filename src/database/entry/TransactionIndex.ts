import type {Entry, EntryStatus} from '#/core/Entry.js'
import type {
  EntryTransactionIndex,
  EntryTransactionLanguage,
  EntryTransactionNode
} from '#/core/db/EntryTransaction.js'
import type {DatabaseSnapshot} from '../Database.js'
import type {
  AlineaDatabaseRecord,
  EntryCoreRecord,
  EntryPayloadRecord,
  EntryReadRecord,
  EntrySearchRecord
} from './Model.js'

class SnapshotTransactionLanguage
  extends Map<EntryStatus, Entry>
  implements EntryTransactionLanguage
{
  readonly main: Entry
  readonly path: string
  readonly seeded: string | null

  constructor(entries: ReadonlyArray<Entry>) {
    super(entries.map(entry => [entry.status, entry]))
    const main = entries.find(entry => entry.main)
    if (!main) throw new Error('Entry language is missing its main version')
    this.main = main
    this.path = main.path
    this.seeded = main.seeded
  }
}

class SnapshotTransactionNode
  extends Map<string | null, EntryTransactionLanguage>
  implements EntryTransactionNode
{
  readonly id: string
  readonly index: string
  readonly parentId: string | null
  readonly workspace: string
  readonly root: string
  readonly type: string
  parent: SnapshotTransactionNode | null = null

  constructor(entries: ReadonlyArray<Entry>) {
    super()
    const first = entries[0]
    if (!first) throw new Error('Entry node is missing versions')
    this.id = first.id
    this.index = first.index
    this.parentId = first.parentId
    this.workspace = first.workspace
    this.root = first.root
    this.type = first.type
    const languages = new Map<string | null, Array<Entry>>()
    for (const entry of entries) {
      const language = languages.get(entry.locale) ?? []
      language.push(entry)
      languages.set(entry.locale, language)
    }
    for (const [locale, language] of languages)
      this.set(locale, new SnapshotTransactionLanguage(language))
  }
}

/** Source mutation lookup view backed only by normalized database records. */
export class SnapshotTransactionIndex implements EntryTransactionIndex {
  readonly sha: string
  #entries: ReadonlyArray<Entry>
  #nodes = new Map<string, SnapshotTransactionNode>()

  constructor(snapshot: DatabaseSnapshot<AlineaDatabaseRecord>) {
    this.sha = snapshot.revision
    const cores = new Map<string, EntryCoreRecord>()
    const reads = new Map<string, EntryReadRecord>()
    const payloads = new Map<string, EntryPayloadRecord>()
    const searches = new Map<string, EntrySearchRecord>()
    for (const record of snapshot.records()) {
      if (record.kind === 'entry') cores.set(record.id, record)
      else if (record.kind === 'entryRead')
        reads.set(record.entryVersionId, record)
      else if (record.kind === 'payload')
        payloads.set(record.entryVersionId, record)
      else if (record.kind === 'search' && record.audience === 'read')
        searches.set(record.entryVersionId, record)
    }
    const versions = new Map<string, Array<Entry>>()
    const queryable: Array<Entry> = []
    for (const core of cores.values()) {
      const read = reads.get(core.id)
      const payload = payloads.get(core.id)
      if (!read || !payload)
        throw new Error(`Entry version "${core.id}" is missing read records`)
      const physical = entryFromRecords(
        core,
        read,
        payload,
        searches.get(core.id)
      )
      const collection = versions.get(core.entryId) ?? []
      collection.push(physical)
      versions.set(core.entryId, collection)
      if (core.queryable)
        queryable.push({...physical, status: core.status, main: core.main})
    }
    for (const [id, entries] of versions)
      this.#nodes.set(id, new SnapshotTransactionNode(entries))
    for (const node of this.#nodes.values())
      node.parent = node.parentId
        ? (this.#nodes.get(node.parentId) ?? null)
        : null
    this.#entries = queryable.sort(compareEntries)
  }

  byId(id: string): EntryTransactionNode | undefined {
    return this.#nodes.get(id)
  }

  findFirst(filter: (entry: Entry) => boolean): Entry | undefined {
    return this.#entries.find(filter)
  }

  *findMany(filter: (entry: Entry) => boolean): Iterable<Entry> {
    for (const entry of this.#entries) if (filter(entry)) yield entry
  }
}

function entryFromRecords(
  core: EntryCoreRecord,
  read: EntryReadRecord,
  payload: EntryPayloadRecord,
  search: EntrySearchRecord | undefined
): Entry {
  return {
    id: core.entryId,
    status: core.versionStatus,
    title: core.title,
    type: core.type,
    seeded: core.seeded,
    workspace: core.workspace,
    root: core.root,
    level: core.level,
    filePath: read.filePath,
    parentDir: read.parentDir,
    childrenDir: read.childrenDir,
    index: core.index,
    parentId: core.parentId,
    parents: [...core.parents],
    locale: core.locale,
    rowHash: read.rowHash,
    active: core.active,
    main: core.main,
    path: core.path,
    fileHash: read.fileHash,
    url: core.url,
    data: {...payload.data},
    searchableText: search?.searchableText ?? core.title
  }
}

function compareEntries(left: Entry, right: Entry): number {
  return (
    left.index.localeCompare(right.index) ||
    (left.locale ?? '').localeCompare(right.locale ?? '') ||
    statusOrder(left.status) - statusOrder(right.status)
  )
}

function statusOrder(status: EntryStatus): number {
  switch (status) {
    case 'draft':
      return 0
    case 'published':
      return 1
    case 'archived':
      return 2
  }
}
