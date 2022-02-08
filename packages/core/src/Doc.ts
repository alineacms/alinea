import * as Y from 'yjs'
import {Config} from './Config'
import {Entry} from './Entry'
import {createError} from './ErrorWithCode'
import {Label} from './Label'
import {Schema} from './Schema'
import {Type} from './Type'

const ROOT_KEY = 'root'

function typeFromConfig(
  config: Config | Schema | Type,
  workspace: string,
  typeKey: string
): Type | undefined {
  return config instanceof Type
    ? config
    : config instanceof Schema
    ? config.type(typeKey)
    : config instanceof Config
    ? config.type(workspace, typeKey)
    : undefined
}

export function entryFromDoc(
  config: Config | Schema | Type,
  doc: Y.Doc
): Entry {
  const docRoot = doc.getMap(ROOT_KEY)
  const workspace = docRoot.get('workspace') as string | undefined
  const root = docRoot.get('root') as string | undefined
  const typeKey = docRoot.get('type') as string | undefined
  const type =
    workspace && typeKey && typeFromConfig(config, workspace, typeKey)
  if (!type) throw new Error(`Type "${typeKey}" not found`)
  if (!root) throw new Error(`No root`)
  return {
    id: docRoot.get('id') as string,
    workspace,
    root,
    type: typeKey,
    url: docRoot.get('url') as string,
    title: docRoot.get('title') as Label,
    $parent: docRoot.get('$parent') as string,
    $isContainer: docRoot.get('$isContainer') as boolean,
    ...type.valueType.fromY(docRoot)
  }
}

export function docFromEntry(
  config: Config | Schema | Type,
  entry: Entry.Raw & {[key: string]: any},
  doc = new Y.Doc()
) {
  const typeKey = entry.type
  const type = typeKey && typeFromConfig(config, entry.workspace, typeKey)
  if (!type) throw createError(`Type "${typeKey}" not found`)
  const {clientID} = doc
  // By setting a consistent clientID, we can ensure that this call is more or
  // less guaranteed to be deterministic
  doc.clientID = 1
  const root = doc.getMap(ROOT_KEY)
  root.set('id', entry.id)
  root.set('workspace', entry.workspace)
  root.set('root', entry.root)
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
