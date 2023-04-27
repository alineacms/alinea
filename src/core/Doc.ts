import * as Y from 'yjs'
import {Entry, EntryMeta} from './Entry.js'
import {createError} from './ErrorWithCode.js'
import {Label} from './Label.js'
import {AnyType, Type} from './Type.js'

export const ROOT_KEY = '#root'

export function entryFromDoc(
  doc: Y.Doc,
  getType: (typeKey: string) => AnyType | undefined
): Entry {
  const docRoot = doc.getMap(ROOT_KEY)
  const typeKey = docRoot.get('type') as string | undefined
  const meta = docRoot.get('alinea') as EntryMeta
  const root = meta.root as string | undefined
  const type = typeKey && getType(typeKey)
  if (!type)
    throw new Error(
      `Type "${typeKey}" not found in \n ${JSON.stringify(docRoot.toJSON())}`
    )
  if (!root) throw new Error(`No root`)
  return {
    id: docRoot.get('id') as string,
    type: typeKey,
    title: docRoot.get('title') as Label,
    path: docRoot.get('path') as string,
    url: docRoot.get('url') as string,
    ...type.shape.fromY(docRoot),
    alinea: meta
  }
}

export function docFromEntry(
  entry: Entry & {[key: string]: any},
  getType: (workspace: string, typeKey: string) => Type | undefined,
  doc = new Y.Doc()
) {
  const typeKey = entry.type
  const type = typeKey && getType(entry.alinea.workspace, typeKey)
  if (!type) throw createError(`Type "${typeKey}" not found`)
  const {clientID} = doc
  // By setting a consistent clientID, we can ensure that this call is more or
  // less guaranteed to be deterministic
  doc.clientID = 1
  const docRoot = doc.getMap(ROOT_KEY)
  docRoot.set('id', entry.id)
  docRoot.set('type', entry.type)
  docRoot.set('url', entry.url)
  docRoot.set('title', entry.title)
  docRoot.set('path', entry.path)
  docRoot.set('alinea', entry.alinea)
  for (const [key, field] of type) {
    const contents = entry[key]
    docRoot.set(key, field.shape.toY(contents))
  }
  doc.clientID = clientID
  return doc
}
