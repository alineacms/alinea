import {Entry} from '@alinea/core/Entry'
import convertHrtime from 'convert-hrtime'
import {Store} from 'helder.store'
import prettyMilliseconds from 'pretty-ms'
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
    store.createIndex(Entry, 'path', [Entry.$path])
    store.createIndex(Entry, 'parent', [Entry.$parent])
    const diff = process.hrtime.bigint() - startTime
    console.log(
      `Done indexing ${total} entries in ${prettyMilliseconds(
        convertHrtime(diff).milliseconds
      )}`
    )
  }
}
