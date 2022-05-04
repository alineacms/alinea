import * as Y from 'yjs'
import {Entry} from './Entry'
import {createError} from './ErrorWithCode'
import {Label} from './Label'
import {Type} from './Type'

export const ROOT_KEY = '#root'

export function entryFromDoc(
  doc: Y.Doc,
  getType: (workspace: string, typeKey: string) => Type | undefined
): Entry {
  const docRoot = doc.getMap(ROOT_KEY)
  const workspace = docRoot.get('workspace') as string | undefined
  const root = docRoot.get('root') as string | undefined
  const typeKey = docRoot.get('type') as string | undefined
  const type = workspace && typeKey && getType(workspace, typeKey)
  if (!type)
    throw new Error(
      `Type "${typeKey}" not found in \n ${JSON.stringify(docRoot.toJSON())}`
    )
  if (!root) throw new Error(`No root`)
  return {
    id: docRoot.get('id') as string,
    type: typeKey,
    workspace,
    root,
    index: docRoot.get('index') as string,
    url: docRoot.get('url') as string,
    title: docRoot.get('title') as Label,
    path: docRoot.get('path') as string,
    i18n: docRoot.get('i18n') as Entry.I18N | undefined,
    parent: docRoot.get('parent') as string,
    parents: docRoot.get('parents') as Array<string>,
    $isContainer: docRoot.get('$isContainer') as boolean,
    ...type.valueType.fromY(docRoot)
  }
}

export function docFromEntry(
  entry: Entry.Raw & {[key: string]: any},
  getType: (workspace: string, typeKey: string) => Type | undefined,
  doc = new Y.Doc()
) {
  const typeKey = entry.type
  const type = typeKey && getType(entry.workspace, typeKey)
  if (!type) throw createError(`Type "${typeKey}" not found`)
  const {clientID} = doc
  // By setting a consistent clientID, we can ensure that this call is more or
  // less guaranteed to be deterministic
  doc.clientID = 1
  const docRoot = doc.getMap(ROOT_KEY)
  docRoot.set('id', entry.id)
  docRoot.set('workspace', entry.workspace)
  docRoot.set('root', entry.root)
  docRoot.set('type', entry.type)
  docRoot.set('index', entry.index)
  docRoot.set('url', entry.url)
  docRoot.set('path', entry.path)
  if (entry.i18n) docRoot.set('i18n', entry.i18n)
  docRoot.set('parent', entry.parent)
  docRoot.set('parents', entry.parents)
  docRoot.set('$isContainer', entry.$isContainer)
  for (const [key, field] of type) {
    const contents = entry[key]
    docRoot.set(key, field.type.toY(contents))
  }
  doc.clientID = clientID
  return doc
}
