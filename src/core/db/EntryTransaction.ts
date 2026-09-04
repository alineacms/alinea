import {Config} from '#/core/Config.js'
import {Entry as EntryExpressions, type Entry} from '#/core/Entry.js'
import {createRecord} from '#/core/EntryRecord.js'
import {Field} from '#/core/Field.js'
import {getRoot} from '#/core/Internal.js'
import type {Graph, QuerySettings} from '#/core/Graph.js'
import {ListRow} from '#/core/ListRow.js'
import {Type} from '#/core/Type.js'
import {ListEditor} from '#/core/field/ListField.js'
import {MediaLocation} from '#/core/media/MediaLocation.js'
import {entryUrl, pathSuffix} from '#/core/util/EntryFilenames.js'
import {
  generateKeyBetween,
  generateNKeysBetween,
  isValidOrderKey
} from '#/core/util/FractionalIndexing.js'
import {entries, fromEntries, isRecord, keys} from '#/core/util/Objects.js'
import * as paths from '#/core/util/Paths.js'
import {slugify} from '#/core/util/Slugs.js'
import {unreachable} from '#/core/util/Types.js'
import type {MediaFile} from '../media/MediaTypes.js'
import {Permission, Policy} from '../Role.js'
import {ShaMismatchError} from '../source/ShaMismatchError.js'
import type {Source} from '../source/Source.js'
import {SourceTransaction} from '../source/Source.js'
import type {ReadonlyTree} from '../source/Tree.js'
import {assert} from '../util/Assert.js'
import {type CommitChange, commitChanges} from './CommitRequest.js'
import {aliasUrlsFromData, aliasUrl} from './EntryAliases.js'
import {EntryUrlConflictError} from './EntryUrlConflictError.js'
import type {
  ArchiveMutation,
  CreateMutation,
  MoveMutation,
  Mutation,
  PublishMutation,
  RemoveFileMutation,
  RemoveMutation,
  UnpublishMutation,
  UpdateMutation,
  UploadFileMutation
} from './Mutation.js'

type Op<T> = Omit<T, 'op'>

interface PathCandidate {
  id: string
  path: string
  parentId: string | null
  root: string
  workspace: string
  locale: string | null
}

interface UrlCandidate {
  id: string
  type: string
  path: string
  parentId: string | null
  parentPaths?: Array<string>
  workspace: string
  root: string
  locale: string | null
  data: Record<string, unknown>
  url?: string
}

interface EntryTransactionUrlClaim {
  id: string
  workspace: string
  root: string
  url: string
}

interface MoveTarget {
  id: string
  parentId: string | null
  workspace: string
  root: string
}

interface MoveUrlAliasUpdate {
  entry: Entry
  data: Record<string, unknown>
  filePath: string
}

interface TransactionCore extends Pick<
  Entry,
  | 'id'
  | 'versionStatus'
  | 'status'
  | 'title'
  | 'type'
  | 'seeded'
  | 'workspace'
  | 'root'
  | 'level'
  | 'index'
  | 'parentId'
  | 'parents'
  | 'locale'
  | 'active'
  | 'main'
  | 'path'
  | 'url'
> {}

const transactionCoreSelection = {
  id: EntryExpressions.id,
  versionStatus: EntryExpressions.versionStatus,
  status: EntryExpressions.status,
  title: EntryExpressions.title,
  type: EntryExpressions.type,
  seeded: EntryExpressions.seeded,
  workspace: EntryExpressions.workspace,
  root: EntryExpressions.root,
  level: EntryExpressions.level,
  index: EntryExpressions.index,
  parentId: EntryExpressions.parentId,
  parents: EntryExpressions.parents,
  locale: EntryExpressions.locale,
  active: EntryExpressions.active,
  main: EntryExpressions.main,
  path: EntryExpressions.path,
  url: EntryExpressions.url
}

const transactionEntrySelection = {
  id: EntryExpressions.id,
  versionStatus: EntryExpressions.versionStatus,
  status: EntryExpressions.status,
  title: EntryExpressions.title,
  type: EntryExpressions.type,
  seeded: EntryExpressions.seeded,
  workspace: EntryExpressions.workspace,
  root: EntryExpressions.root,
  level: EntryExpressions.level,
  filePath: EntryExpressions.filePath,
  parentDir: EntryExpressions.parentDir,
  childrenDir: EntryExpressions.childrenDir,
  index: EntryExpressions.index,
  parentId: EntryExpressions.parentId,
  parents: EntryExpressions.parents,
  locale: EntryExpressions.locale,
  rowHash: EntryExpressions.rowHash,
  active: EntryExpressions.active,
  main: EntryExpressions.main,
  path: EntryExpressions.path,
  fileHash: EntryExpressions.fileHash,
  url: EntryExpressions.url,
  data: EntryExpressions.data
}

export class EntryTransaction {
  #messages = [] as string[]
  #config: Config
  #graph: Graph
  #from: ReadonlyTree
  #tx: SourceTransaction
  #fileChanges = [] as CommitChange[]
  #policy: Policy
  #changedUrlClaimOwners = new Set<string>()
  #urlClaimUpdates = new Map<string, EntryTransactionUrlClaim>()

  constructor(
    config: Config,
    sha: string,
    graph: Graph,
    source: Source,
    from: ReadonlyTree,
    policy = Policy.ALLOW_ALL
  ) {
    if (sha !== from.sha) throw new ShaMismatchError(sha, from.sha)
    this.#config = config
    this.#graph = graph
    this.#from = from
    this.#tx = new SourceTransaction(source, from)
    this.#policy = policy
  }

  get empty() {
    return this.#messages.length === 0
  }

  async #entries(
    query: QuerySettings,
    includeHiddenVersions = false
  ): Promise<Array<Entry>> {
    const found = await this.#graph.find({
      ...query,
      status: query.status ?? 'all',
      includeHiddenVersions,
      select: transactionEntrySelection
    })
    return found.map(entry => ({...entry, searchableText: ''}))
  }

  #cores(query: QuerySettings): Promise<Array<TransactionCore>> {
    return this.#graph.find({
      ...query,
      status: query.status ?? 'all',
      select: transactionCoreSelection
    })
  }

  async #versions(id: string, locale?: string | null): Promise<Array<Entry>> {
    const versions = await this.#entries({id, locale}, true)
    return versions.map(entry => ({...entry, status: entry.versionStatus}))
  }

  async #sourceVersions(
    id: string,
    locale: string | null
  ): Promise<Array<Entry>> {
    const cores = await this.#graph.find({
      id,
      locale,
      status: 'all',
      includeHiddenVersions: true,
      select: transactionCoreSelection
    })
    return Promise.all(
      cores.map(async core => {
        const parentPaths = await this.#parentPaths(core.parentId, core.locale)
        const name = `${core.path}${core.versionStatus === 'published' ? '' : `.${core.versionStatus}`}.json`
        const filePath = Config.filePath(
          this.#config,
          core.workspace,
          core.root,
          core.locale,
          ...parentPaths,
          name
        ).toLowerCase()
        const parentDir = paths.dirname(filePath)
        const fileHash = this.#from.getLeaf(filePath).sha
        return {
          ...core,
          status: core.versionStatus,
          filePath,
          parentDir,
          childrenDir: paths.join(parentDir, core.path),
          rowHash: fileHash,
          fileHash,
          data: {},
          searchableText: ''
        }
      })
    )
  }

  async create({
    locale,
    type,
    data,
    root,
    workspace,
    fromSeed,
    parentId = null,
    id,
    insertOrder = 'last',
    status = 'published',
    overwrite = false
  }: Op<CreateMutation>) {
    assert(id, 'Create mutation is missing an id')
    const config = this.#config
    const existingVersions = await this.#versions(id)
    const existing = existingVersions[0]
    const language = existingVersions.filter(entry => entry.locale === locale)
    const existingMain = language.find(entry => entry.main)
    if (existing) {
      parentId = existing.parentId
      if (!workspace) workspace = existing.workspace
      if (!root) root = existing.root
      assert(
        existing.workspace === workspace,
        `Cannot create entry with id ${id} in workspace ${workspace}, already exists in ${existing.workspace}`
      )
      assert(
        existing.root === root,
        `Cannot create entry with id ${id} in root ${root}, already exists in ${existing.root}`
      )
    }
    const workspaces = keys(config.workspaces)
    if (!workspace) workspace = workspaces[0]
    assert(
      workspace in config.workspaces,
      `Workspace "${workspace}" not found in config`
    )
    const roots = keys(config.workspaces[workspace])
    if (!root) root = roots[0]
    assert(
      root in config.workspaces[workspace],
      `Root "${root}" not found in workspace "${workspace}"`
    )
    const rootConfig = this.#config.workspaces[workspace][root]
    assert(rootConfig, 'Invalid root')
    this.#policy.assert(Permission.Create, {
      workspace,
      root,
      type
    })
    const i18n = getRoot(rootConfig).i18n
    if (i18n) assert(i18n.locales.includes(locale as string), 'Invalid locale')
    else assert(locale === null, 'Invalid locale')
    let parent: Entry | undefined
    if (parentId) {
      parent = (await this.#entries({id: parentId, locale})).find(
        entry => entry.main
      )
      assert(parent, `Parent not found: ${parentId}`)
      this.#policy.assert(Permission.Create, parent)
    }
    const siblings = await this.#cores({workspace, root, parentId})
    assert(typeof data === 'object', 'Invalid data')
    const title = data.title ?? data.path
    assert(typeof title === 'string', 'Missing title')
    let path = slugify(typeof data.path === 'string' ? data.path : title)
    assert(path.length > 0, 'Invalid path')
    const existingPath = existingMain?.path
    const hasSamePath = existingPath === path
    if (!hasSamePath)
      path = await this.#getAvailablePath({
        id,
        path,
        parentId,
        root,
        workspace,
        locale
      })
    // Path changes are only carried out when the entry is published
    if (status !== 'published' && existingPath) path = existingPath
    if (existingPath && !hasSamePath && status === 'published') {
      await this.#rename(existing!.id, locale, path)
    }
    if (overwrite && existing?.type === 'MediaFile') {
      const prev = existingVersions.find(
        entry => entry.locale === null && entry.main
      )
      assert(prev, 'Previous entry not found')
      const prevLocation = prev.data.location
      if (prevLocation !== data.location)
        this.removeFile({
          location: MediaLocation.storagePath(
            this.#config,
            prev.workspace,
            prev.data.location as string
          )
        })
    }
    const parentDir = parent
      ? parent.childrenDir
      : Config.filePath(this.#config, workspace, root, locale)
    const filePath = paths.join(
      parentDir,
      `${path}${status === 'published' ? '' : `.${status}`}.json`
    )
    const hasSameVersion = language.some(entry => entry.status === status)
    const warnDuplicate = !overwrite && hasSameVersion
    assert(!warnDuplicate, `Cannot create duplicate entry with id ${id}`)
    let newIndex: string
    if (existing) {
      newIndex = existing.index
      if (status === 'published') {
        // Remove all different versions of the entry
        for (const version of language) this.#tx.remove(version.filePath)
      }
    } else {
      const previous =
        insertOrder === 'first' ? null : (siblings.at(-1) ?? null)
      const next = insertOrder === 'last' ? null : (siblings.at(0) ?? null)
      newIndex = generateKeyBetween(
        previous?.index ?? null,
        next?.index ?? null
      )
    }
    if (locale !== null && status === 'published') {
      // Start from other locales if found
      const from = existingVersions.find(
        entry => entry.locale !== locale && entry.status === 'published'
      )
      if (from) {
        const typeInstance = this.#config.schema[type]
        assert(typeInstance, `Type not found: ${type}`)
        const shared = Type.sharedData(typeInstance, from.data)
        data = {...shared, ...data}
      }
    }
    if (status === 'published') {
      const urlCandidate = {
        id,
        type,
        path,
        parentId,
        workspace,
        root,
        locale,
        data
      }
      data = await this.#dataWithPreviousUrlAlias(
        urlCandidate,
        await this.#publishedEntry(id, locale)
      )
      if (locale !== null)
        await this.#persistSharedFields(id, locale, type, data)
      await this.#assertUniqueUrls({...urlCandidate, data})
    }
    const seeded = fromSeed ?? existingMain?.seeded ?? null
    const record = createRecord(
      {id, type, index: newIndex, path, seeded, data, title},
      status
    )
    const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
    this.#tx.add(filePath, contents)
    this.#messages.push(this.#reportOp('create', title))
    return this
  }

  async #rename(entryId: string, locale: string | null, path: string) {
    const versions = await this.#entries({id: entryId, locale})
    for (const version of versions) {
      const name =
        version.status === 'published' ? path : `${path}.${version.status}`
      const filePath = paths.join(version.parentDir, `${name}.json`)
      this.#tx.rename(version.filePath, filePath)
      const childrenDir = paths.join(version.parentDir, path)
      this.#tx.rename(version.childrenDir, childrenDir)
    }
  }

  async update({id, locale, status, set}: Op<UpdateMutation>) {
    const entry = (await this.#entries({id, locale, status}))[0]
    assert(entry, `Entry not found: ${id}`)
    this.#policy.assert(Permission.Update, entry)
    for (const key of keys(set)) {
      this.#policy.assert(Permission.Update, {
        workspace: entry.workspace,
        root: entry.root,
        type: entry.type,
        id: entry.id,
        parents: entry.parents,
        locale: entry.locale,
        field: key
      })
    }
    const fieldUpdates = fromEntries(
      entries(set).map(([key, value]) => {
        return [key, value ?? null]
      })
    )
    let data = {...entry.data, ...fieldUpdates}
    const desiredPath = slugify(
      (data.path as string) ?? entry.data.path ?? entry.path
    )
    const lockPath = entry.status !== 'published' && !entry.main
    const path = lockPath
      ? entry.path
      : await this.#getAvailablePath({
          id,
          path: desiredPath,
          parentId: entry.parentId,
          root: entry.root,
          workspace: entry.workspace,
          locale
        })
    const childrenDir = paths.join(entry.parentDir, path)
    const filePath = `${childrenDir}${entry.status === 'published' ? '' : `.${entry.status}`}.json`
    if (entry.status === 'published') {
      this.#policy.assert(Permission.Publish, entry)
      if (filePath !== entry.filePath) await this.#rename(id, locale, path)
      const urlCandidate = {
        id,
        type: entry.type,
        path,
        parentId: entry.parentId,
        root: entry.root,
        workspace: entry.workspace,
        locale,
        data
      }
      data = await this.#dataWithPreviousUrlAlias(urlCandidate, entry)
      if (locale !== null)
        await this.#persistSharedFields(id, locale, entry.type, data)
      await this.#assertUniqueUrls({...urlCandidate, data})
    }
    const record = createRecord(
      {
        id,
        type: entry.type,
        index: entry.index,
        path: entry.path,
        seeded: entry.seeded,
        data
      },
      status
    )
    if (entry.status !== 'published' && path !== entry.path) record.path = path
    const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
    this.#tx.add(filePath, contents)
    this.#messages.push(this.#reportOp('update', entry.title))
    return this
  }

  async #getAvailablePath(target: PathCandidate) {
    const conflictingPaths = (
      await this.#cores({
        parentId: target.parentId,
        workspace: target.workspace,
        root: target.root,
        locale: target.locale
      })
    )
      .filter(
        entry =>
          entry.id !== target.id &&
          (entry.path === target.path ||
            entry.path.startsWith(`${target.path}-`))
      )
      .map(entry => entry.path)
    const suffix = pathSuffix(target.path, conflictingPaths)
    if (suffix !== undefined) return `${target.path}-${suffix}`
    return target.path
  }

  async #assertUniqueUrls(candidate: UrlCandidate) {
    const urls = await this.#candidateUrls(candidate)
    for (const url of urls) {
      const key = this.#urlClaimKey(candidate.workspace, candidate.root, url)
      const updated = this.#urlClaimUpdates.get(key)
      const storedEntry =
        (
          await this.#entries({
            workspace: candidate.workspace,
            root: candidate.root,
            status: 'published',
            url,
            take: 1
          })
        )[0] ??
        (
          await this.#entries({
            workspace: candidate.workspace,
            root: candidate.root,
            status: 'published',
            alias: url,
            take: 1
          })
        )[0]
      const stored = storedEntry
        ? {
            id: storedEntry.id,
            workspace: candidate.workspace,
            root: candidate.root,
            url
          }
        : undefined
      const existing =
        updated ??
        (stored && !this.#changedUrlClaimOwners.has(stored.id)
          ? stored
          : undefined)
      if (existing && existing.id !== candidate.id) {
        throw new EntryUrlConflictError({
          url,
          entryId: existing.id,
          workspace: candidate.workspace,
          root: candidate.root
        })
      }
    }
    this.#changedUrlClaimOwners.add(candidate.id)
    for (const [key, claim] of this.#urlClaimUpdates)
      if (claim.id === candidate.id) this.#urlClaimUpdates.delete(key)
    for (const url of urls) {
      this.#urlClaimUpdates.set(
        this.#urlClaimKey(candidate.workspace, candidate.root, url),
        {
          id: candidate.id,
          workspace: candidate.workspace,
          root: candidate.root,
          url
        }
      )
    }
  }

  async #candidateUrls(candidate: UrlCandidate): Promise<Array<string>> {
    return [
      await this.#resolvedUrl(candidate),
      ...aliasUrlsFromData(candidate.data)
    ]
  }

  async #resolvedUrl(candidate: UrlCandidate): Promise<string> {
    const type = this.#config.schema[candidate.type]
    assert(type, `Type not found: ${candidate.type}`)
    if (candidate.url !== undefined) return candidate.url
    return entryUrl(type, {
      config: this.#config,
      data: candidate.data,
      path: candidate.path,
      parentPaths:
        candidate.parentPaths ??
        (await this.#parentPaths(candidate.parentId, candidate.locale)),
      locale: candidate.locale,
      status: 'published',
      workspace: candidate.workspace,
      root: candidate.root
    })
  }

  async #dataWithPreviousUrlAlias(
    candidate: UrlCandidate,
    previousEntry: Entry | undefined
  ): Promise<Record<string, unknown>> {
    if (!previousEntry) return candidate.data
    const previousUrl = await this.#resolvedUrl(previousEntry)
    const currentUrl = await this.#resolvedUrl(candidate)
    if (previousUrl === currentUrl) return candidate.data
    const type = this.#config.schema[candidate.type]
    assert(type, `Type not found: ${candidate.type}`)
    return dataWithUrlAlias(type, candidate.data, previousUrl, currentUrl)
  }

  async #publishedEntry(
    id: string,
    locale: string | null
  ): Promise<Entry | undefined> {
    return (await this.#entries({id, locale, status: 'published'}))[0]
  }

  async #parentPaths(
    parentId: string | null,
    locale: string | null
  ): Promise<Array<string>> {
    if (!parentId) return []
    const parent = (
      await this.#cores({id: parentId, locale, includeHiddenVersions: true})
    ).find(entry => entry.main)
    assert(parent, `Missing parent language node`)
    const ancestorEntries = await this.#cores({
      id: {in: parent.parents},
      locale,
      includeHiddenVersions: true
    })
    const ancestors = parent.parents.map(id => {
      const ancestor = ancestorEntries.find(
        entry => entry.id === id && entry.main
      )
      assert(ancestor, `Missing parent language node`)
      return ancestor.path
    })
    return ancestors.concat(parent.path)
  }

  #urlClaimKey(workspace: string, root: string, url: string) {
    return `${workspace}\0${root}\0${url}`
  }

  async #persistSharedFields(
    id: string,
    locale: string,
    type: string,
    data: Record<string, unknown>
  ) {
    const typeInstance = this.#config.schema[type]
    assert(type, `Type not found: ${type}`)
    const shared = Type.sharedData(typeInstance, data)
    if (shared) {
      const translations = (await this.#entries({id})).filter(
        entry => entry.locale !== locale
      )
      for (const translation of translations) {
        const record = createRecord(
          {
            id,
            type: translation.type,
            index: translation.index,
            path: translation.path,
            seeded: translation.seeded,
            data: {
              ...translation.data,
              ...shared
            }
          },
          translation.status
        )
        const contents = new TextEncoder().encode(
          JSON.stringify(record, null, 2)
        )
        this.#tx.add(translation.filePath, contents)
      }
    }
  }

  async #moveUrlAliasUpdates(
    target: MoveTarget
  ): Promise<Array<MoveUrlAliasUpdate>> {
    const updates = Array<MoveUrlAliasUpdate>()
    const matchingCores = (await this.#cores({status: 'published'})).filter(
      entry => entry.id === target.id || entry.parents.includes(target.id)
    )
    const ids = [...new Set(matchingCores.map(entry => entry.id))]
    const entries =
      ids.length > 0
        ? await this.#entries({id: {in: ids}, status: 'published'})
        : []
    for (const entry of entries) {
      const parentPaths = await this.#movedParentPaths(entry, target)
      const candidate = {
        id: entry.id,
        type: entry.type,
        path: entry.path,
        parentId: entry.id === target.id ? target.parentId : entry.parentId,
        parentPaths,
        workspace: target.workspace,
        root: target.root,
        locale: entry.locale,
        data: entry.data
      }
      const data = await this.#dataWithPreviousUrlAlias(candidate, entry)
      await this.#assertUniqueUrls({...candidate, data})
      updates.push({
        entry,
        data,
        filePath: await this.#movedFilePath(entry, target)
      })
    }
    return updates
  }

  async #movedParentPaths(
    entry: Entry,
    target: MoveTarget
  ): Promise<Array<string>> {
    const movedLanguage = (await this.#versions(target.id, entry.locale)).find(
      version => version.main
    )
    assert(movedLanguage, `Missing moved entry language node`)
    const newParentPaths = await this.#parentPaths(
      target.parentId,
      entry.locale
    )
    if (entry.id === target.id) return newParentPaths

    const currentParentPaths = await this.#parentPaths(
      entry.parentId,
      entry.locale
    )
    const oldPrefix = (
      await this.#parentPaths(movedLanguage.parentId, entry.locale)
    ).concat(movedLanguage.path)
    const newPrefix = newParentPaths.concat(movedLanguage.path)
    assert(
      startsWithSegments(currentParentPaths, oldPrefix),
      `Moved child is outside moved entry path`
    )
    return newPrefix.concat(currentParentPaths.slice(oldPrefix.length))
  }

  async #movedFilePath(entry: Entry, target: MoveTarget): Promise<string> {
    const movedLanguage = (await this.#versions(target.id, entry.locale)).find(
      version => version.main
    )
    assert(movedLanguage, `Missing moved entry language node`)
    const parent = target.parentId
      ? (await this.#entries({id: target.parentId, locale: entry.locale}))[0]
      : undefined
    const parentDir = parent
      ? parent.childrenDir
      : Config.filePath(
          this.#config,
          target.workspace,
          target.root,
          entry.locale
        )
    const nextPrefix = paths.join(parentDir, movedLanguage.path)
    if (entry.id === target.id) {
      return `${nextPrefix}${entry.status === 'published' ? '' : `.${entry.status}`}.json`
    }
    const previousPrefix = movedLanguage.childrenDir
    assert(
      entry.filePath === previousPrefix ||
        entry.filePath.startsWith(`${previousPrefix}/`),
      `Moved child file is outside moved entry directory`
    )
    const suffix = entry.filePath
      .slice(previousPrefix.length)
      .replace(/^\//, '')
    return paths.join(nextPrefix, suffix)
  }

  async publish({id, locale, status}: Op<PublishMutation>) {
    const entry = (await this.#entries({id, locale, status}))[0]
    assert(entry, `Entry not found: ${id}`)
    this.#policy.assert(Permission.Publish, entry)
    const pathChange = entry.data.path && entry.data.path !== entry.path
    let path = slugify((entry.data.path as string) ?? entry.path)
    let data = entry.data
    path = await this.#getAvailablePath({
      id,
      path,
      parentId: entry.parentId,
      root: entry.root,
      workspace: entry.workspace,
      locale
    })
    const childrenDir = paths.join(entry.parentDir, path)
    const urlCandidate = {
      id,
      type: entry.type,
      path,
      parentId: entry.parentId,
      root: entry.root,
      workspace: entry.workspace,
      locale,
      data
    }
    data = await this.#dataWithPreviousUrlAlias(
      urlCandidate,
      await this.#publishedEntry(id, locale)
    )
    if (entry.locale !== null)
      await this.#persistSharedFields(id, entry.locale, entry.type, data)
    await this.#assertUniqueUrls({...urlCandidate, data})
    const versions = await this.#sourceVersions(id, locale)
    for (const version of versions) this.#tx.remove(version.filePath)
    this.#tx.remove(entry.filePath)
    const record = createRecord({...entry, path, data}, 'published')
    const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
    if (pathChange) {
      this.#tx.remove(`${entry.parentDir}/${entry.path}.json`)
      this.#tx.rename(entry.childrenDir, childrenDir)
    }
    this.#tx.add(`${childrenDir}.json`, contents)
    this.#messages.push(this.#reportOp('publish', entry.title))
    return this
  }

  async unpublish({id, locale}: Op<UnpublishMutation>) {
    const versions = await this.#sourceVersions(id, locale)
    const mainEntry = versions.find(entry => entry.main)
    assert(mainEntry, `Entry not found: ${id}`)
    this.#policy.assert(Permission.Publish, mainEntry)
    for (const version of versions) {
      if (version === mainEntry) continue
      this.#tx.remove(version.filePath)
    }
    this.#tx.rename(mainEntry.filePath, `${mainEntry.childrenDir}.draft.json`)
    this.#messages.push(this.#reportOp('unpublish', mainEntry.title))
    return this
  }

  async archive({id, locale}: Op<ArchiveMutation>) {
    const versions = await this.#sourceVersions(id, locale)
    const mainEntry = versions.find(entry => entry.main)
    assert(mainEntry, `Entry not found: ${id}`)
    this.#policy.assert(Permission.Archive, mainEntry)
    for (const version of versions) {
      if (version === mainEntry) continue
      this.#tx.remove(version.filePath)
    }
    this.#tx.rename(
      mainEntry.filePath,
      `${mainEntry.childrenDir}.archived.json`
    )
    this.#messages.push(this.#reportOp('archive', mainEntry.title))
    return this
  }

  async move({id, target, dropPosition, targetType}: Op<MoveMutation>) {
    targetType ??= 'entry'
    const entries = await this.#entries({id})
    assert(entries.length > 0, `Entry not found: ${id}`)
    const targetEntry =
      targetType === 'root'
        ? undefined
        : (await this.#entries({id: target, take: 1}))[0]
    assert(targetType === 'root' || targetEntry, `Target not found: ${target}`)
    assert(
      targetType === 'entry' || dropPosition === 'on',
      `Cannot move ${dropPosition} root ${target}`
    )
    const parentId =
      targetType === 'root'
        ? null
        : dropPosition === 'on'
          ? target
          : (targetEntry?.parentId ?? null)
    const root =
      targetType === 'root' ? target : (targetEntry?.root ?? entries[0].root)
    const workspace = targetEntry?.workspace ?? entries[0].workspace
    const action =
      parentId !== entries[0].parentId || root !== entries[0].root
        ? Permission.Move
        : Permission.Reorder
    for (const entry of entries) this.#policy.assert(action, entry)
    if (action === Permission.Move && parentId === null) {
      this.#policy.assert(Permission.Move, {workspace, root})
    }
    const siblingList = (await this.#cores({workspace, root, parentId})).filter(
      entry => entry.id !== id
    )
    let insertIndex = siblingList.length
    if (targetType !== 'root') {
      const targetIndex = siblingList.findIndex(entry => entry.id === target)
      if (dropPosition === 'before') {
        assert(targetIndex >= 0, `Sibling not found: ${target}`)
        insertIndex = targetIndex
      } else if (dropPosition === 'after') {
        assert(targetIndex >= 0, `Sibling not found: ${target}`)
        insertIndex = targetIndex + 1
      }
    }
    const previous = siblingList[insertIndex - 1] ?? null
    const next = siblingList[insertIndex] ?? null
    const seen = new Set()
    const hasDuplicates = siblingList.some(entry => {
      const wasSeen = seen.has(entry.index)
      if (wasSeen) return true
      seen.add(entry.index)
      return false
    })
    let newIndex: string
    if (hasDuplicates) {
      const self = entries[0]
      assert(self, `Entry not found: ${id}`)
      siblingList.splice(insertIndex, 0, self)
      for (const sibling of siblingList) {
        this.#policy.assert(Permission.Reorder, sibling)
      }
      const newKeys = generateNKeysBetween(null, null, siblingList.length)
      for (const [i, key] of newKeys.entries()) {
        const id = siblingList[i].id
        const versions = await this.#versions(id)
        for (const version of versions) {
          const record = createRecord(
            {
              id,
              type: version.type,
              index: key,
              path: version.path,
              seeded: version.seeded,
              data: version.data
            },
            version.status
          )
          const contents = new TextEncoder().encode(
            JSON.stringify(record, null, 2)
          )
          this.#tx.add(version.filePath, contents)
        }
      }
      newIndex = newKeys[insertIndex]
    } else {
      newIndex = generateKeyBetween(
        previous?.index ?? null,
        next?.index ?? null
      )
    }
    const moveUrlAliasUpdates =
      action === Permission.Move
        ? await this.#moveUrlAliasUpdates({id, parentId, workspace, root})
        : []
    const moveUrlAliasData = new Map(
      moveUrlAliasUpdates.map(update => [update.entry.filePath, update.data])
    )
    let info: Entry | undefined
    for (const entry of entries) {
      info = entry
      const parent = parentId
        ? (await this.#entries({id: parentId, locale: entry.locale}))[0]
        : undefined

      if (action === Permission.Move && parentId) {
        assert(!entry.seeded, `Cannot move seeded entry ${entry.filePath}`)
        assert(parent, `Parent not found: ${parentId}`)
        this.#policy.assert(Permission.Move, parent)
        // Check if the new parent is not a child of the entry
        assert(
          !parent?.childrenDir.startsWith(entry.childrenDir),
          'Cannot move entry into its own children'
        )
        const parentType = this.#config.schema[parent.type]
        const childType = this.#config.schema[entry.type]
        const allowed = Config.typeContains(this.#config, parentType, childType)
        assert(
          allowed,
          `Parent of type ${parent.type} does not allow children of type ${entry.type}`
        )
      }

      const parentDir = parent
        ? parent.childrenDir
        : Config.filePath(this.#config, workspace, root, entry.locale)
      const childrenDir = paths.join(parentDir, entry.path)
      const filePath = `${childrenDir}${entry.status === 'published' ? '' : `.${entry.status}`}.json`
      const data = moveUrlAliasData.get(entry.filePath) ?? entry.data
      const record = createRecord(
        {
          id,
          type: entry.type,
          index: newIndex,
          path: entry.path,
          seeded: entry.seeded,
          root,
          workspace,
          parentId,
          data
        },
        entry.status
      )
      const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
      if (action === Permission.Move) {
        this.#tx.remove(entry.filePath)
        this.#tx.rename(entry.childrenDir, childrenDir)
      }
      this.#tx.add(filePath, contents)
    }
    for (const update of moveUrlAliasUpdates) {
      const entry = update.entry
      if (entry.id === id || update.data === entry.data) continue
      const record = createRecord(
        {
          ...entry,
          root,
          workspace,
          data: update.data
        },
        entry.status
      )
      const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
      this.#tx.add(update.filePath, contents)
    }
    this.#messages.push(this.#reportOp('move', info!.title))
    return this
  }

  async remove({id, locale, status}: Op<RemoveMutation>) {
    const found = await this.#entries({id, locale, status})
    let info: Entry | undefined
    for (const entry of found) {
      if (entry.status === 'published')
        assert(!entry.seeded, `Cannot remove seeded entry ${entry.filePath}`)
      info = entry
      this.#tx.remove(entry.filePath)
      if (entry.status !== 'draft') {
        this.#tx.remove(entry.childrenDir)
      }
      if (entry.type === 'MediaLibrary') {
        // Find all files within children
        const fileCores = (
          await this.#cores({
            workspace: entry.workspace,
            root: entry.root
          })
        ).filter(
          candidate =>
            candidate.type === 'MediaFile' &&
            candidate.parents.includes(entry.id)
        )
        const ids = [...new Set(fileCores.map(file => file.id))]
        const files = ids.length > 0 ? await this.#entries({id: {in: ids}}) : []
        for (const file of files) {
          this.removeFile({
            location: MediaLocation.storagePath(
              this.#config,
              entry.workspace,
              file.data.location as string
            )
          })
        }
      }
      if (entry.type === 'MediaFile') {
        this.removeFile({
          location: MediaLocation.storagePath(
            this.#config,
            entry.workspace,
            (<Entry<MediaFile>>entry).data.location
          )
        })
      }
    }
    if (info) {
      this.#policy.assert(Permission.Delete, info)
      this.#messages.unshift(this.#reportOp('remove', info.title))
    }
    return this
  }

  removeFile(mutation: Op<RemoveFileMutation>) {
    this.#policy.assert(Permission.Delete)
    assert(mutation.location, 'Missing location')
    this.#messages.push(this.#reportOp('remove', mutation.location))
    this.#fileChanges.push({op: 'removeFile', ...mutation})
    return this
  }

  uploadFile(mutation: Op<UploadFileMutation>) {
    this.#policy.assert(Permission.Upload)
    this.#fileChanges.push({op: 'uploadFile', ...mutation})
    return this
  }

  description() {
    return this.#messages
      .map((message: string, index: number, all: Array<string>) => {
        if (index > 0) return message
        const suffix =
          all.length > 1 ? ` (and ${all.length - 1} other edits)` : ''
        return `${message + suffix}`
      })
      .join('\n')
  }

  #reportOp(op: string, title: string) {
    return `(${op}) ${title}`
  }

  async apply(mutations: ReadonlyArray<Mutation>): Promise<void> {
    for (const mutation of mutations) {
      switch (mutation.op) {
        case 'create':
          await this.create(mutation)
          break
        case 'update':
          await this.update(mutation)
          break
        case 'publish':
          await this.publish(mutation)
          break
        case 'unpublish':
          await this.unpublish(mutation)
          break
        case 'archive':
          await this.archive(mutation)
          break
        case 'move':
          await this.move(mutation)
          break
        case 'remove':
          await this.remove(mutation)
          break
        case 'removeFile':
          this.removeFile(mutation)
          break
        case 'uploadFile':
          this.uploadFile(mutation)
          break
        default:
          unreachable(mutation)
      }
    }
  }

  async toRequest() {
    const {from, into, changes} = await this.#tx.compile()
    return {
      fromSha: from.sha,
      intoSha: into.sha,
      description: this.description(),
      changes: this.#fileChanges.concat(commitChanges(changes))
    }
  }
}

function dataWithUrlAlias(
  type: Type,
  data: Record<string, unknown>,
  previousUrl: string,
  currentUrl: string
): Record<string, unknown> {
  const target = typeAliasTarget(type)
  if (!target) return data
  const aliasUrls = aliasUrlsFromData(data)
  if (aliasUrls.includes(previousUrl)) return data
  const nextData = aliasUrls.includes(currentUrl)
    ? dataWithoutUrlAlias(data, currentUrl)
    : data
  const metadata = isRecord(nextData.metadata) ? nextData.metadata : {}
  const aliases =
    target === 'metadata'
      ? Array.isArray(metadata.aliases)
        ? metadata.aliases
        : []
      : Array.isArray(nextData.aliases)
        ? nextData.aliases
        : []
  return dataWithAliases(
    nextData,
    target,
    metadata,
    aliases.concat(createUrlAliasRow(previousUrl, aliases))
  )
}

function dataWithoutUrlAlias(
  data: Record<string, unknown>,
  url: string
): Record<string, unknown> {
  let result = data
  if (Array.isArray(data.aliases)) {
    result = {
      ...result,
      aliases: data.aliases.filter(alias => aliasUrl(alias) !== url)
    }
  }
  const metadata = data.metadata
  if (isRecord(metadata) && Array.isArray(metadata.aliases)) {
    result = {
      ...result,
      metadata: {
        ...metadata,
        aliases: metadata.aliases.filter(alias => aliasUrl(alias) !== url)
      }
    }
  }
  return result
}

function dataWithAliases(
  data: Record<string, unknown>,
  target: AliasTarget,
  metadata: Record<string, unknown>,
  aliases: Array<unknown>
): Record<string, unknown> {
  if (target === 'aliases') return {...data, aliases}
  return {
    ...data,
    metadata: {
      ...metadata,
      aliases
    }
  }
}

type AliasTarget = 'aliases' | 'metadata'

interface UrlAliasRow extends ListRow {
  _type: 'alias'
  url: string
}

function typeAliasTarget(type: Type): AliasTarget | undefined {
  if (Type.field(type, 'aliases')) return 'aliases'
  const metadata = Type.field(type, 'metadata')
  if (!metadata) return undefined
  const options = Field.options(metadata)
  const fields = (options as {fields?: unknown}).fields
  if (!Type.isType(fields)) return undefined
  return Type.field(fields, 'aliases') ? 'metadata' : undefined
}

function createUrlAliasRow(url: string, aliases: Array<unknown>) {
  const orderedAliases = aliases.filter(isOrderedUrlAliasRow)
  const editor = new ListEditor<UrlAliasRow>(orderedAliases)
  const created = editor.add('alias', {url}).value().at(-1)
  assert(created)
  return created
}

function isOrderedUrlAliasRow(value: unknown): value is UrlAliasRow {
  if (!isRecord(value)) return false
  const id = value[ListRow.id]
  const index = value[ListRow.index]
  const type = value[ListRow.type]
  const url = value.url
  return (
    typeof id === 'string' &&
    typeof index === 'string' &&
    isValidOrderKey(index) &&
    type === 'alias' &&
    typeof url === 'string'
  )
}

function startsWithSegments(
  value: Array<string>,
  prefix: Array<string>
): boolean {
  return prefix.every((segment, index) => value[index] === segment)
}
