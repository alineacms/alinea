import type {Config} from '#/core/Config.js'
import type {EntryStatus} from '#/core/Entry.js'
import {assert} from '#/core/util/Assert.js'
import {entryUrl, parseEntryFilePath} from '#/core/util/EntryFilenames.js'
import {storedEntryData} from '../entry/EntryTable.js'
import {hasChildren, type SyncChanges} from './Ingest.js'
import type {SyncQueries} from './SyncQueries.js'

/** One stored entry version, with the fields deriving rewrites. */
interface Version {
  versionId: string
  id: string
  locale: string | null
  versionStatus: EntryStatus
  type: string
  index: string
  workspace: string
  root: string
  path: string
  filePath: string
  level: number
  parentDir: string
  childrenDir: string
  childrenSha: string | null
  parentId: string | null
  parents: Array<string>
  status: EntryStatus
  active: boolean
  main: boolean
  visible: boolean
  url: string
}

/** The versions of one entry in one language. */
type Language = Array<Version>

/** Must match for every version of one entry language. */
function languageKey(id: string, locale: string | null): string {
  return JSON.stringify([id, locale])
}

function derivedFields(version: Version): string {
  const {parentId, parents, status, active, main, visible, url} = version
  return JSON.stringify([parentId, parents, status, active, main, visible, url])
}

/** Every directory from the top of the tree down to and including `dir`. */
function directoryPath(dir: string): Array<string> {
  const result = Array<string>()
  let slash = dir.indexOf('/')
  while (slash !== -1) {
    result.push(dir.slice(0, slash))
    slash = dir.indexOf('/', slash + 1)
  }
  result.push(dir)
  return result
}

/**
 * Load the versions a merge touched, plus everything stored below their child
 * directories: those inherit parents and statuses from them.
 */
async function loadVersions(
  queries: SyncQueries,
  changes: SyncChanges
): Promise<Map<string, Version>> {
  const versions = new Map<string, Version>()
  const add = (rows: Array<Version>) => {
    for (const row of rows) versions.set(row.versionId, row)
  }
  add(await queries.versionsOf.all({ids: JSON.stringify([...changes.touched])}))
  const dirs = new Set(changes.childDirs)
  for (const version of versions.values())
    if (changes.parents.has(version.id) && hasChildren(version.childrenSha))
      dirs.add(version.childrenDir)
  for (const dir of dirs) {
    const nested = directoryPath(dir)
      .slice(0, -1)
      .some(parent => dirs.has(parent))
    if (!nested)
      add(await queries.versionsBelow.all({from: `${dir}/`, to: `${dir}0`}))
  }
  return versions
}

/**
 * Point every version at the entries owning the directories above it.
 * Resolves to the languages that moved to another parent.
 */
async function deriveHierarchy(
  queries: SyncQueries,
  versions: ReadonlyArray<Version>
): Promise<Set<string>> {
  const pathByDir = new Map<string, Array<string>>()
  for (const version of versions)
    if (!pathByDir.has(version.parentDir))
      pathByDir.set(version.parentDir, directoryPath(version.parentDir))
  const dirs = new Set(Array.from(pathByDir.values()).flat())
  const owners = await queries.owners.all({dirs: JSON.stringify([...dirs])})
  const ownerByDir = new Map(owners.map(owner => [owner.childrenDir, owner.id]))
  const moved = new Set<string>()
  for (const version of versions) {
    const parents = pathByDir.get(version.parentDir)!.flatMap(dir => {
      const owner = ownerByDir.get(dir)
      return owner ? [owner] : []
    })
    const parentId = parents.at(-1) ?? null
    if (parentId !== version.parentId)
      moved.add(languageKey(version.id, version.locale))
    version.parentId = parentId
    version.parents = parents
  }
  return moved
}

/**
 * The status a language passes on to its children, read back from its stored
 * versions: an inherited or own status overrides every version's status, and
 * never is 'published'. Without an override a published version exists.
 */
function storedInheritance(statuses: Array<EntryStatus>): EntryStatus | null {
  return statuses.includes('published') ? null : statuses[0]
}

/**
 * The version a language shows by default, the version it shows as main
 * without an inherited status, and the status it passes on by itself.
 */
function languageStatus(language: Language) {
  const has = (status: EntryStatus) =>
    language.some(version => version.versionStatus === status)
  const isDraft = has('draft')
  const isPublished = has('published')
  const isArchived = has('archived')
  const activeStatus: EntryStatus = isDraft
    ? 'draft'
    : isPublished
      ? 'published'
      : 'archived'
  const mainStatus: EntryStatus = isPublished
    ? 'published'
    : isArchived
      ? 'archived'
      : 'draft'
  const ownStatus: EntryStatus | null = isArchived
    ? 'archived'
    : isDraft && !isPublished
      ? 'draft'
      : null
  return {activeStatus, mainStatus, ownStatus}
}

/**
 * Derive status, active, main and visible per language, parents first. A
 * language passes a change on to its children when its versions were touched
 * or their derived status changed. Resolves to the languages whose main version
 * changed.
 */
async function deriveStatus(
  queries: SyncQueries,
  languages: Map<string, Language>,
  start: Set<string>,
  touched: Set<string>
): Promise<Set<string>> {
  const children = new Map<string, Array<string>>()
  for (const [key, [first]] of languages) {
    if (!first.parentId) continue
    const parentKey = languageKey(first.parentId, first.locale)
    const siblings = children.get(parentKey) ?? []
    siblings.push(key)
    children.set(parentKey, siblings)
  }
  // Inheritance of the parents above the starting languages, as stored.
  const inherited = new Map<string, EntryStatus | null>()
  const statusesByKey = new Map<string, Array<EntryStatus>>()
  const unloaded = new Set<string>()
  for (const key of start) {
    const [first] = languages.get(key)!
    if (!first.parentId) continue
    const parentKey = languageKey(first.parentId, first.locale)
    const parent = languages.get(parentKey)
    if (parent)
      statusesByKey.set(
        parentKey,
        parent.map(version => version.status)
      )
    else unloaded.add(first.parentId)
  }
  if (unloaded.size) {
    const rows = await queries.statusesOf.all({
      ids: JSON.stringify([...unloaded])
    })
    for (const row of rows) {
      const key = languageKey(row.id, row.locale)
      const statuses = statusesByKey.get(key) ?? []
      statuses.push(row.status)
      statusesByKey.set(key, statuses)
    }
  }
  for (const [key, statuses] of statusesByKey)
    inherited.set(key, storedInheritance(statuses))

  const levels = Array<Array<string>>()
  const queued = new Set<string>()
  function enqueue(key: string) {
    if (queued.has(key)) return
    queued.add(key)
    const {level} = languages.get(key)![0]
    ;(levels[level] ??= []).push(key)
  }
  for (const key of start) enqueue(key)
  const mainChanged = new Set<string>()
  for (let level = 0; level < levels.length; level++) {
    for (const key of levels[level] ?? []) {
      const language = languages.get(key)!
      const [first] = language
      const {activeStatus, mainStatus, ownStatus} = languageStatus(language)
      const parentStatus = first.parentId
        ? inherited.get(languageKey(first.parentId, first.locale))
        : undefined
      const effective = parentStatus ?? ownStatus
      inherited.set(key, effective)
      const mainBefore = language.find(version => version.main)
      let changed = false
      for (const version of language) {
        const status = effective ?? version.versionStatus
        const active = version.versionStatus === activeStatus
        const main =
          version.versionStatus === (effective ? activeStatus : mainStatus)
        const visible = effective ? active : true
        changed ||=
          status !== version.status ||
          active !== version.active ||
          main !== version.main ||
          visible !== version.visible
        Object.assign(version, {status, active, main, visible})
      }
      if (language.find(version => version.main) !== mainBefore)
        mainChanged.add(key)
      if (changed || touched.has(first.id))
        for (const child of children.get(key) ?? []) enqueue(child)
    }
  }
  return mainChanged
}

/**
 * Give every version of a language the url of its main version. That url
 * depends on the main version's own file only: it is parsed along with the
 * file, and computed again when an older version becomes main.
 */
async function deriveUrls(
  config: Config,
  queries: SyncQueries,
  languages: Map<string, Language>,
  keys: Iterable<string>,
  inserted: Set<string>,
  mainChanged: Set<string>
): Promise<void> {
  const pending = Array<{language: Language; main: Version}>()
  for (const key of keys) {
    const language = languages.get(key)!
    const main = language.find(version => version.main)
    if (!main) continue
    if (inserted.has(main.versionId) || !mainChanged.has(key))
      for (const version of language) version.url = main.url
    else pending.push({language, main})
  }
  if (!pending.length) return
  const rows = await queries.dataOf.all({
    versionIds: JSON.stringify(pending.map(({main}) => main.versionId))
  })
  const dataByVersion = new Map(rows.map(row => [row.versionId, row.data]))
  for (const {language, main} of pending) {
    const type = config.schema[main.type]
    assert(type, `Entry ${main.id} has an unknown type: ${main.type}`)
    const url = entryUrl(type, {
      config,
      data: storedEntryData(dataByVersion.get(main.versionId), main.path),
      status: main.versionStatus,
      path: main.path,
      parentPaths: parseEntryFilePath(config, main.filePath).parentPaths,
      locale: main.locale,
      workspace: main.workspace,
      root: main.root
    })
    for (const version of language) version.url = url
  }
}

/** Validate authored relationships that SQLite column constraints cannot express. */
async function validateEntries(
  queries: SyncQueries,
  entryIds: Iterable<string>
): Promise<void> {
  const ids = JSON.stringify([...entryIds])
  const node = await queries.mismatchedEntry.get({ids})
  if (node) {
    const versions = (
      await queries.versionsOf.all({ids: JSON.stringify([node.id])})
    ).sort((a, b) => (a.filePath < b.filePath ? -1 : 1))
    const fields: Array<
      [label: string, value: (version: Version) => string | null]
    > = [
      ['_type', version => version.type],
      ['_index', version => version.index],
      ['root', version => version.root],
      ['workspace', version => version.workspace],
      ['parent', version => version.parentId]
    ]
    const differences = fields.filter(
      ([, value]) => new Set(versions.map(value)).size > 1
    )
    assert(
      false,
      `Mismatched authored entry versions for ${node.id}. All translations and statuses of an entry must use the same type, index, root, workspace, and logical parent.\n${versions
        .map(
          version =>
            `${version.filePath}: ${differences
              .map(
                ([label, value]) => `${label}=${JSON.stringify(value(version))}`
              )
              .join(', ')}`
        )
        .join('\n')}`
    )
  }
  const language = await queries.mismatchedLanguage.get({ids})
  assert(
    !language,
    `Mismatched authored language versions for ${language?.id} (${language?.locale ?? 'unlocalized'})`
  )
  const status = await queries.invalidStatus.get({ids})
  assert(
    !status,
    `Invalid derived status for ${status?.id} (${status?.locale ?? 'unlocalized'})`
  )
  const cyclic = await queries.cyclicVersion.get({ids})
  assert(!cyclic, `Invalid entry hierarchy: ${cyclic?.filePath}`)
}

/**
 * Derive parents, statuses and urls for what a merge changed, and for what
 * inherits from it. Resolves to the sorted ids of every entry that changed.
 */
export async function deriveEntries(
  config: Config,
  queries: SyncQueries,
  changes: SyncChanges,
  validate: boolean
): Promise<Array<string>> {
  const versions = await loadVersions(queries, changes)
  const before = new Map<Version, string>()
  const languages = new Map<string, Language>()
  for (const version of versions.values()) {
    before.set(version, derivedFields(version))
    const key = languageKey(version.id, version.locale)
    const language = languages.get(key) ?? []
    language.push(version)
    languages.set(key, language)
  }
  const touched = Array.from(languages.keys()).filter(key =>
    changes.touched.has(languages.get(key)![0].id)
  )
  const moved = await deriveHierarchy(queries, [...versions.values()])
  const mainChanged = await deriveStatus(
    queries,
    languages,
    new Set([...touched, ...moved]),
    changes.touched
  )
  await deriveUrls(
    config,
    queries,
    languages,
    new Set([...touched, ...mainChanged]),
    changes.inserted,
    mainChanged
  )
  const written = new Set<string>()
  for (const [version, fields] of before) {
    if (derivedFields(version) === fields) continue
    written.add(version.id)
    await queries.updateVersion.run({
      versionId: version.versionId,
      parentId: version.parentId,
      parents: JSON.stringify(version.parents),
      status: version.status,
      active: Number(version.active),
      main: Number(version.main),
      visible: Number(version.visible),
      url: version.url
    })
  }
  if (validate) await validateEntries(queries, [...changes.touched, ...written])
  const changed = new Set([...changes.touched, ...changes.containers])
  for (const version of versions.values()) changed.add(version.id)
  return Array.from(changed).sort()
}
