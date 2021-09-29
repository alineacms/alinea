import * as Y from 'yjs'
import {Channel, Entry} from '.'
import {Value} from './value/Value'

const ROOT_KEY = 'root'

const entryFields = new Set([
  '$channel',
  'path',
  'isContainer',
  'title',
  'parent'
])

export function docFromEntry(
  channel: Channel,
  entry: Entry & {[key: string]: any},
  doc = new Y.Doc()
) {
  const root = doc.getMap(ROOT_KEY)
  const fields = Channel.fields(channel)
  for (const key of entryFields) {
    root.set(key, Value.toY(entry[key]))
  }
  for (const [key, field] of fields) {
    root.set(key, Value.toY(entry[key]))
  }
  return doc
}
