import {
  Config,
  createError,
  docFromEntry,
  Entry,
  entryFromDoc,
  EntryStatus,
  Schema
} from '@alinea/core'
import convertHrtime from 'convert-hrtime'
import {Store} from 'helder.store'
import prettyMilliseconds from 'pretty-ms'
import * as Y from 'yjs'
import {Data} from './Data'

export class Cache {
  static async create(store: Store, from: Data.Source) {
    const startTime = process.hrtime.bigint()
    console.log('Start indexing...')
    store.delete(Entry)
    let total = 0
    for await (const entry of from.entries()) {
      total++
      store.insert(Entry, entry)
    }
    store.createIndex(Entry, 'root', [Entry.root])
    store.createIndex(Entry, 'workspace.type', [Entry.workspace, Entry.type])
    store.createIndex(Entry, 'url', [Entry.url])
    store.createIndex(Entry, 'parent', [Entry.$parent])
    const diff = process.hrtime.bigint() - startTime
    console.log(
      `Done indexing ${total} entries in ${prettyMilliseconds(
        convertHrtime(diff).milliseconds
      )}`
    )
  }

  static applyUpdates(
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
      const type =
        config instanceof Config
          ? config.type(data.workspace, data.type)
          : config.type(data.type)
      if (!type) throw createError(400, 'Type not found')
      function stripLast(path: string) {
        const last = path.lastIndexOf('/')
        if (last > -1) return path.substring(0, last) || '/'
        return path
      }
      const parent =
        data.url === '/'
          ? undefined
          : store.first(
              Entry.where(Entry.workspace.is(data.workspace))
                .where(Entry.root.is(data.root))
                .where(Entry.url.is(stripLast(data.url)))
            )
      const entry = {
        ...data,
        $parent: parent?.id,
        $isContainer: type!.options.isContainer,
        $status: EntryStatus.Draft
      }
      if (existing) store.update(condition, entry)
      else store.insert(Entry, entry)
    }
  }

  static applyPublish(store: Store, entries: Array<Entry>) {
    return store.transaction(() => {
      for (const entry of entries) {
        const condition = Entry.where(Entry.id.is(entry.id))
        const existing = store.first(condition)
        if (existing) store.update(condition, entry)
        else store.insert(Entry, entry)
      }
    })
  }
}
