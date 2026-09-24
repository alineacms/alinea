import type {Config} from '#/core/Config.js'
import {entrySeed} from '#/core/EntrySeed.js'
import {parseRecord, type EntryRecord} from '#/core/EntryRecord.js'
import {Type} from '#/core/Type.js'
import {entryUrl, parseEntryFilePath} from '#/core/util/EntryFilenames.js'
import {assert} from '#/core/util/Assert.js'
import {isRecord} from '#/core/util/Objects.js'
import type {IndexedEntry} from '../entry/EntryTable.js'

/** Parse one source blob into the entry fields that do not depend on its tree. */
export function parseSourceEntry(
  config: Config,
  filePath: string,
  fileHash: string,
  blob: Uint8Array
): IndexedEntry {
  const text = new TextDecoder().decode(blob)
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error(`Invalid JSON entry: ${filePath}`)
  }
  assert(isRecord(raw), `Invalid entry record: ${filePath}`)
  const {meta, data: authoredData} = parseRecord(raw as EntryRecord)
  assert(typeof meta.id === 'string', `Entry is missing an id: ${filePath}`)
  assert(typeof meta.type === 'string', `Entry is missing a type: ${filePath}`)
  assert(
    typeof meta.index === 'string',
    `Entry is missing an index: ${filePath}`
  )
  const {
    workspace,
    root,
    locale,
    path,
    versionStatus,
    parentDir,
    childrenDir,
    level,
    parentPaths
  } = parseEntryFilePath(config, filePath)
  const type = config.schema[meta.type]
  assert(type, `Entry ${meta.id} has an unknown type: ${meta.type}`)
  // A `_seeded` marker whose seed is no longer configured is ignored, so the
  // entry behaves like any other (it can be moved and deleted) and the marker
  // is dropped on its next save
  const seed = entrySeed(
    config,
    typeof meta.seeded === 'string' ? meta.seeded : null,
    {workspace, root, locale}
  )
  const data: Record<string, unknown> = {
    path,
    ...(seed ? {...seed.data, ...authoredData} : authoredData)
  }
  return {
    id: meta.id,
    type: meta.type,
    index: meta.index,
    data,
    title: typeof data.title === 'string' ? data.title : '',
    seeded: seed ? seed.seedPath : null,
    rowHash: fileHash,
    fileHash,
    locale,
    workspace,
    root,
    path,
    versionStatus,
    status: versionStatus,
    parentId: null,
    parents: [],
    level,
    filePath,
    parentDir,
    childrenDir,
    url: entryUrl(type, {
      config,
      data,
      status: versionStatus,
      path,
      parentPaths,
      locale,
      workspace,
      root
    }),
    active: false,
    main: false,
    visible: true,
    payload: text,
    searchableText: Type.searchableText(type, data)
  }
}
