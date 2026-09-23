import {Config} from '#/core/Config.js'
import {Entry, entryStatuses} from '#/core/Entry.js'
import {createRecord} from '#/core/EntryRecord.js'
import type {QuerySettings} from '#/core/Graph.js'
import {getRoot} from '#/core/Internal.js'
import {MediaLocation} from '#/core/media/MediaLocation.js'
import {Permission, type Policy} from '#/core/Role.js'
import {Type} from '#/core/Type.js'
import type {ChangesBatch} from '#/core/source/Change.js'
import {OverlaySource} from '#/core/source/OverlaySource.js'
import {bundleContents, SourceTransaction} from '#/core/source/Source.js'
import type {ReadonlyTree} from '#/core/source/Tree.js'
import {assert} from '#/core/util/Assert.js'
import {
  entryUrl,
  entryVersionFile,
  pathSuffix
} from '#/core/util/EntryFilenames.js'
import {
  generateKeyBetween,
  generateNKeysBetween
} from '#/core/util/FractionalIndexing.js'
import {entries, fromEntries, keys} from '#/core/util/Objects.js'
import * as paths from '#/core/util/Paths.js'
import {slugify} from '#/core/util/Slugs.js'
import {unreachable} from '#/core/util/Types.js'
import {
  type CommitChange,
  type CommitRequest,
  commitChanges
} from '#/core/db/CommitRequest.js'
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
} from '#/core/db/Mutation.js'
import {EntryUrlConflictError} from '#/core/db/EntryUrlConflictError.js'
import type {EntryLayer} from './EntryLayer.js'
import {dataWithUrlAlias} from './EntryUrlAliases.js'

type Op<T> = Omit<T, 'op'>

/**
 * A queried entry version. Compare `IndexedEntry` in entry/EntryTable.ts:
 * nothing here selects the extra columns it adds.
 */
type TransactionEntry = Entry & Required<Pick<Entry, 'versionStatus'>>

interface UrlCandidate extends Pick<
  Entry,
  'id' | 'type' | 'path' | 'parentId' | 'workspace' | 'root' | 'locale' | 'data'
> {
  parentPaths?: Array<string>
  url?: string
}

/** Where an entry version lives in the tree. */
interface EntryLocation {
  parentId: string | null
  workspace: string
  root: string
  locale?: string | null
}

interface MoveTarget extends EntryLocation {
  id: string
}

interface MoveUrlAliasUpdate {
  entry: TransactionEntry
  data: Record<string, unknown>
  /** Undefined for the moved entry itself, which is written by `move`. */
  filePath: string | undefined
}

// Excludes only the metadata sub-path exprs, which are not entry columns
const {aliases, createdAt, createdBy, updatedAt, updatedBy, ...EntrySelection} =
  Entry

/**
 * Plans mutations inside the receiver's write transaction. Each mutation is
 * flushed so subsequent mutations query its result without retaining an
 * in-memory entry index. SQLite rolls the full batch back on failure.
 */
export class EntryTransaction implements AsyncDisposable {
  #workingDatabase: EntryLayer
  #workingSource: OverlaySource
  #fromTree: ReadonlyTree
  #workingTree: ReadonlyTree
  #sourceTransaction: SourceTransaction
  #policy: Policy
  #messages = Array<string>()
  #fileChanges = Array<CommitChange>()
  #changedEntryIds = new Set<string>()
  #closed = false

  /** @internal Constructed by EntryLayer.apply. */
  constructor(
    workingDatabase: EntryLayer,
    workingSource: OverlaySource,
    sourceTransaction: SourceTransaction,
    from: ReadonlyTree,
    policy: Policy
  ) {
    this.#workingDatabase = workingDatabase
    this.#workingSource = workingSource
    this.#fromTree = from
    this.#workingTree = from
    this.#sourceTransaction = sourceTransaction
    this.#policy = policy
  }

  get changedEntryIds(): Array<string> {
    return Array.from(this.#changedEntryIds).sort()
  }

  async apply(mutations: ReadonlyArray<Mutation>): Promise<void> {
    this.#assertOpen()
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
      await this.#flush()
    }
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
  }: Op<CreateMutation>): Promise<void> {
    assert(id, 'Create mutation is missing an id')
    const config = this.#workingDatabase.config
    const existing = await this.#versions(id)
    const existingMain = existing.find(
      entry => entry.locale === locale && entry.main
    )
    if (existingMain) {
      parentId = existingMain.parentId
      workspace ??= existingMain.workspace
      root ??= existingMain.root
      assert(
        existingMain.workspace === workspace,
        `Cannot create entry with id ${id} in workspace ${workspace}, already exists in ${existingMain.workspace}`
      )
      assert(
        existingMain.root === root,
        `Cannot create entry with id ${id} in root ${root}, already exists in ${existingMain.root}`
      )
    }
    // A new translation lives in the same workspace and root as the entry's
    // other locales
    const sibling = existing[0]
    if (sibling) {
      workspace ??= sibling.workspace
      root ??= sibling.root
    }
    workspace ??= keys(config.workspaces)[0]
    assert(
      workspace in config.workspaces,
      `Workspace "${workspace}" not found in config`
    )
    root ??= keys(config.workspaces[workspace])[0]
    assert(
      root in config.workspaces[workspace],
      `Root "${root}" not found in workspace "${workspace}"`
    )
    const rootConfig = config.workspaces[workspace][root]
    assert(rootConfig, 'Invalid root')
    this.#policy.assert(Permission.Create, {workspace, root, type})
    const i18n = getRoot(rootConfig).i18n
    if (i18n) assert(i18n.locales.includes(locale as string), 'Invalid locale')
    else assert(locale === null, 'Invalid locale')

    let parent: TransactionEntry | undefined
    if (parentId) {
      parent = await this.#firstEntry({id: parentId, locale, main: true})
      assert(parent, `Parent not found: ${parentId}`)
      this.#policy.assert(Permission.Create, parent)
    }
    assert(typeof data === 'object', 'Invalid data')
    const title = data.title ?? data.path
    assert(typeof title === 'string', 'Missing title')
    let path = slugify(typeof data.path === 'string' ? data.path : title)
    assert(path.length > 0, 'Invalid path')
    const existingPath = existingMain?.path
    if (existingPath !== path)
      path = await this.#availablePath(path, {
        id,
        parentId,
        root,
        workspace,
        locale
      })
    if (status !== 'published' && existingPath) path = existingPath
    if (existingPath && existingPath !== path && status === 'published')
      await this.#rename(id, locale, path)

    if (overwrite && existingMain?.type === 'MediaFile') {
      const previousLocation = existingMain.data.location
      if (
        previousLocation !== data.location &&
        typeof previousLocation === 'string'
      )
        this.removeFile({
          location: MediaLocation.storagePath(
            config,
            existingMain.workspace,
            previousLocation
          )
        })
    }
    assert(
      overwrite ||
        !existing.some(
          entry => entry.locale === locale && entry.versionStatus === status
        ),
      `Cannot create duplicate entry with id ${id}`
    )
    const siblings = await this.#siblings({
      parentId,
      workspace,
      root,
      locale
    })
    let index = existingMain?.index ?? existing.at(0)?.index
    if (!index) {
      const previous =
        insertOrder === 'first' ? null : (siblings.at(-1) ?? null)
      const next = insertOrder === 'last' ? null : (siblings.at(0) ?? null)
      index = generateKeyBetween(previous?.index ?? null, next?.index ?? null)
    }
    if (status === 'published') {
      for (const version of existing.filter(entry => entry.locale === locale))
        this.#sourceTransaction.remove(version.filePath)
    }
    const parentDir = await this.#parentDir(
      parentId,
      locale,
      workspace,
      root,
      parent
    )
    const filePath = paths.join(parentDir, entryVersionFile(path, status))
    if (locale !== null && status === 'published') {
      const from = existing.find(
        entry => entry.locale !== locale && entry.versionStatus === 'published'
      )
      if (from) {
        const typeInstance = config.schema[type]
        assert(typeInstance, `Type not found: ${type}`)
        // Fill in shared fields missing from data without moving its keys
        const shared = Type.sharedData(typeInstance, from.data) ?? {}
        const missing = entries(shared).filter(
          ([key]) => data[key] === undefined
        )
        if (missing.length > 0) data = {...data, ...fromEntries(missing)}
      }
    }
    if (status === 'published')
      data = await this.#publishedData(
        {id, type, path, parentId, workspace, root, locale, data},
        await this.#firstEntry({
          id,
          locale,
          versionStatus: {in: ['published']}
        })
      )
    const record = createRecord(
      {
        id,
        type,
        index,
        path,
        seeded: fromSeed ?? existingMain?.seeded ?? null,
        data,
        title
      },
      status
    )
    if (fromSeed && data.title === undefined) delete record.title
    this.#addRecord(filePath, record)
    this.#messages.push(this.#report('create', title))
  }

  async update({id, locale, status, set}: Op<UpdateMutation>): Promise<void> {
    assert(id, 'Update mutation is missing an id')
    const entry = await this.#firstEntry({
      id,
      locale,
      versionStatus: {in: [status]}
    })
    assert(entry, `Entry not found: ${id}`)
    this.#policy.assert(Permission.Update, entry)
    for (const key of keys(set))
      this.#policy.assert(Permission.Update, {
        workspace: entry.workspace,
        root: entry.root,
        type: entry.type,
        id: entry.id,
        parents: entry.parents,
        locale: entry.locale,
        field: key
      })
    const updates = fromEntries(
      entries(set).map(([key, value]) => [key, value ?? null])
    )
    let data = {...entry.data, ...updates}
    const desiredPath = slugify(
      (data.path as string) ?? entry.data.path ?? entry.path
    )
    const lockPath = entry.versionStatus !== 'published' && !entry.main
    const path = lockPath
      ? entry.path
      : await this.#availablePath(desiredPath, {
          id,
          parentId: entry.parentId,
          root: entry.root,
          workspace: entry.workspace,
          locale
        })
    const childrenDir = paths.join(entry.parentDir, path)
    const filePath = entryVersionFile(childrenDir, entry.versionStatus)
    if (entry.versionStatus === 'published') {
      this.#policy.assert(Permission.Publish, entry)
      if (filePath !== entry.filePath) await this.#rename(id, locale, path)
      data = await this.#publishedData(
        {
          id,
          type: entry.type,
          path,
          parentId: entry.parentId,
          root: entry.root,
          workspace: entry.workspace,
          locale,
          data
        },
        entry
      )
    }
    const record = createRecord(
      {
        id,
        type: entry.type,
        index: entry.index,
        path,
        seeded: entry.seeded,
        data
      },
      entry.versionStatus
    )
    if (entry.versionStatus !== 'published' && path !== entry.path)
      record.path = path
    this.#addRecord(filePath, record)
    this.#messages.push(this.#report('update', entry.title))
  }

  async publish({id, locale, status}: Op<PublishMutation>): Promise<void> {
    assert(id, 'Publish mutation is missing an id')
    const versions = await this.#versions(id, locale)
    const entry = versions.find(version => version.versionStatus === status)
    assert(entry, `Entry not found: ${id}`)
    this.#policy.assert(Permission.Publish, entry)
    const path = await this.#availablePath(
      slugify((entry.data.path as string) ?? entry.path),
      {
        id,
        parentId: entry.parentId,
        root: entry.root,
        workspace: entry.workspace,
        locale
      }
    )
    const childrenDir = paths.join(entry.parentDir, path)
    const data = await this.#publishedData(
      {
        id,
        type: entry.type,
        path,
        parentId: entry.parentId,
        root: entry.root,
        workspace: entry.workspace,
        locale,
        data: entry.data
      },
      versions.find(version => version.versionStatus === 'published')
    )
    for (const version of versions)
      this.#sourceTransaction.remove(version.filePath)
    if (entry.path !== path)
      this.#sourceTransaction.rename(entry.childrenDir, childrenDir)
    this.#addRecord(
      `${childrenDir}.json`,
      createRecord({...entry, path, data}, 'published')
    )
    this.#messages.push(this.#report('publish', entry.title))
  }

  async unpublish({id, locale}: Op<UnpublishMutation>): Promise<void> {
    assert(id, 'Unpublish mutation is missing an id')
    await this.#changeMainStatus(id, locale, 'draft', Permission.Publish)
  }

  async archive({id, locale}: Op<ArchiveMutation>): Promise<void> {
    assert(id, 'Archive mutation is missing an id')
    await this.#changeMainStatus(id, locale, 'archived', Permission.Archive)
  }

  async #changeMainStatus(
    id: string,
    locale: string | null,
    status: 'draft' | 'archived',
    permission: Permission
  ): Promise<void> {
    const versions = await this.#versions(id, locale)
    const main = versions.find(entry => entry.main)
    assert(main, `Entry not found: ${id}`)
    this.#policy.assert(permission, main)
    for (const version of versions) {
      if (version !== main) this.#sourceTransaction.remove(version.filePath)
    }
    this.#sourceTransaction.rename(
      main.filePath,
      entryVersionFile(main.childrenDir, status)
    )
    this.#messages.push(
      this.#report(status === 'draft' ? 'unpublish' : 'archive', main.title)
    )
  }

  async move({
    id,
    target,
    dropPosition,
    targetType = 'entry'
  }: Op<MoveMutation>): Promise<void> {
    assert(id, 'Move mutation is missing an id')
    const moving = await this.#versions(id)
    assert(moving.length, `Entry not found: ${id}`)
    let parentId: string | null
    let root: string
    let workspace: string
    if (targetType === 'root') {
      parentId = null
      root = target
      workspace = moving[0].workspace
    } else {
      const targetEntry = await this.#firstEntry({id: target, main: true})
      assert(targetEntry, `Target not found: ${target}`)
      parentId = dropPosition === 'on' ? target : targetEntry.parentId
      root = targetEntry.root
      workspace = targetEntry.workspace
    }
    assert(
      targetType === 'entry' || dropPosition === 'on',
      `Cannot move ${dropPosition} root ${target}`
    )
    const action =
      parentId !== moving[0].parentId || root !== moving[0].root
        ? Permission.Move
        : Permission.Reorder
    for (const entry of moving) this.#policy.assert(action, entry)
    if (action === Permission.Move && parentId === null)
      this.#policy.assert(Permission.Move, {workspace, root})
    const moveTarget = {id, parentId, workspace, root}
    const aliasUpdates =
      action === Permission.Move
        ? await this.#moveUrlAliasUpdates(moveTarget, moving)
        : []
    const aliasDataByFilePath = new Map(
      aliasUpdates.map(update => [update.entry.filePath, update.data])
    )
    const siblings = (await this.#siblings({parentId, workspace, root})).filter(
      entry => entry.id !== id && entry.main
    )
    let insertion = siblings.length
    if (targetType !== 'root') {
      const targetIndex = siblings.findIndex(entry => entry.id === target)
      if (dropPosition === 'before') {
        assert(targetIndex >= 0, `Sibling not found: ${target}`)
        insertion = targetIndex
      } else if (dropPosition === 'after') {
        assert(targetIndex >= 0, `Sibling not found: ${target}`)
        insertion = targetIndex + 1
      }
    }
    const index = await this.#insertionIndex(siblings, insertion, moving)
    for (const entry of moving) {
      let parent: TransactionEntry | undefined
      if (action === Permission.Move && parentId) {
        parent = await this.#firstEntry({
          id: parentId,
          locale: entry.locale,
          main: true
        })
        assert(parent, `Parent not found: ${parentId}`)
        assert(!entry.seeded, `Cannot move seeded entry ${entry.filePath}`)
        assert(
          !parent.parents.includes(id) && parent.id !== id,
          'Cannot move entry into its own children'
        )
        this.#policy.assert(Permission.Move, parent)
        const parentType = this.#workingDatabase.config.schema[parent.type]
        const childType = this.#workingDatabase.config.schema[entry.type]
        assert(
          Config.typeContains(
            this.#workingDatabase.config,
            parentType,
            childType
          ),
          `Parent of type ${parent.type} does not allow children of type ${entry.type}`
        )
      }
      const parentDir = await this.#parentDir(
        parentId,
        entry.locale,
        workspace,
        root,
        parent
      )
      // Siblings must never share a path: dedupe like create and update do,
      // otherwise the moved file would overwrite its sibling.
      const path =
        action === Permission.Move
          ? await this.#availablePath(entry.path, {
              id,
              parentId,
              root,
              workspace,
              locale: entry.locale
            })
          : entry.path
      const childrenDir = paths.join(parentDir, path)
      const filePath = entryVersionFile(childrenDir, entry.versionStatus)
      if (action === Permission.Move) {
        this.#sourceTransaction.remove(entry.filePath)
        this.#sourceTransaction.rename(entry.childrenDir, childrenDir)
      }
      const record = createRecord(
        {
          ...entry,
          index,
          root,
          workspace,
          parentId,
          data: aliasDataByFilePath.get(entry.filePath) ?? entry.data
        },
        entry.versionStatus
      )
      if (entry.versionStatus !== 'published' && path !== entry.path)
        record.path = path
      this.#addRecord(filePath, record)
    }
    for (const update of aliasUpdates) {
      // The moved entry itself was written above, at its available path
      if (update.filePath === undefined || update.data === update.entry.data)
        continue
      this.#addRecord(
        update.filePath,
        createRecord(
          {
            ...update.entry,
            root,
            workspace,
            data: update.data
          },
          update.entry.versionStatus
        )
      )
    }
    this.#messages.push(this.#report('move', moving[0].title))
  }

  async remove({id, locale, status}: Op<RemoveMutation>): Promise<void> {
    assert(id, 'Remove mutation is missing an id')
    const found = (await this.#versions(id, locale)).filter(
      entry => status === undefined || entry.versionStatus === status
    )
    for (const entry of found) {
      if (entry.versionStatus === 'published')
        assert(!entry.seeded, `Cannot remove seeded entry ${entry.filePath}`)
      this.#sourceTransaction.remove(entry.filePath)
      if (entry.versionStatus !== 'draft')
        this.#sourceTransaction.remove(entry.childrenDir)
      if (entry.type === 'MediaLibrary') {
        const files = await this.#mediaFiles({
          workspace: entry.workspace,
          root: entry.root,
          filePathPrefix: `${entry.childrenDir}/`
        })
        for (const file of files) this.#removeMediaFile(file)
      } else if (entry.type === 'MediaFile') this.#removeMediaFile(entry)
    }
    const info = found[0]
    if (info) {
      this.#policy.assert(Permission.Delete, info)
      this.#messages.unshift(this.#report('remove', info.title))
    }
  }

  removeFile(mutation: Op<RemoveFileMutation>): void {
    this.#policy.assert(Permission.Delete)
    assert(mutation.location, 'Missing location')
    this.#messages.push(this.#report('remove', mutation.location))
    this.#fileChanges.push({op: 'removeFile', ...mutation})
  }

  uploadFile(mutation: Op<UploadFileMutation>): void {
    this.#policy.assert(Permission.Upload)
    this.#fileChanges.push({op: 'uploadFile', ...mutation})
  }

  #description(): string {
    return this.#messages
      .map((message, index, all) => {
        if (index) return message
        const suffix =
          all.length > 1 ? ` (and ${all.length - 1} other edits)` : ''
        return message + suffix
      })
      .join('\n')
  }

  async toRequest(): Promise<CommitRequest> {
    this.#assertOpen()
    const {changes} = await bundleContents(
      this.#workingSource,
      this.#fromTree.diff(this.#workingTree)
    )
    return {
      fromSha: this.#fromTree.sha,
      intoSha: this.#workingTree.sha,
      description: this.#description(),
      changes: this.#fileChanges.concat(commitChanges(changes))
    }
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    await this.#workingDatabase.close()
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close()
  }

  async #flush(): Promise<void> {
    const {from, into, changes} = await this.#sourceTransaction.compile(
      this.#workingTree
    )
    const batch: ChangesBatch = {fromSha: from.sha, changes}
    if (changes.length) {
      await this.#workingSource.applyChangesTo(batch, into)
      const result = await this.#workingDatabase.syncWith(this.#workingSource)
      for (const id of result.changedEntryIds) this.#changedEntryIds.add(id)
    }
    this.#workingTree = into
  }

  #addRecord(filePath: string, record: Record<string, unknown>): void {
    this.#sourceTransaction.add(
      filePath,
      new TextEncoder().encode(JSON.stringify(record, null, 2))
    )
  }

  async #rename(
    id: string,
    locale: string | null,
    path: string
  ): Promise<void> {
    const versions = await this.#versions(id, locale)
    for (const version of versions) {
      this.#sourceTransaction.rename(
        version.filePath,
        paths.join(
          version.parentDir,
          entryVersionFile(path, version.versionStatus)
        )
      )
      this.#sourceTransaction.rename(
        version.childrenDir,
        paths.join(version.parentDir, path)
      )
    }
  }

  /**
   * The fractional index the moved entry takes between its new siblings.
   * Siblings with colliding indexes are reindexed first.
   */
  async #insertionIndex(
    siblings: ReadonlyArray<TransactionEntry>,
    insertion: number,
    moving: ReadonlyArray<TransactionEntry>
  ): Promise<string> {
    const duplicateIndexes =
      new Set(siblings.map(entry => entry.index)).size !== siblings.length
    if (!duplicateIndexes)
      return generateKeyBetween(
        siblings[insertion - 1]?.index ?? null,
        siblings[insertion]?.index ?? null
      )
    const ordered = siblings.slice()
    ordered.splice(insertion, 0, moving[0])
    for (const sibling of ordered)
      this.#policy.assert(Permission.Reorder, sibling)
    const generated = generateNKeysBetween(null, null, ordered.length)
    for (const [position, sibling] of ordered.entries()) {
      const versions = await this.#versions(sibling.id)
      for (const version of versions)
        this.#addRecord(
          version.filePath,
          createRecord(
            {...version, index: generated[position]},
            version.versionStatus
          )
        )
    }
    return generated[insertion]
  }

  async #availablePath(
    path: string,
    location: EntryLocation & {id: string}
  ): Promise<string> {
    const siblings = await this.#siblings(location)
    const conflicting = siblings
      .filter(
        entry =>
          entry.id !== location.id &&
          (entry.path === path || entry.path.startsWith(`${path}-`))
      )
      .map(entry => entry.path)
    const suffix = pathSuffix(path, conflicting)
    return suffix === undefined ? path : `${path}-${suffix}`
  }

  async #assertUniqueUrls(candidate: UrlCandidate): Promise<void> {
    const url = await this.#resolvedUrl(candidate)
    const scope =
      candidate.type === 'MediaFile'
        ? {}
        : {workspace: candidate.workspace, root: candidate.root}
    const existing = await this.#workingDatabase.first({
      ...scope,
      url,
      select: {
        id: Entry.id,
        workspace: Entry.workspace,
        root: Entry.root
      }
    })
    if (existing && existing.id !== candidate.id)
      throw new EntryUrlConflictError({
        url,
        entryId: existing.id,
        workspace: existing.workspace,
        root: existing.root
      })
  }

  async #resolvedUrl(candidate: UrlCandidate): Promise<string> {
    const type = this.#workingDatabase.config.schema[candidate.type]
    assert(type, `Type not found: ${candidate.type}`)
    if (candidate.url !== undefined) return candidate.url
    return entryUrl(type, {
      config: this.#workingDatabase.config,
      path: candidate.path,
      parentPaths:
        candidate.parentPaths ??
        (await this.#parentPaths(candidate.parentId, candidate.locale)),
      locale: candidate.locale,
      status: 'published',
      workspace: candidate.workspace,
      root: candidate.root,
      data: candidate.data
    })
  }

  async #dataWithPreviousUrlAlias(
    candidate: UrlCandidate,
    previous: Entry | undefined
  ): Promise<Record<string, unknown>> {
    if (!previous) return candidate.data
    const [previousUrl, currentUrl] = await Promise.all([
      this.#resolvedUrl(previous),
      this.#resolvedUrl(candidate)
    ])
    if (previousUrl === currentUrl) return candidate.data
    const type = this.#workingDatabase.config.schema[candidate.type]
    assert(type, `Type not found: ${candidate.type}`)
    return dataWithUrlAlias(type, candidate.data, previousUrl, currentUrl)
  }

  /**
   * Carry over the previous URL as an alias, share translated fields and
   * guard URL uniqueness for an entry that is about to be published.
   */
  async #publishedData(
    candidate: UrlCandidate,
    previous: Entry | undefined,
    shareFields = true
  ): Promise<Record<string, unknown>> {
    const data = await this.#dataWithPreviousUrlAlias(candidate, previous)
    const {locale} = candidate
    if (shareFields && locale !== null)
      await this.#persistSharedFields(
        candidate.id,
        locale,
        candidate.type,
        data
      )
    await this.#assertUniqueUrls({...candidate, data})
    return data
  }

  async #parentDir(
    parentId: string | null,
    locale: string | null,
    workspace: string,
    root: string,
    known?: TransactionEntry
  ): Promise<string> {
    const parent =
      known ??
      (parentId
        ? await this.#firstEntry({id: parentId, locale, main: true})
        : undefined)
    return parent
      ? parent.childrenDir
      : Config.filePath(this.#workingDatabase.config, workspace, root, locale)
  }

  async #parentPaths(
    parentId: string | null,
    locale: string | null
  ): Promise<Array<string>> {
    if (!parentId) return []
    const parent = await this.#firstEntry({id: parentId, locale, main: true})
    assert(parent, `Missing parent language node`)
    const ids = parent.parents.concat(parent.id)
    const entries = (await this.#workingDatabase.find({
      id: {in: ids},
      locale,
      main: true,
      status: 'all',
      select: {id: Entry.id, path: Entry.path}
    })) as Array<{id: string; path: string}>
    const pathById = new Map(entries.map(entry => [entry.id, entry.path]))
    return ids.map(id => {
      const path = pathById.get(id)
      assert(path !== undefined, `Missing parent language node`)
      return path
    })
  }

  async #persistSharedFields(
    id: string,
    locale: string,
    type: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const typeInstance = this.#workingDatabase.config.schema[type]
    assert(typeInstance, `Type not found: ${type}`)
    const shared = Type.sharedData(typeInstance, data)
    if (!shared) return
    const translations = (await this.#versions(id)).filter(
      entry => entry.locale !== locale
    )
    for (const translation of translations) {
      // Leave translations alone unless a shared value actually changed
      const changed = entries(shared).some(
        ([key, value]) =>
          JSON.stringify(value) !== JSON.stringify(translation.data[key])
      )
      if (!changed) continue
      this.#addRecord(
        translation.filePath,
        createRecord(
          {
            id,
            type: translation.type,
            index: translation.index,
            path: translation.path,
            seeded: translation.seeded,
            data: {...translation.data, ...shared}
          },
          translation.versionStatus
        )
      )
    }
  }

  async #moveUrlAliasUpdates(
    target: MoveTarget,
    moving: ReadonlyArray<TransactionEntry>
  ): Promise<Array<MoveUrlAliasUpdate>> {
    const published = moving.filter(
      entry => entry.versionStatus === 'published'
    )
    const descendants = Array<TransactionEntry>()
    for (const entry of published)
      descendants.push(
        ...(await this.#findEntries({
          status: 'published',
          filePath: {startsWith: `${entry.childrenDir}/`}
        }))
      )
    const updates = Array<MoveUrlAliasUpdate>()
    for (const entry of published.concat(descendants)) {
      const moved = moving.find(
        candidate => candidate.locale === entry.locale && candidate.main
      )
      assert(moved, `Missing moved entry language node`)
      const isMoved = entry.id === target.id
      const data = await this.#publishedData(
        {
          id: entry.id,
          type: entry.type,
          path: entry.path,
          parentId: isMoved ? target.parentId : entry.parentId,
          parentPaths: await this.#movedParentPaths(entry, target, moved),
          workspace: target.workspace,
          root: target.root,
          locale: entry.locale,
          data: entry.data
        },
        entry,
        false
      )
      updates.push({
        entry,
        data,
        // The moved entry is written by `move` at its deduped path
        filePath: isMoved
          ? undefined
          : await this.#movedFilePath(entry, target, moved)
      })
    }
    return updates
  }

  async #movedParentPaths(
    entry: TransactionEntry,
    target: MoveTarget,
    moved: TransactionEntry
  ): Promise<Array<string>> {
    const newParentPaths = await this.#parentPaths(
      target.parentId,
      entry.locale
    )
    if (entry.id === target.id) return newParentPaths
    const [currentParentPaths, previousParentPaths] = await Promise.all([
      this.#parentPaths(entry.parentId, entry.locale),
      this.#parentPaths(moved.parentId, entry.locale)
    ])
    const previousPrefix = previousParentPaths.concat(moved.path)
    const nextPrefix = newParentPaths.concat(moved.path)
    assert(
      previousPrefix.every(
        (segment, index) => currentParentPaths[index] === segment
      ),
      `Moved child is outside moved entry path`
    )
    return nextPrefix.concat(currentParentPaths.slice(previousPrefix.length))
  }

  /** The file path a descendant of the moved entry ends up at. */
  async #movedFilePath(
    entry: TransactionEntry,
    target: MoveTarget,
    moved: TransactionEntry
  ): Promise<string> {
    const parentDir = await this.#parentDir(
      target.parentId,
      entry.locale,
      target.workspace,
      target.root
    )
    const nextPrefix = paths.join(parentDir, moved.path)
    assert(
      entry.filePath === moved.childrenDir ||
        entry.filePath.startsWith(`${moved.childrenDir}/`),
      `Moved child file is outside moved entry directory`
    )
    const suffix = entry.filePath
      .slice(moved.childrenDir.length)
      .replace(/^\//, '')
    return paths.join(nextPrefix, suffix)
  }

  /** Query entry versions, including every status unless the query says so. */
  #findEntries(query: QuerySettings): Promise<Array<TransactionEntry>> {
    return this.#workingDatabase.find({
      status: 'all',
      ...query,
      select: EntrySelection
    }) as Promise<Array<TransactionEntry>>
  }

  async #firstEntry(
    query: QuerySettings
  ): Promise<TransactionEntry | undefined> {
    return (
      ((await this.#workingDatabase.first({
        status: 'all',
        ...query,
        select: EntrySelection
      })) as TransactionEntry | null) ?? undefined
    )
  }

  #versions(
    id: string,
    locale?: string | null
  ): Promise<Array<TransactionEntry>> {
    return this.#findEntries({
      versionStatus: {in: entryStatuses},
      id,
      locale
    })
  }

  #siblings(location: EntryLocation): Promise<Array<TransactionEntry>> {
    return this.#findEntries({
      parentId: location.parentId,
      workspace: location.workspace,
      root: location.root,
      locale: location.locale
    })
  }

  #mediaFiles(location: {
    workspace: string
    root: string
    filePathPrefix: string
  }): Promise<Array<TransactionEntry>> {
    return this.#findEntries({
      workspace: location.workspace,
      root: location.root,
      filePath: {startsWith: location.filePathPrefix},
      filter: {_type: 'MediaFile'}
    })
  }

  #removeMediaFile(entry: Entry): void {
    const location = entry.data.location
    if (typeof location !== 'string') return
    this.removeFile({
      location: MediaLocation.storagePath(
        this.#workingDatabase.config,
        entry.workspace,
        location
      )
    })
  }

  #report(op: string, title: string): string {
    return `(${op}) ${title}`
  }

  #assertOpen(): void {
    if (this.#closed) throw new Error('EntryTransaction is closed')
  }
}
