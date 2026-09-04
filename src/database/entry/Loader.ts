import type {Entry} from '#/core/Entry.js'
import type {DatabaseReader} from '../Reader.js'
import {
  entryReadsByVersion,
  searchesByVersion,
  searchVersionKey
} from './Indexes.js'
import {
  type AlineaDatabaseRecord,
  type EntryCoreRecord,
  type EntryReadRecord,
  type EntrySearchRecord,
  isEntryPayloadRecord,
  isEntryReadRecord,
  isEntrySearchRecord
} from './Model.js'

export class EntryLoader {
  #reader: DatabaseReader<AlineaDatabaseRecord>
  #entries = new Map<string, Promise<Entry | undefined>>()

  constructor(reader: DatabaseReader<AlineaDatabaseRecord>) {
    this.#reader = reader
  }

  load(
    core: EntryCoreRecord,
    signal?: AbortSignal
  ): Promise<Entry | undefined> {
    let pending = this.#entries.get(core.id)
    if (!pending) {
      pending = this.#load(core, signal)
      this.#entries.set(core.id, pending)
    }
    return pending
  }

  async read(
    core: EntryCoreRecord,
    signal?: AbortSignal
  ): Promise<EntryReadRecord | undefined> {
    for await (const reference of this.#reader.scan(
      entryReadsByVersion,
      core.id,
      signal
    )) {
      const record = await this.#reader.get(reference.metadata.recordId, signal)
      if (isEntryReadRecord(record)) return record
    }
  }

  async search(
    core: EntryCoreRecord,
    audience: 'explore' | 'read',
    signal?: AbortSignal
  ): Promise<EntrySearchRecord | undefined> {
    for await (const reference of this.#reader.scan(
      searchesByVersion,
      searchVersionKey(core.id, audience),
      signal
    )) {
      const record = await this.#reader.get(reference.metadata.recordId, signal)
      if (isEntrySearchRecord(record)) return record
    }
  }

  async #load(
    core: EntryCoreRecord,
    signal?: AbortSignal
  ): Promise<Entry | undefined> {
    const read = await this.read(core, signal)
    if (!read) {
      return {
        id: core.entryId,
        versionStatus: core.versionStatus,
        status: core.status,
        title: core.title,
        type: core.type,
        seeded: core.seeded,
        workspace: core.workspace,
        root: core.root,
        level: core.level,
        filePath: '',
        parentDir: '',
        childrenDir: '',
        index: core.index,
        parentId: core.parentId,
        parents: [...core.parents],
        locale: core.locale,
        rowHash: '',
        active: core.active,
        main: core.main,
        path: core.path,
        fileHash: '',
        url: core.url,
        data: {},
        searchableText: ''
      }
    }
    const payload = await this.#reader.get(read.payloadId, signal)
    if (!isEntryPayloadRecord(payload)) return undefined
    return {
      id: core.entryId,
      versionStatus: core.versionStatus,
      status: core.status,
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
      data: payload.data,
      searchableText: ''
    }
  }
}
