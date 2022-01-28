import {
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
import {Source} from './Source'

export class Cache {
  static async create(store: Store, from: Source) {
    const startTime = process.hrtime.bigint()
    console.log('Start indexing...')
    store.delete(Entry)
    let total = 0
    for await (const entry of from.entries()) {
      total++
      store.insert(Entry, entry)
    }
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
    schema: Schema,
    updates: Array<{id: string; update: Uint8Array}>
  ) {
    for (const {id, update} of updates) {
      const condition = Entry.where(Entry.id.is(id))
      const existing = store.first(condition)
      const doc = new Y.Doc()
      if (existing) docFromEntry(schema, existing, doc)
      Y.applyUpdate(doc, update)
      const data = entryFromDoc(schema, doc)
      const parentUrl = (data.url || '').split('/').slice(0, -1).join('/')
      const parent = store.first(Entry.where(Entry.url.is(parentUrl)))
      const entry = {
        ...data,
        $parent: parent?.id,
        $status: EntryStatus.Draft
      }
      if (existing) store.update(condition, entry as any)
      else store.insert(Entry, entry)
    }
  }

  static applyPublish(store: Store, entries: Array<Entry>) {
    return store.transaction(() => {
      for (const entry of entries) {
        const condition = Entry.where(Entry.id.is(entry.id))
        const existing = store.first(condition)
        if (existing) store.update(condition, entry as any)
        else store.insert(Entry, entry)
      }
    })
  }
}
