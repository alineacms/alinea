import {Config} from '#/core/Config.js'
import {Entry, type EntryStatus} from '#/core/Entry.js'
import {createRecord} from '#/core/EntryRecord.js'
import {Field} from '#/core/Field.js'
import {getRoot} from '#/core/Internal.js'
import {ListRow} from '#/core/ListRow.js'
import {MediaLocation} from '#/core/media/MediaLocation.js'
import {Permission, type Policy} from '#/core/Role.js'
import {Type} from '#/core/Type.js'
import {ListEditor} from '#/core/field/ListField.js'
import type {ChangesBatch} from '#/core/source/Change.js'
import {OverlaySource} from '#/core/source/OverlaySource.js'
import {SourceTransaction} from '#/core/source/Source.js'
import type {ReadonlyTree} from '#/core/source/Tree.js'
import {assert} from '#/core/util/Assert.js'
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
import {aliasesFromData, aliasUrl} from '#/core/db/EntryAliases.js'
import {EntryUrlConflictError} from '#/core/db/EntryUrlConflictError.js'
import type {EntryDatabase} from './EntryDatabase.js'

type Op<T> = Omit<T, 'op'>

interface TransactionEntry extends Entry {
  versionStatus: EntryStatus
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

interface MoveTarget {
  id: string
  parentId: string | null
  workspace: string
  root: string
}

interface MoveUrlAliasUpdate {
  entry: TransactionEntry
  data: Record<string, unknown>
  filePath: string
}

const EntrySelection = {
  id: Entry.id,
  versionStatus: Entry.versionStatus,
  status: Entry.status,
  title: Entry.title,
  type: Entry.type,
  seeded: Entry.seeded,
  workspace: Entry.workspace,
  root: Entry.root,
  level: Entry.level,
  filePath: Entry.filePath,
  parentDir: Entry.parentDir,
  childrenDir: Entry.childrenDir,
  index: Entry.index,
  parentId: Entry.parentId,
  parents: Entry.parents,
  locale: Entry.locale,
  rowHash: Entry.rowHash,
  active: Entry.active,
  main: Entry.main,
  path: Entry.path,
  fileHash: Entry.fileHash,
  url: Entry.url,
  data: Entry.data,
  searchableText: Entry.searchableText
}

/**
 * Plans mutations inside the receiver's write transaction. Each mutation is
 * flushed so subsequent mutations query its result without retaining an
 * in-memory entry index. SQLite rolls the full batch back on failure.
 */
export class EntryTransaction implements AsyncDisposable {
  #workingDatabase: EntryDatabase
  #workingSource: OverlaySource
  #workingTree: ReadonlyTree
  #sourceTransaction: SourceTransaction
  #policy: Policy
  #messages = Array<string>()
  #fileChanges = Array<CommitChange>()
  #changedEntryIds = new Set<string>()
  #closed = false

  /** @internal Constructed by EntryDatabase.apply. */
  constructor(
    workingDatabase: EntryDatabase,
    workingSource: OverlaySource,
    sourceTransaction: SourceTransaction,
    from: ReadonlyTree,
    policy: Policy
  ) {
    this.#workingDatabase = workingDatabase
    this.#workingSource = workingSource
    this.#workingTree = from
    this.#sourceTransaction = sourceTransaction
    this.#policy = policy
  }

  get empty(): boolean {
    return this.#messages.length === 0
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

    const parent = parentId
      ? await this.#entry({id: parentId, locale, main: true})
      : undefined
    if (parentId) {
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
      path = await this.#availablePath({
        id,
        path,
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
    let index = existingMain?.index
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
    const parentDir = parent
      ? parent.childrenDir
      : Config.filePath(config, workspace, root, locale)
    const filePath = paths.join(
      parentDir,
      `${path}${status === 'published' ? '' : `.${status}`}.json`
    )
    if (locale !== null && status === 'published') {
      const from = existing.find(
        entry => entry.locale !== locale && entry.versionStatus === 'published'
      )
      if (from) {
        const typeInstance = config.schema[type]
        assert(typeInstance, `Type not found: ${type}`)
        data = {...Type.sharedData(typeInstance, from.data), ...data}
      }
    }
    if (status === 'published') {
      const candidate = {
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
        candidate,
        await this.#publishedEntry(id, locale)
      )
      if (locale !== null)
        await this.#persistSharedFields(id, locale, type, data)
      await this.#assertUniqueUrls({...candidate, data})
    }
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
    const entry = await this.#entry({id, locale, statuses: [status]})
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
      : await this.#availablePath({
          id,
          path: desiredPath,
          parentId: entry.parentId,
          root: entry.root,
          workspace: entry.workspace,
          locale
        })
    const childrenDir = paths.join(entry.parentDir, path)
    const filePath = `${childrenDir}${entry.versionStatus === 'published' ? '' : `.${entry.versionStatus}`}.json`
    if (entry.versionStatus === 'published') {
      this.#policy.assert(Permission.Publish, entry)
      if (filePath !== entry.filePath) await this.#rename(id, locale, path)
      const candidate = {
        id,
        type: entry.type,
        path,
        parentId: entry.parentId,
        root: entry.root,
        workspace: entry.workspace,
        locale,
        data
      }
      data = await this.#dataWithPreviousUrlAlias(candidate, entry)
      if (locale !== null)
        await this.#persistSharedFields(id, locale, entry.type, data)
      await this.#assertUniqueUrls({...candidate, data})
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
    const versions = await this.#versions(id, locale)
    const entry = versions.find(version => version.versionStatus === status)
    assert(entry, `Entry not found: ${id}`)
    this.#policy.assert(Permission.Publish, entry)
    const path = await this.#availablePath({
      id,
      path: slugify((entry.data.path as string) ?? entry.path),
      parentId: entry.parentId,
      root: entry.root,
      workspace: entry.workspace,
      locale
    })
    const childrenDir = paths.join(entry.parentDir, path)
    const candidate = {
      id,
      type: entry.type,
      path,
      parentId: entry.parentId,
      root: entry.root,
      workspace: entry.workspace,
      locale,
      data: entry.data
    }
    const data = await this.#dataWithPreviousUrlAlias(
      candidate,
      versions.find(version => version.versionStatus === 'published')
    )
    if (locale !== null)
      await this.#persistSharedFields(id, locale, entry.type, data)
    await this.#assertUniqueUrls({...candidate, data})
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
    await this.#changeMainStatus(id, locale, 'draft', Permission.Publish)
  }

  async archive({id, locale}: Op<ArchiveMutation>): Promise<void> {
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
      `${main.childrenDir}.${status}.json`
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
    const moving = await this.#versions(id)
    assert(moving.length, `Entry not found: ${id}`)
    const targetEntry =
      targetType === 'root'
        ? undefined
        : await this.#entry({id: target, main: true})
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
          : targetEntry!.parentId
    const root = targetType === 'root' ? target : targetEntry!.root
    const workspace = targetEntry?.workspace ?? moving[0].workspace
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
    const duplicateIndexes =
      new Set(siblings.map(entry => entry.index)).size !== siblings.length
    let index: string
    if (duplicateIndexes) {
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
      index = generated[insertion]
    } else {
      index = generateKeyBetween(
        siblings[insertion - 1]?.index ?? null,
        siblings[insertion]?.index ?? null
      )
    }
    for (const entry of moving) {
      const parent = parentId
        ? await this.#entry({id: parentId, locale: entry.locale, main: true})
        : undefined
      if (parentId) {
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
      const parentDir = parent
        ? parent.childrenDir
        : Config.filePath(
            this.#workingDatabase.config,
            workspace,
            root,
            entry.locale
          )
      const childrenDir = paths.join(parentDir, entry.path)
      const filePath = `${childrenDir}${entry.versionStatus === 'published' ? '' : `.${entry.versionStatus}`}.json`
      if (action === Permission.Move) {
        this.#sourceTransaction.remove(entry.filePath)
        this.#sourceTransaction.rename(entry.childrenDir, childrenDir)
      }
      this.#addRecord(
        filePath,
        createRecord(
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
      )
    }
    for (const update of aliasUpdates) {
      if (update.entry.id === id || update.data === update.entry.data) continue
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

  description(): string {
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
    const {from, into, changes} = await this.#sourceTransaction.compile()
    return {
      fromSha: from.sha,
      intoSha: into.sha,
      description: this.description(),
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
      await this.#workingSource.applyChanges(batch)
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
      const name =
        version.versionStatus === 'published'
          ? path
          : `${path}.${version.versionStatus}`
      this.#sourceTransaction.rename(
        version.filePath,
        paths.join(version.parentDir, `${name}.json`)
      )
      this.#sourceTransaction.rename(
        version.childrenDir,
        paths.join(version.parentDir, path)
      )
    }
  }

  async #availablePath(candidate: {
    id: string
    path: string
    parentId: string | null
    root: string
    workspace: string
    locale: string | null
  }): Promise<string> {
    const siblings = await this.#siblings({
      parentId: candidate.parentId,
      root: candidate.root,
      workspace: candidate.workspace,
      locale: candidate.locale
    })
    const conflicting = siblings
      .filter(
        entry =>
          entry.id !== candidate.id &&
          (entry.path === candidate.path ||
            entry.path.startsWith(`${candidate.path}-`))
      )
      .map(entry => entry.path)
    const suffix = pathSuffix(candidate.path, conflicting)
    return suffix === undefined ? candidate.path : `${candidate.path}-${suffix}`
  }

  async #assertUniqueUrls(candidate: UrlCandidate): Promise<void> {
    for (const url of await this.#candidateUrls(candidate)) {
      const [canonical, alias] = await Promise.all([
        this.#workingDatabase.first({
          workspace: candidate.workspace,
          root: candidate.root,
          url,
          select: Entry.id
        }),
        this.#workingDatabase.first({
          workspace: candidate.workspace,
          root: candidate.root,
          alias: url,
          select: Entry.id
        })
      ])
      const existing = canonical ?? alias
      if (typeof existing === 'string' && existing !== candidate.id)
        throw new EntryUrlConflictError({
          url,
          entryId: existing,
          workspace: candidate.workspace,
          root: candidate.root
        })
    }
  }

  async #candidateUrls(candidate: UrlCandidate): Promise<Array<string>> {
    return [
      await this.#resolvedUrl(candidate),
      ...aliasUrlsFromData(candidate.data)
    ]
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

  async #publishedEntry(
    id: string,
    locale: string | null
  ): Promise<TransactionEntry | undefined> {
    return this.#entry({id, locale, statuses: ['published']})
  }

  async #parentPaths(
    parentId: string | null,
    locale: string | null
  ): Promise<Array<string>> {
    if (!parentId) return []
    const parent = await this.#entry({id: parentId, locale, main: true})
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
    for (const translation of translations)
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
        ...((await this.#workingDatabase.find({
          status: 'published',
          filePath: {startsWith: `${entry.childrenDir}/`},
          select: EntrySelection
        })) as Array<TransactionEntry>)
      )
    const updates = Array<MoveUrlAliasUpdate>()
    for (const entry of published.concat(descendants)) {
      const parentPaths = await this.#movedParentPaths(entry, target, moving)
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
        filePath: await this.#movedFilePath(entry, target, moving)
      })
    }
    return updates
  }

  async #movedParentPaths(
    entry: TransactionEntry,
    target: MoveTarget,
    moving: ReadonlyArray<TransactionEntry>
  ): Promise<Array<string>> {
    const moved = moving.find(
      candidate => candidate.locale === entry.locale && candidate.main
    )
    assert(moved, `Missing moved entry language node`)
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
      startsWithSegments(currentParentPaths, previousPrefix),
      `Moved child is outside moved entry path`
    )
    return nextPrefix.concat(currentParentPaths.slice(previousPrefix.length))
  }

  async #movedFilePath(
    entry: TransactionEntry,
    target: MoveTarget,
    moving: ReadonlyArray<TransactionEntry>
  ): Promise<string> {
    const moved = moving.find(
      candidate => candidate.locale === entry.locale && candidate.main
    )
    assert(moved, `Missing moved entry language node`)
    const parent = target.parentId
      ? await this.#entry({
          id: target.parentId,
          locale: entry.locale,
          main: true
        })
      : undefined
    const parentDir = parent
      ? parent.childrenDir
      : Config.filePath(
          this.#workingDatabase.config,
          target.workspace,
          target.root,
          entry.locale
        )
    const nextPrefix = paths.join(parentDir, moved.path)
    if (entry.id === target.id)
      return `${nextPrefix}${entry.versionStatus === 'published' ? '' : `.${entry.versionStatus}`}.json`
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

  async #entry(query: {
    id: string
    locale?: string | null
    statuses?: ReadonlyArray<EntryStatus>
    main?: boolean
  }): Promise<TransactionEntry | undefined> {
    return (
      ((await this.#workingDatabase.first({
        id: query.id,
        locale: query.locale,
        status: 'all',
        select: EntrySelection,
        versionStatus: query.statuses ? {in: query.statuses} : undefined,
        main: query.main
      })) as TransactionEntry | null) ?? undefined
    )
  }

  #versions(
    id: string,
    locale?: string | null
  ): Promise<Array<TransactionEntry>> {
    return this.#workingDatabase.find({
      select: EntrySelection,
      status: 'all',
      id,
      locale
    }) as Promise<Array<TransactionEntry>>
  }

  #siblings(location: {
    parentId: string | null
    workspace: string
    root: string
    locale?: string | null
  }): Promise<Array<TransactionEntry>> {
    return this.#workingDatabase.find({
      select: EntrySelection,
      status: 'all',
      parentId: location.parentId,
      workspace: location.workspace,
      root: location.root,
      locale: location.locale
    }) as Promise<Array<TransactionEntry>>
  }

  #mediaFiles(location: {
    workspace: string
    root: string
    filePathPrefix: string
  }): Promise<Array<TransactionEntry>> {
    return this.#workingDatabase.find({
      select: EntrySelection,
      status: 'all',
      workspace: location.workspace,
      root: location.root,
      filePath: {startsWith: location.filePathPrefix},
      filter: {_type: 'MediaFile'}
    }) as Promise<Array<TransactionEntry>>
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

function aliasUrlsFromData(data: Record<string, unknown>): Array<string> {
  const result = new Set<string>()
  for (const alias of aliasesFromData(data) ?? []) {
    const url = aliasUrl(alias)
    if (url) result.add(url)
  }
  return Array.from(result)
}

function dataWithUrlAlias(
  type: Type,
  data: Record<string, unknown>,
  previousUrl: string,
  currentUrl: string
): Record<string, unknown> {
  if (!hasMetadataAliases(type)) return data
  const aliasUrls = aliasUrlsFromData(data)
  if (aliasUrls.includes(previousUrl)) return data
  const nextData = aliasUrls.includes(currentUrl)
    ? dataWithoutUrlAlias(data, currentUrl)
    : data
  const metadata = isRecord(nextData.metadata) ? nextData.metadata : {}
  const aliases = Array.isArray(metadata.aliases) ? metadata.aliases : []
  return dataWithAliases(
    nextData,
    metadata,
    aliases.concat(createUrlAliasRow(previousUrl, aliases))
  )
}

function dataWithoutUrlAlias(
  data: Record<string, unknown>,
  url: string
): Record<string, unknown> {
  const metadata = data.metadata
  if (!isRecord(metadata) || !Array.isArray(metadata.aliases)) return data
  return {
    ...data,
    metadata: {
      ...metadata,
      aliases: metadata.aliases.filter(alias => aliasUrl(alias) !== url)
    }
  }
}

function dataWithAliases(
  data: Record<string, unknown>,
  metadata: Record<string, unknown>,
  aliases: Array<unknown>
): Record<string, unknown> {
  return {...data, metadata: {...metadata, aliases}}
}

interface UrlAliasRow extends ListRow {
  _type: 'alias'
  url: string
}

function hasMetadataAliases(type: Type): boolean {
  const metadata = Type.field(type, 'metadata')
  if (!metadata) return false
  const options = Field.options(metadata)
  const fields = (options as {fields?: unknown}).fields
  return Type.isType(fields) && Boolean(Type.field(fields, 'aliases'))
}

function createUrlAliasRow(url: string, aliases: Array<unknown>) {
  const editor = new ListEditor<UrlAliasRow>(
    aliases.filter(isOrderedUrlAliasRow)
  )
  const created = editor.add('alias', {url}).value().at(-1)
  assert(created)
  return created
}

function isOrderedUrlAliasRow(value: unknown): value is UrlAliasRow {
  if (!isRecord(value)) return false
  const id = value[ListRow.id]
  const index = value[ListRow.index]
  return (
    typeof id === 'string' &&
    typeof index === 'string' &&
    isValidOrderKey(index) &&
    value[ListRow.type] === 'alias' &&
    typeof value.url === 'string'
  )
}

function startsWithSegments(
  value: ReadonlyArray<string>,
  prefix: ReadonlyArray<string>
): boolean {
  return prefix.every((segment, index) => value[index] === segment)
}
