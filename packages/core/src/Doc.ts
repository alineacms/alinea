import * as Y from 'yjs'
import {Entry} from './Entry'
import {Type} from './Type'

const ROOT_KEY = 'root'

export function docFromEntry(
  type: Type,
  entry: Entry & {[key: string]: any},
  doc = new Y.Doc()
) {
  const root = doc.getMap(ROOT_KEY)
  root.set('id', entry.id)
  root.set('type', entry.type)
  for (const [key, field] of type) {
    const contents = entry[key]
    root.set(key, field.type.toY(contents))
  }
  return doc
}
