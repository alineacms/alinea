import {Config} from 'alinea/core/Config'
import type {Entry} from 'alinea/core/Entry'
import type {EntryStatus} from 'alinea/core/Entry'
import {createRecord} from 'alinea/core/EntryRecord'
import {createId} from 'alinea/core/Id'
import {getRoot, getWorkspace} from 'alinea/core/Internal'
import {Type} from 'alinea/core/Type'
import {pathSuffix} from 'alinea/core/util/EntryFilenames'
import {
  generateKeyBetween,
  generateNKeysBetween
} from 'alinea/core/util/FractionalIndexing'
import {entries, fromEntries} from 'alinea/core/util/Objects'
import * as paths from 'alinea/core/util/Paths'
import {slugify} from 'alinea/core/util/Slugs'
import {unreachable} from 'alinea/core/util/Types'
import {Permission, Policy} from '../Role.js'
import {SourceTransaction} from '../source/Source.js'
import type {Source} from '../source/Source.js'
import type {ReadonlyTree} from '../source/Tree.js'
import {assert} from '../source/Utils.js'
import {type CommitChange, commitChanges} from './CommitRequest.js'
import type {EntryIndex} from './EntryIndex.js'
import type {
  ArchiveMutation,
  CreateMutation,
  MoveMutation,
  Mutation,
  PublishMutation,
  RemoveFileMutation,
  RemoveMutation,
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

export class EntryTransaction {
  #checks = Array<[path: string, sha: string]>()
  #messages = Array<string>()
  #config: Config
  #index: EntryIndex
  #tx: SourceTransaction
  #fileChanges = Array<CommitChange>()
  #policy: Policy

  constructor(
    config: Config,
    index: EntryIndex,
    source: Source,
    from: ReadonlyTree,
    policy = Policy.ALLOW_ALL
  ) {
    if (index.sha !== from.sha) throw new ShaMismatchError(index.sha, from.sha)
    this.#config = config
    this.#index = index
    this.#tx = new SourceTransaction(source, from)
    this.#policy = policy
  }

  get empty() {
    return this.#messages.length === 0
  }

  create({
    locale,
    type,
    data,
    root,
    workspace,
    fromSeed,
    parentId = null,
    id = createId(),
    insertOrder = 'last',
    status = 'published',
    overwrite = false
  }: Op<CreateMutation>) {
    const index = this.#index
    const rootConfig = this.#config.workspaces[workspace][root]
    assert(rootConfig, 'Invalid root')
    this.#policy.assert(Permission.Create, rootConfig)
    const i18n = getRoot(rootConfig).i18n
    if (i18n) assert(i18n.locales.includes(locale as string), 'Invalid locale')
    else assert(locale === null, 'Invalid locale')
    const existing = index.byId.get(id)
    if (existing) {
      parentId = existing.parentId
    }
    let parent: Entry | undefined
    if (parentId) {
      parent = index.findFirst(entry => {
        return entry.id === parentId && entry.locale === locale && entry.main
      })
      assert(parent, `Parent not found: ${parentId}`)
      this.#checks.push([parent.filePath, parent.fileHash])
      this.#policy.assert(Permission.Create, parentId)
    }
    const siblings = Array.from(
      index.findMany(entry => {
        return (
          entry.root === root &&
          entry.workspace === workspace &&
          entry.parentId === parentId
        )
      })
    )
    assert(typeof data === 'object', 'Invalid data')
    const title = data.title ?? data.path
    assert(typeof title === 'string', 'Missing title')
    let path = slugify(typeof data.path === 'string' ? data.path : title)
    assert(path.length > 0, 'Invalid path')
    path = this.#getAvailablePath({id, path, parentId, root, workspace, locale})
    if (existing) path = existing.pathOf(locale) ?? path
    if (overwrite && existing?.type === 'MediaFile') {
      const [prev] = existing.entries
      assert(prev, 'Previous entry not found')
      this.removeFile({
        location: paths.join(
          getWorkspace(this.#config.workspaces[prev.workspace]).mediaDir,
          prev.data.location
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
    const hasSameVersion = existing?.locales
      .get(locale)
      ?.has(status as EntryStatus)
    const warnDuplicate = !overwrite && hasSameVersion
    assert(!warnDuplicate, `Cannot create duplicate entry with id ${id}`)
    let newIndex: string
    if (existing) {
      newIndex = existing.index
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
      const from = index.findFirst(entry => {
        return (
          entry.id === id &&
          entry.locale !== locale &&
          entry.status === 'published'
        )
      })
      if (from) {
        const typeInstance = this.#config.schema[type]
        assert(typeInstance, `Type not found: ${type}`)
        const shared = Type.sharedData(typeInstance, from.data)
        data = {...shared, ...data}
      }
      this.#persistSharedFields(id, locale, type, data)
    }
    const seeds = existing?.locales.get(locale)?.values()
    const seeded = fromSeed ?? seeds?.next().value?.seeded ?? null
    const record = createRecord(
      {id, type, index: newIndex, path, seeded, data},
      status
    )
    const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
    this.#tx.add(filePath, contents)
    this.#messages.push(this.#reportOp('create', title))
    return this
  }

  update({id, locale, status, set}: Op<UpdateMutation>) {
    const index = this.#index
    const entry = index.findFirst(entry => {
      return (
        entry.id === id && entry.locale === locale && entry.status === status
      )
    })
    assert(entry, `Entry not found: ${id}`)
    this.#policy.assert(Permission.Update, id)
    const fieldUpdates = fromEntries(
      entries(set).map(([key, value]) => {
        return [key, value ?? null]
      })
    )
    const data = {...entry.data, ...fieldUpdates}
    if (locale !== null && status === 'published') {
      this.#persistSharedFields(id, locale, entry.type, data)
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
    const path = slugify((data.path as string) ?? entry.data.path ?? entry.path)
    this.#checks.push([entry.filePath, entry.fileHash])
    const childrenDir = paths.join(entry.parentDir, path)
    const filePath = `${childrenDir}${entry.status === 'published' ? '' : `.${entry.status}`}.json`
    if (entry.status === 'published') {
      this.#policy.assert(Permission.Publish, id)
      if (filePath !== entry.filePath) {
        // Rename children and other statuses
        const versions = index.findMany(entry => {
          return (
            entry.id === id &&
            entry.locale === locale &&
            entry.status !== 'published'
          )
        })
        for (const version of versions)
          this.#tx.rename(
            version.filePath,
            paths.join(entry.parentDir, `${path}.${version.status}.json`)
          )
        this.#tx.remove(entry.filePath)
        this.#tx.rename(entry.childrenDir, childrenDir)
      }
    } else {
      if (path !== entry.path) record.path = path
    }
    const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
    this.#tx.add(filePath, contents)
    this.#messages.push(this.#reportOp('update', entry.title))
    return this
  }

  #getAvailablePath(target: PathCandidate) {
    const conflictingPaths = Array.from(
      this.#index.findMany(entry => {
        return (
          entry.id !== target.id &&
          entry.parentId === target.parentId &&
          entry.workspace === target.workspace &&
          entry.root === target.root &&
          entry.locale === target.locale &&
          (entry.path === target.path ||
            entry.path.startsWith(`${target.path}-`))
        )
      })
    ).map(entry => entry.path)
    const suffix = pathSuffix(target.path, conflictingPaths)
    if (suffix !== undefined) return `${target.path}-${suffix}`
    return target.path
  }

  #persistSharedFields(
    id: string,
    locale: string,
    type: string,
    data: Record<string, unknown>
  ) {
    const index = this.#index
    const typeInstance = this.#config.schema[type]
    assert(type, `Type not found: ${type}`)
    const shared = Type.sharedData(typeInstance, data)
    if (shared) {
      const translations = index.findMany(entry => {
        return entry.id === id && entry.locale !== locale
      })
      for (const translation of translations) {
        this.#checks.push([translation.filePath, translation.fileHash])
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

  publish({id, locale, status}: Op<PublishMutation>) {
    const index = this.#index
    const entry = index.findFirst(entry => {
      return (
        entry.id === id && entry.locale === locale && entry.status === status
      )
    })
    assert(entry, `Entry not found: ${id}`)
    this.#policy.assert(Permission.Publish, id)
    const pathChange = entry.data.path && entry.data.path !== entry.path
    let path = slugify(entry.data.path ?? entry.path)
    path = this.#getAvailablePath({
      id,
      path,
      parentId: entry.parentId,
      root: entry.root,
      workspace: entry.workspace,
      locale
    })
    const childrenDir = paths.join(entry.parentDir, path)
    if (entry.locale !== null)
      this.#persistSharedFields(id, entry.locale, entry.type, entry.data)
    this.#checks.push([entry.filePath, entry.fileHash])
    this.#tx.remove(entry.filePath)
    const record = createRecord({...entry, path}, 'published')
    const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
    this.#tx.add(`${childrenDir}.json`, contents)
    if (pathChange) {
      this.#tx.remove(`${entry.parentDir}/${entry.path}.json`)
      this.#tx.rename(entry.childrenDir, childrenDir)
      const versions = index.findMany(entry => {
        return (
          entry.id === id &&
          entry.locale === locale &&
          entry.status !== 'published' &&
          entry.status !== status
        )
      })
      for (const version of versions) {
        this.#tx.rename(
          version.filePath,
          paths.join(entry.parentDir, `${path}.${version.status}.json`)
        )
        this.#tx.rename(
          version.childrenDir,
          paths.join(entry.parentDir, `${path}`)
        )
      }
    }
    this.#messages.push(this.#reportOp('publish', entry.title))
    return this
  }

  archive({id, locale}: Op<ArchiveMutation>) {
    const index = this.#index
    const entry = index.findFirst(entry => {
      return (
        entry.id === id &&
        entry.locale === locale &&
        entry.status === 'published'
      )
    })
    assert(entry, `Entry not found: ${id}`)
    this.#policy.assert(Permission.Archive, id)
    this.#checks.push([entry.filePath, entry.fileHash])
    this.#tx.rename(entry.filePath, `${entry.childrenDir}.${'archived'}.json`)
    this.#messages.push(this.#reportOp('archive', entry.title))
    return this
  }

  move({id, after, toParent, toRoot}: Op<MoveMutation>) {
    const index = this.#index
    const entries = Array.from(index.findMany(entry => entry.id === id))
    assert(entries.length > 0, `Entry not found: ${id}`)
    const action = toParent || toRoot ? Permission.Move : Permission.Reorder
    this.#policy.assert(action, id)
    const parentId = toRoot ? null : (toParent ?? entries[0].parentId)
    const root = toRoot ?? entries[0].root
    const workspace = entries[0].workspace
    const siblings = new Map(
      Array.from(
        index.findMany(entry => {
          return (
            entry.workspace === workspace &&
            entry.root === root &&
            entry.parentId === parentId &&
            entry.id !== id
          )
        })
      ).map(entry => [entry.id, entry])
    )
    if (after) assert(siblings.has(after), `Sibling not found: ${after}`)
    const siblingList = Array.from(siblings.values())
    const previousIndex = after
      ? siblingList.findIndex(entry => entry.id === after)
      : -1
    const nextIndex = previousIndex + 1
    const previous = siblingList[previousIndex] ?? null
    const next = siblingList[nextIndex] ?? null
    const seen = new Set()
    const hasDuplicates = siblingList.some(entry => {
      const wasSeen = seen.has(entry.index)
      if (wasSeen) return true
      seen.add(entry.index)
      return false
    })
    let newIndex: string
    if (hasDuplicates) {
      const self = index.findFirst(entry => entry.id === id)
      assert(self, `Entry not found: ${id}`)
      siblingList.splice(previousIndex + 1, 0, self)
      const newKeys = generateNKeysBetween(null, null, siblingList.length)
      for (const [i, key] of newKeys.entries()) {
        const id = siblingList[i].id
        const node = index.byId.get(id)
        assert(node)
        for (const child of node.byFile.values()) {
          const record = createRecord(
            {
              id,
              type: child.type,
              index: key,
              path: child.path,
              seeded: child.seeded,
              data: child.data
            },
            child.status
          )
          const contents = new TextEncoder().encode(
            JSON.stringify(record, null, 2)
          )
          this.#tx.add(child.filePath, contents)
        }
      }
      newIndex = newKeys[previousIndex + 1]
    } else {
      newIndex = generateKeyBetween(
        previous?.index ?? null,
        next?.index ?? null
      )
    }
    let info: Entry | undefined
    for (const entry of entries) {
      info = entry
      const parent = parentId
        ? index.findFirst(e => {
            return e.id === parentId && e.locale === entry.locale
          })
        : undefined

      if (toParent) {
        assert(!entry.seeded, `Cannot move seeded entry ${entry.filePath}`)
        assert(parent, `Parent not found: ${parentId}`)
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
      const record = createRecord(
        {
          id,
          type: entry.type,
          index: newIndex,
          path: entry.path,
          seeded: entry.seeded,
          data: entry.data
        },
        entry.status
      )
      const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
      if (toParent || toRoot) {
        this.#tx.remove(entry.filePath)
        this.#tx.rename(entry.childrenDir, childrenDir)
      }
      this.#tx.add(filePath, contents)
    }
    this.#messages.push(this.#reportOp('move', info!.title))
    return this
  }

  remove({id, locale, status}: Op<RemoveMutation>) {
    const index = this.#index
    const entries = index.findMany(entry => {
      const matchesStatus = status === undefined || entry.status === status
      const matchesLocale = locale === undefined || entry.locale === locale
      return entry.id === id && matchesLocale && matchesStatus
    })
    let info: Entry | undefined
    for (const entry of entries) {
      if (entry.status === 'published')
        assert(!entry.seeded, `Cannot remove seeded entry ${entry.filePath}`)
      info = entry
      this.#checks.push([entry.filePath, entry.fileHash])
      this.#tx.remove(entry.filePath)
      if (entry.status !== 'draft') {
        this.#tx.remove(entry.childrenDir)
      }
      if (entry.type === 'MediaLibrary') {
        const workspace = this.#config.workspaces[entry.workspace]
        const mediaDir = getWorkspace(workspace).mediaDir
        // Find all files within children
        const files = index.findMany(f => {
          return (
            f.workspace === entry.workspace &&
            f.root === entry.root &&
            f.filePath.startsWith(entry.childrenDir) &&
            f.type === 'MediaFile'
          )
        })
        for (const file of files) {
          this.removeFile({
            location: paths.join(mediaDir, file.data.location)
          })
        }
      }
      if (entry.type === 'MediaFile') {
        const workspace = this.#config.workspaces[entry.workspace]
        const mediaDir = getWorkspace(workspace).mediaDir
        this.removeFile({location: paths.join(mediaDir, entry.data.location)})
      }
    }
    if (info) {
      this.#policy.assert(Permission.Delete, info.id)
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

  apply(mutations: Array<Mutation>) {
    for (const mutation of mutations) {
      switch (mutation.op) {
        case 'create':
          this.create(mutation)
          break
        case 'update':
          this.update(mutation)
          break
        case 'publish':
          this.publish(mutation)
          break
        case 'archive':
          this.archive(mutation)
          break
        case 'move':
          this.move(mutation)
          break
        case 'remove':
          this.remove(mutation)
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
      checks: this.#checks,
      changes: this.#fileChanges.concat(commitChanges(changes))
    }
  }
}

export class ShaMismatchError extends Error {
  status = 409
  constructor(
    public actual: string,
    public expected: string
  ) {
    super(`SHA mismatch: ${actual} != ${expected}`)
  }
}
