import {
  Config,
  createError,
  docFromEntry,
  Entry,
  entryFromDoc,
  EntryStatus,
  Schema
} from '@alinea/core'
import {Search} from '@alinea/core/Search'
import convertHrtime from 'convert-hrtime'
import {Store} from 'helder.store'
import {SqliteStore} from 'helder.store/sqlite/SqliteStore.js'
import prettyMilliseconds from 'pretty-ms'
import * as Y from 'yjs'
import {Data} from './Data'
import {parentUrl, walkUrl} from './util/Urls'

export namespace Cache {
  function indexSearch(store: Store, entry: Entry) {
    // Todo: unroll languages
    const row = {id: entry.id, title: String(entry.title)}
    const condition = Search.where(Search.id.is(entry.id))
    const existing = store.first(condition)
    //if (existing) store.update(condition, row)
    if (!existing) store.insert(Search, row)
  }

  export async function create(store: SqliteStore, from: Data.Source) {
    const startTime = process.hrtime.bigint()
    console.log('Start indexing...')
    store.delete(Entry)
    store.createFts5Table(Search, 'Search', () => {
      return {title: Search.title}
    })
    let total = 0
    for await (const entry of from.entries()) {
      total++
      store.insert(Entry, entry)
      indexSearch(store, entry)
    }
    store.createIndex(Entry, 'root', [Entry.root])
    store.createIndex(Entry, 'workspace.type', [Entry.workspace, Entry.type])
    store.createIndex(Entry, 'url', [Entry.url])
    store.createIndex(Entry, 'parent', [Entry.parent])
    const diff = process.hrtime.bigint() - startTime
    console.log(
      `Done indexing ${total} entries in ${prettyMilliseconds(
        convertHrtime(diff).milliseconds
      )}`
    )
  }

  function computeEntry(store: Store, config: Config | Schema, entry: Entry) {
    const type =
      config instanceof Config
        ? config.type(entry.workspace, entry.type)
        : config.type(entry.type)
    if (!type) throw createError(400, 'Type not found')
    const parents = walkUrl(parentUrl(entry.url)).map(url => {
      const parent = store.first(
        Entry.where(Entry.workspace.is(entry.workspace))
          .where(Entry.root.is(entry.root))
          .where(Entry.url.is(url))
          .select({id: Entry.id})
      )
      if (!parent) throw createError(400, 'Parent not found')
      return parent.id
    })
    return {
      ...entry,
      parent: parents[parents.length - 1],
      parents: parents,
      $isContainer: type!.options.isContainer,
      $status: EntryStatus.Draft
    }
  }

  export function applyUpdates(
    store: Store,
    config: Config | Schema,
    updates: Array<{id: string; update: Uint8Array}>
  ) {
    for (const {id, update} of updates) {
      const condition = Entry.where(Entry.id.is(id))
      const existing = store.first(condition)
      const doc = new Y.Doc()
      if (existing) docFromEntry(config, existing, doc)
      Y.applyUpdate(doc, update)
      const data = entryFromDoc(config, doc)
      const entry = computeEntry(store, config, data)
      if (existing) store.update(condition, entry)
      else store.insert(Entry, entry)
      indexSearch(store, entry)
    }
  }

  export function applyPublish(
    store: Store,
    config: Config | Schema,
    entries: Array<Entry>
  ) {
    return store.transaction(() => {
      for (const data of entries) {
        const entry = computeEntry(store, config, data)
        const condition = Entry.where(Entry.id.is(entry.id))
        const existing = store.first(condition)
        if (existing) store.update(condition, entry)
        else store.insert(Entry, entry)
        indexSearch(store, entry)
      }
    })
  }
}
