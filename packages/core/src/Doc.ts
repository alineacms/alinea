import * as Y from 'yjs'
import {Entry} from './Entry'
import {createError} from './ErrorWithCode'
import {Label} from './Label'
import {Schema} from './Schema'
import {Type} from './Type'

const ROOT_KEY = 'root'

export function typeOfDoc(doc: Y.Doc) {
  return doc.getMap(ROOT_KEY).get('type') as string | undefined
}

export function entryFromDoc(info: Schema | Type, doc: Y.Doc): Entry {
  const typeKey = typeOfDoc(doc)
  const type = info instanceof Type ? info : info.type(typeKey)
  if (!type) throw new Error(`Type "${typeKey}" not found`)
  const root = doc.getMap(ROOT_KEY)
  return {
    id: root.get('id') as string,
    type: typeKey,
    url: root.get('url') as string,
    title: root.get('title') as Label,
    $parent: root.get('$parent') as boolean,
    $isContainer: root.get('$isContainer') as boolean,
    ...type.valueType.fromY(root)
  }
}

export function docFromEntry(
  info: Schema | Type,
  entry: Entry.Raw & {[key: string]: any},
  doc = new Y.Doc()
) {
  const typeKey = entry.type
  const type = info instanceof Type ? info : info.type(typeKey)
  if (!type) throw createError(`Type "${typeKey}" not found`)
  const {clientID} = doc
  // By setting a consistent clientID, we can ensure that this call is more or
  // less guaranteed to be deterministic
  doc.clientID = 1
  const root = doc.getMap(ROOT_KEY)
  root.set('id', entry.id)
  root.set('type', entry.type)
  root.set('url', entry.url)
  root.set('$parent', entry.$parent)
  root.set('$isContainer', entry.$isContainer)
  for (const [key, field] of type) {
    const contents = entry[key]
    root.set(key, field.type.toY(contents))
  }
  doc.clientID = clientID
  return doc
}
