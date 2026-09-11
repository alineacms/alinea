import {Config} from '#/core/Config.js'
import {seedData} from '#/core/EntrySeed.js'
import type {EntryStatus} from '#/core/Entry.js'
import {parseRecord, type EntryRecord} from '#/core/EntryRecord.js'
import {getRoot} from '#/core/Internal.js'
import {Type} from '#/core/Type.js'
import {entryInfo, entryUrl} from '#/core/util/EntryFilenames.js'
import {assert} from '#/core/util/Assert.js'
import {isRecord} from '#/core/util/Objects.js'
import type {IndexedEntry} from '../entry/Schema.js'

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
  const data = seedData(config, meta.seeded ?? null, authoredData)
  assert(typeof meta.id === 'string', `Entry is missing an id: ${filePath}`)
  assert(typeof meta.type === 'string', `Entry is missing a type: ${filePath}`)
  assert(
    typeof meta.index === 'string',
    `Entry is missing an index: ${filePath}`
  )
  const segments = filePath.split('/')
  const fileName = segments.at(-1)
  assert(fileName, `Invalid entry path: ${filePath}`)
  const lastDot = fileName.lastIndexOf('.')
  assert(lastDot !== -1, `Entry must have an extension: ${filePath}`)
  const [path, versionStatus] = entryInfo(fileName.slice(0, lastDot))
  const parentDir = segments.slice(0, -1).join('/')
  const childrenDir = `${parentDir}/${path}`
  let segmentIndex = 0
  const workspace = Config.multipleWorkspaces(config)
    ? segments[segmentIndex++]
    : Object.keys(config.workspaces)[0]
  assert(workspace, `Entry has no workspace: ${filePath}`)
  const workspaceConfig = config.workspaces[workspace]
  assert(workspaceConfig, `Invalid workspace: ${workspace} in ${filePath}`)
  const root = segments[segmentIndex++]
  assert(root, `Entry has no root: ${filePath}`)
  const rootConfig = workspaceConfig[root]
  assert(rootConfig, `Invalid root: ${root} for workspace ${workspace}`)
  const i18n = getRoot(rootConfig).i18n
  let locale: string | null = null
  if (i18n) {
    locale = segments[segmentIndex++].toLowerCase()
    for (const candidate of i18n.locales) {
      if (locale === candidate.toLowerCase()) {
        locale = candidate
        break
      }
    }
    assert(i18n.locales.includes(locale), `Invalid locale: ${locale}`)
  }
  const levelOffset =
    (Config.multipleWorkspaces(config) ? 2 : 1) + (i18n ? 1 : 0)
  const type = config.schema[meta.type]
  assert(type, `Entry ${meta.id} has an unknown type: ${meta.type}`)
  const parentPaths = segments.slice(levelOffset, -1)
  return {
    id: meta.id,
    type: meta.type,
    index: meta.index,
    data,
    title: typeof data.title === 'string' ? data.title : '',
    seeded: typeof meta.seeded === 'string' ? meta.seeded : null,
    rowHash: fileHash,
    fileHash,
    locale,
    workspace,
    root,
    path,
    versionStatus: versionStatus as EntryStatus,
    status: versionStatus as EntryStatus,
    parentId: null,
    parents: [],
    level: segments.length - levelOffset - 1,
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
