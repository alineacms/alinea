import * as Y from 'yjs'
import {EntryRow} from './EntryRow.js'
import {Field} from './Field.js'
import {Type} from './Type.js'
import {entries} from './util/Objects.js'

export const ROOT_KEY = '#root'

export function createYDoc(type: Type, entry: EntryRow) {
  const doc = new Y.Doc({gc: false})
  const clientID = doc.clientID
  doc.clientID = 1
  doc.transact(() => {
    const docRoot = doc.getMap(ROOT_KEY)
    for (const [key, field] of entries(type)) {
      const contents = entry.data[key]
      docRoot.set(key, Field.shape(field).toY(contents))
    }
  })
  doc.clientID = clientID
  return doc
}

export function parseYDoc(type: Type, doc: Y.Doc) {
  const docRoot = doc.getMap(ROOT_KEY)
  const data: Record<string, any> = Type.shape(type).fromY(docRoot)
  return {
    path: data.path,
    title: data.title,
    data
  }
}
