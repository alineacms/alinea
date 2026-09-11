import {Config} from '#/core/Config.js'
import type {Entry, EntryStatus} from '#/core/Entry.js'
import {parseRecord, type EntryRecord} from '#/core/EntryRecord.js'
import {getRoot} from '#/core/Internal.js'
import type {Source} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {Type} from '#/core/Type.js'
import {entryInfo, entryUrl} from '#/core/util/EntryFilenames.js'
import {assert} from '#/core/util/Assert.js'
import {isRecord} from '#/core/util/Objects.js'
import {entryVersionId, type IndexedEntry} from '../entry/Schema.js'
import {entryTreeHashes} from './EntryTree.js'

interface ParsedVersion {
  id: string
  type: string
  index: string
  /** Retained only until SQLite has committed this payload. */
  data?: Record<string, unknown>
  title: string
  seeded: string | null
  rowHash: string
  fileHash: string
  locale: string | null
  workspace: string
  root: string
  path: string
  versionStatus: EntryStatus
  parentDir: string
  childrenDir: string
  filePath: string
  level: number
}

interface Language {
  locale: string | null
  parentDir: string
  childrenDir: string
  path: string
  versions: Map<EntryStatus, ParsedVersion>
}

interface Node {
  id: string
  type: string
  index: string
  workspace: string
  root: string
  level: number
  parentId: string | null
  parents: Array<string>
  languages: Map<string | null, Language>
}

interface CompiledLanguage {
  inheritedStatus: EntryStatus | undefined
  active: ParsedVersion
  main: ParsedVersion
  parentPaths: Array<string>
  url: string
}

interface SourceUpdate {
  revision: string
  changed: boolean
  replaceAll: boolean
  replaceEntryIds: Array<string>
}

function assertEqual(left: unknown, right: unknown, message: string): void {
  assert(left === right, message)
}

/** A node change affects descendants' effective status/URLs and ancestor hashes. */
function affectedIds(
  nodes: ReadonlyMap<string, Node>,
  changed: ReadonlySet<string>
): Set<string> {
  const children = new Map<string, Array<string>>()
  for (const node of nodes.values()) {
    if (!node.parentId) continue
    const nested = children.get(node.parentId) ?? []
    nested.push(node.id)
    children.set(node.parentId, nested)
  }
  const result = new Set<string>()
  const pending = Array.from(changed)
  while (pending.length) {
    const id = pending.pop()!
    if (result.has(id)) continue
    result.add(id)
    const node = nodes.get(id)
    if (node?.parentId) pending.push(node.parentId)
    pending.push(...(children.get(id) ?? []))
  }
  return result
}

function versionKey(version: ParsedVersion): string {
  return entryVersionId(version.id, version.locale, version.versionStatus)
}

function dataFor(
  version: ParsedVersion,
  stored: ReadonlyMap<string, IndexedEntry>
): Record<string, unknown> {
  const data = version.data ?? stored.get(versionKey(version))?.data
  assert(data, `Entry payload is unavailable: ${version.filePath}`)
  return data
}

/**
 * Turns a Source tree and its blobs directly into complete SQLite entry rows.
 * It is deliberately not a query index: its only retained state is the source
 * tree and parsed source records required to fetch subsequent deltas.
 */
export class EntryCompiler implements AsyncDisposable {
  #config: Config
  #tree = ReadonlyTree.EMPTY
  #versions = new Map<string, ParsedVersion>()
  #nodes: Map<string, Node> | undefined
  #loaded = false
  #closed = false

  constructor(config: Config) {
    this.#config = config
  }

  async sync(source: Source, currentRevision: string): Promise<SourceUpdate> {
    if (this.#closed) throw new Error('EntryCompiler is closed')
    const tree = await source.getTreeIfDifferent(currentRevision)
    if (!tree)
      return {
        revision: currentRevision,
        changed: false,
        replaceAll: false,
        replaceEntryIds: []
      }
    const batch = this.#tree.diff(tree)
    const replaceAll = !this.#loaded
    let replaceEntryIds = Array<string>()
    if (batch.changes.length) {
      const previousNodes = this.#loaded ? this.#currentNodes() : undefined
      const previousIds = new Set<string>()
      for (const change of batch.changes) {
        const version = this.#versions.get(change.path)
        if (version) previousIds.add(version.id)
      }
      await this.#apply(source, batch.changes)
      this.#nodes = this.#buildNodes()
      const nextIds = new Set<string>()
      for (const change of batch.changes) {
        const version = this.#versions.get(change.path)
        if (version) nextIds.add(version.id)
      }
      replaceEntryIds = Array.from(
        new Set([
          ...(previousNodes ? affectedIds(previousNodes, previousIds) : []),
          ...affectedIds(this.#nodes, nextIds)
        ])
      )
    } else if (!this.#nodes) this.#nodes = this.#buildNodes()
    this.#tree = tree
    const changed = !this.#loaded || batch.changes.length > 0
    this.#loaded = true
    return {revision: tree.sha, changed, replaceAll, replaceEntryIds}
  }

  *entries(
    entryIds: ReadonlySet<string> | undefined,
    stored: ReadonlyMap<string, IndexedEntry> = new Map()
  ): Generator<IndexedEntry> {
    if (!this.#loaded) throw new Error('EntryCompiler has not synchronized')
    const nodes = this.#currentNodes()
    const compiled = new Map<string, CompiledLanguage>()
    const compiling = new Set<string>()
    const languageKey = (id: string, locale: string | null) =>
      JSON.stringify([id, locale])
    const compileLanguage = (
      node: Node,
      language: Language
    ): CompiledLanguage => {
      const key = languageKey(node.id, language.locale)
      const previous = compiled.get(key)
      if (previous) return previous
      if (compiling.has(key))
        throw new Error(`Cyclic entry parent reference: ${node.id}`)
      compiling.add(key)
      const parent = node.parentId ? nodes.get(node.parentId) : undefined
      const parentLanguage = parent
        ? parent.languages.get(language.locale)
        : undefined
      if (parent && !parentLanguage)
        throw new Error(`Missing parent language node for ${node.id}`)
      const parentState = parentLanguage
        ? compileLanguage(parent!, parentLanguage)
        : undefined
      const active =
        language.versions.get('draft') ??
        language.versions.get('published') ??
        language.versions.get('archived')
      assert(active, `Entry ${node.id} has no active version`)
      const inheritedStatus = parentState?.inheritedStatus
        ? parentState.inheritedStatus
        : language.versions.has('archived')
          ? 'archived'
          : language.versions.has('draft') &&
              !language.versions.has('published')
            ? 'draft'
            : undefined
      const main = inheritedStatus
        ? active
        : (language.versions.get('published') ??
          language.versions.get('archived') ??
          language.versions.get('draft'))
      assert(main, `Entry ${node.id} has no main version`)
      const parentPaths = parentState
        ? [...parentState.parentPaths, parentState.main.path]
        : []
      const type = this.#config.schema[node.type]
      assert(type, `Entry ${node.id} has an unknown type: ${node.type}`)
      const state = {
        inheritedStatus,
        active,
        main,
        parentPaths,
        url: entryUrl(type, {
          config: this.#config,
          data: dataFor(main, stored),
          status: main.versionStatus,
          path: main.path,
          parentPaths,
          locale: main.locale,
          workspace: main.workspace,
          root: main.root
        })
      }
      compiled.set(key, state)
      compiling.delete(key)
      return state
    }

    for (const node of nodes.values()) {
      if (entryIds && !entryIds.has(node.id)) continue
      for (const language of node.languages.values()) {
        const state = compileLanguage(node, language)
        const type = this.#config.schema[node.type]!
        for (const version of language.versions.values()) {
          const status = state.inheritedStatus ?? version.versionStatus
          const data = dataFor(version, stored)
          const existing = stored.get(versionKey(version))
          const searchableText = version.data
            ? Type.searchableText(type, data)
            : existing?.searchableText
          assert(
            searchableText !== undefined,
            `Entry payload is unavailable: ${version.filePath}`
          )
          const {data: _, ...structural} = version
          yield {
            ...structural,
            data,
            status,
            parentId: node.parentId,
            parents: node.parents,
            url: state.url,
            active: version === state.active,
            main: version === state.main,
            visible: state.inheritedStatus ? version === state.active : true,
            ordinal: 0,
            searchableText
          }
        }
      }
    }
  }

  async treeHashes(): Promise<Map<string, string>> {
    return entryTreeHashes(this.#treeRows())
  }

  *#treeRows(): Generator<{
    id: string
    versionId: string
    rowHash: string
    parentId: string | null
  }> {
    for (const node of this.#currentNodes().values()) {
      for (const language of node.languages.values()) {
        for (const version of language.versions.values()) {
          yield {
            id: node.id,
            versionId: entryVersionId(
              version.id,
              version.locale,
              version.versionStatus
            ),
            rowHash: version.rowHash,
            parentId: node.parentId
          }
        }
      }
    }
  }

  async loadPayloads(
    source: Source,
    entryIds?: ReadonlySet<string>
  ): Promise<void> {
    const pathsBySha = new Map<string, Array<string>>()
    for (const [path, version] of this.#versions) {
      if (version.data || (entryIds && !entryIds.has(version.id))) continue
      const paths = pathsBySha.get(version.fileHash) ?? []
      paths.push(path)
      pathsBySha.set(version.fileHash, paths)
    }
    await this.#load(source, pathsBySha)
  }

  discardPayloads(): void {
    for (const version of this.#versions.values()) version.data = undefined
  }

  async close(): Promise<void> {
    this.#closed = true
    this.#versions.clear()
    this.#nodes = undefined
    this.#tree = ReadonlyTree.EMPTY
    this.#loaded = false
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }

  async #apply(
    source: Source,
    changes: ReadonlyArray<{op: string; path: string; sha: string}>
  ): Promise<void> {
    const pathsBySha = new Map<string, Array<string>>()
    for (const change of changes) {
      if (change.op === 'delete') {
        this.#versions.delete(change.path)
        continue
      }
      const paths = pathsBySha.get(change.sha) ?? []
      paths.push(change.path)
      pathsBySha.set(change.sha, paths)
    }
    await this.#load(source, pathsBySha)
  }

  async #load(
    source: Source,
    pathsBySha: ReadonlyMap<string, ReadonlyArray<string>>
  ): Promise<void> {
    const found = new Set<string>()
    for await (const [sha, blob] of source.getBlobs(
      Array.from(pathsBySha.keys())
    )) {
      const paths = pathsBySha.get(sha)
      if (!paths) continue
      found.add(sha)
      for (const path of paths)
        this.#versions.set(path, this.#parse(path, sha, blob))
    }
    for (const sha of pathsBySha.keys())
      assert(found.has(sha), `Source did not return blob ${sha}`)
  }

  #parse(filePath: string, sha: string, blob: Uint8Array): ParsedVersion {
    const text = new TextDecoder().decode(blob)
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      throw new Error(`Invalid JSON entry: ${filePath}`)
    }
    assert(isRecord(raw), `Invalid entry record: ${filePath}`)
    const {meta, data} = parseRecord(raw as EntryRecord)
    assert(typeof meta.id === 'string', `Entry is missing an id: ${filePath}`)
    assert(
      typeof meta.type === 'string',
      `Entry is missing a type: ${filePath}`
    )
    assert(
      typeof meta.index === 'string',
      `Entry is missing an index: ${filePath}`
    )
    assert(
      typeof data.title === 'string',
      `Entry is missing a title: ${filePath}`
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
    const workspace = Config.multipleWorkspaces(this.#config)
      ? segments[segmentIndex++]
      : Object.keys(this.#config.workspaces)[0]
    assert(workspace, `Entry has no workspace: ${filePath}`)
    const workspaceConfig = this.#config.workspaces[workspace]
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
    let levelOffset = Config.multipleWorkspaces(this.#config) ? 2 : 1
    if (i18n) levelOffset++
    const level = segments.length - levelOffset - 1
    return {
      id: meta.id,
      type: meta.type,
      index: meta.index,
      data,
      title: data.title,
      seeded: typeof meta.seeded === 'string' ? meta.seeded : null,
      rowHash: sha,
      fileHash: sha,
      locale,
      workspace,
      root,
      path,
      versionStatus,
      parentDir,
      childrenDir,
      filePath,
      level
    }
  }

  #currentNodes(): Map<string, Node> {
    return (this.#nodes ??= this.#buildNodes())
  }

  #buildNodes(): Map<string, Node> {
    const versionsById = new Map<string, Array<ParsedVersion>>()
    const directoryIds = new Map<string, string>()
    for (const version of this.#versions.values()) {
      const versions = versionsById.get(version.id) ?? []
      versions.push(version)
      versionsById.set(version.id, versions)
      const previous = directoryIds.get(version.childrenDir)
      assertEqual(
        previous ?? version.id,
        version.id,
        `Duplicate entry directory: ${version.childrenDir}`
      )
      directoryIds.set(version.childrenDir, version.id)
    }
    const nodes = new Map<string, Node>()
    for (const [id, versions] of versionsById) {
      const [first, ...rest] = versions
      assert(first, `Entry ${id} has no versions`)
      for (const version of rest) {
        assertEqual(version.type, first.type, `Mismatched types for ${id}`)
        assertEqual(version.index, first.index, `Mismatched indexes for ${id}`)
        assertEqual(version.root, first.root, `Mismatched roots for ${id}`)
        assertEqual(
          version.workspace,
          first.workspace,
          `Mismatched workspaces for ${id}`
        )
      }
      const byLocale = new Map<string | null, Array<ParsedVersion>>()
      for (const version of versions) {
        const localized = byLocale.get(version.locale) ?? []
        localized.push(version)
        byLocale.set(version.locale, localized)
      }
      const languages = new Map<string | null, Language>()
      for (const [locale, localized] of byLocale) {
        const [languageFirst, ...languageRest] = localized
        assert(
          languageFirst,
          `Entry ${id} has no ${locale ?? 'default'} version`
        )
        const statuses = new Map<EntryStatus, ParsedVersion>()
        for (const version of localized) {
          for (const other of languageRest) {
            assertEqual(
              other.parentDir,
              languageFirst.parentDir,
              `Mismatched parent directories for ${id}`
            )
            assertEqual(
              other.childrenDir,
              languageFirst.childrenDir,
              `Mismatched child directories for ${id}`
            )
            assertEqual(
              other.path,
              languageFirst.path,
              `Mismatched paths for ${id}`
            )
          }
          assert(
            !statuses.has(version.versionStatus),
            `Duplicate ${version.versionStatus} version for ${id}`
          )
          statuses.set(version.versionStatus, version)
        }
        languages.set(locale, {
          locale,
          parentDir: languageFirst.parentDir,
          childrenDir: languageFirst.childrenDir,
          path: languageFirst.path,
          versions: statuses
        })
      }
      const parentIds = new Set(
        Array.from(languages.values(), language =>
          directoryIds.get(language.parentDir)
        ).filter((id): id is string => id !== undefined)
      )
      assert(parentIds.size <= 1, `Mismatched parents for ${id}`)
      nodes.set(id, {
        id,
        type: first.type,
        index: first.index,
        workspace: first.workspace,
        root: first.root,
        level: first.level,
        parentId: parentIds.values().next().value ?? null,
        parents: [],
        languages
      })
    }
    const visiting = new Set<string>()
    function parentIds(node: Node): Array<string> {
      if (node.parents.length || !node.parentId) return node.parents
      if (visiting.has(node.id))
        throw new Error(`Cyclic parent reference: ${node.id}`)
      visiting.add(node.id)
      const parent = nodes.get(node.parentId)
      assert(parent, `Missing parent entry: ${node.parentId}`)
      node.parents = [...parentIds(parent), parent.id]
      visiting.delete(node.id)
      return node.parents
    }
    for (const node of nodes.values()) parentIds(node)
    return nodes
  }
}
