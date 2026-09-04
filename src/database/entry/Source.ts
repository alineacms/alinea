import {Config, type Config as ConfigDefinition} from '#/core/Config.js'
import type {EntryStatus} from '#/core/Entry.js'
import {parseRecord} from '#/core/EntryRecord.js'
import {aliasUrlsFromData} from '#/core/db/EntryAliases.js'
import {getRoot} from '#/core/Internal.js'
import {Page} from '#/core/Page.js'
import {Schema} from '#/core/Schema.js'
import type {Source} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {compareStrings} from '#/core/source/Utils.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {entryInfo, entryUrl} from '#/core/util/EntryFilenames.js'
import {entries} from '#/core/util/Objects.js'
import {slugify} from '#/core/util/Slugs.js'
import type {EntryCoreRecord} from './Model.js'

export interface EntrySourceFile {
  sha: string
  contents: Uint8Array
}

export interface EntrySeed {
  seedId: string
  seedPath: string
  translationPathEnd: string
  nodePath: string
  type: string
  workspace: string
  root: string
  locale: string | null
  data: Record<string, unknown>
}

export interface ParsedVersion {
  filePath: string
  fileHash: string
  entryId: string
  type: string
  index: string
  data: Record<string, unknown>
  searchableText: string
  seeded: string | null
  workspace: string
  root: string
  locale: string | null
  path: string
  versionStatus: EntryStatus
  parentDir: string
  childrenDir: string
  level: number
}

interface EntryLanguage {
  locale: string | null
  versions: ReadonlyMap<EntryStatus, ParsedVersion>
  active: ParsedVersion
  main: ParsedVersion
  inheritedStatus: EntryStatus | undefined
  url: string
}

interface EntryNode {
  entryId: string
  type: Type
  versions: ReadonlyArray<ParsedVersion>
  parent: EntryNode | null
  parents: ReadonlyArray<string>
  languages: ReadonlyMap<string | null, EntryLanguage>
}

export async function loadParsedVersions(
  config: ConfigDefinition,
  source: Source
): Promise<{
  tree: ReadonlyTree
  files: ReadonlyMap<string, EntrySourceFile>
  versions: ReadonlyArray<ParsedVersion>
}> {
  const tree = await source.getTree()
  const files = await loadSourceFiles(source, tree)
  const seeds = entrySeeds(config)
  const versions = [...files].map(([filePath, file]) =>
    parseVersion(config, filePath, file, seeds)
  )
  return {tree, files, versions}
}

export interface NormalizedParsedVersion {
  core: EntryCoreRecord
  version: ParsedVersion
}

/** Recomputes hierarchy and inherited state without requiring source IO. */
export function normalizeParsedVersions(
  config: ConfigDefinition,
  versions: ReadonlyArray<ParsedVersion>
): ReadonlyArray<NormalizedParsedVersion> {
  const grouped = new Map<string, Array<ParsedVersion>>()
  const byDirectory = new Map<string, string>()
  for (const version of versions) {
    const collection = grouped.get(version.entryId) ?? []
    collection.push(version)
    grouped.set(version.entryId, collection)
    const current = byDirectory.get(version.childrenDir)
    if (current && current !== version.entryId)
      throw new Error(`Multiple entries occupy "${version.childrenDir}"`)
    byDirectory.set(version.childrenDir, version.entryId)
  }

  const nodes = new Map<string, EntryNode>()
  const visiting = new Set<string>()
  const createNode = (entryId: string): EntryNode => {
    const existing = nodes.get(entryId)
    if (existing) return existing
    if (visiting.has(entryId))
      throw new Error(`Cyclic parent reference: ${entryId}`)
    visiting.add(entryId)
    const collection = grouped.get(entryId)
    assert(collection && collection.length > 0, `Missing entry ${entryId}`)
    validateCollection(collection)
    const first = collection[0]
    const parentId = byDirectory.get(first.parentDir)
    for (const version of collection) {
      if (byDirectory.get(version.parentDir) !== parentId)
        throw new Error(`Mismatched parents for entry "${entryId}"`)
    }
    const parent = parentId ? createNode(parentId) : null
    const parents = parent ? [...parent.parents, parent.entryId] : []
    const entryType = config.schema[first.type]
    assert(entryType, `Unknown entry type "${first.type}"`)
    const languages = createLanguages(entryType, collection, parent)
    const node: EntryNode = {
      entryId,
      type: entryType,
      versions: collection,
      parent,
      parents,
      languages
    }
    nodes.set(entryId, node)
    visiting.delete(entryId)
    return node
  }

  for (const entryId of grouped.keys()) createNode(entryId)

  const result: Array<NormalizedParsedVersion> = []
  for (const node of nodes.values()) {
    for (const language of node.languages.values()) {
      for (const version of language.versions.values()) {
        const queryable =
          language.inheritedStatus === undefined || version === language.active
        const core = coreRecord(node, language, version, queryable)
        result.push({core, version})
      }
    }
  }
  result.sort(
    (left, right) =>
      compareStrings(left.core.index, right.core.index) ||
      compareStrings(left.core.locale ?? '', right.core.locale ?? '') ||
      statusOrder(left.core.versionStatus) -
        statusOrder(right.core.versionStatus)
  )
  return result
}

function statusOrder(status: EntryStatus): number {
  switch (status) {
    case 'draft':
      return 0
    case 'published':
      return 1
    case 'archived':
      return 2
  }
}

async function loadSourceFiles(
  source: Source,
  tree: ReadonlyTree
): Promise<Map<string, EntrySourceFile>> {
  const index = tree.index()
  const uniqueShas = [...new Set(index.values())]
  const blobs = new Map<string, Uint8Array>()
  for await (const [sha, contents] of source.getBlobs(uniqueShas))
    blobs.set(sha, contents)
  const files = new Map<string, EntrySourceFile>()
  for (const [path, sha] of index) {
    const contents = blobs.get(sha)
    assert(contents, `Missing blob "${sha}" for "${path}"`)
    files.set(path, {sha, contents})
  }
  return files
}

export function parseVersion(
  config: ConfigDefinition,
  filePath: string,
  file: EntrySourceFile,
  seeds: ReadonlyMap<string, EntrySeed>
): ParsedVersion {
  const raw = JSON.parse(new TextDecoder().decode(file.contents))
  const {meta, data: storedData} = parseRecord(raw)
  const entryType = config.schema[meta.type]
  assert(entryType, `Unknown entry type "${meta.type}" in "${filePath}"`)
  const segments = filePath.split('/')
  const baseName = segments.at(-1)
  assert(baseName, `Invalid entry path "${filePath}"`)
  const extension = baseName.lastIndexOf('.')
  assert(extension !== -1, `Entry path has no extension: "${filePath}"`)
  const [path, versionStatus] = entryInfo(baseName.slice(0, extension))
  const parentDir = segments.slice(0, -1).join('/')
  const childrenDir = `${parentDir}/${path}`
  let segmentIndex = 0
  const singleWorkspace = !Config.multipleWorkspaces(config)
  const workspace = singleWorkspace
    ? Object.keys(config.workspaces)[0]
    : segments[segmentIndex++]
  const workspaceConfig = config.workspaces[workspace]
  assert(workspaceConfig, `Invalid workspace "${workspace}" in "${filePath}"`)
  const root = segments[segmentIndex++]
  const rootConfig = workspaceConfig[root]
  assert(rootConfig, `Invalid root "${root}" in "${filePath}"`)
  const i18n = getRoot(rootConfig).i18n
  let locale: string | null = null
  if (i18n) {
    const requested = segments[segmentIndex++].toLowerCase()
    locale =
      i18n.locales.find(candidate => candidate.toLowerCase() === requested) ??
      requested
    assert(i18n.locales.includes(locale), `Invalid locale "${locale}"`)
  }
  let levelOffset = 1
  if (!singleWorkspace) levelOffset++
  if (i18n) levelOffset++
  const level = segments.length - levelOffset - 1
  const data: Record<string, unknown> = {
    path,
    ...seeds.get(childrenDir)?.data,
    ...storedData
  }
  assert(typeof data.title === 'string', `Missing title in "${filePath}"`)
  return {
    filePath,
    fileHash: file.sha,
    entryId: meta.id,
    type: meta.type,
    index: meta.index,
    data,
    searchableText: Type.searchableText(entryType, data),
    seeded: meta.seeded ?? null,
    workspace,
    root,
    locale,
    path,
    versionStatus,
    parentDir,
    childrenDir,
    level
  }
}

export function entrySeeds(config: ConfigDefinition): Map<string, EntrySeed> {
  const result = new Map<string, EntrySeed>()
  const typeNames = Schema.typeNames(config.schema)
  for (const [workspaceName, workspace] of entries(config.workspaces)) {
    for (const [rootName, root] of entries(workspace)) {
      const locales = getRoot(root).i18n?.locales ?? [null]
      for (const locale of locales) {
        const pages: Array<readonly [string, Page]> = entries(root)
        while (pages.length > 0) {
          const [pagePath, page] = pages.shift()!
          const path = pagePath.split('/').map(slugify).join('/')
          if (!Page.isPage(page)) continue
          const {type, fields = {}} = Page.data(page)
          const typeName = typeNames.get(type)
          if (!typeName) continue
          const filePath = Config.filePath(
            config,
            workspaceName,
            rootName,
            locale,
            `${path}.json`
          )
          const lastSlash = filePath.lastIndexOf('/')
          const parentDir = filePath.slice(0, lastSlash)
          const nodePath = `${parentDir}/${path.split('/').at(-1)}`
          const pathSegments = nodePath
            .split('/')
            .slice(Config.multipleWorkspaces(config) ? 2 : 1)
          result.set(nodePath, {
            seedId: `${rootName}/${path}`,
            seedPath: `/${pathSegments.join('/')}.json`,
            translationPathEnd: `/${pathSegments.slice(1).join('/')}.json`,
            nodePath,
            type: typeName,
            workspace: workspaceName,
            root: rootName,
            locale,
            data: {
              ...fields,
              path: path.split('/').at(-1),
              title: fields.title ?? path
            }
          })
          pages.push(
            ...entries(page).map(
              ([childPath, child]) =>
                [`${path}/${childPath}`, child as Page] as const
            )
          )
        }
      }
    }
  }
  return result
}

function validateCollection(collection: ReadonlyArray<ParsedVersion>): void {
  const first = collection[0]
  for (const version of collection.slice(1)) {
    assert(version.type === first.type, `Mismatched types for ${first.entryId}`)
    assert(
      version.index === first.index,
      `Mismatched indexes for ${first.entryId}`
    )
    assert(version.root === first.root, `Mismatched roots for ${first.entryId}`)
    assert(
      version.workspace === first.workspace,
      `Mismatched workspaces for ${first.entryId}`
    )
  }
}

function createLanguages(
  entryType: Type,
  versions: ReadonlyArray<ParsedVersion>,
  parent: EntryNode | null
): ReadonlyMap<string | null, EntryLanguage> {
  const grouped = new Map<string | null, Array<ParsedVersion>>()
  for (const version of versions) {
    const language = grouped.get(version.locale) ?? []
    language.push(version)
    grouped.set(version.locale, language)
  }
  const result = new Map<string | null, EntryLanguage>()
  for (const [locale, source] of grouped) {
    const phases = new Map<EntryStatus, ParsedVersion>()
    for (const version of source) {
      if (phases.has(version.versionStatus))
        throw new Error(
          `Duplicate ${version.versionStatus} version for "${version.entryId}"`
        )
      phases.set(version.versionStatus, version)
    }
    const active =
      phases.get('draft') ?? phases.get('published') ?? phases.get('archived')
    assert(active, 'Entry language is missing an active version')
    const parentLanguage = parent?.languages.get(locale)
    if (parent && !parentLanguage)
      throw new Error(
        `Missing parent locale "${locale}" for "${active.entryId}"`
      )
    let inheritedStatus = parentLanguage?.inheritedStatus
    if (!inheritedStatus && phases.has('archived')) inheritedStatus = 'archived'
    else if (
      !inheritedStatus &&
      phases.has('draft') &&
      !phases.has('published')
    )
      inheritedStatus = 'draft'
    const main = inheritedStatus
      ? active
      : (phases.get('published') ?? phases.get('archived') ?? active)
    const parentPaths: Array<string> = []
    let current = parent
    while (current) {
      const currentLanguage = current.languages.get(locale)
      assert(currentLanguage, `Missing parent locale "${locale}"`)
      parentPaths.unshift(currentLanguage.main.path)
      current = current.parent
    }
    const url = entryUrl(entryType, {
      status: main.versionStatus,
      path: main.path,
      parentPaths,
      locale,
      workspace: main.workspace,
      root: main.root
    })
    result.set(locale, {
      locale,
      versions: phases,
      active,
      main,
      inheritedStatus,
      url
    })
  }
  return result
}

function coreRecord(
  node: EntryNode,
  language: EntryLanguage,
  version: ParsedVersion,
  queryable: boolean
): EntryCoreRecord {
  return {
    kind: 'entry',
    id: coreRecordId(version.filePath),
    queryable,
    entryId: version.entryId,
    versionStatus: version.versionStatus,
    status: language.inheritedStatus ?? version.versionStatus,
    active: version === language.active,
    main: version === language.main,
    type: version.type,
    title: version.data.title as string,
    seeded: version.seeded,
    workspace: version.workspace,
    root: version.root,
    locale: version.locale,
    level: version.level,
    index: version.index,
    parentId: node.parent?.entryId ?? null,
    parents: node.parents,
    path: version.path,
    url: language.url,
    urlAliases: aliasUrlsFromData(version.data)
  }
}

function coreRecordId(filePath: string): string {
  return `entry:${filePath}`
}
