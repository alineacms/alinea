import * as Y from 'yjs'
import {Entry} from '.'
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
  entry: Entry & {[key: string]: any},
  doc = new Y.Doc()
) {
  const root = doc.getMap(ROOT_KEY)
  for (const key of Object.keys(entry)) {
    root.set(key, Value.toY(entry[key]))
  }
  return doc
}
