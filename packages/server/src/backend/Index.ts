import {docFromEntry, Entry, entryFromDoc, Schema} from '@alinea/core'
import convertHrtime from 'convert-hrtime'
import {Store} from 'helder.store'
import prettyMilliseconds from 'pretty-ms'
import * as Y from 'yjs'
import {Source} from './Source'

export class Index {
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
      let entry = entryFromDoc(schema, doc)
      const parentUrl = (entry.url || '').split('/').slice(0, -1).join('/')
      const parent = store.first(Entry.where(Entry.url.is(parentUrl)))
      if (parent) entry = {...entry, $parent: parent.id}
      if (existing) store.update(condition, entry as any)
      else store.insert(Entry, entry)
    }
  }
}
