import * as Y from 'yjs'
import {Channel} from './Channel'
import {Entry} from './Entry'

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
  for (const [key, field] of channel) {
    const contents = entry[key]
    root.set(key, field.type.toY(contents))
  }
  return doc
}
